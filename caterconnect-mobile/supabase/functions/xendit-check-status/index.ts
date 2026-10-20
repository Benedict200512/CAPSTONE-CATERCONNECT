import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { bookingReference, centavos } from '../xendit-webhook/verify-booking-invoice.ts';
import { subscriptionReference } from '../xendit-webhook/verify-subscription-payment.ts';

const secret = Deno.env.get('XENDIT_SECRET_KEY') ?? '';
const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!secret || !url || !serviceKey) return json({ error: 'Payment lookup unavailable' }, 503);
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json({ error: 'Authentication required' }, 401);
  try {
    const client = createClient(url, serviceKey);
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) return json({ error: 'Authentication required' }, 401);
    const { chargeId } = await req.json();
    if (typeof chargeId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(chargeId)) return json({ error: 'Invalid payment ID' }, 400);
    const ewallet = chargeId.startsWith('ewc_');
    const response = await fetch('https://api.xendit.co/' + (ewallet ? 'ewallets/charges/' : 'v2/invoices/') + encodeURIComponent(chargeId), {
      headers: { Authorization: 'Basic ' + btoa(secret + ':'), ...(ewallet ? { 'api-version': '2022-07-31' } : {}) },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return json({ error: 'Provider lookup unavailable' }, 503);
    const payment = await response.json();
    if (payment?.id !== chargeId) return json({ error: 'Payment identity mismatch' }, 422);
    const reference = ewallet ? payment.reference_id : payment.external_id;
    const bookingMatch = typeof reference === 'string' && reference.match(bookingReference);
    const subscriptionMatch = typeof reference === 'string' && reference.match(subscriptionReference);
    let databaseConfirmed = false;
    if (bookingMatch) {
      const { data: booking, error: readError } = await client.from('bookings')
        .select('customer_id,status,payment_verified_at,payment_reference').eq('id', bookingMatch[1]).maybeSingle();
      if (readError) return json({ error: 'Database lookup unavailable' }, 503);
      if (!booking || booking.customer_id !== user.id) return json({ error: 'Payment not available' }, 403);
      databaseConfirmed = !!booking.payment_verified_at && booking.payment_reference === chargeId && ['paid','ongoing','completed'].includes(booking.status);
    } else if (subscriptionMatch) {
      const { data: caterer, error: readError } = await client.from('caterers').select('id,user_id,subscription_plan,subscription_expires_at')
        .eq('id', subscriptionMatch[1]).maybeSingle();
      if (readError) return json({ error: 'Database lookup unavailable' }, 503);
      if (!caterer || caterer.user_id !== user.id) return json({ error: 'Payment not available' }, 403);
      const { data: receipt, error: receiptError } = await client.from('subscription_payments').select('status,plan_id,amount,confirmed_at')
        .eq('caterer_id', caterer.id).eq('payment_reference', chargeId).eq('status','confirmed').maybeSingle();
      if (receiptError) return json({ error: 'Database lookup unavailable' }, 503);
      const amount = ewallet ? payment.charge_amount : payment.amount;
      const expires = Date.parse(caterer.subscription_expires_at);
      databaseConfirmed = !!receipt && receipt.plan_id === subscriptionMatch[2]
        && caterer.subscription_plan === receipt.plan_id && payment.currency === 'PHP'
        && centavos(amount) !== null && centavos(receipt.amount) === centavos(amount)
        && expires > Date.now() && typeof receipt.confirmed_at === 'string'
        && Math.abs(expires - Date.parse(receipt.confirmed_at) - 30 * 86400000) <= 1000;
    } else return json({ error: 'Unsupported payment' }, 422);
    // Read only. No client callback or status lookup is a payment writer.
    return json({ status: payment.status, databaseConfirmed });
  } catch {
    console.error('XENDIT_STATUS_LOOKUP_UNAVAILABLE');
    return json({ error: 'Payment lookup unavailable' }, 503);
  }
});
