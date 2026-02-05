import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Popconfirm, message } from 'antd';
import { PlusOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { useScenarios, useCreateScenario, useDeleteScenario } from '../../hooks/useScenarios';
import type { Scenario, ScenarioCreate } from '../../types/scenario';

const ScenariosListPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: scenarios, isLoading } = useScenarios();
  const createScenario = useCreateScenario();
  const deleteScenario = useDeleteScenario();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<ScenarioCreate>();

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteScenario.mutateAsync(id);
      message.success('Scenario deleted');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail ?? 'Failed to delete scenario');
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createScenario.mutateAsync(values);
      message.success('Scenario created successfully');
      form.resetFields();
      setModalOpen(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      if (detail) {
        const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((e: { msg?: string }) => e.msg).join('; ') : 'Creation failed';
        message.error(msg);
      }
    }
  };

  const columns: ColumnsType<Scenario> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Trial Code',
      dataIndex: 'trial_code',
      key: 'trial_code',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string | null) => text ?? '—',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      defaultSortOrder: 'descend',
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/scenarios/${record.id}`);
            }}
          >
            View
          </Button>
          <Popconfirm
            title="Delete scenario?"
            description="This will delete the scenario and all its versions. This cannot be undone."
            onConfirm={(e) => handleDelete(record.id, e as unknown as React.MouseEvent)}
            onCancel={(e) => e?.stopPropagation()}
            okText="Delete"
            okType="danger"
          >
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            >
              Delete
            </Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Scenarios"
        subtitle="Manage clinical supply scenarios and forecast configurations"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Create Scenario
          </Button>
        }
      />

      {!isLoading && (!scenarios || scenarios.length === 0) ? (
        <EmptyState
          description="No scenarios yet. Create your first scenario to get started."
          actionLabel="Create Scenario"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <Table<Scenario>
          rowKey="id"
          columns={columns}
          dataSource={scenarios}
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          onRow={(record) => ({
            onClick: () => navigate(`/scenarios/${record.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      )}

      <Modal
        title="Create Scenario"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => {
          form.resetFields();
          setModalOpen(false);
        }}
        confirmLoading={createScenario.isPending}
        okText="Create"
      >
        <Form form={form} layout="vertical" autoComplete="off">
          <Form.Item
            name="trial_code"
            label="Trial Code"
            rules={[{ required: true, message: 'Trial code is required' }]}
          >
            <Input placeholder="e.g. TRIAL-001" />
          </Form.Item>
          <Form.Item
            name="name"
            label="Scenario Name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input placeholder="e.g. Base Case" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional description" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ScenariosListPage;
