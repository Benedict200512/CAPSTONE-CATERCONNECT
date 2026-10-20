import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { bookingReference, centavos } from '../xendit-webhook/verify-booking-invoice.ts';
import { subscriptionReference } from '../xendit-webhook/verify-subscription-payment.ts';

// Retains the mobile request shape but never uses client prices or identities
// as authority. A fresh provider invoice receives only server-built metadata.
export async function checkoutQuote(client: SupabaseClient, userId: string, input: any) {
  const method = input?.paymentMethod ?? 'gcash';
  if (!['gcash','maya','bpi','bdo','card'].includes(method)) throw new Error('INVALID_REQUEST');
  if (input?.type === 'booking') {
    const match = typeof input.referenceId === 'string' && input.referenceId.match(bookingReference);
    if (!match) throw new Error('INVALID_REQUEST');
    const { data: booking, error } = await client.from('bookings')
      .select('id,customer_id,status,downpayment_amount,payment_verified_at,payment_reference,payment_receipt_url,refund_status')
      .eq('id', match[1]).eq('customer_id', userId).maybeSingle();
    if (error) throw new Error('DATABASE_UNAVAILABLE');
    if (!booking || !['confirmed','awaiting_payment'].includes(booking.status) || booking.payment_verified_at
      || booking.refund_status !== 'none' || booking.payment_reference || booking.payment_receipt_url) throw new Error('BOOKING_NOT_PAYABLE');
    if (centavos(booking.downpayment_amount) === null || centavos(input.amount) !== centavos(booking.downpayment_amount)) throw new Error('STALE_AMOUNT');
    return { external_id: `booking_${booking.id}_${Date.now()}`, amount: Number(booking.downpayment_amount), currency: 'PHP',
      description: 'CaterConnect booking downpayment',
      metadata: { type: 'booking', booking_id: booking.id, customer_id: userId, user_id: userId, payment_method: method } };
  }
  if (input?.type === 'subscription') {
    const match = typeof input.referenceId === 'string' && input.referenceId.match(subscriptionReference);
    if (!match) throw new Error('INVALID_REQUEST');
    const { data: caterer, error } = await client.from('caterers').select('id,user_id').eq('id', match[1]).eq('user_id', userId).maybeSingle();
    if (error) throw new Error('DATABASE_UNAVAILABLE');
    if (!caterer) throw new Error('SUBSCRIPTION_OWNER_MISMATCH');
    const { data: plan, error: planError } = await client.from('subscription_plans').select('id,price').eq('id', match[2]).maybeSingle();
    if (planError) throw new Error('DATABASE_UNAVAILABLE');
    if (!plan || centavos(plan.price) === null || centavos(input.amount) !== centavos(plan.price)) throw new Error('STALE_AMOUNT');
    return { external_id: `sub_${caterer.id}_${plan.id}_${Date.now()}`, amount: Number(plan.price), currency: 'PHP',
      description: `CaterConnect ${plan.id} monthly subscription`,
      metadata: { type: 'subscription', caterer_id: caterer.id, plan_id: plan.id, user_id: userId, payment_method: method } };
  }
  throw new Error('INVALID_REQUEST');
}
