import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const staffNav = [
  { path: '/staff',               icon: '📊', label: 'Dashboard'           },
  { path: '/staff/verification',  icon: '✅', label: 'Caterer Verification' },
  { path: '/staff/subscriptions', icon: '💳', label: 'Subscriptions'       },
  { path: '/staff/consultations', icon: '💬', label: 'Consultations'       },
  { path: '/staff/complaints',    icon: '🚨', label: 'Complaints'          },
  { path: '/staff/bookings',      icon: '📅', label: 'Booking Monitor'     },
];

const adminNav = [
  { path: '/admin',          icon: '📊', label: 'Dashboard'        },
  { path: '/admin/users',    icon: '👥', label: 'User Management'  },
  { path: '/admin/revenue',  icon: '💰', label: 'Revenue'          },
  { path: '/admin/reports',  icon: '📈', label: 'Reports'          },
  { path: '/admin/activity', icon: '🕵️', label: 'Activity Logs'   },
  { path: '/admin/settings', icon: '⚙️', label: 'Platform Settings'},
];

export default function Sidebar() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isAdmin = profile?.role === 'admin';
  const navItems = isAdmin ? adminNav : staffNav;
  const initial = (profile?.full_name ?? 'U').charAt(0).toUpperCase();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <aside style={s.sidebar}>
      {/* Brand */}
      <div style={s.brand}>
        <div style={s.brandLogo}>🍽️</div>
        <div>
          <div style={s.brandName}>
            <span style={{ color: '#fff' }}>CATER</span>
            <span style={{ color: '#F97316' }}>CONNECT</span>
          </div>
          <div style={s.brandSub}>{isAdmin ? 'Admin Portal' : 'Staff Portal'}</div>
        </div>
      </div>

      {/* User */}
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

      {/* Section label */}
      <div style={s.sectionLabel}>NAVIGATION</div>

      {/* Nav */}
      <nav style={s.nav}>
        {navItems.map((item) => {
          const active = pathname === item.path || (item.path !== '/admin' && item.path !== '/staff' && pathname.startsWith(item.path));
          return (
            <button key={item.path} onClick={() => navigate(item.path)}
              style={{ ...s.navItem, ...(active ? s.navActive : {}) }}>
              <span style={s.navIcon}>{item.icon}</span>
              <span style={s.navLabel}>{item.label}</span>
              {active && <span style={s.navActiveDot} />}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={s.bottom}>
        {isAdmin && (
          <button style={s.switchBtn} onClick={() => navigate('/staff')}>
            <span>👷</span> Switch to Staff View
          </button>
        )}
        {!isAdmin && (
          <button style={s.switchBtn} onClick={() => navigate('/admin')}>
            <span>🔑</span> Switch to Admin View
          </button>
        )}
        <button style={s.logoutBtn} onClick={handleLogout}>
          <span>🚪</span> Sign Out
        </button>
      </div>
    </aside>
  );
}

const s: Record<string, React.CSSProperties> = {
  sidebar: {
    position: 'fixed', top: 0, left: 0,
    width: 'var(--sidebar-w)', height: '100vh',
    background: '#0D0D0D',
    display: 'flex', flexDirection: 'column',
    overflowY: 'auto', zIndex: 100,
    borderRight: '1px solid rgba(255,255,255,0.06)',
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '22px 20px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  brandLogo: { fontSize: 28 },
  brandName: { fontSize: 16, fontWeight: 900, letterSpacing: 1.5 },
  brandSub: { fontSize: 10, color: '#F97316', fontWeight: 700, letterSpacing: 1.5, marginTop: 2 },
  userBox: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 18px',
    margin: '12px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'linear-gradient(135deg, #F97316, #EA580C)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 900, fontSize: 15, color: 'white', flexShrink: 0,
  },
  userName: { fontSize: 13, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: 11, color: '#6B7280', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 },
  roleDot: { width: 6, height: 6, borderRadius: '50%', display: 'inline-block', flexShrink: 0 },
  sectionLabel: { padding: '16px 20px 8px', fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: 1.5 },
  nav: { flex: 1, padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 10, width: '100%',
    background: 'transparent', color: '#6B7280',
    fontSize: 13, fontWeight: 600, textAlign: 'left',
    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
    position: 'relative',
  },
  navActive: { background: 'rgba(249,115,22,0.12)', color: '#F97316' },
  navIcon: { fontSize: 17, width: 20, textAlign: 'center', flexShrink: 0 },
  navLabel: { flex: 1 },
  navActiveDot: { width: 6, height: 6, borderRadius: '50%', background: '#F97316' },
  bottom: { padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 4 },
  switchBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 12px', borderRadius: 10, width: '100%',
    background: 'transparent', color: '#6B7280',
    fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
  },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 12px', borderRadius: 10, width: '100%',
    background: 'rgba(220,38,38,0.08)', color: '#EF4444',
    fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
  },
};