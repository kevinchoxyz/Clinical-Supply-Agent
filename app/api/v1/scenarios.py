from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.hashing import stable_hash
from app.db.session import get_db
from app.models.scenario import Scenario, ScenarioVersion
from app.models.study import Study
from app.schemas.canonical import CanonicalScenarioInput
from app.schemas.scenarios import (
    ForkRequest,
    ScenarioCreate,
    ScenarioOut,
    ScenarioVersionCreate,
    ScenarioVersionDetailOut,
    ScenarioVersionOut,
)

router = APIRouter()


def _merge_patch(base: Any, patch: Any) -> Any:
    """JSON Merge Patch-like behavior."""
    if not isinstance(patch, dict):
        return patch

    if not isinstance(base, dict):
        base = {}

    result = dict(base)

    for k, v in patch.items():
        if v is None:
            result.pop(k, None)
        else:
            if isinstance(v, dict):
                result[k] = _merge_patch(result.get(k), v)
            else:
                result[k] = v

    return result


@router.post("/scenarios", response_model=ScenarioOut)
def create_scenario(payload: ScenarioCreate, db: Session = Depends(get_db)):
    if payload.study_id:
        study = db.get(Study, payload.study_id)
        if not study:
            raise HTTPException(status_code=404, detail="Study not found")

    scenario = Scenario(
        trial_code=payload.trial_code,
        name=payload.name,
        description=payload.description,
        study_id=payload.study_id,
        created_at=datetime.now(UTC),
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.get("/scenarios", response_model=list[ScenarioOut])
def list_scenarios(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    study_id: UUID | None = Query(None),
    db: Session = Depends(get_db),
):
    stmt = select(Scenario)
    if study_id is not None:
        stmt = stmt.where(Scenario.study_id == study_id)
    rows = (
        db.execute(
            stmt
            .order_by(Scenario.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return rows


@router.get("/scenarios/{scenario_id}", response_model=ScenarioOut)
def get_scenario(scenario_id: UUID, db: Session = Depends(get_db)):
    scenario = db.get(Scenario, scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


@router.delete("/scenarios/{scenario_id}")
def delete_scenario(scenario_id: UUID, db: Session = Depends(get_db)):
    scenario = db.get(Scenario, scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    db.delete(scenario)
    db.commit()
    return {"detail": "Scenario deleted"}


def _merge_study_into_payload(study: Study, payload_dict: dict) -> dict:
    """Merge study protocol-level data into the version payload."""
    study_payload = study.payload or {}

    # Overwrite trial info from study
    if study_payload.get("trial"):
        payload_dict["trial"] = study_payload["trial"]

    # Overwrite products from study
    if study_payload.get("products"):
        payload_dict["products"] = study_payload["products"]

    # Overwrite network from study
    if study_payload.get("network_nodes"):
        payload_dict["network_nodes"] = study_payload["network_nodes"]
    if study_payload.get("network_lanes"):
        payload_dict["network_lanes"] = study_payload["network_lanes"]

    # Merge visits into study_design.visits
    if study_payload.get("visits"):
        if "study_design" not in payload_dict or payload_dict["study_design"] is None:
            payload_dict["study_design"] = {}
        payload_dict["study_design"]["visits"] = study_payload["visits"]

    # Store dose_schedule in metadata
    if study_payload.get("dose_schedule"):
        if "metadata" not in payload_dict or payload_dict["metadata"] is None:
            payload_dict["metadata"] = {}
        payload_dict["metadata"]["dose_schedule"] = study_payload["dose_schedule"]

    # Merge arms as defaults
    if study_payload.get("arms"):
        sd = payload_dict.setdefault("study_design", {})
        if sd is None:
            sd = {}
            payload_dict["study_design"] = sd
        if not sd.get("arms"):
            sd["arms"] = study_payload["arms"]

    # Merge dosing_strategy into metadata
    if study_payload.get("dosing_strategy"):
        md = payload_dict.setdefault("metadata", {})
        if md is None:
            md = {}
            payload_dict["metadata"] = md
        md["dosing_strategy"] = study_payload["dosing_strategy"]

    # Merge dispense_rules from study
    if study_payload.get("dispense_rules"):
        payload_dict["dispense_rules"] = study_payload["dispense_rules"]

    # Auto-build regimen dose_rules from study dose_schedule
    dose_schedule = study_payload.get("dose_schedule", {})
    dosing_strategy = study_payload.get("dosing_strategy", "weight_based")

    if dose_schedule and isinstance(dose_schedule, dict) and payload_dict.get("regimens"):
        cohorts_ds = dose_schedule.get("cohorts", {})
        # Build cohort→regimen reverse map
        sd = payload_dict.get("study_design") or {}
        cohort_to_regimen = sd.get("cohort_to_regimen", {})

        for regimen in payload_dict["regimens"]:
            existing_rule = regimen.get("dose_rule") or {}
            if existing_rule and existing_rule.get("rows"):
                continue  # Don't overwrite existing dose_rule rows

            # Find matching cohort via cohort_to_regimen mapping
            matched_cohort_id = None
            for cid, rid in cohort_to_regimen.items():
                if rid == regimen.get("regimen_id"):
                    matched_cohort_id = cid
                    break

            if matched_cohort_id and matched_cohort_id in cohorts_ds:
                cohort_visits = cohorts_ds[matched_cohort_id].get("visits", {})
                rows = []
                for visit_id, dose_info in cohort_visits.items():
                    row: dict = {"visit_id": visit_id}
                    if dosing_strategy == "fixed":
                        row["dose_value"] = dose_info.get("dose_value")
                        row["dose_uom"] = dose_info.get("dose_uom", "mg")
                    else:
                        row["per_kg_value"] = dose_info.get("dose_per_kg")
                        row["per_kg_uom"] = dose_info.get("dose_uom", "ng_per_kg")
                    rows.append(row)
                if rows:
                    regimen["dose_rule"] = {
                        "type": "table",
                        "rows": rows,
                    }

    return payload_dict


@router.post("/scenarios/{scenario_id}/versions", response_model=ScenarioVersionOut)
def create_version(scenario_id: UUID, body: ScenarioVersionCreate, db: Session = Depends(get_db)):
    scenario = db.get(Scenario, scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    canonical: CanonicalScenarioInput = body.payload

    payload_dict = canonical.model_dump(mode="json", by_alias=True)

    # If scenario is linked to a study, merge study data into version payload
    if scenario.study_id:
        study = db.get(Study, scenario.study_id)
        if study:
            payload_dict = _merge_study_into_payload(study, payload_dict)

    max_v = db.execute(
        select(func.max(ScenarioVersion.version)).where(ScenarioVersion.scenario_id == scenario_id)
    ).scalar_one()
    next_version = 1 if max_v is None else int(max_v) + 1

    payload_hash = stable_hash(payload_dict)

    sv = ScenarioVersion(
        scenario_id=scenario_id,
        version=next_version,
        label=body.label,
        created_by=body.created_by,
        created_at=datetime.now(UTC),
        payload=payload_dict,
        payload_hash=payload_hash,
    )
    db.add(sv)
    db.commit()
    db.refresh(sv)
    return sv


@router.get("/scenarios/{scenario_id}/versions", response_model=list[ScenarioVersionOut])
def list_versions(
    scenario_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    rows = (
        db.execute(
            select(ScenarioVersion)
            .where(ScenarioVersion.scenario_id == scenario_id)
            .order_by(ScenarioVersion.version.asc())
            .offset(skip)
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return rows


@router.get("/scenarios/{scenario_id}/versions/latest", response_model=ScenarioVersionDetailOut)
def get_latest_version(scenario_id: UUID, db: Session = Depends(get_db)):
    sv = db.execute(
        select(ScenarioVersion)
        .where(ScenarioVersion.scenario_id == scenario_id)
        .order_by(ScenarioVersion.version.desc())
        .limit(1)
    ).scalar_one_or_none()

    if not sv:
        raise HTTPException(status_code=404, detail="No versions found for scenario")
    return sv


@router.get("/scenarios/{scenario_id}/versions/{version}", response_model=ScenarioVersionDetailOut)
def get_version(scenario_id: UUID, version: int, db: Session = Depends(get_db)):
    sv = db.execute(
        select(ScenarioVersion)
        .where(ScenarioVersion.scenario_id == scenario_id, ScenarioVersion.version == version)
    ).scalar_one_or_none()

    if not sv:
        raise HTTPException(status_code=404, detail="Scenario version not found")
    return sv


@router.get("/scenarios/{scenario_id}/versions/{version}/export")
def export_version(scenario_id: UUID, version: int, db: Session = Depends(get_db)):
    sv = db.execute(
        select(ScenarioVersion)
        .where(ScenarioVersion.scenario_id == scenario_id, ScenarioVersion.version == version)
    ).scalar_one_or_none()

    if not sv:
        raise HTTPException(status_code=404, detail="Scenario version not found")

    return sv.payload


@router.post("/scenarios/{scenario_id}/versions/{version}/fork", response_model=ScenarioVersionOut)
def fork_version(scenario_id: UUID, version: int, req: ForkRequest, db: Session = Depends(get_db)):
    base = db.execute(
        select(ScenarioVersion)
        .where(ScenarioVersion.scenario_id == scenario_id, ScenarioVersion.version == version)
    ).scalar_one_or_none()

    if not base:
        raise HTTPException(status_code=404, detail="Base scenario version not found")

    merged_payload = _merge_patch(base.payload, req.override)

    try:
        merged_model = CanonicalScenarioInput.model_validate(merged_payload)
        merged_payload_json = merged_model.model_dump(mode="json")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Override produced invalid canonical payload: {e}")

    max_v = db.execute(
        select(func.max(ScenarioVersion.version)).where(ScenarioVersion.scenario_id == scenario_id)
    ).scalar_one()
    next_version = 1 if max_v is None else int(max_v) + 1

    payload_hash = stable_hash(merged_payload_json)

    sv = ScenarioVersion(
        scenario_id=scenario_id,
        version=next_version,
        label=req.label,
        created_by=req.created_by,
        created_at=datetime.now(UTC),
        payload=merged_payload_json,
        payload_hash=payload_hash,
    )

    db.add(sv)
    db.commit()
    db.refresh(sv)
    return sv
