"""Demand aggregator — orchestrates the full demand pipeline.

Flow:
  cohort enrollment → expanded visit schedule → dose calc → dispense rules
  → aggregated demand per bucket per product_id:presentation_id

Also detects whether the payload is "rich" (has products, regimens,
dispense_rules) or "simple" (legacy flat enrollment).
"""
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Tuple

from app.services.enrollment import cohort_enrollment
from app.services.visit_schedule import expand_visits, visits_per_cohort_per_bucket
from app.services.dose_calc import calculate_dose_for_visit
from app.services.dispense import evaluate_dispense


def has_rich_scenario(payload: dict) -> bool:
    """Detect whether this payload uses the new rich schema.

    Rich = has products AND (regimens OR dispense_rules).
    """
    products = payload.get("products", [])
    regimens = payload.get("regimens", [])
    dispense_rules = payload.get("dispense_rules", [])

    return bool(products) and (bool(regimens) or bool(dispense_rules))


def run_demand_model(payload: dict) -> dict:
    """Run the full demand pipeline on a rich payload.

    Returns a dict suitable for merging into the forecast output:
    {
        "bucket_dates": [...],
        "enrolled_per_bucket": [...],
        "cumulative_enrolled": [...],
        "enrollment_by_cohort": {cohort_id: [...]},
        "demand": {"product_id:presentation_id": [...]},
        "visit_schedule_expanded": [...],
        "visits_by_cohort": {...},
    }
    """
    # Step 1: Cohort-aware enrollment
    bucket_dates, per_cohort_enrolled, total_enrolled = cohort_enrollment(payload)
    horizon = len(bucket_dates)

    # Cumulative
    cum = []
    running = 0.0
    for x in total_enrolled:
        running += x
        cum.append(running)

    # Step 2: Expand visit schedule
    expanded_visits = expand_visits(payload)

    # Step 3: Map visits to buckets per cohort
    cohort_visits = visits_per_cohort_per_bucket(
        payload, bucket_dates, per_cohort_enrolled
    )

    # Step 4: Build regimen lookup and dispense rule lookup
    study_design = payload.get("study_design", {})
    cohort_to_regimen = study_design.get("cohort_to_regimen", {})
    arm_to_regimen = study_design.get("arm_to_regimen", {})

    regimen_map: Dict[str, dict] = {}
    for r in payload.get("regimens", []):
        regimen_map[r.get("regimen_id", "")] = r

    dispense_rule_map: Dict[str, dict] = {}
    for dr in payload.get("dispense_rules", []):
        dispense_rule_map[dr.get("dispense_rule_id", "")] = dr

    # Step 5: For each cohort × visit × bucket, calculate dose → dispense → demand
    demand: Dict[str, List[float]] = {}

    for cohort_id, visit_counts in cohort_visits.items():
        # Determine regimen for this cohort
        regimen_id = cohort_to_regimen.get(cohort_id) or arm_to_regimen.get(cohort_id)
        regimen = regimen_map.get(regimen_id, {}) if regimen_id else {}

        visit_dispense_map = regimen.get("visit_dispense", {})

        for visit_id, counts in visit_counts.items():
            # source_visit_id for expanded visits (MAINT_QW_w8 -> MAINT_QW)
            source_vid = visit_id
            if "_w" in visit_id:
                source_vid = visit_id.rsplit("_w", 1)[0]

            # Get the dispense rule id for this visit
            disp_rule_id = visit_dispense_map.get(source_vid)
            if not disp_rule_id:
                continue

            disp_rule = dispense_rule_map.get(disp_rule_id)
            if not disp_rule:
                continue

            # Calculate dose for this visit
            dose_mcg = calculate_dose_for_visit(regimen, visit_id)
            if dose_mcg is None:
                dose_mcg = 0.0

            # Evaluate dispense rule to get product quantities
            product_qtys = evaluate_dispense(disp_rule, dose_mcg)

            # Aggregate into demand
            for product_key, qty_per_event in product_qtys.items():
                if product_key not in demand:
                    demand[product_key] = [0.0] * horizon
                for bucket_idx in range(horizon):
                    demand[product_key][bucket_idx] += counts[bucket_idx] * qty_per_event

    return {
        "bucket_dates": [d.isoformat() for d in bucket_dates],
        "enrolled_per_bucket": total_enrolled,
        "cumulative_enrolled": cum,
        "enrollment_by_cohort": {
            cid: enrolled for cid, enrolled in per_cohort_enrolled.items()
        },
        "demand": demand,
        "visit_schedule_expanded": expanded_visits,
        "visits_by_cohort": {
            cid: {vid: counts for vid, counts in vmap.items()}
            for cid, vmap in cohort_visits.items()
        },
    }
