import type { UUID } from './common';

export interface ShipmentItem {
  id: UUID;
  shipment_id: UUID;
  lot_id: UUID;
  product_id: string;
  presentation_id: string | null;
  qty: number;
}

export interface Shipment {
  id: UUID;
  from_node_id: UUID;
  to_node_id: UUID;
  status: string;
  lane_id: string | null;
  tracking_number: string | null;
  temperature_req: string | null;
  courier: string | null;
  notes: string | null;
  requested_by: string | null;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  shipped_at: string | null;
  received_at: string | null;
  items: ShipmentItem[];
}

export interface ShipmentCreate {
  from_node_id: string;
  to_node_id: string;
  items: { lot_id: UUID; product_id: string; presentation_id?: string; qty: number }[];
  lane_id?: string;
  temperature_req?: string;
  courier?: string;
  notes?: string;
  requested_by?: string;
}

export interface ShipmentAction {
  performed_by?: string;
  tracking_number?: string;
  notes?: string;
}

export type ShipmentStatus = 'REQUESTED' | 'APPROVED' | 'PICKED' | 'SHIPPED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
