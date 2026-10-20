import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { centavos, type VerificationResult } from './verify-booking-invoice.ts';

export const subscriptionReference = /^sub_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_(basic|standard|premium)_(\d+)$/i;
const termMs = 30 * 24 * 60 * 60 * 1000;
const receiptColumns = 'id,caterer_id,plan_id,amount,payment_reference,status,confirmed_at';

// These are settled fields from the provider GET, never checkout metadata or
// the callback body. Available payment-method lists are not payment evidence.
export function verifiedSubscriptionPaymentMethod(payment: any): string {
  const token = (value: unknown) => typeof value === 'string'
    ? value.trim().toUpperCase().replace(/[\s-]+/g, '_') : '';
  const channels = [payment?.payment_channel, payment?.channel_code, payment?.ewallet_type].map(token);
  for (const channel of channels) {
    if (['GCASH', 'PH_GCASH'].includes(channel)) return 'gcash';
    if (['MAYA', 'PAYMAYA', 'PH_MAYA', 'PH_PAYMAYA'].includes(channel)) return 'maya';
  }
  const method = token(payment?.payment_method);
  const evidence = [...channels, method];
  if (evidence.some(value => ['CARD', 'CREDIT_CARD', 'DEBIT_CARD', 'VISA', 'MASTERCARD', 'JCB', 'AMEX'].includes(value))) return 'card';
  if (token(payment?.bank_code) || evidence.some(value =>
    ['BANK_TRANSFER', 'VIRTUAL_ACCOUNT', 'ONLINE_BANKING'].includes(value) || value.endsWith('_ONLINE_BANKING'))) return 'bank_transfer';
  // Some invoice responses identify the wallet in payment_method itself.
  if (['GCASH', 'PH_GCASH'].includes(method)) return 'gcash';
  if (['MAYA', 'PAYMAYA', 'PH_MAYA', 'PH_PAYMAYA'].includes(method)) return 'maya';
  // Retain another specifically identified provider channel rather than
  // mislabeling it as an unidentified online payment.
  const specific = evidence.find(value => /^[A-Z][A-Z0-9_]{0,63}$/.test(value)
    && !['ONLINE', 'EWALLET', 'E_WALLET', 'UNKNOWN', 'OTHER', 'NONE'].includes(value));
  if (specific) return specific.toLowerCase();
  return 'online';
}

function matchesReceipt(receipt: any, payment: any, catererId: string, planId: string) {
  return receipt?.caterer_id === catererId && receipt.plan_id === planId
    && receipt.payment_reference === payment.id && receipt.status === 'confirmed'
    && centavos(receipt.amount) === centavos(payment.amount);
}

function matchesTerm(caterer: any, receipt: any) {
  if (typeof receipt?.confirmed_at !== 'string' || typeof caterer?.subscription_expires_at !== 'string') return false;
  const confirmed = Date.parse(receipt.confirmed_at), expires = Date.parse(caterer.subscription_expires_at);
  // Timestamps may retain microseconds in PostgreSQL; JS compares milliseconds.
  return Number.isFinite(confirmed) && Number.isFinite(expires)
    && ['basic','standard','premium'].includes(receipt.plan_id) && centavos(receipt.amount) !== null
    && caterer.subscription_plan === receipt.plan_id && Math.abs(expires - confirmed - termMs) <= 1000;
}

async function confirmActivation(client: SupabaseClient, payment: any, catererId: string, planId: string,
  outcome: 'activated' | 'already_processed'): Promise<VerificationResult> {
  const { data: receipt, error } = await client.from('subscription_payments').select(receiptColumns)
    .eq('payment_reference', payment.id).maybeSingle();
  if (error) return { outcome: 'retry', code: `SUBSCRIPTION_RECEIPT_READ_${error.code ?? 'FAILED'}` };
  if (!receipt) return { outcome: 'retry', code: 'SUBSCRIPTION_RECEIPT_MISSING' };
  if (!matchesReceipt(receipt, payment, catererId, planId)) return { outcome: 'rejected', code: 'SUBSCRIPTION_RECEIPT_CONFLICT' };
  const { data: caterer, error: ownerError } = await client.from('caterers')
    .select('id,user_id,subscription_plan,subscription_expires_at').eq('id', catererId).maybeSingle();
  if (ownerError) return { outcome: 'retry', code: `SUBSCRIPTION_ACTIVATION_READ_${ownerError.code ?? 'FAILED'}` };
  if (!caterer || caterer.user_id !== payment.metadata.user_id) return { outcome: 'rejected', code: 'SUBSCRIPTION_OWNER_MISMATCH' };
  if (matchesTerm(caterer, receipt)) {
    // An expired duplicate must never purchase another 30 days or be retried
    // through the activation RPC. It is historical processed evidence only.
    if (Date.parse(caterer.subscription_expires_at) <= Date.now()) {
      return { outcome: 'ignored', code: 'SUBSCRIPTION_ALREADY_PROCESSED_EXPIRED' };
    }
    return outcome === 'activated' ? { outcome: 'processed', code: 'SUBSCRIPTION_ACTIVATED' }
      : { outcome: 'ignored', code: 'SUBSCRIPTION_ALREADY_PROCESSED' };
  }
  // A later purchase may already have superseded this payment. A delayed
  // duplicate must not overwrite it or be treated as current entitlement.
  const { data: latest, error: latestError } = await client.from('subscription_payments').select(receiptColumns)
    .eq('caterer_id', catererId).eq('status', 'confirmed').order('confirmed_at', { ascending: false }).limit(1).maybeSingle();
  if (latestError) return { outcome: 'retry', code: `SUBSCRIPTION_HISTORY_READ_${latestError.code ?? 'FAILED'}` };
  if (latest?.payment_reference !== payment.id && Date.parse(latest?.confirmed_at) > Date.parse(receipt.confirmed_at)
    && matchesTerm(caterer, latest)) return { outcome: 'ignored', code: 'SUBSCRIPTION_ALREADY_PROCESSED_SUPERSEDED' };
  return { outcome: 'retry', code: 'SUBSCRIPTION_ENTITLEMENT_MISMATCH' };
}

// Only called with authenticated, independently retrieved provider data.
export async function verifySubscriptionPayment(client: SupabaseClient, payment: any): Promise<VerificationResult> {
  const match = typeof payment?.external_id === 'string' && payment.external_id.match(subscriptionReference);
  if (!match || typeof payment.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(payment.id)
    || payment.status !== 'PAID' || payment.currency !== 'PHP' || payment.metadata?.type !== 'subscription'
    || (payment.metadata.caterer_id != null && payment.metadata.caterer_id !== match[1])
    || (payment.metadata.plan_id != null && payment.metadata.plan_id !== match[2])
    || typeof payment.metadata.user_id !== 'string' || !payment.metadata.user_id
    || centavos(payment.amount) === null || centavos(payment.paid_amount) !== centavos(payment.amount)
    || (payment.refunded_amount != null && Number(payment.refunded_amount) !== 0)) {
    return { outcome: 'rejected', code: 'SUBSCRIPTION_PROVIDER_VALIDATION_FAILED' };
  }
  const { data: caterer, error } = await client.from('caterers').select('id,user_id').eq('id', match[1]).maybeSingle();
  if (error) return { outcome: 'retry', code: `SUBSCRIPTION_OWNER_READ_${error.code ?? 'FAILED'}` };
  if (!caterer || caterer.user_id !== payment.metadata.user_id) return { outcome: 'rejected', code: 'SUBSCRIPTION_OWNER_MISMATCH' };
  // Reference uniqueness alone does not prove this caller owns a confirmed
  // receipt or that entitlement activation committed. Check before the RPC's
  // broad existing-reference early return, then re-read after every RPC result.
  const { data: existing, error: receiptError } = await client.from('subscription_payments').select(receiptColumns)
    .eq('payment_reference', payment.id).maybeSingle();
  if (receiptError) return { outcome: 'retry', code: `SUBSCRIPTION_RECEIPT_READ_${receiptError.code ?? 'FAILED'}` };
  if (existing) {
    if (!matchesReceipt(existing, payment, match[1], match[2])) return { outcome: 'rejected', code: 'SUBSCRIPTION_RECEIPT_CONFLICT' };
    return confirmActivation(client, payment, match[1], match[2], 'already_processed');
  }
  const { data: plan, error: planError } = await client.from('subscription_plans').select('id,price').eq('id', match[2]).maybeSingle();
  if (planError) return { outcome: 'retry', code: `SUBSCRIPTION_PLAN_READ_${planError.code ?? 'FAILED'}` };
  if (!plan || centavos(plan.price) !== centavos(payment.amount)) return { outcome: 'rejected', code: 'SUBSCRIPTION_AMOUNT_MISMATCH' };
  // Existing SECURITY DEFINER RPC: one transaction owns receipt insertion,
  // row locking, plan/30-day expiry and existing quota-trigger behavior.
  // Only the webhook's service-role client reaches this call after provider GET.
  const { data: result, error: activationError } = await client.rpc('activate_paid_subscription', {
    p_caterer_id: match[1], p_plan_id: match[2], p_amount: Number(payment.amount),
    p_payment_reference: payment.id, p_payment_method: verifiedSubscriptionPaymentMethod(payment),
  });
  if (activationError) return { outcome: 'retry', code: `SUBSCRIPTION_ACTIVATION_${activationError.code ?? 'FAILED'}` };
  if (result !== 'activated' && result !== 'already_processed') return { outcome: 'retry', code: 'SUBSCRIPTION_ACTIVATION_RESULT_INVALID' };
  return confirmActivation(client, payment, match[1], match[2], result);
}
