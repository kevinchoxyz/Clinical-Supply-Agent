import type { UUID } from './common';

export interface User {
  id: UUID;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  tenant_id: string | null;
  created_at: string;
}

export interface TokenOut {
  access_token: string;
  token_type: string;
  role: string;
  username: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  role?: string;
  tenant_id?: string;
}

export interface AuditLog {
  id: UUID;
  user_id: UUID | null;
  username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}
