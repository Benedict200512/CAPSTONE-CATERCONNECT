import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// This does not verify payment or calculate refunds. It records the existing
// awaiting-verification state only if this booking can still accept the charge.
export async function recordBookingCallback(
  client: SupabaseClient, bookingId: string, chargeId: string,
): Promise<'processed' | 'ignored' | 'retry'> {
  const { data: booking, error: readError } = await client.from('bookings')
    .select('status, payment_receipt_url, payment_verified_at')
    .eq('id', bookingId).maybeSingle();
  if (readError) return 'retry';
  if (!booking || booking.status !== 'confirmed' || booking.payment_verified_at
    || booking.payment_receipt_url === chargeId) return 'ignored';

  let update = client.from('bookings').update({
    status: 'awaiting_payment',
    payment_receipt_url: chargeId,
    payment_submitted_at: new Date().toISOString(),
  }).eq('id', bookingId).eq('status', 'confirmed').is('payment_verified_at', null);
  // Compare the receipt observed above too: a changed/rejected/retried payment
  // must not be overwritten using a stale read. NULL is matched explicitly.
  update = booking.payment_receipt_url === null
    ? update.is('payment_receipt_url', null)
    : update.eq('payment_receipt_url', booking.payment_receipt_url);
  const { data: rows, error: updateError } = await update.select('id');
  if (updateError) return 'retry';
  return rows?.length === 1 ? 'processed' : 'ignored';
}
