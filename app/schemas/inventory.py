from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# --- Nodes ---

class NodeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    node_id: str
    node_type: str = "SITE"
    name: Optional[str] = None
    country: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None


class NodeOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    node_id: str
    node_type: str
    name: Optional[str]
    country: Optional[str]
    is_active: bool
    attributes: Optional[Dict[str, Any]]
    created_at: datetime


class NodeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = None
    country: Optional[str] = None
    is_active: Optional[bool] = None
    attributes: Optional[Dict[str, Any]] = None


# --- Lots ---

class LotCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    node_id: str = Field(..., description="Logical node_id (not UUID)")
    product_id: str
    presentation_id: Optional[str] = None
    lot_number: str
    expiry_date: Optional[datetime] = None
    status: str = "RELEASED"
    qty_on_hand: float = 0.0


class LotOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    node_id: UUID
    product_id: str
    presentation_id: Optional[str]
    lot_number: str
    expiry_date: Optional[datetime]
    status: str
    qty_on_hand: float
    created_at: datetime
    updated_at: datetime


class LotUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Optional[str] = None
    qty_on_hand: Optional[float] = None
    expiry_date: Optional[datetime] = None


# --- Transactions ---

class TransactionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lot_id: UUID
    txn_type: str = Field(..., description="RECEIPT | ISSUE | TRANSFER_OUT | TRANSFER_IN | RETURN | ADJUSTMENT")
    qty: float
    from_node_id: Optional[UUID] = None
    to_node_id: Optional[UUID] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None


class TransactionOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    lot_id: UUID
    txn_type: str
    qty: float
    from_node_id: Optional[UUID]
    to_node_id: Optional[UUID]
    reference_type: Optional[str]
    reference_id: Optional[str]
    notes: Optional[str]
    created_by: Optional[str]
    created_at: datetime


# --- Inventory position (aggregated view) ---

class InventoryPosition(BaseModel):
    model_config = ConfigDict(extra="forbid")
    node_id: str
    node_name: Optional[str]
    product_id: str
    presentation_id: Optional[str]
    total_qty: float
    lot_count: int
    earliest_expiry: Optional[datetime]
