import React, { useState } from 'react';
import { Card, Descriptions, Steps, Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Spin, Space, message } from 'antd';
import { PlusOutlined, MedicineBoxOutlined, RollbackOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { useSubject, useVisits, useCreateVisit, useDispenseKit, useKits, useReturnKit } from '../../hooks/useSubjects';
import { useLots } from '../../hooks/useInventory';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import type { SubjectVisit } from '../../types/subject';

const SubjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: subject, isLoading } = useSubject(id ?? '');
  const { data: visits } = useVisits(id ?? '');
  const { data: lots } = useLots();

  const [selectedVisit, setSelectedVisit] = useState<SubjectVisit | null>(null);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [dispenseOpen, setDispenseOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnKitId, setReturnKitId] = useState('');

  const [visitForm] = Form.useForm();
  const [dispenseForm] = Form.useForm();
  const [returnForm] = Form.useForm();

  const createVisit = useCreateVisit(id ?? '');
  const dispenseKit = useDispenseKit(id ?? '', selectedVisit?.id ?? '');
  const { data: kits } = useKits(id ?? '', selectedVisit?.id ?? '');
  const returnKitMutation = useReturnKit(id ?? '', selectedVisit?.id ?? '');

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!subject) return null;

  const handleCreateVisit = async (values: Record<string, unknown>) => {
    try {
      await createVisit.mutateAsync({
        visit_id: values.visit_id as string,
        scheduled_date: values.scheduled_date ? (values.scheduled_date as dayjs.Dayjs).toISOString() : undefined,
        notes: (values.notes as string) || undefined,
      });
      message.success('Visit scheduled');
      setVisitModalOpen(false);
      visitForm.resetFields();
    } catch {
      message.error('Failed to schedule visit');
    }
  };

  const handleDispense = async (values: Record<string, unknown>) => {
    try {
      await dispenseKit.mutateAsync({
        product_id: values.product_id as string,
        lot_id: (values.lot_id as string) || undefined,
        qty_dispensed: values.qty_dispensed as number,
        dispensed_by: (values.dispensed_by as string) || undefined,
      });
      message.success('Kit dispensed');
      setDispenseOpen(false);
      dispenseForm.resetFields();
    } catch {
      message.error('Failed to dispense kit');
    }
  };

  const handleReturn = async (values: Record<string, unknown>) => {
    try {
      await returnKitMutation.mutateAsync({
        kitId: returnKitId,
        data: { returned_qty: values.returned_qty as number },
      });
      message.success('Kit returned');
      setReturnOpen(false);
      returnForm.resetFields();
    } catch {
      message.error('Failed to return kit');
    }
  };

  const sortedVisits = [...(visits ?? [])].sort(
    (a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''),
  );

  const visitStepStatus = (v: SubjectVisit) => {
    if (v.status === 'COMPLETED') return 'finish' as const;
    if (v.status === 'MISSED' || v.status === 'CANCELLED') return 'error' as const;
    return 'wait' as const;
  };

  return (
    <div>
      <PageHeader
        title={`Subject ${subject.subject_number}`}
        subtitle={<StatusBadge status={subject.status} />}
        breadcrumbs={[{ label: 'Subjects', path: '/subjects' }, { label: subject.subject_number }]}
        extra={
          <Button icon={<PlusOutlined />} onClick={() => setVisitModalOpen(true)}>
            Schedule Visit
          </Button>
        }
      />

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Card title="Subject Information">
          <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
            <Descriptions.Item label="Subject #">{subject.subject_number}</Descriptions.Item>
            <Descriptions.Item label="Status"><StatusBadge status={subject.status} /></Descriptions.Item>
            <Descriptions.Item label="Cohort">{subject.cohort_id ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Arm">{subject.arm_id ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Site">{subject.site_node_id ? String(subject.site_node_id).slice(0, 8) : '—'}</Descriptions.Item>
            <Descriptions.Item label="Screened">{subject.screened_at ? dayjs(subject.screened_at).format('MMM D, YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Enrolled">{subject.enrolled_at ? dayjs(subject.enrolled_at).format('MMM D, YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Notes">{subject.notes ?? '—'}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Visit Timeline">
          {sortedVisits.length > 0 ? (
            <Steps
              direction="horizontal"
              size="small"
              style={{ overflowX: 'auto', padding: '16px 0' }}
              items={sortedVisits.map((v) => ({
                title: v.visit_id,
                status: visitStepStatus(v),
                description: (
                  <div
                    style={{ cursor: 'pointer', fontSize: 11 }}
                    onClick={() => setSelectedVisit(v)}
                  >
                    <StatusBadge status={v.status} />
                    <br />
                    {v.scheduled_date ? dayjs(v.scheduled_date).format('MMM D') : 'No date'}
                  </div>
                ),
              }))}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>
              No visits scheduled. Click "Schedule Visit" to add one.
            </div>
          )}
        </Card>

        {selectedVisit && (
          <Card
            title={`Visit: ${selectedVisit.visit_id}`}
            extra={
              <Button type="primary" icon={<MedicineBoxOutlined />} onClick={() => setDispenseOpen(true)}>
                Dispense Kit
              </Button>
            }
          >
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Status"><StatusBadge status={selectedVisit.status} /></Descriptions.Item>
              <Descriptions.Item label="Scheduled">{selectedVisit.scheduled_date ? dayjs(selectedVisit.scheduled_date).format('MMM D, YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Actual">{selectedVisit.actual_date ? dayjs(selectedVisit.actual_date).format('MMM D, YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Notes">{selectedVisit.notes ?? '—'}</Descriptions.Item>
            </Descriptions>

            <Table
              dataSource={kits ?? []}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'Product', dataIndex: 'product_id' },
                { title: 'Lot', dataIndex: 'lot_id', render: (v: string | null) => v ? v.slice(0, 8) : '—' },
                { title: 'Dispensed', dataIndex: 'qty_dispensed', align: 'right' as const },
                { title: 'Dispensed At', dataIndex: 'dispensed_at', render: (v: string | null) => v ? dayjs(v).format('MMM D, HH:mm') : '—' },
                { title: 'Dispensed By', dataIndex: 'dispensed_by', render: (v: string | null) => v ?? '—' },
                { title: 'Returned', dataIndex: 'returned_qty', align: 'right' as const },
                { title: 'Returned At', dataIndex: 'returned_at', render: (v: string | null) => v ? dayjs(v).format('MMM D, HH:mm') : '—' },
                {
                  title: 'Actions',
                  render: (_: unknown, r: { id: string; returned_qty: number; qty_dispensed: number }) =>
                    r.returned_qty < r.qty_dispensed ? (
                      <Button
                        size="small"
                        icon={<RollbackOutlined />}
                        onClick={() => { setReturnKitId(r.id); setReturnOpen(true); }}
                      >
                        Return
                      </Button>
                    ) : null,
                },
              ]}
            />
          </Card>
        )}
      </Space>

      {/* Schedule Visit Modal */}
      <Modal
        title="Schedule Visit"
        open={visitModalOpen}
        onCancel={() => { setVisitModalOpen(false); visitForm.resetFields(); }}
        onOk={() => visitForm.submit()}
        confirmLoading={createVisit.isPending}
      >
        <Form form={visitForm} layout="vertical" onFinish={handleCreateVisit}>
          <Form.Item name="visit_id" label="Visit ID" rules={[{ required: true }]}>
            <Input placeholder="e.g. VISIT-1" />
          </Form.Item>
          <Form.Item name="scheduled_date" label="Scheduled Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Dispense Kit Modal */}
      <Modal
        title="Dispense Kit"
        open={dispenseOpen}
        onCancel={() => { setDispenseOpen(false); dispenseForm.resetFields(); }}
        onOk={() => dispenseForm.submit()}
        confirmLoading={dispenseKit.isPending}
      >
        <Form form={dispenseForm} layout="vertical" onFinish={handleDispense}>
          <Form.Item name="product_id" label="Product ID" rules={[{ required: true }]}>
            <Input placeholder="e.g. DRUG-A" />
          </Form.Item>
          <Form.Item name="lot_id" label="Lot">
            <Select
              allowClear
              placeholder="Select lot (optional)"
              options={(lots ?? []).map((l) => ({ value: l.id, label: `${l.lot_number} — ${l.product_id} (Qty: ${l.qty_on_hand})` }))}
              showSearch
            />
          </Form.Item>
          <Form.Item name="qty_dispensed" label="Quantity" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="dispensed_by" label="Dispensed By">
            <Input placeholder="Username" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Return Kit Modal */}
      <Modal
        title="Return Kit"
        open={returnOpen}
        onCancel={() => { setReturnOpen(false); returnForm.resetFields(); }}
        onOk={() => returnForm.submit()}
        confirmLoading={returnKitMutation.isPending}
      >
        <Form form={returnForm} layout="vertical" onFinish={handleReturn}>
          <Form.Item name="returned_qty" label="Return Quantity" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SubjectDetailPage;
