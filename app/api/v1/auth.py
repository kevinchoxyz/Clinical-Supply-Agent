from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.auth import (
    create_token,
    hash_password,
    require_admin,
    require_auth,
    verify_password,
)
from app.db.session import get_db
from app.models.user import AuditLog, User
from app.schemas.user import (
    AuditLogOut,
    TokenOut,
    UserLogin,
    UserOut,
    UserRegister,
)

router = APIRouter()

VALID_ROLES = {"ADMIN", "SUPPLY_CHAIN", "SITE", "READONLY"}


@router.post("/auth/register", response_model=UserOut)
def register(body: UserRegister, request: Request, db: Session = Depends(get_db)):
    role = body.role.upper()
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")

    existing = db.execute(
        select(User).where((User.username == body.username) | (User.email == body.email))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Username or email already registered")

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=role,
        tenant_id=body.tenant_id,
    )
    db.add(user)
    db.flush()

    log_action(
        db,
        action="REGISTER",
        resource_type="USER",
        resource_id=str(user.id),
        user_id=user.id,
        username=user.username,
        ip_address=request.client.host if request.client else None,
    )

    db.commit()
    db.refresh(user)
    return user


@router.post("/auth/login", response_model=TokenOut)
def login(body: UserLogin, request: Request, db: Session = Depends(get_db)):
    user = db.execute(
        select(User).where(User.username == body.username)
    ).scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = create_token(
        user_id=str(user.id),
        username=user.username,
        role=user.role,
        tenant_id=user.tenant_id,
    )

    log_action(
        db,
        action="LOGIN",
        resource_type="USER",
        resource_id=str(user.id),
        user_id=user.id,
        username=user.username,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    return TokenOut(
        access_token=token,
        role=user.role,
        username=user.username,
    )


@router.get("/auth/me", response_model=UserOut)
def get_me(current_user: dict = Depends(require_auth), db: Session = Depends(get_db)):
    user = db.get(User, UUID(current_user["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/auth/users", response_model=list[UserOut])
def list_users(
    current_user: dict = Depends(require_admin),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
    ).scalars().all()
    return rows


@router.get("/audit-logs", response_model=list[AuditLogOut])
def list_audit_logs(
    current_user: dict = Depends(require_admin),
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = select(AuditLog)
    if action:
        q = q.where(AuditLog.action == action.upper())
    if resource_type:
        q = q.where(AuditLog.resource_type == resource_type.upper())
    q = q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    return db.execute(q).scalars().all()
