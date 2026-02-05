import React from 'react';
import { Row, Col, Card, Statistic, Alert, Timeline, Button, Space, Spin } from 'antd';
import {
  ExperimentOutlined,
  LineChartOutlined,
  InboxOutlined,
  SendOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useScenarios } from '../../hooks/useScenarios';
import { useShipments } from '../../hooks/useShipments';
import { usePositions } from '../../hooks/useInventory';
import { useAuditLogs } from '../../hooks/useAdmin';
import PageHeader from '../../components/PageHeader';
import dayjs from 'dayjs';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: scenarios, isLoading: loadingScenarios } = useScenarios();
  const { data: shipments, isLoading: loadingShipments } = useShipments();
  const { data: positions, isLoading: loadingPositions } = usePositions();
  const { data: auditLogs } = useAuditLogs();

  const totalUnits = positions?.reduce((sum, p) => sum + p.total_qty, 0) ?? 0;
  const pendingShipments = shipments?.filter((s) => s.status === 'REQUESTED').length ?? 0;

  const recentLogs = (auditLogs ?? []).slice(0, 8);

  if (loadingScenarios || loadingShipments || loadingPositions) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Clinical supply chain overview"
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/scenarios/new')}>
              Create Scenario
            </Button>
            <Button icon={<ThunderboltOutlined />} onClick={() => navigate('/forecast')}>
              Run Forecast
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card hoverable onClick={() => navigate('/scenarios')}>
            <Statistic
              title="Active Scenarios"
              value={scenarios?.length ?? 0}
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable onClick={() => navigate('/forecast')}>
            <Statistic
              title="Forecast Runs"
              value="-"
              prefix={<LineChartOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable onClick={() => navigate('/inventory')}>
            <Statistic
              title="Inventory Units"
              value={totalUnits}
              prefix={<InboxOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable onClick={() => navigate('/shipments')}>
            <Statistic
              title="Pending Shipments"
              value={pendingShipments}
              prefix={<SendOutlined />}
              valueStyle={{ color: pendingShipments > 0 ? '#faad14' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="Enrollment Trend" styles={{ body: { height: 320 } }}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={[]} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="enrolled" stroke="#1677ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            {(!scenarios || scenarios.length === 0) && (
              <div style={{ textAlign: 'center', color: '#999', marginTop: -160 }}>
                Run a forecast to see enrollment data
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Stockout Alerts" styles={{ body: { maxHeight: 320, overflow: 'auto' } }}>
            <Alert
              message="No active alerts"
              description="Generate a supply plan to check for potential stockouts."
              type="info"
              showIcon
              icon={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title="Recent Activity">
            {recentLogs.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>No recent activity</div>
            ) : (
              <Timeline
                items={recentLogs.map((log) => ({
                  children: (
                    <div>
                      <strong>{log.action}</strong>
                      {log.resource_type && <span> on {log.resource_type}</span>}
                      {log.username && <span style={{ color: '#999' }}> by {log.username}</span>}
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {dayjs(log.created_at).format('MMM D, YYYY h:mm A')}
                      </div>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
