import React from 'react';
import { Skeleton, Card } from 'antd';

const LoadingSkeleton: React.FC = () => (
  <Card>
    <Skeleton active paragraph={{ rows: 6 }} />
  </Card>
);

export default LoadingSkeleton;
