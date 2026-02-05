import apiClient from './client';
import type { Node, NodeCreate, Lot, LotCreate, Transaction, TransactionCreate, InventoryPosition } from '../types/inventory';

export const listNodes = (params?: { node_type?: string }) =>
  apiClient.get<Node[]>('/inventory/nodes', { params }).then((r) => r.data);

export const getNode = (id: string) =>
  apiClient.get<Node>(`/inventory/nodes/${id}`).then((r) => r.data);

export const createNode = (data: NodeCreate) =>
  apiClient.post<Node>('/inventory/nodes', data).then((r) => r.data);

export const updateNode = (id: string, data: Partial<NodeCreate>) =>
  apiClient.patch<Node>(`/inventory/nodes/${id}`, data).then((r) => r.data);

export const listLots = (params?: { node_id?: string; product_id?: string; status?: string }) =>
  apiClient.get<Lot[]>('/inventory/lots', { params }).then((r) => r.data);

export const getLot = (id: string) =>
  apiClient.get<Lot>(`/inventory/lots/${id}`).then((r) => r.data);

export const createLot = (data: LotCreate) =>
  apiClient.post<Lot>('/inventory/lots', data).then((r) => r.data);

export const updateLot = (id: string, data: { status?: string; qty_on_hand?: number; expiry_date?: string }) =>
  apiClient.patch<Lot>(`/inventory/lots/${id}`, data).then((r) => r.data);

export const listTransactions = (params?: { lot_id?: string; txn_type?: string }) =>
  apiClient.get<Transaction[]>('/inventory/transactions', { params }).then((r) => r.data);

export const createTransaction = (data: TransactionCreate) =>
  apiClient.post<Transaction>('/inventory/transactions', data).then((r) => r.data);

export const getPositions = () =>
  apiClient.get<InventoryPosition[]>('/inventory/positions').then((r) => r.data);
