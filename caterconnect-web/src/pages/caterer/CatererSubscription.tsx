import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Crown,
  ChevronDown,
  Gift,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Tag,
  ChevronUp,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import CatererPageHeader from '../../components/CatererPageHeader';
import CatererSkeleton from '../../components/CatererSkeleton';
import { supabase } from '../../lib/supabase';
import {
  loadMonthlyBookingQuota,
  type MonthlyQuota,
} from '../../lib/monthBookingQouta';
import './CatererSubscription.css';

type PlanId = 'free' | 'basic' | 'standard' | 'premium';
type Plan = {
  id: PlanId;
  name: string;
  price: number;
  packageLimit: number | null;
  bookingLimit: number | null;
  features: string[];
  icon: typeof Tag;
  accent: string;
  popular?: boolean;
};
type Payment = {
  id: string;
  plan_id: string;
  amount: number | string;
  payment_method: string | null;
  payment_reference: string | null;
  status: string;
  created_at: string;
};
type PaymentFeedback = { kind: 'pending' | 'success' | 'failed' | 'error'; message: string } | null;

// Keep plan content aligned with the existing Mobile subscription screen.
const PLANS: Plan[] = [
  {
    id: 'free', name: 'Free Plan', price: 0, packageLimit: 3, bookingLimit: 5,
    features: ['3 catering packages', '5 accepted bookings/month', 'Basic profile visibility', 'Lower search placement'],
    icon: Tag, accent: '#64748B',
  },
  {
    id: 'basic', name: 'Basic Plan', price: 299, packageLimit: null, bookingLimit: 20,
    features: ['Unlimited packages', '20 accepted bookings/month', 'Higher search visibility', 'Improved Budget Match placement', 'Profile customization'],
    icon: BadgeCheck, accent: '#3B82F6',
  },
  {
    id: 'standard', name: 'Standard Plan', price: 499, packageLimit: null, bookingLimit: 50,
    features: ['All Basic features', '50 accepted bookings/month', 'Featured listing placement', 'Priority Budget Match results', 'Increased promotional visibility'],
    icon: Zap, accent: '#D97706', popular: true,
  },
  {
    id: 'premium', name: 'Premium Plan', price: 999, packageLimit: null, bookingLimit: null,
    features: ['All Standard features', 'Unlimited accepted bookings', 'Featured Caterer Badge', 'Top search placement', '#1 Budget Match ranking', 'Homepage feature placements'],
    icon: Crown, accent: '#7C3AED',
  },
];

const PAYMENT_METHODS = [
  { id: 'gcash', label: 'GCash' },
  { id: 'maya', label: 'Maya' },
  { id: 'bpi', label: 'BPI Online' },
  { id: 'bdo', label: 'BDO Online' },
  { id: 'card', label: 'Credit / Debit Card' },
];

const currency = (amount: number | string) => Number(amount).toLocaleString('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 2,
});

function formatDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Unavailable';
  return new Date(value).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila',
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function isXenditCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'xendit.co' || url.hostname.endsWith('.xendit.co'));
  } catch {
    return false;
  }
}

async function waitForVerifiedPayment(chargeId: string): Promise<'success' | 'failed' | 'pending'> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 3000));
    const { data, error } = await supabase.functions.invoke('xendit-check-status', {
      body: { chargeId },
    });
    if (error) continue;
    if (data?.databaseConfirmed === true && ['SUCCEEDED', 'PAID'].includes(data.status)) return 'success';
    if (['FAILED', 'VOIDED', 'EXPIRED'].includes(data?.status)) return 'failed';
  }
  return 'pending';
}

export default function CatererSubscription() {
  const { session, profile, catererData, reloadAccount } = useAuth();
  const [history, setHistory] = useState<Payment[]>([]);
  const [quota, setQuota] = useState<MonthlyQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<PaymentFeedback>(null);
  const [showSubscriptionInfo, setShowSubscriptionInfo] = useState(false);

  const currentPlanId = (catererData?.subscription_plan?.toLowerCase() ?? 'free') as PlanId;
  const currentPlan = PLANS.find((plan) => plan.id === currentPlanId) ?? PLANS[0];
  const isExpired = currentPlanId !== 'free' && (!catererData?.subscription_expires_at || Date.parse(catererData.subscription_expires_at) <= Date.now());
  const expiresAt = catererData?.subscription_expires_at ?? null;

  const refreshData = useCallback(async (showSpinner = false) => {
    if (!catererData?.id || !session?.user.id) {
      setHistory([]);
      setQuota({ status: 'unavailable', message: 'Caterer account details are unavailable.' });
      setLoading(false);
      return;
    }
    if (showSpinner) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [payments, usage] = await Promise.all([
        supabase.from('subscription_payments').select('id,plan_id,amount,payment_method,payment_reference,status,created_at')
          .eq('caterer_id', catererData.id).order('created_at', { ascending: false }).limit(10),
        loadMonthlyBookingQuota(catererData.id, session.user.id),
      ]);
      if (payments.error) throw payments.error;
      setHistory((payments.data ?? []) as Payment[]);
      setQuota(usage);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setQuota({ status: 'unavailable', message: 'Monthly booking usage could not be loaded.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [catererData?.id, session?.user.id]);

  useEffect(() => { void refreshData(); }, [refreshData]);

  const usageLabel = useMemo(() => {
    if (!quota) return 'Loading usage';
    if (quota.status !== 'ready') return quota.message;
    return `${quota.used} / ${quota.limit ?? 'Unlimited'} accepted bookings`;
  }, [quota]);

  async function startCheckout() {
    if (!selectedPlan || !catererData?.id || !session?.user || !profile) {
      setFeedback({ kind: 'error', message: 'Your caterer account information is unavailable. Refresh and try again.' });
      return;
    }
    if (selectedPlan.id === 'free') return;

    // Open synchronously from the click event so browsers do not block the hosted checkout popup.
    const checkoutWindow = window.open('about:blank', '_blank');
    if (!checkoutWindow) {
      setFeedback({ kind: 'error', message: 'Your browser blocked the checkout window. Allow pop-ups for this site and try again.' });
      return;
    }

    setPaying(true);
    setFeedback({ kind: 'pending', message: 'Preparing secure checkout…' });
    try {
      const referenceId = `sub_${catererData.id}_${selectedPlan.id}_${Date.now()}`;
      const { data, error: checkoutError } = await supabase.functions.invoke('xendit-payment', {
        body: {
          type: 'subscription', amount: selectedPlan.price, referenceId,
          customerName: profile.full_name, customerEmail: session.user.email ?? '',
          description: `CaterConnect ${selectedPlan.name} Monthly Subscription`,
          paymentMethod,
        },
      });
      if (checkoutError) throw checkoutError;
      if (!isXenditCheckoutUrl(data?.checkoutUrl) || typeof data?.chargeId !== 'string') {
        throw new Error(data?.error ?? 'The payment service returned an invalid checkout response.');
      }

      checkoutWindow.location.replace(data.checkoutUrl);
      setFeedback({ kind: 'pending', message: 'Checkout opened. Keep this page open while Xendit processes your payment.' });
      const outcome = await waitForVerifiedPayment(data.chargeId);

      if (outcome === 'success') {
        await reloadAccount();
        await refreshData(true);
        setFeedback({ kind: 'success', message: 'Payment confirmed by the server. Your subscription details have been refreshed.' });
        setSelectedPlan(null);
      } else if (outcome === 'failed') {
        setFeedback({ kind: 'failed', message: 'The payment was not completed. Your subscription has not been changed.' });
      } else {
        setFeedback({ kind: 'pending', message: 'Payment confirmation is still pending. Do not pay again while it is processing. Refresh this page later to check your plan.' });
      }
    } catch (checkoutFailure) {
      checkoutWindow.close();
      setFeedback({ kind: 'error', message: getErrorMessage(checkoutFailure) });
    } finally {
      setPaying(false);
    }
  }

  const CurrentIcon = currentPlan.icon;

  return (
    <div className="caterer-subscription-page">
      <CatererPageHeader
        icon={<CreditCard size={24} />}
        title="Plans & Billing"
        description="Manage your plan, booking allowance, and subscription payments."
        action={<button type="button" className="subscription-refresh" onClick={() => void refreshData(true)} disabled={refreshing || loading}>
          {refreshing ? <LoaderCircle size={16} className="subscription-spin" /> : <RefreshCw size={16} />} Refresh
        </button>}
      />

      {feedback && <div className={`subscription-feedback ${feedback.kind}`} role="status">
        {feedback.kind === 'success' ? <CheckCircle2 size={18} /> : feedback.kind === 'pending' ? <Clock3 size={18} /> : <AlertCircle size={18} />}
        <span>{feedback.message}</span>
        <button type="button" aria-label="Dismiss message" onClick={() => setFeedback(null)}>×</button>
      </div>}

      {error && <div className="subscription-feedback error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}

      {loading ? (
        <section className="subscription-current subscription-current-loading" aria-label="Loading current subscription">
          <CatererSkeleton variant="subscription-current" label="Loading current subscription details" />
        </section>
      ) : <section className="subscription-current" aria-label="Current subscription">
        <div className="subscription-current-top">
          <span className="subscription-eyebrow">CURRENT PLAN</span>
          <span className={`subscription-state ${isExpired ? 'expired' : 'active'}`}>{isExpired ? 'Expired · Free booking quota' : 'Active'}</span>
        </div>
        <div className="subscription-current-main">
          <span className="subscription-current-icon" style={{ color: currentPlan.accent, backgroundColor: `${currentPlan.accent}16` }}><CurrentIcon size={24} /></span>
          <div><h2>{currentPlan.name}</h2><p>{currentPlan.price === 0 ? 'No monthly fee' : `${currency(currentPlan.price)} / month`}</p></div>
        </div>
        <div className="subscription-current-meta">
          <div><span>Monthly accepted bookings</span><strong>{loading ? 'Loading…' : usageLabel}</strong></div>
          <div><span>Package allowance</span><strong>{isExpired ? 'Free limit unverified' : `${currentPlan.packageLimit ?? 'Unlimited'}${currentPlan.packageLimit === 1 ? ' package' : currentPlan.packageLimit ? ' packages' : ''}`}</strong></div>
          <div><span>{currentPlanId === 'free' ? 'Plan status' : 'Expires on'}</span><strong>{currentPlanId === 'free' ? 'Free plan' : formatDate(expiresAt)}</strong></div>
        </div>
        {quota?.status === 'ready' && quota.limit !== null && <div className="subscription-progress" role="progressbar" aria-valuenow={Math.min(100, quota.used / Math.max(1, quota.limit) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly accepted booking usage">
          <span style={{ width: `${Math.min(100, quota.used / Math.max(1, quota.limit) * 100)}%` }} />
        </div>}
        {quota?.status !== 'ready' && !loading && <p className="subscription-muted">{quota?.message ?? 'Usage unavailable.'} Quota enforcement remains server controlled.</p>}
      </section>}

      <div className="subscription-section-heading"><div><h2>Choose a plan</h2><p>Paid plans are active only after server-side payment verification.</p></div></div>
      <div className="subscription-plan-grid">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = plan.id === currentPlanId;
          return <article className={`subscription-plan-card ${isCurrent ? 'current' : ''} ${plan.popular ? 'popular' : ''}`} key={plan.id} style={{ '--plan-accent': plan.accent } as React.CSSProperties}>
            {plan.popular && <span className="subscription-popular">MOST POPULAR</span>}
            {isCurrent && <span className="subscription-current-badge">CURRENT PLAN</span>}
            <div className="subscription-plan-title"><span><Icon size={22} /></span><h3>{plan.name}</h3></div>
            <div className="subscription-price">{plan.price === 0 ? <strong>FREE</strong> : <><strong>{currency(plan.price)}</strong><small>/ month</small></>}</div>
            <p className="subscription-limit-line">{plan.packageLimit === null ? 'Unlimited packages' : `${plan.packageLimit} package records`}</p>
            <p className="subscription-limit-line">{plan.bookingLimit === null ? 'Unlimited accepted bookings' : `${plan.bookingLimit} accepted bookings / month`}</p>
            <ul>{plan.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
            {plan.id === 'free' ? <button type="button" className="subscription-plan-button secondary" disabled>{isCurrent ? 'Current Plan' : 'Free Plan'}</button>
              : <button type="button" className="subscription-plan-button" onClick={() => { setSelectedPlan(plan); setFeedback(null); }} disabled={isCurrent || paying}>{isCurrent ? 'Current Plan' : `Select ${plan.name}`}</button>}
          </article>;
        })}
      </div>

      <section className="subscription-information" aria-labelledby="subscription-information-title">
        <button
          type="button"
          className="subscription-information-toggle"
          id="subscription-information-title"
          aria-expanded={showSubscriptionInfo}
          aria-controls="subscription-information-panel"
          onClick={() => setShowSubscriptionInfo((open) => !open)}
        >
          <span><strong>Subscription Information</strong><small>Plans, limits, expiration, and renewal details</small></span>
          {showSubscriptionInfo ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
        </button>
        <div
          className={`subscription-information-panel ${showSubscriptionInfo ? 'open' : ''}`}
          id="subscription-information-panel"
          aria-hidden={!showSubscriptionInfo}
        >
        <div className="subscription-information-content">
          <div className="subscription-policy-note" role="note">
            <AlertCircle size={18} />
            <p><strong>Current implementation:</strong> the available backend source applies the Free booking quota of 5 when a paid plan’s expiry has passed. It does not show a scheduled update that changes the saved plan field to <code>free</code>. The package-limit function in the available metadata checks the saved plan field without checking expiry, so automatic application of the Free 3-package limit after expiry is not confirmed. This page does not simulate either backend change.</p>
          </div>

          <h3>How monthly subscriptions work</h3>
          <p>Free includes 3 package records and 5 accepted bookings per month. Basic is ₱299 per month with unlimited packages and 20 accepted bookings. Standard is ₱499 per month with unlimited packages and 50 accepted bookings. Premium is ₱999 per month with unlimited packages and accepted bookings.</p>
          <p>Paid plans become active after CaterConnect verifies the payment. The available activation function sets a 30-day subscription period from the time the payment is confirmed. Pending, cancelled, or unsuccessful payments do not activate or extend a paid plan.</p>

          <h3>Subscription expiration</h3>
          <p>The expiration date indicates when paid subscription access ends. The available booking-quota function applies the Free allowance of 5 accepted bookings per month at or after expiry, while the saved plan field can remain set to its previous paid plan. A scheduled database downgrade was not found in the inspected source. Renewals are verified through the payment workflow; the activation function sets expiry to 30 days from confirmation rather than adding time to an existing expiry.</p>

          <h3>After a paid plan expires</h3>
          <ul>
            <li>Existing bookings and payment records are not deleted by the inspected subscription activation logic; expiry alone is not shown cancelling accepted bookings.</li>
            <li>Existing package records are not deleted by the inspected subscription code. The available package-limit metadata does not check subscription expiry, so the Free package limit after expiry requires backend confirmation or work.</li>
            <li>The displayed booking usage is informational; booking eligibility is enforced by the backend.</li>
            <li>You may select a paid plan again. Paid access is shown only after server-side payment verification confirms it.</li>
          </ul>

          <h3>Subscription Plan Terms and Conditions</h3>
          <ol>
            <li>Caterers may select an available subscription plan based on their business needs.</li>
            <li>The displayed price applies to the subscription period shown on the plan.</li>
            <li>A paid plan is activated or extended only after CaterConnect verifies payment.</li>
            <li>When a paid plan expires without a verified renewal, the booking quota uses the Free allowance in the available backend implementation. A complete automatic Free-plan downgrade, including package limits, is not confirmed.</li>
            <li>Plan limits are subject to the platform’s applicable rules and backend enforcement.</li>
            <li>Subscription expiration alone does not cancel bookings that have already been accepted or confirmed.</li>
            <li>Existing packages are not automatically deleted solely because a subscription expires. Package-limit enforcement after expiry is not confirmed by the available backend source.</li>
            <li>This page displays up to the 10 most recent payment records returned by the backend. Longer-term record retention is not established by the inspected client implementation.</li>
            <li>Caterers are responsible for reviewing subscription status and selecting a paid plan again when needed.</li>
            <li>By selecting and purchasing a plan, you acknowledge that you have reviewed its displayed price, features, limits, period, and expiration information.</li>
          </ol>
        </div>
        </div>
      </section>

      {selectedPlan && <div className="subscription-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !paying) setSelectedPlan(null); }}>
        <section className="subscription-modal" role="dialog" aria-modal="true" aria-labelledby="subscription-checkout-title">
          <button type="button" className="subscription-modal-close" onClick={() => setSelectedPlan(null)} disabled={paying} aria-label="Close">×</button>
          <span className="subscription-modal-icon"><ShieldCheck size={25} /></span>
          <h2 id="subscription-checkout-title">Confirm your plan</h2>
          <p className="subscription-modal-subtitle">Subscription activation follows server-side payment verification.</p>
          <div className="subscription-order-summary"><span>{selectedPlan.name}</span><strong>{currency(selectedPlan.price)} / month</strong></div>
          <label className="subscription-method-label" htmlFor="subscription-payment-method">Payment method</label>
          <select id="subscription-payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={paying}>
            {PAYMENT_METHODS.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}
          </select>
          <button type="button" className="subscription-checkout-button" onClick={() => void startCheckout()} disabled={paying}>
            {paying ? <><LoaderCircle size={17} className="subscription-spin" /> Waiting for confirmation…</> : `Continue to payment · ${currency(selectedPlan.price)}`}
          </button>
          <p className="subscription-secure-note"><ShieldCheck size={15} /> Your plan changes only after the server confirms payment.</p>
        </section>
      </div>}

      <section className="subscription-history">
        <div className="subscription-section-heading"><div><h2>Payment history</h2><p>Recent subscription transactions</p></div></div>
        {loading ? <CatererSkeleton variant="subscription-history" label="Loading subscription payment history" /> : history.length === 0 ? <div className="subscription-history-empty"><Gift size={22} /><span>No subscription transactions yet.</span></div> : <div className="subscription-history-table-wrap"><table className="subscription-history-table"><thead><tr><th>Plan</th><th>Date</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody>
          {history.map((payment) => <tr key={payment.id}><td>{payment.plan_id.toUpperCase()} Plan</td><td>{formatDate(payment.created_at)}</td><td>{payment.payment_method?.replaceAll('_', ' ').toUpperCase() || 'ONLINE'}</td><td>{currency(payment.amount)}</td><td><span className={`subscription-payment-status ${payment.status}`}>{payment.status}</span></td></tr>)}
        </tbody></table></div>}
      </section>
      <p className="subscription-footnote"><ShieldCheck size={15} /> Payment status and plan eligibility are verified by the server. Displayed usage is informational.</p>
    </div>
  );
}
