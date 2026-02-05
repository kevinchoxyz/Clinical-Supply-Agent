import { useQuery, useMutation } from '@tanstack/react-query';
import * as api from '../api/forecast';

export const useRunForecast = () =>
  useMutation({
    mutationFn: (data: { scenario_id: string; version?: number }) => api.runForecast(data),
  });

export const useForecastRun = (runId: string) =>
  useQuery({
    queryKey: ['forecast', 'runs', runId],
    queryFn: () => api.getForecastRun(runId),
    enabled: !!runId,
  });

export const useForecastCompare = (params: { scenario_id: string; a: number; b: number }) =>
  useQuery({
    queryKey: ['forecast', 'compare', params],
    queryFn: () => api.compareForecast(params),
    enabled: !!params.scenario_id && params.a > 0 && params.b > 0,
  });
