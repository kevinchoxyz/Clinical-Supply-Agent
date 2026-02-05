"""add inventory, shipment, subject, user, audit tables

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-29 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Bucket 7: Inventory ---
    op.create_table(
        'inventory_nodes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('node_id', sa.String(128), nullable=False),
        sa.Column('node_type', sa.String(32), nullable=False),
        sa.Column('name', sa.String(256), nullable=True),
        sa.Column('country', sa.String(8), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('attributes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inventory_nodes_node_id', 'inventory_nodes', ['node_id'], unique=True)

    op.create_table(
        'inventory_lots',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('node_id', sa.UUID(), nullable=False),
        sa.Column('product_id', sa.String(128), nullable=False),
        sa.Column('presentation_id', sa.String(128), nullable=True),
        sa.Column('lot_number', sa.String(128), nullable=False),
        sa.Column('expiry_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(32), nullable=False),
        sa.Column('qty_on_hand', sa.Float(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['node_id'], ['inventory_nodes.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('node_id', 'product_id', 'presentation_id', 'lot_number',
                            name='uq_lot_at_node'),
    )
    op.create_index('ix_inventory_lots_node_id', 'inventory_lots', ['node_id'])
    op.create_index('ix_inventory_lots_product_id', 'inventory_lots', ['product_id'])
    op.create_index('ix_inventory_lots_lot_number', 'inventory_lots', ['lot_number'])

    op.create_table(
        'inventory_transactions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('lot_id', sa.UUID(), nullable=False),
        sa.Column('txn_type', sa.String(32), nullable=False),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.Column('from_node_id', sa.UUID(), nullable=True),
        sa.Column('to_node_id', sa.UUID(), nullable=True),
        sa.Column('reference_type', sa.String(64), nullable=True),
        sa.Column('reference_id', sa.String(128), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(128), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['lot_id'], ['inventory_lots.id']),
        sa.ForeignKeyConstraint(['from_node_id'], ['inventory_nodes.id']),
        sa.ForeignKeyConstraint(['to_node_id'], ['inventory_nodes.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inventory_transactions_lot_id', 'inventory_transactions', ['lot_id'])
    op.create_index('ix_inventory_transactions_txn_type', 'inventory_transactions', ['txn_type'])

    # --- Bucket 9: Shipments ---
    op.create_table(
        'shipments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('from_node_id', sa.UUID(), nullable=False),
        sa.Column('to_node_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(32), nullable=False),
        sa.Column('lane_id', sa.String(128), nullable=True),
        sa.Column('tracking_number', sa.String(256), nullable=True),
        sa.Column('temperature_req', sa.String(64), nullable=True),
        sa.Column('courier', sa.String(128), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('requested_by', sa.String(128), nullable=True),
        sa.Column('requested_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('approved_by', sa.String(128), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('shipped_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['from_node_id'], ['inventory_nodes.id']),
        sa.ForeignKeyConstraint(['to_node_id'], ['inventory_nodes.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_shipments_from_node_id', 'shipments', ['from_node_id'])
    op.create_index('ix_shipments_to_node_id', 'shipments', ['to_node_id'])
    op.create_index('ix_shipments_status', 'shipments', ['status'])

    op.create_table(
        'shipment_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('shipment_id', sa.UUID(), nullable=False),
        sa.Column('lot_id', sa.UUID(), nullable=False),
        sa.Column('product_id', sa.String(128), nullable=False),
        sa.Column('presentation_id', sa.String(128), nullable=True),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(['shipment_id'], ['shipments.id']),
        sa.ForeignKeyConstraint(['lot_id'], ['inventory_lots.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_shipment_items_shipment_id', 'shipment_items', ['shipment_id'])

    # --- Bucket 10: Subjects ---
    op.create_table(
        'subjects',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('subject_number', sa.String(64), nullable=False),
        sa.Column('scenario_id', sa.UUID(), nullable=True),
        sa.Column('cohort_id', sa.String(64), nullable=True),
        sa.Column('arm_id', sa.String(64), nullable=True),
        sa.Column('site_node_id', sa.UUID(), nullable=True),
        sa.Column('status', sa.String(32), nullable=False),
        sa.Column('screened_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('enrolled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('discontinued_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('attributes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['scenario_id'], ['scenarios.id']),
        sa.ForeignKeyConstraint(['site_node_id'], ['inventory_nodes.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_subjects_subject_number', 'subjects', ['subject_number'], unique=True)
    op.create_index('ix_subjects_scenario_id', 'subjects', ['scenario_id'])
    op.create_index('ix_subjects_cohort_id', 'subjects', ['cohort_id'])
    op.create_index('ix_subjects_status', 'subjects', ['status'])

    op.create_table(
        'subject_visits',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('subject_id', sa.UUID(), nullable=False),
        sa.Column('visit_id', sa.String(64), nullable=False),
        sa.Column('scheduled_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(32), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_subject_visits_subject_id', 'subject_visits', ['subject_id'])

    op.create_table(
        'kit_assignments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('subject_visit_id', sa.UUID(), nullable=False),
        sa.Column('lot_id', sa.UUID(), nullable=True),
        sa.Column('product_id', sa.String(128), nullable=False),
        sa.Column('presentation_id', sa.String(128), nullable=True),
        sa.Column('qty_dispensed', sa.Float(), nullable=False, server_default='0'),
        sa.Column('dispensed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('dispensed_by', sa.String(128), nullable=True),
        sa.Column('returned_qty', sa.Float(), nullable=False, server_default='0'),
        sa.Column('returned_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['subject_visit_id'], ['subject_visits.id']),
        sa.ForeignKeyConstraint(['lot_id'], ['inventory_lots.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_kit_assignments_subject_visit_id', 'kit_assignments', ['subject_visit_id'])

    # --- Bucket 12: Users & Audit ---
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('username', sa.String(128), nullable=False),
        sa.Column('email', sa.String(256), nullable=False),
        sa.Column('hashed_password', sa.String(256), nullable=False),
        sa.Column('role', sa.String(32), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('tenant_id', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_role', 'users', ['role'])
    op.create_index('ix_users_tenant_id', 'users', ['tenant_id'])

    op.create_table(
        'audit_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('username', sa.String(128), nullable=True),
        sa.Column('action', sa.String(64), nullable=False),
        sa.Column('resource_type', sa.String(64), nullable=True),
        sa.Column('resource_id', sa.String(128), nullable=True),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_logs_resource_type', 'audit_logs', ['resource_type'])


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('users')
    op.drop_table('kit_assignments')
    op.drop_table('subject_visits')
    op.drop_table('subjects')
    op.drop_table('shipment_items')
    op.drop_table('shipments')
    op.drop_table('inventory_transactions')
    op.drop_table('inventory_lots')
    op.drop_table('inventory_nodes')
