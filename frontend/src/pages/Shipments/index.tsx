import React, { useState } from 'react';
import { Card, Table, Button, Radio, Row, Col, Space, Modal, Steps, Form, Select, InputNumber, Input, Tag, message, Typography } from 'antd';
import { PlusOutlined, UnorderedListOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useShipments, useCreateShipment, useApproveShipment, usePickShipment, useShipShipment, useReceiveShipment } from '../../hooks/useShipments';
import { useNodes, useLots } from '../../hooks/useInventory';
import { useStudyContext } from '../../context/StudyContext';
import { useStudy } from '../../hooks/useStudies';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import type { Shipment, ShipmentStatus } from '../../types/shipment';

const KANBAN_COLUMNS: { key: string; title: string; statuses: string[]; color: string }[] = [
  { key: 'requested', title: 'Requested', statuses: ['REQUESTED'], color: '#1677ff' },
  { key: 'approved', title: 'Approved', statuses: ['APPROVED'], color: '#13c2c2' },
  { key: 'picked', title: 'Picked', statuses: ['PICKED'], color: '#2f54eb' },
  { key: 'shipped', title: 'Shipped / In Transit', statuses: ['SHIPPED', 'IN_TRANSIT'], color: '#fa8c16' },
  { key: 'received', title: 'Received', statuses: ['RECEIVED'], color: '#52c41a' },
];

const ShipmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [createOpen, setCreateOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [form] = Form.useForm();
  const [items, setItems] = useState<{ lot_id: string; product_id: string; qty: number }[]>([]);

  const { selectedStudyId } = useStudyContext();
  const { data: selectedStudy } = useStudy(selectedStudyId ?? '');
  const { data: shipments, isLoading } = useShipments();
  const { data: nodes } = useNodes();
  const { data: lots } = useLots();
  const createShipment = useCreateShipment();
  const approve = useApproveShipment();
  const pick = usePickShipment();
  const ship = useShipShipment();
  const receive = useReceiveShipment();

  const handleAction = async (id: string, status: string) => {
    try {
      if (status === 'REQUESTED') await approve.mutateAsync({ id });
      else if (status === 'APPROVED') await pick.mutateAsync({ id });
      else if (status === 'PICKED') await ship.mutateAsync({ id });
      else if (status === 'SHIPPED' || status === 'IN_TRANSIT') await receive.mutateAsync({ id });
      message.success('Status updated');
    } catch {
      message.error('Action failed');
    }
  };

  const nextActionLabel = (status: string) => {
    const map: Record<string, string> = { REQUESTED: 'Approve', APPROVED: 'Pick', PICKED: 'Ship', SHIPPED: 'Receive', IN_TRANSIT: 'Receive' };
    return map[status];
  };

  const handleCreate = async () => {
    try {
      const vals = form.getFieldsValue(true);
      await createShipment.mutateAsync({
        from_node_id: vals.from_node_id,
        to_node_id: vals.to_node_id,
        items,
        lane_id: vals.lane_id,
        temperature_req: vals.temperature_req,
        courier: vals.courier,
        notes: vals.notes,
      });
      message.success('Shipment created');
      setCreateOpen(false);
      form.resetFields();
      setItems([]);
      setWizardStep(0);
    } catch {
      message.error('Failed to create shipment');
    }
  };

  const addItem = () => {
    setItems([...items, { lot_id: '', product_id: '', qty: 1 }]);
  };

  return (
    <div>
      <PageHeader
        title="Shipments"
        subtitle="Manage shipment lifecycle from request to receipt"
        extra={
          <Space>
            <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)} buttonStyle="solid">
              <Radio.Button value="kanban"><AppstoreOutlined /> Kanban</Radio.Button>
              <Radio.Button value="table"><UnorderedListOutlined /> Table</Radio.Button>
            </Radio.Group>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Create Shipment
            </Button>
          </Space>
        }
      />

      {viewMode === 'kanban' ? (
        <Row gutter={8} style={{ overflowX: 'auto' }}>
          {KANBAN_COLUMNS.map((col) => {
            const studyNodeIds = selectedStudy?.payload?.network_nodes
              ? new Set((selectedStudy.payload.network_nodes as { node_id?: string }[]).map((n) => n.node_id).filter(Boolean))
              : null;
            const baseShipments = studyNodeIds
              ? (shipments ?? []).filter((s) => studyNodeIds.has(s.from_node_id) || studyNodeIds.has(s.to_node_id))
              : (shipments ?? []);
            const colShipments = baseShipments.filter((s) => col.statuses.includes(s.status));
            return (
              <Col key={col.key} flex="1" style={{ minWidth: 220 }}>
                <div className="kanban-column">
                  <div style={{ marginBottom: 8, fontWeight: 600 }}>
                    <Tag color={col.color}>{col.title}</Tag>
                    <span style={{ color: '#999', fontSize: 12 }}>({colShipments.length})</span>
                  </div>
                  {colShipments.map((s) => (
                    <Card
                      key={s.id}
                      size="small"
                      style={{ marginBottom: 8, cursor: 'pointer' }}
                      onClick={() => navigate(`/shipments/${s.id}`)}
                      actions={
                        nextActionLabel(s.status)
                          ? [
                              <Button
                                key="action"
                                size="small"
                                type="link"
                                onClick={(e) => { e.stopPropagation(); handleAction(s.id, s.status); }}
                              >
                                {nextActionLabel(s.status)}
                              </Button>,
                            ]
                          : undefined
                      }
                    >
                      <Typography.Text code style={{ fontSize: 11 }}>{s.id.slice(0, 8)}</Typography.Text>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        {s.items.length} item{s.items.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: 11, color: '#999' }}>
                        {dayjs(s.requested_at).format('MMM D, HH:mm')}
                      </div>
                    </Card>
                  ))}
                </div>
              </Col>
            );
          })}
        </Row>
      ) : (
        <Card>
          <Table
            dataSource={shipments ?? []}
            loading={isLoading}
            rowKey="id"
            onRow={(r) => ({ onClick: () => navigate(`/shipments/${r.id}`) })}
            columns={[
              { title: 'ID', dataIndex: 'id', render: (v: string) => v.slice(0, 8) },
              { title: 'Status', dataIndex: 'status', render: (v: string) => <StatusBadge status={v} /> },
              { title: 'Items', dataIndex: 'items', render: (v: Shipment['items']) => v.length },
              { title: 'Courier', dataIndex: 'courier' },
              { title: 'Requested', dataIndex: 'requested_at', render: (v: string) => dayjs(v).format('MMM D, YYYY HH:mm') },
              {
                title: 'Actions',
                render: (_: unknown, r: Shipment) =>
                  nextActionLabel(r.status) ? (
                    <Button size="small" onClick={(e) => { e.stopPropagation(); handleAction(r.id, r.status); }}>
                      {nextActionLabel(r.status)}
                    </Button>
                  ) : null,
              },
            ]}
          />
        </Card>
      )}

      <Modal
        title="Create Shipment"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); setWizardStep(0); form.resetFields(); setItems([]); }}
        width={640}
        footer={
          <Space>
            {wizardStep > 0 && <Button onClick={() => setWizardStep(wizardStep - 1)}>Previous</Button>}
            {wizardStep < 2 && <Button type="primary" onClick={() => setWizardStep(wizardStep + 1)} disabled={wizardStep === 1 && items.length === 0}>Next</Button>}
            {wizardStep === 2 && (
              <Button type="primary" onClick={handleCreate} loading={createShipment.isPending}>
                Create
              </Button>
            )}
          </Space>
        }
      >
        <Steps current={wizardStep} size="small" style={{ marginBottom: 24 }} items={[{ title: 'Nodes' }, { title: 'Items' }, { title: 'Review' }]} />
        <Form form={form} layout="vertical">
          {wizardStep === 0 && (
            <>
              <Form.Item name="from_node_id" label="From Node" rules={[{ required: true }]}>
                <Select
                  placeholder="Select origin node"
                  options={(nodes ?? []).map((n) => ({ value: n.node_id, label: `${n.name || n.node_id} (${n.node_type})` }))}
                  showSearch
                />
              </Form.Item>
              <Form.Item name="to_node_id" label="To Node" rules={[{ required: true }]}>
                <Select
                  placeholder="Select destination node"
                  options={(nodes ?? []).map((n) => ({ value: n.node_id, label: `${n.name || n.node_id} (${n.node_type})` }))}
                  showSearch
                />
              </Form.Item>
            </>
          )}
          {wizardStep === 1 && (
            <>
              {items.map((item, idx) => (
                <Row key={idx} gutter={8} style={{ marginBottom: 8 }}>
                  <Col span={10}>
                    <Select
                      placeholder="Select lot"
                      value={item.lot_id || undefined}
                      onChange={(v) => {
                        const lot = lots?.find((l) => l.id === v);
                        const next = [...items];
                        next[idx] = { ...next[idx], lot_id: v, product_id: lot?.product_id ?? '' };
                        setItems(next);
                      }}
                      options={(lots ?? []).map((l) => ({ value: l.id, label: `${l.lot_number} (${l.product_id})` }))}
                      style={{ width: '100%' }}
                      showSearch
                    />
                  </Col>
                  <Col span={6}>
                    <Input value={item.product_id} disabled placeholder="Product ID" />
                  </Col>
                  <Col span={5}>
                    <InputNumber
                      min={1}
                      value={item.qty}
                      onChange={(v) => { const next = [...items]; next[idx] = { ...next[idx], qty: v ?? 1 }; setItems(next); }}
                      style={{ width: '100%' }}
                      placeholder="Qty"
                    />
                  </Col>
                  <Col span={3}>
                    <Button danger onClick={() => setItems(items.filter((_, i) => i !== idx))}>X</Button>
                  </Col>
                </Row>
              ))}
              <Button onClick={addItem} icon={<PlusOutlined />}>Add Item</Button>
            </>
          )}
          {wizardStep === 2 && (
            <>
              <Form.Item name="lane_id" label="Lane ID"><Input /></Form.Item>
              <Form.Item name="courier" label="Courier"><Input /></Form.Item>
              <Form.Item name="temperature_req" label="Temperature Requirement"><Input /></Form.Item>
              <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
              <Typography.Text type="secondary">Items: {items.length}</Typography.Text>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default ShipmentsPage;
