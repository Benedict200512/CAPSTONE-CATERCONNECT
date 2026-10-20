import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyBookingInvoice } from './verify-booking-invoice.ts';
import { verifySubscriptionPayment } from './verify-subscription-payment.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const XENDIT_WEBHOOK_TOKEN = Deno.env.get('XENDIT_WEBHOOK_TOKEN') ?? '';
const XENDIT_SECRET = Deno.env.get('XENDIT_SECRET_KEY') ?? '';

serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!XENDIT_WEBHOOK_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('XENDIT_WEBHOOK_CONFIGURATION_MISSING');
    return new Response('Webhook unavailable', { status: 503 });
  }
  if (req.headers.get('x-callback-token') !== XENDIT_WEBHOOK_TOKEN) return new Response('Unauthorized', { status: 401 });
  let event: any;
  try { event = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
  if (!event || typeof event !== 'object' || Array.isArray(event)) return new Response('Invalid event', { status: 400 });
  const callback = event.data ?? event;
  if (!callback || typeof callback !== 'object' || Array.isArray(callback)) return new Response('Invalid event', { status: 400 });
  const invoiceFlow = typeof callback.external_id === 'string' || callback.status === 'PAID';
  const reference = invoiceFlow ? callback.external_id : callback.reference_id;
  const eventType = event.event ?? event.type;
  const success = invoiceFlow ? callback.status === 'PAID' : callback.status === 'SUCCEEDED'
    || (eventType === 'payment.succeeded' && !callback.status);
  if (!success) return new Response('Ignored non-success event', { status: 200 });
  if (typeof reference !== 'string' || typeof callback.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(callback.id)) {
    return new Response('Invalid payment identity', { status: 400 });
  }
  if (!XENDIT_SECRET) return new Response('Verification unavailable', { status: 503 });
  try {
    // Fetch authoritative state for BOTH payment APIs before privileged access.
    const response = await fetch('https://api.xendit.co/' + (invoiceFlow ? 'v2/invoices/' : 'ewallets/charges/') + encodeURIComponent(callback.id), {
      headers: { Authorization: 'Basic ' + btoa(XENDIT_SECRET + ':'), ...(!invoiceFlow ? { 'api-version': '2022-07-31' } : {}) },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error('XENDIT_PAYMENT_LOOKUP_FAILED', response.status);
      return new Response('Provider verification unavailable', { status: 503 });
    }
    const provider = await response.json();
    if (provider?.id !== callback.id || (invoiceFlow ? provider.external_id : provider.reference_id) !== reference) {
      return new Response('Provider identity mismatch', { status: 422 });
    }
    // Only adapt a freshly fetched eWallet response. A successful capture is
    // required; an authorization or client-provided amount cannot mark Paid.
    const payment = invoiceFlow ? provider : {
      ...provider, external_id: provider.reference_id,
      status: provider.status === 'SUCCEEDED' ? 'PAID' : provider.status,
      amount: provider.charge_amount, paid_amount: provider.capture_amount,
    };
    const type = payment.metadata?.type;
    if (payment.status !== 'PAID' || !['booking', 'subscription'].includes(type)) {
      return new Response('Unverified or unsupported payment', { status: 422 });
    }
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const result = type === 'booking' ? await verifyBookingInvoice(client, payment)
      : await verifySubscriptionPayment(client, payment);
    // Codes only: never payloads, customer details, IDs, keys or raw errors.
    console.log('XENDIT_PAYMENT_RESULT', result.code);
    if (result.outcome === 'retry') return new Response('Database verification retry required', { status: 503 });
    if (result.outcome === 'rejected') return new Response('Payment verification rejected', { status: 422 });
    // Existing database paid trigger sends booking notifications atomically.
    return new Response('OK', { status: 200 });
  } catch {
    console.error('XENDIT_PAYMENT_PROCESSING_UNAVAILABLE');
    return new Response('Payment processing unavailable', { status: 503 });
  }
});
