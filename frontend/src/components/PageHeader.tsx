import React from 'react';
import { Typography, Space, Breadcrumb } from 'antd';
import { Link } from 'react-router-dom';

interface Crumb {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  breadcrumbs?: Crumb[];
  extra?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, breadcrumbs, extra }) => (
  <div style={{ marginBottom: 24 }}>
    {breadcrumbs && (
      <Breadcrumb
        style={{ marginBottom: 8 }}
        items={breadcrumbs.map((b) => ({
          title: b.path ? <Link to={b.path}>{b.label}</Link> : b.label,
        }))}
      />
    )}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Space direction="vertical" size={0}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Text type="secondary">{subtitle}</Typography.Text>
        )}
      </Space>
      {extra && <div>{extra}</div>}
    </div>
  </div>
);

export default PageHeader;
