"""Integration stubs (Bucket 14).

Provides endpoints for external system integration:
  - IRT import/export (enrollment actuals, site status)
  - Depot/WMS feeds (inventory receipts)
  - Courier tracking (shipment status updates)
  - EDC exports (dispense actuals)

These are v1 stubs — implement the actual API calls when connecting to
real external systems.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.inventory import InventoryLot, InventoryNode, InventoryTransaction
from app.models.subject import Subject

router = APIRouter()


# ---------------------------------------------------------------------------
# IRT Import — enrollment actuals
# ---------------------------------------------------------------------------


class IRTSubjectImport(BaseModel):
    model_config = ConfigDict(extra="allow")
    subject_number: str
    site_node_id: Optional[str] = None
    cohort_id: Optional[str] = None
    status: str = "ENROLLED"
    enrolled_date: Optional[str] = None


class IRTImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subjects: List[IRTSubjectImport]
    source_system: str = "IRT"


class IRTImportResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    imported: int
    skipped: int
    errors: List[str]


@router.post("/integrations/irt/import-subjects", response_model=IRTImportResult)
def import_irt_subjects(body: IRTImportRequest, db: Session = Depends(get_db)):
    """Import subject enrollment data from an IRT system."""
    imported = 0
    skipped = 0
    errors: list[str] = []

    for s in body.subjects:
        existing = db.execute(
            select(Subject).where(Subject.subject_number == s.subject_number)
        ).scalar_one_or_none()

        if existing:
            skipped += 1
            continue

        site_uuid = None
        if s.site_node_id:
            node = db.execute(
                select(InventoryNode).where(InventoryNode.node_id == s.site_node_id)
            ).scalar_one_or_none()
            if node:
                site_uuid = node.id

        try:
            subject = Subject(
                subject_number=s.subject_number,
                cohort_id=s.cohort_id,
                site_node_id=site_uuid,
                status=s.status.upper(),
                enrolled_at=datetime.now(UTC) if s.status.upper() in ("ENROLLED", "ACTIVE") else None,
                attributes={"source": body.source_system},
            )
            db.add(subject)
            imported += 1
        except Exception as e:
            errors.append(f"{s.subject_number}: {str(e)}")

    db.commit()
    return IRTImportResult(imported=imported, skipped=skipped, errors=errors)


# ---------------------------------------------------------------------------
# IRT Export — current enrollment status
# ---------------------------------------------------------------------------


class IRTSubjectExport(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject_number: str
    cohort_id: Optional[str]
    status: str
    enrolled_at: Optional[str]


@router.get("/integrations/irt/export-subjects", response_model=list[IRTSubjectExport])
def export_irt_subjects(db: Session = Depends(get_db)):
    """Export current subject enrollment status for IRT reconciliation."""
    subjects = db.execute(select(Subject).order_by(Subject.subject_number)).scalars().all()
    return [
        IRTSubjectExport(
            subject_number=s.subject_number,
            cohort_id=s.cohort_id,
            status=s.status,
            enrolled_at=s.enrolled_at.isoformat() if s.enrolled_at else None,
        )
        for s in subjects
    ]


# ---------------------------------------------------------------------------
# Depot/WMS — inventory receipt feed
# ---------------------------------------------------------------------------


class WMSReceiptItem(BaseModel):
    model_config = ConfigDict(extra="allow")
    node_id: str
    product_id: str
    presentation_id: Optional[str] = None
    lot_number: str
    expiry_date: Optional[str] = None
    qty: float


class WMSReceiptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: List[WMSReceiptItem]
    source_system: str = "WMS"


class WMSReceiptResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    received: int
    errors: List[str]


@router.post("/integrations/wms/receipt", response_model=WMSReceiptResult)
def receive_wms_inventory(body: WMSReceiptRequest, db: Session = Depends(get_db)):
    """Receive inventory from a WMS/depot feed."""
    received = 0
    errors: list[str] = []

    for item in body.items:
        node = db.execute(
            select(InventoryNode).where(InventoryNode.node_id == item.node_id)
        ).scalar_one_or_none()
        if not node:
            errors.append(f"Node '{item.node_id}' not found")
            continue

        # Find or create lot
        lot = db.execute(
            select(InventoryLot).where(
                InventoryLot.node_id == node.id,
                InventoryLot.product_id == item.product_id,
                InventoryLot.lot_number == item.lot_number,
            )
        ).scalar_one_or_none()

        if lot:
            lot.qty_on_hand += item.qty
            lot.updated_at = datetime.now(UTC)
        else:
            exp_date = None
            if item.expiry_date:
                try:
                    from datetime import date
                    exp_date = datetime.fromisoformat(item.expiry_date)
                except Exception:
                    pass

            lot = InventoryLot(
                node_id=node.id,
                product_id=item.product_id,
                presentation_id=item.presentation_id,
                lot_number=item.lot_number,
                expiry_date=exp_date,
                status="RELEASED",
                qty_on_hand=item.qty,
            )
            db.add(lot)
            db.flush()

        txn = InventoryTransaction(
            lot_id=lot.id,
            txn_type="RECEIPT",
            qty=item.qty,
            to_node_id=node.id,
            reference_type="WMS_RECEIPT",
            notes=f"Source: {body.source_system}",
        )
        db.add(txn)
        received += 1

    db.commit()
    return WMSReceiptResult(received=received, errors=errors)


# ---------------------------------------------------------------------------
# Courier tracking — update shipment status
# ---------------------------------------------------------------------------


class CourierUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    shipment_id: UUID
    tracking_number: Optional[str] = None
    courier_status: str  # e.g. "IN_TRANSIT", "DELIVERED"
    timestamp: Optional[str] = None
    notes: Optional[str] = None


class CourierUpdateResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    updated: bool
    message: str


@router.post("/integrations/courier/update", response_model=CourierUpdateResult)
def update_courier_status(body: CourierUpdate, db: Session = Depends(get_db)):
    """Receive shipment tracking updates from courier API."""
    from app.models.shipment import Shipment

    shipment = db.get(Shipment, body.shipment_id)
    if not shipment:
        return CourierUpdateResult(updated=False, message="Shipment not found")

    if body.tracking_number:
        shipment.tracking_number = body.tracking_number

    status_map = {
        "IN_TRANSIT": "IN_TRANSIT",
        "PICKED_UP": "SHIPPED",
        "DELIVERED": "RECEIVED",
        "OUT_FOR_DELIVERY": "IN_TRANSIT",
    }
    new_status = status_map.get(body.courier_status.upper())
    if new_status and shipment.status != "RECEIVED":
        shipment.status = new_status
        if new_status == "RECEIVED":
            shipment.received_at = datetime.now(UTC)

    if body.notes:
        shipment.notes = (shipment.notes or "") + f"\n[COURIER] {body.notes}"

    db.commit()
    return CourierUpdateResult(updated=True, message=f"Shipment updated to {shipment.status}")
