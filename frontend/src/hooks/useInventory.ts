import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/inventory';
import { useStudyContext } from '../context/StudyContext';
import type { NodeCreate, LotCreate, TransactionCreate, VialCreate } from '../types/inventory';

export const useNodes = (params?: { study_id?: string; node_type?: string }) => {
  const { selectedStudyId } = useStudyContext();
  const studyId = params?.study_id ?? selectedStudyId;
  return useQuery({
    queryKey: ['inventory', 'nodes', studyId, params?.node_type],
    queryFn: () => api.listNodes({ study_id: studyId || undefined, node_type: params?.node_type }),
  });
};

export const useNode = (id: string) =>
  useQuery({ queryKey: ['inventory', 'nodes', id], queryFn: () => api.getNode(id), enabled: !!id });

export const useCreateNode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NodeCreate) => api.createNode(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'nodes'] }),
  });
};

export const useDeleteNode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) => api.deleteNode(nodeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'nodes'] }),
  });
};

export const useBulkCreateNodes = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nodes: NodeCreate[]) => api.bulkCreateNodes(nodes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'nodes'] }),
  });
};

export const useLots = (params?: { study_id?: string; node_id?: string; product_id?: string; status?: string }) => {
  const { selectedStudyId } = useStudyContext();
  const studyId = params?.study_id ?? selectedStudyId;
  return useQuery({
    queryKey: ['inventory', 'lots', studyId, params?.node_id, params?.product_id, params?.status],
    queryFn: () => api.listLots({ study_id: studyId || undefined, ...params }),
  });
};

export const useLotDetail = (lotId: string) =>
  useQuery({
    queryKey: ['inventory', 'lot-detail', lotId],
    queryFn: () => api.getLotDetail(lotId),
    enabled: !!lotId,
  });

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

export const useDeleteLot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lotId: string) => api.deleteLot(lotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'lots'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'positions'] });
    },
  });
};

export const useBulkCreateLots = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lots: LotCreate[]) => api.bulkCreateLots(lots),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'lots'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'positions'] });
    },
  });
};

export const useVials = (lotId: string) =>
  useQuery({
    queryKey: ['inventory', 'vials', lotId],
    queryFn: () => api.listVials(lotId),
    enabled: !!lotId,
  });

export const useAddVial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lotId, data }: { lotId: string; data: VialCreate }) => api.addVial(lotId, data),
    onSuccess: (_, { lotId }) => {
      qc.invalidateQueries({ queryKey: ['inventory', 'vials', lotId] });
      qc.invalidateQueries({ queryKey: ['inventory', 'lot-detail', lotId] });
    },
  });
};

export const useDeleteVial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vialId: string) => api.deleteVial(vialId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'vials'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'lot-detail'] });
    },
  });
};

export const useTransactions = (params?: { study_id?: string; lot_id?: string; txn_type?: string }) => {
  const { selectedStudyId } = useStudyContext();
  const studyId = params?.study_id ?? selectedStudyId;
  return useQuery({
    queryKey: ['inventory', 'transactions', studyId, params?.lot_id, params?.txn_type],
    queryFn: () => api.listTransactions({ study_id: studyId || undefined, ...params }),
  });
};

export const useCreateTransaction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TransactionCreate) => api.createTransaction(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
};

export const usePositions = (params?: { study_id?: string }) => {
  const { selectedStudyId } = useStudyContext();
  const studyId = params?.study_id ?? selectedStudyId;
  return useQuery({
    queryKey: ['inventory', 'positions', studyId],
    queryFn: () => api.getPositions({ study_id: studyId || undefined }),
  });
};
