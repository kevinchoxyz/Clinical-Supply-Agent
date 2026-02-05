"""Supply planning engine (Bucket 8).

Takes demand forecast + current inventory + lead times + buffers and generates:
  - Projected inventory over time (per node)
  - Reorder points / suggested resupply shipments
  - Stockout date prediction + alerts
  - Safety stock logic (depot/site)
"""
from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any, Dict, List, Optional


def _parse_date(v: Any) -> date | None:
    if v is None:
        return None
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        try:
            return date.fromisoformat(v[:10])
        except Exception:
            return None
    return None


def generate_supply_plan(
    forecast_output: dict,
    inventory: List[dict],
    payload: dict,
) -> dict:
    """Generate a supply plan from forecast demand + current inventory.

    Args:
        forecast_output: output from run_forecast() — must contain
            bucket_dates, demand
        inventory: list of current inventory positions, each:
            {"node_id": str, "product_id": str, "presentation_id": str,
             "qty": float, "expiry_date": str|None}
        payload: the original scenario payload (for reading assumptions)

    Returns dict with:
        projected_inventory, reorder_points, planned_shipments,
        stockout_alerts, safety_stock
    """
    assumptions = payload.get("assumptions", {})
    buffers = assumptions.get("buffers", {})
    bucket_dates_str = forecast_output.get("bucket_dates", [])
    demand = forecast_output.get("demand", {})
    horizon = len(bucket_dates_str)

    bucket_dates = [_parse_date(d) or date.today() for d in bucket_dates_str]
    bucket_step = 7 if horizon < 2 else (bucket_dates[1] - bucket_dates[0]).days

    # Safety stock parameters
    depot_ss_days = int(buffers.get("depot_safety_stock_days", 30) or 30)
    site_ss_days = int(buffers.get("site_safety_stock_days", 14) or 14)
    overage = float(assumptions.get("global_overage_factor", 1.0) or 1.0)

    # Network info for lead times
    lanes = payload.get("network_lanes", [])
    lane_map: Dict[str, int] = {}  # "from:to" -> lead_time_days
    for lane in lanes:
        key = f"{lane.get('from_node_id', '')}:{lane.get('to_node_id', '')}"
        lane_map[key] = int(lane.get("default_lead_time_days", 3) or 3)

    # Build per-product aggregated demand per bucket
    product_demand: Dict[str, List[float]] = {}
    for sku_key, bucket_vals in demand.items():
        # sku_key is "product_id:presentation_id"
        product_demand[sku_key] = [v * overage for v in bucket_vals]

    # Starting inventory by SKU (aggregated across all nodes)
    starting_inv: Dict[str, float] = {}
    node_inv: Dict[str, Dict[str, float]] = {}  # node_id -> {sku: qty}
    expiry_info: Dict[str, str | None] = {}

    for inv in inventory:
        pid = inv.get("product_id", "")
        pres = inv.get("presentation_id", "")
        sku = f"{pid}:{pres}" if pres else pid
        qty = float(inv.get("qty", 0) or 0)
        node = inv.get("node_id", "DEPOT")
        exp = inv.get("expiry_date")

        starting_inv[sku] = starting_inv.get(sku, 0.0) + qty
        node_inv.setdefault(node, {})
        node_inv[node][sku] = node_inv[node].get(sku, 0.0) + qty
        if exp:
            expiry_info[sku] = str(exp)

    # ---------------------------------------------------------------
    # Projected inventory, stockout detection, reorder logic
    # ---------------------------------------------------------------
    projected_inventory: Dict[str, List[float]] = {}
    stockout_alerts: List[dict] = []
    planned_shipments: List[dict] = []
    reorder_points: Dict[str, float] = {}

    for sku, demand_per_bucket in product_demand.items():
        on_hand = starting_inv.get(sku, 0.0)
        projected = []

        # Calculate average demand per bucket for safety stock
        avg_demand = sum(demand_per_bucket) / max(len(demand_per_bucket), 1)
        ss_buckets = depot_ss_days / max(bucket_step, 1)
        safety_stock = avg_demand * ss_buckets
        reorder_point = safety_stock + avg_demand * 2  # SS + 2 buckets lead time
        reorder_points[sku] = round(reorder_point, 1)

        stockout_detected = False

        for i, d in enumerate(demand_per_bucket):
            on_hand -= d

            # Check if reorder is needed
            if on_hand <= reorder_point and not stockout_detected:
                # Generate a planned shipment
                order_qty = max(
                    safety_stock * 2,
                    avg_demand * max(horizon - i, 4),
                )
                order_qty = math.ceil(order_qty)

                lead_time_buckets = max(1, 3 * 7 // bucket_step)  # default 3-week lead
                delivery_bucket = min(i + lead_time_buckets, horizon - 1)

                planned_shipments.append({
                    "sku": sku,
                    "order_bucket_index": i,
                    "order_date": bucket_dates_str[i] if i < len(bucket_dates_str) else None,
                    "delivery_bucket_index": delivery_bucket,
                    "delivery_date": bucket_dates_str[delivery_bucket] if delivery_bucket < len(bucket_dates_str) else None,
                    "qty": order_qty,
                    "reason": "REORDER_POINT" if on_hand > 0 else "STOCKOUT_PREVENTION",
                })

                # Simulate delivery
                # We don't add it to on_hand yet; it arrives at delivery_bucket
                # For projection, we add it at delivery time
                if delivery_bucket < horizon:
                    on_hand_at_delivery = on_hand
                    for j in range(i, delivery_bucket):
                        if j < len(demand_per_bucket):
                            on_hand_at_delivery -= demand_per_bucket[j]

            if on_hand < 0 and not stockout_detected:
                stockout_detected = True
                stockout_alerts.append({
                    "sku": sku,
                    "stockout_bucket_index": i,
                    "stockout_date": bucket_dates_str[i] if i < len(bucket_dates_str) else None,
                    "deficit": round(abs(on_hand), 1),
                })

            projected.append(round(on_hand, 2))

        projected_inventory[sku] = projected

    # Safety stock summary
    safety_stock_summary: Dict[str, dict] = {}
    for sku in product_demand:
        avg_d = sum(product_demand[sku]) / max(len(product_demand[sku]), 1)
        safety_stock_summary[sku] = {
            "depot_safety_stock": round(avg_d * depot_ss_days / max(bucket_step, 1), 1),
            "site_safety_stock": round(avg_d * site_ss_days / max(bucket_step, 1), 1),
            "reorder_point": reorder_points.get(sku, 0),
        }

    return {
        "bucket_dates": bucket_dates_str,
        "projected_inventory": projected_inventory,
        "starting_inventory": {k: round(v, 1) for k, v in starting_inv.items()},
        "reorder_points": reorder_points,
        "safety_stock": safety_stock_summary,
        "planned_shipments": planned_shipments,
        "stockout_alerts": stockout_alerts,
        "parameters": {
            "depot_safety_stock_days": depot_ss_days,
            "site_safety_stock_days": site_ss_days,
            "global_overage_factor": overage,
            "bucket_step_days": bucket_step,
        },
    }
