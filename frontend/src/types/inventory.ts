import type { UUID } from './common';

export interface Node {
  id: UUID;
  node_id: string;
  node_type: string;
  name: string | null;
  country: string | null;
  is_active: boolean;
  study_id: UUID | null;
  attributes: Record<string, unknown> | null;
  created_at: string;
}

export interface NodeCreate {
  node_id: string;
  node_type: string;
  name?: string;
  country?: string;
  study_id?: string;
  attributes?: Record<string, unknown>;
}

export interface Lot {
  id: UUID;
  node_id: UUID;
  product_id: string;
  presentation_id: string | null;
  lot_number: string;
  expiry_date: string | null;
  status: string;
  qty_on_hand: number;
  created_at: string;
  updated_at: string;
}

export interface VialCreate {
  medication_number: string;
  status?: string;
}

export interface Vial {
  id: UUID;
  lot_id: UUID;
  medication_number: string;
  status: string;
  dispensed_at: string | null;
  dispensed_to_subject_id: UUID | null;
  created_at: string;
}

export interface LotCreate {
  node_id: string;
  product_id: string;
  presentation_id?: string;
  lot_number: string;
  expiry_date?: string;
  status?: string;
  qty_on_hand?: number;
  vials?: VialCreate[];
}

export interface LotWithVials extends Lot {
  vials: Vial[];
  vial_count: number;
  available_count: number;
}

export interface Transaction {
  id: UUID;
  lot_id: UUID;
  txn_type: string;
  qty: number;
  from_node_id: UUID | null;
  to_node_id: UUID | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TransactionCreate {
  lot_id: UUID;
  txn_type: string;
  qty: number;
  from_node_id?: UUID;
  to_node_id?: UUID;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_by?: string;
}

export interface InventoryPosition {
  node_id: string;
  node_name: string | null;
  product_id: string;
  presentation_id: string | null;
  total_qty: number;
  lot_count: number;
  earliest_expiry: string | null;
}
