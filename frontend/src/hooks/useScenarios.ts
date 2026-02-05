import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/scenarios';
import type { ScenarioCreate, ForkRequest, CanonicalPayload } from '../types/scenario';

export const useScenarios = (params?: { study_id?: string }) =>
  useQuery({
    queryKey: ['scenarios', params],
    queryFn: () => api.listScenarios(params),
  });

export const useScenario = (id: string) =>
  useQuery({ queryKey: ['scenarios', id], queryFn: () => api.getScenario(id), enabled: !!id });

export const useCreateScenario = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ScenarioCreate) => api.createScenario(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  });
};

export const useDeleteScenario = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteScenario(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  });
};

export const useVersions = (scenarioId: string) =>
  useQuery({
    queryKey: ['scenarios', scenarioId, 'versions'],
    queryFn: () => api.listVersions(scenarioId),
    enabled: !!scenarioId,
  });

export const useLatestVersion = (scenarioId: string) =>
  useQuery({
    queryKey: ['scenarios', scenarioId, 'versions', 'latest'],
    queryFn: () => api.getLatestVersion(scenarioId).catch((err) => {
      // 404 means no versions exist yet — return undefined instead of throwing
      if (err?.response?.status === 404) return undefined;
      throw err;
    }),
    enabled: !!scenarioId,
    retry: (count, err) => {
      if ((err as { response?: { status?: number } })?.response?.status === 404) return false;
      return count < 2;
    },
  });

export const useVersion = (scenarioId: string, version: number) =>
  useQuery({
    queryKey: ['scenarios', scenarioId, 'versions', version],
    queryFn: () => api.getVersion(scenarioId, version),
    enabled: !!scenarioId && version > 0,
  });

export const useCreateVersion = (scenarioId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { label?: string; created_by?: string; payload: CanonicalPayload }) =>
      api.createVersion(scenarioId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scenarios', scenarioId, 'versions'] });
    },
  });
};

export const useForkVersion = (scenarioId: string, version: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ForkRequest) => api.forkVersion(scenarioId, version, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scenarios', scenarioId, 'versions'] });
    },
  });
};
