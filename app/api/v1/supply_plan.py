from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.inventory import InventoryLot, InventoryNode
from app.models.scenario import ForecastRun, ScenarioVersion
from app.schemas.supply_plan import SupplyPlanOut, SupplyPlanRequest
from app.services.forecast_engine import run_forecast
from app.services.supply_planner import generate_supply_plan

router = APIRouter()


@router.post("/supply-plan/generate", response_model=SupplyPlanOut)
def generate_plan(body: SupplyPlanRequest, db: Session = Depends(get_db)):
    """Generate a supply plan for a scenario version.

    Uses current inventory from DB (or override via inventory_snapshot).
    """
    sv = db.get(ScenarioVersion, body.scenario_version_id)
    if not sv:
        raise HTTPException(status_code=404, detail="ScenarioVersion not found")

    # Run forecast
    forecast_output = run_forecast(sv.payload)

    # Get inventory: use snapshot if provided, else query DB
    if body.inventory_snapshot is not None:
        inventory = body.inventory_snapshot
    else:
        inventory = _load_inventory_from_db(db)

    # Also try to load from the scenario's starting_inventory
    if not inventory:
        starting_inv = sv.payload.get("starting_inventory", {})
        if starting_inv and isinstance(starting_inv, dict):
            items = starting_inv.get("items", [])
            if items:
                inventory = items

    plan = generate_supply_plan(forecast_output, inventory, sv.payload)
    return plan


def _load_inventory_from_db(db: Session) -> list[dict]:
    """Load current inventory positions from the database."""
    rows = db.execute(
        select(
            InventoryNode.node_id,
            InventoryLot.product_id,
            InventoryLot.presentation_id,
            InventoryLot.lot_number,
            InventoryLot.expiry_date,
            InventoryLot.qty_on_hand,
        )
        .join(InventoryLot, InventoryNode.id == InventoryLot.node_id)
        .where(InventoryLot.status == "RELEASED", InventoryLot.qty_on_hand > 0)
    ).all()

    return [
        {
            "node_id": r.node_id,
            "product_id": r.product_id,
            "presentation_id": r.presentation_id,
            "lot_number": r.lot_number,
            "expiry_date": r.expiry_date.isoformat() if r.expiry_date else None,
            "qty": r.qty_on_hand,
        }
        for r in rows
    ]
