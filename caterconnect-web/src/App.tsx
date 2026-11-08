import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoaderCircle } from 'lucide-react';
import WebMaintenanceGate from './components/WebMaintenanceGate';

import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Staff
import StaffLayout from './pages/staff/StaffLayout';
import StaffDashboard from './pages/staff/Dashboard';
import CatererVerification from './pages/staff/CatererVerification';
import SubscriptionManager from './pages/staff/SubscriptionManager';
import Complaints from './pages/staff/Complaints';
import BookingMonitor from './pages/staff/BookingMonitor';
import AccountMonitoring from './pages/staff/AccountMonitoring';
import RefundManagement from './pages/staff/RefundManagement';

// Admin
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import Revenue from './pages/admin/Revenue';
import Reports from './pages/admin/Reports';
import ActivityLogs from './pages/admin/ActivityLogs';
import PlatformSettings from './pages/admin/PlatformSettings';
import MaintenanceSecurity from './pages/admin/MaintenanceSecurity';

// Caterer
import CatererLayout from './pages/caterer/CatererLayout';
import CatererDashboard from './pages/caterer/Dashboard';
import CatererPackages from './pages/caterer/Packages';
import CatererMenu from './pages/caterer/Menu';
import CatererFAQ from './pages/caterer/CatererFAQ';
import CatererComplaints from './pages/caterer/CatererComplaints';
import CatererBookings from './pages/caterer/Bookings';
import CatererAvailability from './pages/caterer/Availability';
import CatererMessages from './pages/caterer/Messages';
import CatererBusinessProfile from './pages/caterer/CatererBusinessProfile';
import CatererReports from './pages/caterer/CatererReports';
import CatererNotifications from './pages/caterer/Notifications';
import CatererSubscription from './pages/caterer/CatererSubscription';

function getRoleHome(role: string) {
  switch (role) {
    case 'admin': return '/admin';
    case 'staff': return '/staff';
    case 'caterer': return '/caterer';
    default: return '/login';
  }
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoaderCircle size={32} className="animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children, allow }: { children: React.ReactNode; allow: string[] }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session || !profile) return <Navigate to="/login" replace />;
  if (!allow.includes(profile.role)) return <Navigate to={getRoleHome(profile.role)} replace />;
  return <>{children}</>;
}

function ApprovedCatererRoute({ children }: { children: React.ReactNode }) {
  const { catererData, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (catererData?.verification_status !== 'approved') return <Navigate to="/caterer" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { session, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session || !profile) return <Navigate to="/login" replace />;
  return <Navigate to={getRoleHome(profile.role)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Shared authentication: Staff and Admin must be able to log in during maintenance. */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/" element={<RootRedirect />} />

          {/* Staff stays accessible during maintenance. */}
          <Route path="/staff" element={<ProtectedRoute allow={['staff', 'admin']}><StaffLayout /></ProtectedRoute>}>
            <Route index element={<StaffDashboard />} />
            <Route path="verification" element={<CatererVerification />} />
            <Route path="subscriptions" element={<SubscriptionManager />} />
            <Route path="complaints" element={<Complaints />} />
            <Route path="bookings" element={<BookingMonitor />} />
            <Route path="account-monitoring" element={<AccountMonitoring />} />
            <Route path="refunds" element={<RefundManagement />} />
          </Route>

          {/* Admin stays accessible during maintenance, including the disable toggle. */}
          <Route path="/admin" element={<ProtectedRoute allow={['admin']}><AdminLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="revenue" element={<Revenue />} />
            <Route path="reports" element={<Reports />} />
            <Route path="activity" element={<ActivityLogs />} />
            <Route path="settings" element={<PlatformSettings />} />
            <Route path="maintenance-security" element={<MaintenanceSecurity />} />
          </Route>

          {/* Single parent-level gate protects ALL Caterer web child routes and direct links. */}
          <Route
            path="/caterer"
            element={
              <ProtectedRoute allow={['caterer']}>
                <WebMaintenanceGate>
                  <CatererLayout />
                </WebMaintenanceGate>
              </ProtectedRoute>
            }
          >
            <Route index element={<CatererDashboard />} />
            <Route path="subscription" element={<CatererSubscription />} />
            <Route path="packages" element={<ApprovedCatererRoute><CatererPackages /></ApprovedCatererRoute>} />
            <Route path="menu" element={<ApprovedCatererRoute><CatererMenu /></ApprovedCatererRoute>} />
            <Route path="bookings" element={<ApprovedCatererRoute><CatererBookings /></ApprovedCatererRoute>} />
            <Route path="reports" element={<CatererReports />} />
            <Route path="notifications" element={<CatererNotifications />} />
            <Route path="availability" element={<ApprovedCatererRoute><CatererAvailability /></ApprovedCatererRoute>} />
            <Route path="messages" element={<ApprovedCatererRoute><CatererMessages /></ApprovedCatererRoute>} />
            <Route path="faq" element={<CatererFAQ />} />
            <Route path="complaints" element={<CatererComplaints />} />
            <Route path="profile" element={<CatererBusinessProfile />} />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
