from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any, Dict, List, Tuple

from app.core.constants import ENGINE_VERSION
from app.services.demand_aggregator import has_rich_scenario, run_demand_model


def _get_in(d: dict, path: list[str], default=None):
    cur: Any = d
    for k in path:
        if not isinstance(cur, dict) or k not in cur:
            return default
        cur = cur[k]
    return cur


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


def _norm_bucket(value: Any) -> str:
    b = str(value).lower() if value is not None else "week"
    if b in ("weekly", "week", "w", "wk", "weeks"):
        return "week"
    if b in ("monthly", "month", "m", "mo", "months"):
        return "month"
    return "week"


def _bucket_step_days(bucket: str) -> int:
    return 7 if bucket == "week" else 30  # v0 month approximation


def _infer_bucket_and_horizon(payload: dict) -> tuple[str, int]:
    bucket = (
        _get_in(payload, ["scenario", "forecast_bucket"])
        or _get_in(payload, ["scenario", "time_bucket"])
        or _get_in(payload, ["scenario", "bucket"])
        or _get_in(payload, ["assumptions", "forecast_bucket"])
        or _get_in(payload, ["assumptions", "time_bucket"])
        or "week"
    )
    bucket = _norm_bucket(bucket)

    horizon = (
        _get_in(payload, ["scenario", "horizon_buckets"])
        or _get_in(payload, ["scenario", "forecast_horizon_buckets"])
        or _get_in(payload, ["scenario", "horizon"])
        or _get_in(payload, ["assumptions", "horizon_buckets"])
        or _get_in(payload, ["assumptions", "horizon"])
        or 26
    )

    try:
        horizon_buckets = int(horizon)
    except Exception:
        horizon_buckets = 26

    horizon_buckets = max(1, min(horizon_buckets, 520))
    return bucket, horizon_buckets


def _infer_start_date(payload: dict) -> date:
    candidates = [
        _get_in(payload, ["scenario", "start_date"]),
        _get_in(payload, ["scenario", "forecast_start_date"]),
        _get_in(payload, ["scenario", "study_start_date"]),
        _get_in(payload, ["scenario", "anchor_date"]),
        _get_in(payload, ["assumptions", "start_date"]),
        _get_in(payload, ["assumptions", "forecast_start_date"]),
    ]
    for c in candidates:
        d = _parse_date(c)
        if d:
            return d
    return datetime.now(UTC).date()


def _bucket_dates(start: date, n: int, bucket: str) -> List[date]:
    out = [start]
    cur = start
    for _ in range(n - 1):
        cur = cur + timedelta(days=_bucket_step_days(bucket))
        out.append(cur)
    return out


def _coerce_int(v: Any) -> int | None:
    if v is None:
        return None
    try:
        return int(v)
    except Exception:
        return None


def _wave_indices_from_dates(
    wave_start: date | None,
    wave_end: date | None,
    forecast_start: date,
    bucket: str,
    horizon: int,
) -> tuple[int, int] | None:
    if not wave_start:
        return None

    step_days = _bucket_step_days(bucket)

    def idx(d: date) -> int:
        delta_days = (d - forecast_start).days
        return int(delta_days // step_days)

    s = idx(wave_start)
    e = idx(wave_end) if wave_end else horizon - 1

    s = max(0, min(horizon - 1, s))
    e = max(0, min(horizon - 1, e))
    if e < s:
        e = s
    return s, e


def _infer_wave_range(wave: dict, forecast_start: date, bucket: str, horizon: int) -> tuple[int, int]:
    # date-based
    ws = _parse_date(wave.get("start_date") or wave.get("wave_start_date") or wave.get("from_date"))
    we = _parse_date(wave.get("end_date") or wave.get("wave_end_date") or wave.get("to_date"))
    date_range = _wave_indices_from_dates(ws, we, forecast_start, bucket, horizon)
    if date_range:
        return date_range

    # index-based (many possible names)
    s = (
        _coerce_int(wave.get("start_bucket_index"))
        or _coerce_int(wave.get("start_bucket"))
        or _coerce_int(wave.get("start_week"))
        or _coerce_int(wave.get("start_index"))
        or 0
    )
    e = (
        _coerce_int(wave.get("end_bucket_index"))
        or _coerce_int(wave.get("end_bucket"))
        or _coerce_int(wave.get("end_week"))
        or _coerce_int(wave.get("end_index"))
        or (horizon - 1)
    )

    s = max(0, min(horizon - 1, s))
    e = max(0, min(horizon - 1, e))
    if e < s:
        e = s
    return s, e


def _infer_wave_rate(wave: dict) -> float:
    rate = (
        wave.get("enrollment_rate_per_bucket")
        or wave.get("rate_per_bucket")
        or wave.get("enrollment_per_bucket")
        or wave.get("enrollment_rate")
        or wave.get("rate")
        or 0.0
    )
    try:
        return float(rate)
    except Exception:
        return 0.0


def _enrollment_from_curve(payload: dict, curve: dict) -> Tuple[List[date], List[float]]:
    """Convert monthly enrollment curve to bucket-aligned enrollment."""
    bucket, horizon = _infer_bucket_and_horizon(payload)
    start = _infer_start_date(payload)

    dates = _bucket_dates(start, horizon, bucket)
    enrolled = [0.0] * horizon

    points = curve.get("points", [])
    screen_fail_rate = float(curve.get("screen_fail_rate") or 0)

    # Build period → new_subjects map
    period_subjects: Dict[int, float] = {}
    for pt in points:
        if isinstance(pt, dict):
            period = int(pt.get("period", 0))
            subjects = float(pt.get("new_subjects", 0))
            if subjects > 0:
                period_subjects[period] = subjects

    step_days = _bucket_step_days(bucket)

    for period_num, subjects in period_subjects.items():
        # Apply screen fail rate
        effective = subjects * (1 - screen_fail_rate) if screen_fail_rate else subjects

        if bucket == "month":
            # Direct mapping: period N → bucket N-1 (0-indexed)
            bucket_idx = period_num - 1
            if 0 <= bucket_idx < horizon:
                enrolled[bucket_idx] += effective
        else:
            # Weekly: distribute monthly subjects across ~4.3 weeks
            # Month N starts at day (N-1)*30
            month_start_day = (period_num - 1) * 30
            month_end_day = period_num * 30
            weeks_in_month = max(1, (month_end_day - month_start_day) / step_days)
            per_week = effective / weeks_in_month

            for day in range(month_start_day, month_end_day, step_days):
                bucket_idx = day // step_days
                if 0 <= bucket_idx < horizon:
                    enrolled[bucket_idx] += per_week

    return dates, enrolled


def _enrollment_per_bucket(payload: dict) -> Tuple[List[date], List[float]]:
    bucket, horizon = _infer_bucket_and_horizon(payload)
    start = _infer_start_date(payload)

    dates = _bucket_dates(start, horizon, bucket)
    enrolled = [0.0] * horizon

    # Check for enrollment_curve first
    curve = _get_in(payload, ["assumptions", "enrollment_curve"])
    if isinstance(curve, dict) and curve.get("points"):
        return _enrollment_from_curve(payload, curve)

    waves = _get_in(payload, ["assumptions", "enrollment_waves"], default=None)

    if isinstance(waves, list) and len(waves) > 0 and all(isinstance(w, dict) for w in waves):
        for w in waves:
            s, e = _infer_wave_range(w, start, bucket, horizon)
            rate = _infer_wave_rate(w)
            for i in range(s, e + 1):
                enrolled[i] += rate
        return dates, enrolled

    # fallback: global rate
    global_rate = _get_in(payload, ["assumptions", "enrollment_rate_per_bucket"]) or _get_in(
        payload, ["assumptions", "enrollment_rate"]
    )
    try:
        global_rate = float(global_rate) if global_rate is not None else 0.0
    except Exception:
        global_rate = 0.0

    for i in range(horizon):
        enrolled[i] = global_rate

    return dates, enrolled


# -----------------------
# Bucket 5A: Visit schedule
# -----------------------

def _default_visit_schedule() -> dict:
    # Minimal default: one "Dose" visit at day 0
    return {
        "name": "Default (single dose at Day 1)",
        "bucket_alignment": "enrollment_bucket",
        "visits": [
            {"name": "Dose", "offset_days": 0}
        ],
    }


def _infer_visit_schedule(payload: dict) -> dict:
    vs = (
        _get_in(payload, ["assumptions", "visit_schedule"])
        or _get_in(payload, ["protocol", "visit_schedule"])
        or None
    )

    if isinstance(vs, dict) and isinstance(vs.get("visits"), list):
        visits = [v for v in vs["visits"] if isinstance(v, dict)]
        if len(visits) > 0:
            norm_visits = []
            for v in visits:
                name = str(v.get("name") or v.get("visit") or "Visit")
                od = v.get("offset_days") or v.get("day_offset") or v.get("offset") or 0
                try:
                    od_i = int(od)
                except Exception:
                    od_i = 0
                norm_visits.append({"name": name, "offset_days": od_i})
            return {
                "name": str(vs.get("name") or "Visit schedule"),
                "bucket_alignment": str(vs.get("bucket_alignment") or "enrollment_bucket"),
                "visits": norm_visits,
            }

    alt = _get_in(payload, ["assumptions", "visits"])
    if isinstance(alt, list) and all(isinstance(v, dict) for v in alt) and len(alt) > 0:
        norm_visits = []
        for v in alt:
            name = str(v.get("name") or v.get("visit") or "Visit")
            od = v.get("offset_days") or v.get("day_offset") or v.get("offset") or 0
            try:
                od_i = int(od)
            except Exception:
                od_i = 0
            norm_visits.append({"name": name, "offset_days": od_i})
        return {
            "name": "Visit schedule (from assumptions.visits)",
            "bucket_alignment": "enrollment_bucket",
            "visits": norm_visits,
        }

    return _default_visit_schedule()


def _visits_per_bucket(payload: dict, enrolled: List[float]) -> dict:
    bucket, horizon = _infer_bucket_and_horizon(payload)
    step_days = _bucket_step_days(bucket)

    vs = _infer_visit_schedule(payload)
    visits = vs.get("visits", [])

    visits_per_bucket: Dict[str, List[float]] = {}
    for v in visits:
        name = str(v.get("name", "Visit"))
        visits_per_bucket[name] = [0.0] * horizon

    total = [0.0] * horizon

    for i, n_enroll in enumerate(enrolled):
        if n_enroll == 0:
            continue
        for v in visits:
            name = str(v.get("name", "Visit"))
            offset_days = v.get("offset_days", 0)
            try:
                offset_days_i = int(offset_days)
            except Exception:
                offset_days_i = 0

            offset_buckets = int(offset_days_i // step_days)
            j = i + offset_buckets
            if 0 <= j < horizon:
                visits_per_bucket[name][j] += float(n_enroll)
                total[j] += float(n_enroll)

    return {
        "visit_schedule": vs,
        "visits_per_bucket": visits_per_bucket,
        "total_visits_per_bucket": total,
    }


def _trial_code(payload: dict) -> str:
    return (
        _get_in(payload, ["scenario", "trial_code"])
        or _get_in(payload, ["scenario", "protocol_id"])
        or _get_in(payload, ["scenario", "code"])
        or _get_in(payload, ["trial", "code"])
        or "TRIAL"
    )


def _simple_demand_model(payload: dict, enrolled: List[float]) -> Dict[str, List[float]]:
    item = f"{_trial_code(payload)}:KIT"
    return {item: [float(x) for x in enrolled]}


def run_forecast(canonical_payload: dict) -> dict:
    # Route to rich demand model if the payload supports it
    if has_rich_scenario(canonical_payload):
        result = run_demand_model(canonical_payload)
        supply_plan = {
            "notes": "v0 placeholder supply plan; will add lead times, safety stock, production lots later.",
            "planned_orders": [],
        }
        result["supply_plan"] = supply_plan
        result["engine_version"] = ENGINE_VERSION
        result["generated_at"] = datetime.now(UTC).isoformat()
        return result

    # Legacy simple path
    dates, enrolled = _enrollment_per_bucket(canonical_payload)

    cum = []
    total = 0.0
    for x in enrolled:
        total += float(x)
        cum.append(total)

    demand = _simple_demand_model(canonical_payload, enrolled)

    visit_outputs = _visits_per_bucket(canonical_payload, enrolled)

    supply_plan = {
        "notes": "v0 placeholder supply plan; will add lead times, safety stock, production lots later.",
        "planned_orders": [],
    }

    return {
        "engine_version": ENGINE_VERSION,
        "bucket_dates": [d.isoformat() for d in dates],
        "enrolled_per_bucket": enrolled,
        "cumulative_enrolled": cum,
        "demand": demand,
        "supply_plan": supply_plan,
        "visit_schedule": visit_outputs["visit_schedule"],
        "visits_per_bucket": visit_outputs["visits_per_bucket"],
        "total_visits_per_bucket": visit_outputs["total_visits_per_bucket"],
        "generated_at": datetime.now(UTC).isoformat(),
    }
