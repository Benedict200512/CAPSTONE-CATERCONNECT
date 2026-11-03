import { supabase } from './supabase';

export type ReportPreset = 'This Month' | 'Last Month' | 'This Year' | 'Custom Date Range';
export type ReportRange = { start: string; end: string };

export const REPORT_STATUSES = [
  'pending', 'confirmed', 'awaiting_payment', 'paid', 'ongoing', 'completed', 'rejected', 'cancelled',
] as const;

export type CatererReport = ReportRange & {
  timezone: 'Asia/Manila';
  date_basis: 'booking_created_at';
  total: number;
  statuses: Record<(typeof REPORT_STATUSES)[number], number>;
  months: { month: string; count: number }[];
  packages: { id: string | null; name: string; count: number }[];
  expected_value: string | null;
  refund_obligations: string | null;
  refund_obligation_count: number;
  open_refund_disputes: number;
  undated_bookings: number;
  actual_payments: null;
  settled_refunds: null;
  financial_evidence: 'unavailable';
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function reportRange(preset: Exclude<ReportPreset, 'Custom Date Range'>, now = Date.now()): ReportRange {
  const manila = new Date(now + 8 * 60 * 60 * 1000);
  const year = manila.getUTCFullYear();
  const month = manila.getUTCMonth();
  const start = preset === 'This Year'
    ? new Date(Date.UTC(year, 0, 1))
    : new Date(Date.UTC(year, month - (preset === 'Last Month' ? 1 : 0), 1));
  const end = preset === 'This Year'
    ? new Date(Date.UTC(year, 11, 31))
    : new Date(Date.UTC(year, month + (preset === 'Last Month' ? 0 : 1), 0));
  return { start: isoDate(start), end: isoDate(end) };
}

export function validateReportRange(range: ReportRange): ReportRange {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter dates as YYYY-MM-DD.');
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || isoDate(date) !== value || value < '1900-01-01') {
      throw new Error('Enter valid calendar dates from 1900 onward.');
    }
    return date.getTime();
  };

  const start = parse(range.start);
  const end = parse(range.end);
  if (end < start || (end - start) / 86400000 > 365) {
    throw new Error('Choose a date range of at most 366 days, with the end on or after the start.');
  }
  return range;
}

export function reportError(error: unknown): string {
  const value = error as { code?: string; message?: string } | null;
  if (['PGRST202', '42883'].includes(value?.code ?? '')) {
    return 'Reports are not available yet. The reports service has not been enabled for this project.';
  }
  if (value?.code === '42501') return 'Sign in with your assigned caterer account to view reports.';
  return value?.message || 'Reports could not be loaded. Please retry.';
}

export function formatReportMoney(value: string | null): string {
  if (value === null || !/^\d+(\.\d{1,2})?$/.test(value)) return 'Unavailable';
  const number = Number(value);
  if (!Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER / 100) return 'Unavailable';
  return number.toLocaleString('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export async function loadCatererReport(range: ReportRange): Promise<CatererReport> {
  validateReportRange(range);
  const { data, error } = await supabase.rpc('get_caterer_reports', {
    p_start: range.start,
    p_end: range.end,
  });
  if (error) throw error;

  const report = data as CatererReport | null;
  const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
  const isAmount = (value: unknown) => value === null || typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value);

  if (!report || report.start !== range.start || report.end !== range.end
    || report.timezone !== 'Asia/Manila' || report.date_basis !== 'booking_created_at'
    || !isCount(report.total) || !report.statuses
    || REPORT_STATUSES.some((status) => !isCount(report.statuses[status]))
    || REPORT_STATUSES.reduce((total, status) => total + report.statuses[status], 0) !== report.total
    || !Array.isArray(report.months) || !report.months.length || report.months.length > 13
    || report.months.some((item) => !item || !/^\d{4}-\d{2}-01$/.test(item.month) || !isCount(item.count))
    || report.months.reduce((total, item) => total + item.count, 0) !== report.total
    || !Array.isArray(report.packages) || report.packages.length > 10
    || report.packages.some((item) => !item || (item.id !== null && typeof item.id !== 'string')
      || typeof item.name !== 'string' || !isCount(item.count) || item.count > report.total)
    || ![report.refund_obligation_count, report.open_refund_disputes, report.undated_bookings].every(isCount)
    || !isAmount(report.expected_value) || !isAmount(report.refund_obligations)
    || report.actual_payments !== null || report.settled_refunds !== null
    || report.financial_evidence !== 'unavailable') {
    throw new Error('The report response could not be verified. Please reload.');
  }
  return report;
}

function amountToCentavos(value: unknown): number {
  const text = String(value ?? '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Invalid stored downpayment amount.');
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Invalid stored downpayment amount.');
  return cents;
}

export async function loadRecordedDownpayments(catererId: string, range: ReportRange): Promise<string> {
  const start = new Date(`${range.start}T00:00:00+08:00`);
  const end = new Date(new Date(`${range.end}T00:00:00+08:00`).getTime() + 86400000);
  let totalCentavos = 0;
  let offset = 0;
  const pageSize = 500;

  for (;;) {
    const { data, error } = await supabase.from('bookings')
      .select('id,downpayment_amount')
      .eq('caterer_id', catererId)
      .in('status', ['paid', 'ongoing', 'completed'])
      .not('payment_reference', 'is', null)
      .gte('payment_verified_at', start.toISOString())
      .lt('payment_verified_at', end.toISOString())
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data) throw new Error('Downpayment records are unavailable.');
    for (const row of data) {
      totalCentavos += amountToCentavos(row.downpayment_amount);
      if (!Number.isSafeInteger(totalCentavos)) throw new Error('Downpayment total is too large.');
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return (totalCentavos / 100).toFixed(2);
}
