from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.canonical import CanonicalScenarioInput


class ScenarioCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    trial_code: str = Field(..., examples=["CBX-250-001"])
    name: str = Field(..., examples=["Baseline"])
    description: Optional[str] = None
    study_id: Optional[UUID] = None


class ScenarioOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    trial_code: str
    name: str
    description: Optional[str]
    study_id: Optional[UUID] = None
    created_at: datetime


class ScenarioVersionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: Optional[str] = None
    created_by: Optional[str] = None
    payload: CanonicalScenarioInput


class ScenarioVersionOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    scenario_id: UUID
    version: int
    label: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    payload_hash: str


class ScenarioVersionDetailOut(ScenarioVersionOut):
    """Includes the full payload — used for single-version retrieval."""
    model_config = ConfigDict(extra="forbid")

    payload: Dict[str, Any]


class ForkRequest(BaseModel):
    """
    override uses JSON Merge Patch-like semantics:
      - dict values are merged recursively
      - if a key has value null, that key is deleted from the result
    """
    model_config = ConfigDict(extra="forbid")

    label: Optional[str] = None
    created_by: Optional[str] = None
    override: Dict[str, Any] = Field(default_factory=dict)
