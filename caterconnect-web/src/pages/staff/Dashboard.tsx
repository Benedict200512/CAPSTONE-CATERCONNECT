import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, Calendar, CheckCircle2, ShieldCheck, History, Loader2, ArrowRight, Banknote, Bell, CheckCheck, RefreshCw, Store, UserRound, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type StaffNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  booking_id: string | null;
  is_read: boolean;
  created_at: string;
};

const STAFF_NOTIFICATION_TYPES = [
  'new_caterer_verification',
  'new_complaint',
  'new_account_appeal',
];

const STAFF_NOTIFICATION_DESTINATIONS: Record<string, string> = {
  new_caterer_verification: '/staff/verification',
  new_complaint: '/staff/complaints',
  new_account_appeal: '/staff/account-monitoring',
};

function sortStaffNotifications(items: StaffNotification[]) {
  return [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 50);
}

export default function StaffDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pending: 0, complaints: 0, bookings: 0, approved: 0, rejected: 0, refunds: 0, pendingBookings: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');

  const staffUserId = profile?.role === 'staff' ? profile.id : null;
  const unreadNotificationCount = notifications.filter((item) => !item.is_read).length;

  const loadNotifications = useCallback(async (userId: string, showLoading = true) => {
    if (showLoading) setNotificationsLoading(true);
    setNotificationsError('');

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, title, message, type, booking_id, is_read, created_at')
        .eq('user_id', userId)
        .in('type', STAFF_NOTIFICATION_TYPES)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const fetched = (data ?? []) as StaffNotification[];
      setNotifications((current) => {
        const byId = new Map(fetched.map((item) => [item.id, item]));
        // Keep Realtime changes that arrived while the initial query was in flight.
        current.forEach((item) => byId.set(item.id, item));
        return sortStaffNotifications(Array.from(byId.values()));
      });
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : 'Unable to load notifications. Please try again.');
    } finally {
      if (showLoading) setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!staffUserId) {
      setNotifications([]);
      setNotificationsLoading(false);
      return;
    }

    let active = true;
    void loadNotifications(staffUserId);

    const channel = supabase
      .channel(`staff-notifications-${staffUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${staffUserId}`,
      }, (payload) => {
        if (!active) return;
        const incoming = payload.new as StaffNotification;
        if (!STAFF_NOTIFICATION_TYPES.includes(incoming.type)) return;
        setNotifications((current) => sortStaffNotifications([
          incoming,
          ...current.filter((item) => item.id !== incoming.id),
        ]));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${staffUserId}`,
      }, (payload) => {
        if (!active) return;
        const updated = payload.new as StaffNotification;
        setNotifications((current) => {
          if (!STAFF_NOTIFICATION_TYPES.includes(updated.type)) {
            return current.filter((item) => item.id !== updated.id);
          }
          return sortStaffNotifications([
            updated,
            ...current.filter((item) => item.id !== updated.id),
          ]);
        });
      })
      .subscribe((status) => {
        if (active && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
          setNotificationsError('Live notification updates are unavailable. Use refresh to check again.');
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, staffUserId]);

  const markNotificationAsRead = async (notification: StaffNotification) => {
    if (!staffUserId || notification.is_read) return true;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification.id)
      .eq('user_id', staffUserId);

    if (error) {
      setNotificationsError(error.message || 'Unable to mark the notification as read.');
      return false;
    }

    setNotifications((current) => current.map((item) =>
      item.id === notification.id ? { ...item, is_read: true } : item
    ));
    return true;
  };

  const markAllNotificationsAsRead = async () => {
    if (!staffUserId || unreadNotificationCount === 0) return;

    setNotificationsError('');
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', staffUserId)
      .in('type', STAFF_NOTIFICATION_TYPES)
      .eq('is_read', false);

    if (error) {
      setNotificationsError(error.message || 'Unable to mark notifications as read.');
      return;
    }

    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
  };

  const openStaffNotification = async (notification: StaffNotification) => {
    const destination = STAFF_NOTIFICATION_DESTINATIONS[notification.type];
    if (!destination) return;
    if (!(await markNotificationAsRead(notification))) return;
    setNotificationsOpen(false);
    navigate(destination);
  };

  useEffect(() => {
    const load = async () => {
      const [pendingRes, complaintRes, bookingRes, approvedRes, rejectedRes, refundRes, pendingBookingsRes, recentBookings] = await Promise.all([
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }),
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status', 'approved'),
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status', 'rejected'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('refund_status', 'pending'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('bookings').select('id, status, created_at, profiles(full_name), caterers(business_name)').order('created_at', { ascending: false }).limit(3),
      ]);

      setStats({
        pending: pendingRes.count ?? 0,
        complaints: complaintRes.count ?? 0,
        bookings: bookingRes.count ?? 0,
        approved: approvedRes.count ?? 0,
        rejected: rejectedRes.count ?? 0,
        refunds: refundRes.count ?? 0,
        pendingBookings: pendingBookingsRes.count ?? 0,
      });

      const activity = [
        ...(recentBookings.data ?? []).map((b: any) => ({
          Icon: Calendar, color: '#F97316', bg: '#FFF7ED', border: '#FFEDD5',
          text: `${(b.profiles as any)?.full_name ?? '—'} booked ${(b.caterers as any)?.business_name ?? '—'}`,
          sub: `Status: ${b.status}`, time: b.created_at,
        })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 3);

      setRecentActivity(activity);
      setLoading(false);
    };
    load();
  }, []);

  const timeAgo = (ts: string) => {
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const cards = [
    { Icon: Clock, label: 'Pending Verifications', value: stats.pending, color: '#D97706', bg: '#FEF3C7', accent: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', path: '/staff/verification', urgent: stats.pending > 0 },
    { Icon: AlertTriangle, label: 'Open Complaints', value: stats.complaints, color: '#DC2626', bg: '#FEE2E2', accent: 'linear-gradient(135deg, #DC2626 0%, #F87171 100%)', path: '/staff/complaints', urgent: stats.complaints > 0 },
    { Icon: Calendar, label: 'Total Bookings', value: stats.bookings, color: '#16A34A', bg: '#DCFCE7', accent: 'linear-gradient(135deg, #16A34A 0%, #4ADE80 100%)', path: '/staff/bookings', urgent: false },
    { Icon: Banknote, label: 'Pending Refunds', value: stats.refunds, color: '#9333EA', bg: '#F3E8FF', accent: 'linear-gradient(135deg, #9333EA 0%, #A855F7 100%)', path: '/staff/refunds', urgent: stats.refunds > 0 },
  ];

  const actions = [
    { Icon: CheckCircle2, title: 'Review Applications', desc: 'Process pending caterer verification queues', path: '/staff/verification', color: '#D97706', bg: '#FEF3C7', count: stats.pending },
    { Icon: AlertTriangle, title: 'Handle Complaints', desc: 'Investigate and resolve active platform disputes', path: '/staff/complaints', color: '#DC2626', bg: '#FEE2E2', count: stats.complaints },
    { Icon: Calendar, title: 'Monitor Bookings', desc: 'Track event statuses across the marketplace', path: '/staff/bookings', color: '#16A34A', bg: '#DCFCE7', count: stats.pendingBookings },
    { Icon: Banknote, title: 'Process Refunds', desc: 'Manage and disburse pending customer refunds', path: '/staff/refunds', color: '#9333EA', bg: '#F3E8FF', count: stats.refunds },
  ];

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 6, letterSpacing: '-0.5px' }}>
            Welcome back, {profile?.full_name?.split(' ')[0] ?? 'Staff'}! 👋
          </h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>
            Here is your live operations and queue overview for today.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 999, padding: '8px 20px', fontSize: 13, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <Calendar size={16} color="#F97316" />
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>

          <div className="staff-notification-anchor">
            <button
              type="button"
              aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`}
              aria-expanded={notificationsOpen}
              onClick={() => {
                setNotificationsOpen((open) => !open);
                if (staffUserId) void loadNotifications(staffUserId);
              }}
              style={{
                position: 'relative', width: 44, minWidth: 44, height: 44,
                border: '1px solid #E8E4DE', borderRadius: '50%', padding: 0,
                background: notificationsOpen ? '#FFF7ED' : '#FFFFFF', color: '#EA580C',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                transition: 'background 0.2s ease',
              }}
            >
              <Bell size={20} />
              {unreadNotificationCount > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -5, minWidth: 19, height: 19,
                  padding: '0 4px', border: '2px solid #FFFFFF', borderRadius: 20,
                  background: '#EA580C', color: '#FFFFFF', fontSize: 10, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <>
                <button
                  type="button"
                  className="staff-notification-dismiss"
                  aria-label="Close notifications"
                  onClick={() => setNotificationsOpen(false)}
                />

                <section className="staff-notification-panel" aria-label="Staff notifications">
                  <div className="staff-notification-panel-header">
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>
                        Notifications
                        {unreadNotificationCount > 0 && (
                          <span style={{ marginLeft: 8, padding: '3px 7px', borderRadius: 20, background: '#FFEDD5', color: '#C2410C', fontSize: 11 }}>
                            {unreadNotificationCount} new
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 5 }}>Staff activity</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        aria-label="Refresh notifications"
                        title="Refresh notifications"
                        disabled={notificationsLoading || !staffUserId}
                        onClick={() => staffUserId && void loadNotifications(staffUserId)}
                        style={{ border: '1px solid #E8E4DE', borderRadius: 9, padding: 7, background: '#FFFFFF', color: '#EA580C', cursor: notificationsLoading || !staffUserId ? 'not-allowed' : 'pointer', display: 'flex', opacity: notificationsLoading ? 0.6 : 1 }}
                      >
                        {notificationsLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                      </button>
                      <button
                        type="button"
                        aria-label="Close notifications"
                        onClick={() => setNotificationsOpen(false)}
                        style={{ border: 0, background: 'transparent', color: '#9CA3AF', cursor: 'pointer', display: 'flex', padding: 5 }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {unreadNotificationCount > 0 && (
                    <div style={{ padding: '9px 18px', borderBottom: '1px solid #F3F4F6' }}>
                      <button
                        type="button"
                        onClick={() => void markAllNotificationsAsRead()}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, border: 0, padding: 0, background: 'transparent', color: '#EA580C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        <CheckCheck size={15} /> Mark all as read
                      </button>
                    </div>
                  )}

                  {notificationsError && (
                    <div className="staff-notification-error" role="alert">
                      <strong>Could not load notifications.</strong>
                      <div>{notificationsError}</div>
                    </div>
                  )}

                  {notificationsLoading && notifications.length === 0 ? (
                    <div style={{ padding: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, color: '#9CA3AF', fontSize: 13 }}>
                      <Loader2 size={18} className="animate-spin" color="#EA580C" /> Loading notifications...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div style={{ padding: '30px 22px', textAlign: 'center' }}>
                      <div style={{ width: 52, height: 52, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#FFF7ED', color: '#EA580C' }}>
                        <Bell size={23} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>No notifications yet</div>
                      <p style={{ fontSize: 12, lineHeight: 1.6, color: '#9CA3AF', margin: '7px 0 0' }}>
                        New verification requests, complaints, and account appeals will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="staff-notification-list">
                      {notifications.map((notification) => {
                        const NotificationIcon = notification.type === 'new_caterer_verification'
                          ? Store
                          : notification.type === 'new_complaint'
                            ? AlertTriangle
                            : UserRound;
                        const iconColor = notification.type === 'new_caterer_verification'
                          ? '#7C3AED'
                          : '#EA580C';
                        const iconBackground = notification.type === 'new_caterer_verification'
                          ? '#F5F3FF'
                          : '#FFF7ED';
                        const destinationLabel = notification.type === 'new_caterer_verification'
                          ? 'View verification queue'
                          : notification.type === 'new_complaint'
                            ? 'View complaints'
                            : 'View account monitoring';

                        return (
                          <button
                            key={notification.id}
                            type="button"
                            aria-label={`${notification.is_read ? 'Read' : 'Unread'} notification: ${notification.title}`}
                            onClick={() => void openStaffNotification(notification)}
                            className={`staff-notification-item${notification.is_read ? '' : ' unread'}`}
                          >
                            <span className="staff-notification-icon" style={{ color: iconColor, background: iconBackground }}>
                              <NotificationIcon size={17} />
                            </span>
                            <span className="staff-notification-copy">
                              <span className="staff-notification-title-row">
                                <strong>{notification.title}</strong>
                                {!notification.is_read && <i aria-label="Unread" />}
                              </span>
                              <span className="staff-notification-message">{notification.message}</span>
                              <time dateTime={notification.created_at}>
                                {new Date(notification.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                              </time>
                              <span className="staff-notification-destination">{destinationLabel} →</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Primary KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {cards.map((card, i) => {
          const Icon = card.Icon;
          return (
            <div key={i} onClick={() => navigate(card.path)} style={{ position: 'relative', background: '#FFFFFF', borderRadius: 20, padding: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -2px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s ease', overflow: 'hidden' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 20px -3px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)'; }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: card.accent }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, marginTop: 4 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={card.color} />
                </div>
                {card.urgent && card.value > 0 && (
                  <span style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '4px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Action
                  </span>
                )}
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#111', letterSpacing: '-1px', marginBottom: 4 }}>
                  {loading ? <Loader2 size={20} className="animate-spin" color="#9CA3AF" /> : card.value}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Main Content Split Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        {/* Left Column: Quick Operations Grid */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#111', marginBottom: 20, letterSpacing: '-0.5px' }}>Quick Operations</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
            {actions.map((a, i) => {
              const ActionIcon = a.Icon;
              return (
                <div key={i} onClick={() => navigate(a.path)} style={{ background: '#FFFFFF', borderRadius: 20, padding: 24, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)'; }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ActionIcon size={22} color={a.color} />
                      </div>
                      {a.count > 0 && (
                        <span style={{ background: a.bg, color: a.color, border: `1px solid ${a.color}40`, borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 900 }}>
                          {a.count} pending
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#111', marginBottom: 6 }}>{a.title}</div>
                    <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, marginBottom: 16 }}>{a.desc}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: a.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Access Queue <ArrowRight size={14} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Right Column: Verification Summary & Recent Activity */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'stretch' }}>
          {/* Verification Breakdown Widget */}
          <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#111', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 20px 0', letterSpacing: '-0.5px' }}>
              <ShieldCheck size={20} color="#111" /> Verification Breakdown
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Pending Review', value: stats.pending, color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
                { label: 'Approved Vendors', value: stats.approved, color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' },
                { label: 'Rejected Applications', value: stats.rejected, color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: item.bg, borderRadius: 14, border: `1px solid ${item.border}` }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{loading ? '—' : item.value}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Live Activity Feed */}
          <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: 24, flex: 1 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#111', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 20px 0', letterSpacing: '-0.5px' }}>
              <History size={20} color="#111" /> Recent Operations
            </h3>
            {loading ? (
              <div style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: '40px 0' }}>Loading activity logs...</div>
            ) : recentActivity.length === 0 ? (
              <div style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: '40px 0' }}>No recent marketplace activity recorded.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {recentActivity.map((item, i) => {
                  const ItemIcon = item.Icon;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingBottom: i === recentActivity.length - 1 ? 0 : 16, borderBottom: i === recentActivity.length - 1 ? 'none' : '1px solid #F3F4F6' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: item.bg, border: `1px solid ${item.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ItemIcon size={16} color={item.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{item.text}</div>
                        <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{item.sub}</span>
                          <span style={{ fontWeight: 600, color: '#9CA3AF' }}>{timeAgo(item.time)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .staff-notification-anchor { position: relative; z-index: 50; }
        .staff-notification-dismiss { position: fixed; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; cursor: default; z-index: -1; }
        .staff-notification-panel { position: absolute; top: 52px; right: 0; width: 360px; max-width: calc(100vw - 32px); max-height: min(560px, calc(100dvh - 84px)); display: flex; flex-direction: column; background: #FFF; border: 1px solid #E8E4DE; border-radius: 16px; box-shadow: 0 12px 35px rgba(0,0,0,.12); overflow: hidden; z-index: 60; color: #111827; font-family: Inter, system-ui, sans-serif; }
        .staff-notification-panel-header { flex: 0 0 auto; padding: 16px 18px; border-bottom: 1px solid #F3F4F6; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .staff-notification-error { margin: 12px; padding: 12px; border-radius: 10px; background: #FEF2F2; color: #B91C1C; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
        .staff-notification-list { min-height: 0; max-height: min(360px, calc(100dvh - 200px)); overflow-y: auto; overscroll-behavior: contain; }
        .staff-notification-item { width: 100%; display: flex; align-items: flex-start; gap: 12px; padding: 10px 14px; border: 0; border-bottom: 1px solid #F3F4F6; text-align: left; background: #FFF; cursor: pointer; transition: background .15s ease; }
        .staff-notification-item.unread { background: #FFFCF8; }
        .staff-notification-item:hover { background: #FFF7ED; }
        .staff-notification-icon { width: 38px; height: 38px; flex: 0 0 38px; display: flex; align-items: center; justify-content: center; border-radius: 12px; }
        .staff-notification-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .staff-notification-title-row { display: flex; align-items: center; gap: 6px; color: #1F2937; font-size: 13px; font-weight: 700; }
        .staff-notification-title-row strong { min-width: 0; overflow-wrap: anywhere; }
        .staff-notification-title-row i { width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; background: #EA580C; }
        .staff-notification-message { margin-top: 4px; color: #6B7280; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
        .staff-notification-copy time { display: block; margin-top: 6px; color: #9CA3AF; font-size: 11px; line-height: 1.3; }
        .staff-notification-destination { display: block; margin-top: 5px; color: #EA580C; font-size: 11px; font-weight: 700; }
        @media (max-width: 540px) {
          .staff-notification-panel { position: fixed; top: 68px; right: 12px; width: 360px; max-width: calc(100vw - 24px); max-height: calc(100dvh - 82px); }
          .staff-notification-list { max-height: calc(100dvh - 205px); }
        }
      `}</style>
    </div>
  );
}
