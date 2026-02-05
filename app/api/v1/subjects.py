from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.inventory import InventoryLot, InventoryNode, InventoryTransaction
from app.models.subject import KitAssignment, Subject, SubjectVisit
from app.schemas.subject import (
    DispenseRequest,
    KitAssignmentOut,
    KitReturnRequest,
    SubjectCreate,
    SubjectOut,
    SubjectUpdate,
    SubjectVisitCreate,
    SubjectVisitOut,
    SubjectVisitUpdate,
)

router = APIRouter()

VALID_SUBJECT_STATUSES = {"SCREENED", "ENROLLED", "ACTIVE", "DISCONTINUED", "COMPLETED"}
VALID_VISIT_STATUSES = {"SCHEDULED", "COMPLETED", "MISSED", "CANCELLED"}


# ---------------------------------------------------------------------------
# Subjects
# ---------------------------------------------------------------------------


@router.post("/subjects", response_model=SubjectOut)
def create_subject(body: SubjectCreate, db: Session = Depends(get_db)):
    existing = db.execute(
        select(Subject).where(Subject.subject_number == body.subject_number)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Subject '{body.subject_number}' already exists")

    site_uuid = None
    if body.site_node_id:
        node = db.execute(
            select(InventoryNode).where(InventoryNode.node_id == body.site_node_id)
        ).scalar_one_or_none()
        if not node:
            raise HTTPException(status_code=404, detail=f"Site node '{body.site_node_id}' not found")
        site_uuid = node.id

    subject = Subject(
        subject_number=body.subject_number,
        scenario_id=body.scenario_id,
        cohort_id=body.cohort_id,
        arm_id=body.arm_id,
        site_node_id=site_uuid,
        status=body.status.upper(),
        screened_at=body.screened_at or datetime.now(UTC),
        notes=body.notes,
        attributes=body.attributes,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.get("/subjects", response_model=list[SubjectOut])
def list_subjects(
    status: str | None = Query(None),
    cohort_id: str | None = Query(None),
    scenario_id: UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = select(Subject)
    if status:
        q = q.where(Subject.status == status.upper())
    if cohort_id:
        q = q.where(Subject.cohort_id == cohort_id)
    if scenario_id:
        q = q.where(Subject.scenario_id == scenario_id)
    q = q.order_by(Subject.created_at.desc()).offset(skip).limit(limit)
    return db.execute(q).scalars().all()


@router.get("/subjects/{subject_id}", response_model=SubjectOut)
def get_subject(subject_id: UUID, db: Session = Depends(get_db)):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
def update_subject(subject_id: UUID, body: SubjectUpdate, db: Session = Depends(get_db)):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    updates = body.model_dump(exclude_unset=True)
    if "status" in updates:
        new_status = updates["status"].upper()
        if new_status not in VALID_SUBJECT_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {VALID_SUBJECT_STATUSES}")
        subject.status = new_status
        if new_status == "ENROLLED" and not subject.enrolled_at:
            subject.enrolled_at = datetime.now(UTC)
        elif new_status == "DISCONTINUED" and not subject.discontinued_at:
            subject.discontinued_at = datetime.now(UTC)
        elif new_status == "COMPLETED" and not subject.completed_at:
            subject.completed_at = datetime.now(UTC)

    for field in ("cohort_id", "arm_id", "notes", "enrolled_at", "discontinued_at", "completed_at"):
        if field in updates:
            setattr(subject, field, updates[field])

    db.commit()
    db.refresh(subject)
    return subject


# ---------------------------------------------------------------------------
# Subject Visits
# ---------------------------------------------------------------------------


@router.post("/subjects/{subject_id}/visits", response_model=SubjectVisitOut)
def create_visit(subject_id: UUID, body: SubjectVisitCreate, db: Session = Depends(get_db)):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    visit = SubjectVisit(
        subject_id=subject_id,
        visit_id=body.visit_id,
        scheduled_date=body.scheduled_date,
        status=body.status.upper(),
        notes=body.notes,
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit


@router.get("/subjects/{subject_id}/visits", response_model=list[SubjectVisitOut])
def list_visits(subject_id: UUID, db: Session = Depends(get_db)):
    rows = db.execute(
        select(SubjectVisit)
        .where(SubjectVisit.subject_id == subject_id)
        .order_by(SubjectVisit.scheduled_date.asc().nullslast())
    ).scalars().all()
    return rows


@router.patch("/subjects/{subject_id}/visits/{visit_pk}", response_model=SubjectVisitOut)
def update_visit(subject_id: UUID, visit_pk: UUID, body: SubjectVisitUpdate, db: Session = Depends(get_db)):
    visit = db.get(SubjectVisit, visit_pk)
    if not visit or visit.subject_id != subject_id:
        raise HTTPException(status_code=404, detail="Visit not found")

    updates = body.model_dump(exclude_unset=True)
    if "status" in updates:
        new_status = updates["status"].upper()
        if new_status not in VALID_VISIT_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid visit status. Must be one of: {VALID_VISIT_STATUSES}")
        visit.status = new_status
        if new_status == "COMPLETED" and not visit.actual_date:
            visit.actual_date = datetime.now(UTC)

    for field in ("actual_date", "notes"):
        if field in updates:
            setattr(visit, field, updates[field])

    db.commit()
    db.refresh(visit)
    return visit


# ---------------------------------------------------------------------------
# Kit Assignment / Dispense
# ---------------------------------------------------------------------------


@router.post("/subjects/{subject_id}/visits/{visit_pk}/dispense", response_model=KitAssignmentOut)
def dispense_kit(
    subject_id: UUID,
    visit_pk: UUID,
    body: DispenseRequest,
    db: Session = Depends(get_db),
):
    visit = db.get(SubjectVisit, visit_pk)
    if not visit or visit.subject_id != subject_id:
        raise HTTPException(status_code=404, detail="Visit not found")

    # If lot specified, issue from inventory
    if body.lot_id:
        lot = db.get(InventoryLot, body.lot_id)
        if not lot:
            raise HTTPException(status_code=404, detail="Lot not found")
        if lot.qty_on_hand < body.qty_dispensed:
            raise HTTPException(status_code=400, detail="Insufficient inventory in lot")

        lot.qty_on_hand -= body.qty_dispensed
        lot.updated_at = datetime.now(UTC)

        txn = InventoryTransaction(
            lot_id=body.lot_id,
            txn_type="ISSUE",
            qty=-body.qty_dispensed,
            reference_type="DISPENSE",
            reference_id=str(visit_pk),
            created_by=body.dispensed_by,
        )
        db.add(txn)

    ka = KitAssignment(
        subject_visit_id=visit_pk,
        lot_id=body.lot_id,
        product_id=body.product_id,
        presentation_id=body.presentation_id,
        qty_dispensed=body.qty_dispensed,
        dispensed_at=datetime.now(UTC),
        dispensed_by=body.dispensed_by,
    )
    db.add(ka)
    db.commit()
    db.refresh(ka)
    return ka


@router.get("/subjects/{subject_id}/visits/{visit_pk}/kits", response_model=list[KitAssignmentOut])
def list_kits(subject_id: UUID, visit_pk: UUID, db: Session = Depends(get_db)):
    visit = db.get(SubjectVisit, visit_pk)
    if not visit or visit.subject_id != subject_id:
        raise HTTPException(status_code=404, detail="Visit not found")

    rows = db.execute(
        select(KitAssignment).where(KitAssignment.subject_visit_id == visit_pk)
    ).scalars().all()
    return rows


@router.post("/subjects/{subject_id}/visits/{visit_pk}/kits/{kit_id}/return", response_model=KitAssignmentOut)
def return_kit(
    subject_id: UUID,
    visit_pk: UUID,
    kit_id: UUID,
    body: KitReturnRequest,
    db: Session = Depends(get_db),
):
    ka = db.get(KitAssignment, kit_id)
    if not ka or ka.subject_visit_id != visit_pk:
        raise HTTPException(status_code=404, detail="Kit assignment not found")

    ka.returned_qty = body.returned_qty
    ka.returned_at = datetime.now(UTC)

    # Return to inventory if lot is tracked
    if ka.lot_id:
        lot = db.get(InventoryLot, ka.lot_id)
        if lot:
            lot.qty_on_hand += body.returned_qty
            lot.updated_at = datetime.now(UTC)

            txn = InventoryTransaction(
                lot_id=ka.lot_id,
                txn_type="RETURN",
                qty=body.returned_qty,
                reference_type="KIT_RETURN",
                reference_id=str(kit_id),
            )
            db.add(txn)

    db.commit()
    db.refresh(ka)
    return ka
