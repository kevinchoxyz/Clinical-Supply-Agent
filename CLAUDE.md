# Clinical Supply Agent - Project Context

## Overview
A clinical trial supply chain forecasting and management application with:
- **Backend**: Python FastAPI with PostgreSQL (SQLAlchemy ORM)
- **Frontend**: React + TypeScript with Ant Design, React Query, Recharts

## Architecture

### Backend (`app/`)
```
app/
├── api/v1/           # FastAPI routers
│   ├── studies.py    # Study CRUD endpoints
│   ├── scenarios.py  # Scenario/Version CRUD + forecast endpoints
│   ├── forecast.py   # Forecast execution endpoints
│   └── ...
├── models/           # SQLAlchemy models
│   ├── study.py      # Study model
│   ├── scenario.py   # Scenario, ScenarioVersion, ForecastRun models
│   └── ...
├── schemas/          # Pydantic schemas
│   ├── study.py      # StudyPayload, StudyCreate, etc.
│   ├── canonical.py  # CanonicalPayload, Assumptions, EnrollmentCurve, etc.
│   └── scenarios.py  # ScenarioCreate, ScenarioVersionCreate, etc.
├── services/
│   └── forecast_engine.py  # Core forecasting logic
└── db/               # Database session management
```

### Frontend (`frontend/src/`)
```
frontend/src/
├── api/              # API client functions
│   ├── studies.ts
│   ├── scenarios.ts
│   └── ...
├── hooks/            # React Query hooks
│   ├── useStudies.ts
│   ├── useScenarios.ts
│   └── ...
├── types/            # TypeScript interfaces
│   ├── study.ts      # Study, StudyPayload, DosingStrategy, etc.
│   ├── scenario.ts   # Scenario, CanonicalPayload, EnrollmentCurve, etc.
│   └── ...
├── pages/
│   ├── Studies/
│   │   ├── index.tsx        # Study list page
│   │   └── StudyWizard.tsx  # Study creation/edit wizard
│   └── Scenarios/
│       ├── index.tsx        # Scenario list page
│       ├── ScenarioDetail.tsx
│       └── components/
│           └── ScenarioWizard.tsx  # Scenario creation wizard
└── utils/
    ├── excelParser.ts     # Excel file parsing
    └── excelTemplates.ts  # Excel template generation
```

## Key Data Models

### Study
- **study_code**: Unique identifier
- **payload**: JSON containing protocol-level data:
  - `trial`: Code, phase, countries
  - `products`: Drug/device definitions with presentations
  - `network_nodes` / `network_lanes`: Supply chain network
  - `visits`: Visit schedule with day offsets
  - `dose_schedule`: Per-cohort, per-visit dose levels
  - `dosing_strategy`: "fixed" | "weight_based" | "loading_maintenance" | "dose_escalation"
  - `arms`: Treatment arms with randomization weights
  - `dispense_rules`: Conditional dispensing logic

### Scenario
- Links to optional Study
- Has multiple **ScenarioVersion** records (versioned payloads)
- Payload (CanonicalPayload) includes:
  - `trial`, `products`, `network_nodes`, `network_lanes`
  - `study_design`: arms, cohorts, visits, arm_to_regimen, cohort_to_regimen
  - `regimens`: dose_rule, dose_inputs, visit_dispense mappings
  - `dispense_rules`
  - `assumptions`: enrollment_waves OR enrollment_curve, discontinuation, buffers, overage

### EnrollmentCurve (new)
```typescript
interface EnrollmentCurvePoint {
  period: number;        // Month number (1, 2, 3, ...)
  period_label?: string; // e.g. "Month 1"
  new_subjects: number;  // Subjects enrolled in this period
}

interface EnrollmentCurve {
  curve_type: string;           // "monthly_forecast"
  screen_fail_rate?: number;
  points: EnrollmentCurvePoint[];
}
```

## Recent Changes (Feb 2026)

### Phase 1: Study-Level Changes
- Added `dosing_strategy` field to StudyPayload: "fixed" | "weight_based" | "loading_maintenance" | "dose_escalation"
- Added `arms` array to StudyPayload (treatment arms with randomization weights)
- Made `dose_per_kg` optional in VisitDoseLevel, added `dose_value` for fixed dosing
- Renamed StudyWizard Step 5 from "Dose Schedule" to "Arms & Dosing"
- Arms table with Excel upload/download
- Dosing strategy selector
- Conditional dose columns (dose_value for fixed, dose_per_kg for weight-based)

### Phase 2: Scenario Step Reordering & Regimen Simplification
- **Full wizard order**: Select Study → Products → Study Design → Network → Visits → Regimens & Mapping → Assumptions → Review
- **With-study order**: Select Study → Study Design → Regimens & Mapping → Assumptions → Review
- Moved arm→regimen and cohort→regimen mapping from StudyDesignStep to Regimens steps
- Auto-populate arms/cohorts from study when selected
- Conditional regimen UI based on dosing_strategy:
  - Fixed: hides dose_rule editing, hides dose_inputs
  - Weight-based: shows dose_inputs (weight_kg_mean, weight_kg_sd)
- Shows study dose_schedule as read-only reference card

### Phase 3: Enrollment Curve
- New `EnrollmentCurvePoint` and `EnrollmentCurve` types (backend + frontend)
- Added `enrollment_curve` to Assumptions
- Enrollment mode toggle in Assumptions step: "Enrollment Curve (recommended)" vs "Manual Waves (legacy)"
- Excel upload/download for enrollment curve
- Backend `_enrollment_from_curve()` in forecast_engine.py converts monthly periods to weekly/monthly buckets

### Phase 4: Backend Merge Logic
- `_merge_study_into_payload()` now merges: arms, dosing_strategy, dispense_rules
- Auto-builds regimen dose_rules from study dose_schedule when cohort→regimen mapping exists

### Delete Functionality
- Backend DELETE endpoints: `/studies/{study_id}` (with linked scenario check), `/scenarios/{scenario_id}`
- Frontend hooks: `useDeleteStudy`, `useDeleteScenario`
- Delete buttons with Popconfirm on Studies and Scenarios list pages
- **Cascade deletes** properly configured (see Database Relationships below)

### Cascade Delete Relationships
When deleting a Scenario, all related data is automatically deleted:
```
Scenario (delete)
   ├── ScenarioVersions (cascade)
   │      └── ForecastRuns (cascade)
   └── Subjects (cascade)
          └── SubjectVisits (cascade)
                 └── KitAssignments (cascade)
```

Key model changes in `app/models/`:
- `scenario.py`: Added `subjects` relationship with `cascade="all, delete-orphan"`
- `scenario.py`: Added `forecast_runs` relationship on ScenarioVersion with cascade
- `subject.py`: Added `scenario` back-reference relationship

## Security Notes

### Current Setup (Local Development)
- All services run on `localhost` - only accessible from your machine
- Database: PostgreSQL on `localhost:5433`
- Backend API: FastAPI on `localhost:8000`
- Frontend: React on `localhost:3000`
- No internet exposure - ports are not open externally

### Sensitive Files (in .gitignore)
These files are excluded from git to protect confidential data:
- `scenarios/` - Trial scenario JSON files with protocol details
- `*.docx`, `*.pdf`, `*.xlsx` - Internal documents
- `.env` - Environment variables and secrets
- `.claude/` - Claude settings

### For Production Deployment
If deploying for team access, you must:
1. Change default passwords in `docker-compose.yml`
2. Set a real `JWT_SECRET_KEY` (not `change-me-in-production`)
3. Use HTTPS for encrypted connections
4. Configure proper firewall/VPN access

## Build Commands
```bash
# Frontend type check
cd frontend && npx tsc --noEmit

# Frontend production build
cd frontend && npx vite build

# Backend (FastAPI)
uvicorn app.main:app --reload
```

## File Locations for Common Tasks

### Adding new fields to Study
1. `app/schemas/study.py` - Add to StudyPayload
2. `frontend/src/types/study.ts` - Add to StudyPayload interface
3. `frontend/src/pages/Studies/StudyWizard.tsx` - Add form fields and buildPayload()

### Adding new fields to Scenario/Assumptions
1. `app/schemas/canonical.py` - Add to relevant model
2. `frontend/src/types/scenario.ts` - Add to interface
3. `frontend/src/pages/Scenarios/components/ScenarioWizard.tsx` - Add UI

### Adding Excel import/export
1. `frontend/src/utils/excelTemplates.ts` - Add `downloadXxxTemplate()`
2. `frontend/src/utils/excelParser.ts` - Add `parseXxx()`
3. Wire up in wizard with ExcelUploadModal

### Adding API endpoints
1. `app/api/v1/xxx.py` - Add route
2. `frontend/src/api/xxx.ts` - Add client function
3. `frontend/src/hooks/useXxx.ts` - Add React Query hook

### Inventory Enhancements (Feb 2026)

#### Study-Scoped Inventory
- Added `study_id` field to `InventoryNode` model
- All inventory data (nodes, lots, transactions, positions) now filterable by study
- Inventory page shows warning when no study selected
- Nodes, lots, transactions, positions all scoped to selected study

#### Delete Functionality
- DELETE endpoints for nodes: `DELETE /inventory/nodes/{node_id}`
- DELETE endpoints for lots: `DELETE /inventory/lots/{lot_id}`
- DELETE endpoints for vials: `DELETE /inventory/vials/{vial_id}`
- Frontend delete buttons with Popconfirm on nodes and lots

#### Individual Vial Tracking (medication_number)
- New `InventoryVial` model with unique `medication_number` per lot
- Vial statuses: AVAILABLE, DISPENSED, RETURNED, DESTROYED
- Lot detail endpoint: `GET /inventory/lots/{lot_id}/detail` returns lot info + vials
- Frontend "View Vials" button opens drill-down modal with:
  - Lot summary (product, qty, status, expiry)
  - Individual vials table (medication_number, status, dispensed_at)

#### Excel Upload/Download
- Nodes: Download template, upload bulk nodes with study_id
- Lots: Download template with columns: node_id, product_id, presentation_id, lot_number, qty_on_hand, status, expiry_date, medication_numbers
- medication_numbers column accepts comma-separated vial IDs (e.g., "MED001,MED002,MED003")
- Bulk upload endpoints: `POST /inventory/nodes/bulk`, `POST /inventory/lots/bulk`

#### Inventory Cascade Deletes
```
InventoryNode (delete)
   └── InventoryLot (cascade)
          ├── InventoryVial (cascade)
          └── InventoryTransaction (cascade)
```

## Testing Checklist
1. Study creation with dosing_strategy=weight_based, arms, cohorts, per-visit doses
2. Study creation with dosing_strategy=fixed, dose_value columns
3. Scenario with study: arms/cohorts auto-populated, simplified regimen UI, mapping in same step
4. Enrollment curve: Excel upload, preview table, forecast uses curve data
5. Backward compat: existing scenarios with enrollment_waves still work
6. Delete studies (blocked if has linked scenarios)
7. Delete scenarios (cascades to versions, forecast runs, subjects, visits, kit assignments)
8. Inventory: Select study → only nodes for that study appear
9. Inventory: Create node with study_id → appears in correct study's view
10. Inventory: Delete node → cascades to lots, vials, transactions
11. Inventory: Delete lot → cascades to vials, transactions
12. Inventory: Excel upload nodes → nodes created with study_id
13. Inventory: Excel upload lots with medication_numbers → lots and vials created
14. Inventory: "View Vials" on lot → modal shows individual medication numbers

## GitHub Repository
- **URL**: https://github.com/kevinchoxyz/Clinical-Supply-Agent
- **Branch**: master
- Code only - no confidential trial data or internal documents committed
