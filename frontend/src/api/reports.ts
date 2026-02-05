import apiClient from './client';

const downloadBlob = (data: Blob, filename: string) => {
  const url = window.URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

export const downloadInventoryReport = async () => {
  const resp = await apiClient.get('/reports/inventory/csv', { responseType: 'blob' });
  downloadBlob(resp.data, `inventory_${Date.now()}.csv`);
};

export const downloadForecastReport = async (forecastRunId: string) => {
  const resp = await apiClient.get(`/reports/forecast/${forecastRunId}/csv`, { responseType: 'blob' });
  downloadBlob(resp.data, `forecast_${forecastRunId}.csv`);
};

export const downloadExpiryRiskReport = async (params?: { days_threshold?: number }) => {
  const resp = await apiClient.get('/reports/expiry-risk/csv', { params, responseType: 'blob' });
  downloadBlob(resp.data, `expiry_risk_${Date.now()}.csv`);
};

export const downloadLotUtilReport = async () => {
  const resp = await apiClient.get('/reports/lot-util/csv', { responseType: 'blob' });
  downloadBlob(resp.data, `lot_utilization_${Date.now()}.csv`);
};
