import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Subject(Base):
    """A trial subject enrolled at a site."""

    __tablename__ = "subjects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    subject_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    scenario_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenarios.id"), nullable=True, index=True
    )
    cohort_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    arm_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    site_node_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_nodes.id"), nullable=True
    )

    status: Mapped[str] = mapped_column(String(32), default="SCREENED", index=True)
    # SCREENED → ENROLLED → ACTIVE → DISCONTINUED | COMPLETED

    screened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    enrolled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    discontinued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    attributes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    visits: Mapped[list["SubjectVisit"]] = relationship(back_populates="subject", cascade="all, delete-orphan")


class SubjectVisit(Base):
    """A scheduled or completed visit for a subject."""

    __tablename__ = "subject_visits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"), index=True)

    visit_id: Mapped[str] = mapped_column(String(64))  # e.g. "C1D1", "MAINT_QW_w5"
    scheduled_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    status: Mapped[str] = mapped_column(String(32), default="SCHEDULED")
    # SCHEDULED → COMPLETED | MISSED | CANCELLED

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    subject: Mapped["Subject"] = relationship(back_populates="visits")
    kit_assignments: Mapped[list["KitAssignment"]] = relationship(
        back_populates="subject_visit", cascade="all, delete-orphan"
    )


class KitAssignment(Base):
    """A record of product dispensed (or returned) at a visit."""

    __tablename__ = "kit_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_visit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subject_visits.id"), index=True
    )
    lot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_lots.id"), nullable=True
    )

    product_id: Mapped[str] = mapped_column(String(128))
    presentation_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    qty_dispensed: Mapped[float] = mapped_column(Float, default=0.0)

    dispensed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispensed_by: Mapped[str | None] = mapped_column(String(128), nullable=True)

    returned_qty: Mapped[float] = mapped_column(Float, default=0.0)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    subject_visit: Mapped["SubjectVisit"] = relationship(back_populates="kit_assignments")
