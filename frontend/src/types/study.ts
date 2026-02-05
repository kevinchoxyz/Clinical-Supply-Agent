import type { UUID } from './common';

export interface VisitDoseLevel {
  dose_per_kg?: number;
  dose_value?: number;
  dose_uom: string;
  phase: string;
}

export interface StudyArm {
  arm_id: string;
  name?: string;
  randomization_weight?: number;
}

export interface CohortDoseSchedule {
  visits: Record<string, VisitDoseLevel>;
}

export interface DoseSchedule {
  cohorts: Record<string, CohortDoseSchedule>;
}

export type DosingStrategy = 'fixed' | 'weight_based' | 'loading_maintenance' | 'dose_escalation';

export interface StudyPayload {
  trial?: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  network_nodes?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  network_lanes?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visits?: any[];
  dose_schedule?: DoseSchedule;
  dosing_strategy?: DosingStrategy;
  arms?: StudyArm[];
  metadata?: Record<string, unknown>;
}

export interface Study {
  id: UUID;
  study_code: string;
  name: string;
  description: string | null;
  phase: string | null;
  protocol_version: string | null;
  countries: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface StudyDetail extends Study {
  payload: StudyPayload;
}

export interface StudyCreate {
  study_code: string;
  name: string;
  description?: string;
  phase?: string;
  protocol_version?: string;
  countries?: string[];
  payload?: StudyPayload;
}

export interface StudyUpdate {
  name?: string;
  description?: string;
  phase?: string;
  protocol_version?: string;
  countries?: string[];
  payload?: StudyPayload;
}
