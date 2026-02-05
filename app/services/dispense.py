"""Dispense rule evaluation.

Evaluates conditional dispense rules to determine product units needed
per dispense event.

Supports:
- Conditional rules: if dose_mcg < 200 -> add stabilizer vial
- Calc expressions: ceil(dose_mcg / 1000) via restricted allowlist
- Fixed qty fallback
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional


# Restricted namespace for calc expressions
_SAFE_NAMES: Dict[str, Any] = {
    "ceil": math.ceil,
    "floor": math.floor,
    "round": round,
    "min": min,
    "max": max,
    "abs": abs,
}


def _eval_calc(expr: str, variables: Dict[str, float]) -> float:
    """Evaluate a restricted arithmetic expression.

    Only allows math.ceil, math.floor, round, and basic arithmetic.
    """
    namespace = dict(_SAFE_NAMES)
    namespace.update(variables)
    try:
        result = eval(expr, {"__builtins__": {}}, namespace)  # noqa: S307
        return float(result)
    except Exception:
        return 1.0


def _eval_condition(condition: dict, variables: Dict[str, float]) -> bool:
    """Evaluate a simple condition like {"field": "dose_mcg", "op": "<", "value": 200}."""
    field = condition.get("field", "")
    op = condition.get("op", "")
    threshold = float(condition.get("value", 0))

    actual = variables.get(field, 0.0)

    if op == "<":
        return actual < threshold
    elif op == "<=":
        return actual <= threshold
    elif op == ">":
        return actual > threshold
    elif op == ">=":
        return actual >= threshold
    elif op == "==":
        return actual == threshold
    elif op == "!=":
        return actual != threshold
    return False


def evaluate_dispense(
    dispense_rule: dict,
    dose_mcg: float,
) -> Dict[str, float]:
    """Evaluate a dispense rule for a given dose.

    Returns: {"product_id:presentation_id": qty, ...}
    """
    rule_body = dispense_rule.get("rule", {})
    rule_type = rule_body.get("type", "simple")

    variables: Dict[str, float] = {"dose_mcg": dose_mcg}

    if rule_type == "conditional":
        return _eval_conditional(rule_body, variables)

    if rule_type == "vial_optimization":
        # Simple vial optimization
        product_id = rule_body.get("product_id", "UNKNOWN")
        presentations = rule_body.get("allowed_presentations", [])
        pres_id = presentations[0] if presentations else "DEFAULT"
        key = f"{product_id}:{pres_id}"
        return {key: max(1.0, math.ceil(dose_mcg / 1000.0))}

    # Fallback: 1 unit
    return {}


def _eval_conditions(cond: Any, variables: Dict[str, float]) -> bool:
    """Evaluate a single condition dict or a list of conditions (AND logic).

    Supports:
    - Single: {"field": "dose_mcg", "op": "<", "value": 200}
    - Range:  [{"field": "dose_mcg", "op": ">=", "value": 40},
               {"field": "dose_mcg", "op": "<", "value": 200}]
    """
    if isinstance(cond, list):
        return all(_eval_condition(c, variables) for c in cond)
    return _eval_condition(cond, variables)


def _eval_conditional(
    rule_body: dict,
    variables: Dict[str, float],
) -> Dict[str, float]:
    """Evaluate a conditional dispense rule."""
    conditions = rule_body.get("conditions", [])

    for branch in conditions:
        cond = branch.get("if") or branch.get("condition") or {}
        if cond and _eval_conditions(cond, variables):
            return _extract_dispense_items(branch.get("then", {}), variables)

    # No condition matched: use default
    default = rule_body.get("default", {})
    if default:
        return _extract_dispense_items(default, variables)

    return {}


def _extract_dispense_items(
    block: dict,
    variables: Dict[str, float],
) -> Dict[str, float]:
    """Extract product quantities from a dispense block.

    Block format: {"dispense": [{"product_id": ..., "presentation_id": ..., "qty": N or "calc": "expr"}, ...]}
    """
    items = block.get("dispense", [])
    result: Dict[str, float] = {}

    for item in items:
        product_id = item.get("product_id", "UNKNOWN")
        pres_id = item.get("presentation_id", "DEFAULT")
        key = f"{product_id}:{pres_id}"

        if "calc" in item and item["calc"]:
            qty = _eval_calc(item["calc"], variables)
        elif "qty" in item and item["qty"] is not None:
            qty = float(item["qty"])
        else:
            qty = 1.0

        qty = max(1.0, qty)
        result[key] = result.get(key, 0.0) + qty

    return result
