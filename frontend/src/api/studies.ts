import apiClient from './client';
import type { Study, StudyDetail, StudyCreate, StudyUpdate } from '../types/study';

export const listStudies = () =>
  apiClient.get<Study[]>('/studies').then((r) => r.data);

export const getStudy = (id: string) =>
  apiClient.get<StudyDetail>(`/studies/${id}`).then((r) => r.data);

export const createStudy = (data: StudyCreate) =>
  apiClient.post<Study>('/studies', data).then((r) => r.data);

export const updateStudy = (id: string, data: StudyUpdate) =>
  apiClient.patch<StudyDetail>(`/studies/${id}`, data).then((r) => r.data);

export const deleteStudy = (id: string) =>
  apiClient.delete(`/studies/${id}`).then((r) => r.data);
