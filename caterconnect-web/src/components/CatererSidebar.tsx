
import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Utensils,
  CalendarDays,
  MessageSquare,
  Store,
  Menu,
  X,
  LogOut,
  CircleHelp,
  ShieldAlert,
  LifeBuoy,
  Gift,
  Zap,
  Crown,
  Gem,
  ChevronRight,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function CatererSidebar() {
  const { profile, catererData } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const logoutDialogRef = useRef<HTMLDialogElement>(null);
  const logoutInProgressRef = useRef(false);
  const isVerified = catererData?.verification_status === 'approved';

  useEffect(() => {
    const dialog = logoutDialogRef.current;
    if (!dialog) return;

    if (logoutDialogOpen && !dialog.open) dialog.showModal();
    if (!logoutDialogOpen && dialog.open) dialog.close();
  }, [logoutDialogOpen]);

  const navigation = [
    {
      label: 'Dashboard',
      path: '/caterer',
      icon: LayoutDashboard,
    },
    {
      label: 'Packages',
      path: '/caterer/packages',
      icon: Package,
      requiresApproval: true,
    },
    {
      label: 'Menu',
      path: '/caterer/menu',
      icon: Utensils,
      requiresApproval: true,
    },
    {
      label: 'Bookings',
      path: '/caterer/bookings',
      icon: CalendarDays,
      requiresApproval: true,
    },
    {
      label: 'Messages',
      path: '/caterer/messages',
      icon: MessageSquare,
      requiresApproval: true,
    },
    {
      label: 'Business Profile',
      path: '/caterer/profile',
      icon: Store,
    },
  ];

  const supportLinks = [
    {
      label: 'Help Center / FAQ',
      path: '/caterer/faq',
      icon: CircleHelp,
    },
    {
      label: 'Technical Support',
      path: '/caterer/complaints',
      icon: ShieldAlert,
    },
  ];

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      return;
    }

    navigate('/login', { replace: true });
  }

  const businessName =
    catererData?.business_name || profile?.full_name || 'Caterer';
  const currentPlan = catererData?.subscription_plan?.trim().toLowerCase() ?? '';
  const planDetails = {
    free: { label: 'Free Plan', icon: Gift, color: '#9CA3AF' },
    basic: { label: 'Basic Plan', icon: Zap, color: '#2563EB' },
    standard: { label: 'Standard Plan', icon: Crown, color: '#F97316' },
    premium: { label: 'Premium Plan', icon: Gem, color: '#8B5CF6' },
  }[currentPlan as 'free' | 'basic' | 'standard' | 'premium'];
  const PlanIcon = planDetails?.icon ?? CircleHelp;
  const planLabel = planDetails?.label ?? (currentPlan
    ? `${currentPlan.replace(/(^|[_\s-])\w/g, (part) => part.toUpperCase())} Plan`
    : 'Plan unavailable');
  const planColor = planDetails?.color ?? '#9CA3AF';

  return (
    <>
      {/* MOBILE MENU BUTTON */}
      <button
        className="caterer-mobile-menu"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={menuOpen}
      >
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* MOBILE OVERLAY */}
      {menuOpen && (
        <button
          className="caterer-sidebar-overlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* SIDEBAR */}
      <aside className={`caterer-sidebar ${menuOpen ? 'open' : ''}`}>

        {/* BRAND */}
        <div className="caterer-sidebar-brand">
          <img src="/images/caterlogo.png" alt="CaterConnect" />

          <div>
            <strong className="caterer-sidebar-brand-name"><span>CATER</span><span className="brand-connect">CONNECT</span></strong>
            <span className="caterer-sidebar-portal">CATERER PORTAL</span>
          </div>
        </div>

        {/* WORKSPACE LABEL */}
        <div className="caterer-sidebar-label">
          WORKSPACE
        </div>

        {/* MAIN NAVIGATION */}
        <nav className="caterer-sidebar-nav">
          {navigation.map((item) => {
            const Icon = item.icon;

            if (item.requiresApproval && !isVerified) {
              return (
                <div
                  key={item.path}
                  className="caterer-sidebar-link disabled"
                  role="link"
                  aria-disabled="true"
                  title={`${item.label} is available after business approval`}
                >
                  <Icon
                    className="caterer-sidebar-icon"
                    size={19}
                    strokeWidth={2}
                  />
                  <span>{item.label}</span>
                </div>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/caterer'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `caterer-sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                <Icon
                  className="caterer-sidebar-icon"
                  size={19}
                  strokeWidth={2}
                />

                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* BOTTOM SECTION */}
        <div className="caterer-sidebar-bottom">

          {/* SUPPORT LINKS */}
          <div className="caterer-sidebar-support">

            <div className="caterer-sidebar-support-heading">
              <LifeBuoy size={14} />
              <span>NEED HELP?</span>
            </div>

            <nav className="caterer-sidebar-support-nav">
              {supportLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `caterer-sidebar-support-link ${
                        isActive ? 'active' : ''
                      }`
                    }
                  >
                    <Icon size={16} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

          </div>

          {/* BUSINESS ACCOUNT */}
          <div className="caterer-user-card">
            {catererData?.logo_url ? (
              <img
                src={catererData.logo_url}
                alt="Business logo"
              />
            ) : (
              <div className="caterer-user-avatar">
                {businessName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="caterer-user-details">
              <strong>{businessName}</strong>
              <span>Caterer Account</span>
            </div>
          </div>

          <NavLink
            to="/caterer/subscription"
            end
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) => `caterer-subscription-placeholder${isActive ? ' active' : ''}`}
            title="Current subscription plan"
          >
            <span className="caterer-subscription-label">YOUR SUBSCRIPTION</span>
            <div className="caterer-subscription-plan-row">
              <span className="caterer-subscription-plan-icon" style={{ color: planColor, backgroundColor: `${planColor}18` }}>
                <PlanIcon size={16} />
              </span>
              <strong>{planLabel}</strong>
              <ChevronRight className="caterer-subscription-chevron" size={16} />
            </div>
          </NavLink>

          {/* LOGOUT BUTTON */}
          <button
            type="button"
            className="caterer-logout-button"
            onClick={() => setLogoutDialogOpen(true)}
          >
            <LogOut size={18} strokeWidth={2} />
            <span>Log Out</span>
          </button>

        </div>
      </aside>

      <dialog
        ref={logoutDialogRef}
        className="caterer-logout-dialog"
        aria-labelledby="caterer-logout-title"
        aria-describedby="caterer-logout-message"
        onClose={() => setLogoutDialogOpen(false)}
      >
        <div className="caterer-logout-dialog-content">
          <h2 id="caterer-logout-title">Confirm Logout</h2>
          <p id="caterer-logout-message">Are you sure you want to log out?</p>
          <div className="caterer-logout-dialog-actions">
            <button
              type="button"
              className="caterer-logout-cancel"
              autoFocus
              onClick={() => {
                logoutDialogRef.current?.close();
                setLogoutDialogOpen(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="caterer-logout-confirm"
              onClick={() => {
                if (logoutInProgressRef.current) return;
                logoutInProgressRef.current = true;
                setLogoutDialogOpen(false);
                void handleLogout().finally(() => {
                  logoutInProgressRef.current = false;
                });
              }}
            >
              Confirm Logout
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
