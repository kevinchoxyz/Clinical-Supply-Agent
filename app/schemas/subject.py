from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# --- Subject ---

class SubjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject_number: str
    scenario_id: Optional[UUID] = None
    cohort_id: Optional[str] = None
    arm_id: Optional[str] = None
    site_node_id: Optional[str] = None  # logical node_id
    status: str = "SCREENED"
    screened_at: Optional[datetime] = None
    notes: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None


class SubjectOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    subject_number: str
    scenario_id: Optional[UUID]
    cohort_id: Optional[str]
    arm_id: Optional[str]
    site_node_id: Optional[UUID]
    status: str
    screened_at: Optional[datetime]
    enrolled_at: Optional[datetime]
    discontinued_at: Optional[datetime]
    completed_at: Optional[datetime]
    notes: Optional[str]
    attributes: Optional[Dict[str, Any]]
    created_at: datetime


class SubjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Optional[str] = None
    cohort_id: Optional[str] = None
    arm_id: Optional[str] = None
    notes: Optional[str] = None
    enrolled_at: Optional[datetime] = None
    discontinued_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# --- Subject Visit ---

class SubjectVisitCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    visit_id: str
    scheduled_date: Optional[datetime] = None
    status: str = "SCHEDULED"
    notes: Optional[str] = None


class SubjectVisitOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    subject_id: UUID
    visit_id: str
    scheduled_date: Optional[datetime]
    actual_date: Optional[datetime]
    status: str
    notes: Optional[str]


class SubjectVisitUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Optional[str] = None
    actual_date: Optional[datetime] = None
    notes: Optional[str] = None


# --- Kit Assignment (Dispense) ---

class DispenseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lot_id: Optional[UUID] = None
    product_id: str
    presentation_id: Optional[str] = None
    qty_dispensed: float
    dispensed_by: Optional[str] = None


class KitReturnRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    returned_qty: float


class KitAssignmentOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    subject_visit_id: UUID
    lot_id: Optional[UUID]
    product_id: str
    presentation_id: Optional[str]
    qty_dispensed: float
    dispensed_at: Optional[datetime]
    dispensed_by: Optional[str]
    returned_qty: float
    returned_at: Optional[datetime]
