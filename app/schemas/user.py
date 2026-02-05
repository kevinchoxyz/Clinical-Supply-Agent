from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserRegister(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(..., min_length=3, max_length=128)
    email: str = Field(..., max_length=256)
    password: str = Field(..., min_length=8)
    role: str = "READONLY"
    tenant_id: Optional[str] = None


class UserLogin(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    username: str
    email: str
    role: str
    is_active: bool
    tenant_id: Optional[str]
    created_at: datetime


class TokenOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


class AuditLogOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    user_id: Optional[UUID]
    username: Optional[str]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    details: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    created_at: datetime
