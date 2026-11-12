import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  Calendar,
  Wallet,
  UserCog,
  TrendingUp,
  ArrowRight,
  Store,
  AlertTriangle,
  FileClock,
  Loader2,
  Bell,
  X,
  RefreshCw,
  CheckCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

import './Dashboard.css';
import RevenueTrendChart from './RevenueTrendChart';

const ORANGE = '#F97316';
const MONEY = (value: number) => `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

// Consistent CaterConnect role badges for the recent registrations table.
const roleBg: Record<string, string> = {
  customer: '#F3F4F6',
  caterer: '#FFF7ED',
  staff: '#F3F4F6',
  admin: '#FFEDD5',
};

const roleColor: Record<string, string> = {
  customer: '#475569',
  caterer: '#C2410C',
  staff: '#475569',
  admin: '#9A3412',
};

type AdminNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type:
    | 'new_customer_registration'
    | 'new_caterer_registration'
    | 'new_caterer_verification'
    | 'caterer_verification_decision'
    | 'account_appeal_admin_decision'
    | 'complaint_handled';
  booking_id: string | null;
  is_read: boolean;
  created_at: string;
};

const ADMIN_NOTIFICATION_TYPES = [
  'new_customer_registration',
  'new_caterer_registration',
  'new_caterer_verification',
  'caterer_verification_decision',
  'account_appeal_admin_decision',
  'complaint_handled',
];

export default function AdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalUsers: 0,
    caterers: 0,
    verified: 0,
    pending: 0,
    bookings: 0,
    revenue: 0,
    complaints: 0,
    userTrend: '+0 this month',
    catererTrend: '+0 this month',
    bookingTrend: '+0 this month',
    revenueTrend: '₱0 new',
  });

  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);
  const [revenuePayments, setRevenuePayments] = useState<{amount: number|string|null; confirmed_at: string|null}[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({ customer: 0, caterer: 0, staff: 0, admin: 0 });
  const [loading, setLoading] = useState(true);

  const [notifications, setNotifications] = useState<
    AdminNotification[]
  >([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');

  const adminId = profile?.id;

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  // Load dashboard statistics and recent registrations.
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const now = new Date();
        const startCurr = new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        ).toISOString();

        const [
          totalUsersRes,
          caterersRes,
          bookingsRes,
          usersCurr,
          caterersCurr,
          bookingsCurr,
          revAll,
          revCurr,
          verifiedRes,
          pendingRes,
          complaintsRes,
          users,
          profilesByRole,
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true }),

          supabase
            .from('caterers')
            .select('id', { count: 'exact', head: true }),

          supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true }),

          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', startCurr),

          supabase
            .from('caterers')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', startCurr),

          supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', startCurr),

          supabase
            .from('subscription_payments')
            .select('amount, confirmed_at')
            .eq('status', 'confirmed'),

          supabase
            .from('subscription_payments')
            .select('amount')
            .eq('status', 'confirmed')
            .gte('created_at', startCurr),

          supabase
            .from('caterers')
            .select('id', { count: 'exact', head: true })
            .eq('verification_status', 'approved'),

          supabase
            .from('caterers')
            .select('id', { count: 'exact', head: true })
            .eq('verification_status', 'pending'),

          supabase
            .from('complaints')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'open'),

          supabase
            .from('profiles')
            .select(
              'id, full_name, email, role, created_at, avatar_url'
            )
            .order('created_at', { ascending: false })
            .limit(5),

          supabase.from('profiles').select('role'),
        ]);

        if (!active) return;

        const totalRevenue = (revAll.data ?? []).reduce(
          (sum: number, payment: any) =>
            sum + Number(payment.amount ?? 0),
          0
        );

        const revenueCurrTotal = (revCurr.data ?? []).reduce(
          (sum: number, payment: any) =>
            sum + Number(payment.amount ?? 0),
          0
        );

        setStats({
          totalUsers: totalUsersRes.count ?? 0,
          caterers: caterersRes.count ?? 0,
          verified: verifiedRes.count ?? 0,
          pending: pendingRes.count ?? 0,
          bookings: bookingsRes.count ?? 0,
          revenue: totalRevenue,
          complaints: complaintsRes.count ?? 0,
          userTrend: `+${usersCurr.count ?? 0} this month`,
          catererTrend: `+${caterersCurr.count ?? 0} this month`,
          bookingTrend: `+${bookingsCurr.count ?? 0} this month`,
          revenueTrend: `₱${revenueCurrTotal.toLocaleString()} new`,
        });

        setRecentUsers(users.data ?? []);
        setRevenueThisMonth(revenueCurrTotal);
        setRevenuePayments((revAll.data ?? []).map(payment => ({ amount: payment.amount, confirmed_at: payment.confirmed_at })));
        if (!profilesByRole.error) {
          const counts: Record<string, number> = { customer: 0, caterer: 0, staff: 0, admin: 0 };
          (profilesByRole.data ?? []).forEach(row => { if (row.role in counts) counts[row.role] += 1; });
          setRoleCounts(counts);
        }
      } catch (error) {
        console.error('Failed to load admin dashboard:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  // Load saved notifications for the current admin.
  const loadNotifications = async (userId: string) => {
    setNotificationsLoading(true);
    setNotificationsError('');

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(
          'id, user_id, title, message, type, booking_id, is_read, created_at'
        )
        .eq('user_id', userId)
        .in('type', ADMIN_NOTIFICATION_TYPES)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Failed to load admin notifications:', error);
        setNotificationsError(error.message);
        return;
      }

      setNotifications((data ?? []) as AdminNotification[]);
    } catch (error) {
      console.error('Unexpected notification error:', error);
      setNotificationsError(
        'Unable to load notifications. Please try again.'
      );
    } finally {
      setNotificationsLoading(false);
    }
  };

  // Load saved notifications and listen for new Admin alerts.
  useEffect(() => {
    if (!adminId) return;

    void loadNotifications(adminId);

    const channel = supabase
      .channel(`admin-notifications-${adminId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${adminId}`,
        },
        (payload) => {
          const incoming = payload.new as AdminNotification;

          if (!ADMIN_NOTIFICATION_TYPES.includes(incoming.type)) return;

          setNotifications((previous) => {
            const withoutDuplicate = previous.filter(
              (item) => item.id !== incoming.id
            );

            return [incoming, ...withoutDuplicate].slice(0, 20);
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(
            'Admin notification subscription status:',
            status
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [adminId]);

  // Mark one notification as read.
  // Return true only when the database update succeeds.
  const markNotificationAsRead = async (
    notificationId: string
  ): Promise<boolean> => {
    if (!adminId) return false;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', adminId);

    if (error) {
      console.error('Failed to mark notification as read:', error);
      setNotificationsError(error.message);
      return false;
    }

    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === notificationId
          ? { ...notification, is_read: true }
          : notification
      )
    );

    return true;
  };

  // Mark every Admin notification as read.
  const markAllNotificationsAsRead = async () => {
    if (!adminId || unreadCount === 0) return;

    setNotificationsError('');

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', adminId)
      .in('type', ADMIN_NOTIFICATION_TYPES)
      .eq('is_read', false);

    if (error) {
      console.error(
        'Failed to mark all notifications as read:',
        error
      );
      setNotificationsError(error.message);
      return;
    }

    setNotifications((previous) =>
      previous.map((notification) => ({
        ...notification,
        is_read: true,
      }))
    );
  };

  // Mark as read and navigate to the appropriate page.
  const handleNotificationNavigation = async (
    notification: AdminNotification
) => {
  setNotificationsError('');

  if (!notification.is_read) {
    const success = await markNotificationAsRead(notification.id);

    // Stop navigation if marking as read fails.
    if (!success) return;
  }

  setNotificationsOpen(false);
  const destination =
    (notification.type === 'caterer_verification_decision' || notification.type === 'new_caterer_verification')
      ? '/staff/verification'
      : notification.type === 'complaint_handled'
        ? '/staff/complaints'
        // Account appeals awaiting an Admin decision are handled in User Directory.
        : '/admin/users';
  navigate(destination);
};

  const adminFullName = profile?.full_name ?? 'Admin';
  const roleOrder = [
    { key: 'customer', label: 'Customer', color: '#FED7AA' },
    { key: 'caterer', label: 'Caterer', color: '#FDBA74' },
    { key: 'staff', label: 'Staff', color: '#FB923C' },
    { key: 'admin', label: 'Admin', color: '#C2410C' },
  ];
  const roleTotal = roleOrder.reduce((total, role) => total + (roleCounts[role.key] ?? 0), 0);
  let roleOffset = 0;
  const roleStops = roleOrder.map(role => {
    const share = roleTotal ? (roleCounts[role.key] ?? 0) / roleTotal * 100 : 0;
    const start = roleOffset; roleOffset += share;
    return `${role.color} ${start}% ${roleOffset}%`;
  });
  const cardData = [
    { label: 'Total Users', value: stats.totalUsers.toLocaleString('en-PH'), change: stats.userTrend, icon: Users, path: '/admin/users' },
    { label: 'Registered Caterers', value: stats.caterers.toLocaleString('en-PH'), change: stats.catererTrend, icon: Store, path: '/admin/users?role=caterer' },
    { label: 'Total Bookings', value: stats.bookings.toLocaleString('en-PH'), change: stats.bookingTrend, icon: Calendar, path: '/staff/bookings' },
    { label: 'Total Revenue', value: MONEY(stats.revenue), change: stats.revenueTrend, icon: Wallet, path: '/admin/revenue' },
  ];
  const quickActions = [
    { label: 'Caterer Verification', icon: Store, path: '/staff/verification' },
    { label: 'Subscriptions', icon: Wallet, path: '/staff/subscriptions' },
    { label: 'Complaints', icon: AlertTriangle, path: '/staff/complaints' },
    { label: 'Booking Monitor', icon: Calendar, path: '/staff/bookings' },
    { label: 'Account Monitoring', icon: Users, path: '/staff/account-monitoring' },
    { label: 'Refund Management', icon: Wallet, path: '/staff/refunds' },
  ];

  return (
    <div className="cc-admin-modern">
      <header className="cc-admin-header">
        <div>
          <div className="cc-admin-eyebrow">CATERCONNECT / ADMIN OVERVIEW</div>
          <h1>Welcome back, {adminFullName}! <span aria-hidden="true">👋</span></h1>
          <p>Monitor the people, bookings and revenue behind your catering marketplace.</p>
        </div>
        <div className="cc-admin-header-actions">
          <div className="cc-admin-date"><Calendar size={16} color={ORANGE}/>{new Date().toLocaleDateString('en-PH', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</div>
          <div style={{ position: 'relative', zIndex: 50 }}>
            {/* Circular notification bell */}
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              onClick={() => {
                setNotificationsOpen((open) => !open);

                if (adminId) {
                  void loadNotifications(adminId);
                }
              }}
              style={{
                position: 'relative',
                width: 44,
                minWidth: 44,
                height: 44,
                border: '1px solid #E8E4DE',
                borderRadius: '50%',
                padding: 0,
                background: notificationsOpen ? '#FFF7ED' : '#FFFFFF',
                color: '#EA580C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                transition: 'background 0.2s ease',
              }}
            >
              <Bell size={20} />

              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -5,
                    right: -5,
                    minWidth: 19,
                    height: 19,
                    padding: '0 4px',
                    border: '2px solid #FFFFFF',
                    borderRadius: 20,
                    background: '#EA580C',
                    color: '#FFFFFF',
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <>
                {/* Click outside to close */}
                <button
                  type="button"
                  aria-label="Close notifications"
                  onClick={() => setNotificationsOpen(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    border: 0,
                    background: 'transparent',
                    cursor: 'default',
                    zIndex: -1,
                  }}
                />

                <div
                  style={{
                    position: 'absolute',
                    top: 52,
                    right: 0,
                    width: 360,
                    maxWidth: 'calc(100vw - 32px)',
                    background: '#FFFFFF',
                    border: '1px solid #E8E4DE',
                    borderRadius: 16,
                    boxShadow: '0 12px 35px rgba(0,0,0,0.12)',
                    overflow: 'hidden',
                    zIndex: 60,
                  }}
                >
                  {/* Dropdown Header */}
                  <div
                    style={{
                      padding: '16px 18px',
                      borderBottom: '1px solid #F3F4F6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: '#111',
                        }}
                      >
                        Notifications

                        {unreadCount > 0 && (
                          <span
                            style={{
                              marginLeft: 8,
                              padding: '3px 7px',
                              borderRadius: 20,
                              background: '#FFEDD5',
                              color: '#C2410C',
                              fontSize: 11,
                            }}
                          >
                            {unreadCount} new
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: '#9CA3AF',
                          marginTop: 5,
                        }}
                      >
                        Platform activity
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <button
                        type="button"
                        aria-label="Refresh notifications"
                        title="Refresh notifications"
                        disabled={notificationsLoading || !adminId}
                        onClick={() => {
                          if (adminId) {
                            void loadNotifications(adminId);
                          }
                        }}
                        style={{
                          border: '1px solid #E8E4DE',
                          borderRadius: 9,
                          padding: 7,
                          background: '#FFFFFF',
                          color: '#EA580C',
                          cursor:
                            notificationsLoading || !adminId
                              ? 'not-allowed'
                              : 'pointer',
                          display: 'flex',
                          opacity: notificationsLoading ? 0.6 : 1,
                        }}
                      >
                        {notificationsLoading ? (
                          <Loader2
                            size={16}
                            className="animate-spin"
                          />
                        ) : (
                          <RefreshCw size={16} />
                        )}
                      </button>

                      <button
                        type="button"
                        aria-label="Close notifications"
                        onClick={() => setNotificationsOpen(false)}
                        style={{
                          border: 0,
                          background: 'transparent',
                          color: '#9CA3AF',
                          cursor: 'pointer',
                          display: 'flex',
                          padding: 5,
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Mark All as Read */}
                  {unreadCount > 0 && (
                    <div
                      style={{
                        padding: '9px 18px',
                        borderBottom: '1px solid #F3F4F6',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          void markAllNotificationsAsRead()
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          border: 0,
                          padding: 0,
                          background: 'transparent',
                          color: '#EA580C',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <CheckCheck size={15} />
                        Mark all as read
                      </button>
                    </div>
                  )}

                  {/* Error */}
                  {notificationsError && (
                    <div
                      style={{
                        margin: 12,
                        padding: 12,
                        borderRadius: 10,
                        background: '#FEF2F2',
                        color: '#B91C1C',
                        fontSize: 12,
                        lineHeight: 1.5,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      <strong>Could not load notifications.</strong>
                      <div>{notificationsError}</div>
                    </div>
                  )}

                  {/* Loading, Empty, or Notification List */}
                  {notificationsLoading &&
                  notifications.length === 0 ? (
                    <div
                      style={{
                        padding: 30,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 10,
                        color: '#9CA3AF',
                        fontSize: 13,
                      }}
                    >
                      <Loader2
                        size={18}
                        className="animate-spin"
                        color="#EA580C"
                      />
                      Loading notifications...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div
                      style={{
                        padding: '30px 22px',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          margin: '0 auto 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          background: '#FFF7ED',
                          color: '#EA580C',
                        }}
                      >
                        <Bell size={23} />
                      </div>

                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#374151',
                        }}
                      >
                        No notifications yet
                      </div>

                      <p
                        style={{
                          fontSize: 12,
                          lineHeight: 1.6,
                          color: '#9CA3AF',
                          margin: '7px 0 0',
                        }}
                      >
                        New registrations and Staff activity will appear here.
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        maxHeight: 360,
                        overflowY: 'auto',
                      }}
                    >
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          aria-label={`Open ${notification.title}`}
                          onClick={() => {
                            void handleNotificationNavigation(
                              notification
                            );
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            gap: 12,
                            padding: '15px 18px',
                            border: 0,
                            borderBottom: '1px solid #F3F4F6',
                            textAlign: 'left',
                            background: notification.is_read
                              ? '#FFFFFF'
                              : '#FFFCF8',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(event) => {
                            event.currentTarget.style.background =
                              '#FFF7ED';
                          }}
                          onMouseLeave={(event) => {
                            event.currentTarget.style.background =
                              notification.is_read
                                ? '#FFFFFF'
                                : '#FFFCF8';
                          }}
                        >
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              flexShrink: 0,
                              borderRadius: 12,
                              background:
                                notification.type === 'new_caterer_registration' ||
                                notification.type === 'caterer_verification_decision'
                                  ? '#F5F3FF'
                                  : notification.type === 'account_appeal_admin_decision'
                                    ? '#EFF6FF'
                                  : notification.type === 'complaint_handled'
                                    ? '#FEF2F2'
                                    : '#FFF7ED',
                              color:
                                notification.type === 'new_caterer_registration' ||
                                notification.type === 'caterer_verification_decision'
                                  ? '#7C3AED'
                                  : notification.type === 'account_appeal_admin_decision'
                                    ? '#2563EB'
                                  : notification.type === 'complaint_handled'
                                    ? '#DC2626'
                                    : '#EA580C',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {notification.type === 'caterer_verification_decision' ||
                            notification.type === 'new_caterer_registration' ? (
                              <Store size={18} />
                            ) : notification.type === 'account_appeal_admin_decision' ? (
                              <FileClock size={18} />
                            ) : notification.type === 'complaint_handled' ? (
                              <AlertTriangle size={18} />
                            ) : (
                              <Users size={18} />
                            )}
                          </div>

                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#1F2937',
                              }}
                            >
                              <span>{notification.title}</span>

                              {!notification.is_read && (
                                <span
                                  style={{
                                    width: 7,
                                    height: 7,
                                    flexShrink: 0,
                                    borderRadius: '50%',
                                    background: '#EA580C',
                                  }}
                                />
                              )}
                            </div>

                            <div
                              style={{
                                fontSize: 12,
                                color: '#6B7280',
                                lineHeight: 1.6,
                                marginTop: 4,
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {notification.message}
                            </div>

                            <div
                              style={{
                                fontSize: 11,
                                color: '#9CA3AF',
                                marginTop: 6,
                              }}
                            >
                              {new Date(
                                notification.created_at
                              ).toLocaleString('en-PH', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </div>

                            <div
                              style={{
                                marginTop: 7,
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#EA580C',
                              }}
                            >
                              {notification.type === 'account_appeal_admin_decision'
                                ? 'Review pending appeal →'
                                : 'View user directory →'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      padding: '12px 18px',
                      background: '#FAFAF9',
                      borderTop: '1px solid #F3F4F6',
                      fontSize: 11,
                      color: '#9CA3AF',
                    }}
                  >
                    Admin registration alerts
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <section aria-label="Platform key performance indicators" className="cc-admin-kpis">
        {cardData.map(card => {
          const Icon = card.icon;
          return <button key={card.label} type="button" className="cc-admin-kpi" onClick={() => navigate(card.path)}>
            <div className="cc-admin-kpi-top"><div className="cc-admin-icon"><Icon size={20}/></div><ArrowRight size={17} className="cc-admin-kpi-arrow"/></div>
            <div className="cc-admin-kpi-value">{loading ? <Loader2 size={25} className="animate-spin"/> : card.value}</div>
            <div className="cc-admin-kpi-label">{card.label}</div>
            <div className="cc-admin-kpi-trend"><TrendingUp size={13}/>{card.change}</div>
          </button>;
        })}
      </section>

      <div className="cc-admin-analytics">
        <section className="cc-admin-panel cc-admin-revenue" aria-label="Revenue overview">
          <RevenueTrendChart payments={revenuePayments} loading={loading} totalRevenue={stats.revenue} />
          <div className="cc-admin-chart-footer"><span>This month's confirmed revenue: <strong>{loading ? '—' : MONEY(revenueThisMonth)}</strong></span><button type="button" className="cc-admin-text-link" onClick={() => navigate('/admin/revenue')}>View Revenue <ArrowRight size={15}/></button></div>
        </section>
        <section className="cc-admin-panel" aria-label="Users by role">
          <div className="cc-admin-panel-heading"><div><div className="cc-admin-section-eyebrow">PLATFORM COMMUNITY</div><h2><Users size={19}/> Users by Role</h2><p>Live breakdown of registered account roles.</p></div></div>
          <div className="cc-admin-caterer-overview">
            <div className="cc-admin-donut" style={{ background: roleTotal ? `conic-gradient(${roleStops.join(', ')})` : '#F1E8DE' }}><div><strong>{loading ? '—' : roleTotal}</strong><span>Total users</span></div></div>
            <div className="cc-admin-donut-legend">
              {roleOrder.map(role => <div key={role.key}><span className="cc-admin-legend-dot" style={{ background: role.color }}/><span>{role.label}</span><strong>{loading ? '—' : roleCounts[role.key] ?? 0}</strong></div>)}
              <button type="button" onClick={() => navigate('/admin/users')}>View user directory <ArrowRight size={15}/></button>
            </div>
          </div>
          <div className="cc-admin-panel-foot">Verified caterers: <strong>{loading ? '—' : stats.verified}</strong> <span>·</span> Pending verification: <strong>{loading ? '—' : stats.pending}</strong></div>
        </section>
      </div>

      <div className="cc-admin-management">
        <section className="cc-admin-panel" aria-label="Quick staff actions">
          <div className="cc-admin-panel-heading"><div><div className="cc-admin-section-eyebrow">WORKSPACE</div><h2><UserCog size={19}/> Quick Admin Actions</h2><p>Access the six core Staff operations directly from your Admin dashboard.</p></div></div>
          <div className="cc-admin-quick-grid">
            {quickActions.map(item => { const Icon = item.icon; return <button type="button" key={item.path} className="cc-admin-action" onClick={() => navigate(item.path)}><span className="cc-admin-icon"><Icon size={19}/></span><span>{item.label}</span><ArrowRight size={16} className="cc-admin-action-arrow"/></button>})}
          </div>
        </section>
        <section className="cc-admin-panel" aria-label="Operations attention center">
          <div className="cc-admin-panel-heading"><div><div className="cc-admin-section-eyebrow">ITEMS TO TRACK</div><h2><Clock size={19}/> Action Center</h2><p>Current verification and complaint queues.</p></div></div>
          <div className="cc-admin-queue">
            <button onClick={() => navigate('/staff/verification')}><div className="cc-admin-icon"><Clock size={18}/></div><span><strong>Pending Verifications</strong><small>Caterers awaiting review</small></span><b>{loading ? '—' : stats.pending}</b><ArrowRight size={16}/></button>
            <button onClick={() => navigate('/staff/complaints')}><div className="cc-admin-icon"><AlertTriangle size={18}/></div><span><strong>Open Complaints</strong><small>Cases requiring review</small></span><b>{loading ? '—' : stats.complaints}</b><ArrowRight size={16}/></button>
            <button onClick={() => navigate('/staff/verification')}><div className="cc-admin-icon"><Store size={18}/></div><span><strong>Verified Caterers</strong><small>Approved on the platform</small></span><b>{loading ? '—' : stats.verified}</b><ArrowRight size={16}/></button>
          </div>
        </section>
      </div>

      {/* Recent Registrations */}
      <div style={{ width: '100%', minWidth: 0 }}>
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 20,
            border: '1px solid #E8E4DE',
            boxShadow: '0 8px 28px rgba(15,23,42,0.035)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '24px 24px 20px',
              borderBottom: '1px solid #E8E4DE',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#FFFFFF',
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: '#111',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: 0,
              }}
            >
              <UserCog size={19} color="#EA580C" />
              Recent Registrations
            </h3>

            <button
              type="button"
              onClick={() => navigate('/admin/users')}
              style={{
                background: '#FFF7ED',
                border: '1px solid #FED7AA',
                color: '#EA580C',
                padding: '7px 14px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = '#FFEDD5';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = '#FFF7ED';
              }}
            >
              View Directory <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ flex: 1, overflowX: 'auto' }}>
            {loading ? (
              <div
                style={{
                  padding: 60,
                  textAlign: 'center',
                  color: '#9CA3AF',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Loader2
                  size={32}
                  className="animate-spin"
                  color="#EA580C"
                />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  Loading user directory...
                </span>
              </div>
            ) : recentUsers.length === 0 ? (
              <div
                style={{
                  padding: 60,
                  textAlign: 'center',
                  color: '#9CA3AF',
                }}
              >
                No recent users found.
              </div>
            ) : (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: '#F9FAFB',
                      borderBottom: '1px solid #E8E4DE',
                    }}
                  >
                    <th
                      style={{
                        padding: '16px 24px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#374151',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      User Profile
                    </th>

                    <th
                      style={{
                        padding: '16px 24px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#374151',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Account Email
                    </th>

                    <th
                      style={{
                        padding: '16px 24px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#374151',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Role Assignment
                    </th>

                    <th
                      style={{
                        padding: '16px 24px',
                        textAlign: 'right',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#374151',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Date Joined
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentUsers.map((u, i) => (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom:
                          i === recentUsers.length - 1
                            ? 'none'
                            : '1px solid #E8E4DE',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background =
                          '#F9FAFB';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background =
                          'transparent';
                      }}
                    >
                      <td style={{ padding: '16px 24px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                          }}
                        >
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={u.full_name ?? 'User'}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2px solid #F3F4F6',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                background:
                                  roleBg[u.role] ?? '#F3F4F6',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 14,
                                fontWeight: 700,
                                color:
                                  roleColor[u.role] ?? '#6B7280',
                              }}
                            >
                              {(u.full_name ?? 'U')
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}

                          <div>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: '#111',
                                marginBottom: 2,
                              }}
                            >
                              {u.full_name ?? '—'}
                            </div>

                            <div
                              style={{
                                fontSize: 11.5,
                                color: '#9CA3AF',
                                fontFamily: 'monospace',
                              }}
                            >
                              ID: {u.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td
                        style={{
                          padding: '16px 24px',
                          color: '#4B5563',
                          fontSize: 14,
                        }}
                      >
                        {u.email}
                      </td>

                      <td style={{ padding: '16px 24px' }}>
                        <span
                          style={{
                            padding: '5px 12px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 700,
                            background:
                              roleBg[u.role] ?? '#F3F4F6',
                            color:
                              roleColor[u.role] ?? '#6B7280',
                            textTransform: 'capitalize',
                          }}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td
                        style={{
                          padding: '16px 24px',
                          fontSize: 13,
                          color: '#6B7280',
                          textAlign: 'right',
                          fontWeight: 500,
                        }}
                      >
                        {u.created_at
                          ? new Date(
                              u.created_at
                            ).toLocaleDateString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
