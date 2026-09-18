import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShieldCheck, CreditCard, MessageCircle,
  AlertTriangle, Calendar, Users, Wallet, TrendingUp, Activity,
  Settings, UserCog, LogOut, Check, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
const caterLogo = '/images/caterlogo.png';

const staffNav = [
  { path: '/staff',             icon: LayoutDashboard, label: 'Dashboard'            },
  { path: '/staff/verification',  icon: ShieldCheck,       label: 'Caterer Verification' },
  { path: '/staff/subscriptions', icon: CreditCard,        label: 'Subscriptions'        },
  { path: '/staff/consultations', icon: MessageCircle,     label: 'Consultations'        },
  { path: '/staff/complaints',    icon: AlertTriangle,     label: 'Complaints'           },
  { path: '/staff/bookings',      icon: Calendar,          label: 'Booking Monitor'      },
  { path: '/staff/refunds',       icon: Wallet,            label: 'Process Refunds'      },
];

const adminNav = [
  { path: '/admin',             icon: LayoutDashboard, label: 'Dashboard'          },
  { path: '/admin/users',       icon: Users,           label: 'User Management'    },
  { path: '/admin/revenue',     icon: Wallet,          label: 'Revenue'            },
  { path: '/admin/reports',     icon: TrendingUp,      label: 'Reports'            },
  { path: '/admin/activity',    icon: Activity,        label: 'Activity Logs'      },
  { path: '/admin/settings',    icon: Settings,        label: 'Platform Settings'  },
];

export default function Sidebar() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const navItems = isAdmin ? adminNav : staffNav;
  const initial = (profile?.full_name ?? 'U').charAt(0).toUpperCase();

  const handleLogout = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
  };

  return (
    <aside style={s.sidebar}>
      {/* Brand Header */}
      <div style={s.brand}>
        <div style={s.brandLogo}>
          <img src={caterLogo} alt="CaterConnect Logo" style={s.logoImg} />
        </div>
        <div style={s.brandTextContainer}>
          <div style={s.brandName}>
            <span style={{ color: '#111' }}>CATER</span>
            <span style={{ color: '#F97316' }}>CONNECT</span>
          </div>
          <div style={s.brandSub}>{isAdmin ? 'Admin Portal' : 'Staff Portal'}</div>
        </div>
      </div>

      {/* User Profile Card */}
      <div style={s.userBox}>
        <div style={s.avatar}>{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.userName}>{profile?.full_name ?? 'User'}</div>
          <div style={s.userRole}>
            <span style={{ ...s.roleDot, background: isAdmin ? '#F97316' : '#22C55E' }} />
            {isAdmin ? 'Administrator' : 'Platform Staff'}
          </div>
        </div>
      </div>

      {/* Navigation Section */}
      <div style={s.sectionLabel}>Main Navigation</div>

      <nav style={s.nav}>
        {navItems.map((item) => {
          const active = pathname === item.path || (item.path !== '/admin' && item.path !== '/staff' && pathname.startsWith(item.path));
          return (
            <button 
              key={item.path} 
              onClick={() => navigate(item.path)}
              style={{ ...s.navItem, ...(active ? s.navActive : {}) }}
            >
              <item.icon size={18} style={{ flexShrink: 0, color: active ? '#EA580C' : '#6B7280' }} />
              <span style={s.navLabel}>{item.label}</span>
              {active && <span style={s.navActiveIndicator} />}
            </button>
          );
        })}
      </nav>

      {/* Bottom Actions Footer */}
      <div style={s.bottom}>
        {isAdmin && (
          <button style={s.switchBtn} onClick={() => navigate('/staff')}>
            <UserCog size={16} /> Switch to Staff View
          </button>
        )}

        {showLogoutConfirm ? (
          <div style={s.logoutConfirmBox}>
            <div style={s.logoutConfirmText}>Sign out of account?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                style={s.cancelBtn} 
                onClick={() => setShowLogoutConfirm(false)}
                disabled={signingOut}
              >
                <X size={14} /> Cancel
              </button>
              <button 
                style={s.confirmLogoutBtn} 
                onClick={handleLogout}
                disabled={signingOut}
              >
                <Check size={14} /> {signingOut ? 'Signing out...' : 'Confirm'}
              </button>
            </div>
          </div>
        ) : (
          <button style={s.logoutBtn} onClick={() => setShowLogoutConfirm(true)}>
            <LogOut size={16} /> Sign out
          </button>
        )}
      </div>
    </aside>
  );
}

const s: Record<string, React.CSSProperties> = {
  sidebar: {
    position: 'fixed', top: 0, left: 0,
    width: 'var(--sidebar-w)', height: '100vh',
    background: '#FFFFFF',
    display: 'flex', flexDirection: 'column',
    overflowY: 'auto', zIndex: 100,
    borderRight: '1px solid #E8E4DE',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '24px 20px 20px',
    borderBottom: '1px solid #E8E4DE',
  },
  brandLogo: {
    width: 40, height: 40, borderRadius: 12,
    background: '#FFF7ED',
    border: '1px solid #FED7AA',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: '0',
    padding: 6,
  },
  logoImg: { width: '100%', height: '100%', objectFit: 'contain' },
  brandTextContainer: { display: 'flex', flexDirection: 'column' },
  brandName: { fontSize: 16, fontWeight: 900, letterSpacing: 1.2, lineHeight: 1.1 },
  brandSub: { fontSize: 11, color: '#C2410C', fontWeight: 800, letterSpacing: 0.5, marginTop: 3, textTransform: 'uppercase' },
  userBox: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px',
    margin: '16px 12px 8px',
    background: '#FAF8F5',
    border: '1px solid #E8E4DE',
    borderRadius: 14,
  },
  avatar: {
    width: 38, height: 38, borderRadius: '50%',
    background: 'linear-gradient(135deg, #F97316, #EA580C)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 15, color: 'white', flexShrink: 0,
    boxShadow: '0 2px 8px rgba(249,115,22,0.3)',
  },
  userName: { fontSize: 13, fontWeight: 800, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: 11.5, color: '#4B5563', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 },
  roleDot: { width: 6, height: 6, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  sectionLabel: { padding: '16px 20px 8px', fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: 1.2, textTransform: 'uppercase' },
  nav: { flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '11px 14px', borderRadius: 12, width: '100%',
    background: 'transparent', color: '#4B5563',
    fontSize: 13.5, fontWeight: 700, textAlign: 'left',
    border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
    position: 'relative',
  },
  navActive: { 
    background: '#FFF7ED', 
    color: '#EA580C',
    boxShadow: 'inset 0 0 0 1px #FED7AA'
  },
  navLabel: { flex: 1 },
  navActiveIndicator: { width: 6, height: 6, borderRadius: '50%', background: '#EA580C', flexShrink: 0, boxShadow: '0 0 8px #EA580C' },
  bottom: { padding: '16px 12px', borderTop: '1px solid #E8E4DE', display: 'flex', flexDirection: 'column', gap: 8, background: '#FAF8F5' },
  switchBtn: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', borderRadius: 12, width: '100%',
    background: '#FFFFFF', color: '#374151',
    fontSize: 12.5, fontWeight: 700, border: '1px solid #E5E7EB', cursor: 'pointer',
    transition: 'all 0.15s',
  },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 14px', borderRadius: 12, width: '100%',
    background: '#FEF2F2', color: '#DC2626',
    fontSize: 13, fontWeight: 800, border: '1px solid #FECACA', cursor: 'pointer',
    transition: 'all 0.15s',
  },
  logoutConfirmBox: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 12,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  logoutConfirmText: {
    fontSize: 12,
    fontWeight: 800,
    color: '#991B1B',
    textAlign: 'center',
  },
  cancelBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 10px',
    borderRadius: 8,
    background: '#FFFFFF',
    color: '#374151',
    fontSize: 12,
    fontWeight: 700,
    border: '1px solid #E5E7EB',
    cursor: 'pointer',
  },
  confirmLogoutBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 10px',
    borderRadius: 8,
    background: '#DC2626',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 800,
    border: 'none',
    cursor: 'pointer',
  },
};