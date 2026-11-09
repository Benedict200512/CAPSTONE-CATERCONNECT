import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoaderCircle } from "lucide-react";
import WebMaintenanceGate from "./components/WebMaintenanceGate";

// Public Pages
import CaterConnectLanding from "./pages/CaterConnectLanding";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AccountAppeal from "./pages/AccountAppeal";

// Customer Web marketplace (Phase 1)
import CustomerMarketplace from "./pages/customer/CustomerMarketplace";
import CustomerCatererDetails from "./pages/customer/customerCatererDetails";
import CustomerSavedPackages from "./pages/customer/CustomerSavedPackages";
import CustomerMessages from "./pages/customer/CustomerMessages";
import CustomerNotifications from "./pages/customer/CustomerNotifications";
import CustomerBookings from "./pages/customer/CustomerBookings";
import CustomerBookNow from "./pages/customer/CustomerBookNow";
import CustomerProfile from "./pages/customer/CustomerProfile";
import CustomerEditProfile from "./pages/customer/CustomerEditProfile";
import CustomerFAQ from "./pages/customer/CustomerFAQ";
import CustomerTechnicalSupport from "./pages/customer/CustomerTechnicalSupport";

// Staff
import StaffLayout from "./pages/staff/StaffLayout";
import StaffDashboard from "./pages/staff/Dashboard";
import CatererVerification from "./pages/staff/CatererVerification";
import SubscriptionManager from "./pages/staff/SubscriptionManager";
import Complaints from "./pages/staff/Complaints";
import BookingMonitor from "./pages/staff/BookingMonitor";
import AccountMonitoring from "./pages/staff/AccountMonitoring";
import RefundManagement from "./pages/staff/RefundManagement";

// Admin
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import UserManagement from "./pages/admin/UserManagement";
import Revenue from "./pages/admin/Revenue";
import Reports from "./pages/admin/Reports";
import ActivityLogs from "./pages/admin/ActivityLogs";
import PlatformSettings from "./pages/admin/PlatformSettings";
import MaintenanceSecurity from "./pages/admin/MaintenanceSecurity";

// Caterer
import CatererLayout from "./pages/caterer/CatererLayout";
import CatererDashboard from "./pages/caterer/Dashboard";
import CatererPackages from "./pages/caterer/Packages";
import CatererMenu from "./pages/caterer/Menu";
import CatererFAQ from "./pages/caterer/CatererFAQ";
import CatererComplaints from "./pages/caterer/CatererComplaints";
import CatererBookings from "./pages/caterer/Bookings";
import CatererAvailability from "./pages/caterer/Availability";
import CatererMessages from "./pages/caterer/Messages";
import CatererBusinessProfile from "./pages/caterer/CatererBusinessProfile";
import CatererReports from "./pages/caterer/CatererReports";
import CatererNotifications from "./pages/caterer/Notifications";
import CatererSubscription from "./pages/caterer/CatererSubscription";

// ==========================================
// ROLE-BASED HOME REDIRECTION
// ==========================================

function getRoleHome(role: string) {
  switch (role) {
    case "admin":
      return "/admin";

    case "staff":
      return "/staff";

    case "caterer":
      return "/caterer";

    case "customer":
      return "/customer";

    default:
      return "/login";
  }
}

// ==========================================
// LOADING SCREEN
// ==========================================

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <LoaderCircle size={32} className="animate-spin" />
    </div>
  );
}

// ==========================================
// PROTECTED ROUTE
// ==========================================

function ProtectedRoute({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow: string[];
}) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session || !profile) {
    return <Navigate to="/login" replace />;
  }

  const suspended = String(profile.status ?? '').trim().toLowerCase() === 'suspended';
  if (suspended) {
    return <Navigate to={profile.role === 'customer' || profile.role === 'caterer' ? '/account-appeal' : '/login'} replace />;
  }

  if (!allow.includes(profile.role)) {
    return <Navigate to={getRoleHome(profile.role)} replace />;
  }

  return <>{children}</>;
}

// ==========================================
// CUSTOMER ROUTE WITH MAINTENANCE PROTECTION
// ==========================================

function CustomerRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allow={["customer"]}>
      <WebMaintenanceGate>{children}</WebMaintenanceGate>
    </ProtectedRoute>
  );
}

// ==========================================
// APPROVED CATERER ROUTE
// ==========================================

function ApprovedCatererRoute({ children }: { children: React.ReactNode }) {
  const { catererData, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (catererData?.verification_status !== "approved") {
    return <Navigate to="/caterer" replace />;
  }

  return <>{children}</>;
}

// ==========================================
// ROOT REDIRECT
// Used for unknown routes.
// ==========================================

function RootRedirect() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (String(profile.status ?? '').trim().toLowerCase() === 'suspended') {
    return <Navigate to={profile.role === 'customer' || profile.role === 'caterer' ? '/account-appeal' : '/login'} replace />;
  }

  return <Navigate to={getRoleHome(profile.role)} replace />;
}

// ==========================================
// MAIN APPLICATION
// ==========================================

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ==================================
              PUBLIC LANDING PAGE
          ================================== */}

          <Route
            path="/"
            element={
              <CaterConnectLanding
                loginPath="/login"
                registerPath="/register"
              />
            }
          />

          {/* ==================================
              AUTHENTICATION
              Accessible without signing in.
              Staff and Admin can log in
              during maintenance.
          ================================== */}

          <Route path="/login" element={<Login />} />

          {/* Suspended customer/caterer appeal route, intentionally outside maintenance gates. */}
          <Route path="/account-appeal" element={<AccountAppeal />} />

          <Route path="/register" element={<Register />} />

          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/reset-password" element={<ResetPassword />} />

          {/* ==================================
              CUSTOMER WEB MARKETPLACE
              Phase 1: marketplace browsing.
              Only authenticated customers may access this route.
          ================================== */}

          <Route
            path="/customer"
            element={
              <CustomerRoute>
                <CustomerMarketplace />
              </CustomerRoute>
            }
          />

          <Route
            path="/customer/caterer/:catererId"
            element={
              <CustomerRoute>
                <CustomerCatererDetails />
              </CustomerRoute>
            }
          />

          <Route
            path="/customer/saved"
            element={
              <CustomerRoute>
                <CustomerSavedPackages />
              </CustomerRoute>
            }
          />

          <Route path="/customer/bookings" element={<CustomerRoute><CustomerBookings /></CustomerRoute>} />
          <Route path="/customer/book/:catererId" element={<CustomerRoute><CustomerBookNow /></CustomerRoute>} />
          <Route path="/customer/messages" element={<CustomerRoute><CustomerMessages /></CustomerRoute>} />
          <Route path="/customer/notifications" element={<CustomerRoute><CustomerNotifications /></CustomerRoute>} />

          {/* CUSTOMER PROFILE & SETTINGS */}
          <Route path="/customer/profile" element={<CustomerRoute><CustomerProfile /></CustomerRoute>} />
          <Route path="/customer/profile/edit" element={<CustomerRoute><CustomerEditProfile /></CustomerRoute>} />
          <Route path="/customer/faq" element={<CustomerRoute><CustomerFAQ /></CustomerRoute>} />
          <Route path="/customer/support" element={<CustomerRoute><CustomerTechnicalSupport /></CustomerRoute>} />

          {/* ==================================
              STAFF ROUTES
              Staff stays accessible
              during maintenance.
          ================================== */}

          <Route
            path="/staff"
            element={
              <ProtectedRoute allow={["staff", "admin"]}>
                <StaffLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<StaffDashboard />} />

            <Route path="verification" element={<CatererVerification />} />

            <Route path="subscriptions" element={<SubscriptionManager />} />

            <Route path="complaints" element={<Complaints />} />

            <Route path="bookings" element={<BookingMonitor />} />

            <Route path="account-monitoring" element={<AccountMonitoring />} />

            <Route path="refunds" element={<RefundManagement />} />
          </Route>

          {/* ==================================
              ADMIN ROUTES
              Admin stays accessible
              during maintenance.
          ================================== */}

          <Route
            path="/admin"
            element={
              <ProtectedRoute allow={["admin"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />

            <Route path="users" element={<UserManagement />} />

            <Route path="revenue" element={<Revenue />} />

            <Route path="reports" element={<Reports />} />

            <Route path="activity" element={<ActivityLogs />} />

            <Route path="settings" element={<PlatformSettings />} />

            <Route
              path="maintenance-security"
              element={<MaintenanceSecurity />}
            />
          </Route>

          {/* ==================================
              CATERER ROUTES

              Maintenance gate protects
              all Caterer child routes.

              Approval checks remain unchanged.
          ================================== */}

          <Route
            path="/caterer"
            element={
              <ProtectedRoute allow={["caterer"]}>
                <WebMaintenanceGate>
                  <CatererLayout />
                </WebMaintenanceGate>
              </ProtectedRoute>
            }
          >
            <Route index element={<CatererDashboard />} />

            <Route path="subscription" element={<CatererSubscription />} />

            <Route
              path="packages"
              element={
                <ApprovedCatererRoute>
                  <CatererPackages />
                </ApprovedCatererRoute>
              }
            />

            <Route
              path="menu"
              element={
                <ApprovedCatererRoute>
                  <CatererMenu />
                </ApprovedCatererRoute>
              }
            />

            <Route
              path="bookings"
              element={
                <ApprovedCatererRoute>
                  <CatererBookings />
                </ApprovedCatererRoute>
              }
            />

            <Route path="reports" element={<CatererReports />} />

            <Route path="notifications" element={<CatererNotifications />} />

            <Route
              path="availability"
              element={
                <ApprovedCatererRoute>
                  <CatererAvailability />
                </ApprovedCatererRoute>
              }
            />

            <Route
              path="messages"
              element={
                <ApprovedCatererRoute>
                  <CatererMessages />
                </ApprovedCatererRoute>
              }
            />

            <Route path="faq" element={<CatererFAQ />} />

            <Route path="complaints" element={<CatererComplaints />} />

            <Route path="profile" element={<CatererBusinessProfile />} />
          </Route>

          {/* ==================================
              UNKNOWN ROUTES
          ================================== */}

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
