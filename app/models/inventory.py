import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InventoryNode(Base):
    """A depot or site that holds inventory."""

    __tablename__ = "inventory_nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    node_type: Mapped[str] = mapped_column(String(32), default="SITE")  # DEPOT | SITE
    name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    country: Mapped[str | None] = mapped_column(String(8), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    attributes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    study_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("studies.id"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    study: Mapped["Study"] = relationship(back_populates="inventory_nodes")  # noqa: F821
    lots: Mapped[list["InventoryLot"]] = relationship(back_populates="node", cascade="all, delete-orphan")


class InventoryLot(Base):
    """A specific lot of product at a specific node."""

    __tablename__ = "inventory_lots"
    __table_args__ = (
        UniqueConstraint("node_id", "product_id", "presentation_id", "lot_number",
                         name="uq_lot_at_node"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_nodes.id"), index=True)

    product_id: Mapped[str] = mapped_column(String(128), index=True)
    presentation_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    lot_number: Mapped[str] = mapped_column(String(128), index=True)

    expiry_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="RELEASED")  # RELEASED | QUARANTINED | DESTROYED
    qty_on_hand: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )

    node: Mapped["InventoryNode"] = relationship(back_populates="lots")
    transactions: Mapped[list["InventoryTransaction"]] = relationship(back_populates="lot", cascade="all, delete-orphan")
    vials: Mapped[list["InventoryVial"]] = relationship(back_populates="lot", cascade="all, delete-orphan")


class InventoryTransaction(Base):
    """A change to inventory: receipt, issue, transfer, return, adjustment."""

    __tablename__ = "inventory_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_lots.id"), index=True)

    txn_type: Mapped[str] = mapped_column(String(32), index=True)
    # RECEIPT | ISSUE | TRANSFER_OUT | TRANSFER_IN | RETURN | ADJUSTMENT
    qty: Mapped[float] = mapped_column(Float)

    from_node_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_nodes.id"), nullable=True)
    to_node_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_nodes.id"), nullable=True)

    reference_type: Mapped[str | None] = mapped_column(String(64), nullable=True)  # e.g. "SHIPMENT", "DISPENSE"
    reference_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    lot: Mapped["InventoryLot"] = relationship(back_populates="transactions")


class InventoryVial(Base):
    """An individual vial within a lot, identified by medication_number."""

    __tablename__ = "inventory_vials"
    __table_args__ = (
        UniqueConstraint("lot_id", "medication_number", name="uq_vial_medication_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inventory_lots.id"), index=True)
    medication_number: Mapped[str] = mapped_column(String(128), index=True)
    status: Mapped[str] = mapped_column(String(32), default="AVAILABLE")  # AVAILABLE | DISPENSED | RETURNED | DESTROYED

    dispensed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispensed_to_subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    lot: Mapped["InventoryLot"] = relationship(back_populates="vials")
