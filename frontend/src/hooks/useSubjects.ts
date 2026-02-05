import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/subjects';
import type { SubjectCreate, SubjectVisitCreate, DispenseRequest, KitReturnRequest } from '../types/subject';

export const useSubjects = (params?: { status?: string; cohort_id?: string; scenario_id?: string }) =>
  useQuery({ queryKey: ['subjects', params], queryFn: () => api.listSubjects(params) });

export const useSubject = (id: string) =>
  useQuery({ queryKey: ['subjects', id], queryFn: () => api.getSubject(id), enabled: !!id });

export const useCreateSubject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SubjectCreate) => api.createSubject(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
  });
};

export const useUpdateSubject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SubjectCreate> }) => api.updateSubject(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
  });
};

export const useVisits = (subjectId: string) =>
  useQuery({
    queryKey: ['subjects', subjectId, 'visits'],
    queryFn: () => api.listVisits(subjectId),
    enabled: !!subjectId,
  });

export const useCreateVisit = (subjectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SubjectVisitCreate) => api.createVisit(subjectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects', subjectId, 'visits'] }),
  });
};

export const useDispenseKit = (subjectId: string, visitId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DispenseRequest) => api.dispenseKit(subjectId, visitId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects', subjectId, 'visits'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
};

export const useKits = (subjectId: string, visitId: string) =>
  useQuery({
    queryKey: ['subjects', subjectId, 'visits', visitId, 'kits'],
    queryFn: () => api.listKits(subjectId, visitId),
    enabled: !!subjectId && !!visitId,
  });

export const useReturnKit = (subjectId: string, visitId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kitId, data }: { kitId: string; data: KitReturnRequest }) =>
      api.returnKit(subjectId, visitId, kitId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects', subjectId, 'visits'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
};
