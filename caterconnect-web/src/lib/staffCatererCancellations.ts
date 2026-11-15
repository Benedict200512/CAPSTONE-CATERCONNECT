import { supabase } from './supabase';
import { daysUntilEvent } from './emergencyCancellation';

export type CatererCancellation = {
  id: string;
  customer_id: string;
  caterer_id: string;
  status: string;
  cancelled_by: string | null;
  event_date: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  refund_amount: number | string | null;
  refund_status: string | null;
  refund_due_at: string | null;
  caterers: { business_name: string | null } | { business_name: string | null }[] | null;
};

export type CancellationFilter = 'all' | 'urgent' | 'other';
export const CANCELLATIONS_PAGE_SIZE = 50;

// Require an actual timestamp with an offset; never substitute the current date.
export function cancellationTimestamp(value: string | null): number | null {
  if (!value || !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function daysBeforeEventAtCancellation(booking: CatererCancellation): number | null {
  const time = cancellationTimestamp(booking.cancelled_at);
  return time === null ? null : daysUntilEvent(booking.event_date, time);
}

export function cancellationTiming(booking: CatererCancellation): 'urgent' | 'other' | 'unknown' {
  const days = daysBeforeEventAtCancellation(booking);
  return days === null ? 'unknown' : days >= 0 && days <= 7 ? 'urgent' : 'other';
}

export function filterCatererCancellations(bookings: CatererCancellation[], filter: CancellationFilter): CatererCancellation[] {
  return bookings.filter(booking => booking.status === 'cancelled' && booking.cancelled_by === 'caterer'
    && (filter === 'all' || cancellationTiming(booking) === filter));
}

export function recordedRefundAmount(amount: CatererCancellation['refund_amount']): string {
  if (amount === null || String(amount).trim() === '' || !Number.isFinite(Number(amount))) return 'Not recorded';
  return Number(amount).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
}

export function recordedRefundStatus(status: string | null): string {
  const labels: Record<string, string> = {
    none: 'No refund due', pending: 'Pending transfer', overdue: 'Transfer overdue',
    awaiting_customer_confirmation: 'Awaiting Customer confirmation', processed: 'Processed', failed: 'Refund failed',
  };
  return status ? labels[status] ?? status.replace(/_/g, ' ') : 'Not recorded';
}

export function recordedCancellationDate(value: string | null): string {
  const time = cancellationTimestamp(value);
  return time === null ? 'Not recorded / invalid timestamp' : new Date(time).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
}

export async function loadCatererCancellationPage(offset: number): Promise<CatererCancellation[]> {
  const { data, error } = await supabase.from('bookings')
    .select('id,customer_id,caterer_id,status,cancelled_by,event_date,cancelled_at,cancellation_reason,refund_amount,refund_status,refund_due_at,caterers(business_name)')
    .eq('status', 'cancelled')
    .eq('cancelled_by', 'caterer')
    .order('cancelled_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(offset, offset + CANCELLATIONS_PAGE_SIZE - 1);
  if (error) {
    throw new Error(error.code === '42501'
      ? 'Your current permissions do not allow this cancellation query. No permissions were changed.'
      : 'Caterer cancellations could not be loaded. Existing access or schema restrictions may prevent this query. Retry or contact the administrator.');
  }
  return (data ?? []) as unknown as CatererCancellation[];
}
