import React from 'react';
import { Empty, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

interface EmptyStateProps {
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ description = 'No data', actionLabel, onAction }) => (
  <Empty description={description} style={{ padding: 48 }}>
    {actionLabel && onAction && (
      <Button type="primary" icon={<PlusOutlined />} onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </Empty>
);

export default EmptyState;
