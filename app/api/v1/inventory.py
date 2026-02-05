from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.inventory import InventoryLot, InventoryNode, InventoryTransaction
from app.schemas.inventory import (
    InventoryPosition,
    LotCreate,
    LotOut,
    LotUpdate,
    NodeCreate,
    NodeOut,
    NodeUpdate,
    TransactionCreate,
    TransactionOut,
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
        attributes=body.attributes,
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@router.get("/inventory/nodes", response_model=list[NodeOut])
def list_nodes(
    node_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = select(InventoryNode)
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
    node_id: str | None = Query(None),
    product_id: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = select(InventoryLot)
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
    lot_id: UUID | None = Query(None),
    txn_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = select(InventoryTransaction)
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
