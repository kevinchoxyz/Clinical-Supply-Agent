import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/studies';
import type { StudyCreate, StudyUpdate } from '../types/study';

export const useStudies = () =>
  useQuery({ queryKey: ['studies'], queryFn: api.listStudies });

export const useStudy = (id: string) =>
  useQuery({
    queryKey: ['studies', id],
    queryFn: () => api.getStudy(id),
    enabled: !!id,
  });

export const useCreateStudy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StudyCreate) => api.createStudy(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studies'] }),
  });
};

export const useUpdateStudy = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StudyUpdate) => api.updateStudy(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['studies'] });
      qc.invalidateQueries({ queryKey: ['studies', id] });
    },
  });
};

export const useDeleteStudy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteStudy(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studies'] }),
  });
};
