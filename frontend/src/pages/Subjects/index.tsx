import React, { useState } from 'react';
import { Card, Table, Button, Radio, Modal, Form, Input, Select, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useSubjects, useCreateSubject } from '../../hooks/useSubjects';
import { useScenarios } from '../../hooks/useScenarios';
import { useStudyContext } from '../../context/StudyContext';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import type { Subject } from '../../types/subject';

const STATUSES = ['ALL', 'SCREENED', 'ENROLLED', 'ACTIVE', 'COMPLETED', 'DISCONTINUED'];

const SubjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [form] = Form.useForm();

  const { selectedStudyId } = useStudyContext();
  const params = statusFilter !== 'ALL' ? { status: statusFilter } : undefined;
  const { data: subjects, isLoading } = useSubjects(params);
  const { data: scenarios } = useScenarios(selectedStudyId ? { study_id: selectedStudyId } : undefined);
  const createSubject = useCreateSubject();

  const handleEnroll = async (values: Record<string, string>) => {
    try {
      await createSubject.mutateAsync({
        subject_number: values.subject_number,
        scenario_id: values.scenario_id || undefined,
        cohort_id: values.cohort_id || undefined,
        arm_id: values.arm_id || undefined,
        site_node_id: values.site_node_id || undefined,
        notes: values.notes || undefined,
      });
      message.success('Subject enrolled');
      setEnrollOpen(false);
      form.resetFields();
    } catch {
      message.error('Failed to enroll subject');
    }
  };

  return (
    <div>
      <PageHeader
        title="Subjects"
        subtitle="Manage clinical trial subjects"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEnrollOpen(true)}>
            Enroll Subject
          </Button>
        }
      />

      <Card>
        <Radio.Group
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          buttonStyle="solid"
          style={{ marginBottom: 16 }}
        >
          {STATUSES.map((s) => (
            <Radio.Button key={s} value={s}>{s === 'ALL' ? 'All' : s}</Radio.Button>
          ))}
        </Radio.Group>

        <Table
          dataSource={
            selectedStudyId && scenarios
              ? (subjects ?? []).filter((s) => {
                  const scenarioIds = new Set(scenarios.map((sc) => sc.id));
                  return s.scenario_id && scenarioIds.has(s.scenario_id);
                })
              : (subjects ?? [])
          }
          loading={isLoading}
          rowKey="id"
          onRow={(r) => ({ onClick: () => navigate(`/subjects/${r.id}`), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Subject #', dataIndex: 'subject_number', sorter: (a: Subject, b: Subject) => a.subject_number.localeCompare(b.subject_number) },
            { title: 'Cohort', dataIndex: 'cohort_id', render: (v: string | null) => v ?? '—' },
            { title: 'Arm', dataIndex: 'arm_id', render: (v: string | null) => v ?? '—' },
            { title: 'Site', dataIndex: 'site_node_id', render: (v: string | null) => v ? String(v).slice(0, 8) : '—' },
            { title: 'Status', dataIndex: 'status', render: (v: string) => <StatusBadge status={v} /> },
            { title: 'Screened', dataIndex: 'screened_at', render: (v: string | null) => v ? dayjs(v).format('MMM D, YYYY') : '—' },
            { title: 'Enrolled', dataIndex: 'enrolled_at', render: (v: string | null) => v ? dayjs(v).format('MMM D, YYYY') : '—' },
          ]}
        />
      </Card>

      <Modal
        title="Enroll Subject"
        open={enrollOpen}
        onCancel={() => { setEnrollOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createSubject.isPending}
      >
        <Form form={form} layout="vertical" onFinish={handleEnroll}>
          <Form.Item name="subject_number" label="Subject Number" rules={[{ required: true }]}>
            <Input placeholder="e.g. SUBJ-001" />
          </Form.Item>
          <Form.Item name="scenario_id" label="Scenario">
            <Select
              allowClear
              placeholder="Select scenario"
              options={(scenarios ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.trial_code})` }))}
            />
          </Form.Item>
          <Form.Item name="cohort_id" label="Cohort ID">
            <Input placeholder="e.g. COHORT-1" />
          </Form.Item>
          <Form.Item name="arm_id" label="Arm ID">
            <Input placeholder="e.g. ARM-A" />
          </Form.Item>
          <Form.Item name="site_node_id" label="Site Node ID">
            <Input placeholder="Logical node ID of the site" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SubjectsPage;
