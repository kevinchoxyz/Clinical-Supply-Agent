import apiClient from './client';
import type { ForecastRun, ForecastRunCreateResponse, ForecastCompare } from '../types/forecast';

export const runForecast = (data: { scenario_id: string; version?: number }) =>
  apiClient.post<ForecastRunCreateResponse>('/forecast/run', data).then((r) => r.data);

export const getForecastRun = (runId: string) =>
  apiClient.get<ForecastRun>(`/forecast/runs/${runId}`).then((r) => r.data);

export const compareForecast = (params: { scenario_id: string; a: number; b: number }) =>
  apiClient.get<ForecastCompare>('/forecast/compare', { params }).then((r) => r.data);
