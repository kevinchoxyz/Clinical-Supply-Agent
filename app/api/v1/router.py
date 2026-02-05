from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.forecast import router as forecast_router
from app.api.v1.health import router as health_router
from app.api.v1.integrations import router as integrations_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.reports import router as reports_router
from app.api.v1.scenarios import router as scenarios_router
from app.api.v1.studies import router as studies_router
from app.api.v1.schema import router as schema_router
from app.api.v1.shipments import router as shipments_router
from app.api.v1.subjects import router as subjects_router
from app.api.v1.supply_plan import router as supply_plan_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(schema_router, tags=["schema"])
api_router.include_router(studies_router, tags=["studies"])
api_router.include_router(scenarios_router, tags=["scenarios"])
api_router.include_router(forecast_router, tags=["forecast"])
api_router.include_router(inventory_router, tags=["inventory"])
api_router.include_router(supply_plan_router, tags=["supply-plan"])
api_router.include_router(shipments_router, tags=["shipments"])
api_router.include_router(subjects_router, tags=["subjects"])
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(reports_router, tags=["reports"])
api_router.include_router(integrations_router, tags=["integrations"])
