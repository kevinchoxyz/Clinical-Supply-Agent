"""Reporting endpoints (Bucket 13).

CSV exports for:
  - Inventory by node/lot
  - Forecast demand
  - Expiry risk
  - Lot utilization
  - Forecast vs actual (when actuals are tracked)
"""
from __future__ import annotations

import csv
import io
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.inventory import InventoryLot, InventoryNode, InventoryTransaction
from app.models.scenario import ForecastRun
from app.models.subject import KitAssignment, Subject, SubjectVisit

router = APIRouter()


def _csv_response(rows: list[list], headers: list[str], filename: str) -> StreamingResponse:
    """Create a streaming CSV response."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---------------------------------------------------------------------------
# Inventory export
# ---------------------------------------------------------------------------


@router.get("/reports/inventory/csv")
def export_inventory_csv(
    node_id: str | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Export current inventory as CSV."""
    q = (
        select(
            InventoryNode.node_id,
            InventoryNode.name,
            InventoryNode.node_type,
            InventoryLot.product_id,
            InventoryLot.presentation_id,
            InventoryLot.lot_number,
            InventoryLot.expiry_date,
            InventoryLot.status,
            InventoryLot.qty_on_hand,
            InventoryLot.updated_at,
        )
        .join(InventoryLot, InventoryNode.id == InventoryLot.node_id)
    )
    if node_id:
        q = q.where(InventoryNode.node_id == node_id)
    if status:
        q = q.where(InventoryLot.status == status.upper())
    q = q.order_by(InventoryNode.node_id, InventoryLot.product_id, InventoryLot.expiry_date)

    rows = db.execute(q).all()

    headers = [
        "node_id", "node_name", "node_type", "product_id", "presentation_id",
        "lot_number", "expiry_date", "status", "qty_on_hand", "last_updated",
    ]
    data = [
        [
            r.node_id, r.name, r.node_type, r.product_id, r.presentation_id,
            r.lot_number,
            r.expiry_date.isoformat() if r.expiry_date else "",
            r.status, r.qty_on_hand,
            r.updated_at.isoformat() if r.updated_at else "",
        ]
        for r in rows
    ]

    ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    return _csv_response(data, headers, f"inventory_{ts}.csv")


# ---------------------------------------------------------------------------
# Forecast export
# ---------------------------------------------------------------------------


@router.get("/reports/forecast/{forecast_run_id}/csv")
def export_forecast_csv(forecast_run_id: UUID, db: Session = Depends(get_db)):
    """Export forecast demand as CSV (one row per SKU per bucket)."""
    fr = db.get(ForecastRun, forecast_run_id)
    if not fr:
        raise HTTPException(status_code=404, detail="ForecastRun not found")
    if not fr.outputs:
        raise HTTPException(status_code=400, detail="Forecast has no outputs")

    outputs = fr.outputs
    bucket_dates = outputs.get("bucket_dates", [])
    demand = outputs.get("demand", {})
    enrolled = outputs.get("enrolled_per_bucket", [])
    cumulative = outputs.get("cumulative_enrolled", [])

    headers = ["bucket_index", "bucket_date", "enrolled", "cumulative_enrolled"]
    sku_keys = sorted(demand.keys())
    headers.extend([f"demand_{k}" for k in sku_keys])

    rows = []
    for i, d in enumerate(bucket_dates):
        row = [
            i, d,
            enrolled[i] if i < len(enrolled) else 0,
            cumulative[i] if i < len(cumulative) else 0,
        ]
        for k in sku_keys:
            vals = demand.get(k, [])
            row.append(vals[i] if i < len(vals) else 0)
        rows.append(row)

    ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    return _csv_response(rows, headers, f"forecast_{forecast_run_id}_{ts}.csv")


# ---------------------------------------------------------------------------
# Expiry risk report
# ---------------------------------------------------------------------------


@router.get("/reports/expiry-risk/csv")
def export_expiry_risk_csv(
    days_threshold: int = Query(90, description="Flag lots expiring within this many days"),
    db: Session = Depends(get_db),
):
    """Export lots at risk of expiry."""
    cutoff = datetime.now(UTC)
    from datetime import timedelta
    threshold_date = cutoff + timedelta(days=days_threshold)

    q = (
        select(
            InventoryNode.node_id,
            InventoryNode.name,
            InventoryLot.product_id,
            InventoryLot.presentation_id,
            InventoryLot.lot_number,
            InventoryLot.expiry_date,
            InventoryLot.status,
            InventoryLot.qty_on_hand,
        )
        .join(InventoryLot, InventoryNode.id == InventoryLot.node_id)
        .where(
            InventoryLot.status == "RELEASED",
            InventoryLot.qty_on_hand > 0,
            InventoryLot.expiry_date.isnot(None),
            InventoryLot.expiry_date <= threshold_date,
        )
        .order_by(InventoryLot.expiry_date.asc())
    )

    rows = db.execute(q).all()

    headers = [
        "node_id", "node_name", "product_id", "presentation_id",
        "lot_number", "expiry_date", "days_until_expiry", "status", "qty_on_hand",
    ]
    data = []
    for r in rows:
        days_left = (r.expiry_date - cutoff).days if r.expiry_date else None
        data.append([
            r.node_id, r.name, r.product_id, r.presentation_id,
            r.lot_number,
            r.expiry_date.isoformat() if r.expiry_date else "",
            days_left,
            r.status, r.qty_on_hand,
        ])

    ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    return _csv_response(data, headers, f"expiry_risk_{ts}.csv")


# ---------------------------------------------------------------------------
# Lot utilization report
# ---------------------------------------------------------------------------


@router.get("/reports/lot-utilization/csv")
def export_lot_utilization_csv(db: Session = Depends(get_db)):
    """Export lot utilization: total received, total issued, current on-hand."""
    # Aggregate transactions by lot
    q = (
        select(
            InventoryNode.node_id,
            InventoryLot.product_id,
            InventoryLot.lot_number,
            InventoryLot.qty_on_hand,
            InventoryLot.status,
            func.sum(
                case(
                    (InventoryTransaction.txn_type.in_(["RECEIPT", "TRANSFER_IN", "RETURN"]),
                     InventoryTransaction.qty),
                    else_=0,
                )
            ).label("total_received"),
            func.sum(
                case(
                    (InventoryTransaction.txn_type.in_(["ISSUE", "TRANSFER_OUT"]),
                     func.abs(InventoryTransaction.qty)),
                    else_=0,
                )
            ).label("total_issued"),
            func.count(InventoryTransaction.id).label("txn_count"),
        )
        .join(InventoryLot, InventoryNode.id == InventoryLot.node_id)
        .outerjoin(InventoryTransaction, InventoryLot.id == InventoryTransaction.lot_id)
        .group_by(
            InventoryNode.node_id,
            InventoryLot.product_id,
            InventoryLot.lot_number,
            InventoryLot.qty_on_hand,
            InventoryLot.status,
        )
        .order_by(InventoryNode.node_id, InventoryLot.product_id)
    )

    rows = db.execute(q).all()

    headers = [
        "node_id", "product_id", "lot_number", "status",
        "qty_on_hand", "total_received", "total_issued", "txn_count",
    ]
    data = [
        [
            r.node_id, r.product_id, r.lot_number, r.status,
            r.qty_on_hand, float(r.total_received or 0), float(r.total_issued or 0), r.txn_count,
        ]
        for r in rows
    ]

    ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    return _csv_response(data, headers, f"lot_utilization_{ts}.csv")


# ---------------------------------------------------------------------------
# Forecast vs Actual
# ---------------------------------------------------------------------------


@router.get("/reports/forecast-vs-actual/csv")
def export_forecast_vs_actual_csv(
    forecast_run_id: UUID,
    db: Session = Depends(get_db),
):
    """Compare forecasted demand vs actual dispensed quantities.

    Actuals are derived from KitAssignment records.
    """
    fr = db.get(ForecastRun, forecast_run_id)
    if not fr or not fr.outputs:
        raise HTTPException(status_code=404, detail="ForecastRun not found or has no outputs")

    outputs = fr.outputs
    bucket_dates = outputs.get("bucket_dates", [])
    demand = outputs.get("demand", {})

    # Get actual dispenses grouped by product
    actuals_q = (
        select(
            KitAssignment.product_id,
            KitAssignment.presentation_id,
            func.sum(KitAssignment.qty_dispensed).label("total_dispensed"),
        )
        .group_by(KitAssignment.product_id, KitAssignment.presentation_id)
    )
    actuals = db.execute(actuals_q).all()

    actual_map = {}
    for r in actuals:
        key = f"{r.product_id}:{r.presentation_id}" if r.presentation_id else r.product_id
        actual_map[key] = float(r.total_dispensed or 0)

    headers = ["sku", "total_forecasted", "total_actual", "variance", "variance_pct"]
    data = []
    for sku, vals in demand.items():
        forecasted = sum(vals)
        actual = actual_map.get(sku, 0)
        variance = actual - forecasted
        variance_pct = (variance / forecasted * 100) if forecasted > 0 else 0
        data.append([sku, round(forecasted, 2), round(actual, 2), round(variance, 2), round(variance_pct, 1)])

    ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    return _csv_response(data, headers, f"forecast_vs_actual_{ts}.csv")
