"""add unique constraint on (scenario_id, version)

Revision ID: a1b2c3d4e5f6
Revises: d97d4ea5077e
Create Date: 2026-01-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd97d4ea5077e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        'uq_scenario_versions_scenario_id_version',
        'scenario_versions',
        ['scenario_id', 'version'],
    )


def downgrade() -> None:
    op.drop_constraint(
        'uq_scenario_versions_scenario_id_version',
        'scenario_versions',
        type_='unique',
    )
