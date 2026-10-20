// lib/xendit.ts  (mobile)
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

export type PaymentType = 'subscription' | 'booking' | 'debt';

type XenditPaymentOptions = {
  type: PaymentType;
  amount: number;
  referenceId: string;
  customerName: string;
  customerEmail: string;
  description: string;
  paymentMethod?: string;
};

type PaymentResult = {
  success: boolean;
  checkoutUrl?: string;
  webUrl?: string;
  chargeId?: string; // Stores the Xendit Invoice ID
  error?: string;
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export async function initiateGCashPayment(
  options: XenditPaymentOptions
): Promise<PaymentResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const res = await fetch(`${SUPABASE_URL}/functions/v1/xendit-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(options),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      const errMsg =
        typeof data.error === 'string'
          ? data.error
          : data.error?.message ?? data.error?.error_code ?? 'Payment initiation failed';
      throw new Error(errMsg);
    }

    return {
      success:     true,
      checkoutUrl: data.checkoutUrl,
      webUrl:      data.webUrl,
      chargeId:    data.chargeId,
    };
  } catch (err: any) {
    console.error('initiateGCashPayment error:', err.message);
    return { success: false, error: err.message };
  }
}

// Optional alias if you prefer calling it initiateXenditPayment
export const initiateXenditPayment = initiateGCashPayment;

async function pollChargeStatus(
  chargeId: string,
  maxAttempts = 24,
  intervalMs = 3000
): Promise<'SUCCEEDED' | 'FAILED' | 'PENDING'> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return 'FAILED';

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/xendit-check-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ chargeId }),
        }
      );

      const data = await res.json();
      if (!res.ok) continue;
      if ((data.status === 'SUCCEEDED' || data.status === 'PAID') && data.databaseConfirmed === true) return 'SUCCEEDED';
      if (data.status === 'FAILED' || data.status === 'VOIDED' || data.status === 'EXPIRED') return 'FAILED';
    } catch (err) {
      console.warn('Poll error (will retry):', err);
    }
  }

  return 'PENDING';
}

export async function openGCashCheckout(
  checkoutUrl: string,
  chargeId: string,
  webUrl?: string
): Promise<'success' | 'failed' | 'cancelled' | 'pending'> {
  try {
    // Open Xendit hosted checkout browser tab (supports GCash, Maya, Cards, Online Banking)
    await WebBrowser.openBrowserAsync(checkoutUrl, {
      showTitle:             false,
      toolbarColor:         '#F97316',
      enableBarCollapsing: false,
      presentationStyle:     WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });

    console.log('Browser closed — polling for payment status...');
    const status = await pollChargeStatus(chargeId);

    if (status === 'SUCCEEDED') return 'success';
    if (status === 'FAILED')    return 'failed';
    return 'pending';

  } catch (err: any) {
    console.error('openGCashCheckout error:', err.message);

    if (webUrl && checkoutUrl !== webUrl) {
      console.log('Falling back to web URL...');
      try {
        await WebBrowser.openBrowserAsync(webUrl, {
          showTitle:         false,
          toolbarColor:       '#F97316',
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        });
        const status = await pollChargeStatus(chargeId);
        if (status === 'SUCCEEDED') return 'success';
        if (status === 'FAILED')    return 'failed';
        return 'pending';
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
      }
    }

    return 'cancelled';
  }
}
