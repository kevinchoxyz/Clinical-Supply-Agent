from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.inventory import InventoryLot, InventoryNode, InventoryTransaction, InventoryVial
from app.schemas.inventory import (
    InventoryPosition,
    LotCreate,
    LotOut,
    LotUpdate,
    LotWithVialsOut,
    NodeCreate,
    NodeOut,
    NodeUpdate,
    TransactionCreate,
    TransactionOut,
    VialCreate,
    VialOut,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------


@router.post("/inventory/nodes", response_model=NodeOut)
def create_node(body: NodeCreate, db: Session = Depends(get_db)):
    existing = db.execute(
        select(InventoryNode).where(InventoryNode.node_id == body.node_id)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Node '{body.node_id}' already exists")

    node = InventoryNode(
        node_id=body.node_id,
        node_type=body.node_type,
        name=body.name,
        country=body.country,
        study_id=body.study_id,
        attributes=body.attributes,
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@router.get("/inventory/nodes", response_model=list[NodeOut])
def list_nodes(
    study_id: UUID | None = Query(None),
    node_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = select(InventoryNode)
    if study_id:
        q = q.where(InventoryNode.study_id == study_id)
    if node_type:
        q = q.where(InventoryNode.node_type == node_type.upper())
    q = q.order_by(InventoryNode.node_id).offset(skip).limit(limit)
    return db.execute(q).scalars().all()


@router.get("/inventory/nodes/{node_id}", response_model=NodeOut)
def get_node(node_id: str, db: Session = Depends(get_db)):
    node = db.execute(
        select(InventoryNode).where(InventoryNode.node_id == node_id)
    ).scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.patch("/inventory/nodes/{node_id}", response_model=NodeOut)
def update_node(node_id: str, body: NodeUpdate, db: Session = Depends(get_db)):
    node = db.execute(
        select(InventoryNode).where(InventoryNode.node_id == node_id)
    ).scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(node, field, value)
    db.commit()
    db.refresh(node)
    return node


@router.delete("/inventory/nodes/{node_id}", status_code=204)
def delete_node(node_id: str, db: Session = Depends(get_db)):
    node = db.execute(
        select(InventoryNode).where(InventoryNode.node_id == node_id)
    ).scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    db.delete(node)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Lots
# ---------------------------------------------------------------------------


def _resolve_node(db: Session, node_id_str: str) -> InventoryNode:
    node = db.execute(
        select(InventoryNode).where(InventoryNode.node_id == node_id_str)
    ).scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail=f"Node '{node_id_str}' not found")
    return node


@router.post("/inventory/lots", response_model=LotOut)
def create_lot(body: LotCreate, db: Session = Depends(get_db)):
    node = _resolve_node(db, body.node_id)

    lot = InventoryLot(
        node_id=node.id,
        product_id=body.product_id,
        presentation_id=body.presentation_id,
        lot_number=body.lot_number,
        expiry_date=body.expiry_date,
        status=body.status.upper(),
        qty_on_hand=body.qty_on_hand,
    )
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return lot


@router.get("/inventory/lots", response_model=list[LotOut])
def list_lots(
    study_id: UUID | None = Query(None),
    node_id: str | None = Query(None),
    product_id: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = select(InventoryLot)
    if study_id:
        q = q.join(InventoryNode).where(InventoryNode.study_id == study_id)
    if node_id:
        node = _resolve_node(db, node_id)
        q = q.where(InventoryLot.node_id == node.id)
    if product_id:
        q = q.where(InventoryLot.product_id == product_id)
    if status:
        q = q.where(InventoryLot.status == status.upper())
    q = q.order_by(InventoryLot.expiry_date.asc().nullslast()).offset(skip).limit(limit)
    return db.execute(q).scalars().all()


@router.get("/inventory/lots/{lot_id}", response_model=LotOut)
def get_lot(lot_id: UUID, db: Session = Depends(get_db)):
    lot = db.get(InventoryLot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    return lot


@router.patch("/inventory/lots/{lot_id}", response_model=LotOut)
def update_lot(lot_id: UUID, body: LotUpdate, db: Session = Depends(get_db)):
    lot = db.get(InventoryLot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(lot, field, value)
    lot.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(lot)
    return lot


@router.delete("/inventory/lots/{lot_id}", status_code=204)
def delete_lot(lot_id: UUID, db: Session = Depends(get_db)):
    lot = db.get(InventoryLot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    db.delete(lot)
    db.commit()
    return None


@router.get("/inventory/lots/{lot_id}/detail", response_model=LotWithVialsOut)
def get_lot_detail(lot_id: UUID, db: Session = Depends(get_db)):
    lot = db.get(InventoryLot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    available = sum(1 for v in lot.vials if v.status == "AVAILABLE")
    return LotWithVialsOut(
        id=lot.id,
        node_id=lot.node_id,
        product_id=lot.product_id,
        presentation_id=lot.presentation_id,
        lot_number=lot.lot_number,
        expiry_date=lot.expiry_date,
        status=lot.status,
        qty_on_hand=lot.qty_on_hand,
        created_at=lot.created_at,
        updated_at=lot.updated_at,
        vials=[VialOut(
            id=v.id,
            lot_id=v.lot_id,
            medication_number=v.medication_number,
            status=v.status,
            dispensed_at=v.dispensed_at,
            dispensed_to_subject_id=v.dispensed_to_subject_id,
            created_at=v.created_at,
        ) for v in lot.vials],
        vial_count=len(lot.vials),
        available_count=available,
    )


@router.get("/inventory/lots/{lot_id}/vials", response_model=list[VialOut])
def list_vials(lot_id: UUID, db: Session = Depends(get_db)):
    lot = db.get(InventoryLot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    return lot.vials


@router.post("/inventory/lots/{lot_id}/vials", response_model=VialOut)
def add_vial(lot_id: UUID, body: VialCreate, db: Session = Depends(get_db)):
    lot = db.get(InventoryLot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    vial = InventoryVial(lot_id=lot_id, medication_number=body.medication_number, status=body.status)
    db.add(vial)
    db.commit()
    db.refresh(vial)
    return vial


@router.delete("/inventory/vials/{vial_id}", status_code=204)
def delete_vial(vial_id: UUID, db: Session = Depends(get_db)):
    vial = db.get(InventoryVial, vial_id)
    if not vial:
        raise HTTPException(status_code=404, detail="Vial not found")
    db.delete(vial)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

VALID_TXN_TYPES = {"RECEIPT", "ISSUE", "TRANSFER_OUT", "TRANSFER_IN", "RETURN", "ADJUSTMENT"}


@router.post("/inventory/transactions", response_model=TransactionOut)
def create_transaction(body: TransactionCreate, db: Session = Depends(get_db)):
    txn_type = body.txn_type.upper()
    if txn_type not in VALID_TXN_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid txn_type. Must be one of: {VALID_TXN_TYPES}")

    lot = db.get(InventoryLot, body.lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    # Apply qty change
    if txn_type in ("RECEIPT", "TRANSFER_IN", "RETURN"):
        lot.qty_on_hand += abs(body.qty)
    elif txn_type in ("ISSUE", "TRANSFER_OUT"):
        if lot.qty_on_hand < abs(body.qty):
            raise HTTPException(status_code=400, detail="Insufficient inventory for this transaction")
        lot.qty_on_hand -= abs(body.qty)
    else:
        # ADJUSTMENT — qty can be positive or negative
        lot.qty_on_hand += body.qty
        if lot.qty_on_hand < 0:
            lot.qty_on_hand = 0

    lot.updated_at = datetime.now(UTC)

    txn = InventoryTransaction(
        lot_id=body.lot_id,
        txn_type=txn_type,
        qty=body.qty,
        from_node_id=body.from_node_id,
        to_node_id=body.to_node_id,
        reference_type=body.reference_type,
        reference_id=body.reference_id,
        notes=body.notes,
        created_by=body.created_by,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@router.get("/inventory/transactions", response_model=list[TransactionOut])
def list_transactions(
    study_id: UUID | None = Query(None),
    lot_id: UUID | None = Query(None),
    txn_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = select(InventoryTransaction)
    if study_id:
        q = q.join(InventoryLot).join(InventoryNode).where(InventoryNode.study_id == study_id)
    if lot_id:
        q = q.where(InventoryTransaction.lot_id == lot_id)
    if txn_type:
        q = q.where(InventoryTransaction.txn_type == txn_type.upper())
    q = q.order_by(InventoryTransaction.created_at.desc()).offset(skip).limit(limit)
    return db.execute(q).scalars().all()


# ---------------------------------------------------------------------------
# Inventory positions (aggregated view)
# ---------------------------------------------------------------------------


@router.get("/inventory/positions", response_model=list[InventoryPosition])
def list_positions(
    study_id: UUID | None = Query(None),
    node_id: str | None = Query(None),
    product_id: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = (
        select(
            InventoryNode.node_id,
            InventoryNode.name.label("node_name"),
            InventoryLot.product_id,
            InventoryLot.presentation_id,
            func.sum(InventoryLot.qty_on_hand).label("total_qty"),
            func.count(InventoryLot.id).label("lot_count"),
            func.min(InventoryLot.expiry_date).label("earliest_expiry"),
        )
        .join(InventoryLot, InventoryNode.id == InventoryLot.node_id)
        .where(InventoryLot.status == "RELEASED")
        .group_by(
            InventoryNode.node_id,
            InventoryNode.name,
            InventoryLot.product_id,
            InventoryLot.presentation_id,
        )
    )
    if study_id:
        q = q.where(InventoryNode.study_id == study_id)
    if node_id:
        q = q.where(InventoryNode.node_id == node_id)
    if product_id:
        q = q.where(InventoryLot.product_id == product_id)

    rows = db.execute(q).all()
    return [
        InventoryPosition(
            node_id=r.node_id,
            node_name=r.node_name,
            product_id=r.product_id,
            presentation_id=r.presentation_id,
            total_qty=r.total_qty,
            lot_count=r.lot_count,
            earliest_expiry=r.earliest_expiry,
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Bulk upload endpoints
# ---------------------------------------------------------------------------


class BulkNodesUpload(BaseModel):
    nodes: list[NodeCreate]


class BulkLotsUpload(BaseModel):
    lots: list[LotCreate]


@router.post("/inventory/nodes/bulk", response_model=list[NodeOut])
def bulk_create_nodes(body: BulkNodesUpload, db: Session = Depends(get_db)):
    created = []
    for node_data in body.nodes:
        existing = db.execute(
            select(InventoryNode).where(InventoryNode.node_id == node_data.node_id)
        ).scalar_one_or_none()
        if existing:
            continue  # skip existing nodes
        node = InventoryNode(
            node_id=node_data.node_id,
            node_type=node_data.node_type,
            name=node_data.name,
            country=node_data.country,
            study_id=node_data.study_id,
            attributes=node_data.attributes,
        )
        db.add(node)
        created.append(node)
    db.commit()
    for node in created:
        db.refresh(node)
    return created


@router.post("/inventory/lots/bulk", response_model=list[LotOut])
def bulk_create_lots(body: BulkLotsUpload, db: Session = Depends(get_db)):
    created = []
    for lot_data in body.lots:
        node = _resolve_node(db, lot_data.node_id)
        lot = InventoryLot(
            node_id=node.id,
            product_id=lot_data.product_id,
            presentation_id=lot_data.presentation_id,
            lot_number=lot_data.lot_number,
            expiry_date=lot_data.expiry_date,
            status=lot_data.status.upper(),
            qty_on_hand=lot_data.qty_on_hand,
        )
        db.add(lot)
        db.flush()  # get lot.id
        # If vials provided, add them
        if lot_data.vials:
            for vial_data in lot_data.vials:
                vial = InventoryVial(
                    lot_id=lot.id,
                    medication_number=vial_data.medication_number,
                    status=vial_data.status,
                )
                db.add(vial)
        created.append(lot)
    db.commit()
    for lot in created:
        db.refresh(lot)
    return created
