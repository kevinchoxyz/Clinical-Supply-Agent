import apiClient from './client';
import type { User, TokenOut, LoginPayload, RegisterPayload, AuditLog } from '../types/auth';

export const login = (data: LoginPayload) =>
  apiClient.post<TokenOut>('/auth/login', data).then((r) => r.data);

export const register = (data: RegisterPayload) =>
  apiClient.post<User>('/auth/register', data).then((r) => r.data);

export const getMe = () =>
  apiClient.get<User>('/auth/me').then((r) => r.data);

export const getUsers = () =>
  apiClient.get<User[]>('/auth/users').then((r) => r.data);

export const getAuditLogs = (params?: { action?: string; resource_type?: string }) =>
  apiClient.get<AuditLog[]>('/audit-logs', { params }).then((r) => r.data);
