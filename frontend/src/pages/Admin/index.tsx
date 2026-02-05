import React, { useState } from 'react';
import { Tabs, Card, Table, Tag, Badge, Select, Row, Col, Typography } from 'antd';
import { ApiOutlined, CloudServerOutlined, RocketOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useUsers, useAuditLogs } from '../../hooks/useAdmin';
import PageHeader from '../../components/PageHeader';
import type { User, AuditLog } from '../../types/auth';

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'red',
  SUPPLY_CHAIN: 'blue',
  SITE: 'green',
  READONLY: 'default',
};

const AdminPage: React.FC = () => {
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [resourceFilter, setResourceFilter] = useState<string | undefined>();

  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: auditLogs, isLoading: logsLoading } = useAuditLogs({
    action: actionFilter,
    resource_type: resourceFilter,
  });

  const actionOptions = [...new Set((auditLogs ?? []).map((l) => l.action))].map((a) => ({ value: a, label: a }));
  const resourceOptions = [...new Set((auditLogs ?? []).filter((l) => l.resource_type).map((l) => l.resource_type!))].map((r) => ({ value: r, label: r }));

  return (
    <div>
      <PageHeader title="Administration" subtitle="Manage users, audit logs, and integrations" />

      <Tabs
        defaultActiveKey="users"
        items={[
          {
            key: 'users',
            label: 'Users',
            children: (
              <Card>
                <Table
                  dataSource={users ?? []}
                  loading={usersLoading}
                  rowKey="id"
                  columns={[
                    { title: 'Username', dataIndex: 'username', sorter: (a: User, b: User) => a.username.localeCompare(b.username) },
                    { title: 'Email', dataIndex: 'email' },
                    {
                      title: 'Role',
                      dataIndex: 'role',
                      render: (v: string) => <Tag color={ROLE_COLORS[v] || 'default'}>{v}</Tag>,
                      filters: Object.keys(ROLE_COLORS).map((r) => ({ text: r, value: r })),
                      onFilter: (value, record: User) => record.role === value,
                    },
                    {
                      title: 'Active',
                      dataIndex: 'is_active',
                      render: (v: boolean) => <Badge status={v ? 'success' : 'error'} text={v ? 'Active' : 'Inactive'} />,
                    },
                    { title: 'Tenant', dataIndex: 'tenant_id', render: (v: string | null) => v ?? '—' },
                    {
                      title: 'Created',
                      dataIndex: 'created_at',
                      render: (v: string) => dayjs(v).format('MMM D, YYYY'),
                      sorter: (a: User, b: User) => a.created_at.localeCompare(b.created_at),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'audit',
            label: 'Audit Log',
            children: (
              <Card>
                <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
                  <Select
                    allowClear
                    placeholder="Filter by action"
                    style={{ width: 200 }}
                    value={actionFilter}
                    onChange={setActionFilter}
                    options={actionOptions}
                  />
                  <Select
                    allowClear
                    placeholder="Filter by resource type"
                    style={{ width: 200 }}
                    value={resourceFilter}
                    onChange={setResourceFilter}
                    options={resourceOptions}
                  />
                </div>
                <Table
                  dataSource={auditLogs ?? []}
                  loading={logsLoading}
                  rowKey="id"
                  expandable={{
                    expandedRowRender: (record: AuditLog) => (
                      <pre style={{ fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 6, overflow: 'auto' }}>
                        {JSON.stringify(record.details, null, 2) || 'No details'}
                      </pre>
                    ),
                  }}
                  columns={[
                    { title: 'Action', dataIndex: 'action', render: (v: string) => <Tag>{v}</Tag> },
                    { title: 'Resource Type', dataIndex: 'resource_type', render: (v: string | null) => v ?? '—' },
                    { title: 'Resource ID', dataIndex: 'resource_id', render: (v: string | null) => v ? v.slice(0, 8) : '—' },
                    { title: 'Username', dataIndex: 'username', render: (v: string | null) => v ?? '—' },
                    { title: 'IP', dataIndex: 'ip_address', render: (v: string | null) => v ?? '—' },
                    {
                      title: 'Created',
                      dataIndex: 'created_at',
                      render: (v: string) => dayjs(v).format('MMM D, YYYY HH:mm'),
                      sorter: (a: AuditLog, b: AuditLog) => a.created_at.localeCompare(b.created_at),
                      defaultSortOrder: 'descend',
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'integrations',
            label: 'Integrations',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <Card hoverable styles={{ body: { textAlign: 'center', padding: 32 } }}>
                    <ApiOutlined style={{ fontSize: 40, color: '#1677ff', marginBottom: 12 }} />
                    <Typography.Title level={5}>IRT</Typography.Title>
                    <Badge status="default" text="Not configured" />
                    <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                      Import subjects from Interactive Response Technology systems.
                    </Typography.Paragraph>
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card hoverable styles={{ body: { textAlign: 'center', padding: 32 } }}>
                    <CloudServerOutlined style={{ fontSize: 40, color: '#52c41a', marginBottom: 12 }} />
                    <Typography.Title level={5}>WMS</Typography.Title>
                    <Badge status="default" text="Not configured" />
                    <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                      Warehouse Management System receipt integration.
                    </Typography.Paragraph>
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card hoverable styles={{ body: { textAlign: 'center', padding: 32 } }}>
                    <RocketOutlined style={{ fontSize: 40, color: '#fa8c16', marginBottom: 12 }} />
                    <Typography.Title level={5}>Courier</Typography.Title>
                    <Badge status="default" text="Not configured" />
                    <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                      Courier tracking and shipment status updates.
                    </Typography.Paragraph>
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </div>
  );
};

export default AdminPage;
