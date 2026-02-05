import type { UUID } from './common';

export interface Scenario {
  id: UUID;
  trial_code: string;
  name: string;
  description: string | null;
  study_id: string | null;
  created_at: string;
}

export interface ScenarioVersion {
  id: UUID;
  scenario_id: UUID;
  version: number;
  label: string | null;
  created_by: string | null;
  created_at: string;
  payload_hash: string;
}

export interface ScenarioVersionDetail extends ScenarioVersion {
  payload: CanonicalPayload;
}

export interface CanonicalPayload {
  schema_version?: string;
  trial?: TrialInfo;
  scenario: ScenarioMeta;
  scenario_version?: { version?: number; label?: string };
  network_nodes: NetworkNode[];
  network_lanes: NetworkLane[];
  products: Product[];
  study_design?: StudyDesign;
  regimens: Regimen[];
  dispense_rules: DispenseRule[];
  assumptions: Assumptions;
  starting_inventory?: { as_of_date?: string; items: InventoryItem[] };
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface TrialInfo {
  code: string;
  phase?: string;
  protocol_version?: string;
  countries: string[];
}

export interface ScenarioMeta {
  trial_code: string;
  name?: string;
  scenario_name?: string;
  scenario_description?: string;
  description?: string;
  start_date?: string;
  forecast_bucket?: string;
  horizon_buckets?: number;
}

export interface NetworkNode {
  node_id: string;
  node_type: string;
  name?: string;
  country?: string;
  activation_date?: string;
  attributes: Record<string, unknown>;
}

export interface NetworkLane {
  lane_id: string;
  from_node_id: string;
  to_node_id: string;
  default_lead_time_days: number;
  mode?: string;
}

export interface Presentation {
  presentation_id: string;
  uom: string;
  attributes: Record<string, unknown>;
}

export interface Product {
  product_id: string;
  name?: string;
  product_type?: string;
  inventory_uom: string;
  presentations: Presentation[];
  attributes: Record<string, unknown>;
}

export interface Arm {
  arm_id: string;
  name?: string;
  randomization_weight: number;
}

export interface Cohort {
  cohort_id: string;
  name?: string;
  max_participants?: number;
  attributes: Record<string, unknown>;
}

export interface VisitDef {
  visit_id: string;
  day_offset: number;
  cycle_number?: number;
  cycle_day?: number;
  is_dosing_event: boolean;
  attributes: Record<string, unknown>;
}

export interface StudyDesign {
  arms: Arm[];
  cohorts: Cohort[];
  visits: VisitDef[];
  arm_to_regimen: Record<string, string>;
  cohort_to_regimen: Record<string, string>;
}

export interface DoseTableRow {
  visit_id: string;
  per_kg_value?: number;
  per_kg_uom?: string;
  dose_value?: number;
  dose_uom?: string;
}

export interface DoseRule {
  type: string;
  dose_value?: number;
  dose_uom?: string;
  rows: DoseTableRow[];
}

export interface Regimen {
  regimen_id: string;
  name?: string;
  dose_rule?: DoseRule;
  dose_inputs: Record<string, unknown>;
  visit_dispense: Record<string, string>;
  attributes: Record<string, unknown>;
}

export interface DispenseItem {
  product_id: string;
  presentation_id?: string;
  qty?: number;
  calc?: string;
  notes?: string;
}

export interface DispenseCondition {
  field?: string;
  op?: string;    // '<' | '<=' | '>' | '>=' | '==' | '!='
  value?: number;
}

export interface DispenseConditionBranch {
  if: DispenseCondition[];
  then: { dispense: DispenseItem[] };
}

export interface DispenseRuleBody {
  type: string;  // 'conditional' | 'vial_optimization'
  // conditional fields
  conditions?: DispenseConditionBranch[];
  default?: { dispense: DispenseItem[] };
  // vial_optimization fields
  product_id?: string;
  allowed_presentations?: string[];
  dose_uom?: string;
}

export interface DispenseRule {
  dispense_rule_id: string;
  name?: string;
  rule?: DispenseRuleBody;
}

export interface EnrollmentWave {
  wave_id?: string;
  node_ids: string[];
  start_date?: string;
  end_date?: string;
  start_bucket_index?: number;
  end_bucket_index?: number;
  bucket?: string;
  enrollment_rate_per_bucket?: number;
  screen_fail_rate?: number;
  replacement_rate?: number;
}

export interface EnrollmentCurvePoint {
  period: number;
  period_label?: string;
  new_subjects: number;
}

export interface EnrollmentCurve {
  curve_type: string;
  screen_fail_rate?: number;
  points: EnrollmentCurvePoint[];
}

export interface Assumptions {
  start_date?: string;
  end_date?: string;
  forecast_bucket?: string;
  method?: string;
  monte_carlo_n?: number;
  enrollment_waves: EnrollmentWave[];
  enrollment_curve?: EnrollmentCurve;
  enrollment_rate_per_bucket?: number;
  visit_schedule?: Record<string, unknown>;
  demand_rules?: Record<string, unknown>;
  discontinuation?: Record<string, unknown>;
  buffers?: Record<string, unknown>;
  lead_time_overrides: unknown[];
  global_overage_factor?: number;
  notes?: string;
}

export interface InventoryItem {
  node_id: string;
  product_id: string;
  presentation_id?: string;
  lot_number?: string;
  expiry_date?: string;
  status?: string;
  qty: number;
}

export interface ScenarioCreate {
  trial_code: string;
  name: string;
  description?: string;
  study_id?: string | null;
}

export interface ForkRequest {
  label?: string;
  created_by?: string;
  override: Record<string, unknown>;
}
