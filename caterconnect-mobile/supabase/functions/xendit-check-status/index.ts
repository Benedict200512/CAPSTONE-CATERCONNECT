// supabase/functions/xendit-check-status/index.ts
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
    const { chargeId } = await req.json();

    if (!chargeId) {
      return new Response(
        JSON.stringify({ status: 'FAILED', error: 'chargeId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const res = await fetch(
      `https://api.xendit.co/ewallets/charges/${chargeId}`,
      {
        headers: {
          'Authorization': `Basic ${btoa(XENDIT_SECRET + ':')}`,
          'api-version': '2022-07-31',
        },
      }
    );

    const data = await res.json();

    return new Response(
      JSON.stringify({
        status:      data.status,
        chargeId:    data.id,
        amount:      data.charge_amount,
        referenceId: data.reference_id,
        metadata:    data.metadata,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'FAILED', error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});