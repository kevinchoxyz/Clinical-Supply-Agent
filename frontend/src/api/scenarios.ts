import apiClient from './client';
import type { Scenario, ScenarioVersion, ScenarioVersionDetail, ScenarioCreate, ForkRequest, CanonicalPayload } from '../types/scenario';

export const listScenarios = (params?: { study_id?: string }) =>
  apiClient.get<Scenario[]>('/scenarios', { params }).then((r) => r.data);

export const getScenario = (id: string) =>
  apiClient.get<Scenario>(`/scenarios/${id}`).then((r) => r.data);

export const createScenario = (data: ScenarioCreate) =>
  apiClient.post<Scenario>('/scenarios', data).then((r) => r.data);

export const deleteScenario = (id: string) =>
  apiClient.delete(`/scenarios/${id}`).then((r) => r.data);

export const listVersions = (scenarioId: string) =>
  apiClient.get<ScenarioVersion[]>(`/scenarios/${scenarioId}/versions`).then((r) => r.data);

export const getLatestVersion = (scenarioId: string) =>
  apiClient.get<ScenarioVersionDetail>(`/scenarios/${scenarioId}/versions/latest`).then((r) => r.data);

export const getVersion = (scenarioId: string, version: number) =>
  apiClient.get<ScenarioVersionDetail>(`/scenarios/${scenarioId}/versions/${version}`).then((r) => r.data);

export const createVersion = (scenarioId: string, data: { label?: string; created_by?: string; payload: CanonicalPayload }) =>
  apiClient.post<ScenarioVersion>(`/scenarios/${scenarioId}/versions`, data).then((r) => r.data);

export const exportVersion = (scenarioId: string, version: number) =>
  apiClient.get(`/scenarios/${scenarioId}/versions/${version}/export`).then((r) => r.data);

export const forkVersion = (scenarioId: string, version: number, data: ForkRequest) =>
  apiClient.post<ScenarioVersion>(`/scenarios/${scenarioId}/versions/${version}/fork`, data).then((r) => r.data);
