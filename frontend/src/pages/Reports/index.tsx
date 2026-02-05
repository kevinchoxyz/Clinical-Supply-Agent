import React, { useState } from 'react';
import { Card, Row, Col, Button, Input, Slider, Typography, message, Alert } from 'antd';
import { DownloadOutlined, InboxOutlined, LineChartOutlined, WarningOutlined, BarChartOutlined } from '@ant-design/icons';
import {
  useDownloadInventoryReport,
  useDownloadForecastReport,
  useDownloadExpiryRiskReport,
  useDownloadLotUtilReport,
} from '../../hooks/useReports';
import { useStudyContext } from '../../context/StudyContext';
import { useStudy } from '../../hooks/useStudies';
import PageHeader from '../../components/PageHeader';

const ReportsPage: React.FC = () => {
  const [forecastRunId, setForecastRunId] = useState('');
  const [expiryDays, setExpiryDays] = useState(90);
  const { selectedStudyId } = useStudyContext();
  const { data: selectedStudy } = useStudy(selectedStudyId ?? '');

  const inventoryDl = useDownloadInventoryReport();
  const forecastDl = useDownloadForecastReport();
  const expiryDl = useDownloadExpiryRiskReport();
  const lotUtilDl = useDownloadLotUtilReport();

  const handleDownload = async (fn: () => Promise<void>, label: string) => {
    try {
      await fn();
      message.success(`${label} downloaded`);
    } catch {
      message.error(`Failed to download ${label}`);
    }
  };

  return (
    <div>
      <PageHeader title="Reports" subtitle="Export data as CSV" />

      {selectedStudy && (
        <Alert
          type="info"
          showIcon
          message={`Showing reports for study: ${selectedStudy.study_code} — ${selectedStudy.name}`}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card
            hoverable
            styles={{ body: { textAlign: 'center', padding: 32 } }}
          >
            <InboxOutlined style={{ fontSize: 40, color: '#1677ff', marginBottom: 12 }} />
            <Typography.Title level={5}>Inventory Report</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ minHeight: 44 }}>
              Current inventory positions across all nodes and lots.
            </Typography.Paragraph>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={inventoryDl.isPending}
              onClick={() => handleDownload(() => inventoryDl.mutateAsync(), 'Inventory report')}
            >
              Download CSV
            </Button>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card
            hoverable
            styles={{ body: { textAlign: 'center', padding: 32 } }}
          >
            <LineChartOutlined style={{ fontSize: 40, color: '#52c41a', marginBottom: 12 }} />
            <Typography.Title level={5}>Forecast Report</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ minHeight: 44 }}>
              Demand forecast results by SKU and time bucket.
            </Typography.Paragraph>
            <Input
              placeholder="Forecast Run ID"
              value={forecastRunId}
              onChange={(e) => setForecastRunId(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={forecastDl.isPending}
              disabled={!forecastRunId}
              onClick={() => handleDownload(() => forecastDl.mutateAsync(forecastRunId), 'Forecast report')}
            >
              Download CSV
            </Button>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card
            hoverable
            styles={{ body: { textAlign: 'center', padding: 32 } }}
          >
            <WarningOutlined style={{ fontSize: 40, color: '#faad14', marginBottom: 12 }} />
            <Typography.Title level={5}>Expiry Risk Report</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ minHeight: 44 }}>
              Lots approaching expiration within the threshold.
            </Typography.Paragraph>
            <div style={{ marginBottom: 8 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Days threshold: {expiryDays}
              </Typography.Text>
              <Slider min={7} max={365} value={expiryDays} onChange={setExpiryDays} />
            </div>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={expiryDl.isPending}
              onClick={() => handleDownload(() => expiryDl.mutateAsync({ days_threshold: expiryDays }), 'Expiry risk report')}
            >
              Download CSV
            </Button>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card
            hoverable
            styles={{ body: { textAlign: 'center', padding: 32 } }}
          >
            <BarChartOutlined style={{ fontSize: 40, color: '#722ed1', marginBottom: 12 }} />
            <Typography.Title level={5}>Lot Utilization Report</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ minHeight: 44 }}>
              Lot usage and turnover metrics across all sites.
            </Typography.Paragraph>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={lotUtilDl.isPending}
              onClick={() => handleDownload(() => lotUtilDl.mutateAsync(), 'Lot utilization report')}
            >
              Download CSV
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ReportsPage;
