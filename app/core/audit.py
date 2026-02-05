"""Audit logging utility.

Provides a simple function to record audit events. Can be called from
any endpoint or service to track critical actions.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import AuditLog


def log_action(
    db: Session,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    user_id: UUID | None = None,
    username: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """Record an audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    # Don't commit here — let the caller manage the transaction
    return entry
