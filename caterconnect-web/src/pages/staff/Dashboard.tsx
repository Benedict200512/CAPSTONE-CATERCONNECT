import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar, ShieldCheck, Loader2, ArrowRight, Banknote, Bell, CheckCheck, RefreshCw, Store, UserRound, X, Activity, FileClock, BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import './StaffDashboard.css';

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


type ActivityRecord = { id: string; title: string; details: string; at: string; kind: 'booking' | 'caterer' | 'complaint' };
type QueueItem = { id: string; business_name: string; created_at: string };
type DailyPoint = { date: string; label: string; bookings: number; applications: number; complaints: number };
const PH_TIMEZONE = 'Asia/Manila';
const fmt = (n: number) => n.toLocaleString('en-PH');
const relativeTime = (timestamp: string) => new Date(timestamp).toLocaleString('en-PH', { timeZone: PH_TIMEZONE, dateStyle: 'medium', timeStyle: 'short' });
// Day boundaries in Philippine local time. Supabase stores timestamptz in UTC.
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
function lastSevenDays(): { start: string; end: string; label: string; date: string }[] {
  const now = new Date();
  const currentPhDate = new Date(now.getTime() + PH_OFFSET_MS).toISOString().slice(0, 10);
  const today = Date.parse(currentPhDate + 'T00:00:00Z');
  return Array.from({ length: 7 }, (_, index) => {
    const localDay = today + (index - 6) * 86400000;
    const date = new Date(localDay).toISOString().slice(0, 10);
    return {
      date,
      label: new Date(localDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      start: new Date(localDay - PH_OFFSET_MS).toISOString(),
      end: new Date(localDay + 86400000 - PH_OFFSET_MS).toISOString(),
    };
  });
}
function OperationChart({ points, loading }: { points: DailyPoint[]; loading: boolean }) {
  const w = 610, h = 248, padL = 43, padR = 14, padT = 14, padB = 32;
  const rows = [
    { key: 'bookings' as const, label: 'Bookings', color: '#F97316' },
    { key: 'applications' as const, label: 'Applications', color: '#FB923C' },
    { key: 'complaints' as const, label: 'Complaints', color: '#FDBA74' },
  ];
  const maximum = Math.max(1, ...points.flatMap(p => rows.map(r => p[r.key])));
  const yMax = maximum <= 4 ? 4 : Math.ceil(maximum / 4) * 4;
  const x = (i: number) => padL + i * (w - padL - padR) / 6;
  const y = (v: number) => padT + (h - padT - padB) * (1 - v / yMax);
  const poly = (key: typeof rows[number]['key']) => points.map((p, i) => `${x(i)},${y(p[key])}`).join(' ');
  if (loading) return <div className="cc-staff-chart-empty"><Loader2 size={21} className="animate-spin" /> Loading actual operation trends...</div>;
  if (!points.length) return <div className="cc-staff-chart-empty">Operation trend is unavailable.</div>;
  return <div className="cc-staff-chart-wrap">
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Daily newly recorded bookings, caterer applications and complaints during the last seven days" className="cc-staff-chart">
      {Array.from({ length: 5 }, (_, i) => <g key={i}><line x1={padL} x2={w-padR} y1={y(yMax*i/4)} y2={y(yMax*i/4)} stroke="#EDE8E2" /><text x={padL-9} y={y(yMax*i/4)+4} textAnchor="end" fill="#94A3B8" fontSize="11">{fmt(yMax*i/4)}</text></g>)}
      {points.map((p,i) => <text key={p.date} x={x(i)} y={h-6} textAnchor="middle" fill="#94A3B8" fontSize="11">{p.label}</text>)}
      <defs><linearGradient id="ccStaffChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#F97316" stopOpacity=".19"/><stop offset="1" stopColor="#F97316" stopOpacity="0"/></linearGradient></defs>
      <polygon points={`${x(0)},${y(0)} ${poly('bookings')} ${x(6)},${y(0)}`} fill="url(#ccStaffChartFill)"/>
      {rows.map(r => <g key={r.key}><polyline points={poly(r.key)} fill="none" stroke={r.color} strokeWidth={r.key==='bookings'?3:2.3} strokeLinejoin="round" strokeLinecap="round"/>{points.map((p,i)=><circle key={p.date} cx={x(i)} cy={y(p[r.key])} r="3.5" stroke="white" strokeWidth="1.5" fill={r.color}><title>{p.label}: {p[r.key]} {r.label.toLowerCase()}</title></circle>)}</g>)}
    </svg>
    <div className="cc-staff-chart-legend">{rows.map(r=><span key={r.key}><i style={{background:r.color}}/>{r.label}</span>)}</div>
  </div>;
}

export default function StaffDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pending: 0, complaints: 0, bookings: 0, approved: 0, rejected: 0, refunds: 0, pendingBookings: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityRecord[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [complaintCounts, setComplaintCounts] = useState({ open: 0, in_review: 0, resolved: 0 });
  const [disputeCounts, setDisputeCounts] = useState({ open: 0, investigating: 0, resolved: 0 });
  const [dailyCounts, setDailyCounts] = useState<DailyPoint[]>([]);
  const [dashboardError, setDashboardError] = useState('');
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


  // Independent read-only dashboard analytics. Staff module actions and notifications are unchanged.
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setDashboardError('');
    try {
      const days = lastSevenDays();
      const [pendingRes, complaintRes, bookingRes, approvedRes, rejectedRes, refundRes, pendingBookingsRes,
        pendingQueueRes, complaintReviewRes, complaintResolvedRes, disputeOpenRes, disputeInvestigatingRes, disputeResolvedRes,
        recentBookingsRes, recentCaterersRes, recentComplaintsRes, ...daily] = await Promise.all([
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status','pending'),
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status','open'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }),
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status','approved'),
        supabase.from('caterers').select('id', { count: 'exact', head: true }).eq('verification_status','rejected'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('refund_status','pending'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status','pending'),
        supabase.from('caterers').select('id, business_name, created_at').eq('verification_status','pending').order('created_at',{ascending:false}).limit(3),
        supabase.from('complaints').select('id',{count:'exact',head:true}).eq('status','in_review'),
        supabase.from('complaints').select('id',{count:'exact',head:true}).eq('status','resolved'),
        supabase.from('refund_disputes').select('id',{count:'exact',head:true}).eq('status','open'),
        supabase.from('refund_disputes').select('id',{count:'exact',head:true}).eq('status','investigating'),
        supabase.from('refund_disputes').select('id',{count:'exact',head:true}).eq('status','resolved'),
        supabase.from('bookings').select('id, status, created_at').order('created_at',{ascending:false}).limit(5),
        supabase.from('caterers').select('id, business_name, created_at').order('created_at',{ascending:false}).limit(5),
        supabase.from('complaints').select('id, subject, created_at').order('created_at',{ascending:false}).limit(5),
        ...days.flatMap(day => [
          supabase.from('bookings').select('id',{count:'exact',head:true}).gte('created_at',day.start).lt('created_at',day.end),
          supabase.from('caterers').select('id',{count:'exact',head:true}).gte('created_at',day.start).lt('created_at',day.end),
          supabase.from('complaints').select('id',{count:'exact',head:true}).gte('created_at',day.start).lt('created_at',day.end),
        ]),
      ]);
      const sources = [pendingRes,complaintRes,bookingRes,approvedRes,rejectedRes,refundRes,pendingBookingsRes,
        pendingQueueRes,complaintReviewRes,complaintResolvedRes,disputeOpenRes,disputeInvestigatingRes,disputeResolvedRes,
        recentBookingsRes,recentCaterersRes,recentComplaintsRes,...daily];
      const failure = sources.find(response => response.error);
      if (failure?.error) throw failure.error;
      setStats({ pending: pendingRes.count??0, complaints: complaintRes.count??0, bookings: bookingRes.count??0,
        approved: approvedRes.count??0, rejected: rejectedRes.count??0, refunds: refundRes.count??0,
        pendingBookings: pendingBookingsRes.count??0 });
      setComplaintCounts({open:complaintRes.count??0,in_review:complaintReviewRes.count??0,resolved:complaintResolvedRes.count??0});
      setDisputeCounts({open:disputeOpenRes.count??0, investigating:disputeInvestigatingRes.count??0, resolved:disputeResolvedRes.count??0});
      setQueue((pendingQueueRes.data??[]) as QueueItem[]);
      setDailyCounts(days.map((day,i) => ({ date:day.date,label:day.label,bookings:daily[i*3].count??0,applications:daily[i*3+1].count??0,complaints:daily[i*3+2].count??0 })));
      const recent: ActivityRecord[] = [
        ...(recentBookingsRes.data??[]).map(item=>({id:'b-'+item.id,title:'New booking recorded',details:`Current status: ${item.status ?? 'unknown'}`,at:item.created_at,kind:'booking' as const})),
        ...(recentCaterersRes.data??[]).map(item=>({id:'c-'+item.id,title:'Caterer registered',details:item.business_name??'Unnamed catering business',at:item.created_at,kind:'caterer' as const})),
        ...(recentComplaintsRes.data??[]).map(item=>({id:'t-'+item.id,title:'Support ticket created',details:item.subject??'New support ticket',at:item.created_at,kind:'complaint' as const})),
      ].filter(item=>Boolean(item.at)).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,5);
      setRecentActivity(recent);
    } catch (cause) {
      console.error('Staff dashboard loading failed:',cause);
      setDashboardError(cause instanceof Error ? cause.message : 'Unable to load staff statistics.');
    } finally { setLoading(false); }
  },[]);
  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  const headline = [
    {label:'Pending Verifications',value:stats.pending,icon:ShieldCheck,path:'/staff/verification'},
    {label:'Open Complaints',value:stats.complaints,icon:AlertTriangle,path:'/staff/complaints'},
    {label:'Pending Refunds',value:stats.refunds,icon:Banknote,path:'/staff/refunds'},
    {label:'Total Bookings',value:stats.bookings,icon:Calendar,path:'/staff/bookings'},
  ];
  const daysTotal = dailyCounts.reduce((sum,d)=>sum+d.bookings+d.applications+d.complaints,0);
  const countOperations = (key: 'bookings'|'applications'|'complaints') => dailyCounts.reduce((sum,day)=>sum+day[key],0);
  const queueSummary = [
    {label:'Account Verifications', value:stats.pending, path:'/staff/verification', icon:ShieldCheck},
    {label:'Open Complaints', value:stats.complaints, path:'/staff/complaints', icon:AlertTriangle},
    {label:'Refund Requests', value:stats.refunds, path:'/staff/refunds', icon:Banknote},
  ];
  return (
    <div className="cc-staff-modern">
      <header className="cc-staff-header">
        <div><span className="cc-staff-eyebrow">CATERCONNECT / STAFF DASHBOARD</span><h1>Welcome back, {profile?.full_name?.split(' ')[0] ?? 'Staff'}! <span aria-hidden="true">👋</span></h1><p>Your operations workspace for verifications, complaints, refunds and platform support.</p></div>
        <div className="cc-staff-header-actions">
          <span className="cc-staff-date"><Calendar size={16} color="#EA580C"/>{new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:PH_TIMEZONE})}</span>
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
      </header>
      {dashboardError && <div role="alert" className="cc-staff-error">Could not load dashboard data: {dashboardError} <button type="button" onClick={()=>void loadDashboard()}>Try again</button></div>}
      <div className="cc-staff-kpis">{headline.map((item,i)=>{const Icon=item.icon;return <button className={`cc-staff-kpi ${i===0?'emphasized':''}`} key={item.label} type="button" onClick={()=>navigate(item.path)}><div className="cc-staff-kpi-top"><span className="cc-staff-icon"><Icon size={20}/></span><ArrowRight size={17} color="#CBD5E1"/></div><strong>{loading?'—':fmt(item.value)}</strong><span>{item.label}</span><small>{i===0?'Caterer applications awaiting review':i===1?'Support tickets with open status':i===2?'Bookings awaiting refund processing':'All recorded marketplace bookings'}</small></button>})}</div>
      <div className="cc-staff-main-grid">
        <section className="cc-staff-panel"><div className="cc-staff-panel-head"><div><h2><BarChart3 size={20}/> Operation Overview</h2><p>New bookings, caterer registrations and complaints · Last 7 days (Philippine time)</p></div><span className="cc-staff-period">Last 7 days</span></div><div className="cc-staff-operation-layout"><OperationChart points={dailyCounts} loading={loading}/><div className="cc-staff-chart-summary"><span>7-Day New Records</span><strong>{loading?'—':fmt(daysTotal)}</strong><div className="cc-staff-mini-line"><i style={{background:'#F97316'}}/>Bookings <b>{loading?'—':fmt(countOperations('bookings'))}</b></div><div className="cc-staff-mini-line"><i style={{background:'#FB923C'}}/>Applications <b>{loading?'—':fmt(countOperations('applications'))}</b></div><div className="cc-staff-mini-line"><i style={{background:'#FDBA74'}}/>Complaints <b>{loading?'—':fmt(countOperations('complaints'))}</b></div></div></div></section>
        <section className="cc-staff-panel"><div className="cc-staff-panel-head"><div><h2><FileClock size={20}/> Queue Status</h2><p>Cases currently needing staff attention.</p></div></div><div className="cc-staff-queue-status">{queueSummary.map(item=>{const Icon=item.icon;return <button type="button" key={item.label} onClick={()=>navigate(item.path)}><span className="cc-staff-icon"><Icon size={18}/></span><span>{item.label}</span><strong>{loading?'—':fmt(item.value)}</strong><ArrowRight size={16}/></button>})}</div><div className="cc-staff-queue-footer">{loading?'Loading queue…':`${fmt(stats.pendingBookings)} booking(s) with pending status`}</div></section>
      </div>
      <section className="cc-staff-panel cc-staff-workspace"><div className="cc-staff-panel-head"><div><h2><Activity size={20}/> Operations Workspace</h2><p>Review current queues and recent records without duplicated shortcut cards.</p></div><button className="cc-staff-refresh" type="button" onClick={()=>void loadDashboard()} disabled={loading}><RefreshCw size={15}/> Refresh data</button></div>
        <div className="cc-staff-work-grid">
          <div className="cc-staff-work-card"><div className="cc-staff-work-heading"><h3><ShieldCheck size={18}/> Verification Queue</h3><button type="button" onClick={()=>navigate('/staff/verification')}>View All <ArrowRight size={15}/></button></div>{loading?<p className="cc-staff-empty">Loading applications…</p>:queue.length===0?<p className="cc-staff-empty">No pending caterer applications.</p>:<div className="cc-staff-record-list">{queue.map(item=><div key={item.id}><span><b>{item.business_name||'Unnamed caterer'}</b><small>Submitted {relativeTime(item.created_at)}</small></span><span className="cc-staff-pill">Pending</span></div>)}</div>}<button type="button" className="cc-staff-work-footer" onClick={()=>navigate('/staff/verification')}>Process Verifications <ArrowRight size={16}/></button></div>
          <div className="cc-staff-work-card"><div className="cc-staff-work-heading"><h3><AlertTriangle size={18}/> Complaint Status</h3><button type="button" onClick={()=>navigate('/staff/complaints')}>View All <ArrowRight size={15}/></button></div><div className="cc-staff-breakdown">{[{label:'Open',value:complaintCounts.open},{label:'In Review',value:complaintCounts.in_review},{label:'Resolved',value:complaintCounts.resolved}].map(row=><div key={row.label}><span>{row.label}</span><b>{loading?'—':fmt(row.value)}</b></div>)}</div></div>
          <div className="cc-staff-work-card"><div className="cc-staff-work-heading"><h3><Banknote size={18}/> Refund Disputes</h3><button type="button" onClick={()=>navigate('/staff/refunds')}>View All <ArrowRight size={15}/></button></div><div className="cc-staff-breakdown">{[{label:'Open',value:disputeCounts.open},{label:'Investigating',value:disputeCounts.investigating},{label:'Resolved',value:disputeCounts.resolved}].map(row=><div key={row.label}><span>{row.label}</span><b>{loading?'—':fmt(row.value)}</b></div>)}</div></div>
          <div className="cc-staff-work-card"><div className="cc-staff-work-heading"><h3><Activity size={18}/> Recent Activity</h3><span className="cc-staff-muted">Recent recorded events</span></div>{loading?<p className="cc-staff-empty">Loading activity…</p>:recentActivity.length===0?<p className="cc-staff-empty">No recent records found.</p>:<div className="cc-staff-activity-list">{recentActivity.slice(0,4).map(item=><div key={item.id}><span className="cc-staff-activity-dot"/><span><b>{item.title}</b><small>{item.details}</small></span><time>{relativeTime(item.at)}</time></div>)}</div>}</div>
        </div>
      </section>
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
