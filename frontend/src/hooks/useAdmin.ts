import { useQuery } from '@tanstack/react-query';
import { getUsers, getAuditLogs } from '../api/auth';

export const useUsers = () =>
  useQuery({ queryKey: ['admin', 'users'], queryFn: getUsers });

export const useAuditLogs = (params?: { action?: string; resource_type?: string }) =>
  useQuery({ queryKey: ['admin', 'audit-logs', params], queryFn: () => getAuditLogs(params) });
