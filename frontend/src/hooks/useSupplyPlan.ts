import { useMutation } from '@tanstack/react-query';
import { generateSupplyPlan } from '../api/supplyPlan';
import type { SupplyPlanRequest } from '../types/supplyPlan';

export const useGenerateSupplyPlan = () =>
  useMutation({
    mutationFn: (data: SupplyPlanRequest) => generateSupplyPlan(data),
  });
