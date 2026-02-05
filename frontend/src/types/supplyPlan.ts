import type { UUID } from './common';

export interface SupplyPlanRequest {
  scenario_version_id: UUID;
  inventory_snapshot?: Record<string, unknown>[];
}

export interface PlannedShipment {
  sku: string;
  order_bucket_index: number;
  order_date: string | null;
  delivery_bucket_index: number;
  delivery_date: string | null;
  qty: number;
  reason: string;
}

export interface StockoutAlert {
  sku: string;
  stockout_bucket_index: number;
  stockout_date: string | null;
  deficit: number;
}

export interface SafetyStockInfo {
  depot_safety_stock: number;
  site_safety_stock: number;
  reorder_point: number;
}

export interface SupplyPlanOut {
  bucket_dates: string[];
  projected_inventory: Record<string, number[]>;
  starting_inventory: Record<string, number>;
  reorder_points: Record<string, number>;
  safety_stock: Record<string, SafetyStockInfo>;
  planned_shipments: PlannedShipment[];
  stockout_alerts: StockoutAlert[];
  parameters: Record<string, unknown>;
}
