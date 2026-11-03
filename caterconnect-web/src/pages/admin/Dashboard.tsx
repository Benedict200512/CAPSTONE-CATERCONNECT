import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  Wallet,
  UserCog,
  Activity,
  CreditCard,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
  Store,
  Loader2,
  Sparkles,
  Zap,
  Crown,
  Building2,
  Bell,
  X,
  RefreshCw,
  CheckCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type RegistrationNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'new_customer_registration' | 'new_caterer_registration';
  booking_id: string | null;
  is_read: boolean;
  created_at: string;
};

const REGISTRATION_TYPES = [
  'new_customer_registration',
  'new_caterer_registration',
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
  const [loading, setLoading] = useState(true);

  const [notifications, setNotifications] = useState<
    RegistrationNotification[]
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
            .select('amount')
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

  // Load saved registration notifications for the current admin.
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
        .in('type', REGISTRATION_TYPES)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Failed to load admin notifications:', error);
        setNotificationsError(error.message);
        return;
      }

      setNotifications((data ?? []) as RegistrationNotification[]);
    } catch (error) {
      console.error('Unexpected notification error:', error);
      setNotificationsError(
        'Unable to load notifications. Please try again.'
      );
    } finally {
      setNotificationsLoading(false);
    }
  };

  // Load saved notifications and listen for new registration alerts.
  useEffect(() => {
    if (!adminId) return;

    void loadNotifications(adminId);

    const channel = supabase
      .channel(`admin-registration-notifications-${adminId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${adminId}`,
        },
        (payload) => {
          const incoming = payload.new as RegistrationNotification;

          // Only show customer and caterer registration alerts.
          if (!REGISTRATION_TYPES.includes(incoming.type)) return;

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

  // Mark every registration notification as read.
  const markAllNotificationsAsRead = async () => {
    if (!adminId || unreadCount === 0) return;

    setNotificationsError('');

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', adminId)
      .in('type', REGISTRATION_TYPES)
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
  notification: RegistrationNotification
) => {
  setNotificationsError('');

  if (!notification.is_read) {
    const success = await markNotificationAsRead(notification.id);

    // Stop navigation if marking as read fails.
    if (!success) return;
  }

  setNotificationsOpen(false);
  navigate('/admin/users');
};

  const roleColor: Record<string, string> = {
    customer: '#2563EB',
    caterer: '#7C3AED',
    staff: '#16A34A',
    admin: '#F97316',
  };

  const roleBg: Record<string, string> = {
    customer: '#DBEAFE',
    caterer: '#F5F3FF',
    staff: '#DCFCE7',
    admin: '#FEF3E8',
  };

  const adminFullName = profile?.full_name ?? 'Admin';

  return (
    <div
      style={{
        paddingBottom: 40,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 20,
          flexWrap: 'wrap',
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: '#111',
              marginBottom: 6,
              letterSpacing: '-0.01em',
            }}
          >
            Welcome back, {adminFullName}! 👋
          </h1>

          <p
            style={{
              fontSize: 14,
              color: '#6B7280',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Here is your daily snapshot of CaterConnect&apos;s platform
            operations.
          </p>
        </div>

        {/* Date and Notification Bell */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E8E4DE',
              borderRadius: 20,
              padding: '8px 16px',
              fontSize: 13,
              color: '#4B5563',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            <Calendar size={15} color="#EA580C" />
            {new Date().toLocaleDateString('en-PH', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>

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
                        Registration activity
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
                        New customer and caterer registrations will
                        appear here.
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
                                notification.type ===
                                'new_caterer_registration'
                                  ? '#F5F3FF'
                                  : '#FFF7ED',
                              color:
                                notification.type ===
                                'new_caterer_registration'
                                  ? '#7C3AED'
                                  : '#EA580C',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {notification.type ===
                            'new_caterer_registration' ? (
                              <Store size={18} />
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
                              View user directory →
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
      </div>

      {/* Primary KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 20,
          marginBottom: 28,
        }}
      >
        {[
          {
            label: 'Total Users',
            value: stats.totalUsers,
            icon: Users,
            color: '#F97316',
            bg: '#FFF7ED',
            accent:
              'linear-gradient(135deg, #F97316 0%, #FB923C 100%)',
            trend: stats.userTrend,
            path: '/admin/users',
          },
          {
            label: 'Registered Caterers',
            value: stats.caterers,
            icon: Store,
            color: '#16A34A',
            bg: '#DCFCE7',
            accent:
              'linear-gradient(135deg, #16A34A 0%, #4ADE80 100%)',
            trend: stats.catererTrend,
            path: '/admin/users?role=caterer',
          },
          {
            label: 'Total Bookings',
            value: stats.bookings,
            icon: Calendar,
            color: '#2563EB',
            bg: '#DBEAFE',
            accent:
              'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)',
            trend: stats.bookingTrend,
            path: '/staff/bookings',
          },
          {
            label: 'Total Revenue',
            value: `₱${stats.revenue.toLocaleString()}`,
            icon: Wallet,
            color: '#7C3AED',
            bg: '#F5F3FF',
            accent:
              'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
            trend: stats.revenueTrend,
            path: '/admin/revenue',
          },
        ].map((card, i) => {
          const Icon = card.icon;

          return (
            <div
              key={i}
              onClick={() => navigate(card.path)}
              style={{
                position: 'relative',
                background: '#FFFFFF',
                borderRadius: 24,
                padding: '24px 22px',
                border: '1px solid #E8E4DE',
                boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                overflow: 'hidden',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform =
                  'translateY(-3px)';
                event.currentTarget.style.boxShadow =
                  '0 14px 36px rgba(0,0,0,0.07)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = 'translateY(0)';
                event.currentTarget.style.boxShadow =
                  '0 10px 30px rgba(0,0,0,0.04)';
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: card.accent,
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 18,
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: card.bg,
                    border: '1px solid #FED7AA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={22} color={card.color} />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#DCFCE7',
                    color: '#166534',
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  <TrendingUp size={13} />
                  {card.trend}
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: '#111',
                    letterSpacing: '-0.01em',
                    marginBottom: 4,
                  }}
                >
                  {loading ? (
                    <Loader2
                      size={22}
                      className="animate-spin"
                      color="#9CA3AF"
                    />
                  ) : (
                    card.value
                  )}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#6B7280',
                  }}
                >
                  {card.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Center and Subscription Tiers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
          alignItems: 'stretch',
          marginBottom: 24,
        }}
      >
        {/* Action Center */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 24,
            border: '1px solid #E8E4DE',
            boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            padding: 24,
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
              margin: '0 0 20px 0',
            }}
          >
            <Activity size={19} color="#111" />
            Action Center
          </h3>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div
              onClick={() => navigate('/staff/verification')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: '#FEF3C7',
                borderRadius: 16,
                cursor: 'pointer',
                border: '1px solid #FDE68A',
                transition: 'transform 0.15s',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform = 'scale(1.01)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    background: '#FFFBEB',
                    padding: 8,
                    borderRadius: 10,
                    border: '1px solid #FDE68A',
                  }}
                >
                  <Clock size={18} color="#D97706" />
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: '#92400E',
                    }}
                  >
                    Pending Verifications
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#B45309',
                      marginTop: 2,
                    }}
                  >
                    Caterers waiting for review
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: '#92400E',
                  }}
                >
                  {loading ? '-' : stats.pending}
                </span>
                <ArrowRight size={16} color="#D97706" />
              </div>
            </div>

            <div
              onClick={() => navigate('/staff/complaints')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: '#FEE2E2',
                borderRadius: 16,
                cursor: 'pointer',
                border: '1px solid #FECACA',
                transition: 'transform 0.15s',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform = 'scale(1.01)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    background: '#FEF2F2',
                    padding: 8,
                    borderRadius: 10,
                    border: '1px solid #FECACA',
                  }}
                >
                  <ShieldAlert size={18} color="#DC2626" />
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: '#991B1B',
                    }}
                  >
                    Open Complaints
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#B91C1C',
                      marginTop: 2,
                    }}
                  >
                    Requires immediate action
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: '#991B1B',
                  }}
                >
                  {loading ? '-' : stats.complaints}
                </span>
                <ArrowRight size={16} color="#DC2626" />
              </div>
            </div>

            <div
              onClick={() => navigate('/staff/verification')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: '#DCFCE7',
                borderRadius: 16,
                cursor: 'pointer',
                border: '1px solid #BBF7D0',
                transition: 'transform 0.15s',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform = 'scale(1.01)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    background: '#F0FDF4',
                    padding: 8,
                    borderRadius: 10,
                    border: '1px solid #BBF7D0',
                  }}
                >
                  <CheckCircle2 size={18} color="#16A34A" />
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: '#166534',
                    }}
                  >
                    Verified Caterers
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#15803D',
                      marginTop: 2,
                    }}
                  >
                    Active on the platform
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: '#166534',
                  }}
                >
                  {loading ? '-' : stats.verified}
                </span>
                <ArrowRight size={16} color="#16A34A" />
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Tiers */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 24,
            border: '1px solid #E8E4DE',
            boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            padding: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
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
              <CreditCard size={19} color="#111" />
              Subscription Tiers
            </h3>

            <button
              type="button"
              onClick={() => navigate('/staff/subscriptions')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#EA580C',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Manage →
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
            }}
          >
            {[
              {
                plan: 'Free Plan',
                price: '₱0',
                maxPkg: '3 packages',
                maxBooking: '5 bookings/mo',
                color: '#6B7280',
                bg: '#F9FAFB',
                border: '#E5E7EB',
                icon: Sparkles,
              },
              {
                plan: 'Basic Plan',
                price: '₱299',
                maxPkg: 'Unlimited',
                maxBooking: '20 bookings/mo',
                color: '#2563EB',
                bg: '#DBEAFE',
                border: '#93C5FD',
                icon: Zap,
              },
              {
                plan: 'Standard Plan',
                price: '₱499',
                maxPkg: 'Unlimited',
                maxBooking: '50 bookings/mo',
                color: '#D97706',
                bg: '#FEF3C7',
                border: '#FDE68A',
                icon: Crown,
              },
              {
                plan: 'Premium Plan',
                price: '₱999',
                maxPkg: 'Unlimited',
                maxBooking: 'Unlimited',
                color: '#7C3AED',
                bg: '#F5F3FF',
                border: '#C4B5FD',
                icon: Building2,
              },
            ].map((p, idx) => {
              const TierIcon = p.icon;

              return (
                <div
                  key={idx}
                  style={{
                    background: p.bg,
                    borderRadius: 18,
                    padding: 16,
                    border: `1px solid ${p.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: p.color,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      {p.plan}
                    </span>

                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                      }}
                    >
                      <TierIcon size={14} color={p.color} />
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 19,
                        fontWeight: 900,
                        color: '#111',
                        letterSpacing: '-0.02em',
                        lineHeight: 1,
                      }}
                    >
                      {p.price}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#6B7280',
                        }}
                      >
                        /mo
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        marginTop: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: '#4B5563',
                          background: 'rgba(255,255,255,0.7)',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {p.maxPkg}
                      </span>

                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: '#4B5563',
                          background: 'rgba(255,255,255,0.7)',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {p.maxBooking}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Registrations */}
      <div style={{ width: '100%', minWidth: 0 }}>
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 24,
            border: '1px solid #E8E4DE',
            boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
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
