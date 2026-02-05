import apiClient from './client';
import type { Shipment, ShipmentCreate, ShipmentAction } from '../types/shipment';

export const listShipments = (params?: { status?: string }) =>
  apiClient.get<Shipment[]>('/shipments', { params }).then((r) => r.data);

export const getShipment = (id: string) =>
  apiClient.get<Shipment>(`/shipments/${id}`).then((r) => r.data);

export const createShipment = (data: ShipmentCreate) =>
  apiClient.post<Shipment>('/shipments', data).then((r) => r.data);

export const approveShipment = (id: string, data?: ShipmentAction) =>
  apiClient.post<Shipment>(`/shipments/${id}/approve`, data ?? {}).then((r) => r.data);

export const pickShipment = (id: string, data?: ShipmentAction) =>
  apiClient.post<Shipment>(`/shipments/${id}/pick`, data ?? {}).then((r) => r.data);

export const shipShipment = (id: string, data?: ShipmentAction) =>
  apiClient.post<Shipment>(`/shipments/${id}/ship`, data ?? {}).then((r) => r.data);

export const receiveShipment = (id: string, data?: ShipmentAction) =>
  apiClient.post<Shipment>(`/shipments/${id}/receive`, data ?? {}).then((r) => r.data);
