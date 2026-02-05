import type { UUID } from './common';

export interface ForecastRun {
  id: UUID;
  scenario_version_id: UUID;
  engine_version: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  outputs: ForecastOutputs | null;
}

export interface ForecastOutputs {
  bucket_dates: string[];
  enrolled_per_bucket: number[];
  cumulative_enrolled: number[];
  demand_per_bucket: Record<string, number[]>;
  visits_per_bucket?: number[];
  [key: string]: unknown;
}

export interface ForecastRunCreateResponse {
  forecast_run_id: UUID;
  status: string;
  scenario_version_id: UUID;
  engine_version: string;
}

export interface ForecastCompare {
  scenario_id: UUID;
  a_version: number;
  b_version: number;
  bucket_dates: string[];
  delta_enrolled_per_bucket: number[];
  a_cumulative_enrolled: number[];
  b_cumulative_enrolled: number[];
  delta_demand: Record<string, number[]>;
  engine_version: string;
}
