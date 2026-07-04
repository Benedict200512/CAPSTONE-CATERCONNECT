// supabase/functions/xendit-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const XENDIT_WEBHOOK_TOKEN = Deno.env.get('XENDIT_WEBHOOK_TOKEN') ?? '';

serve(async (req) => {
  // Verify Xendit webhook token
  const token = req.headers.get('x-callback-token');
  if (token !== XENDIT_WEBHOOK_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let event: any;
  try {
    event = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  console.log('Xendit webhook event:', JSON.stringify(event));

  // Handle both legacy and new webhook formats
  const eventType  = event.event ?? event.type ?? '';
  const chargeData = event.data ?? event;
  const status     = chargeData?.status ?? '';

  // Only process successful charges
  const isSuccess =
    (eventType === 'ewallet.payment' && status === 'SUCCEEDED') ||
    (eventType === 'payment.succeeded') ||
    (status === 'SUCCEEDED');

  if (!isSuccess) {
    console.log('Skipping non-success event:', eventType, status);
    return new Response('OK', { status: 200 });
  }

  const referenceId: string = chargeData.reference_id ?? '';
  const amount: number      = chargeData.charge_amount ?? chargeData.amount ?? 0;
  const metadata            = chargeData.metadata ?? {};
  const type: string        = metadata.type ?? '';

  console.log('Processing payment:', { referenceId, amount, type });

  // ── SUBSCRIPTION PAYMENT ──
  if (type === 'subscription') {
    // referenceId format: "sub_{catererId}_{planId}_{timestamp}"
    const parts     = referenceId.split('_');
    const catererId = parts[1];
    const planId    = parts[2];

    if (!catererId || !planId) {
      console.error('Invalid subscription referenceId:', referenceId);
      return new Response('Invalid referenceId', { status: 400 });
    }

    const planConfig: Record<string, string> = {
      basic:    'basic',
      standard: 'standard',
      premium:  'premium',
    };

    const planName = planConfig[planId];
    if (!planName) {
      console.error('Unknown plan:', planId);
      return new Response('Unknown plan', { status: 400 });
    }

    // Record subscription payment
    const { error: paymentError } = await supabase
      .from('subscription_payments')
      .insert({
        caterer_id:        catererId,
        plan_id:           planId,
        amount,
        payment_method:    'gcash',
        payment_reference: chargeData.id,
        status:            'confirmed',
        confirmed_at:      new Date().toISOString(),
      });

    if (paymentError) {
      console.error('Error inserting payment:', paymentError);
    }

    // Upgrade caterer plan
    const { error: upgradeError } = await supabase
      .from('caterers')
      .update({
        subscription_plan:        planName,
        subscription_expires_at:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        monthly_booking_count:    0,
        booking_count_reset_at:   new Date().toISOString(),
      })
      .eq('id', catererId);

    if (upgradeError) {
      console.error('Error upgrading plan:', upgradeError);
    }

    // Notify caterer
    const { data: caterer } = await supabase
      .from('caterers')
      .select('user_id, business_name')
      .eq('id', catererId)
      .single();

    if (caterer?.user_id) {
      await supabase.from('notifications').insert({
        user_id: caterer.user_id,
        title:   '✅ Subscription Activated!',
        message: `Your ${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan is now active. Enjoy your upgraded features!`,
        type:    'payment_verified',
      });
    }

    console.log('Subscription upgraded:', catererId, planName);
  }

  // ── BOOKING PAYMENT ──
  else if (type === 'booking') {
    // referenceId format: "booking_{bookingId}_{timestamp}"
    const parts     = referenceId.split('_');
    const bookingId = parts[1];

    if (!bookingId) {
      console.error('Invalid booking referenceId:', referenceId);
      return new Response('Invalid referenceId', { status: 400 });
    }

    // Update booking status
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        status:                'awaiting_payment',
        payment_receipt_url:   chargeData.id,
        payment_submitted_at:  new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (bookingError) {
      console.error('Error updating booking:', bookingError);
    }

    // Get booking details for notifications
    const { data: booking } = await supabase
      .from('bookings')
      .select('customer_id, caterers(user_id, business_name), profiles(full_name)')
      .eq('id', bookingId)
      .single();

    if (booking) {
      const catererUserId = (booking.caterers as any)?.user_id;
      const businessName  = (booking.caterers as any)?.business_name ?? 'the caterer';
      const customerName  = (booking.profiles as any)?.full_name ?? 'Customer';

      const notifications: any[] = [
        {
          user_id:    booking.customer_id,
          title:      '💳 Payment Submitted',
          message:    `Your GCash payment has been received. Waiting for ${businessName} to verify.`,
          type:       'payment_submitted',
          booking_id: bookingId,
        },
      ];

      if (catererUserId) {
        notifications.push({
          user_id:    catererUserId,
          title:      '💳 Payment Received',
          message:    `${customerName} paid via GCash. Please verify and confirm the payment.`,
          type:       'payment_submitted',
          booking_id: bookingId,
        });
      }

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error('Error inserting notifications:', notifError);
      }
    }

    console.log('Booking payment recorded:', bookingId);
  }

  else {
    console.log('Unknown payment type:', type, '— referenceId:', referenceId);
  }

  return new Response('OK', { status: 200 });
});