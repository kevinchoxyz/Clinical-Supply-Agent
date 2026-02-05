import json
from datetime import date

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.schemas.canonical import (
    CanonicalScenarioInput,
    ForecastMethod,
    Phase,
    TimeBucket,
)

router = APIRouter()


def _json_response(data: object, pretty: bool) -> object:
    if not pretty:
        return data

    return Response(
        content=json.dumps(data, indent=2, default=str),
        media_type="application/json",
    )


@router.get("/schema/canonical")
def canonical_schema(
    pretty: bool = Query(False, description="If true, return indented JSON for readability.")
):
    schema = CanonicalScenarioInput.model_json_schema()
    return _json_response(schema, pretty=pretty)


@router.get("/schema/canonical/example")
def canonical_example(
    pretty: bool = Query(False, description="If true, return indented JSON for readability.")
):
    example = CanonicalScenarioInput(
        schema_version="1.0.0",
        trial={
            "code": "EXAMPLE-001",
            "phase": Phase.P2,
            "protocol_version": "1.0",
            "countries": ["US"],
        },
        scenario={"scenario_name": "Baseline", "scenario_description": "Example baseline scenario"},
        scenario_version={"version": 1, "label": "v1 - example"},
        network_nodes=[
            {"node_id": "DEPOT_US_01", "node_type": "DEPOT", "name": "US Depot", "country": "US"},
            {"node_id": "SITE_US_1001", "node_type": "SITE", "name": "Site 1001", "country": "US", "activation_date": date(2026, 2, 1)},
        ],
        network_lanes=[
            {"lane_id": "LANE_US_DEPOT_TO_SITE1001", "from_node_id": "DEPOT_US_01", "to_node_id": "SITE_US_1001", "default_lead_time_days": 3},
        ],
        products=[
            {
                "product_id": "IP_DP",
                "name": "Investigational Product DP",
                "product_type": "IP",
                "inventory_uom": "vial",
                "presentations": [
                    {"presentation_id": "DP_VIAL_STD", "uom": "vial", "attributes": {"concentration": "1 mg/mL", "nominal_fill_mL": 1.0}}
                ],
            }
        ],
        study_design={
            "arms": [{"arm_id": "ARM_A", "name": "Arm A", "randomization_weight": 1.0}],
            "cohorts": [],
            "visits": [
                {"visit_id": "C1D1", "day_offset": 0, "cycle_number": 1, "cycle_day": 1, "is_dosing_event": True},
                {"visit_id": "C1D8", "day_offset": 7, "cycle_number": 1, "cycle_day": 8, "is_dosing_event": True},
            ],
            "arm_to_regimen": {"ARM_A": "REG_A"},
            "cohort_to_regimen": {},
        },
        regimens=[
            {
                "regimen_id": "REG_A",
                "name": "Fixed dose regimen",
                "dose_rule": {"type": "fixed", "dose_value": 200, "dose_uom": "mg"},
                "dose_inputs": {},
                "visit_dispense": {"C1D1": "DISP_1", "C1D8": "DISP_1"},
            }
        ],
        dispense_rules=[
            {
                "dispense_rule_id": "DISP_1",
                "name": "Vial optimization for DP",
                "rule": {"type": "vial_optimization", "product_id": "IP_DP", "allowed_presentations": ["DP_VIAL_STD"], "dose_uom": "mg"},
            }
        ],
        assumptions={
            "start_date": date(2026, 2, 1),
            "end_date": date(2026, 8, 1),
            "forecast_bucket": TimeBucket.WEEK,
            "method": ForecastMethod.EXPECTED_VALUE,
            "enrollment_waves": [
                {
                    "wave_id": "US_WAVE_1",
                    "node_ids": ["SITE_US_1001"],
                    "start_date": date(2026, 2, 1),
                    "bucket": TimeBucket.WEEK,
                    "enrollment_rate_per_bucket": 0.25,
                    "screen_fail_rate": 0.2,
                    "replacement_rate": 0.0,
                }
            ],
            "discontinuation": {"type": "hazard_per_bucket", "hazard": 0.02, "bucket": TimeBucket.WEEK},
            "buffers": {"depot_safety_stock_days": 30, "site_safety_stock_days": 14, "expiry_buffer_days": 30},
            "lead_time_overrides": [],
            "global_overage_factor": 1.05,
        },
        starting_inventory=None,
        tags=["example"],
    ).model_dump(mode="json")

    return _json_response(example, pretty=pretty)
