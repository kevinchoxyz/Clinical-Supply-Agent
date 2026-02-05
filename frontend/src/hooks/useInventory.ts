import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/inventory';
import type { NodeCreate, LotCreate, TransactionCreate } from '../types/inventory';

export const useNodes = (params?: { node_type?: string }) =>
  useQuery({ queryKey: ['inventory', 'nodes', params], queryFn: () => api.listNodes(params) });

export const useNode = (id: string) =>
  useQuery({ queryKey: ['inventory', 'nodes', id], queryFn: () => api.getNode(id), enabled: !!id });

export const useCreateNode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NodeCreate) => api.createNode(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'nodes'] }),
  });
};

export const useLots = (params?: { node_id?: string; product_id?: string; status?: string }) =>
  useQuery({ queryKey: ['inventory', 'lots', params], queryFn: () => api.listLots(params) });

export const useCreateLot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LotCreate) => api.createLot(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'lots'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'positions'] });
    },
  });
};

export const useTransactions = (params?: { lot_id?: string; txn_type?: string }) =>
  useQuery({ queryKey: ['inventory', 'transactions', params], queryFn: () => api.listTransactions(params) });

export const useCreateTransaction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TransactionCreate) => api.createTransaction(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
};

export const usePositions = () =>
  useQuery({ queryKey: ['inventory', 'positions'], queryFn: api.getPositions });
