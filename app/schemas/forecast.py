from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ForecastRunCreateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    forecast_run_id: UUID
    status: str
    scenario_version_id: UUID
    engine_version: str


class ForecastRunOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    scenario_version_id: UUID
    engine_version: str
    status: str
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    outputs: Optional[Dict[str, Any]] = None


class ForecastCompareResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scenario_id: UUID
    a_version: int
    b_version: int
    bucket_dates: List[str]
    delta_enrolled_per_bucket: List[float]
    a_cumulative_enrolled: List[float]
    b_cumulative_enrolled: List[float]
    delta_demand: Dict[str, List[float]]
    engine_version: str
