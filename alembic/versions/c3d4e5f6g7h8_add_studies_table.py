"""add studies table and scenario.study_id FK

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6a7
Create Date: 2026-01-30 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = 'c3d4e5f6g7h8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'studies',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('study_code', sa.String(64), nullable=False, unique=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('phase', sa.String(32), nullable=True),
        sa.Column('protocol_version', sa.String(64), nullable=True),
        sa.Column('countries', JSONB, nullable=True),
        sa.Column('payload', JSONB, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_studies_study_code', 'studies', ['study_code'])

    op.add_column(
        'scenarios',
        sa.Column('study_id', UUID(as_uuid=True), sa.ForeignKey('studies.id'), nullable=True),
    )
    op.create_index('ix_scenarios_study_id', 'scenarios', ['study_id'])


def downgrade() -> None:
    op.drop_index('ix_scenarios_study_id', table_name='scenarios')
    op.drop_column('scenarios', 'study_id')
    op.drop_index('ix_studies_study_code', table_name='studies')
    op.drop_table('studies')
