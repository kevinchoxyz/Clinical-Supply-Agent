import apiClient from './client';
import type { Subject, SubjectCreate, SubjectVisit, SubjectVisitCreate, KitAssignment, DispenseRequest, KitReturnRequest } from '../types/subject';

export const listSubjects = (params?: { status?: string; cohort_id?: string; scenario_id?: string }) =>
  apiClient.get<Subject[]>('/subjects', { params }).then((r) => r.data);

export const getSubject = (id: string) =>
  apiClient.get<Subject>(`/subjects/${id}`).then((r) => r.data);

export const createSubject = (data: SubjectCreate) =>
  apiClient.post<Subject>('/subjects', data).then((r) => r.data);

export const updateSubject = (id: string, data: Partial<SubjectCreate>) =>
  apiClient.patch<Subject>(`/subjects/${id}`, data).then((r) => r.data);

export const listVisits = (subjectId: string) =>
  apiClient.get<SubjectVisit[]>(`/subjects/${subjectId}/visits`).then((r) => r.data);

export const createVisit = (subjectId: string, data: SubjectVisitCreate) =>
  apiClient.post<SubjectVisit>(`/subjects/${subjectId}/visits`, data).then((r) => r.data);

export const updateVisit = (subjectId: string, visitId: string, data: Partial<SubjectVisitCreate>) =>
  apiClient.patch<SubjectVisit>(`/subjects/${subjectId}/visits/${visitId}`, data).then((r) => r.data);

export const dispenseKit = (subjectId: string, visitId: string, data: DispenseRequest) =>
  apiClient.post<KitAssignment>(`/subjects/${subjectId}/visits/${visitId}/dispense`, data).then((r) => r.data);

export const listKits = (subjectId: string, visitId: string) =>
  apiClient.get<KitAssignment[]>(`/subjects/${subjectId}/visits/${visitId}/kits`).then((r) => r.data);

export const returnKit = (subjectId: string, visitId: string, kitId: string, data: KitReturnRequest) =>
  apiClient.post<KitAssignment>(`/subjects/${subjectId}/visits/${visitId}/kits/${kitId}/return`, data).then((r) => r.data);
