from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import ENGINE_VERSION
from app.core.hashing import stable_hash
from app.db.session import get_db
from app.models.scenario import ForecastRun, ScenarioVersion
from app.schemas.forecast import (
    ForecastCompareResponse,
    ForecastRunCreateResponse,
    ForecastRunOut,
)
from app.services.forecast_engine import run_forecast


class ForecastRunRequest(BaseModel):
    scenario_id: UUID
    version: Optional[int] = None

router = APIRouter()


def _get_or_run_forecast(sv: ScenarioVersion, db: Session) -> dict:
    """Check for a cached ForecastRun by input_hash; run if missing."""
    input_hash = stable_hash(sv.payload)

    cached = db.execute(
        select(ForecastRun).where(
            ForecastRun.scenario_version_id == sv.id,
            ForecastRun.input_hash == input_hash,
            ForecastRun.status == "SUCCESS",
        ).order_by(ForecastRun.finished_at.desc()).limit(1)
    ).scalar_one_or_none()

    if cached and cached.outputs:
        return cached.outputs

    outputs = run_forecast(sv.payload)

    fr = ForecastRun(
        scenario_version_id=sv.id,
        engine_version=ENGINE_VERSION,
        input_hash=input_hash,
        status="SUCCESS",
        started_at=datetime.now(UTC),
        finished_at=datetime.now(UTC),
        outputs=outputs,
    )
    db.add(fr)
    db.commit()

    return outputs


@router.post("/forecast/run", response_model=ForecastRunCreateResponse)
def run_forecast_for_version(
    body: ForecastRunRequest,
    db: Session = Depends(get_db),
):
    # Resolve ScenarioVersion from scenario_id + optional version number
    if body.version is not None:
        sv = db.execute(
            select(ScenarioVersion).where(
                ScenarioVersion.scenario_id == body.scenario_id,
                ScenarioVersion.version == body.version,
            )
        ).scalar_one_or_none()
    else:
        # Use latest version
        sv = db.execute(
            select(ScenarioVersion)
            .where(ScenarioVersion.scenario_id == body.scenario_id)
            .order_by(ScenarioVersion.version.desc())
            .limit(1)
        ).scalar_one_or_none()

    if not sv:
        raise HTTPException(status_code=404, detail="ScenarioVersion not found")

    scenario_version_id = sv.id

    input_hash = stable_hash(sv.payload)

    fr = ForecastRun(
        scenario_version_id=scenario_version_id,
        engine_version=ENGINE_VERSION,
        input_hash=input_hash,
        status="RUNNING",
        started_at=datetime.now(UTC),
        outputs=None,
    )
    db.add(fr)
    db.commit()
    db.refresh(fr)

    try:
        outputs = run_forecast(sv.payload)
        fr.outputs = outputs
        fr.status = "SUCCESS"
        fr.finished_at = datetime.now(UTC)
        db.commit()
        db.refresh(fr)
    except Exception as e:
        fr.status = "FAILED"
        fr.outputs = {"error": str(e)}
        fr.finished_at = datetime.now(UTC)
        db.commit()
        raise

    return ForecastRunCreateResponse(
        forecast_run_id=fr.id,
        status=fr.status,
        scenario_version_id=fr.scenario_version_id,
        engine_version=fr.engine_version,
    )


@router.get("/forecast/runs/{forecast_run_id}", response_model=ForecastRunOut)
def get_forecast_run(forecast_run_id: UUID, db: Session = Depends(get_db)):
    fr = db.get(ForecastRun, forecast_run_id)
    if not fr:
        raise HTTPException(status_code=404, detail="ForecastRun not found")
    return ForecastRunOut(
        id=fr.id,
        scenario_version_id=fr.scenario_version_id,
        engine_version=fr.engine_version,
        status=fr.status,
        started_at=fr.started_at,
        finished_at=fr.finished_at,
        outputs=fr.outputs,
    )


@router.get("/forecast/compare", response_model=ForecastCompareResponse)
def compare_versions(
    scenario_id: UUID = Query(...),
    version_a: int = Query(..., alias="a", description="Scenario version number A"),
    version_b: int = Query(..., alias="b", description="Scenario version number B"),
    db: Session = Depends(get_db),
):
    sva = db.execute(
        select(ScenarioVersion).where(
            ScenarioVersion.scenario_id == scenario_id,
            ScenarioVersion.version == version_a,
        )
    ).scalar_one_or_none()
    svb = db.execute(
        select(ScenarioVersion).where(
            ScenarioVersion.scenario_id == scenario_id,
            ScenarioVersion.version == version_b,
        )
    ).scalar_one_or_none()

    if not sva or not svb:
        raise HTTPException(status_code=404, detail="One or both scenario versions not found")

    out_a = _get_or_run_forecast(sva, db)
    out_b = _get_or_run_forecast(svb, db)

    enrolled_a = out_a["enrolled_per_bucket"]
    enrolled_b = out_b["enrolled_per_bucket"]
    delta_enrolled = [eb - ea for ea, eb in zip(enrolled_a, enrolled_b)]

    demand_a = out_a["demand"]
    demand_b = out_b["demand"]
    all_keys = set(demand_a.keys()) | set(demand_b.keys())
    demand_delta = {}
    for k in all_keys:
        da = demand_a.get(k, [0.0] * len(enrolled_a))
        db_vals = demand_b.get(k, [0.0] * len(enrolled_b))
        demand_delta[k] = [y - x for x, y in zip(da, db_vals)]

    return ForecastCompareResponse(
        scenario_id=scenario_id,
        a_version=version_a,
        b_version=version_b,
        bucket_dates=out_a["bucket_dates"],
        delta_enrolled_per_bucket=delta_enrolled,
        a_cumulative_enrolled=out_a["cumulative_enrolled"],
        b_cumulative_enrolled=out_b["cumulative_enrolled"],
        delta_demand=demand_delta,
        engine_version=ENGINE_VERSION,
    )
