import React, { useState } from 'react';
import {
  Tabs,
  Card,
  Descriptions,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Spin,
  message,
} from 'antd';
import {
  BranchesOutlined,
  EditOutlined,
  ExportOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate, Link } from 'react-router-dom';
import dayjs from 'dayjs';

import PageHeader from '../../components/PageHeader';
import VersionTimeline from './components/VersionTimeline';
import {
  useScenario,
  useVersions,
  useLatestVersion,
  useForkVersion,
} from '../../hooks/useScenarios';
import { useStudy } from '../../hooks/useStudies';
import type { ScenarioVersion, ForkRequest } from '../../types/scenario';

const ScenarioDetail: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: scenario, isLoading: scenarioLoading, isError: scenarioError } = useScenario(id);
  const { data: versions, isLoading: versionsLoading } = useVersions(id);
  const { data: latestVersion } = useLatestVersion(id);
  const { data: linkedStudy } = useStudy(scenario?.study_id ?? '');

  const [forkTarget, setForkTarget] = useState<ScenarioVersion | null>(null);
  const [forkForm] = Form.useForm();

  // We call the hook at top level with the fork target info
  const forkVersion = useForkVersion(
    id,
    forkTarget?.version ?? 0,
  );

  const handleFork = async () => {
    if (!forkTarget) return;
    try {
      const values = await forkForm.validateFields();
      const payload: ForkRequest = {
        label: values.label || undefined,
        override: values.override ? JSON.parse(values.override) : {},
      };
      await forkVersion.mutateAsync(payload);
      message.success('Version forked successfully');
      forkForm.resetFields();
      setForkTarget(null);
    } catch (err) {
      if (err instanceof SyntaxError) {
        message.error('Override JSON is invalid');
      }
    }
  };

  const handleExport = (version: ScenarioVersion) => {
    // Open the version detail endpoint in a new tab for JSON download
    const url = `/api/v1/scenarios/${id}/versions/${version.version}/export`;
    window.open(url, '_blank');
  };

  if (scenarioLoading) {
    return <Spin size="large" style={{ display: 'block', marginTop: 120, textAlign: 'center' }} />;
  }

  if (scenarioError || !scenario) {
    return <div>Scenario not found.</div>;
  }

  const overviewTab = (
    <Card bordered={false}>
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="Trial Code">{scenario.trial_code}</Descriptions.Item>
        <Descriptions.Item label="Name">{scenario.name}</Descriptions.Item>
        <Descriptions.Item label="Description" span={2}>
          {scenario.description ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Study">
          {linkedStudy ? (
            <Link to={`/studies/${linkedStudy.id}`}>
              {linkedStudy.study_code} — {linkedStudy.name}
            </Link>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Created At">
          {dayjs(scenario.created_at).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
        <Descriptions.Item label="Latest Version">
          {latestVersion ? `v${latestVersion.version}` : '—'}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );

  const versionsTab = (
    <Spin spinning={versionsLoading}>
      {versions && versions.length > 0 ? (
        <VersionTimeline
          versions={versions}
          latestVersion={latestVersion?.version}
          renderActions={(v) => (
            <Space size="small">
              <Button
                size="small"
                type="link"
                onClick={() => {
                  const url = `/api/v1/scenarios/${id}/versions/${v.version}/export`;
                  window.open(url, '_blank');
                }}
              >
                View JSON
              </Button>
              <Button
                size="small"
                type="link"
                icon={<EditOutlined />}
                onClick={() => navigate(`/scenarios/new?scenarioId=${id}&version=${v.version}`)}
              >
                Edit
              </Button>
              <Button
                size="small"
                type="link"
                icon={<BranchesOutlined />}
                onClick={() => setForkTarget(v)}
              >
                Fork
              </Button>
              <Button
                size="small"
                type="link"
                icon={<ExportOutlined />}
                onClick={() => handleExport(v)}
              >
                Export
              </Button>
            </Space>
          )}
        />
      ) : (
        <Card bordered={false}>
          <p>No versions yet. Use the wizard to create the first version.</p>
          <Button
            type="primary"
            onClick={() => navigate(`/scenarios/new?scenarioId=${id}`)}
          >
            Create Version
          </Button>
        </Card>
      )}
    </Spin>
  );

  const forecastTab = (
    <Card bordered={false}>
      <p>Run a demand forecast based on the latest version of this scenario.</p>
      <Link to={`/forecast?scenario_id=${id}`}>
        <Button type="primary" icon={<ThunderboltOutlined />}>
          Run Forecast
        </Button>
      </Link>
    </Card>
  );

  const tabItems = [
    { key: 'overview', label: 'Overview', children: overviewTab },
    { key: 'versions', label: 'Versions', children: versionsTab },
    { key: 'forecast', label: 'Forecast', children: forecastTab },
  ];

  return (
    <>
      <PageHeader
        title={scenario.name}
        subtitle={`Trial ${scenario.trial_code}`}
        breadcrumbs={[
          { label: 'Scenarios', path: '/scenarios' },
          { label: scenario.name },
        ]}
        extra={
          <Button type="primary" onClick={() => navigate(`/scenarios/new?scenarioId=${id}`)}>
            New Version
          </Button>
        }
      />

      <Tabs defaultActiveKey="overview" items={tabItems} />

      {/* Fork Dialog */}
      <Modal
        title={`Fork Version ${forkTarget?.version ?? ''}`}
        open={forkTarget !== null}
        onOk={handleFork}
        onCancel={() => {
          forkForm.resetFields();
          setForkTarget(null);
        }}
        confirmLoading={forkVersion.isPending}
        okText="Fork"
      >
        <Form form={forkForm} layout="vertical" autoComplete="off">
          <Form.Item name="label" label="Version Label">
            <Input placeholder="e.g. Sensitivity - High Enrollment" />
          </Form.Item>
          <Form.Item
            name="override"
            label="Payload Override (JSON)"
            help="Provide a JSON object with the fields you want to override in the forked payload."
          >
            <Input.TextArea rows={8} placeholder='{ "assumptions": { "global_overage_factor": 1.3 } }' />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ScenarioDetail;
