import React from 'react';
import { Card, Table, Button, Tag, Space, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useStudies, useDeleteStudy } from '../../hooks/useStudies';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import type { Study } from '../../types/study';

const StudiesPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: studies, isLoading } = useStudies();
  const deleteStudy = useDeleteStudy();

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteStudy.mutateAsync(id);
      message.success('Study deleted');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail ?? 'Failed to delete study');
    }
  };

  const columns = [
    {
      title: 'Study Code',
      dataIndex: 'study_code',
      key: 'study_code',
      sorter: (a: Study, b: Study) => a.study_code.localeCompare(b.study_code),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Phase',
      dataIndex: 'phase',
      key: 'phase',
      render: (v: string | null) => v ? <Tag color="blue">{v}</Tag> : '—',
    },
    {
      title: 'Countries',
      dataIndex: 'countries',
      key: 'countries',
      render: (v: string[] | null) =>
        v && v.length > 0 ? (
          <Space size={4} wrap>
            {v.map((c) => (
              <Tag key={c}>{c}</Tag>
            ))}
          </Space>
        ) : (
          '—'
        ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => dayjs(v).format('MMM D, YYYY'),
      sorter: (a: Study, b: Study) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: Study) => (
        <Popconfirm
          title="Delete study?"
          description="This cannot be undone. Studies with linked scenarios cannot be deleted."
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
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Studies"
        subtitle="Manage protocol-level study definitions"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/studies/new')}>
            Create Study
          </Button>
        }
      />

      <Card>
        <Table
          dataSource={studies ?? []}
          loading={isLoading}
          rowKey="id"
          columns={columns}
          onRow={(r) => ({
            onClick: () => navigate(`/studies/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          locale={{
            emptyText: (
              <EmptyState
                description="No studies found"
                actionLabel="Create Study"
                onAction={() => navigate('/studies/new')}
              />
            ),
          }}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>
    </div>
  );
};

export default StudiesPage;
