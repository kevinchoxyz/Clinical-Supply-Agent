import React from 'react';
import { Card, Descriptions, Steps, Table, Button, Space, Spin, message, Popconfirm } from 'antd';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { useShipment, useApproveShipment, usePickShipment, useShipShipment, useReceiveShipment } from '../../hooks/useShipments';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';

const STATUS_ORDER = ['REQUESTED', 'APPROVED', 'PICKED', 'SHIPPED', 'RECEIVED'];

const ShipmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: shipment, isLoading } = useShipment(id ?? '');
  const approve = useApproveShipment();
  const pick = usePickShipment();
  const ship = useShipShipment();
  const receive = useReceiveShipment();

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!shipment) return null;

  const currentStep = (() => {
    const status = shipment.status === 'IN_TRANSIT' ? 'SHIPPED' : shipment.status;
    const idx = STATUS_ORDER.indexOf(status);
    return idx >= 0 ? idx : 0;
  })();

  const handleAction = async (action: 'approve' | 'pick' | 'ship' | 'receive') => {
    try {
      const fns = { approve, pick, ship, receive };
      await fns[action].mutateAsync({ id: shipment.id });
      message.success('Status updated');
    } catch {
      message.error('Action failed');
    }
  };

  const nextAction = (): { label: string; action: 'approve' | 'pick' | 'ship' | 'receive' } | null => {
    const map: Record<string, { label: string; action: 'approve' | 'pick' | 'ship' | 'receive' }> = {
      REQUESTED: { label: 'Approve', action: 'approve' },
      APPROVED: { label: 'Pick', action: 'pick' },
      PICKED: { label: 'Ship', action: 'ship' },
      SHIPPED: { label: 'Receive', action: 'receive' },
      IN_TRANSIT: { label: 'Receive', action: 'receive' },
    };
    return map[shipment.status] ?? null;
  };

  const action = nextAction();

  return (
    <div>
      <PageHeader
        title={`Shipment ${(id ?? '').slice(0, 8)}`}
        subtitle={<StatusBadge status={shipment.status} />}
        breadcrumbs={[{ label: 'Shipments', path: '/shipments' }, { label: (id ?? '').slice(0, 8) }]}
        extra={
          action && (
            <Popconfirm title={`${action.label} this shipment?`} onConfirm={() => handleAction(action.action)}>
              <Button type="primary">{action.label}</Button>
            </Popconfirm>
          )
        }
      />

      <Card title="Lifecycle" style={{ marginBottom: 16 }}>
        <Steps
          current={currentStep}
          status={shipment.status === 'CANCELLED' ? 'error' : undefined}
          items={[
            {
              title: 'Requested',
              description: shipment.requested_at ? dayjs(shipment.requested_at).format('MMM D, HH:mm') : undefined,
              subTitle: shipment.requested_by,
            },
            {
              title: 'Approved',
              description: shipment.approved_at ? dayjs(shipment.approved_at).format('MMM D, HH:mm') : undefined,
              subTitle: shipment.approved_by,
            },
            { title: 'Picked' },
            {
              title: 'Shipped',
              description: shipment.shipped_at ? dayjs(shipment.shipped_at).format('MMM D, HH:mm') : undefined,
            },
            {
              title: 'Received',
              description: shipment.received_at ? dayjs(shipment.received_at).format('MMM D, HH:mm') : undefined,
            },
          ]}
        />
      </Card>

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Card title="Details">
          <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
            <Descriptions.Item label="From Node">{String(shipment.from_node_id).slice(0, 8)}</Descriptions.Item>
            <Descriptions.Item label="To Node">{String(shipment.to_node_id).slice(0, 8)}</Descriptions.Item>
            <Descriptions.Item label="Status"><StatusBadge status={shipment.status} /></Descriptions.Item>
            <Descriptions.Item label="Lane">{shipment.lane_id ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Tracking #">{shipment.tracking_number ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Courier">{shipment.courier ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Temperature">{shipment.temperature_req ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Notes">{shipment.notes ?? '—'}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Items">
          <Table
            dataSource={shipment.items}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: 'Lot ID', dataIndex: 'lot_id', render: (v: string) => v.slice(0, 8) },
              { title: 'Product', dataIndex: 'product_id' },
              { title: 'Presentation', dataIndex: 'presentation_id', render: (v: string | null) => v ?? '—' },
              { title: 'Qty', dataIndex: 'qty', align: 'right' as const },
            ]}
          />
        </Card>
      </Space>
    </div>
  );
};

export default ShipmentDetailPage;
