import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, Space } from 'antd';
import {
  DashboardOutlined,
  ExperimentOutlined,
  BookOutlined,
  LineChartOutlined,
  InboxOutlined,
  ScheduleOutlined,
  SendOutlined,
  TeamOutlined,
  FileTextOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  MedicineBoxOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StudySelector from '../components/StudySelector';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/studies', icon: <BookOutlined />, label: 'Studies' },
  { key: '/scenarios', icon: <ExperimentOutlined />, label: 'Scenarios' },
  { key: '/forecast', icon: <LineChartOutlined />, label: 'Forecast' },
  { key: '/inventory', icon: <InboxOutlined />, label: 'Inventory' },
  { key: '/supply-plan', icon: <ScheduleOutlined />, label: 'Supply Plan' },
  { key: '/shipments', icon: <SendOutlined />, label: 'Shipments' },
  { key: '/subjects', icon: <TeamOutlined />, label: 'Subjects' },
  { key: '/reports', icon: <FileTextOutlined />, label: 'Reports' },
  { key: '/admin', icon: <SettingOutlined />, label: 'Admin' },
];

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const selectedKey = '/' + location.pathname.split('/')[1];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={220}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <MedicineBoxOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          {!collapsed && (
            <Typography.Text strong style={{ color: '#fff', fontSize: 15 }}>
              Clinical Supply
            </Typography.Text>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Space size="middle">
            <div
              style={{ cursor: 'pointer', fontSize: 18 }}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </div>
            <StudySelector />
          </Space>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'user',
                  label: (
                    <Space direction="vertical" size={0}>
                      <Typography.Text strong>{user?.username}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {user?.role}
                      </Typography.Text>
                    </Space>
                  ),
                  disabled: true,
                },
                { type: 'divider' },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: 'Sign Out',
                  onClick: () => {
                    logout();
                    navigate('/login');
                  },
                },
              ],
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span>{user?.username}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
