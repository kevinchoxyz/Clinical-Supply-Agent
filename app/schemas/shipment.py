from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ShipmentItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lot_id: UUID
    product_id: str
    presentation_id: Optional[str] = None
    qty: float


class ShipmentItemOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    shipment_id: UUID
    lot_id: UUID
    product_id: str
    presentation_id: Optional[str]
    qty: float


class ShipmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    from_node_id: str  # logical node_id
    to_node_id: str    # logical node_id
    items: List[ShipmentItemCreate]
    lane_id: Optional[str] = None
    temperature_req: Optional[str] = None
    courier: Optional[str] = None
    notes: Optional[str] = None
    requested_by: Optional[str] = None


class ShipmentOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    from_node_id: UUID
    to_node_id: UUID
    status: str
    lane_id: Optional[str]
    tracking_number: Optional[str]
    temperature_req: Optional[str]
    courier: Optional[str]
    notes: Optional[str]
    requested_by: Optional[str]
    requested_at: datetime
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    shipped_at: Optional[datetime]
    received_at: Optional[datetime]
    items: List[ShipmentItemOut]


class ShipmentAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    performed_by: Optional[str] = None
    tracking_number: Optional[str] = None
    notes: Optional[str] = None
