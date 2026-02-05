import React from 'react';
import { Tag } from 'antd';

const STATUS_COLORS: Record<string, string> = {
  // Shipment
  REQUESTED: 'blue',
  APPROVED: 'cyan',
  PICKED: 'geekblue',
  SHIPPED: 'orange',
  IN_TRANSIT: 'orange',
  RECEIVED: 'green',
  CANCELLED: 'red',
  // Lot
  RELEASED: 'green',
  QUARANTINE: 'orange',
  EXPIRED: 'red',
  // Subject
  SCREENED: 'default',
  ENROLLED: 'blue',
  ACTIVE: 'green',
  DISCONTINUED: 'volcano',
  COMPLETED: 'purple',
  // Visit
  SCHEDULED: 'blue',
  MISSED: 'red',
  // Forecast
  RUNNING: 'processing',
  SUCCESS: 'success',
  FAILED: 'error',
};

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <Tag color={STATUS_COLORS[status] || 'default'}>{status}</Tag>
);

export default StatusBadge;
