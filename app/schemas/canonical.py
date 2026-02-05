from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator
from pydantic.config import ConfigDict


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class Phase(str, Enum):
    P1 = "P1"
    P1A = "P1A"
    P1B = "P1B"
    P2 = "P2"
    P2A = "P2A"
    P2B = "P2B"
    P3 = "P3"
    P4 = "P4"


class TimeBucket(str, Enum):
    WEEK = "WEEK"
    MONTH = "MONTH"


class ForecastMethod(str, Enum):
    EXPECTED_VALUE = "EXPECTED_VALUE"
    MONTE_CARLO = "MONTE_CARLO"


# ---------------------------------------------------------------------------
# Trial / Scenario metadata
# ---------------------------------------------------------------------------

class TrialInfo(BaseModel):
    model_config = ConfigDict(extra="allow")

    code: str = "TRIAL"
    phase: Optional[str] = None
    protocol_version: Optional[str] = None
    countries: List[str] = Field(default_factory=list)


class ScenarioMeta(BaseModel):
    model_config = ConfigDict(extra="allow")

    trial_code: str = "TRIAL"
    name: Optional[str] = None
    scenario_name: Optional[str] = None
    scenario_description: Optional[str] = None
    description: Optional[str] = None

    start_date: Optional[date] = None
    forecast_bucket: Optional[str] = None
    horizon_buckets: Optional[int] = None


class ScenarioVersionMeta(BaseModel):
    model_config = ConfigDict(extra="allow")

    version: Optional[int] = None
    label: Optional[str] = None


# ---------------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------------

class NetworkNode(BaseModel):
    model_config = ConfigDict(extra="allow")

    node_id: str
    node_type: str = "SITE"
    name: Optional[str] = None
    country: Optional[str] = None
    activation_date: Optional[date] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)


class NetworkLane(BaseModel):
    model_config = ConfigDict(extra="allow")

    lane_id: str
    from_node_id: str
    to_node_id: str
    default_lead_time_days: int = 3
    mode: Optional[str] = None


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

class Presentation(BaseModel):
    model_config = ConfigDict(extra="allow")

    presentation_id: str
    uom: str = "vial"
    attributes: Dict[str, Any] = Field(default_factory=dict)


class Product(BaseModel):
    model_config = ConfigDict(extra="allow")

    product_id: str
    name: Optional[str] = None
    product_type: Optional[str] = None
    inventory_uom: str = "vial"
    presentations: List[Presentation] = Field(default_factory=list)
    attributes: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Study design
# ---------------------------------------------------------------------------

class Arm(BaseModel):
    model_config = ConfigDict(extra="allow")

    arm_id: str
    name: Optional[str] = None
    randomization_weight: float = 1.0


class Cohort(BaseModel):
    model_config = ConfigDict(extra="allow")

    cohort_id: str
    name: Optional[str] = None
    max_participants: Optional[int] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)


class VisitDef(BaseModel):
    model_config = ConfigDict(extra="allow")

    visit_id: str
    day_offset: int = 0
    cycle_number: Optional[int] = None
    cycle_day: Optional[int] = None
    is_dosing_event: bool = False
    attributes: Dict[str, Any] = Field(default_factory=dict)


class StudyDesign(BaseModel):
    model_config = ConfigDict(extra="allow")

    arms: List[Arm] = Field(default_factory=list)
    cohorts: List[Cohort] = Field(default_factory=list)
    visits: List[VisitDef] = Field(default_factory=list)
    arm_to_regimen: Dict[str, str] = Field(default_factory=dict)
    cohort_to_regimen: Dict[str, str] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Regimens & dose rules
# ---------------------------------------------------------------------------

class DoseTableRow(BaseModel):
    model_config = ConfigDict(extra="allow")

    visit_id: str
    per_kg_value: Optional[float] = None
    per_kg_uom: Optional[str] = None
    output_uom: Optional[str] = None
    dose_value: Optional[float] = None
    dose_uom: Optional[str] = None


class DoseRule(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: str = "fixed"
    dose_value: Optional[float] = None
    dose_uom: Optional[str] = None
    default_output_uom: Optional[str] = None
    rows: List[DoseTableRow] = Field(default_factory=list)


class Regimen(BaseModel):
    model_config = ConfigDict(extra="allow")

    regimen_id: str
    name: Optional[str] = None
    dose_rule: Optional[DoseRule] = None
    dose_inputs: Dict[str, Any] = Field(default_factory=dict)
    visit_dispense: Dict[str, str] = Field(default_factory=dict)
    attributes: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Dispense rules
# ---------------------------------------------------------------------------

class DispenseItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    product_id: str
    presentation_id: Optional[str] = None
    qty: Optional[float] = None
    calc: Optional[str] = None
    notes: Optional[str] = None


class DispenseCondition(BaseModel):
    model_config = ConfigDict(extra="allow")

    # {"field": "dose_mcg", "op": "<", "value": 200}
    field: Optional[str] = None
    op: Optional[str] = None
    value: Optional[float] = None


class DispenseConditionBranch(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    # "if": list of conditions (AND logic for ranges).
    # Accepts a single dict for backward compat and normalizes to a list.
    condition: Optional[List[DispenseCondition]] = Field(None, alias="if")
    then: Optional[Dict[str, Any]] = None

    @field_validator("condition", mode="before")
    @classmethod
    def _normalize_condition(cls, v: Any) -> Any:
        if v is None:
            return v
        if isinstance(v, dict):
            return [v]
        return v


class DispenseRuleBody(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: str = "simple"
    conditions: List[DispenseConditionBranch] = Field(default_factory=list)
    default: Optional[Dict[str, Any]] = None
    product_id: Optional[str] = None
    allowed_presentations: List[str] = Field(default_factory=list)
    dose_uom: Optional[str] = None


class DispenseRule(BaseModel):
    model_config = ConfigDict(extra="allow")

    dispense_rule_id: str
    name: Optional[str] = None
    rule: Optional[DispenseRuleBody] = None


# ---------------------------------------------------------------------------
# Assumptions  (backward-compat with old simple format)
# ---------------------------------------------------------------------------

class EnrollmentCurvePoint(BaseModel):
    model_config = ConfigDict(extra="allow")

    period: int                          # month number (1, 2, 3, ...)
    period_label: Optional[str] = None   # e.g. "Month 1", "2025-03"
    new_subjects: float = 0              # subjects enrolled in this period


class EnrollmentCurve(BaseModel):
    model_config = ConfigDict(extra="allow")

    curve_type: str = "monthly_forecast"
    screen_fail_rate: Optional[float] = None
    points: List[EnrollmentCurvePoint] = Field(default_factory=list)


class EnrollmentWave(BaseModel):
    model_config = ConfigDict(extra="allow")

    wave_id: Optional[str] = None
    node_ids: List[str] = Field(default_factory=list)

    start_date: Optional[date] = None
    end_date: Optional[date] = None

    start_bucket_index: Optional[int] = None
    end_bucket_index: Optional[int] = None

    bucket: Optional[str] = None
    enrollment_rate_per_bucket: Optional[float] = None
    screen_fail_rate: Optional[float] = None
    replacement_rate: Optional[float] = None


class Visit(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str
    offset_days: int = 0


class VisitSchedule(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: Optional[str] = None
    bucket_alignment: Optional[str] = "enrollment_bucket"
    visits: List[Visit] = Field(default_factory=list)


class DemandRuleItem(BaseModel):
    model_config = ConfigDict(extra="allow")
    item_code: str
    per_visit: Dict[str, float] = Field(default_factory=dict)


class DemandRules(BaseModel):
    model_config = ConfigDict(extra="allow")
    items: List[DemandRuleItem] = Field(default_factory=list)


class Assumptions(BaseModel):
    model_config = ConfigDict(extra="allow")

    start_date: Optional[date] = None
    end_date: Optional[date] = None
    forecast_bucket: Optional[str] = None
    method: Optional[str] = None
    monte_carlo_n: Optional[int] = None

    enrollment_waves: List[EnrollmentWave] = Field(default_factory=list)
    enrollment_curve: Optional[EnrollmentCurve] = None
    enrollment_rate_per_bucket: Optional[float] = None

    visit_schedule: Optional[VisitSchedule] = None
    demand_rules: Optional[DemandRules] = None

    discontinuation: Optional[Dict[str, Any]] = None
    buffers: Optional[Dict[str, Any]] = None
    lead_time_overrides: List[Any] = Field(default_factory=list)
    global_overage_factor: Optional[float] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Starting inventory
# ---------------------------------------------------------------------------

class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    node_id: str
    product_id: str
    presentation_id: Optional[str] = None
    lot_number: Optional[str] = None
    expiry_date: Optional[date] = None
    status: Optional[str] = None
    qty: float = 0


class StartingInventory(BaseModel):
    model_config = ConfigDict(extra="allow")

    as_of_date: Optional[date] = None
    items: List[InventoryItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Top-level canonical input
# ---------------------------------------------------------------------------

class CanonicalScenarioInput(BaseModel):
    model_config = ConfigDict(extra="allow")

    schema_version: Optional[str] = None

    trial: Optional[TrialInfo] = None
    scenario: ScenarioMeta = Field(default_factory=ScenarioMeta)
    scenario_version: Optional[ScenarioVersionMeta] = None

    network_nodes: List[NetworkNode] = Field(default_factory=list)
    network_lanes: List[NetworkLane] = Field(default_factory=list)

    products: List[Product] = Field(default_factory=list)

    study_design: Optional[StudyDesign] = None

    regimens: List[Regimen] = Field(default_factory=list)
    dispense_rules: List[DispenseRule] = Field(default_factory=list)

    assumptions: Assumptions = Field(default_factory=Assumptions)

    starting_inventory: Optional[StartingInventory] = None

    tags: List[str] = Field(default_factory=list)

    metadata: Dict[str, Any] = Field(default_factory=dict)
