"""add inventory study_id and vials table

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-02-05 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'd4e5f6g7h8i9'
down_revision: Union[str, None] = 'c3d4e5f6g7h8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add study_id to inventory_nodes
    op.add_column('inventory_nodes', sa.Column('study_id', UUID(as_uuid=True), nullable=True))
    op.create_index('ix_inventory_nodes_study_id', 'inventory_nodes', ['study_id'])
    op.create_foreign_key(
        'fk_inventory_nodes_study_id',
        'inventory_nodes',
        'studies',
        ['study_id'],
        ['id']
    )

    # Create inventory_vials table
    op.create_table(
        'inventory_vials',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('lot_id', UUID(as_uuid=True), nullable=False),
        sa.Column('medication_number', sa.String(128), nullable=False),
        sa.Column('status', sa.String(32), nullable=False, server_default='AVAILABLE'),
        sa.Column('dispensed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('dispensed_to_subject_id', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['lot_id'], ['inventory_lots.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lot_id', 'medication_number', name='uq_vial_medication_number'),
    )
    op.create_index('ix_inventory_vials_lot_id', 'inventory_vials', ['lot_id'])
    op.create_index('ix_inventory_vials_medication_number', 'inventory_vials', ['medication_number'])


def downgrade() -> None:
    op.drop_table('inventory_vials')
    op.drop_constraint('fk_inventory_nodes_study_id', 'inventory_nodes', type_='foreignkey')
    op.drop_index('ix_inventory_nodes_study_id', table_name='inventory_nodes')
    op.drop_column('inventory_nodes', 'study_id')
