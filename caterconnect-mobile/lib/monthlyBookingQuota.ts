import { supabase } from './supabase';
import { COMMITTED_BOOKING_STATUSES } from './availability';

export type MonthlyQuota =
  | { status: 'ready'; month: string; used: number; limit: number | null; remaining: number | null }
  | { status: 'setup' | 'unavailable'; message: string };

export const manilaQuotaMonth = (now = Date.now()) =>
  `${new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 7)}-01`;

// Display only. Never use this result to permit/deny a booking write.
export function monthlyPlanLimit(plan: string, expiresAt: string | null, now = Date.now()): number | null {
  if (!['free', 'basic', 'standard', 'premium'].includes(plan)) throw new Error('Unknown entitlement');
  if (plan === 'free') return 5;
  const expiry = expiresAt ? Date.parse(expiresAt) : NaN;
  if (!Number.isFinite(expiry)) throw new Error('Unknown expiry');
  if (expiry <= now) return 5;
  return plan === 'basic' ? 20 : plan === 'standard' ? 50 : null;
}

export function isMonthlyQuotaRejection(error: unknown): boolean {
  const failure = error as { code?: string; message?: string } | null;
  // 23514 is also used by daily capacity: match the reviewed monthly message.
  return failure?.code === '23514' &&
    failure.message?.includes('Monthly accepted-booking limit reached.') === true;
}

export async function loadMonthlyBookingQuota(catererId: string, userId: string): Promise<MonthlyQuota> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user.id !== userId) throw new Error('Account changed');
    const { data: owner, error: ownerError } = await supabase.from('caterers')
      .select('id, subscription_plan, subscription_expires_at')
      .eq('id', catererId).eq('user_id', userId).single();
    if (ownerError) throw ownerError;
    if (!owner) throw new Error('Caterer unavailable');
    const now = Date.now();
    const month = manilaQuotaMonth(now);
    const [usage, unassigned] = await Promise.all([
      supabase.from('bookings').select('quota_month', { count: 'exact', head: true })
        .eq('caterer_id', catererId).eq('quota_month', month).in('status', COMMITTED_BOOKING_STATUSES),
      supabase.from('bookings').select('quota_month', { count: 'exact', head: true })
        .eq('caterer_id', catererId).is('quota_month', null).in('status', COMMITTED_BOOKING_STATUSES),
    ]);
    if (usage.error) throw usage.error;
    if (unassigned.error) throw unassigned.error;
    if (usage.count === null || unassigned.count === null) throw new Error('Usage unavailable');
    if (unassigned.count > 0) return { status: 'setup', message: 'Monthly quota setup required. Existing accepted bookings need verified quota periods.' };
    // A request crossing Manila midnight must not label last month's usage as current.
    if (manilaQuotaMonth() !== month) throw new Error('Month changed; refresh');
    const limit = monthlyPlanLimit(owner.subscription_plan, owner.subscription_expires_at, now);
    return { status: 'ready', month, used: usage.count, limit,
      remaining: limit === null ? null : Math.max(0, limit - usage.count) };
  } catch (error) {
    const failure = error as { code?: string; message?: string } | null;
    if (['42703', 'PGRST204'].includes(failure?.code ?? '') && /quota_month/.test(failure?.message ?? '')) {
      return { status: 'setup', message: 'Monthly quota setup required. Confirmed-booking usage is not available yet.' };
    }
    return { status: 'unavailable', message: 'Monthly usage is unavailable. Refresh to try again.' };
  }
}
