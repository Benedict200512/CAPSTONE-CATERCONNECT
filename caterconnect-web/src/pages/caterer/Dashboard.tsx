
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
  Clock3,
  Package,
  Star,
  AlertCircle,
  CalendarCheck,
  RefreshCw,
  Gift,
  Zap,
  Crown,
  Gem,
  TrendingUp,
  LayoutDashboard,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import CatererSkeleton from '../../components/CatererSkeleton';
import { loadMonthlyBookingQuota, type MonthlyQuota } from '../../lib/monthBookingQouta';
import { loadCatererReport } from '../../lib/catererReports';
import CatererPageHeader from '../../components/CatererPageHeader';
import {
  availabilityError,
  loadAvailability,
  manilaToday,
  shiftMonth,
} from '../../lib/availability';

type Booking = {
  id: string;
  status: string;
  event_date: string;
  event_type: string | null;
  event_time: string | null;
  guest_count: number;
  total_cost: number;
  venue: string | null;
  customer: {
    full_name: string;
    avatar_url: string | null;
    email: string | null;
    phone_number: string | null;
    address: string | null;
  } | null;
};

type AvailabilityOverview = Awaited<ReturnType<typeof loadAvailability>>;
type BookingTrendMonth = { month: string; count: number };

const PLAN_BORDER_COLORS: Record<string, string> = {
  free: '#9CA3AF',
  basic: '#2563EB',
  standard: '#F97316',
  premium: '#8B5CF6',
};

const PLAN_MONTHLY_PRICES: Record<string, number> = {
  free: 0,
  basic: 299,
  standard: 499,
  premium: 999,
};

const PLAN_ICONS = {
  free: Gift,
  basic: Zap,
  standard: Crown,
  premium: Gem,
};

function calendarMonthLabel(month: string) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1, 1)).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function CatererDashboard() {
  const { catererData, session } = useAuth();
  const navigate = useNavigate();

  const [pendingBookings, setPendingBookings] = useState(0);
  const [confirmedBookings, setConfirmedBookings] = useState(0);
  const [activePackages, setActivePackages] = useState(0);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState<MonthlyQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [today, setToday] = useState(() => manilaToday());
  const [availabilityMonth, setAvailabilityMonth] = useState(() => today.slice(0, 7));
  const [availabilityData, setAvailabilityData] = useState<AvailabilityOverview | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityErrorMessage, setAvailabilityErrorMessage] = useState('');
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);
  const [bookingTrends, setBookingTrends] = useState<BookingTrendMonth[]>([]);
  const [bookingTrendsLoading, setBookingTrendsLoading] = useState(true);
  const [bookingTrendsError, setBookingTrendsError] = useState('');
  const [bookingTrendsRefreshKey, setBookingTrendsRefreshKey] = useState(0);

  const verificationStatus =
    catererData?.verification_status || 'unsubmitted';

  const isVerified = verificationStatus === 'approved';
  const isUnsubmitted = verificationStatus === 'unsubmitted';
  const isPendingVerification = verificationStatus === 'pending';
  const isRejected = verificationStatus === 'rejected';
  const currentPlan = (catererData?.subscription_plan || 'free').toLowerCase();
  const PlanIcon = PLAN_ICONS[currentPlan as keyof typeof PLAN_ICONS] ?? Gift;
  const businessName = catererData?.business_name?.trim() ?? '';

  const bookingTrendBars = useMemo(() => {
    const counts = new Map(bookingTrends.map((item) => [item.month.slice(0, 7), item.count]));
    const endingMonth = today.slice(0, 7);
    return Array.from({ length: 5 }, (_, index) => {
      const offset = 4 - index;
      const date = new Date(`${endingMonth}-01T00:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() - offset);
      const month = date.toISOString().slice(0, 7);
      return {
        month,
        label: date.toLocaleDateString('en-PH', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
        count: counts.get(month) ?? 0,
      };
    });
  }, [bookingTrends, today]);
  const bookingTrendRange = useMemo(() => {
    const [year, month] = today.slice(0, 7).split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 5, 1));
    const end = new Date(Date.UTC(year, month, 0));
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }, [today]);
  const maxBookingTrend = Math.max(1, ...bookingTrendBars.map((item) => item.count));
  const currentDateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date()).toUpperCase();

  useEffect(() => {
    const interval = window.setInterval(() => setToday(manilaToday()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const calendarDays = useMemo(() => {
    const [year, month] = availabilityMonth.split('-').map(Number);
    const weekdayOffset = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells = [
      ...Array.from({ length: weekdayOffset }, (_, index) => `blank-start-${index}`),
      ...Array.from({ length: dayCount }, (_, index) =>
        `${availabilityMonth}-${String(index + 1).padStart(2, '0')}`
      ),
    ];

    while (cells.length % 7 !== 0) {
      cells.push(`blank-end-${cells.length}`);
    }

    return cells;
  }, [availabilityMonth]);

  useEffect(() => {
    let active = true;

    async function loadDashboardAvailability() {
      if (!isVerified || !catererData?.id || !session?.user?.id) {
        setAvailabilityData(null);
        setAvailabilityErrorMessage('');
        setAvailabilityLoading(false);
        return;
      }

      setAvailabilityLoading(true);
      setAvailabilityErrorMessage('');
      setAvailabilityData(null);

      try {
        const result = await loadAvailability(
          catererData.id,
          session.user.id,
          availabilityMonth
        );
        if (active) setAvailabilityData(result);
      } catch (failure) {
        if (active) setAvailabilityErrorMessage(availabilityError(failure));
      } finally {
        if (active) setAvailabilityLoading(false);
      }
    }

    void loadDashboardAvailability();
    return () => {
      active = false;
    };
  }, [availabilityMonth, availabilityRefreshKey, catererData?.id, isVerified, session?.user?.id]);

  useEffect(() => {
    let active = true;

    async function loadBookingTrends() {
      if (!isVerified || !catererData?.id || !session?.user?.id) {
        setBookingTrends([]);
        setBookingTrendsError('');
        setBookingTrendsLoading(false);
        return;
      }

      setBookingTrendsLoading(true);
      setBookingTrendsError('');

      try {
        const report = await loadCatererReport(bookingTrendRange);
        if (!active) return;
        setBookingTrends(report.months);
      } catch (failure) {
        if (!active) return;
        setBookingTrends([]);
        setBookingTrendsError(failure instanceof Error ? failure.message : 'Monthly booking trends could not be loaded.');
      } finally {
        if (active) setBookingTrendsLoading(false);
      }
    }

    void loadBookingTrends();
    return () => { active = false; };
  }, [bookingTrendRange, bookingTrendsRefreshKey, catererData?.id, isVerified, session?.user?.id]);

  useEffect(() => {
    if (!catererData?.id || !session?.user?.id || !isVerified) {
      setLoading(false);
      setPendingBookings(0);
      setConfirmedBookings(0);
      setActivePackages(0);
      setRecentBookings([]);
      return;
    }

    loadDashboard();
  }, [
    catererData?.id,
    isVerified,
    session?.user?.id,
  ]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    let active = true;
    const refreshUnreadCount = async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (!active) return;
      if (error) {
        console.error('Could not load caterer notification count:', error);
        return;
      }
      setUnreadCount(count ?? 0);
    };

    void refreshUnreadCount();
    const channel = supabase
      .channel(`caterer-dashboard-notifications-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => void refreshUnreadCount())
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Caterer notification subscription status:', status);
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let active = true;

    async function loadQuota() {
      if (!isVerified || !catererData?.id || !session?.user?.id) {
        setQuota(null);
        setQuotaLoading(false);
        return;
      }

      setQuotaLoading(true);
      const result = await loadMonthlyBookingQuota(catererData.id, session.user.id);
      if (active) {
        setQuota(result);
        setQuotaLoading(false);
      }
    }

    void loadQuota();
    return () => {
      active = false;
    };
  }, [catererData?.id, isVerified, session?.user?.id]);

  async function refreshQuota() {
    if (!isVerified || !catererData?.id || !session?.user?.id) return;
    setQuotaLoading(true);
    const result = await loadMonthlyBookingQuota(catererData.id, session.user.id);
    setQuota(result);
    setQuotaLoading(false);
  }

  async function loadDashboard() {
    if (!catererData?.id || !session?.user?.id) {
      return;
    }

    setLoading(true);

    try {
      const [
        pendingResult,
        confirmedResult,
        packagesResult,
        recentResult,
      ] = await Promise.all([
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('caterer_id', catererData.id)
          .eq('status', 'pending'),

        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('caterer_id', catererData.id)
          .eq('status', 'confirmed'),

        supabase
          .from('packages')
          .select('id', { count: 'exact', head: true })
          .eq('caterer_id', catererData.id)
          .eq('publication_status', 'published'),

        supabase
          .from('bookings')
          .select(`
            id,
            status,
            event_date,
            event_type,
            event_time,
            guest_count,
            total_cost,
            venue,
            customer:profiles!bookings_customer_id_fkey (
              full_name,
              avatar_url,
              email,
              phone_number,
              address
            )
          `)
          .eq('caterer_id', catererData.id)
          .order('created_at', { ascending: false })
          .limit(5),

      ]);

      if (pendingResult.error) throw pendingResult.error;
      if (confirmedResult.error) throw confirmedResult.error;
      if (packagesResult.error) throw packagesResult.error;
      if (recentResult.error) throw recentResult.error;

      setPendingBookings(pendingResult.count ?? 0);
      setConfirmedBookings(confirmedResult.count ?? 0);
      setActivePackages(packagesResult.count ?? 0);

      setRecentBookings(
        (recentResult.data ?? []) as unknown as Booking[]
      );

    } catch (error) {
      console.error('Dashboard loading error:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 2,
    }).format(amount || 0);
  }

  function statusClass(status: string) {
    return `booking-status status-${status
      .toLowerCase()
      .replace(/_/g, '-')}`;
  }

  if (loading) {
    return <CatererSkeleton variant="dashboard" calendarCellCount={calendarDays.length} label="Loading dashboard" />;
  }

  if (!catererData) {
    return (
      <div className="caterer-verification-card">
        <div className="verification-icon">
          <AlertCircle size={28} />
        </div>

        <h2>Business Profile Not Found</h2>

        <p>
          We couldn't find a business profile connected to this account.
          Please contact Platform Staff for assistance.
        </p>
      </div>
    );
  }

  return (
    <div className="caterer-dashboard">

      {/* PAGE HEADER */}
      <CatererPageHeader
        className="dashboard-page-heading"
        showBack={false}
        icon={<LayoutDashboard size={25} />}
        aboveTitle={<p className="dashboard-current-date">{currentDateLabel}</p>}
        title={(
          <>
            <span>Welcome Back!{businessName ? ',' : ''}</span>
            {businessName && <span className="dashboard-business-name">{businessName}</span>}
          </>
        )}
        description="Here's what's happening with your catering business."
        action={(
          <div className="dashboard-header-actions">
          <button
            type="button"
            className="dashboard-availability-button"
            onClick={() => navigate('/caterer/availability')}
            disabled={!isVerified}
            aria-disabled={!isVerified}
            title={isVerified ? 'Manage Availability' : 'Available after your business is approved'}
          >
            <CalendarDays size={17} />
            <span>Availability</span>
          </button>

          <button
            className="caterer-notification-button"
            onClick={() => navigate('/caterer/notifications')}
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell size={21} />

            {isVerified && unreadCount > 0 && (
              <span className="notification-count">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          </div>
        )}
      />

      {!isVerified && (
        <section
          className={`verification-notice verification-${verificationStatus}`}
          role="status"
          aria-live="polite"
        >
          <div className="verification-notice-icon">
            {isPendingVerification ? <Clock3 size={25} /> : isRejected ? <AlertCircle size={25} /> : <ClipboardList size={25} />}
          </div>
          <div className="verification-notice-content">
            <span className="dashboard-verification-badge">
              {isPendingVerification ? 'UNDER REVIEW' : isRejected ? 'APPLICATION REJECTED' : 'ACTION REQUIRED'}
            </span>
            <h3>
              {isUnsubmitted
                ? 'Complete Your Business Profile'
                : isPendingVerification
                  ? 'Your Application Is Under Review'
                  : isRejected
                    ? 'Verification Rejected'
                    : 'Verification Status Unavailable'}
            </h3>
            <p>
              {isUnsubmitted
                ? 'Please complete your business details and submit your required verification documents to begin the verification process.'
                : isPendingVerification
                  ? 'Thank you for submitting your business application! Your business details and verification documents have been submitted. Platform Staff will review your application and provide the verification result.'
                  : isRejected
                    ? 'Your verification application was rejected. Review the feedback below, correct the necessary information, and resubmit your application.'
                    : 'We could not confirm your verification status. Please contact Platform Staff for assistance.'}
            </p>

            {isPendingVerification && (
              <div className="dashboard-verification-progress" aria-label="Verification progress">
                <div className="dashboard-verification-step">
                  <CheckCircle2 size={18} />
                  <span><strong>Business Details Submitted</strong><small>Your business information has been received.</small></span>
                  <CheckCircle2 className="step-complete" size={18} />
                </div>
                <div className="dashboard-verification-step">
                  <CheckCircle2 size={18} />
                  <span><strong>Documents Submitted</strong><small>Your verification documents are on file.</small></span>
                  <CheckCircle2 className="step-complete" size={18} />
                </div>
                <div className="dashboard-verification-step pending">
                  <Clock3 size={18} />
                  <span><strong>Staff Review</strong><small>Waiting for Platform Staff to review your application.</small></span>
                  <em>Waiting</em>
                </div>
              </div>
            )}

            {isRejected && catererData?.rejection_reason && (
              <div className="verification-rejection-reason">
                <strong>Reason for Rejection</strong>
                <p>{catererData.rejection_reason}</p>
              </div>
            )}

            {isPendingVerification ? (
              <p className="dashboard-verification-waiting">
                No further action is needed right now. Please wait while Platform Staff reviews your application.
              </p>
            ) : (isUnsubmitted || isRejected) ? (
              <button
                type="button"
                className="verification-action-button"
                onClick={() => navigate('/caterer/profile')}
              >
                {isUnsubmitted ? 'Complete Business Profile' : 'Edit & Resubmit'}
                <ChevronRight size={17} />
              </button>
            ) : null}
          </div>
        </section>
      )}

      {isVerified && <>
      {/* BOOKING STATISTICS */}
      <section className="caterer-stats-grid" aria-label="Business statistics">
        <div className="caterer-stat-card"><span className="stat-icon yellow"><Clock3 size={21} /></span><p>Pending Bookings</p><h2>{pendingBookings}</h2><span className="stat-caption">Awaiting your response</span></div>
        <div className="caterer-stat-card"><span className="stat-icon green"><CheckCircle2 size={21} /></span><p>Confirmed Bookings</p><h2>{confirmedBookings}</h2><span className="stat-caption">Bookings on your calendar</span></div>
        <div className="caterer-stat-card"><span className="stat-icon orange"><Package size={21} /></span><p>Active Packages</p><h2>{activePackages}</h2><span className="stat-caption">Published packages</span></div>
        <div className="caterer-stat-card"><span className="stat-icon purple"><Star size={21} /></span><p>Customer Rating</p><h2>{catererData.avg_rating == null ? 'N/A' : Number(catererData.avg_rating).toFixed(1)}</h2><span className="stat-caption">{catererData.review_count ?? 0} reviews</span></div>
      </section>

      <div className="dashboard-main-grid">
        <div className="dashboard-left-stack">
          {/* SUBSCRIPTION AND MONTHLY BOOKING USAGE */}
          <section
            className="caterer-dashboard-subscription dashboard-combined-subscription"
            aria-label="Subscription and monthly booking usage"
            style={{
              border: `2px solid ${PLAN_BORDER_COLORS[(catererData.subscription_plan || 'free').toLowerCase()] ?? PLAN_BORDER_COLORS.free}`,
            }}
          >
          <div className="dashboard-subscription-plan">
            <span className="dashboard-subscription-eyebrow">YOUR SUBSCRIPTION</span>
            <div className="dashboard-plan-title">
              <span className="dashboard-plan-icon" style={{ color: PLAN_BORDER_COLORS[currentPlan] ?? PLAN_BORDER_COLORS.free, borderColor: PLAN_BORDER_COLORS[currentPlan] ?? PLAN_BORDER_COLORS.free }} aria-hidden="true">
                <PlanIcon size={19} />
              </span>
              <h2>{(catererData.subscription_plan || 'free').replace(/^./, (letter) => letter.toUpperCase())} Plan</h2>
            </div>
            <span className="dashboard-subscription-price">PHP {(PLAN_MONTHLY_PRICES[(catererData.subscription_plan || 'free').toLowerCase()] ?? 0).toLocaleString('en-PH')} / month</span>
          </div>
          <div className="dashboard-subscription-usage">
            <div className="dashboard-subscription-usage-heading">
              <div>
                <span className="dashboard-subscription-eyebrow">MONTHLY ACCEPTED BOOKINGS</span>
                <strong>Booking usage</strong>
              </div>
              <button
                type="button"
                className="dashboard-quota-refresh"
                onClick={() => void refreshQuota()}
                disabled={quotaLoading}
                aria-label="Refresh monthly booking usage"
                title="Refresh monthly booking usage"
              >
                <RefreshCw size={16} className={quotaLoading ? 'dashboard-quota-spinning' : ''} />
              </button>
            </div>

            {quotaLoading && !quota ? (
              <CatererSkeleton variant="subscription" label="Loading monthly booking usage" />
            ) : quota?.status === 'ready' ? (
              <>
                <div className="dashboard-quota-numbers">
                  <strong>{quota.used} / {quota.limit ?? 'Unlimited'} used</strong>
                  <span>{quota.remaining === null ? 'Unlimited remaining' : `${quota.remaining} remaining`}</span>
                </div>
                {quota.limit !== null && (
                  <div className="dashboard-quota-track" role="progressbar" aria-valuenow={Math.min(100, quota.limit > 0 ? (quota.used / quota.limit) * 100 : 0)} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly accepted booking usage">
                    <div style={{ width: `${quota.limit > 0 ? Math.min(100, (quota.used / quota.limit) * 100) : 0}%` }} />
                  </div>
                )}
                <small>{quota.month.slice(0, 7)} -- Asia/Manila</small>
              </>
            ) : (
              <p className="dashboard-quota-message">
                {quota?.status === 'setup' || quota?.status === 'unavailable'
                  ? quota.message
                  : 'Monthly usage is unavailable. Refresh to try again.'}
              </p>
            )}
          </div>
          </section>

        <section className="caterer-panel dashboard-trends-panel" aria-label="Monthly booking trends">
          <div className="caterer-panel-header">
            <div>
              <span className="dashboard-section-eyebrow">BOOKING PERFORMANCE</span>
              <h2>Monthly Booking Trends</h2>
              <p>Bookings by creation month across all statuses; this is activity, not a success count.</p>
            </div>
            <span className="dashboard-trends-icon" aria-hidden="true"><TrendingUp size={19} /></span>
          </div>

          {bookingTrendsLoading ? (
            <CatererSkeleton variant="trend-chart" label="Loading monthly booking trends" />
          ) : bookingTrendsError ? (
            <div className="dashboard-trends-feedback error" role="alert">
              <span>{bookingTrendsError}</span>
              <button type="button" onClick={() => setBookingTrendsRefreshKey((key) => key + 1)}>Try again</button>
            </div>
          ) : (
            <>
              <div className="dashboard-trends-chart" role="img" aria-label={`Monthly booking trend for five months ending ${calendarMonthLabel(today.slice(0, 7))}`}>
                {bookingTrendBars.map((item) => (
                  <div className="dashboard-trend-column" key={item.month}>
                    <strong>{item.count}</strong>
                    <div className="dashboard-trend-track">
                      <span style={{ height: `${item.count ? Math.max(7, (item.count / maxBookingTrend) * 100) : 0}%` }} />
                    </div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="dashboard-trends-legend"><i /> Bookings</div>
              {bookingTrendBars.every((item) => item.count === 0) && (
                <p className="dashboard-trends-empty">No bookings were placed this month.</p>
              )}
              <button
                type="button"
                className="dashboard-view-report-button"
                onClick={() => navigate('/caterer/reports')}
              >
                View Report &amp; Analytics <ChevronRight size={16} />
              </button>
            </>
          )}
        </section>
        </div>

      {/* MONTHLY AVAILABILITY OVERVIEW */}
      <section className="dashboard-availability-card" aria-label="Monthly availability calendar">
        <div className="dashboard-availability-heading">
          <div>
            <span className="dashboard-section-eyebrow">CALENDAR OVERVIEW</span>
            <h2>Monthly Availability</h2>
            <p>Committed bookings and dates blocked from new requests.</p>
          </div>
          <button
            type="button"
            className="dashboard-check-availability-button"
            onClick={() => navigate('/caterer/availability')}
            disabled={!isVerified}
            aria-disabled={!isVerified}
          >
            <CalendarCheck size={17} />
            Check Availability
          </button>
        </div>

        <div className="dashboard-calendar-month-controls">
          <button
            type="button"
            onClick={() => setAvailabilityMonth((month) => shiftMonth(month, -1))}
            aria-label="Previous month"
            title="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <h3>{calendarMonthLabel(availabilityMonth)}</h3>
          <button
            type="button"
            onClick={() => setAvailabilityMonth((month) => shiftMonth(month, 1))}
            aria-label="Next month"
            title="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {availabilityLoading ? (
          <CatererSkeleton variant="dashboard-calendar" calendarCellCount={calendarDays.length} label="Loading monthly availability" />
        ) : availabilityErrorMessage ? (
          <div className="dashboard-calendar-feedback error" role="alert">
            <span>{availabilityErrorMessage}</span>
            <button
              type="button"
              onClick={() => setAvailabilityRefreshKey((key) => key + 1)}
            >
              Try again
            </button>
          </div>
        ) : availabilityData ? (
          <>
            <div className="dashboard-calendar-weekdays" aria-hidden="true">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="dashboard-calendar-grid">
              {calendarDays.map((value) => {
                if (value.startsWith('blank-')) {
                  return <span className="dashboard-calendar-blank" key={value} />;
                }

                const date = value;
                const count = availabilityData.counts[date] ?? 0;
                const blocked = availabilityData.blocked.includes(date);
                const full = !blocked && count >= availabilityData.capacity;
                const past = date < today;
                const state = blocked ? 'Blocked' : full ? 'Fully booked' : 'Open';

                return (
                  <div
                    className={`dashboard-calendar-day${blocked ? ' blocked' : ''}${full ? ' full' : ''}${past ? ' past' : ''}`}
                    key={date}
                    aria-label={`${date}, ${count} committed bookings, ${state}${past ? ', past date' : ''}`}
                    title={`${count} committed bookings -- ${state}`}
                  >
                    <span className="dashboard-calendar-day-number">{Number(date.slice(-2))}</span>
                    <small>{count} booked</small>
                    {(blocked || full) && <em>{state}</em>}
                  </div>
                );
              })}
            </div>

            <div className="dashboard-calendar-footer">
              <div className="dashboard-calendar-legend" aria-label="Calendar legend">
                <span><i className="open" /> Open</span>
                <span><i className="full" /> Fully booked</span>
                <span><i className="blocked" /> Blocked</span>
              </div>
              <p>Daily limit: {availabilityData.capacity} bookings. Pending requests are not included.</p>
            </div>

            {Object.values(availabilityData.counts).every((count) => count === 0) &&
              availabilityData.blocked.length === 0 && (
                <p className="dashboard-calendar-empty">
                  No committed bookings or blocked dates this month.
                </p>
              )}
          </>
        ) : null}
      </section>

      {/* RECENT BOOKINGS */}
      <section className="caterer-panel recent-bookings-panel dashboard-recent-bookings">
          <div className="caterer-panel-header">
            <div>
              <h2>Recent Bookings</h2>
              <p>Your latest customer booking requests</p>
            </div>
            <button
              type="button"
              className="caterer-text-button"
              onClick={() => navigate('/caterer/bookings')}
            >
              View all <ChevronRight size={15} />
            </button>
          </div>

          {recentBookings.length === 0 ? (
            <div className="caterer-empty-state">
              <ClipboardList size={34} />
              <h3>No bookings yet</h3>
              <p>Your new booking requests will appear here.</p>
            </div>
          ) : (
            <div className="recent-booking-list">
              <div className="recent-booking-grid-header">
                <span>Customer</span>
                <span>Event Details</span>
                <span>Venue</span>
                <span>Contact</span>
                <span>Booking Amount</span>
              </div>
              {recentBookings.map((booking) => (
                <div className="recent-booking-item" key={booking.id}>
                  <div className="recent-booking-column recent-booking-customer">
                    <span className="recent-booking-column-label">Customer</span>
                    <div className="recent-booking-customer-details">
                      <div className="customer-avatar">
                        {booking.customer?.avatar_url ? (
                          <img src={booking.customer.avatar_url} alt={booking.customer.full_name} />
                        ) : (
                          (booking.customer?.full_name || 'C').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="booking-customer-info">
                        <strong>{booking.customer?.full_name || 'Not provided'}</strong>
                        <span>{booking.event_type || 'Not provided'}</span>
                        <span>{booking.guest_count} guests</span>
                      </div>
                    </div>
                  </div>

                  <div className="recent-booking-column">
                    <span className="recent-booking-column-label">Event Details</span>
                    <span>{formatDate(booking.event_date)}</span>
                    <span>{booking.event_time || 'Not provided'}</span>
                    <span className={statusClass(booking.status)}>
                      {booking.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="recent-booking-column">
                    <span className="recent-booking-column-label">Venue</span>
                    <span>{booking.venue || 'Not provided'}</span>
                  </div>

                  <div className="recent-booking-column">
                    <span className="recent-booking-column-label">Contact</span>
                    <span>{booking.customer?.email || 'Email not provided'}</span>
                    <span>{booking.customer?.phone_number || 'Phone not provided'}</span>
                    <span>{booking.customer?.address || 'Address not provided'}</span>
                  </div>

                  <div className="recent-booking-column recent-booking-amount">
                    <span className="recent-booking-column-label">Booking Amount</span>
                    <strong>{formatCurrency(Number(booking.total_cost))}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
      </section>

      </div>
      </>}
    </div>
  );
}
