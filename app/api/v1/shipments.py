from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.inventory import InventoryLot, InventoryNode, InventoryTransaction
from app.models.shipment import Shipment, ShipmentItem
from app.schemas.shipment import ShipmentAction, ShipmentCreate, ShipmentOut

router = APIRouter()

VALID_TRANSITIONS = {
    "REQUESTED": ["APPROVED", "CANCELLED"],
    "APPROVED": ["PICKED", "CANCELLED"],
    "PICKED": ["SHIPPED", "CANCELLED"],
    "SHIPPED": ["IN_TRANSIT"],
    "IN_TRANSIT": ["RECEIVED"],
}


def _resolve_node(db: Session, node_id_str: str) -> InventoryNode:
    node = db.execute(
        select(InventoryNode).where(InventoryNode.node_id == node_id_str)
    ).scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail=f"Node '{node_id_str}' not found")
    return node


def _load_shipment(db: Session, shipment_id: UUID) -> Shipment:
    shipment = db.execute(
        select(Shipment)
        .options(selectinload(Shipment.items))
        .where(Shipment.id == shipment_id)
    ).scalar_one_or_none()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return shipment


@router.post("/shipments", response_model=ShipmentOut)
def create_shipment(body: ShipmentCreate, db: Session = Depends(get_db)):
    from_node = _resolve_node(db, body.from_node_id)
    to_node = _resolve_node(db, body.to_node_id)

    shipment = Shipment(
        from_node_id=from_node.id,
        to_node_id=to_node.id,
        lane_id=body.lane_id,
        temperature_req=body.temperature_req,
        courier=body.courier,
        notes=body.notes,
        requested_by=body.requested_by,
        status="REQUESTED",
    )
    db.add(shipment)
    db.flush()  # get shipment.id

    for item in body.items:
        lot = db.get(InventoryLot, item.lot_id)
        if not lot:
            raise HTTPException(status_code=404, detail=f"Lot {item.lot_id} not found")

        si = ShipmentItem(
            shipment_id=shipment.id,
            lot_id=item.lot_id,
            product_id=item.product_id,
            presentation_id=item.presentation_id,
            qty=item.qty,
        )
        db.add(si)

    db.commit()
    db.refresh(shipment)
    return _load_shipment(db, shipment.id)


@router.get("/shipments", response_model=list[ShipmentOut])
def list_shipments(
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = select(Shipment).options(selectinload(Shipment.items))
    if status:
        q = q.where(Shipment.status == status.upper())
    q = q.order_by(Shipment.requested_at.desc()).offset(skip).limit(limit)
    return db.execute(q).scalars().unique().all()


@router.get("/shipments/{shipment_id}", response_model=ShipmentOut)
def get_shipment(shipment_id: UUID, db: Session = Depends(get_db)):
    return _load_shipment(db, shipment_id)


@router.post("/shipments/{shipment_id}/approve", response_model=ShipmentOut)
def approve_shipment(shipment_id: UUID, body: ShipmentAction, db: Session = Depends(get_db)):
    shipment = _load_shipment(db, shipment_id)
    _assert_transition(shipment, "APPROVED")
    shipment.status = "APPROVED"
    shipment.approved_by = body.performed_by
    shipment.approved_at = datetime.now(UTC)
    if body.notes:
        shipment.notes = (shipment.notes or "") + f"\n[APPROVED] {body.notes}"
    db.commit()
    return _load_shipment(db, shipment_id)


@router.post("/shipments/{shipment_id}/pick", response_model=ShipmentOut)
def pick_shipment(shipment_id: UUID, body: ShipmentAction, db: Session = Depends(get_db)):
    """Mark shipment as picked — issues inventory from source node."""
    shipment = _load_shipment(db, shipment_id)
    _assert_transition(shipment, "PICKED")

    # Issue inventory from source lots
    for item in shipment.items:
        lot = db.get(InventoryLot, item.lot_id)
        if not lot:
            raise HTTPException(status_code=400, detail=f"Lot {item.lot_id} no longer exists")
        if lot.qty_on_hand < item.qty:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient qty for lot {lot.lot_number}: need {item.qty}, have {lot.qty_on_hand}",
            )
        lot.qty_on_hand -= item.qty
        lot.updated_at = datetime.now(UTC)

        txn = InventoryTransaction(
            lot_id=item.lot_id,
            txn_type="TRANSFER_OUT",
            qty=-item.qty,
            from_node_id=shipment.from_node_id,
            to_node_id=shipment.to_node_id,
            reference_type="SHIPMENT",
            reference_id=str(shipment.id),
            created_by=body.performed_by,
        )
        db.add(txn)

    shipment.status = "PICKED"
    db.commit()
    return _load_shipment(db, shipment_id)


@router.post("/shipments/{shipment_id}/ship", response_model=ShipmentOut)
def ship_shipment(shipment_id: UUID, body: ShipmentAction, db: Session = Depends(get_db)):
    shipment = _load_shipment(db, shipment_id)
    _assert_transition(shipment, "SHIPPED")
    shipment.status = "SHIPPED"
    shipment.shipped_at = datetime.now(UTC)
    if body.tracking_number:
        shipment.tracking_number = body.tracking_number
    db.commit()
    return _load_shipment(db, shipment_id)


@router.post("/shipments/{shipment_id}/receive", response_model=ShipmentOut)
def receive_shipment(shipment_id: UUID, body: ShipmentAction, db: Session = Depends(get_db)):
    """Mark shipment as received — creates inventory at destination node."""
    shipment = _load_shipment(db, shipment_id)
    # Allow receive from SHIPPED or IN_TRANSIT
    if shipment.status not in ("SHIPPED", "IN_TRANSIT"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot receive from status '{shipment.status}'. Must be SHIPPED or IN_TRANSIT.",
        )

    # Create or update lots at destination node
    for item in shipment.items:
        source_lot = db.get(InventoryLot, item.lot_id)
        if not source_lot:
            continue

        # Check if lot already exists at destination
        dest_lot = db.execute(
            select(InventoryLot).where(
                InventoryLot.node_id == shipment.to_node_id,
                InventoryLot.product_id == item.product_id,
                InventoryLot.lot_number == source_lot.lot_number,
            )
        ).scalar_one_or_none()

        if dest_lot:
            dest_lot.qty_on_hand += item.qty
            dest_lot.updated_at = datetime.now(UTC)
            dest_lot_id = dest_lot.id
        else:
            dest_lot = InventoryLot(
                node_id=shipment.to_node_id,
                product_id=item.product_id,
                presentation_id=item.presentation_id,
                lot_number=source_lot.lot_number,
                expiry_date=source_lot.expiry_date,
                status="RELEASED",
                qty_on_hand=item.qty,
            )
            db.add(dest_lot)
            db.flush()
            dest_lot_id = dest_lot.id

        txn = InventoryTransaction(
            lot_id=dest_lot_id,
            txn_type="TRANSFER_IN",
            qty=item.qty,
            from_node_id=shipment.from_node_id,
            to_node_id=shipment.to_node_id,
            reference_type="SHIPMENT",
            reference_id=str(shipment.id),
            created_by=body.performed_by,
        )
        db.add(txn)

    shipment.status = "RECEIVED"
    shipment.received_at = datetime.now(UTC)
    db.commit()
    return _load_shipment(db, shipment_id)


@router.post("/shipments/{shipment_id}/cancel", response_model=ShipmentOut)
def cancel_shipment(shipment_id: UUID, body: ShipmentAction, db: Session = Depends(get_db)):
    shipment = _load_shipment(db, shipment_id)
    if shipment.status in ("RECEIVED", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel from status '{shipment.status}'")
    shipment.status = "CANCELLED"
    if body.notes:
        shipment.notes = (shipment.notes or "") + f"\n[CANCELLED] {body.notes}"
    db.commit()
    return _load_shipment(db, shipment_id)


def _assert_transition(shipment: Shipment, target: str) -> None:
    allowed = VALID_TRANSITIONS.get(shipment.status, [])
    if target not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from '{shipment.status}' to '{target}'. Allowed: {allowed}",
        )
