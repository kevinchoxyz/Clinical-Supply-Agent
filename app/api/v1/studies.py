from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.study import Study
from app.schemas.study import StudyCreate, StudyDetailOut, StudyOut, StudyUpdate

router = APIRouter()


@router.post("/studies", response_model=StudyOut)
def create_study(body: StudyCreate, db: Session = Depends(get_db)):
    now = datetime.now(UTC)
    study = Study(
        study_code=body.study_code,
        name=body.name,
        description=body.description,
        phase=body.phase,
        protocol_version=body.protocol_version,
        countries=body.countries,
        payload=body.payload.model_dump(mode="json"),
        created_at=now,
        updated_at=now,
    )
    db.add(study)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=409, detail="Study code already exists")
    db.refresh(study)
    return study


@router.get("/studies", response_model=list[StudyOut])
def list_studies(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    rows = (
        db.execute(
            select(Study)
            .order_by(Study.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return rows


@router.get("/studies/{study_id}", response_model=StudyDetailOut)
def get_study(study_id: UUID, db: Session = Depends(get_db)):
    study = db.get(Study, study_id)
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")
    return study


@router.patch("/studies/{study_id}", response_model=StudyDetailOut)
def update_study(study_id: UUID, body: StudyUpdate, db: Session = Depends(get_db)):
    study = db.get(Study, study_id)
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "payload" and value is not None:
            setattr(study, field, body.payload.model_dump(mode="json"))
        else:
            setattr(study, field, value)

    study.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(study)
    return study


@router.delete("/studies/{study_id}")
def delete_study(study_id: UUID, db: Session = Depends(get_db)):
    study = db.get(Study, study_id)
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    if study.scenarios:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete study with linked scenarios. Remove or reassign scenarios first.",
        )

    db.delete(study)
    db.commit()
    return {"detail": "Study deleted"}
