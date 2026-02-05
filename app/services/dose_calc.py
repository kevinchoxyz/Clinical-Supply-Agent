"""Dose calculation service.

Supports:
- Fixed dose: returns dose_value directly
- Table-based per-kg: ng/kg * weight_kg_mean, converted to output_uom (mcg)
"""
from __future__ import annotations

from typing import Any, Dict, Optional


def _ng_to_mcg(ng: float) -> float:
    return ng / 1000.0


def calculate_dose_for_visit(
    regimen: dict,
    visit_id: str,
) -> Optional[float]:
    """Calculate dose in output_uom (typically mcg) for a given visit.

    Returns None if no dose rule applies.
    """
    dose_rule = regimen.get("dose_rule")
    if not dose_rule:
        return None

    rule_type = dose_rule.get("type", "fixed")
    dose_inputs = regimen.get("dose_inputs", {})

    if rule_type == "fixed":
        return float(dose_rule.get("dose_value", 0) or 0)

    if rule_type == "table":
        rows = dose_rule.get("rows", [])
        # Find the matching row for this visit_id
        row = _find_row_for_visit(rows, visit_id)
        if not row:
            return None

        per_kg_value = row.get("per_kg_value")
        per_kg_uom = row.get("per_kg_uom", "ng_per_kg")

        if per_kg_value is not None:
            weight_mean = float(dose_inputs.get("weight_kg_mean", 80) or 80)
            total_ng_or_unit = float(per_kg_value) * weight_mean

            if per_kg_uom in ("ng_per_kg", "ng/kg"):
                return _ng_to_mcg(total_ng_or_unit)
            elif per_kg_uom in ("mcg_per_kg", "mcg/kg"):
                return total_ng_or_unit  # already mcg
            else:
                return _ng_to_mcg(total_ng_or_unit)

        # Fallback to fixed dose_value in the row
        dose_val = row.get("dose_value")
        if dose_val is not None:
            return float(dose_val)

        return None

    return None


def _find_row_for_visit(rows: list[dict], visit_id: str) -> Optional[dict]:
    """Find the dose table row for a visit.

    For expanded repeating visits like MAINT_QW_w8, falls back to the
    base visit_id MAINT_QW.
    """
    # Direct match
    for r in rows:
        if r.get("visit_id") == visit_id:
            return r

    # Try stripping the _wN suffix for expanded repeating visits
    if "_w" in visit_id:
        base_id = visit_id.rsplit("_w", 1)[0]
        for r in rows:
            if r.get("visit_id") == base_id:
                return r

    return None
