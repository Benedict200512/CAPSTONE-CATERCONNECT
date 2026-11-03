import { supabase } from './supabase';

// Must match the reviewed daily-capacity proposal; these are not monthly quotas.
export const COMMITTED_BOOKING_STATUSES = ['confirmed', 'awaiting_payment', 'paid', 'ongoing', 'completed'];
export const manilaToday = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
export const shiftMonth = (month: string, offset: number) => {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
};

export function availabilityError(error: unknown): string {
  const failure = error as { code?: string; message?: string } | null;
  if (['42703', '42P01', 'PGRST204', 'PGRST205'].includes(failure?.code ?? '') &&
    /max_bookings_per_day|caterer_blocked_dates/.test(failure?.message ?? '')) {
    return 'Availability settings are not available yet. Please try again after platform setup is complete.';
  }
  return failure?.message || 'Unable to update availability. Please check your connection and try again.';
}

async function ownerSettings(catererId: string, userId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.id !== userId) throw new Error('Your account changed. Please reopen availability.');
  const { data, error } = await supabase.from('caterers').select('id, max_bookings_per_day')
    .eq('id', catererId).eq('user_id', userId).single();
  if (error) throw error;
  if (!Number.isInteger(data.max_bookings_per_day) || data.max_bookings_per_day < 1) {
    throw new Error('Daily capacity is unavailable. Please refresh or contact support.');
  }
  return data;
}

export async function loadAvailability(catererId: string, userId: string, month: string) {
  const settings = await ownerSettings(catererId, userId);
  const start = `${month}-01`;
  const end = `${shiftMonth(month, 1)}-01`;
  const { data: blocks, error } = await supabase.from('caterer_blocked_dates').select('event_date')
    .eq('caterer_id', catererId).gte('event_date', start).lt('event_date', end);
  if (error) throw error;
  const counts: Record<string, number> = {};
  // Page through rows to avoid silently understating capacity at the API limit.
  for (let offset = 0; ; offset += 500) {
    const { data, error: bookingError } = await supabase.from('bookings').select('id, event_date')
      .eq('caterer_id', catererId).gte('event_date', start).lt('event_date', end)
      .in('status', COMMITTED_BOOKING_STATUSES).order('id').range(offset, offset + 499);
    if (bookingError) throw bookingError;
    for (const row of data ?? []) counts[row.event_date] = (counts[row.event_date] ?? 0) + 1;
    if (!data || data.length < 500) break;
  }
  return { capacity: settings.max_bookings_per_day as number,
    blocked: (blocks ?? []).map(row => row.event_date as string), counts };
}

export async function saveDailyCapacity(catererId: string, userId: string, capacity: number) {
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 2147483647) {
    throw new Error('Enter a positive whole number of bookings per day.');
  }
  await ownerSettings(catererId, userId);
  const { data, error } = await supabase.from('caterers').update({ max_bookings_per_day: capacity })
    .eq('id', catererId).eq('user_id', userId).select('id');
  if (error) throw error;
  if (data?.length !== 1) throw new Error('Capacity was not updated. Refresh and try again.');
}

export async function setDateBlocked(catererId: string, userId: string, date: string, blocked: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < manilaToday()) throw new Error('Choose today or a future date.');
  await ownerSettings(catererId, userId);
  const query = blocked
    ? supabase.from('caterer_blocked_dates').insert({ caterer_id: catererId, event_date: date })
    : supabase.from('caterer_blocked_dates').delete().eq('caterer_id', catererId).eq('event_date', date);
  const { data, error } = await query.select('event_date');
  if (error) throw error;
  if (data?.length !== 1) throw new Error('This date may have changed. Refresh and try again.');
}

export async function fetchUnavailableDates(catererId: string): Promise<string[]> {
  const dates: string[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.rpc('get_caterer_unavailable_dates', { p_caterer_id: catererId })
      .order('event_date').range(offset, offset + 499);
    if (error) throw error;
    if (!data) throw new Error('Date availability is unavailable. Please try again.');
    for (const row of data as { event_date: string | null }[]) if (row.event_date) dates.push(row.event_date.slice(0, 10));
    if (data.length < 500) break;
  }
  return [...new Set(dates)];
}
