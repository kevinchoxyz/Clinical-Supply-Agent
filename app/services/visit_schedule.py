"""Expand visit schedule, handling repeating visits (e.g. MAINT_QW every 7 days).

Given a study_design with visits and cohort enrollment per bucket, produces
visit events per cohort per bucket.
"""
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List


def _bucket_step_days(bucket: str) -> int:
    return 7 if bucket == "week" else 30


def _norm_bucket(value: Any) -> str:
    b = str(value).lower() if value is not None else "week"
    if b in ("weekly", "week", "w", "wk", "weeks"):
        return "week"
    if b in ("monthly", "month", "m", "mo", "months"):
        return "month"
    return "week"


def expand_visits(
    payload: dict,
) -> List[dict]:
    """Expand the visit schedule from study_design, including repeating visits.

    Returns a list of dicts:
      [{"visit_id": "C1D1", "day_offset": 0}, {"visit_id": "MAINT_QW_w5", "day_offset": 34}, ...]
    """
    study_design = payload.get("study_design", {})
    if not study_design:
        return [{"visit_id": "DOSE", "day_offset": 0}]

    raw_visits = study_design.get("visits", [])
    if not raw_visits:
        return [{"visit_id": "DOSE", "day_offset": 0}]

    assumptions = payload.get("assumptions", {})
    start_date_str = assumptions.get("start_date") or payload.get("scenario", {}).get("start_date")
    end_date_str = assumptions.get("end_date")

    # Compute total study days for repeating visit expansion
    if start_date_str and end_date_str:
        try:
            sd = date.fromisoformat(str(start_date_str)[:10])
            ed = date.fromisoformat(str(end_date_str)[:10])
            total_days = (ed - sd).days
        except Exception:
            total_days = 182  # ~26 weeks default
    else:
        raw_bucket = _norm_bucket(
            assumptions.get("forecast_bucket")
            or payload.get("scenario", {}).get("forecast_bucket")
        )
        step = _bucket_step_days(raw_bucket)
        horizon = int(
            payload.get("scenario", {}).get("horizon_buckets")
            or assumptions.get("horizon_buckets")
            or 26
        )
        total_days = step * horizon

    expanded: List[dict] = []

    for v in raw_visits:
        visit_id = v.get("visit_id", "VISIT")
        day_offset = int(v.get("day_offset", 0) or 0)
        attrs = v.get("attributes", {})
        repeat_every = attrs.get("repeat_every_days")

        if repeat_every and int(repeat_every) > 0:
            repeat_every = int(repeat_every)
            # First occurrence
            expanded.append({
                "visit_id": visit_id,
                "day_offset": day_offset,
                "source_visit_id": visit_id,
            })
            # Expand subsequent occurrences
            current_offset = day_offset + repeat_every
            week_num = (day_offset // 7) + (repeat_every // 7) + 1
            while current_offset <= total_days:
                expanded.append({
                    "visit_id": f"{visit_id}_w{week_num}",
                    "day_offset": current_offset,
                    "source_visit_id": visit_id,
                })
                current_offset += repeat_every
                week_num += 1
        else:
            expanded.append({
                "visit_id": visit_id,
                "day_offset": day_offset,
                "source_visit_id": visit_id,
            })

    return expanded


def visits_per_cohort_per_bucket(
    payload: dict,
    bucket_dates: List[date],
    per_cohort_enrolled: Dict[str, List[float]],
) -> Dict[str, Dict[str, List[float]]]:
    """Map visit events to buckets for each cohort.

    Returns: {cohort_id: {visit_id: [count_per_bucket]}}

    For each enrolled participant in cohort C at bucket i, each visit with
    day_offset d maps to bucket i + (d // step_days), contributing the
    enrollment count.
    """
    assumptions = payload.get("assumptions", {})
    raw_bucket = _norm_bucket(
        assumptions.get("forecast_bucket")
        or payload.get("scenario", {}).get("forecast_bucket")
    )
    step = _bucket_step_days(raw_bucket)
    horizon = len(bucket_dates)

    expanded = expand_visits(payload)

    result: Dict[str, Dict[str, List[float]]] = {}

    for cohort_id, enrolled in per_cohort_enrolled.items():
        cohort_visits: Dict[str, List[float]] = {}
        for ev in expanded:
            vid = ev["visit_id"]
            cohort_visits[vid] = [0.0] * horizon

        for i, n_enroll in enumerate(enrolled):
            if n_enroll == 0:
                continue
            for ev in expanded:
                vid = ev["visit_id"]
                offset_buckets = ev["day_offset"] // step
                j = i + offset_buckets
                if 0 <= j < horizon:
                    cohort_visits[vid][j] += n_enroll

        result[cohort_id] = cohort_visits

    return result
