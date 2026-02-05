import type { UUID } from './common';

export interface Subject {
  id: UUID;
  subject_number: string;
  scenario_id: UUID | null;
  cohort_id: string | null;
  arm_id: string | null;
  site_node_id: UUID | null;
  status: string;
  screened_at: string | null;
  enrolled_at: string | null;
  discontinued_at: string | null;
  completed_at: string | null;
  notes: string | null;
  attributes: Record<string, unknown> | null;
  created_at: string;
}

export interface SubjectCreate {
  subject_number: string;
  scenario_id?: UUID;
  cohort_id?: string;
  arm_id?: string;
  site_node_id?: string;
  status?: string;
  screened_at?: string;
  notes?: string;
  attributes?: Record<string, unknown>;
}

export interface SubjectVisit {
  id: UUID;
  subject_id: UUID;
  visit_id: string;
  scheduled_date: string | null;
  actual_date: string | null;
  status: string;
  notes: string | null;
}

export interface SubjectVisitCreate {
  visit_id: string;
  scheduled_date?: string;
  status?: string;
  notes?: string;
}

export interface KitAssignment {
  id: UUID;
  subject_visit_id: UUID;
  lot_id: UUID | null;
  product_id: string;
  presentation_id: string | null;
  qty_dispensed: number;
  dispensed_at: string | null;
  dispensed_by: string | null;
  returned_qty: number;
  returned_at: string | null;
}

export interface DispenseRequest {
  lot_id?: UUID;
  product_id: string;
  presentation_id?: string;
  qty_dispensed: number;
  dispensed_by?: string;
}

export interface KitReturnRequest {
  returned_qty: number;
}

export type SubjectStatus = 'SCREENED' | 'ENROLLED' | 'ACTIVE' | 'DISCONTINUED' | 'COMPLETED';
export type VisitStatus = 'SCHEDULED' | 'COMPLETED' | 'MISSED' | 'CANCELLED';
