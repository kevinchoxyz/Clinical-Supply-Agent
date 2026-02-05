from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SupplyPlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenario_version_id: UUID
    inventory_snapshot: Optional[List[Dict[str, Any]]] = None


class PlannedShipment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sku: str
    order_bucket_index: int
    order_date: Optional[str] = None
    delivery_bucket_index: int
    delivery_date: Optional[str] = None
    qty: int
    reason: str


class StockoutAlert(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sku: str
    stockout_bucket_index: int
    stockout_date: Optional[str] = None
    deficit: float


class SafetyStockInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")
    depot_safety_stock: float
    site_safety_stock: float
    reorder_point: float


class SupplyPlanOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    bucket_dates: List[str]
    projected_inventory: Dict[str, List[float]]
    starting_inventory: Dict[str, float]
    reorder_points: Dict[str, float]
    safety_stock: Dict[str, SafetyStockInfo]
    planned_shipments: List[PlannedShipment]
    stockout_alerts: List[StockoutAlert]
    parameters: Dict[str, Any]
