import { supabase } from './supabase';
import { initiateGCashPayment, openGCashCheckout } from './xendit';

type PayableBooking = {
  id?: string; customer_id?: string; status: string; payment_verified_at?: string | null; refund_status?: string | null;
  payment_reference?: string | null; payment_receipt_url?: string | null; downpayment_deadline: string | null;
};

// Frontend eligibility only. Existing checkout/webhook remain authoritative.
export function bookingPaymentUnavailable(booking: PayableBooking): string | null {
  if (!['confirmed', 'awaiting_payment'].includes(booking.status) || booking.payment_verified_at) return 'This booking is no longer awaiting downpayment.';
  const attempt = booking.id && booking.customer_id ? attempts.get(booking.customer_id + ':' + booking.id) : undefined;
  if (booking.refund_status !== 'none' || booking.payment_reference) return 'This booking already has payment evidence or a refund. Refresh before proceeding.';
  if (booking.payment_receipt_url && booking.payment_receipt_url !== attempt?.chargeId) return 'Payment verification is pending. Refresh before starting another payment.';
  // Retain the existing server checkout eligibility. A displayed deadline alone
  // does not prove that the server expired or cancelled the booking.
  return null;
}

type Attempt = { amount: number; checkoutUrl: string; chargeId: string; webUrl?: string };
const attempts = new Map<string, Attempt>();
const inProgress = new Set<string>();

// Reuse an unresolved checkout within this app session, including between screens.
// No financial/status writes and no changes to invoice creation or verification.
export async function payBookingDownpayment(bookingId: string, customerName: string, paymentMethod = 'gcash') {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Please sign in again before paying.');
  const key = `${user.id}:${bookingId}`;
  if (inProgress.has(key)) throw new Error('This booking already has a payment checkout in progress.');
  inProgress.add(key);
  try {
    const { data: booking, error } = await supabase.from('bookings')
      .select('id,customer_id,status,downpayment_amount,downpayment_deadline,payment_verified_at,payment_reference,payment_receipt_url,refund_status')
      .eq('id', bookingId).eq('customer_id', user.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking) throw new Error('This booking is missing or no longer accessible.');
    const unavailable = bookingPaymentUnavailable(booking);
    if (unavailable) throw new Error(unavailable);
    let attempt = attempts.get(key);
    if (attempt && attempt.amount !== Number(booking.downpayment_amount)) throw new Error('The booking amount changed while a checkout was pending. Contact support before starting another payment.');
    if (!attempt) {
      const result = await initiateGCashPayment({ type: 'booking', amount: Number(booking.downpayment_amount),
        referenceId: `booking_${booking.id}_${Date.now()}`, customerName, customerEmail: user.email ?? '',
        description: `Downpayment for Booking #${booking.id.slice(0, 8)}`, paymentMethod });
      if (!result.success || !result.checkoutUrl || !result.chargeId) throw new Error(result.error || 'Unable to open checkout.');
      attempt = { amount: Number(booking.downpayment_amount), checkoutUrl: result.checkoutUrl, chargeId: result.chargeId, webUrl: result.webUrl };
      attempts.set(key, attempt);
    }
    const outcome = await openGCashCheckout(attempt.checkoutUrl, attempt.chargeId, attempt.webUrl);
    if (outcome === 'success' || outcome === 'failed') attempts.delete(key);
    return outcome;
  } finally { inProgress.delete(key); }
}
