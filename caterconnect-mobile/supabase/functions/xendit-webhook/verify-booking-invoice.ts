import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const bookingReference = /^booking_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_\d+$/i;

// Compare decimal pesos as integer centavos. Never round an underpayment up.
export function centavos(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export type VerificationResult = { outcome: 'processed' | 'ignored' | 'retry' | 'rejected'; code: string };

// Called only after webhook authentication and a fresh server-key Invoice API GET.
// Check the server-generated booking/customer binding confirmed for the
// deployed invoice checkout. Missing bindings fail closed for operator review.
export async function verifyBookingInvoice(client: SupabaseClient, invoice: any): Promise<VerificationResult> {
  const match = typeof invoice?.external_id === 'string' && invoice.external_id.match(bookingReference);
  if (!match || typeof invoice.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(invoice.id)
    || invoice.status !== 'PAID' || invoice.currency !== 'PHP'
    || invoice.metadata?.type !== 'booking'
    || invoice.metadata?.booking_id !== match[1]
    || !invoice.metadata?.customer_id
    || invoice.metadata.user_id !== invoice.metadata.customer_id
    || centavos(invoice.amount) === null
    || centavos(invoice.paid_amount) !== centavos(invoice.amount)
    || (invoice.refunded_amount != null && Number(invoice.refunded_amount) !== 0)) {
    return { outcome: 'rejected', code: 'INVOICE_VALIDATION_FAILED' };
  }
  const { data: booking, error } = await client.from('bookings')
    .select('id,customer_id,caterer_id,status,downpayment_amount,payment_reference,payment_receipt_url,payment_submitted_at,payment_verified_at,refund_status')
    .eq('id', match[1]).maybeSingle();
  if (error) return { outcome: 'retry', code: `BOOKING_READ_${error.code ?? 'FAILED'}` };
  if (!booking) return { outcome: 'rejected', code: 'BOOKING_NOT_FOUND' };
  if (booking.customer_id !== invoice.metadata.customer_id
    || centavos(booking.downpayment_amount) !== centavos(invoice.amount)) {
    return { outcome: 'rejected', code: 'BOOKING_AMOUNT_OR_CUSTOMER_MISMATCH' };
  }
  if ((booking.payment_receipt_url && booking.payment_receipt_url !== invoice.id)
    || (booking.payment_reference && booking.payment_reference !== invoice.id)) {
    return { outcome: 'rejected', code: 'BOOKING_INVOICE_CONFLICT' };
  }
  if (booking.payment_verified_at) {
    return booking.payment_reference === invoice.id && booking.payment_receipt_url === invoice.id
      ? { outcome: 'ignored', code: 'BOOKING_ALREADY_VERIFIED' }
      : { outcome: 'rejected', code: 'BOOKING_VERIFIED_EVIDENCE_CONFLICT' };
  }
  if (['paid','ongoing','completed'].includes(booking.status)) return { outcome: 'rejected', code: 'BOOKING_INCONSISTENT_PAYMENT_STATE' };
  if (!['confirmed', 'awaiting_payment'].includes(booking.status)
    || booking.refund_status !== 'none') return { outcome: 'ignored', code: 'BOOKING_NO_LONGER_ELIGIBLE' };
  const now = new Date().toISOString();
  let update = client.from('bookings').update({ status: 'paid', payment_reference: invoice.id,
    payment_receipt_url: invoice.id, payment_submitted_at: booking.payment_submitted_at ?? now,
    payment_verified_at: now,
  }).eq('id', booking.id).eq('customer_id', booking.customer_id).eq('caterer_id', booking.caterer_id)
    .eq('status', booking.status).eq('downpayment_amount', booking.downpayment_amount)
    .eq('refund_status', 'none').is('payment_verified_at', null);
  for (const field of ['payment_reference', 'payment_receipt_url', 'payment_submitted_at'] as const) {
    update = booking[field] === null ? update.is(field, null) : update.eq(field, booking[field]);
  }
  const { data: rows, error: writeError } = await update.select('id');
  if (writeError) return { outcome: 'retry', code: `BOOKING_WRITE_${writeError.code ?? 'FAILED'}` };
  // A zero-row CAS can also mean a still-eligible amount/receipt changed. Retry
  // and re-read instead of silently losing a verified provider event.
  return rows?.length === 1 ? { outcome: 'processed', code: 'BOOKING_PAID' }
    : { outcome: 'retry', code: 'BOOKING_CHANGED_RETRY' };
}
