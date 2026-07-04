// supabase/functions/xendit-payment/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const XENDIT_SECRET = Deno.env.get('XENDIT_SECRET_KEY') ?? '';

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      type,
      amount,
      referenceId,
      customerName,
      customerEmail,
      description,
    } = body;

    // Use simple HTTPS URLs — we poll for status instead of relying on redirect
    const successUrl = 'https://caterconnect.app/payment-success';
    const failureUrl = 'https://caterconnect.app/payment-failed';

    const xenditRes = await fetch('https://api.xendit.co/ewallets/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(XENDIT_SECRET + ':')}`,
        'Content-Type': 'application/json',
        'api-version': '2022-07-31',
      },
      body: JSON.stringify({
        reference_id: referenceId,
        currency: 'PHP',
        amount: amount,
        checkout_method: 'ONE_TIME_PAYMENT',
        channel_code: 'PH_GCASH',
        channel_properties: {
          success_redirect_url: successUrl,
          failure_redirect_url: failureUrl,
        },
        metadata: {
          type,
          description,
          customer_name: customerName,
          customer_email: customerEmail,
        },
      }),
    });

    const xenditData = await xenditRes.json();

    if (!xenditRes.ok) {
      return new Response(
        JSON.stringify({ error: xenditData }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Prefer mobile/intent URL for Android; fall back to desktop
    const checkoutUrl =
      xenditData.actions?.mobile_web_checkout_url ??
      xenditData.actions?.desktop_web_checkout_url ??
      xenditData.actions?.qr_checkout_string ??
      null;

    const intentUrl = xenditData.actions?.intent ?? null;

    return new Response(
      JSON.stringify({
        chargeId:   xenditData.id,
        checkoutUrl: intentUrl ?? checkoutUrl, // prefer GCash app deep link
        webUrl:     checkoutUrl,               // fallback web URL
        status:     xenditData.status,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});