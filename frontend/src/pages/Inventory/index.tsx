import React, { useMemo, useState } from 'react';
import {
  Tabs,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Table,
  Space,
  Spin,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import dayjs from 'dayjs';

import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { useStudyContext } from '../../context/StudyContext';
import { useStudy } from '../../hooks/useStudies';
import {
  useNodes,
  useCreateNode,
  useLots,
  useCreateLot,
  useTransactions,
  usePositions,
} from '../../hooks/useInventory';
import type {
  Node,
  NodeCreate,
  Lot,
  LotCreate,
  Transaction,
  InventoryPosition,
} from '../../types/inventory';

const CHART_COLORS = [
  '#1677ff',
  '#52c41a',
  '#722ed1',
  '#faad14',
  '#eb2f96',
  '#13c2c2',
  '#fa541c',
  '#2f54eb',
  '#a0d911',
  '#f5222d',
];

/* ------------------------------------------------------------------ */
/*  Nodes Tab                                                         */
/* ------------------------------------------------------------------ */

const NodesTab: React.FC = () => {
  const { data: nodes, isLoading } = useNodes();
  const createNode = useCreateNode();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<NodeCreate>();

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createNode.mutateAsync(values);
      message.success('Node created');
      form.resetFields();
      setOpen(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      if (detail) {
        const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((e: { msg?: string }) => e.msg).join('; ') : 'Failed to create node';
        message.error(msg);
      }
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          Add Node
        </Button>
      </div>

      {(!nodes || nodes.length === 0) ? (
        <EmptyState description="No inventory nodes" actionLabel="Add Node" onAction={() => setOpen(true)} />
      ) : (
        <Row gutter={[16, 16]}>
          {nodes.map((node: Node) => (
            <Col xs={24} sm={12} lg={8} key={node.id}>
              <Card
                title={node.name || node.node_id}
                extra={
                  <Tag color={node.node_type === 'DEPOT' ? 'blue' : 'green'}>
                    {node.node_type}
                  </Tag>
                }
              >
                <p>
                  <Typography.Text type="secondary">Country: </Typography.Text>
                  {node.country ?? '-'}
                </p>
                <p>
                  <Typography.Text type="secondary">Status: </Typography.Text>
                  <Tag color={node.is_active ? 'green' : 'default'}>
                    {node.is_active ? 'Active' : 'Inactive'}
                  </Tag>
                </p>
                <p>
                  <Typography.Text type="secondary">Created: </Typography.Text>
                  {dayjs(node.created_at).format('MMM D, YYYY')}
                </p>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="Add Node"
        open={open}
        onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={handleCreate}
        confirmLoading={createNode.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="node_id" label="Node ID" rules={[{ required: true, message: 'Node ID is required' }]}>
            <Input placeholder="e.g. DEPOT-001" />
          </Form.Item>
          <Form.Item name="node_type" label="Node Type" rules={[{ required: true, message: 'Select a type' }]}>
            <Select placeholder="Select type">
              <Select.Option value="DEPOT">DEPOT</Select.Option>
              <Select.Option value="SITE">SITE</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="name" label="Name">
            <Input placeholder="Display name" />
          </Form.Item>
          <Form.Item name="country" label="Country">
            <Input placeholder="e.g. US" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  Lots Tab                                                          */
/* ------------------------------------------------------------------ */

const LotsTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [productFilter, setProductFilter] = useState<string | undefined>();
  const { data: lots, isLoading } = useLots({
    status: statusFilter,
    product_id: productFilter || undefined,
  });
  const createLot = useCreateLot();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<LotCreate>();

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const payload: LotCreate = {
        ...values,
        expiry_date: values.expiry_date
          ? dayjs(values.expiry_date as unknown as string).format('YYYY-MM-DD')
          : undefined,
      };
      await createLot.mutateAsync(payload);
      message.success('Lot created');
      form.resetFields();
      setOpen(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      if (detail) {
        const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((e: { msg?: string }) => e.msg).join('; ') : 'Failed to create lot';
        message.error(msg);
      }
    }
  };

  const columns = [
    { title: 'Lot Number', dataIndex: 'lot_number', key: 'lot_number' },
    { title: 'Product ID', dataIndex: 'product_id', key: 'product_id' },
    { title: 'Presentation', dataIndex: 'presentation_id', key: 'presentation_id', render: (v: string | null) => v ?? '-' },
    { title: 'Node', dataIndex: 'node_id', key: 'node_id', ellipsis: true },
    { title: 'Qty on Hand', dataIndex: 'qty_on_hand', key: 'qty_on_hand', sorter: (a: Lot, b: Lot) => a.qty_on_hand - b.qty_on_hand },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <StatusBadge status={s} /> },
    {
      title: 'Expiry Date',
      dataIndex: 'expiry_date',
      key: 'expiry_date',
      render: (v: string | null) => (v ? dayjs(v).format('MMM D, YYYY') : '-'),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => dayjs(v).format('MMM D, YYYY'),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          placeholder="Filter by status"
          style={{ width: 180 }}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
        >
          <Select.Option value="RELEASED">RELEASED</Select.Option>
          <Select.Option value="QUARANTINE">QUARANTINE</Select.Option>
          <Select.Option value="EXPIRED">EXPIRED</Select.Option>
        </Select>
        <Input
          allowClear
          placeholder="Filter by Product ID"
          style={{ width: 200 }}
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value || undefined)}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          Add Lot
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={lots ?? []}
        columns={columns}
        locale={{ emptyText: <EmptyState description="No lots found" actionLabel="Add Lot" onAction={() => setOpen(true)} /> }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      <Modal
        title="Add Lot"
        open={open}
        onCancel={() => { setOpen(false); form.resetFields(); }}
        onOk={handleCreate}
        confirmLoading={createLot.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="node_id" label="Node ID" rules={[{ required: true, message: 'Node ID is required' }]}>
            <Input placeholder="Node ID" />
          </Form.Item>
          <Form.Item name="product_id" label="Product ID" rules={[{ required: true, message: 'Product ID is required' }]}>
            <Input placeholder="Product ID" />
          </Form.Item>
          <Form.Item name="presentation_id" label="Presentation ID">
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item name="lot_number" label="Lot Number" rules={[{ required: true, message: 'Lot number is required' }]}>
            <Input placeholder="e.g. LOT-2025-001" />
          </Form.Item>
          <Form.Item name="qty_on_hand" label="Qty on Hand">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select placeholder="Select status" allowClear>
              <Select.Option value="RELEASED">RELEASED</Select.Option>
              <Select.Option value="QUARANTINE">QUARANTINE</Select.Option>
              <Select.Option value="EXPIRED">EXPIRED</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="expiry_date" label="Expiry Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  Transactions Tab                                                  */
/* ------------------------------------------------------------------ */

const TransactionsTab: React.FC = () => {
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const { data: transactions, isLoading } = useTransactions({ txn_type: typeFilter });

  const sorted = useMemo(() => {
    if (!transactions) return [];
    return [...transactions].sort(
      (a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf(),
    );
  }, [transactions]);

  const columns = [
    { title: 'Type', dataIndex: 'txn_type', key: 'txn_type', render: (v: string) => <StatusBadge status={v} /> },
    {
      title: 'Lot ID',
      dataIndex: 'lot_id',
      key: 'lot_id',
      ellipsis: true,
      render: (v: string) => v?.slice(0, 8) + '...',
    },
    { title: 'Qty', dataIndex: 'qty', key: 'qty' },
    { title: 'From Node', dataIndex: 'from_node_id', key: 'from_node_id', render: (v: string | null) => v ?? '-', ellipsis: true },
    { title: 'To Node', dataIndex: 'to_node_id', key: 'to_node_id', render: (v: string | null) => v ?? '-', ellipsis: true },
    {
      title: 'Reference',
      key: 'reference',
      render: (_: unknown, r: Transaction) =>
        r.reference_type ? `${r.reference_type}: ${r.reference_id ?? ''}` : '-',
    },
    { title: 'Notes', dataIndex: 'notes', key: 'notes', render: (v: string | null) => v ?? '-', ellipsis: true },
    { title: 'Created By', dataIndex: 'created_by', key: 'created_by', render: (v: string | null) => v ?? '-' },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => dayjs(v).format('MMM D, YYYY h:mm A'),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="Filter by type"
          style={{ width: 200 }}
          value={typeFilter}
          onChange={(v) => setTypeFilter(v)}
        >
          <Select.Option value="RECEIPT">RECEIPT</Select.Option>
          <Select.Option value="ISSUE">ISSUE</Select.Option>
          <Select.Option value="TRANSFER_OUT">TRANSFER_OUT</Select.Option>
          <Select.Option value="TRANSFER_IN">TRANSFER_IN</Select.Option>
          <Select.Option value="RETURN">RETURN</Select.Option>
          <Select.Option value="ADJUSTMENT">ADJUSTMENT</Select.Option>
        </Select>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={sorted}
        columns={columns}
        locale={{ emptyText: <EmptyState description="No transactions found" /> }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  Positions Tab                                                     */
/* ------------------------------------------------------------------ */

const PositionsTab: React.FC = () => {
  const { data: positions, isLoading } = usePositions();

  const byProduct = useMemo(() => {
    if (!positions) return [];
    const map = new Map<string, number>();
    positions.forEach((p: InventoryPosition) => {
      map.set(p.product_id, (map.get(p.product_id) ?? 0) + p.total_qty);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [positions]);

  const byNode = useMemo(() => {
    if (!positions) return [];
    const map = new Map<string, number>();
    positions.forEach((p: InventoryPosition) => {
      const label = p.node_name || p.node_id;
      map.set(label, (map.get(label) ?? 0) + p.total_qty);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [positions]);

  const columns = [
    {
      title: 'Node',
      key: 'node',
      render: (_: unknown, r: InventoryPosition) => r.node_name || r.node_id,
    },
    { title: 'Product', dataIndex: 'product_id', key: 'product_id' },
    { title: 'Presentation', dataIndex: 'presentation_id', key: 'presentation_id', render: (v: string | null) => v ?? '-' },
    { title: 'Total Qty', dataIndex: 'total_qty', key: 'total_qty', sorter: (a: InventoryPosition, b: InventoryPosition) => a.total_qty - b.total_qty },
    { title: 'Lot Count', dataIndex: 'lot_count', key: 'lot_count' },
    {
      title: 'Earliest Expiry',
      dataIndex: 'earliest_expiry',
      key: 'earliest_expiry',
      render: (v: string | null) => (v ? dayjs(v).format('MMM D, YYYY') : '-'),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!positions || positions.length === 0) {
    return <EmptyState description="No inventory positions" />;
  }

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card title="Inventory by Product">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={byProduct}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {byProduct.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Inventory by Node">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={byNode}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {byNode.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Table
        rowKey={(r) => `${r.node_id}-${r.product_id}-${r.presentation_id ?? ''}`}
        dataSource={positions}
        columns={columns}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Inventory Page                                               */
/* ------------------------------------------------------------------ */

const InventoryPage: React.FC = () => {
  const { selectedStudyId } = useStudyContext();
  const { data: selectedStudy } = useStudy(selectedStudyId ?? '');

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Manage nodes, lots, transactions, and view inventory positions"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Inventory' },
        ]}
      />

      {selectedStudy && (
        <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff', border: '1px solid #adc6ff' }}>
          <Typography.Text>
            Showing data for: <Typography.Text strong>{selectedStudy.study_code} — {selectedStudy.name}</Typography.Text>
          </Typography.Text>
        </Card>
      )}

      <Tabs
        defaultActiveKey="nodes"
        items={[
          { key: 'nodes', label: 'Nodes', children: <NodesTab /> },
          { key: 'lots', label: 'Lots', children: <LotsTab /> },
          { key: 'transactions', label: 'Transactions', children: <TransactionsTab /> },
          { key: 'positions', label: 'Positions', children: <PositionsTab /> },
        ]}
      />
    </div>
  );
};

export default InventoryPage;
