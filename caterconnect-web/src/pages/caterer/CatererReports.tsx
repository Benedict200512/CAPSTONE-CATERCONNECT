import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Ban,
  CalendarDays,
  CheckCircle2,
  CircleX,
  ClipboardList,
  Clock3,
  Package,
  PhilippinePeso,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import CatererPageHeader from '../../components/CatererPageHeader';
import CatererSkeleton from '../../components/CatererSkeleton';
import {
  formatReportMoney,
  loadCatererReport,
  loadRecordedDownpayments,
  reportError,
  reportRange,
  validateReportRange,
  type CatererReport,
  type ReportPreset,
  type ReportRange,
} from '../../lib/catererReports';
import './CatererReports.css';

const PRESETS: ReportPreset[] = ['This Month', 'Last Month', 'This Year', 'Custom Date Range'];

const EXPECTED_VALUE_DEFINITION = 'Combined value of confirmed, awaiting-payment, paid, ongoing and completed bookings created during the selected period. This is accepted booking value, not payments received.';
const DOWNPAYMENT_DEFINITION = 'Sum of configured downpayments recorded as verified during the selected period for bookings marked paid, ongoing or completed. Remaining balances are excluded.';

type ReportState = {
  report: CatererReport | null;
  recordedDownpayments: string | null;
  loading: boolean;
  error: string;
};

function monthLabel(month: string) {
  return new Date(`${month}T00:00:00Z`).toLocaleDateString('en-PH', {
    month: 'short',
    timeZone: 'UTC',
  });
}

function yearMonthLabel(month: string) {
  return new Date(`${month}T00:00:00Z`).toLocaleDateString('en-PH', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatCount(value: number) {
  return value.toLocaleString('en-PH');
}

function formatDateRange(range: ReportRange) {
  return `${range.start} – ${range.end}`;
}

export default function CatererReports() {
  const { session, profile, catererData } = useAuth();
  const [preset, setPreset] = useState<ReportPreset>('This Month');
  const [range, setRange] = useState<ReportRange>(() => reportRange('This Month'));
  const [draft, setDraft] = useState<ReportRange>(range);
  const [dateError, setDateError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<ReportState>({
    report: null,
    recordedDownpayments: null,
    loading: true,
    error: '',
  });

  useEffect(() => {
    let active = true;
    async function load() {
      setState({ report: null, recordedDownpayments: null, loading: true, error: '' });
      try {
        if (!session?.user.id || profile?.role !== 'caterer' || !catererData?.id) {
          throw new Error('Sign in with your caterer account to view reports.');
        }
        const [report, recordedDownpayments] = await Promise.all([
          loadCatererReport(range),
          loadRecordedDownpayments(catererData.id, range),
        ]);
        if (active) setState({ report, recordedDownpayments, loading: false, error: '' });
      } catch (error) {
        if (active) setState({ report: null, recordedDownpayments: null, loading: false, error: reportError(error) });
      }
    }
    void load();
    return () => { active = false; };
  }, [catererData?.id, profile?.role, range, refreshKey, session?.user.id]);

  const data = state.report;
  const chartMonths = useMemo(() => {
    if (!data) return [];
    const recorded = new Map(data.months.map((item) => [item.month.slice(0, 7), item.count]));
    const endMonth = range.end.slice(0, 7);
    return Array.from({ length: 5 }, (_, index) => {
      const date = new Date(`${endMonth}-01T00:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() - (4 - index));
      const key = date.toISOString().slice(0, 7);
      return { month: `${key}-01`, count: recorded.get(key) ?? 0 };
    });
  }, [data, range.end]);

  const maxMonth = Math.max(1, ...chartMonths.map((item) => item.count));
  const acceptedCount = data
    ? data.statuses.confirmed + data.statuses.awaiting_payment + data.statuses.paid
      + data.statuses.ongoing + data.statuses.completed
    : 0;
  const acceptedPercent = data?.total ? Math.round((acceptedCount / data.total) * 100) : 0;

  function selectPreset(value: ReportPreset) {
    setPreset(value);
    setDateError('');
    if (value !== 'Custom Date Range') {
      const nextRange = reportRange(value);
      setRange(nextRange);
      setDraft(nextRange);
    }
  }

  function applyCustomRange() {
    try {
      const valid = validateReportRange(draft);
      setRange({ ...valid });
      setDateError('');
    } catch (error) {
      setDateError(reportError(error));
    }
  }

  const statusCards = data ? [
    { label: 'Pending', value: data.statuses.pending, Icon: Clock3, tone: '#A16207', background: '#FEF3C7' },
    { label: 'Confirmed / awaiting payment', value: data.statuses.confirmed + data.statuses.awaiting_payment, Icon: ClipboardList, tone: '#9A3412', background: '#FFEDD5' },
    { label: 'Paid / ongoing', value: data.statuses.paid + data.statuses.ongoing, Icon: Wallet, tone: '#047857', background: '#D1FAE5' },
    { label: 'Completed', value: data.statuses.completed, Icon: CheckCircle2, tone: '#1D4ED8', background: '#DBEAFE' },
    { label: 'Rejected', value: data.statuses.rejected, Icon: CircleX, tone: '#B91C1C', background: '#FEE2E2' },
    { label: 'Cancelled', value: data.statuses.cancelled, Icon: Ban, tone: '#64748B', background: '#F1F5F9' },
  ] : [];

  return (
    <div className="caterer-reports-page">
      <CatererPageHeader
        className="caterer-reports-header"
        icon={<BarChart3 size={25} />}
        title="Reports & Analytics"
        description="An overview of booking performance and financial activity"
        action={<button type="button" className="reports-refresh-button" onClick={() => setRefreshKey((key) => key + 1)} disabled={state.loading} title="Refresh reports" aria-label="Refresh reports">
          <RefreshCw size={18} className={state.loading ? 'reports-spin' : ''} />
        </button>}
      />

      <section className="reports-period-card" aria-label="Report period filters">
        <div className="reports-period-heading">
          <div className="reports-period-icon"><CalendarDays size={20} /></div>
          <div><h2>Report period</h2><p>Explore performance over time</p></div>
          <span className="reports-timezone-badge">PHT</span>
        </div>
        <div className="reports-presets">
          {PRESETS.map((value) => (
            <button key={value} type="button" className={preset === value ? 'selected' : ''} aria-pressed={preset === value} onClick={() => selectPreset(value)}>
              {value}
            </button>
          ))}
        </div>
        {preset === 'Custom Date Range' && (
          <div className="reports-custom-range">
            <label>Start date<input type="date" value={draft.start} onChange={(event) => setDraft((current) => ({ ...current, start: event.target.value }))} /></label>
            <label>End date (inclusive)<input type="date" value={draft.end} onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))} /></label>
            <button type="button" className="reports-primary-button" onClick={applyCustomRange}>Apply Date Range</button>
            <p>Select a period of up to 366 days.</p>
          </div>
        )}
        {dateError && <p className="reports-error-text" role="alert">{dateError}</p>}
        <div className="reports-range-summary"><CalendarDays size={15} /> {formatDateRange(range)}</div>
        <p className="reports-period-note">Reporting periods follow Philippine Standard Time. Booking statistics use the date each booking was placed; downpayments use the recorded payment confirmation date.</p>
      </section>

      {state.loading ? (
        <CatererSkeleton variant="report-content" label="Loading report and analytics" />
      ) : state.error ? (
        <div className="reports-error-card" role="alert">
          <AlertCircle size={24} />
          <p>{state.error}</p>
          <button type="button" className="reports-primary-button" onClick={() => setRefreshKey((key) => key + 1)}>Retry</button>
        </div>
      ) : data ? (
        <>
          {data.total === 0 && <div className="reports-empty-banner"><BarChart3 size={22} /><div><strong>No bookings in this period</strong><span>No bookings were placed during this period. Select another date range to review booking activity.</span></div></div>}
          {!!data.undated_bookings && <p className="reports-period-note">{data.undated_bookings} booking(s) have no recorded booking date and are excluded from date-based statistics.</p>}

          <section className="reports-section">
            <div className="reports-section-heading"><span><BarChart3 size={19} /></span><div><h2>Booking statistics</h2><p>Bookings placed during the selected period, grouped by current status.</p></div></div>
            <article className="reports-featured-card">
              <div className="reports-featured-top"><span><ClipboardList size={21} /></span><small><TrendingUp size={14} /> Booking overview</small></div>
              <strong className="reports-featured-total">{formatCount(data.total)}</strong>
              <span className="reports-featured-caption">Total bookings</span>
              <div className="reports-featured-rule" />
              <div className="reports-featured-stats"><div><strong>{formatCount(acceptedCount)}</strong><span>Accepted bookings</span></div><div><strong>{acceptedPercent}%</strong><span>Of all bookings</span></div></div>
              <div className="reports-featured-progress"><span style={{ width: `${acceptedPercent}%` }} /></div>
            </article>
            <div className="reports-status-grid">
              {statusCards.map(({ label, value, Icon, tone, background }) => (
                <article className="reports-status-card" key={label}>
                  <span className="reports-status-icon" style={{ color: tone, background }}><Icon size={18} /></span>
                  <strong>{formatCount(value)}</strong>
                  <span>{label}</span>
                  <div><i style={{ width: `${data.total ? value / data.total * 100 : 0}%`, backgroundColor: tone }} /></div>
                </article>
              ))}
            </div>
          </section>

          <section className="reports-visual-grid">
            <article className="reports-visual-card">
              <div className="reports-section-heading"><span><TrendingUp size={19} /></span><div><h2>Monthly booking trends</h2><p>Booking activity by creation month</p></div></div>
              <p className="reports-description">Bookings placed during each month, regardless of their current status.</p>
              <div className="reports-chart" role="img" aria-label={`Booking activity by month for the period ending ${yearMonthLabel(range.end.slice(0, 7))}`}>
                {chartMonths.map((item) => (
                  <div className="reports-chart-column" key={item.month} aria-label={`${yearMonthLabel(item.month.slice(0, 7))}: ${item.count} bookings`}>
                    <strong>{formatCount(item.count)}</strong>
                    <div className="reports-chart-track"><i className={item.count === maxMonth && item.count > 0 ? 'peak' : ''} style={{ height: `${item.count / maxMonth * 100}%` }} /></div>
                    <span>{monthLabel(item.month.slice(0, 7))}</span>
                    <small>{item.month.slice(0, 4)}</small>
                  </div>
                ))}
              </div>
              <div className="reports-chart-legend"><i /> Monthly bookings · Philippine Standard Time</div>
            </article>

            <article className="reports-visual-card">
              <div className="reports-section-heading"><span><Package size={19} /></span><div><h2>Popular packages</h2><p>Your most frequently booked offers</p></div></div>
              <p className="reports-description">Rankings include bookings of all statuses and historical package references.</p>
              {!data.packages.length ? (
                <div className="reports-small-empty"><Package size={25} /><span>No package bookings for this period</span></div>
              ) : data.packages.map((item, index) => (
                <div className="reports-package-row" key={`${item.id ?? 'missing'}-${index}`}>
                  <span className={index === 0 ? 'reports-rank first' : 'reports-rank'}>{index + 1}</span>
                  <div><strong>{item.name}</strong><span>{formatCount(item.count)} {item.count === 1 ? 'booking' : 'bookings'}</span></div>
                  <div className="reports-package-track"><i style={{ width: `${data.packages[0]?.count ? item.count / data.packages[0].count * 100 : 0}%` }} /></div>
                </div>
              ))}
            </article>
          </section>

          <section className="reports-section">
            <div className="reports-section-heading"><span><PhilippinePeso size={19} /></span><div><h2>Financial analytics</h2><p>Booking value, downpayments and refund activity</p></div></div>
            <div className="reports-finance-grid">
              <article className="reports-finance-card warm"><div><span><PhilippinePeso size={19} /></span><b>BOOKING VALUE</b></div><label>Estimated booking value</label><strong>{formatReportMoney(data.expected_value)}</strong><hr /><p>{EXPECTED_VALUE_DEFINITION}</p></article>
              <article className="reports-finance-card green"><div><span><ShieldCheck size={19} /></span><b>DOWNPAYMENTS</b></div><label>Verified Downpayments Received</label><strong>{formatReportMoney(state.recordedDownpayments)}</strong><hr /><p>{DOWNPAYMENT_DEFINITION}</p></article>
            </div>
            <p className="reports-caveat">These values are operational booking figures, not net earnings or independently audited cash receipts.</p>
          </section>

          <section className="reports-visual-grid reports-refunds-grid">
            <article className="reports-visual-card"><div className="reports-section-heading"><span className="muted"><RotateCcw size={19} /></span><div><h2>Settled refunds</h2><p>Completed customer refunds</p></div></div><div className="reports-unavailable"><AlertCircle size={17} /> Amount currently unavailable</div><p className="reports-description">The total value of refunds confirmed as returned to customers is not available from the existing data source.</p></article>
            <article className="reports-visual-card"><div className="reports-section-heading"><span><Wallet size={19} /></span><div><h2>Recorded refund obligations</h2><p>Refunds awaiting completion</p></div></div><strong className="reports-refund-amount">{formatReportMoney(data.refund_obligations)}</strong><div className="reports-refund-counts"><div><strong>{formatCount(data.refund_obligation_count)}</strong><span>Outstanding refunds</span></div><div><strong>{formatCount(data.open_refund_disputes)}</strong><span>Open / reviewing disputes</span></div></div><p className="reports-description">Disputed bookings may overlap with obligations and should not be added to the total.</p></article>
          </section>

          <p className="reports-disclaimer">Booking statistics, estimated booking value and refund obligations are based on bookings placed during the selected period. Downpayments use recorded confirmation dates. Changes to current booking or refund status may change older reports.</p>
        </>
      ) : null}
    </div>
  );
}
