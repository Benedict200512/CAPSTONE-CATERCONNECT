import { supabase } from './supabase';

export type ReportPreset = 'This Month' | 'Last Month' | 'This Year' | 'Custom Date Range';
export type ReportRange = { start: string; end: string };
export const REPORT_STATUSES = ['pending','confirmed','awaiting_payment','paid','ongoing','completed','rejected','cancelled'] as const;
export type CatererReport = ReportRange & {
  timezone: 'Asia/Manila'; date_basis: 'booking_created_at'; total: number;
  statuses: Record<typeof REPORT_STATUSES[number], number>;
  months: { month: string; count: number }[];
  packages: { id: string | null; name: string; count: number }[];
  expected_value: string | null; refund_obligations: string | null;
  refund_obligation_count: number; open_refund_disputes: number; undated_bookings: number;
  actual_payments: null; settled_refunds: null; financial_evidence: 'unavailable';
};
const iso = (date: Date) => date.toISOString().slice(0,10);
export function reportRange(preset: Exclude<ReportPreset,'Custom Date Range'>, now = Date.now()): ReportRange {
  const manila = new Date(now + 8*60*60*1000), year = manila.getUTCFullYear(), month = manila.getUTCMonth();
  const start = preset === 'This Year' ? new Date(Date.UTC(year,0,1)) : new Date(Date.UTC(year,month-(preset === 'Last Month' ? 1 : 0),1));
  const end = preset === 'This Year' ? new Date(Date.UTC(year,11,31)) : new Date(Date.UTC(year,month+(preset === 'Last Month' ? 0 : 1),0));
  return { start: iso(start), end: iso(end) };
}
export function validateReportRange(range: ReportRange): ReportRange {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter dates as YYYY-MM-DD.');
    const result = new Date(value+'T00:00:00Z');
    if (!Number.isFinite(result.getTime()) || iso(result)!==value || value<'1900-01-01') throw new Error('Enter valid calendar dates from 1900 onward.');
    return result.getTime();
  };
  const start=parse(range.start),end=parse(range.end);
  if (end<start || (end-start)/86400000>365) throw new Error('Choose a date range of at most 366 days, with the end on or after the start.');
  return range;
}
export function reportError(error: unknown): string {
  const value = error as { code?: string; message?: string } | null;
  if (['PGRST202','42883'].includes(value?.code ?? '')) return 'Reports are not available yet. Please contact platform support.';
  if (value?.code === '42501') return 'Sign in with your assigned caterer account to view reports.';
  return value?.message || 'Reports could not be loaded. Please retry.';
}
export function formatReportMoney(value: string | null): string {
  if (value === null || !/^\d+(\.\d{1,2})?$/.test(value)) return 'Unavailable';
  const number=Number(value);
  if (!Number.isFinite(number) || number>Number.MAX_SAFE_INTEGER/100) return 'Unavailable';
  return number.toLocaleString('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2,maximumFractionDigits:2});
}
export async function loadCatererReport(range: ReportRange): Promise<CatererReport> {
  validateReportRange(range);
  const { data,error } = await supabase.rpc('get_caterer_reports',{p_start:range.start,p_end:range.end});
  if (error) throw error;
  const value=data as CatererReport | null;
  const count = (n: unknown) => Number.isSafeInteger(n) && Number(n)>=0;
  const amount = (n: unknown) => n === null || typeof n === 'string' && /^\d+(\.\d{1,2})?$/.test(n);
  if (!value || value.start!==range.start || value.end!==range.end || value.timezone!=='Asia/Manila'
    || value.date_basis!=='booking_created_at' || !count(value.total) || !value.statuses
    || REPORT_STATUSES.some(s=>!count(value.statuses[s]))
    || REPORT_STATUSES.reduce((sum,s)=>sum+value.statuses[s],0)!==value.total
    || !Array.isArray(value.months) || !value.months.length || value.months.length>13
    || value.months.some(m=>!m || !/^\d{4}-\d{2}-01$/.test(m.month) || !count(m.count))
    || value.months.reduce((sum,m)=>sum+m.count,0)!==value.total
    || !Array.isArray(value.packages) || value.packages.length>10
    || value.packages.some(p=>!p || (p.id!==null && typeof p.id!=='string') || typeof p.name!=='string' || !count(p.count) || p.count>value.total)
    || ![value.refund_obligation_count,value.open_refund_disputes,value.undated_bookings].every(count)
    || !amount(value.expected_value) || !amount(value.refund_obligations)
    || value.actual_payments!==null || value.settled_refunds!==null || value.financial_evidence!=='unavailable') {
    throw new Error('The report response could not be verified. Please reload.');
  }
  return value;
}
