"""JWT authentication and role-based access control.

Uses PyJWT for token management and hashlib for password hashing (v1).
Upgrade to passlib[bcrypt] or argon2 for production.
"""

import hashlib
import hmac
import os
import secrets
from datetime import UTC, datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.db.session import get_db

# JWT-like token using HMAC-SHA256 (no external dependency)
# Format: base64(header.payload.signature)
# For production: switch to PyJWT or python-jose

import base64
import json

_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me-in-production")
_ALGORITHM = "HS256"
_TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash password with PBKDF2-SHA256. For v1 — upgrade to bcrypt/argon2 later."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    parts = hashed.split("$", 1)
    if len(parts) != 2:
        return False
    salt, stored_hash = parts
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return hmac.compare_digest(dk.hex(), stored_hash)


def create_token(user_id: str, username: str, role: str, tenant_id: str | None = None) -> str:
    """Create a signed JWT-like token."""
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "tenant_id": tenant_id,
        "exp": (datetime.now(UTC) + timedelta(hours=_TOKEN_EXPIRE_HOURS)).isoformat(),
        "iat": datetime.now(UTC).isoformat(),
    }
    payload_bytes = base64.urlsafe_b64encode(json.dumps(payload).encode())
    signature = hmac.new(
        _SECRET_KEY.encode(), payload_bytes, hashlib.sha256
    ).hexdigest()
    return f"{payload_bytes.decode()}.{signature}"


def decode_token(token: str) -> dict | None:
    """Decode and verify a token. Returns payload dict or None."""
    parts = token.split(".", 1)
    if len(parts) != 2:
        return None

    payload_b64, signature = parts
    expected_sig = hmac.new(
        _SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_sig):
        return None

    try:
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception:
        return None

    # Check expiry
    exp = payload.get("exp")
    if exp:
        try:
            exp_dt = datetime.fromisoformat(exp)
            if datetime.now(UTC) > exp_dt:
                return None
        except Exception:
            pass

    return payload


class CurrentUser:
    """Dependency that extracts the current user from the token."""

    def __init__(self, required_roles: list[str] | None = None):
        self.required_roles = required_roles

    def __call__(
        self,
        request: Request,
        credentials: HTTPAuthorizationCredentials | None = Depends(security),
        db: Session = Depends(get_db),
    ) -> dict:
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )

        payload = decode_token(credentials.credentials)
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        if self.required_roles:
            role = payload.get("role", "")
            if role not in self.required_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required: {self.required_roles}",
                )

        return payload


# Convenience dependencies
require_auth = CurrentUser()
require_admin = CurrentUser(required_roles=["ADMIN"])
require_supply_chain = CurrentUser(required_roles=["ADMIN", "SUPPLY_CHAIN"])
require_site = CurrentUser(required_roles=["ADMIN", "SUPPLY_CHAIN", "SITE"])
