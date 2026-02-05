# Clinical Supply Planning — User Guide

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Login & Registration](#2-login--registration)
3. [Dashboard](#3-dashboard)
4. [Scenarios](#4-scenarios)
5. [Forecast Engine](#5-forecast-engine)
6. [Inventory Management](#6-inventory-management)
7. [Supply Plan](#7-supply-plan)
8. [Shipments](#8-shipments)
9. [Subjects](#9-subjects)
10. [Reports](#10-reports)
11. [Administration](#11-administration)

---

## 1. Getting Started

### Prerequisites

- The FastAPI backend must be running on `http://localhost:8000`
- Node.js 18+ installed

### Starting the Frontend

```bash
cd frontend
npm install
npm run dev
```

The app launches at **http://localhost:3000**. You'll be redirected to the login page if not authenticated.

### Navigation

The app has a **collapsible sidebar** on the left with links to all feature areas. The sidebar shows:

- Dashboard
- Scenarios
- Forecast
- Inventory
- Supply Plan
- Shipments
- Subjects
- Reports
- Admin

Click the **hamburger icon** in the top-left header to collapse/expand the sidebar.

Your **username and role** are shown in the top-right corner. Click it to sign out.

---

## 2. Login & Registration

### Sign In

1. Open `http://localhost:3000` — you'll land on the login page
2. You'll see a centered card on a purple gradient background with two tabs: **Sign In** and **Register**
3. Enter your **Username** and **Password**
4. Click **Sign In**
5. On success, you'll be redirected to the Dashboard

If credentials are wrong, a red error banner appears above the form.

### Register a New Account

1. Click the **Register** tab on the login card
2. Fill in:
   - **Username** (min 3 characters)
   - **Email** (valid email format)
   - **Password** (min 8 characters)
   - **Confirm Password** (must match)
   - **Role** — select from:
     - **Admin** — Full access to all features
     - **Supply Chain** — Inventory, shipments, supply planning
     - **Site** — Subject management, dispensing
     - **Read Only** — View-only access
3. Click **Create Account**
4. On success, you'll see a green notification. Switch to the **Sign In** tab to log in.

---

## 3. Dashboard

The Dashboard is the landing page after login. It provides an at-a-glance overview of your clinical supply chain.

### KPI Cards (Top Row)

Four clickable statistic cards:

| Card | Shows | Clicks to |
|------|-------|-----------|
| **Active Scenarios** | Count of scenarios | /scenarios |
| **Forecast Runs** | Count indicator | /forecast |
| **Inventory Units** | Total units across all positions | /inventory |
| **Pending Shipments** | Shipments in REQUESTED status | /shipments |

### Enrollment Chart

A line chart showing enrollment trends from the latest forecast run. If no forecast has been run yet, you'll see a message prompting you to run one.

### Stockout Alerts

An alerts panel on the right side. After generating a supply plan, any stockout risks will appear here as red alert cards. Before that, you'll see an informational message.

### Recent Activity

A timeline at the bottom showing the most recent audit log entries — who did what and when.

### Quick Actions

Two buttons in the top-right:
- **Create Scenario** — opens the scenario wizard
- **Run Forecast** — navigates to the forecast page

---

## 4. Scenarios

Scenarios are the foundation of supply planning. Each scenario defines a clinical trial's parameters — arms, cohorts, products, network, visit schedules, and enrollment assumptions.

### Scenario List

**Path:** `/scenarios`

A table showing all scenarios with columns:
- Name, Trial Code, Description, Created date, Actions

**To create a new scenario:**

1. Click **Create Scenario** button (top-right)
2. A modal appears with three fields:
   - **Trial Code** (e.g., `TRIAL-001`) — required
   - **Scenario Name** (e.g., `Base Case`) — required
   - **Description** — optional
3. Click **Create**
4. The scenario appears in the table

Click any row to view its details.

### Scenario Detail

**Path:** `/scenarios/:id`

Three tabs:

#### Overview Tab
Shows scenario metadata:
- Trial Code, Name, Description, Created date, Latest version number

#### Versions Tab
A vertical timeline of all scenario versions. Each entry shows:
- Version number (e.g., v1, v2)
- Label (if provided)
- Creator name
- Creation date
- Payload hash (first 8 characters)

Each version has three action buttons:
- **View** — view version details
- **Fork** — create a new version based on this one with overrides
- **Export** — download the version payload as JSON

#### Forecast Tab
A link to run a forecast based on this scenario.

### Creating a Version (8-Step Wizard)

**Path:** `/scenarios/new` or `/scenarios/new?scenarioId=<existing-id>`

Click **New Version** from the scenario detail page, or **Create Scenario** from the dashboard.

The wizard has 8 steps with Previous/Next navigation at the bottom:

#### Step 1: Trial Info
- **Trial Code** — e.g., `CBX-250-001`
- **Phase** — dropdown: P1, P1A, P1B, P2, P2A, P2B, P3, P4
- **Countries** — tag input (type and press Enter to add)
- **Start Date** — date picker
- **Forecast Bucket** — WEEK or MONTH
- **Horizon Buckets** — number of time periods to forecast

#### Step 2: Study Design
Two editable tables:
- **Arms Table** — columns: Arm ID, Name, Randomization Weight. Click "Add Arm" to add rows. Click the delete icon to remove.
- **Cohorts Table** — columns: Cohort ID, Name, Max Participants. Click "Add Cohort" to add rows.

#### Step 3: Products
Add product definitions:
- **Product ID**, **Name**, **Type**, **UOM**
- Each product can have **Presentations** (nested table): Presentation ID, UOM
- Click "Add Product" for each new product, "Add Presentation" within a product

#### Step 4: Network
Two sections:
- **Nodes** — define depot and site nodes: Node ID, Type (DEPOT/SITE), Name, Country
- **Lanes** — define shipping lanes between nodes: Lane ID, From Node, To Node, Lead Time (days)

#### Step 5: Visits
A table of visit definitions:
- **Visit ID** (e.g., `SCREENING`, `VISIT-1`)
- **Day Offset** — days from enrollment
- **Is Dosing Event** — toggle switch

#### Step 6: Regimens
Define dosing regimens:
- **Regimen ID**, **Name**
- **Dose Rule Type** — e.g., `fixed`
- **Dose Value** and **UOM**

#### Step 7: Assumptions
- **Enrollment Waves** — each wave defines: Wave ID, Node IDs, Enrollment Rate, Screen Fail Rate
- **Discontinuation Rate**
- **Global Overage Factor**
- **Notes**

#### Step 8: Review
A collapsible JSON tree showing the complete payload. Review everything, then click **Submit**.

On success, you're redirected to the scenario detail page.

### Forking a Version

1. Go to the **Versions** tab on a scenario detail page
2. Click **Fork** on any version
3. A modal appears with:
   - **Version Label** — e.g., "High Enrollment Sensitivity"
   - **Payload Override (JSON)** — a JSON merge patch that overrides specific fields
     ```json
     { "assumptions": { "global_overage_factor": 1.5 } }
     ```
4. Click **Fork** — a new version is created

---

## 5. Forecast Engine

### Running a Forecast

**Path:** `/forecast`

1. Select a **Scenario** from the dropdown
2. Optionally select a specific **Version** (defaults to latest)
3. Click **Run Forecast**
4. You'll be redirected to the results page

### Forecast Results

**Path:** `/forecast/:runId`

A status badge shows the run state: RUNNING, SUCCESS, or FAILED.

Three tabs (visible when status is SUCCESS):

#### Demand Tab
A **multi-line chart** showing demand over time:
- X-axis: time buckets (dates)
- Y-axis: units demanded
- Each SKU is a separate colored line
- Hover over any point to see exact values in a tooltip

#### Enrollment Tab
An **area chart** showing cumulative enrollment:
- X-axis: time buckets
- Y-axis: total enrolled subjects
- Blue filled area with line

#### Visits Tab
A **table** with columns:
- Bucket (date), Visits count, New Enrolled count

### Comparing Forecasts

**Path:** `/forecast/compare`

1. Click **Compare Versions** from the forecast page
2. Select a **Scenario**
3. Select **Version A** and **Version B**
4. Two charts appear:
   - **Enrollment Comparison** — two overlaid line charts (blue = Version A, orange = Version B)
   - **Delta Demand** — bar chart showing the difference in demand per SKU between versions

---

## 6. Inventory Management

**Path:** `/inventory`

Four tabs across the top:

### Nodes Tab

A card grid showing all inventory nodes (depots and sites):
- Each card shows: node name, type badge (blue for DEPOT, green for SITE), country, active status, creation date
- Click **Add Node** to create a new one:
  - Node ID (e.g., `DEPOT-US-01`)
  - Type: DEPOT or SITE
  - Name, Country

### Lots Tab

A filterable table of inventory lots:
- **Filters**: Status dropdown (RELEASED / QUARANTINE / EXPIRED), Product ID text search
- **Columns**: Lot Number, Product ID, Presentation, Node, Qty on Hand, Status (color badge), Expiry Date, Created

Click **Add Lot** to create:
- Node ID, Product ID, Presentation ID, Lot Number, Qty on Hand, Status, Expiry Date

### Transactions Tab

A timestamped log of all inventory movements:
- **Filter**: Transaction type dropdown (RECEIPT, ISSUE, TRANSFER_OUT, TRANSFER_IN, RETURN, ADJUSTMENT)
- **Columns**: Type (badge), Lot ID, Qty, From Node, To Node, Reference, Notes, Created By, Created At
- Sorted newest first

### Positions Tab

Aggregated inventory view:
- **Two pie charts** side by side:
  - Left: inventory by product (% of total units per product)
  - Right: inventory by node (% of total units per node)
- **Summary table** below: Node, Product, Presentation, Total Qty, Lot Count, Earliest Expiry

---

## 7. Supply Plan

**Path:** `/supply-plan`

### Generating a Plan

1. Select a **Scenario** from the dropdown
2. Select a **Version**
3. Click **Generate Plan**

### Results (4 sections)

#### Projected Inventory Chart
An area chart showing projected inventory levels over time:
- Each SKU is a separate colored area
- Dashed horizontal lines indicate the **reorder point** for each SKU
- When inventory dips below the reorder line, a replenishment is triggered

#### Stockout Alerts
Red alert cards (only shown if stockouts are predicted):
- Each card shows: SKU name, stockout date, deficit quantity
- Warning icon indicator

#### Safety Stock Table
A table with columns:
- SKU, Depot Safety Stock, Site Safety Stock, Reorder Point

#### Planned Shipments Table
A table of recommended shipments:
- SKU, Order Date, Delivery Date, Quantity, Reason (e.g., "Safety stock replenishment")

---

## 8. Shipments

**Path:** `/shipments`

### View Modes

Toggle between two views using the radio buttons in the top-right:

#### Kanban View (Default)
Five columns representing the shipment lifecycle:

| Column | Color | Status |
|--------|-------|--------|
| Requested | Blue | REQUESTED |
| Approved | Cyan | APPROVED |
| Picked | Geekblue | PICKED |
| Shipped/In Transit | Orange | SHIPPED, IN_TRANSIT |
| Received | Green | RECEIVED |

Each shipment appears as a small card showing:
- Truncated ID
- Item count
- Requested date
- An action button to advance to the next status

Click any card to view full details.

#### Table View
A standard table with columns:
- ID, Status (badge), Items count, Courier, Requested date, Actions

### Creating a Shipment

1. Click **Create Shipment** (top-right)
2. A 3-step wizard modal appears:

**Step 1 — Select Nodes:**
- From Node (dropdown of all nodes)
- To Node (dropdown of all nodes)

**Step 2 — Add Items:**
- Click **Add Item** for each line
- Select a Lot (dropdown showing lot number and product)
- Product ID auto-fills from the selected lot
- Enter Quantity
- Repeat for multiple items

**Step 3 — Review:**
- Optional fields: Lane ID, Courier, Temperature Requirement, Notes
- Click **Create**

### Shipment Detail

**Path:** `/shipments/:id`

- **Lifecycle Steps**: A horizontal step indicator showing: Requested → Approved → Picked → Shipped → Received. The current step is highlighted. Timestamps and actors appear below each completed step.
- **Details Card**: From/To nodes, status, lane, tracking number, courier, temperature, notes
- **Items Table**: Lot ID, Product, Presentation, Quantity
- **Action Button**: Based on current status, a single button appears to advance (e.g., "Approve", "Pick", "Ship", "Receive") with a confirmation popup

### Advancing a Shipment

You can advance shipments from either the Kanban cards or the Detail page:

1. **REQUESTED → APPROVED**: Click "Approve"
2. **APPROVED → PICKED**: Click "Pick"
3. **PICKED → SHIPPED**: Click "Ship"
4. **SHIPPED/IN_TRANSIT → RECEIVED**: Click "Receive"

Each action triggers a confirmation. On success, the shipment moves to the next column/status.

---

## 9. Subjects

### Subject List

**Path:** `/subjects`

- **Status Filter**: Radio buttons at top — All, SCREENED, ENROLLED, ACTIVE, COMPLETED, DISCONTINUED
- **Table Columns**: Subject #, Cohort, Arm, Site, Status (badge), Screened date, Enrolled date

Click any row to view the subject detail.

### Enrolling a Subject

1. Click **Enroll Subject** (top-right)
2. Fill in the modal:
   - **Subject Number** (required) — e.g., `SUBJ-001`
   - **Scenario** — dropdown of available scenarios
   - **Cohort ID** — e.g., `COHORT-1`
   - **Arm ID** — e.g., `ARM-A`
   - **Site Node ID** — the logical node ID of the clinical site
   - **Notes**
3. Click **OK**

### Subject Detail

**Path:** `/subjects/:id`

#### Subject Information Card
Displays: Subject #, Status, Cohort, Arm, Site, Screened/Enrolled dates, Notes

#### Visit Timeline
A horizontal step component showing all visits in order:
- Each step shows: Visit ID, status badge, scheduled date
- Green = COMPLETED, Blue = SCHEDULED, Red = MISSED
- Click any visit step to select it and see details below

#### Scheduling a Visit
1. Click **Schedule Visit** (top-right)
2. Enter: Visit ID, Scheduled Date, Notes
3. Click **OK**

#### Dispensing a Kit
1. Click a visit in the timeline to select it
2. The visit detail panel appears below
3. Click **Dispense Kit**
4. Fill in:
   - **Product ID** (required)
   - **Lot** — dropdown showing available lots with quantity
   - **Quantity** (required)
   - **Dispensed By** — your username
5. Click **OK**
6. The kit assignment appears in the table below
7. Inventory is automatically reduced

#### Returning a Kit
1. In the kit assignments table, find the kit to return
2. Click the **Return** button (only visible if returned qty < dispensed qty)
3. Enter the **Return Quantity**
4. Click **OK**
5. Inventory is automatically credited back

---

## 10. Reports

**Path:** `/reports`

Four report cards, each with a description and download button:

### Inventory Report
- Exports current inventory positions across all nodes and lots
- Click **Download CSV** — file downloads immediately

### Forecast Report
- Exports demand forecast results by SKU and time bucket
- Enter a **Forecast Run ID** (from a previous forecast run)
- Click **Download CSV**

### Expiry Risk Report
- Exports lots approaching expiration
- Adjust the **Days Threshold** slider (7–365 days, default 90)
- Click **Download CSV** — includes all lots expiring within that window

### Lot Utilization Report
- Exports lot usage and turnover metrics
- Click **Download CSV**

All reports download as timestamped CSV files.

---

## 11. Administration

**Path:** `/admin`

Three tabs (Admin role required for full access):

### Users Tab
A table of all registered users:
- **Username**, **Email**
- **Role** — color-coded tag (Admin=red, Supply Chain=blue, Site=green, Read Only=gray)
- **Active** — green/red status badge
- **Tenant**, **Created date**

### Audit Log Tab
A filterable, searchable log of all system actions:
- **Filters**: Action dropdown, Resource Type dropdown
- **Columns**: Action (tag), Resource Type, Resource ID, Username, IP Address, Created date
- **Expandable rows**: Click the expand arrow to see the full JSON details of each audit entry

### Integrations Tab
Three status cards for external system connections:
- **IRT** — Interactive Response Technology subject import
- **WMS** — Warehouse Management System receipt integration
- **Courier** — Courier tracking and shipment status updates

Each card shows whether the integration is configured or not.

---

## Typical Workflow

Here is a recommended end-to-end workflow:

1. **Register** an admin account and log in
2. **Create a Scenario** with trial parameters using the 8-step wizard
3. **Run a Forecast** to generate demand projections
4. **Set up Inventory** — create depot/site nodes and add lots
5. **Generate a Supply Plan** to see projected inventory and stockout risks
6. **Create Shipments** to move supplies from depots to sites
7. **Advance shipments** through the lifecycle (approve → pick → ship → receive)
8. **Enroll Subjects** and schedule visits
9. **Dispense kits** during visits and process returns
10. **Download Reports** for analysis and compliance
11. **Review Audit Logs** in the Admin panel

---

## Keyboard Shortcuts & Tips

- **Collapse sidebar**: Click the hamburger icon (top-left)
- **Search in dropdowns**: All Select components support type-to-search
- **Sort tables**: Click any column header with sort arrows
- **Filter tables**: Use the filter dropdowns above each table
- **Navigate back**: Use breadcrumbs at the top of detail pages
