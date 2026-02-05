import React, { useState, useMemo } from 'react';
import { Card, Select, Row, Col, Space, Typography, Spin, Alert } from 'antd';
import { useSearchParams } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useScenarios, useVersions } from '../../hooks/useScenarios';
import { useForecastCompare } from '../../hooks/useForecast';
import PageHeader from '../../components/PageHeader';

const ForecastComparePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [scenarioId, setScenarioId] = useState(searchParams.get('scenario_id') ?? '');
  const [versionA, setVersionA] = useState(Number(searchParams.get('a')) || 0);
  const [versionB, setVersionB] = useState(Number(searchParams.get('b')) || 0);

  const { data: scenarios } = useScenarios();
  const { data: versions } = useVersions(scenarioId);
  const { data: comparison, isLoading, error } = useForecastCompare({
    scenario_id: scenarioId,
    a: versionA,
    b: versionB,
  });

  const updateParams = (sid: string, a: number, b: number) => {
    setScenarioId(sid);
    setVersionA(a);
    setVersionB(b);
    if (sid && a && b) {
      setSearchParams({ scenario_id: sid, a: String(a), b: String(b) });
    }
  };

  const enrollmentData = useMemo(() => {
    if (!comparison) return [];
    return comparison.bucket_dates.map((d, i) => ({
      bucket: d,
      [`v${comparison.a_version}`]: comparison.a_cumulative_enrolled[i],
      [`v${comparison.b_version}`]: comparison.b_cumulative_enrolled[i],
    }));
  }, [comparison]);

  const deltaSkus = comparison ? Object.keys(comparison.delta_demand) : [];
  const deltaDemandData = useMemo(() => {
    if (!comparison) return [];
    return comparison.bucket_dates.map((d, i) => {
      const row: Record<string, unknown> = { bucket: d };
      deltaSkus.forEach((sku) => {
        row[sku] = comparison.delta_demand[sku][i] ?? 0;
      });
      return row;
    });
  }, [comparison, deltaSkus]);

  const COLORS = ['#1677ff', '#ff4d4f', '#52c41a', '#faad14', '#722ed1', '#13c2c2'];

  return (
    <div>
      <PageHeader
        title="Compare Forecasts"
        subtitle="Side-by-side comparison of two scenario versions"
        breadcrumbs={[{ label: 'Forecast', path: '/forecast' }, { label: 'Compare' }]}
      />

      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap>
          <div>
            <Typography.Text type="secondary">Scenario</Typography.Text>
            <br />
            <Select
              placeholder="Select scenario"
              style={{ width: 260 }}
              value={scenarioId || undefined}
              onChange={(v) => updateParams(v, 0, 0)}
              options={(scenarios ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.trial_code})` }))}
              showSearch
              filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
          </div>
          <div>
            <Typography.Text type="secondary">Version A</Typography.Text>
            <br />
            <Select
              placeholder="Version A"
              style={{ width: 160 }}
              value={versionA || undefined}
              onChange={(v) => updateParams(scenarioId, v, versionB)}
              disabled={!scenarioId}
              options={(versions ?? []).map((v) => ({ value: v.version, label: `v${v.version}${v.label ? ` — ${v.label}` : ''}` }))}
            />
          </div>
          <div>
            <Typography.Text type="secondary">Version B</Typography.Text>
            <br />
            <Select
              placeholder="Version B"
              style={{ width: 160 }}
              value={versionB || undefined}
              onChange={(v) => updateParams(scenarioId, versionA, v)}
              disabled={!scenarioId}
              options={(versions ?? []).map((v) => ({ value: v.version, label: `v${v.version}${v.label ? ` — ${v.label}` : ''}` }))}
            />
          </div>
        </Space>
      </Card>

      {isLoading && <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>}

      {error && <Alert type="error" message="Failed to load comparison" showIcon />}

      {!comparison && !isLoading && !error && (
        <Card>
          <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
            Select a scenario and two versions to compare their forecast outputs.
          </div>
        </Card>
      )}

      {comparison && (
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Card title={`Enrollment Comparison (v${comparison.a_version} vs v${comparison.b_version})`} extra={`Engine: ${comparison.engine_version}`}>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={enrollmentData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey={`v${comparison.a_version}`} stroke="#1677ff" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={`v${comparison.b_version}`} stroke="#fa8c16" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24}>
            <Card title="Delta Demand by SKU">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={deltaDemandData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {deltaSkus.map((sku, i) => (
                    <Bar key={sku} dataKey={sku} fill={COLORS[i % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default ForecastComparePage;
