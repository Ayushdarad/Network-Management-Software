import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import LoginPage from '../pages/LoginPage.tsx';
import ResetPasswordPage from '../pages/ResetPasswordPage.tsx';
import DashboardPage from '../pages/DashboardPage.tsx';
import AlertsPage from '../pages/AlertsPage.tsx';
import InventoryPage from '../pages/InventoryPage.tsx';
import DeviceDetailPage from '../pages/DeviceDetailPage.tsx';
import SchedulerPage from '../pages/SchedulerPage.tsx';
import LogsPage from '../pages/LogsPage.tsx';
import ReportsPage from '../pages/ReportsPage.tsx';
import HostsServicesPage from '../pages/HostsServicesPage.tsx';
import HostServiceHistoryPage from '../pages/HostServiceHistoryPage.tsx';
import DeviceTimelinePage from '../pages/DeviceTimelinePage.tsx';
import SettingsPage from '../pages/SettingsPage.tsx';
import AssetManagementPage from '../pages/AssetManagementPage.tsx';
import { isAuthenticated } from '../lib/api';
import { can } from '../lib/permissions';
import { getDefaultRoute } from '../lib/routes';
import UnauthorizedPage from '../pages/UnauthorizedPage';

// ─── Guards ───────────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? <Navigate to={getDefaultRoute()} replace /> : <>{children}</>;
}

function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return can(permission) ? <>{children}</> : <Navigate to={getDefaultRoute()} replace />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Navigate to={getDefaultRoute()} replace />} />
          <Route path="dashboard" element={<RequirePermission permission="dashboard.view">  <DashboardPage />          </RequirePermission>} />
          <Route path="monitoring/alerts" element={<RequirePermission permission="alerts.view">     <AlertsPage />             </RequirePermission>} />
          <Route path="monitoring/hosts" element={<RequirePermission permission="devices.view">    <HostsServicesPage />       </RequirePermission>} />
          <Route path="monitoring/timeline" element={<RequirePermission permission="devices.view">    <DeviceTimelinePage />      </RequirePermission>} />
          <Route path="monitoring/history" element={<RequirePermission permission="logs.view">       <HostServiceHistoryPage />  </RequirePermission>} />
          <Route path="inventory/devices" element={<RequirePermission permission="inventory.view">  <InventoryPage />           </RequirePermission>} />
          <Route path="inventory/devices/:id" element={<RequirePermission permission="devices.view">    <DeviceDetailPage />        </RequirePermission>} />
          <Route path="inventory/assets" element={<RequirePermission permission="inventory.view">  <AssetManagementPage />     </RequirePermission>} />
          <Route path="logs/syslog" element={<RequirePermission permission="logs.view">       <LogsPage />               </RequirePermission>} />
          <Route path="logs/audit" element={<RequirePermission permission="logs.view">       <LogsPage />               </RequirePermission>} />
          <Route path="operations/scheduler" element={<RequirePermission permission="jobs.view">       <SchedulerPage />           </RequirePermission>} />
          <Route path="reports" element={<RequirePermission permission="reports.view">    <ReportsPage />             </RequirePermission>} />
          <Route path="settings" element={<RequirePermission permission="settings.view">   <SettingsPage />            </RequirePermission>} />
        </Route>
        <Route path="/unauthorized" element={<RequireAuth><UnauthorizedPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
