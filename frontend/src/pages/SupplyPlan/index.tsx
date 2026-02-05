import React, { useState, useMemo } from "react";
import {
  Select,
  Button,
  Card,
  Table,
  Alert,
  Spin,
  Row,
  Col,
  Typography,
  Space,
} from "antd";
import { WarningOutlined, ExperimentOutlined } from "@ant-design/icons";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { ColumnsType } from "antd/es/table";

import PageHeader from "../../components/PageHeader";
import { useGenerateSupplyPlan } from "../../hooks/useSupplyPlan";
import { useScenarios, useVersions } from "../../hooks/useScenarios";
import { useStudyContext } from "../../context/StudyContext";

import type {
  SupplyPlanRequest,
  SupplyPlanOut,
  PlannedShipment,
  StockoutAlert,
  SafetyStockInfo,
} from "../../types/supplyPlan";

const { Text } = Typography;

const SKU_COLORS = [
  "#1890ff",
  "#52c41a",
  "#fa8c16",
  "#eb2f96",
  "#722ed1",
  "#13c2c2",
  "#f5222d",
  "#faad14",
  "#2f54eb",
  "#a0d911",
];

interface SafetyStockRow {
  key: string;
  sku: string;
  depotSafetyStock: number;
  siteSafetyStock: number;
  reorderPoint: number;
}

const SupplyPlan: React.FC = () => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<
    string | undefined
  >(undefined);
  const [selectedVersionId, setSelectedVersionId] = useState<
    string | undefined
  >(undefined);
  const [planResult, setPlanResult] = useState<SupplyPlanOut | null>(null);

  const { selectedStudyId } = useStudyContext();
  const { data: scenarios, isLoading: scenariosLoading } = useScenarios(selectedStudyId ? { study_id: selectedStudyId } : undefined);
  const { data: versions, isLoading: versionsLoading } = useVersions(
    selectedScenarioId ?? ''
  );

  const generateMutation = useGenerateSupplyPlan();

  const handleScenarioChange = (value: string) => {
    setSelectedScenarioId(value);
    setSelectedVersionId(undefined);
    setPlanResult(null);
  };

  const handleVersionChange = (value: string) => {
    setSelectedVersionId(value);
    setPlanResult(null);
  };

  const handleGenerate = () => {
    if (!selectedVersionId) return;

    const request: SupplyPlanRequest = {
      scenario_version_id: selectedVersionId,
    };

    generateMutation.mutate(request, {
      onSuccess: (data: SupplyPlanOut) => {
        setPlanResult(data);
      },
    });
  };

  // Build chart data: one object per bucket date with a key per SKU
  const chartData = useMemo(() => {
    if (!planResult) return [];

    const { bucket_dates, projected_inventory } = planResult;
    return bucket_dates.map((date, idx) => {
      const point: Record<string, string | number> = { date };
      for (const sku of Object.keys(projected_inventory)) {
        point[sku] = projected_inventory[sku][idx] ?? 0;
      }
      return point;
    });
  }, [planResult]);

  const skuList = useMemo(() => {
    if (!planResult) return [];
    return Object.keys(planResult.projected_inventory);
  }, [planResult]);

  // Safety stock table data
  const safetyStockData: SafetyStockRow[] = useMemo(() => {
    if (!planResult?.safety_stock) return [];
    return Object.entries(planResult.safety_stock).map(
      ([sku, info]: [string, SafetyStockInfo]) => ({
        key: sku,
        sku,
        depotSafetyStock: info.depot_safety_stock,
        siteSafetyStock: info.site_safety_stock,
        reorderPoint: info.reorder_point,
      })
    );
  }, [planResult]);

  const safetyStockColumns: ColumnsType<SafetyStockRow> = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      sorter: (a, b) => a.sku.localeCompare(b.sku),
    },
    {
      title: "Depot Safety Stock",
      dataIndex: "depotSafetyStock",
      key: "depotSafetyStock",
      align: "right",
      render: (val: number) => val.toLocaleString(),
    },
    {
      title: "Site Safety Stock",
      dataIndex: "siteSafetyStock",
      key: "siteSafetyStock",
      align: "right",
      render: (val: number) => val.toLocaleString(),
    },
    {
      title: "Reorder Point",
      dataIndex: "reorderPoint",
      key: "reorderPoint",
      align: "right",
      render: (val: number) => val.toLocaleString(),
    },
  ];

  const shipmentColumns: ColumnsType<PlannedShipment & { key: string }> = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      sorter: (a, b) => a.sku.localeCompare(b.sku),
    },
    {
      title: "Order Date",
      dataIndex: "order_date",
      key: "order_date",
      render: (val: string | null) => val ?? "N/A",
    },
    {
      title: "Delivery Date",
      dataIndex: "delivery_date",
      key: "delivery_date",
      render: (val: string | null) => val ?? "N/A",
    },
    {
      title: "Qty",
      dataIndex: "qty",
      key: "qty",
      align: "right",
      render: (val: number) => val.toLocaleString(),
      sorter: (a, b) => a.qty - b.qty,
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
    },
  ];

  const shipmentData = useMemo(() => {
    if (!planResult?.planned_shipments) return [];
    return planResult.planned_shipments.map((s, idx) => ({
      ...s,
      key: `${s.sku}-${s.order_date}-${idx}`,
    }));
  }, [planResult]);

  return (
    <div>
      <PageHeader
        title="Supply Plan"
        subtitle="Generate and review projected inventory, shipments, and stockout alerts"
      />

      {/* Controls row */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="middle" wrap>
          <div>
            <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
              Scenario
            </Text>
            <Select
              placeholder="Select scenario"
              style={{ width: 240 }}
              value={selectedScenarioId}
              onChange={handleScenarioChange}
              loading={scenariosLoading}
              options={
                scenarios?.map((s: { id: string; name: string }) => ({
                  label: s.name,
                  value: s.id,
                })) ?? []
              }
              allowClear
            />
          </div>

          <div>
            <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
              Version
            </Text>
            <Select
              placeholder="Select version"
              style={{ width: 240 }}
              value={selectedVersionId}
              onChange={handleVersionChange}
              loading={versionsLoading}
              disabled={!selectedScenarioId}
              options={
                versions?.map((v) => ({
                  label: `v${v.version}${v.label ? ` — ${v.label}` : ''}`,
                  value: v.id,
                })) ?? []
              }
              allowClear
            />
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", height: "100%" }}>
            <Button
              type="primary"
              icon={<ExperimentOutlined />}
              onClick={handleGenerate}
              loading={generateMutation.isPending}
              disabled={!selectedVersionId}
              style={{ marginTop: 22 }}
            >
              Generate Plan
            </Button>
          </div>
        </Space>
      </Card>

      {/* Loading state */}
      {generateMutation.isPending && (
        <div style={{ textAlign: "center", padding: 64 }}>
          <Spin size="large" tip="Generating supply plan..." />
        </div>
      )}

      {/* No plan yet */}
      {!planResult && !generateMutation.isPending && (
        <Card>
          <Alert
            type="info"
            showIcon
            message="No Supply Plan Generated"
            description="Select a scenario and version above, then click 'Generate Plan' to compute the projected inventory, planned shipments, and stockout alerts."
          />
        </Card>
      )}

      {/* Plan results */}
      {planResult && !generateMutation.isPending && (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* 1. Projected Inventory Chart */}
          <Card title="Projected Inventory">
            <ResponsiveContainer width="100%" height={420}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <Tooltip />
                <Legend />

                {skuList.map((sku, idx) => (
                  <Area
                    key={sku}
                    type="monotone"
                    dataKey={sku}
                    name={sku}
                    stroke={SKU_COLORS[idx % SKU_COLORS.length]}
                    fill={SKU_COLORS[idx % SKU_COLORS.length]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}

                {/* Reorder point reference lines */}
                {skuList.map((sku, idx) => {
                  const rop = planResult.reorder_points?.[sku];
                  if (rop == null) return null;
                  return (
                    <ReferenceLine
                      key={`rop-${sku}`}
                      y={rop}
                      stroke={SKU_COLORS[idx % SKU_COLORS.length]}
                      strokeDasharray="6 4"
                      label={{
                        value: `ROP ${sku}`,
                        position: "right",
                        fill: SKU_COLORS[idx % SKU_COLORS.length],
                        fontSize: 11,
                      }}
                    />
                  );
                })}
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* 2. Stockout Alerts */}
          {planResult.stockout_alerts && planResult.stockout_alerts.length > 0 && (
            <Card title="Stockout Alerts">
              <Row gutter={[16, 16]}>
                {planResult.stockout_alerts.map(
                  (alert: StockoutAlert, idx: number) => (
                    <Col xs={24} sm={12} md={8} lg={6} key={`alert-${idx}`}>
                      <Alert
                        type="error"
                        icon={<WarningOutlined />}
                        showIcon
                        message={
                          <Text strong>
                            {alert.sku}
                          </Text>
                        }
                        description={
                          <div>
                            <div>
                              <Text type="secondary">Stockout Date: </Text>
                              <Text>{alert.stockout_date ?? "N/A"}</Text>
                            </div>
                            <div>
                              <Text type="secondary">Deficit: </Text>
                              <Text type="danger" strong>
                                {alert.deficit.toLocaleString()} units
                              </Text>
                            </div>
                          </div>
                        }
                      />
                    </Col>
                  )
                )}
              </Row>
            </Card>
          )}

          {/* 3. Safety Stock Table */}
          {safetyStockData.length > 0 && (
            <Card title="Safety Stock">
              <Table
                columns={safetyStockColumns}
                dataSource={safetyStockData}
                pagination={false}
                size="middle"
                bordered
              />
            </Card>
          )}

          {/* 4. Planned Shipments Table */}
          {shipmentData.length > 0 && (
            <Card title="Planned Shipments">
              <Table
                columns={shipmentColumns}
                dataSource={shipmentData}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                size="middle"
                bordered
              />
            </Card>
          )}
        </Space>
      )}
    </div>
  );
};

export default SupplyPlan;
