import React, { useMemo } from 'react';
import { Card, Tabs, Spin, Alert, Table } from 'antd';
import { useParams } from 'react-router-dom';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useForecastRun } from '../../hooks/useForecast';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];

const ForecastResultsPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const { data: run, isLoading } = useForecastRun(runId ?? '');

  const demandData = useMemo(() => {
    if (!run?.outputs) return [];
    const { bucket_dates } = run.outputs;
    const demandMap = run.outputs.demand_per_bucket ?? run.outputs.demand ?? {};
    return bucket_dates.map((d: string, i: number) => {
      const row: Record<string, unknown> = { bucket: d };
      Object.entries(demandMap).forEach(([sku, vals]) => {
        row[sku] = (vals as number[])[i] ?? 0;
      });
      return row;
    });
  }, [run]);

  const enrollmentData = useMemo(() => {
    if (!run?.outputs) return [];
    return run.outputs.bucket_dates.map((d, i) => ({
      bucket: d,
      enrolled: run.outputs!.cumulative_enrolled[i] ?? 0,
      perBucket: run.outputs!.enrolled_per_bucket[i] ?? 0,
    }));
  }, [run]);

  const skus = run?.outputs ? Object.keys(run.outputs.demand_per_bucket ?? run.outputs.demand ?? {}) : [];

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  if (!run) {
    return <Alert type="error" message="Forecast run not found" showIcon />;
  }

  return (
    <div>
      <PageHeader
        title={`Forecast Run`}
        subtitle={<><StatusBadge status={run.status} /> Engine: {run.engine_version}</>}
        breadcrumbs={[
          { label: 'Forecast', path: '/forecast' },
          { label: `Run ${(runId ?? '').slice(0, 8)}` },
        ]}
      />

      {run.status === 'RUNNING' && (
        <Card><div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" tip="Forecast is running..." /></div></Card>
      )}

      {run.status === 'FAILED' && (
        <Alert type="error" message="Forecast Failed" description="The forecast run encountered an error." showIcon />
      )}

      {run.status === 'SUCCESS' && run.outputs && (
        <Tabs
          defaultActiveKey="demand"
          items={[
            {
              key: 'demand',
              label: 'Demand',
              children: (
                <Card title="Demand by SKU">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={demandData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bucket" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {skus.map((sku, i) => (
                        <Line
                          key={sku}
                          type="monotone"
                          dataKey={sku}
                          stroke={COLORS[i % COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              ),
            },
            {
              key: 'enrollment',
              label: 'Enrollment',
              children: (
                <Card title="Cumulative Enrollment">
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={enrollmentData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bucket" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="enrolled" stroke="#1677ff" fill="#1677ff" fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              ),
            },
            {
              key: 'visits',
              label: 'Visits',
              children: (
                <Card title="Visits per Bucket">
                  {run.outputs.visits_per_bucket ? (
                    <Table
                      dataSource={run.outputs.bucket_dates.map((d, i) => ({
                        key: i,
                        bucket: d,
                        visits: run.outputs!.visits_per_bucket![i] ?? 0,
                        enrolled: run.outputs!.enrolled_per_bucket[i] ?? 0,
                      }))}
                      columns={[
                        { title: 'Bucket', dataIndex: 'bucket', key: 'bucket' },
                        { title: 'Visits', dataIndex: 'visits', key: 'visits', align: 'right' as const },
                        { title: 'New Enrolled', dataIndex: 'enrolled', key: 'enrolled', align: 'right' as const },
                      ]}
                      pagination={{ pageSize: 20 }}
                      size="small"
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#999', padding: 48 }}>
                      Visit data not available for this forecast run
                    </div>
                  )}
                </Card>
              ),
            },
          ]}
        />
      )}
    </div>
  );
};

export default ForecastResultsPage;
