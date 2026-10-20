import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkoutQuote } from './create-checkout.ts';

const secret = Deno.env.get('XENDIT_SECRET_KEY') ?? '';
const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!secret || !url || !serviceKey) return json({ error: 'Payment service unavailable' }, 503);
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json({ error: 'Authentication required' }, 401);
  try {
    const client = createClient(url, serviceKey);
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) return json({ error: 'Authentication required' }, 401);
    let input: unknown;
    try { input = await req.json(); } catch { return json({ error: 'Invalid request' }, 400); }
    const quote = await checkoutQuote(client, user.id, input);
    const response = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST', headers: { Authorization: 'Basic ' + btoa(secret + ':'), 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ ...quote, invoice_duration: 86400,
        success_redirect_url: 'https://caterconnect.app/payment-success',
        failure_redirect_url: 'https://caterconnect.app/payment-failed' }),
    });
    if (!response.ok) { console.error('XENDIT_CHECKOUT_PROVIDER_FAILED', response.status); return json({ error: 'Checkout creation unavailable' }, 503); }
    const invoice = await response.json();
    if (typeof invoice.id !== 'string' || typeof invoice.invoice_url !== 'string'
      || invoice.external_id !== quote.external_id || invoice.currency !== 'PHP' || Number(invoice.amount) !== quote.amount) {
      return json({ error: 'Unexpected checkout response' }, 503);
    }
    const checkout = new URL(invoice.invoice_url);
    if (checkout.protocol !== 'https:' || !(checkout.hostname === 'xendit.co' || checkout.hostname.endsWith('.xendit.co'))) return json({ error: 'Invalid checkout URL' }, 503);
    return json({ chargeId: invoice.id, checkoutUrl: checkout.href, webUrl: checkout.href, status: invoice.status });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (['INVALID_REQUEST','STALE_AMOUNT','BOOKING_NOT_PAYABLE','SUBSCRIPTION_OWNER_MISMATCH'].includes(code)) {
      return json({ error: code === 'STALE_AMOUNT' ? 'Payment amount changed. Refresh before paying.' : 'Payment request is not authorized or no longer payable.' }, 422);
    }
    console.error('XENDIT_CHECKOUT_UNAVAILABLE');
    return json({ error: 'Payment service unavailable' }, 503);
  }
});
