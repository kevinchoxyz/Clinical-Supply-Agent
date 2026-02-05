import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import AuthLayout from '../layouts/AuthLayout';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from './ProtectedRoute';

const Loader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense
    fallback={
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    }
  >
    {children}
  </Suspense>
);

const LoginPage = lazy(() => import('../pages/Login'));
const DashboardPage = lazy(() => import('../pages/Dashboard'));
const StudiesPage = lazy(() => import('../pages/Studies'));
const StudyWizard = lazy(() => import('../pages/Studies/StudyWizard'));
const ScenariosPage = lazy(() => import('../pages/Scenarios'));
const ScenarioDetail = lazy(() => import('../pages/Scenarios/ScenarioDetail'));
const ScenarioWizard = lazy(() => import('../pages/Scenarios/components/ScenarioWizard'));
const ForecastPage = lazy(() => import('../pages/Forecast'));
const ForecastResults = lazy(() => import('../pages/Forecast/ForecastResults'));
const ForecastCompare = lazy(() => import('../pages/Forecast/ForecastCompare'));
const InventoryPage = lazy(() => import('../pages/Inventory'));
const SupplyPlanPage = lazy(() => import('../pages/SupplyPlan'));
const ShipmentsPage = lazy(() => import('../pages/Shipments'));
const ShipmentDetail = lazy(() => import('../pages/Shipments/ShipmentDetail'));
const SubjectsPage = lazy(() => import('../pages/Subjects'));
const SubjectDetail = lazy(() => import('../pages/Subjects/SubjectDetail'));
const ReportsPage = lazy(() => import('../pages/Reports'));
const AdminPage = lazy(() => import('../pages/Admin'));

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <Loader><LoginPage /></Loader> },
      { path: '/register', element: <Loader><LoginPage /></Loader> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <Loader><DashboardPage /></Loader> },
          { path: '/studies', element: <Loader><StudiesPage /></Loader> },
          { path: '/studies/new', element: <Loader><StudyWizard /></Loader> },
          { path: '/studies/:id', element: <Loader><StudyWizard /></Loader> },
          { path: '/scenarios', element: <Loader><ScenariosPage /></Loader> },
          { path: '/scenarios/new', element: <Loader><ScenarioWizard /></Loader> },
          { path: '/scenarios/:id', element: <Loader><ScenarioDetail /></Loader> },
          { path: '/forecast', element: <Loader><ForecastPage /></Loader> },
          { path: '/forecast/compare', element: <Loader><ForecastCompare /></Loader> },
          { path: '/forecast/:runId', element: <Loader><ForecastResults /></Loader> },
          { path: '/inventory', element: <Loader><InventoryPage /></Loader> },
          { path: '/supply-plan', element: <Loader><SupplyPlanPage /></Loader> },
          { path: '/shipments', element: <Loader><ShipmentsPage /></Loader> },
          { path: '/shipments/:id', element: <Loader><ShipmentDetail /></Loader> },
          { path: '/subjects', element: <Loader><SubjectsPage /></Loader> },
          { path: '/subjects/:id', element: <Loader><SubjectDetail /></Loader> },
          { path: '/reports', element: <Loader><ReportsPage /></Loader> },
          { path: '/admin', element: <Loader><AdminPage /></Loader> },
        ],
      },
    ],
  },
]);
