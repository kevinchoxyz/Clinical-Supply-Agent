import apiClient from './client';
import type { SupplyPlanOut, SupplyPlanRequest } from '../types/supplyPlan';

export const generateSupplyPlan = (data: SupplyPlanRequest) =>
  apiClient.post<SupplyPlanOut>('/supply-plan/generate', data).then((r) => r.data);
