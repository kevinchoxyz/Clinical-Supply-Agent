import React, { useState } from 'react';
import { Card, Tabs, Form, Input, Button, Select, Alert, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { register } from '../../api/auth';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractError = (err: unknown, fallback: string): string => {
    const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join('; ');
    return fallback;
  };

  const handleLogin = async (values: { username: string; password: string }) => {
    setError(null);
    setLoginLoading(true);
    try {
      await login(values.username, values.password);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(extractError(err, 'Login failed'));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (values: { username: string; email: string; password: string; role: string }) => {
    setError(null);
    setRegisterLoading(true);
    try {
      const { confirm: _, ...payload } = values as Record<string, string>;
      await register(payload as unknown as { username: string; email: string; password: string; role: string });
      message.success('Account created. Please sign in.');
    } catch (err: unknown) {
      setError(extractError(err, 'Registration failed'));
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <Card style={{ width: 420, borderRadius: 12 }}>
      {error && <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />}
      <Tabs
        defaultActiveKey="login"
        centered
        items={[
          {
            key: 'login',
            label: 'Sign In',
            children: (
              <Form layout="vertical" onFinish={handleLogin} autoComplete="off">
                <Form.Item name="username" rules={[{ required: true, message: 'Username is required' }]}>
                  <Input prefix={<UserOutlined />} placeholder="Username" size="large" />
                </Form.Item>
                <Form.Item name="password" rules={[{ required: true, message: 'Password is required' }]}>
                  <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loginLoading} block size="large">
                    Sign In
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'register',
            label: 'Register',
            children: (
              <Form layout="vertical" onFinish={handleRegister} autoComplete="off" initialValues={{ role: 'READONLY' }}>
                <Form.Item name="username" rules={[{ required: true, min: 3 }]}>
                  <Input prefix={<UserOutlined />} placeholder="Username" size="large" />
                </Form.Item>
                <Form.Item name="email" rules={[{ required: true, type: 'email' }]}>
                  <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
                </Form.Item>
                <Form.Item name="password" rules={[{ required: true, min: 8 }]}>
                  <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
                </Form.Item>
                <Form.Item
                  name="confirm"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Confirm your password' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) return Promise.resolve();
                        return Promise.reject(new Error('Passwords do not match'));
                      },
                    }),
                  ]}
                >
                  <Input.Password prefix={<LockOutlined />} placeholder="Confirm Password" size="large" />
                </Form.Item>
                <Form.Item name="role" label="Role">
                  <Select
                    options={[
                      { value: 'ADMIN', label: 'Admin' },
                      { value: 'SUPPLY_CHAIN', label: 'Supply Chain' },
                      { value: 'SITE', label: 'Site' },
                      { value: 'READONLY', label: 'Read Only' },
                    ]}
                  />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={registerLoading} block size="large">
                    Create Account
                  </Button>
                </Form.Item>
              </Form>
            ),
          },
        ]}
      />
    </Card>
  );
};

export default LoginPage;
