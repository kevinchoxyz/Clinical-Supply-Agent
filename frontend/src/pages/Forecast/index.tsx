import React, { useState } from 'react';
import { Card, Select, Button, Row, Col, Space, message, Typography } from 'antd';
import { ThunderboltOutlined, SwapOutlined, ExperimentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useScenarios, useVersions } from '../../hooks/useScenarios';
import { useRunForecast } from '../../hooks/useForecast';
import PageHeader from '../../components/PageHeader';

const ForecastPage: React.FC = () => {
  const navigate = useNavigate();
  const [scenarioId, setScenarioId] = useState<string>('');
  const [version, setVersion] = useState<number | undefined>();
  const { data: scenarios } = useScenarios();
  const { data: versions } = useVersions(scenarioId);
  const runForecast = useRunForecast();

  const handleRun = async () => {
    if (!scenarioId) return;
    try {
      const result = await runForecast.mutateAsync({ scenario_id: scenarioId, version });
      message.success('Forecast started');
      navigate(`/forecast/${result.forecast_run_id}`);
    } catch {
      message.error('Failed to run forecast');
    }
  };

  return (
    <div>
      <PageHeader
        title="Forecast Engine"
        subtitle="Run demand forecasts and compare scenario versions"
        extra={
          <Button icon={<SwapOutlined />} onClick={() => navigate('/forecast/compare')}>
            Compare Versions
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="Run Forecast">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Typography.Text type="secondary">Scenario</Typography.Text>
                <Select
                  placeholder="Select scenario"
                  style={{ width: '100%', marginTop: 4 }}
                  value={scenarioId || undefined}
                  onChange={(v) => { setScenarioId(v); setVersion(undefined); }}
                  options={(scenarios ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.trial_code})` }))}
                  showSearch
                  filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                />
              </div>
              <div>
                <Typography.Text type="secondary">Version (optional)</Typography.Text>
                <Select
                  placeholder="Latest version"
                  style={{ width: '100%', marginTop: 4 }}
                  value={version}
                  onChange={setVersion}
                  allowClear
                  disabled={!scenarioId}
                  options={(versions ?? []).map((v) => ({
                    value: v.version,
                    label: `v${v.version}${v.label ? ` — ${v.label}` : ''}`,
                  }))}
                />
              </div>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleRun}
                loading={runForecast.isPending}
                disabled={!scenarioId}
                block
                size="large"
              >
                Run Forecast
              </Button>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card>
            <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
              <ExperimentOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <Typography.Title level={4} type="secondary">
                Select a scenario to run a forecast
              </Typography.Title>
              <Typography.Paragraph type="secondary">
                The forecast engine will calculate demand projections, enrollment curves,
                and visit schedules based on your scenario configuration.
              </Typography.Paragraph>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ForecastPage;
