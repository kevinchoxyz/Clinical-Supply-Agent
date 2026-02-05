import React from 'react';
import { Layout, Typography } from 'antd';
import { MedicineBoxOutlined } from '@ant-design/icons';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => (
  <Layout
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}
  >
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <MedicineBoxOutlined style={{ fontSize: 48, color: '#fff' }} />
      <Typography.Title level={2} style={{ color: '#fff', margin: '12px 0 0' }}>
        Clinical Supply Planning
      </Typography.Title>
    </div>
    <Outlet />
  </Layout>
);

export default AuthLayout;
