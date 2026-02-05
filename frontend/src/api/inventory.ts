import apiClient from './client';
import type { Node, NodeCreate, Lot, LotCreate, LotWithVials, Vial, VialCreate, Transaction, TransactionCreate, InventoryPosition } from '../types/inventory';

export const listNodes = (params?: { study_id?: string; node_type?: string }) =>
  apiClient.get<Node[]>('/inventory/nodes', { params }).then((r) => r.data);

export const getNode = (id: string) =>
  apiClient.get<Node>(`/inventory/nodes/${id}`).then((r) => r.data);

export const createNode = (data: NodeCreate) =>
  apiClient.post<Node>('/inventory/nodes', data).then((r) => r.data);

export const updateNode = (id: string, data: Partial<NodeCreate>) =>
  apiClient.patch<Node>(`/inventory/nodes/${id}`, data).then((r) => r.data);

export const deleteNode = (nodeId: string) =>
  apiClient.delete(`/inventory/nodes/${nodeId}`);

export const bulkCreateNodes = (nodes: NodeCreate[]) =>
  apiClient.post<Node[]>('/inventory/nodes/bulk', { nodes }).then((r) => r.data);

export const listLots = (params?: { study_id?: string; node_id?: string; product_id?: string; status?: string }) =>
  apiClient.get<Lot[]>('/inventory/lots', { params }).then((r) => r.data);

export const getLot = (id: string) =>
  apiClient.get<Lot>(`/inventory/lots/${id}`).then((r) => r.data);

export const getLotDetail = (id: string) =>
  apiClient.get<LotWithVials>(`/inventory/lots/${id}/detail`).then((r) => r.data);

export const createLot = (data: LotCreate) =>
  apiClient.post<Lot>('/inventory/lots', data).then((r) => r.data);

export const updateLot = (id: string, data: { status?: string; qty_on_hand?: number; expiry_date?: string }) =>
  apiClient.patch<Lot>(`/inventory/lots/${id}`, data).then((r) => r.data);

export const deleteLot = (lotId: string) =>
  apiClient.delete(`/inventory/lots/${lotId}`);

export const bulkCreateLots = (lots: LotCreate[]) =>
  apiClient.post<Lot[]>('/inventory/lots/bulk', { lots }).then((r) => r.data);

export const listVials = (lotId: string) =>
  apiClient.get<Vial[]>(`/inventory/lots/${lotId}/vials`).then((r) => r.data);

export const addVial = (lotId: string, data: VialCreate) =>
  apiClient.post<Vial>(`/inventory/lots/${lotId}/vials`, data).then((r) => r.data);

export const deleteVial = (vialId: string) =>
  apiClient.delete(`/inventory/vials/${vialId}`);

export const listTransactions = (params?: { study_id?: string; lot_id?: string; txn_type?: string }) =>
  apiClient.get<Transaction[]>('/inventory/transactions', { params }).then((r) => r.data);

export const createTransaction = (data: TransactionCreate) =>
  apiClient.post<Transaction>('/inventory/transactions', data).then((r) => r.data);

export const getPositions = (params?: { study_id?: string }) =>
  apiClient.get<InventoryPosition[]>('/inventory/positions', { params }).then((r) => r.data);
