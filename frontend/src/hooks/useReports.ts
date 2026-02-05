import { useMutation } from '@tanstack/react-query';
import * as api from '../api/reports';

export const useDownloadInventoryReport = () =>
  useMutation({ mutationFn: api.downloadInventoryReport });

export const useDownloadForecastReport = () =>
  useMutation({ mutationFn: (forecastRunId: string) => api.downloadForecastReport(forecastRunId) });

export const useDownloadExpiryRiskReport = () =>
  useMutation({ mutationFn: (params?: { days_threshold?: number }) => api.downloadExpiryRiskReport(params) });

export const useDownloadLotUtilReport = () =>
  useMutation({ mutationFn: api.downloadLotUtilReport });
