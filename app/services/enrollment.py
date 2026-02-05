"""Cohort-aware enrollment service.

For dose-escalation trials: cohorts fill sequentially (DL1 fills to max
before DL2 starts), with an optional stagger gap between cohorts for
safety review.

For simple payloads without cohorts: falls back to global enrollment rate.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Tuple


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


def _bucket_step_days(bucket: str) -> int:
    return 7 if bucket == "week" else 30


def _norm_bucket(value: Any) -> str:
    b = str(value).lower() if value is not None else "week"
    if b in ("weekly", "week", "w", "wk", "weeks"):
        return "week"
    if b in ("monthly", "month", "m", "mo", "months"):
        return "month"
    return "week"


def cohort_enrollment(
    payload: dict,
) -> Tuple[List[date], Dict[str, List[float]], List[float]]:
    """Return (bucket_dates, per_cohort_enrolled, total_enrolled).

    per_cohort_enrolled is a dict mapping cohort_id -> [float per bucket].
    total_enrolled is the sum across all cohorts per bucket.
    """
    assumptions = payload.get("assumptions", {})
    study_design = payload.get("study_design", {})

    # Parse bucket / horizon / dates
    raw_bucket = (
        assumptions.get("forecast_bucket")
        or payload.get("scenario", {}).get("forecast_bucket")
        or "week"
    )
    bucket = _norm_bucket(raw_bucket)
    step = _bucket_step_days(bucket)

    start = _parse_date(
        assumptions.get("start_date")
        or payload.get("scenario", {}).get("start_date")
    )
    end = _parse_date(assumptions.get("end_date"))

    if start is None:
        start = date.today()
    if end is None:
        horizon = int(
            payload.get("scenario", {}).get("horizon_buckets")
            or assumptions.get("horizon_buckets")
            or 26
        )
    else:
        horizon = max(1, (end - start).days // step + 1)

    bucket_dates = [start + timedelta(days=i * step) for i in range(horizon)]

    cohorts: list[dict] = study_design.get("cohorts", [])

    # Global enrollment rate from assumptions
    waves = assumptions.get("enrollment_waves", [])
    if waves:
        global_rate = float(waves[0].get("enrollment_rate_per_bucket", 0) or 0)
        screen_fail = float(waves[0].get("screen_fail_rate", 0) or 0)
    else:
        global_rate = float(assumptions.get("enrollment_rate_per_bucket", 0) or 0)
        screen_fail = 0.0

    effective_rate = global_rate * (1.0 - screen_fail)

    # Stagger days between cohorts (safety review gap)
    stagger_days = int(assumptions.get("cohort_stagger_days", 0) or 0)
    stagger_buckets = max(0, stagger_days // step)

    if not cohorts:
        # No cohorts — flat enrollment
        total = [effective_rate] * horizon
        return bucket_dates, {"ALL": total}, total

    per_cohort: Dict[str, List[float]] = {}
    total = [0.0] * horizon

    current_bucket = 0  # bucket index where next cohort can start enrolling

    for cohort in cohorts:
        cid = cohort.get("cohort_id", "UNKNOWN")
        max_p = cohort.get("max_participants")
        if max_p is None:
            max_p = float("inf")
        else:
            max_p = float(max_p)

        enrolled_so_far = 0.0
        cohort_enrolled = [0.0] * horizon

        for i in range(current_bucket, horizon):
            remaining = max_p - enrolled_so_far
            if remaining <= 0:
                break
            added = min(effective_rate, remaining)
            cohort_enrolled[i] = added
            enrolled_so_far += added
            total[i] += added

        per_cohort[cid] = cohort_enrolled

        # Find the bucket where this cohort finished filling
        finish_bucket = current_bucket
        for i in range(current_bucket, horizon):
            if enrolled_so_far >= max_p:
                finish_bucket = i
                break
        else:
            finish_bucket = horizon - 1

        current_bucket = finish_bucket + 1 + stagger_buckets
        if current_bucket >= horizon:
            break

    return bucket_dates, per_cohort, total
