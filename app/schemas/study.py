from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class VisitDoseLevel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dose_per_kg: Optional[float] = None   # for weight-based dosing
    dose_value: Optional[float] = None     # for fixed dosing
    dose_uom: str = "ng_per_kg"
    phase: str = ""  # e.g. "priming", "target"


class CohortDoseSchedule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    visits: Dict[str, VisitDoseLevel] = Field(default_factory=dict)


class DoseSchedule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cohorts: Dict[str, CohortDoseSchedule] = Field(default_factory=dict)


class StudyPayload(BaseModel):
    """The protocol-level data blob stored in studies.payload."""
    model_config = ConfigDict(extra="allow")

    trial: Optional[Dict[str, Any]] = None
    products: Optional[List[Dict[str, Any]]] = None
    network_nodes: Optional[List[Dict[str, Any]]] = None
    network_lanes: Optional[List[Dict[str, Any]]] = None
    visits: Optional[List[Dict[str, Any]]] = None
    dose_schedule: Optional[Dict[str, Any]] = None
    dosing_strategy: Optional[str] = None  # "fixed", "weight_based", "loading_maintenance", "dose_escalation"
    arms: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None


class StudyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    study_code: str = Field(..., max_length=64, examples=["STUDY-001"])
    name: str = Field(..., max_length=256, examples=["Phase 1a PK Study"])
    description: Optional[str] = None
    phase: Optional[str] = Field(None, max_length=32, examples=["P1"])
    protocol_version: Optional[str] = Field(None, max_length=64, examples=["v1.0"])
    countries: Optional[List[str]] = None
    payload: StudyPayload = Field(default_factory=StudyPayload)


class StudyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(None, max_length=256)
    description: Optional[str] = None
    phase: Optional[str] = Field(None, max_length=32)
    protocol_version: Optional[str] = Field(None, max_length=64)
    countries: Optional[List[str]] = None
    payload: Optional[StudyPayload] = None


class StudyOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    study_code: str
    name: str
    description: Optional[str]
    phase: Optional[str]
    protocol_version: Optional[str]
    countries: Optional[List[str]]
    created_at: datetime
    updated_at: datetime


class StudyDetailOut(StudyOut):
    payload: Dict[str, Any]
