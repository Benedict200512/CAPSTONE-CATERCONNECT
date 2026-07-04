import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';

import StaffLayout      from './pages/staff/StaffLayout';
import StaffDashboard   from './pages/staff/Dashboard';
import CatererVerification from './pages/staff/CatererVerification';
import SubscriptionManager from './pages/staff/SubscriptionManager';
import Consultations    from './pages/staff/Consultations';
import Complaints       from './pages/staff/Complaints';
import BookingMonitor   from './pages/staff/BookingMonitor';

import AdminLayout      from './pages/admin/AdminLayout';
import AdminDashboard   from './pages/admin/Dashboard';
import UserManagement   from './pages/admin/UserManagement';
import Revenue          from './pages/admin/Revenue';
import Reports          from './pages/admin/Reports';
import ActivityLogs     from './pages/admin/ActivityLogs';
import PlatformSettings from './pages/admin/PlatformSettings';

function ProtectedRoute({ children, allow }: { children: React.ReactNode; allow: string[] }) {
  const { session, profile, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
      ⏳
    </div>
  );
  if (!session || !profile) return <Navigate to="/login" replace />;
  if (!allow.includes(profile.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { session, profile, loading } = useAuth();
  if (loading) return null;
  if (!session || !profile) return <Navigate to="/login" replace />;
  if (profile.role === 'admin') return <Navigate to="/admin" replace />;
  if (profile.role === 'staff') return <Navigate to="/staff" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Staff */}
          <Route path="/staff" element={<ProtectedRoute allow={['staff', 'admin']}><StaffLayout /></ProtectedRoute>}>
            <Route index element={<StaffDashboard />} />
            <Route path="verification"  element={<CatererVerification />} />
            <Route path="subscriptions" element={<SubscriptionManager />} />
            <Route path="consultations" element={<Consultations />} />
            <Route path="complaints"    element={<Complaints />} />
            <Route path="bookings"      element={<BookingMonitor />} />
          </Route>

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute allow={['admin']}><AdminLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="users"    element={<UserManagement />} />
            <Route path="revenue"  element={<Revenue />} />
            <Route path="reports"  element={<Reports />} />
            <Route path="activity" element={<ActivityLogs />} />
            <Route path="settings" element={<PlatformSettings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}