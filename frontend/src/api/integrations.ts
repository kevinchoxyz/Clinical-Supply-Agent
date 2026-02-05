import apiClient from './client';

export const importIrtSubjects = (data: Record<string, unknown>) =>
  apiClient.post('/integrations/irt/import-subjects', data).then((r) => r.data);

export const wmsReceipt = (data: Record<string, unknown>) =>
  apiClient.post('/integrations/wms/receipt', data).then((r) => r.data);

export const courierUpdate = (data: Record<string, unknown>) =>
  apiClient.post('/integrations/courier/update', data).then((r) => r.data);
