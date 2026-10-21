// app/(tabs)/CustomerBookings.tsx
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useBookingRefresh } from '../../hooks/useBookingRefresh';
import { initiateGCashPayment, openGCashCheckout } from '../../lib/xendit';
import ReviewScreen from '../../screens/auth/ReviewScreen';
import ChatScreen from '../../screens/auth/ChatScreen';
import {
  Clock, CheckCircle2, CreditCard, RefreshCw, PartyPopper,
  XCircle, Ban, ClipboardList, MapPin, AlertTriangle, MessageSquare, Star, AlertCircle, Check, Wallet, Smartphone, Building2, ShieldCheck, Lock, CalendarDays, Users, Package, UtensilsCrossed, FileText, Hash, ReceiptText, Info, ChevronRight, X, Gift, ListChecks
} from 'lucide-react-native';

type Booking = {
  id: string; status: string;
  event_date: string; event_type: string | null;
  guest_count: number; total_cost: number;
  downpayment_amount: number; downpayment_deadline: string | null;
  venue: string | null; created_at: string;
  rejection_reason: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  payment_method: string | null;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
  payment_receipt_url: string | null;
  // --- Refund Tracking Fields ---
  refund_status: 'none' | 'pending' | 'overdue' | 'awaiting_customer_confirmation' | 'processed' | 'failed';
  refund_amount: number;
  refunded_at: string | null;
  refund_account_details: string | null;
  caterer_notes: string | null;
  caterers: { 
    business_name: string; 
    logo_url: string | null; 
    city: string | null; 
    user_id: string;
    accepted_payment_methods?: string[] | null;
    accepted_payment_details?: Record<string, string> | null;
  } | null;
  packages: { name: string; tier: string; [key: string]: any } | null;
  customized_items?: unknown;
  special_requests?: string | null;
};

// Display only the payment channel recorded on the verified booking.
// Never guess GCash, card or another channel when the provider did not record one.
const displayXenditPaymentMethod = (method: string | null | undefined): string => {
  const normalized = (method ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const labels: Record<string, string> = {
    gcash: 'GCash', maya: 'Maya', paymaya: 'Maya',
    bpi: 'BPI Online Banking', bdo: 'BDO Online Banking',
    card: 'Credit / Debit Card', credit_card: 'Credit / Debit Card',
    debit_card: 'Credit / Debit Card',
    bank: 'Bank Transfer', bank_transfer: 'Bank Transfer',
    ewallet: 'E-Wallet', e_wallet: 'E-Wallet',
  };
  if (!normalized || ['online', 'online_gateway', 'xendit', 'unknown'].includes(normalized)) {
    return 'Payment method not recorded';
  }
  return labels[normalized] ?? method!.trim();
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:   { label: 'Pending Review',   color: '#B45309', bg: '#FEF3C7', icon: Clock },
  confirmed: { label: 'Confirmed',        color: '#15803D', bg: '#DCFCE7', icon: CheckCircle2 },
  paid:      { label: 'Payment Verified', color: '#15803D', bg: '#DCFCE7', icon: CheckCircle2 },
  ongoing:   { label: 'Event Ongoing',    color: '#D97706', bg: '#FFFBEB', icon: RefreshCw },
  completed: { label: 'Completed',        color: '#15803D', bg: '#DCFCE7', icon: PartyPopper },
  rejected:  { label: 'Rejected',         color: '#B91C1C', bg: '#FEE2E2', icon: XCircle },
  cancelled: { label: 'Cancelled',        color: '#4B5563', bg: '#F3F4F6', icon: Ban },
};

const PAYMENT_CHANNEL_CONFIG: Record<string, { label: string; sub: string; icon: any }> = {
  gcash: { label: 'GCash', sub: 'Instant E-Wallet', icon: Smartphone },
  maya: { label: 'Maya', sub: 'E-Wallet / QR', icon: Wallet },
  bpi: { label: 'BPI Online', sub: 'Bank Transfer', icon: Building2 },
  bdo: { label: 'BDO Online', sub: 'Bank Transfer', icon: Building2 },
  card: { label: 'Credit / Debit Card', sub: 'Visa, Mastercard, JCB', icon: CreditCard },
};

const FILTERS = ['all', 'pending', 'confirmed', 'paid', 'ongoing', 'completed', 'rejected', 'cancelled'];

const REFUND_METHODS = [
  { key: 'gcash', label: 'GCash', type: 'wallet' },
  { key: 'maya', label: 'Maya', type: 'wallet' },
  { key: 'bpi', label: 'BPI', type: 'bank' },
  { key: 'bdo', label: 'BDO', type: 'bank' },
  { key: 'other_bank', label: 'Other Bank', type: 'bank' },
] as const;

type RefundMethod = (typeof REFUND_METHODS)[number]['key'];

const CANCELLATION_REASONS = [
  "Event date changed",
  "Found another caterer",
  "Budget constraints",
  "Event was cancelled entirely",
  "Other"
];

// ── Customer Cancellation Refund Policy Helpers (Step 1) ──
// Compare calendar dates rather than elapsed hours, so event-date tiers
// remain stable across daylight-saving changes.
const getDaysBeforeEvent = (eventDateString: string): number => {
  const [year, month, day] = eventDateString
    .slice(0, 10)
    .split('-')
    .map(Number);

  const eventDay = Date.UTC(year, month - 1, day);
  const today = new Date();
  const todayDay = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  return Math.round((eventDay - todayDay) / (1000 * 60 * 60 * 24));
};

const getCancellationRefundPercentage = (
  eventDate: string,
  paymentVerifiedAt: string | null
): number => {
  const daysBeforeEvent = getDaysBeforeEvent(eventDate);

  // Cancellations fewer than 7 calendar days before the event
  // are non-refundable, including during the grace period.
  if (daysBeforeEvent < 7) return 0;

  // Grace period: within 24 hours after payment verification.
  if (paymentVerifiedAt) {
    const verifiedTime = new Date(paymentVerifiedAt).getTime();
    const elapsedHours = (Date.now() - verifiedTime) / (1000 * 60 * 60);

    if (Number.isFinite(elapsedHours) && elapsedHours >= 0 && elapsedHours <= 24) {
      return 100;
    }
  }

  if (daysBeforeEvent >= 30) return 100;
  if (daysBeforeEvent >= 15) return 75;
  if (daysBeforeEvent >= 8) return 50;
  return 25; // Exactly 7 calendar days before the event.
};

const calculateCancellationRefund = (
  verifiedDownpayment: number,
  percentage: number
): number => {
  return Math.round(Number(verifiedDownpayment) * percentage) / 100;
};

// ── Countdown Helper ──
const getCountdownText = (eventDateString: string) => {
  if (!eventDateString) return '';
  const eventDate = new Date(eventDateString);
  const today = new Date();
  eventDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffTime = eventDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Event has passed';
  if (diffDays === 0) return '🎉 Event is TODAY!';
  if (diffDays === 1) return '⏳ 1 day left';
  return `⏳ ${diffDays} days left`;
};

// ── Status Timeline Component ──
function BookingTimeline({ status }: { status: string }) {
  const getStepIndex = (st: string) => {
    switch (st) {
      case 'pending': return 0;
      case 'confirmed': return 1;
      case 'paid':
      case 'ongoing': return 2;
      case 'completed': return 3;
      case 'rejected':
      case 'cancelled': return -1;
      default: return 0;
    }
  };

  const currentStep = getStepIndex(status);
  if (currentStep === -1) return null; 

  const steps = ['Requested', 'Confirmed', 'Paid', 'Event Day'];

  return (
    <View style={tl.wrap}>
      {steps.map((label, i) => {
        const active = i === currentStep;
        const done = i < currentStep;
        return (
          <View key={label} style={tl.stepWrap}>
            <View style={[tl.circle, active && tl.circleActive, done && tl.circleDone]}>
              {done ? (
                <Check size={10} color={Colors.white} strokeWidth={3} />
              ) : (
                <Text style={[tl.circleText, active && tl.circleTextActive]}>{i + 1}</Text>
              )}
            </View>
            <Text style={[tl.label, active && tl.labelActive]} numberOfLines={1}>{label}</Text>
            {i < steps.length - 1 && (
              <View style={[tl.line, done && tl.lineDone]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const tl = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  stepWrap: { alignItems: 'center', flex: 1, position: 'relative' },
  circle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginBottom: 4, zIndex: 2 },
  circleActive: { backgroundColor: Colors.orange },
  circleDone: { backgroundColor: '#10B981' },
  circleText: { fontSize: 10, fontWeight: '800', color: '#9CA3AF' },
  circleTextActive: { color: Colors.white },
  label: { fontSize: 9, fontWeight: '700', color: Colors.textSecondary, textAlign: 'center' },
  labelActive: { color: Colors.orange, fontWeight: '900' },
  line: { position: 'absolute', top: 11, left: '50%', right: '-50%', height: 2, backgroundColor: '#E5E7EB', zIndex: 1 },
  lineDone: { backgroundColor: '#10B981' },
});

const formatRefundDestination = (raw: string | null): string => {
  if (!raw) return 'Not provided';
  try {
    const details = JSON.parse(raw);
    if (!details || typeof details !== 'object' || Array.isArray(details)) return raw;
    const labels: Record<string, string> = {
      gcash: 'GCash', maya: 'Maya', bpi: 'BPI', bdo: 'BDO', other_bank: 'Other Bank',
    };
    const methodKey = String(details.method ?? '').toLowerCase();
    const method = labels[methodKey] ?? String(details.method ?? 'Refund account');
    const holder = details.account_holder ?? details.account_holder_name ?? details.account_name ?? '';
    const account = details.account_number ?? details.mobile_number ?? '';
    const bank = details.bank_name ?? '';
    return [
      `Payment Method: ${method}`,
      ...(methodKey === 'other_bank' && bank ? [`Bank Name: ${bank}`] : []),
      ...(holder ? [`Account Holder: ${holder}`] : []),
      ...(account ? [`${methodKey === 'gcash' || methodKey === 'maya' ? 'Mobile Number' : 'Account Number'}: ${account}`] : []),
    ].join('\\n'.replace('\\n', '\n'));
  } catch {
    return raw;
  }
};

const describePackageField = (value: unknown): string[] => {
  if (value == null || value === '') return [];
  let parsed: unknown = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return [String(parsed)]; }
  }
  if (Array.isArray(parsed)) return parsed.flatMap(describePackageField);
  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const title = obj.name ?? obj.item_name ?? obj.menu_item_name ?? obj.title;
    if (title != null) {
      const quantity = obj.quantity ?? obj.qty;
      return [String(title) + (quantity != null ? ` (x${quantity})` : '')];
    }
    return Object.entries(obj).flatMap(([key, val]) =>
      val == null ? [] : [`${key.replace(/_/g, ' ')}: ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`]
    );
  }
  return [String(parsed)];
};

export default function CustomerBookings() {
  const { session } = useAuth();
  const router = useRouter();
  const { id: notificationBookingId, notification_id: notificationId } = useLocalSearchParams<{ id?: string; notification_id?: string }>();
  const lastOpenedNotification = useRef<string | null>(null);
  const [refundEvidence, setRefundEvidence] = useState<Record<string, boolean>>({});
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [transferEvidence, setTransferEvidence] = useState<any[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [refundDisputes, setRefundDisputes] = useState<Record<string, { status: string; reason: string; created_at: string; caterer_response: string | null; caterer_responded_at: string | null }>>({});
  const [disputeBooking, setDisputeBooking] = useState<Booking | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const [confirmingRefundId, setConfirmingRefundId] = useState<string | null>(null);
  const [bookings, setBookings]            = useState<Booking[]>([]);
  const [loading, setLoading]              = useState(true);
  const [filter, setFilter]                = useState('all');
  
  // Payment Modal States
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('gcash');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [reviewBooking, setReviewBooking]   = useState<Booking | null>(null);
  const [chatBooking, setChatBooking]       = useState<Booking | null>(null);

  // Cancellation State
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [refundAccount, setRefundAccount] = useState(''); 
  // Refund destination fields, saved with the cancellation request.
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('gcash');
  const [refundHolderName, setRefundHolderName] = useState('');
  const [refundAccountNumber, setRefundAccountNumber] = useState('');
  const [refundBankName, setRefundBankName] = useState('');

  const [isCancelling, setIsCancelling] = useState(false);

  // Refund destination after a caterer-initiated emergency cancellation.
  const [refundDestinationBooking, setRefundDestinationBooking] = useState<Booking | null>(null);
  const [savingRefundDestination, setSavingRefundDestination] = useState(false);
  const [emergencyRefundMethod, setEmergencyRefundMethod] = useState<RefundMethod>('gcash');
  const [emergencyRefundHolder, setEmergencyRefundHolder] = useState('');
  const [emergencyRefundNumber, setEmergencyRefundNumber] = useState('');
  const [emergencyRefundBank, setEmergencyRefundBank] = useState('');

  const submitEmergencyRefundDestination = async () => {
    if (!refundDestinationBooking || savingRefundDestination || !session?.user?.id) return;
    const holder = emergencyRefundHolder.trim();
    const account = emergencyRefundNumber.trim();
    const bank = emergencyRefundBank.trim();
    const wallet = emergencyRefundMethod === 'gcash' || emergencyRefundMethod === 'maya';
    if (!holder || !account || (emergencyRefundMethod === 'other_bank' && !bank)) {
      Alert.alert('Missing information', 'Provide the account holder, number, and bank name if needed.');
      return;
    }
    if (holder.length > 120 || bank.length > 120 ||
      (wallet ? !/^09\d{9}$/.test(account) : !/^\d{6,20}$/.test(account))) {
      Alert.alert('Invalid refund account', wallet
        ? 'Use an 11-digit Philippine mobile number starting with 09.'
        : 'Use a 6–20 digit bank account number, and keep names below 120 characters.');
      return;
    }
    setSavingRefundDestination(true);
    try {
      const { error } = await supabase.rpc('submit_emergency_refund_account', {
        p_booking_id: refundDestinationBooking.id,
        p_account_details: {
          method: emergencyRefundMethod,
          bank_name: emergencyRefundMethod === 'other_bank' ? bank
            : emergencyRefundMethod === 'bpi' ? 'BPI'
            : emergencyRefundMethod === 'bdo' ? 'BDO' : null,
          account_holder: holder,
          account_number: account,
        },
      });
      if (error) throw error;
      setRefundDestinationBooking(null);
      setEmergencyRefundHolder('');
      setEmergencyRefundNumber('');
      setEmergencyRefundBank('');
      setEmergencyRefundMethod('gcash');
      Alert.alert('Refund account submitted', 'The caterer can now view your refund destination and arrange the transfer. Do not share an OTP or PIN.');
      await load(true);
    } catch (e: any) {
      Alert.alert('Could not submit refund account', e?.message ?? 'Please retry.');
    } finally {
      setSavingRefundDestination(false);
    }
  };
  // Caterer Cancelled Direct Refund Input State

  const loadScope = useRef('');
  loadScope.current = `${session?.user.id ?? ''}:${filter}`;
  const loadVersion = useRef(0);
  const load = async (silent = false) => {
    const scope = loadScope.current;
    const version = ++loadVersion.current;
    const isCurrent = () => scope === loadScope.current && version === loadVersion.current;
    if (!session?.user?.id) return;
    if (!silent) setLoading(true);
    let query = supabase
      .from('bookings')
      .select(`
        *,
        caterers(id, business_name, logo_url, city, user_id, accepted_payment_methods, accepted_payment_details),
        packages(*),
        reviews(id)
      `)
      .eq('customer_id', session.user.id)
      .order('created_at', { ascending: false });
    
    if (filter !== 'all') query = query.eq('status', filter);
    const { data, error: bookingLoadError } = await query;
    if (!isCurrent()) return;
    if (bookingLoadError) { setLoading(false); return; }
    let fetchedBookings = (data as any) ?? [];

    // Payment deadline enforcement must run on a trusted backend job.
    // Never mutate booking status while loading a customer screen.

    // Customer can see whether a transfer receipt was submitted, not its private contents.
    const pendingIds = fetchedBookings
      .filter((b: Booking) => b.status === 'cancelled' && b.refund_status === 'awaiting_customer_confirmation')
      .map((b: Booking) => b.id);
    if (pendingIds.length) {
      const { data: evidenceRows, error: evidenceError } = await supabase
        .from('refund_transfer_submissions')
        .select('booking_id')
        .in('booking_id', pendingIds);
      if (!isCurrent()) return;
      if (evidenceError) {
        console.warn('Could not load refund submission status:', evidenceError.message);
        setRefundEvidence({});
      } else {
        setRefundEvidence(Object.fromEntries((evidenceRows ?? []).map(row => [row.booking_id, true])));
      }
    } else {
      setRefundEvidence({});
    }

    const disputeBookingIds = fetchedBookings
      .filter((b: Booking) => b.status === 'cancelled' && Number(b.refund_amount) > 0)
      .map((b: Booking) => b.id);
    if (disputeBookingIds.length) {
      const { data: disputeRows, error: disputeError } = await supabase
        .from('refund_disputes')
        .select('booking_id, status, reason, created_at, caterer_response, caterer_responded_at')
        .in('booking_id', disputeBookingIds);
      if (!isCurrent()) return;
      if (disputeError) console.warn('Unable to load refund disputes:', disputeError.message);
      setRefundDisputes(Object.fromEntries(
        (disputeRows ?? []).map(row => [row.booking_id, { status: row.status, reason: row.reason, created_at: row.created_at, caterer_response: row.caterer_response, caterer_responded_at: row.caterer_responded_at }])
      ));
    } else {
      setRefundDisputes({});
    }

    setBookings(fetchedBookings);
    // Keep an open details sheet current even when a status filter removes the
    // booking from the visible list. This only reads the authorized booking.
    if (detailBooking) {
      const { data: current } = await supabase.from('bookings')
        .select('*, caterers(id, business_name, logo_url, city, user_id, accepted_payment_methods, accepted_payment_details), packages(*), reviews(id)')
        .eq('id', detailBooking.id).eq('customer_id', session.user.id).maybeSingle();
      if (!isCurrent()) return;
      if (current) setDetailBooking(previous => previous?.id === current.id ? current as Booking : previous);
    }
    setLoading(false);
  };

  useBookingRefresh(session?.user.id ? `${session.user.id}:${filter}` : null, () => load(true));

  useEffect(() => {
    const bookingId = Array.isArray(notificationBookingId) ? notificationBookingId[0] : notificationBookingId;
    const notificationKey = Array.isArray(notificationId) ? notificationId[0] : notificationId;
    if (!session?.user?.id || !bookingId) return;
    const key = notificationKey ?? bookingId;
    if (lastOpenedNotification.current === key) return;
    lastOpenedNotification.current = key;
    let cancelled = false;

    // Fetch independently of the current booking filter so even a cancelled
    // refund booking opens while another filter is selected.
    const openFromNotification = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, caterers(id, business_name, logo_url, city, user_id, accepted_payment_methods, accepted_payment_details), packages(*), reviews(id)')
        .eq('id', bookingId)
        .eq('customer_id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        Alert.alert('Booking unavailable', 'This booking could not be opened. It may no longer be accessible.');
        return;
      }
      await openBookingDetails(data as Booking);
    };

    void openFromNotification();
    return () => { cancelled = true; };
  }, [notificationBookingId, notificationId, session?.user?.id]);



  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  const deadlinePassed = (d: string | null) =>
    d ? new Date(d) < new Date() : false;

  const handleProcessPayment = async () => {
    if (!payingBookingId) return;
    const targetBooking = bookings.find(b => b.id === payingBookingId);
    if (!targetBooking) return;

    setIsProcessingPayment(true);

    try {
      const paymentResult = await initiateGCashPayment({
        type: 'booking',
        amount: Number(targetBooking.downpayment_amount),
        referenceId: `booking_${targetBooking.id}_${Date.now()}`,
        customerName: session?.user?.user_metadata?.full_name || session?.user?.email || 'Customer',
        customerEmail: session?.user?.email || '',
        description: `Downpayment for Booking #${targetBooking.id.slice(0, 8)}`,
        paymentMethod: selectedPaymentMethod,
      });

      if (!paymentResult.success || !paymentResult.checkoutUrl || !paymentResult.chargeId) {
        throw new Error(paymentResult.error || 'Failed to initialize Xendit checkout.');
      }

      const checkoutStatus = await openGCashCheckout(
        paymentResult.checkoutUrl,
        paymentResult.chargeId,
        paymentResult.webUrl
      );

      if (checkoutStatus === 'success') {
        // The mobile client never verifies or marks a booking as paid.
        // Only the trusted Xendit webhook can update payment status.
        setPayingBookingId(null);
        await load();
        Alert.alert(
          'Payment Confirmed',
          'Your downpayment has been verified and saved to your booking.'
        );
      } else if (checkoutStatus === 'failed') {
        Alert.alert('Payment Failed', 'The Xendit transaction failed or was declined.');
      } else if (checkoutStatus === 'pending') {
        setPayingBookingId(null);
        await load();
        Alert.alert('Payment Processing', 'Confirmation is still pending. Your bookings will refresh automatically. Do not pay again while confirmation is pending.');
      } else {
        Alert.alert('Payment Cancelled', 'The payment session was closed or cancelled.');
      }
    } catch (err: any) {
      Alert.alert('Payment Error', err.message || 'An unexpected error occurred.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Cancellation preview; the same policy is recalculated before saving.
  const getCancellationPreview = (booking: Booking | null) => {
    if (!booking) return null;

    const daysBeforeEvent = getDaysBeforeEvent(booking.event_date);
    const hasVerifiedPayment =
      booking.status === 'paid' && !!booking.payment_verified_at;
    const percentage = hasVerifiedPayment
      ? getCancellationRefundPercentage(
          booking.event_date,
          booking.payment_verified_at
        )
      : 0;
    const amount = hasVerifiedPayment
      ? calculateCancellationRefund(booking.downpayment_amount, percentage)
      : 0;

    const hoursSinceVerification = booking.payment_verified_at
      ? (Date.now() - new Date(booking.payment_verified_at).getTime()) / 3600000
      : -1;
    const isGracePeriod =
      hasVerifiedPayment &&
      daysBeforeEvent >= 7 &&
      Number.isFinite(hoursSinceVerification) &&
      hoursSinceVerification >= 0 &&
      hoursSinceVerification <= 24;

    return { daysBeforeEvent, hasVerifiedPayment, percentage, amount, isGracePeriod };
  };

  const getCancelWarningMessage = (booking: Booking | null) => {
    const preview = getCancellationPreview(booking);
    if (!booking || !preview) return '';

    if (booking.status === 'pending') {
      return 'Your pending booking request can be cancelled. No payment refund is due.';
    }
    if (!preview.hasVerifiedPayment) {
      return 'No verified downpayment is recorded for this booking, so no refund is due.';
    }
    if (preview.daysBeforeEvent < 7) {
      return 'This event is less than 7 days away. Customer cancellations receive a 0% refund.';
    }
    if (preview.isGracePeriod) {
      return 'Your booking is within the 24-hour grace period after verified payment. A full refund applies.';
    }
    return `Based on the event date, ${preview.percentage}% of your verified downpayment is refundable.`;
  };

  const confirmCancelBooking = async () => {
    if (!cancellingBooking || isCancelling || !session?.user?.id) return;
    const finalReason = selectedReason === 'Other' ? customReason.trim() : selectedReason;
    if (finalReason.length < 3 || finalReason.length > 1000) {
      Alert.alert('Invalid Reason', 'Please provide a cancellation reason between 3 and 1,000 characters.');
      return;
    }

    // The server is authoritative; this estimate only determines whether
    // to request refund account information in the form.
    const preview = getCancellationPreview(cancellingBooking);
    let accountDetails: Record<string, string | null> | null = null;
    if (preview && preview.amount > 0) {
      const holder = refundHolderName.trim();
      const account = refundAccountNumber.trim();
      const bank = refundBankName.trim();
      const isWallet = refundMethod === 'gcash' || refundMethod === 'maya';
      if (!holder || !account || (refundMethod === 'other_bank' && !bank)) {
        Alert.alert('Missing Refund Details', 'Enter the account holder, account number and bank name if applicable.');
        return;
      }
      if (isWallet && !/^09\d{9}$/.test(account)) {
        Alert.alert('Invalid Mobile Number', 'Enter an 11-digit number beginning with 09.');
        return;
      }
      if (!isWallet && !/^\\d{6,20}$/.test(account)) {
        Alert.alert('Invalid Account Number', 'Enter a 6–20 digit bank account number.');
        return;
      }
      if (holder.length > 120 || bank.length > 120) {
        Alert.alert('Invalid Refund Details', 'Account holder or bank name is too long.');
        return;
      }
      accountDetails = {
        method: refundMethod,
        bank_name: refundMethod === 'other_bank'
          ? bank
          : refundMethod === 'bpi' ? 'BPI' : refundMethod === 'bdo' ? 'BDO' : null,
        account_holder: holder,
        account_number: account,
      };
    }

    setIsCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-customer-booking', {
        body: {
          booking_id: cancellingBooking.id,
          reason: finalReason,
          refund_account_details: accountDetails,
        },
      });
      if (error) {
        // FunctionHttpError may contain a useful JSON response.
        let message = error.message || 'Cancellation request failed.';
        const context = (error as any).context;
        if (context && typeof context.json === 'function') {
          try {
            const payload = await context.json();
            message = payload?.error || message;
          } catch { /* Preserve original error */ }
        }
        throw new Error(message);
      }
      if (!data?.success || !data?.booking) {
        throw new Error(data?.error || 'Cancellation was not completed.');
      }

      const amount = Number(data.booking.refund_amount ?? 0);
      const percentage = Number(data.booking.refund_percentage ?? 0);
      if (amount > 0) {
        Alert.alert(
          'Cancellation & Refund Requested',
          `Booking cancelled. Refund: ${percentage}% (₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). The caterer must transfer this amount directly to your refund account.`
        );
      } else {
        Alert.alert('Booking Cancelled', 'Your booking was cancelled. No refund is due under the cancellation policy.');
      }

      setCancellingBooking(null);
      setSelectedReason('');
      setCustomReason('');
      setRefundAccount('');
      setRefundMethod('gcash');
      setRefundHolderName('');
      setRefundAccountNumber('');
      setRefundBankName('');
      await load();
    } catch (err: any) {
      Alert.alert('Cancellation Failed', err?.message || 'Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  const openBookingDetails = async (booking: Booking) => {
    setDetailBooking(booking);
    setTransferEvidence([]);
    if (booking.status !== 'cancelled' || Number(booking.refund_amount) <= 0) return;
    setEvidenceLoading(true);
    try {
      const { data, error } = await supabase
        .from('refund_transfer_submissions')
        .select('*')
        .eq('booking_id', booking.id);
      if (error) throw error;
      const rows = await Promise.all((data ?? []).map(async (row: any) => {
        const path = row.proof_storage_path ?? row.proof_path ?? row.receipt_path ?? row.storage_path;
        let proofUrl: string | null = null;
        if (typeof path === 'string' && path.length) {
          const { data: signed, error: signError } = await supabase.storage
            .from('refund-proofs')
            .createSignedUrl(path, 60 * 10);
          if (!signError) proofUrl = signed?.signedUrl ?? null;
        }
        return { ...row, proofUrl };
      }));
      setTransferEvidence(rows);
    } catch (error: any) {
      Alert.alert('Evidence Unavailable', error?.message || 'Unable to load transfer evidence.');
    } finally {
      setEvidenceLoading(false);
    }
  };

  const confirmRefundReceived = (booking: Booking) => {
    Alert.alert(
      'Confirm refund received?',
      `Only confirm after checking that ₱${Number(booking.refund_amount).toLocaleString('en-PH')} has actually arrived in your wallet or bank account. A receipt screenshot alone is not confirmation.`,
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'I Received the Refund',
          onPress: async () => {
            if (confirmingRefundId || !session?.user?.id) return;
            setConfirmingRefundId(booking.id);
            try {
              // Authenticated Edge Function calls the service-role-only confirmation RPC.
              const { data, error } = await supabase.functions.invoke('confirm-customer-refund', {
                body: { booking_id: booking.id },
              });
              if (error) {
                let message = error.message || 'Unable to confirm refund.';
                const context = (error as any).context;
                if (context && typeof context.json === 'function') {
                  try {
                    const payload = await context.json();
                    message = payload?.error || message;
                  } catch { /* Keep the original error message. */ }
                }
                throw new Error(message);
              }
              if (!data?.success || data?.refund_status !== 'processed') {
                throw new Error(data?.error || 'Refund confirmation was not completed.');
              }
              Alert.alert('Refund Confirmed', 'Thank you. Your refund is now marked as processed. Platform Staff can monitor the record.');
              await load();
            } catch (err: any) {
              Alert.alert('Unable to Confirm', err?.message || 'Please try again.');
            } finally {
              setConfirmingRefundId(null);
            }
          },
        },
      ]
    );
  };

  const submitRefundDispute = async () => {
    if (!disputeBooking || submittingDispute || !session?.user?.id) return;
    const reason = disputeReason.trim();
    if (reason.length < 10) {
      Alert.alert('More Details Needed', 'Please describe the missing refund in at least 10 characters.');
      return;
    }
    if (reason.length > 2000) {
      Alert.alert('Too Long', 'Please keep the explanation under 2,000 characters.');
      return;
    }
    if (disputeBooking.status !== 'cancelled' || !['pending', 'overdue', 'awaiting_customer_confirmation'].includes(disputeBooking.refund_status)) {
      Alert.alert('Refund Updated', 'Only unresolved refunds can be reported.');
      return;
    }
    setSubmittingDispute(true);
    try {
      const { error } = await supabase.from('refund_disputes').insert({
        booking_id: disputeBooking.id,
        customer_id: session.user.id,
        reason,
      });
      if (error) throw error;
      setRefundDisputes(prev => ({
        ...prev,
        [disputeBooking.id]: { status: 'open', reason, created_at: new Date().toISOString(), caterer_response: null, caterer_responded_at: null },
      }));
      setDisputeBooking(null);
      setDisputeReason('');
      Alert.alert('Issue Reported', 'Your missing-refund report has been recorded. The refund remains pending. Please contact the caterer while the issue is investigated.');
    } catch (err: any) {
      Alert.alert('Unable to Submit Report', err?.code === '23505'
        ? 'A refund dispute has already been filed for this booking.'
        : err?.message || 'Please try again.');
    } finally {
      setSubmittingDispute(false);
    }
  };

  const cancellationPreview = getCancellationPreview(cancellingBooking);

  const activePaymentBooking = bookings.find(b => b.id === payingBookingId);
  const availableMethods = activePaymentBooking?.caterers?.accepted_payment_methods?.length 
    ? activePaymentBooking.caterers.accepted_payment_methods 
    : ['gcash', 'maya', 'bpi', 'bdo', 'card'];

  return (
    <View style={styles.root}>
      {/* ── Secure Xendit Payment Modal with Rectangular Vertical List Payment UI/UX ── */}
      <Modal visible={!!payingBookingId} animationType="slide" presentationStyle="pageSheet" onShow={() => {
        if (activePaymentBooking) {
          const allowed = activePaymentBooking.caterers?.accepted_payment_methods;
          if (allowed && allowed.length > 0 && !allowed.includes(selectedPaymentMethod)) {
            setSelectedPaymentMethod(allowed[0]);
          }
        }
      }}>
        <View style={styles.paymentModalRoot}>
          <View style={styles.paymentModalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={22} color={Colors.orange} />
              <Text style={styles.paymentModalTitle}>Pay Downpayment</Text>
            </View>
            <TouchableOpacity onPress={() => setPayingBookingId(null)} style={styles.paymentCloseBtn}>
              <Text style={styles.paymentCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {activePaymentBooking && (
            <ScrollView contentContainerStyle={styles.paymentModalBody} showsVerticalScrollIndicator={false}>
              {/* Booking Summary Box */}
              <View style={styles.paySummaryCard}>
                <Text style={styles.paySectionTitle}>Booking Summary</Text>
                <View style={styles.paySummaryRow}>
                  <Text style={styles.paySummaryLabel}>Caterer</Text>
                  <Text style={styles.paySummaryVal}>{(activePaymentBooking.caterers as any)?.business_name ?? 'Caterer'}</Text>
                </View>
                <View style={styles.paySummaryRow}>
                  <Text style={styles.paySummaryLabel}>Package</Text>
                  <Text style={styles.paySummaryVal}>{(activePaymentBooking.packages as any)?.name ?? 'Catering Package'}</Text>
                </View>
                <View style={styles.paySummaryRow}>
                  <Text style={styles.paySummaryLabel}>Event Date</Text>
                  <Text style={styles.paySummaryVal}>{formatDate(activePaymentBooking.event_date)}</Text>
                </View>
                <View style={styles.paySummaryRow}>
                  <Text style={styles.paySummaryLabel}>Guest Count</Text>
                  <Text style={styles.paySummaryVal}>{activePaymentBooking.guest_count} pax</Text>
                </View>
                {activePaymentBooking.venue && (
                  <View style={styles.paySummaryRow}>
                    <Text style={styles.paySummaryLabel}>Venue</Text>
                    <Text style={styles.paySummaryVal} numberOfLines={1}>{activePaymentBooking.venue}</Text>
                  </View>
                )}
              </View>

              {/* Payment Breakdown Box */}
              <View style={styles.paySummaryCard}>
                <Text style={styles.paySectionTitle}>Payment Breakdown</Text>
                <View style={styles.paySummaryRow}>
                  <Text style={styles.paySummaryLabel}>Total Cost</Text>
                  <Text style={styles.paySummaryVal}>₱{Number(activePaymentBooking.total_cost).toLocaleString()}</Text>
                </View>
                <View style={styles.paySummaryRow}>
                  <Text style={styles.paySummaryLabel}>Required Downpayment</Text>
                  <Text style={[styles.paySummaryVal, { color: Colors.orange, fontWeight: '900' }]}>
                    ₱{Number(activePaymentBooking.downpayment_amount).toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.paySummaryRow, { borderBottomWidth: 0, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' }]}>
                  <Text style={[styles.paySummaryLabel, { color: Colors.textSecondary }]}>Remaining Balance (Event Day)</Text>
                  <Text style={[styles.paySummaryVal, { color: Colors.textSecondary }]}>
                    ₱{(Number(activePaymentBooking.total_cost) - Number(activePaymentBooking.downpayment_amount)).toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* ── Improvised Rectangular Vertical Payment Method List ── */}
              <View style={styles.paymentSectionHeaderWrap}>
                <Text style={styles.paySectionTitle}>Select Payment Method</Text>
                <Text style={styles.methodInfoSub}>Choose a secure payment channel supported by this caterer.</Text>
              </View>
              
              <View style={styles.paymentMethodsList}>
                {availableMethods.map((methodKey) => {
                  const channel = PAYMENT_CHANNEL_CONFIG[methodKey];
                  if (!channel) return null;
                  const IconComponent = channel.icon;
                  const isSelected = selectedPaymentMethod === methodKey;
                  const customAccountVal = activePaymentBooking.caterers?.accepted_payment_details?.[methodKey];

                  return (
                    <TouchableOpacity
                      key={methodKey}
                      style={[
                        styles.rectangularMethodRow, 
                        isSelected && styles.rectangularMethodRowActive
                      ]}
                      onPress={() => setSelectedPaymentMethod(methodKey)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.methodIconBadge, isSelected && styles.methodIconBadgeActive]}>
                        <IconComponent size={20} color={isSelected ? Colors.orange : Colors.textSecondary} />
                      </View>

                      <View style={styles.rectangularMethodDetails}>
                        <Text style={[styles.rectangularMethodName, isSelected && styles.rectangularMethodNameActive]} numberOfLines={1}>
                          {channel.label}
                        </Text>
                        <Text style={styles.rectangularMethodSub} numberOfLines={1}>{channel.sub}</Text>
                        
                        {customAccountVal ? (
                          <Text style={styles.customAccountRowText} selectable numberOfLines={1}>
                            Acct: {customAccountVal}
                          </Text>
                        ) : null}
                      </View>

                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected && <View style={styles.radioInnerDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Xendit Gateway Checkout Button */}
              <TouchableOpacity
                style={styles.confirmPayBtn}
                onPress={handleProcessPayment}
                disabled={isProcessingPayment}
                activeOpacity={0.85}
              >
                {isProcessingPayment ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Lock size={16} color={Colors.white} />
                    <Text style={styles.confirmPayBtnText}>
                      Pay ₱{Number(activePaymentBooking.downpayment_amount).toLocaleString()} via Xendit
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.secureNotice}>
                🔒 Secure payment processing via Xendit gateway. E-receipt is generated automatically upon successful payment.
              </Text>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Booking details and refund transfer evidence */}
      <Modal visible={!!detailBooking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailBooking(null)}>
        <View style={styles.paymentModalRoot}>
          <View style={styles.paymentModalHeader}>
            <View style={styles.detailHeaderTitle}><ClipboardList size={21} color={Colors.orange} /><Text style={styles.paymentModalTitle}>Booking Details</Text></View>
            <TouchableOpacity onPress={() => setDetailBooking(null)} style={styles.paymentCloseBtn}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {detailBooking && (
            <ScrollView contentContainerStyle={styles.paymentModalBody}>
              {detailBooking.status === 'cancelled' && (
                <View style={styles.paySummaryCard}>
                  <View style={styles.detailSectionHeading}><View style={[styles.detailSectionIcon, {backgroundColor: '#FEF2F2'}]}><Ban size={18} color="#B91C1C" /></View><Text style={styles.paySectionTitle}>Cancellation & Refund</Text></View>
                  <Text style={styles.detailText}>Cancelled by: {detailBooking.cancelled_by ?? '—'}</Text>
                  <Text style={styles.detailText}>Reason: {detailBooking.cancellation_reason ?? '—'}</Text>
                  <Text style={styles.detailText}>Refund Status: {detailBooking.refund_status?.toUpperCase() ?? 'NONE'}</Text>
                  <Text style={styles.detailText}>Refund Amount: ₱{Number(detailBooking.refund_amount).toLocaleString('en-PH')}</Text>
                  {detailBooking.refund_account_details && (
                    <Text style={styles.detailText} selectable>
                      Destination: {'\n'}{formatRefundDestination(detailBooking.refund_account_details)}
                    </Text>
                  )}
                  {detailBooking.refunded_at && (
                    <Text style={styles.detailText}>Completed: {formatDate(detailBooking.refunded_at)}</Text>
                  )}
                </View>
              )}
              {detailBooking.status === 'cancelled' && Number(detailBooking.refund_amount) > 0 && (
                <View style={styles.paySummaryCard}>
                  <View style={styles.detailSectionHeading}><View style={styles.detailSectionIcon}><ReceiptText size={18} color={Colors.orange} /></View><Text style={styles.paySectionTitle}>Refund Transfer Evidence</Text></View>
                  {evidenceLoading ? <ActivityIndicator color={Colors.orange} /> :
                    transferEvidence.length === 0 ? (
                      <Text style={styles.detailText}>No transfer evidence has been submitted yet.</Text>
                    ) : transferEvidence.map((item, index) => (
                      <View key={item.id ?? index} style={styles.evidenceItem}>
                        <View style={styles.detailSubheading}><FileText size={15} color={Colors.orange} /><Text style={styles.detailText}>Submission {index + 1} · {item.status ?? 'submitted'}</Text></View>
                        {(item.transfer_reference ?? item.reference_number ?? item.reference_id) && (
                          <Text style={styles.detailText} selectable>
                            Reference: {item.transfer_reference ?? item.reference_number ?? item.reference_id}
                          </Text>
                        )}
                        {(item.submitted_at ?? item.created_at) && <Text style={styles.detailText}>Submitted: {formatDate(item.submitted_at ?? item.created_at)}</Text>}
                        {item.proofUrl ? (
                          <Image source={{ uri: item.proofUrl }} style={styles.evidenceImage} resizeMode="contain" />
                        ) : (
                          <Text style={styles.detailText}>Proof image is unavailable or access is restricted.</Text>
                        )}
                      </View>
                    ))
                  }
                  {detailBooking.refund_status === 'awaiting_customer_confirmation' && transferEvidence.length > 0 && (
                    <TouchableOpacity style={styles.refundConfirmButton} onPress={() => confirmRefundReceived(detailBooking)}>
                      <Text style={styles.confirmPayBtnText}>I Received My Refund</Text>
                    </TouchableOpacity>
                  )}
                  {(refundDisputes[detailBooking.id] || ['pending', 'overdue', 'awaiting_customer_confirmation'].includes(detailBooking.refund_status)) && (
                    refundDisputes[detailBooking.id] ? (
                      <View style={styles.disputeNotice}>
                        <AlertTriangle size={18} color="#B45309" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.disputeNoticeTitle}>Refund issue reported · {refundDisputes[detailBooking.id].status.toUpperCase()}</Text>
                          <Text style={styles.detailText}>{refundDisputes[detailBooking.id].reason}</Text>
                          <Text style={[styles.detailText, { fontSize: 11, color: Colors.textSecondary }]}>
                            Reported: {new Date(refundDisputes[detailBooking.id].created_at).toLocaleString('en-PH')}
                          </Text>
                          <View style={{ marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' }}>
                            <Text style={{ fontWeight: '800', fontSize: 13, color: Colors.black, marginBottom: 6 }}>
                              Caterer's Investigation Response
                            </Text>
                            {refundDisputes[detailBooking.id].caterer_response?.trim() ? (
                              <>
                                <Text style={styles.detailText} selectable>
                                  {refundDisputes[detailBooking.id].caterer_response}
                                </Text>
                                {refundDisputes[detailBooking.id].caterer_responded_at ? (
                                  <Text style={[styles.detailText, { fontSize: 11, color: Colors.textSecondary }]}>
                                    Replied: {new Date(refundDisputes[detailBooking.id].caterer_responded_at!).toLocaleString('en-PH')}
                                  </Text>
                                ) : null}
                              </>
                            ) : (
                              <Text style={styles.detailText}>
                                No investigation response has been submitted by the caterer yet.
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.disputeButton} onPress={() => { setDisputeReason(''); setDetailBooking(null); setDisputeBooking(detailBooking); }}>
                        <AlertTriangle size={17} color="#B91C1C" />
                        <Text style={styles.disputeButtonText}>I Haven't Received My Refund</Text>
                      </TouchableOpacity>
                    )
                  )}
                  <Text style={styles.detailText}>Only confirm after checking your wallet or bank account. Platform Staff monitors the process but does not handle the payment.</Text>
                </View>
              )}
              <View style={styles.paySummaryCard}>
                <View style={styles.detailSectionHeading}><View style={styles.detailSectionIcon}><ClipboardList size={18} color={Colors.orange} /></View><View style={{flex:1}}><Text style={styles.paySectionTitle}>Booking Overview</Text><Text style={styles.detailSectionSubtitle}>{detailBooking.caterers?.business_name ?? 'Caterer'}</Text></View></View>
                {([
                  ['Booking ID', detailBooking.id, Hash],
                  ['Status', STATUS_CONFIG[detailBooking.status]?.label ?? detailBooking.status, CheckCircle2],
                  ['Package', detailBooking.packages?.name ?? '—', Package],
                  ['Event', detailBooking.event_type ?? 'Catering Event', PartyPopper],
                  ['Event Date', formatDate(detailBooking.event_date), CalendarDays],
                  ['Guests', `${detailBooking.guest_count} pax`, Users],
                  ['Venue', detailBooking.venue ?? '—', MapPin],
                  ['Total Cost', `₱${Number(detailBooking.total_cost).toLocaleString('en-PH')}`, Wallet],
                  ['Downpayment', `₱${Number(detailBooking.downpayment_amount).toLocaleString('en-PH')}`, CreditCard],
                  ['Payment Method', displayXenditPaymentMethod(detailBooking.payment_method), ReceiptText],
                ] as [string, string, any][]).map(([label, value, RowIcon]) => (
                  <View key={label} style={styles.paySummaryRow}>
                    <View style={styles.detailLabelGroup}><RowIcon size={16} color={Colors.orange} /><Text style={styles.paySummaryLabel}>{label}</Text></View>
                    <Text style={[styles.paySummaryVal, styles.detailRowValue]} selectable>{value}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.paySummaryCard}>
                <View style={styles.detailSectionHeading}><View style={styles.detailSectionIcon}><UtensilsCrossed size={18} color={Colors.orange} /></View><Text style={styles.paySectionTitle}>What's Inside Your Package</Text></View>
                <Text style={styles.detailText}>Package: {detailBooking.packages?.name ?? 'Not available'}</Text>
                {detailBooking.packages?.tier && (
                  <Text style={styles.detailText}>Tier: {detailBooking.packages.tier}</Text>
                )}
                {detailBooking.packages?.description && (
                  <Text style={styles.detailText}>{String(detailBooking.packages.description)}</Text>
                )}
                {([
                  ['Included Services', detailBooking.packages?.includes ?? detailBooking.packages?.inclusions],
                  ['Food Inclusions', detailBooking.packages?.food_inclusions],
                  ['Menu', detailBooking.packages?.menu ?? detailBooking.packages?.menu_items],
                  ['Other Inclusions', detailBooking.packages?.included_items],
                  ['Customizations', detailBooking.customized_items],
                ] as [string, unknown][]).map(([heading, raw]) => {
                  const entries = describePackageField(raw);
                  return entries.length ? (
                    <View key={heading} style={{ marginTop: 12 }}>
                      <View style={styles.detailSubheading}><ListChecks size={15} color={Colors.orange} /><Text style={[styles.detailText, { fontWeight: '800', color: Colors.black, marginTop: 0 }]}>{heading}</Text></View>
                      {entries.map((entry, index) => (
                        <Text key={`${heading}-${index}`} style={styles.detailText}>• {entry}</Text>
                      ))}
                    </View>
                  ) : null;
                })}
                {detailBooking.special_requests ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={[styles.detailText, { fontWeight: '800', color: Colors.black }]}>Special Requests</Text>
                    <Text style={styles.detailText}>{detailBooking.special_requests}</Text>
                  </View>
                ) : null}
                {![
                  detailBooking.packages?.includes, detailBooking.packages?.inclusions,
                  detailBooking.packages?.food_inclusions, detailBooking.packages?.menu,
                  detailBooking.packages?.menu_items, detailBooking.packages?.included_items,
                  detailBooking.customized_items,
                ].some(value => describePackageField(value).length > 0) && (
                  <Text style={styles.detailText}>Detailed package inclusions have not been provided in this package record.</Text>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Missing refund dispute form: fixed footer keeps both actions visible on small screens */}
      <Modal visible={!!disputeBooking} animationType="slide" transparent statusBarTranslucent={false} onRequestClose={() => !submittingDispute && setDisputeBooking(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.disputeModalContent]}>
            <ScrollView
              style={styles.disputeFormScroll}
              contentContainerStyle={styles.disputeFormBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detailSectionHeading}>
                <AlertTriangle size={22} color="#B91C1C" />
                <Text style={styles.paymentModalTitle}>Refund Not Received</Text>
              </View>
              <Text style={styles.detailText}>
                Check your wallet or bank transaction history first. If the refund has not arrived, describe the issue below. The refund will stay pending.
              </Text>
              <Text style={[styles.paySectionTitle, { marginTop: 18 }]}>What happened?</Text>
              <TextInput
                style={[styles.customInput, { minHeight: 100, textAlignVertical: 'top', marginTop: 8 }]}
                placeholder="Example: The caterer submitted a transfer receipt, but no funds have arrived in my GCash account as of today."
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={2000}
                value={disputeReason}
                onChangeText={setDisputeReason}
              />
              <Text style={styles.detailText}>{disputeReason.length}/2000 characters</Text>
            </ScrollView>
            <View style={styles.disputeModalFooter}>
              <TouchableOpacity
                style={[styles.closeBtn, styles.disputeFooterButton]}
                disabled={submittingDispute}
                onPress={() => { setDisputeBooking(null); setDisputeReason(''); }}
              >
                <Text style={styles.closeBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, styles.disputeFooterButton, submittingDispute && { opacity: 0.6 }]}
                disabled={submittingDispute}
                onPress={submitRefundDispute}
              >
                {submittingDispute ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmCancelText}>Submit Report</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Review Modal */}
      <Modal visible={!!reviewBooking} animationType="slide" presentationStyle="pageSheet">
        {reviewBooking && (
          <ReviewScreen
            bookingId={reviewBooking.id}
            catererId={(reviewBooking.caterers as any)?.id ?? ''}
            catererName={(reviewBooking.caterers as any)?.business_name ?? ''}
            onClose={() => setReviewBooking(null)}
            onSubmitted={() => { setReviewBooking(null); load(); }}
          />
        )}
      </Modal>

      {/* Chat modal */}
      <Modal visible={!!chatBooking} animationType="slide" presentationStyle="fullScreen">
        {chatBooking && (
          <ChatScreen
            bookingId={chatBooking.id}
            receiverId={(chatBooking.caterers as any)?.user_id ?? ''}
            receiverName={(chatBooking.caterers as any)?.business_name ?? 'Caterer'}
            receiverAvatar={(chatBooking.caterers as any)?.logo_url ?? null}
            bookingInfo={`${chatBooking.event_type ?? 'Event'} · ${formatDate(chatBooking.event_date)}`}
            onClose={() => setChatBooking(null)}
          />
        )}
      </Modal>

      {/* Emergency cancellation: customer provides the refund destination. */}
      <Modal visible={!!refundDestinationBooking} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => { if (!savingRefundDestination) setRefundDestinationBooking(null); }}>
        <View style={styles.paymentModalRoot}>
          <View style={styles.paymentModalHeader}>
            <Text style={styles.paymentModalTitle}>Submit Refund Account</Text>
            <TouchableOpacity disabled={savingRefundDestination} onPress={() => setRefundDestinationBooking(null)}>
              <X size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.paymentModalBody}>
            <Text style={styles.detailText}>
              Your caterer cancelled this booking. Submit the account where you want to receive your refund.
              Only the relevant parties should have access to these details. Never enter your wallet PIN or OTP.
            </Text>
            {refundDestinationBooking && (
              <Text style={[styles.paySectionTitle, { marginTop: 15, marginBottom: 10 }]}>
                Refund due: ₱{Number(refundDestinationBooking.refund_amount).toLocaleString('en-PH')}
              </Text>
            )}
            <Text style={styles.paySectionTitle}>Choose refund destination</Text>
            {REFUND_METHODS.map(method => (
              <TouchableOpacity key={method.key}
                style={[styles.refundMethodRow, emergencyRefundMethod === method.key && styles.refundMethodRowSelected]}
                onPress={() => setEmergencyRefundMethod(method.key)}>
                <Text style={[styles.refundMethodLabel, emergencyRefundMethod === method.key && styles.refundMethodLabelSelected]}>
                  {method.label}
                </Text>
                {emergencyRefundMethod === method.key && <Check size={18} color={Colors.orange} />}
              </TouchableOpacity>
            ))}
            {emergencyRefundMethod === 'other_bank' && (
              <TextInput style={styles.customInput} placeholder="Bank name" placeholderTextColor={Colors.textMuted}
                maxLength={120} value={emergencyRefundBank} onChangeText={setEmergencyRefundBank} />
            )}
            <Text style={[styles.paySectionTitle, { marginTop: 14 }]}>Account holder's full name</Text>
            <TextInput style={styles.customInput} placeholder="Name registered to the wallet or bank"
              placeholderTextColor={Colors.textMuted} maxLength={120}
              value={emergencyRefundHolder} onChangeText={setEmergencyRefundHolder} />
            <Text style={[styles.paySectionTitle, { marginTop: 14 }]}>
              {['gcash', 'maya'].includes(emergencyRefundMethod) ? 'Mobile number' : 'Bank account number'}
            </Text>
            <TextInput style={styles.customInput} keyboardType="number-pad" maxLength={20}
              placeholder={['gcash', 'maya'].includes(emergencyRefundMethod) ? '09XXXXXXXXX' : 'Account number'}
              placeholderTextColor={Colors.textMuted}
              value={emergencyRefundNumber} onChangeText={setEmergencyRefundNumber} />
            <TouchableOpacity style={[styles.confirmPayBtn, { marginTop: 20 }, savingRefundDestination && { opacity: 0.6 }]}
              disabled={savingRefundDestination} onPress={submitEmergencyRefundDestination}>
              {savingRefundDestination ? <ActivityIndicator color="#FFFFFF" /> :
                <Text style={styles.confirmPayBtnText}>Submit Refund Account</Text>}
            </TouchableOpacity>
            <Text style={[styles.detailText, { marginTop: 12 }]}>
              This does not transfer money automatically. The caterer submits transfer proof afterward, and you confirm receiving the refund.
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Cancellation Reason Modal */}
      <Modal visible={!!cancellingBooking} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Cancel Booking</Text>
            
            <Text style={styles.modalWarningText}>
              {getCancelWarningMessage(cancellingBooking)}
            </Text>

            {cancellationPreview && (
              <View style={styles.refundPreviewBox}>
                <Text style={styles.refundPreviewHeading}>Estimated Cancellation Refund</Text>
                <Text style={styles.refundPreviewAmount}>
                  ₱{cancellationPreview.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={styles.refundPreviewDetail}>
                  {cancellationPreview.percentage}% of verified downpayment · {cancellationPreview.daysBeforeEvent} days before event
                </Text>
                {cancellationPreview.isGracePeriod && (
                  <Text style={styles.refundPreviewGrace}>
                    24-hour grace period applied
                  </Text>
                )}
                <Text style={styles.refundPreviewDisclaimer}>
                  Estimated refund based on the current booking details. The final amount is recalculated when you confirm cancellation.
                </Text>
              </View>
            )}

            <Text style={styles.modalSubPrompt}>Please let us know why you are cancelling:</Text>
            
            {CANCELLATION_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonRow, 
                  selectedReason === reason && styles.reasonRowSelected
                ]}
                onPress={() => setSelectedReason(reason)}
              >
                <Text style={[
                  styles.reasonText,
                  selectedReason === reason && styles.reasonTextSelected
                ]}>
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}

            {selectedReason === 'Other' && (
              <TextInput
                style={styles.customInput}
                placeholder="Please specify your reason..."
                placeholderTextColor={Colors.textMuted}
                value={customReason}
                onChangeText={setCustomReason}
                multiline
              />
            )}

            {cancellationPreview && cancellationPreview.amount > 0 && (
              <View style={styles.refundDestinationSection}>
                <Text style={styles.modalSubPrompt}>Where should your refund be sent?</Text>
                <Text style={styles.refundDestinationHint}>
                  Choose a refund destination. The caterer will handle the transfer after cancellation.
                </Text>
                {REFUND_METHODS.map(method => {
                  const selected = refundMethod === method.key;
                  const MethodIcon = method.type === 'wallet' ? Smartphone : Building2;
                  return (
                    <TouchableOpacity
                      key={method.key}
                      style={[styles.refundMethodRow, selected && styles.refundMethodRowSelected]}
                      onPress={() => {
                        setRefundMethod(method.key);
                        setRefundAccountNumber('');
                        setRefundBankName('');
                      }}
                      activeOpacity={0.8}
                    >
                      <MethodIcon size={18} color={selected ? Colors.orange : Colors.textSecondary} />
                      <Text style={[styles.refundMethodLabel, selected && styles.refundMethodLabelSelected]}>
                        {method.label}
                      </Text>
                      <View style={[styles.radioCircle, selected && styles.radioCircleActive]}>
                        {selected && <View style={styles.radioInnerDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {refundMethod === 'other_bank' && (
                  <>
                    <Text style={styles.refundFieldLabel}>Bank name</Text>
                    <TextInput
                      style={styles.refundFieldInput}
                      placeholder="Enter your bank name"
                      placeholderTextColor={Colors.textMuted}
                      value={refundBankName}
                      onChangeText={setRefundBankName}
                      autoCapitalize="words"
                    />
                  </>
                )}

                <Text style={styles.refundFieldLabel}>Account holder's full name</Text>
                <TextInput
                  style={styles.refundFieldInput}
                  placeholder="e.g., Juan Dela Cruz"
                  placeholderTextColor={Colors.textMuted}
                  value={refundHolderName}
                  onChangeText={setRefundHolderName}
                  autoCapitalize="words"
                />

                <Text style={styles.refundFieldLabel}>
                  {refundMethod === 'gcash' || refundMethod === 'maya'
                    ? 'Mobile wallet number'
                    : 'Bank account number'}
                </Text>
                <TextInput
                  style={styles.refundFieldInput}
                  placeholder={refundMethod === 'gcash' || refundMethod === 'maya'
                    ? '09XXXXXXXXX'
                    : 'Enter bank account number'}
                  placeholderTextColor={Colors.textMuted}
                  value={refundAccountNumber}
                  onChangeText={setRefundAccountNumber}
                  keyboardType="number-pad"
                />
                <Text style={styles.refundDestinationHint}>
                  Your refund destination will be validated and saved when you confirm cancellation. The caterer will use these details to transfer any eligible refund.
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.closeBtn} 
                onPress={() => {
                  setCancellingBooking(null);
                  setSelectedReason('');
                  setCustomReason('');
                  setRefundAccount('');
                  setRefundMethod('gcash');
                  setRefundHolderName('');
                  setRefundAccountNumber('');
                  setRefundBankName('');
                }}
                disabled={isCancelling}
              >
                <Text style={styles.closeBtnText}>Keep Booking</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmCancelBtn} 
                onPress={confirmCancelBooking}
                disabled={isCancelling}
              >
                <Text style={styles.confirmCancelText}>
                  {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
                </Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 44 }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.pageTitle}>My Bookings</Text>
            <Text style={styles.pageSub}>Manage your catering events and payments</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{bookings.length}</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filterOuterWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {FILTERS.map(f => {
              const isActive = filter === f;
              const label = f === 'all' ? 'All Bookings' : STATUS_CONFIG[f]?.label ?? f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setFilter(f)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.orange} /></View>
      ) : bookings.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <ClipboardList size={32} color={Colors.orange} />
          </View>
          <Text style={styles.emptyTitle}>No bookings found</Text>
          <Text style={styles.emptySub}>Discover premier local caterers and plan your next celebration!</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/(tabs)')} activeOpacity={0.85}>
            <Text style={styles.browseBtnText}>Explore Caterers</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 32, paddingTop: 6 }} showsVerticalScrollIndicator={false}>
          {bookings.map(b => {
            const sc = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;
            const StatusIcon = sc.icon;
            const needsPayment = b.status === 'confirmed';
            const paymentOverdue = needsPayment && deadlinePassed(b.downpayment_deadline);
            const countdownString = getCountdownText(b.event_date);

            let displayLabel = sc.label;
            if (b.status === 'cancelled') {
              if (b.cancelled_by === 'caterer') displayLabel = 'Cancelled by Caterer';
              else if (b.cancelled_by === 'system') displayLabel = 'Auto-Cancelled by System';
              else displayLabel = 'Cancelled by You';
            }

            return (
              <TouchableOpacity key={b.id} style={[styles.bookingCard, paymentOverdue && styles.bookingCardUrgent]} onPress={() => openBookingDetails(b)} activeOpacity={0.94}>
                {/* Status Bar Header */}
                <View style={[styles.statusBar, { backgroundColor: sc.bg }]}>
                  <View style={styles.statusTextRow}>
                    <StatusIcon size={15} color={sc.color} />
                    <Text style={[styles.statusText, { color: sc.color }]}>{displayLabel}</Text>
                  </View>
                  <Text style={[styles.statusDate, { color: sc.color }]}>{countdownString}</Text>
                </View>

                <View style={styles.cardContent}>
                  {/* Caterer Row */}
                  <View style={styles.catererRow}>
                    {(b.caterers as any)?.logo_url ? (
                      <Image source={{ uri: (b.caterers as any).logo_url }} style={styles.catererLogo} />
                    ) : (
                      <View style={styles.catererLogoPlaceholder}>
                        <Text style={styles.catererLogoText}>{((b.caterers as any)?.business_name ?? 'C').charAt(0)}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catererName} numberOfLines={1}>{(b.caterers as any)?.business_name ?? '—'}</Text>
                      <View style={styles.catererCityRow}>
                        <MapPin size={12} color={Colors.textSecondary} />
                        <Text style={styles.catererCity}>{(b.caterers as any)?.city ?? 'Cebu'} · {b.event_type || 'Catering Event'}</Text>
                      </View>
                    </View>
                    {b.packages && (
                      <View style={styles.tierPill}>
                        <Text style={styles.tierPillText} numberOfLines={1}>{b.packages.name}</Text>
                      </View>
                    )}
                  </View>

                  <BookingTimeline status={b.status} />

                  {/* Event Info Grid */}
                  <View style={styles.eventInfoRow}>
                    <View style={styles.eventInfoItem}>
                      <Text style={styles.eventInfoLabel}>EVENT DATE</Text>
                      <Text style={styles.eventInfoValue}>{formatDate(b.event_date)}</Text>
                    </View>
                    <View style={styles.eventInfoDivider} />
                    <View style={styles.eventInfoItem}>
                      <Text style={styles.eventInfoLabel}>GUESTS</Text>
                      <Text style={styles.eventInfoValue}>{b.guest_count} pax</Text>
                    </View>
                    <View style={styles.eventInfoDivider} />
                    <View style={styles.eventInfoItem}>
                      <Text style={styles.eventInfoLabel}>TOTAL AMOUNT</Text>
                      <Text style={[styles.eventInfoValue, { color: Colors.orange }]}>
                        ₱{Number(b.total_cost).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {b.venue && (
                    <View style={styles.venueRow}>
                      <MapPin size={13} color={Colors.textSecondary} />
                      <Text style={styles.venueText} numberOfLines={1}>Venue: {b.venue}</Text>
                    </View>
                  )}

                  {b.status === 'rejected' && b.rejection_reason && (
                    <View style={styles.rejectionBox}>
                      <AlertCircle size={16} color="#B91C1C" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rejectionTitle}>Reason for Rejection:</Text>
                        <Text style={styles.rejectionText}>{b.rejection_reason}</Text>
                      </View>
                    </View>
                  )}

                  {/* Cancelled Details & Refund Tracker Box */}
                  {b.status === 'cancelled' && (
                    <View style={styles.cancelledBox}>
                      <Ban size={16} color="#4B5563" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cancelledTitle}>Booking Cancelled</Text>
                        <Text style={styles.cancelledText}>
                          Initiated by: {
                            b.cancelled_by === 'caterer' ? 'Caterer' : 
                            b.cancelled_by === 'system' ? 'System (Overdue)' : 
                            'You (Customer)'
                          }
                        </Text>
                        {b.cancellation_reason && (
                          <Text style={styles.cancelledText}>Reason: {b.cancellation_reason}</Text>
                        )}
                        
                        {b.cancelled_by === 'caterer' &&
                          Number(b.refund_amount) > 0 &&
                          !b.refund_account_details && (
                            <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FFF7ED', borderRadius: 10 }}>
                              <Text style={{ color: '#9A3412', fontWeight: '800' }}>
                                Action needed: submit your refund account
                              </Text>
                              <Text style={{ color: '#9A3412', marginTop: 5, marginBottom: 10 }}>
                                Your caterer cancelled this booking. Enter a GCash, Maya, or bank account so the caterer can transfer your refund of ₱{Number(b.refund_amount).toLocaleString('en-PH')}.
                              </Text>
                              <TouchableOpacity
                                style={{ backgroundColor: Colors.orange, borderRadius: 9, padding: 12, alignItems: 'center' }}
                                onPress={() => { setRefundDestinationBooking(b); setEmergencyRefundMethod('gcash'); }}
                              >
                                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Submit Refund Account</Text>
                              </TouchableOpacity>
                            </View>
                          )}

                        {b.refund_status && b.refund_status !== 'none' && (
                          <View style={{ marginTop: 10, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <Wallet size={14} color={b.refund_status === 'processed' ? '#16A34A' : '#D97706'} />
                              <Text style={{ fontSize: 12, fontWeight: '900', color: Colors.black }}>
                                Refund Status: 
                                <Text style={{ 
                                  color: b.refund_status === 'processed' ? '#16A34A' : '#D97706' 
                                }}> {b.refund_status.toUpperCase()}</Text>
                              </Text>
                            </View>
                            
                            <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 2 }}>
                              Amount to Refund: <Text style={{ fontWeight: '800', color: Colors.black }}>₱{Number(b.refund_amount).toLocaleString()}</Text>
                            </Text>

                            {b.refund_account_details && (
                              <Text style={{ fontSize: 11.5, color: Colors.textSecondary, marginBottom: 4 }}>
                                Refund Destination: <Text style={{ fontWeight: '700' }}>{formatRefundDestination(b.refund_account_details)}</Text>
                              </Text>
                            )}

                            {b.refund_status === 'pending' && (
                              <Text style={{ fontSize: 11, color: '#D97706', marginTop: 4, fontWeight: '700' }}>
                                ⏳ Your refund is pending. The caterer sends the money directly to you; Platform Staff only monitors progress.
                              </Text>
                            )}

                            {['pending', 'overdue', 'awaiting_customer_confirmation'].includes(b.refund_status) && Number(b.refund_amount) > 0 && (
                              <View style={{ marginTop: 10, gap: 8 }}>
                                <Text style={{ fontSize: 12, color: '#1D4ED8', fontWeight: '700' }}>
                                  {refundEvidence[b.id]
                                    ? 'The caterer submitted a transfer receipt. Check your wallet or bank balance before confirming.'
                                    : 'No transfer receipt has been submitted yet. If your expected refund has not arrived, you can report the issue now.'}
                                </Text>
                                {b.refund_status === 'awaiting_customer_confirmation' && refundEvidence[b.id] && (
                                  <TouchableOpacity
                                    onPress={(event) => { event.stopPropagation(); confirmRefundReceived(b); }}
                                    disabled={confirmingRefundId === b.id}
                                    style={{ backgroundColor: '#15803D', padding: 12, borderRadius: 10, alignItems: 'center' }}
                                  >
                                    {confirmingRefundId === b.id
                                      ? <ActivityIndicator color="#FFF" />
                                      : <Text style={{ color: '#FFF', fontWeight: '800' }}>I Received My Refund</Text>}
                                  </TouchableOpacity>
                                )}
                                {refundDisputes[b.id] ? (
                                  <View style={styles.disputeNotice}>
                                    <AlertTriangle size={16} color="#B45309" />
                                    <Text style={styles.disputeNoticeTitle}>Refund issue reported · {refundDisputes[b.id].status.toUpperCase()}</Text>
                                  </View>
                                ) : (
                                  <TouchableOpacity style={styles.disputeButton} onPress={(event) => {
                                    event.stopPropagation();
                                    setDisputeReason('');
                                    setDisputeBooking(b);
                                  }}>
                                    <AlertTriangle size={16} color="#B91C1C" />
                                    <Text style={styles.disputeButtonText}>I Haven't Received My Refund</Text>
                                  </TouchableOpacity>
                                )}
                                <Text style={{ fontSize: 11, color: Colors.textSecondary }}>
                                  Haven't received it? Do not confirm. Contact the caterer while your report is investigated.
                                </Text>
                              </View>
                            )}

                            {b.refund_status === 'processed' && (
                              <Text style={{ fontSize: 11, color: '#16A34A', marginTop: 4, fontWeight: '700' }}>
                                ✅ You confirmed receiving the refund. This transaction is recorded as completed.
                              </Text>
                            )}

                            {b.caterer_notes && (
                              <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' }}>
                                Note: {b.caterer_notes}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {b.status === 'confirmed' && (
                    <View style={styles.ctaSection}>
                      <View style={[styles.deadlineBox, paymentOverdue && styles.deadlineBoxUrgent]}>
                        <View style={styles.deadlineLabelRow}>
                          {paymentOverdue ? <AlertTriangle size={15} color={Colors.error} /> : <Clock size={15} color="#B45309" />}
                          <Text style={[styles.deadlineLabel, paymentOverdue && { color: Colors.error }]}>
                            {paymentOverdue ? 'Payment Overdue!' : 'Downpayment Deadline'}
                          </Text>
                        </View>
                        <Text style={[styles.deadlineDate, paymentOverdue && { color: Colors.error }]}>
                          {b.downpayment_deadline ? formatDate(b.downpayment_deadline) : '—'}
                        </Text>
                      </View>

                      {paymentOverdue ? (
                        <TouchableOpacity
                          style={[styles.payBtn, { backgroundColor: '#9CA3AF', shadowOpacity: 0 }]}
                          activeOpacity={1}
                          onPress={() => Alert.alert('Overdue', 'The payment deadline has passed. This booking is being cancelled by the system.')}
                        >
                          <Ban size={16} color={Colors.white} />
                          <Text style={styles.payBtnText}>Deadline Passed</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.payBtn}
                          onPress={() => setPayingBookingId(b.id)}
                          activeOpacity={0.85}
                        >
                          <CreditCard size={16} color={Colors.white} />
                          <Text style={styles.payBtnText}>Pay ₱{Number(b.downpayment_amount).toLocaleString()} Downpayment</Text>
                        </TouchableOpacity>
                      )}

                      <Text style={styles.payNote}>
                        {paymentOverdue 
                          ? 'System is currently processing the auto-cancellation.' 
                          : 'Secure processing via Xendit gateway with automated e-receipt.'}
                      </Text>
                    </View>
                  )}

                  {b.status === 'paid' && (
                    <View style={styles.statusMessageBox}>
                      <CheckCircle2 size={16} color="#15803D" />
                      <Text style={styles.statusMessageText}>Downpayment secured via Xendit — {displayXenditPaymentMethod(b.payment_method)}. E-receipt generated automatically!</Text>
                    </View>
                  )}

                  {b.status === 'completed' && (
                    <View style={styles.statusMessageBox}>
                      <PartyPopper size={16} color="#15803D" />
                      <Text style={styles.statusMessageText}>Event successfully completed. Hope you had a great experience!</Text>
                    </View>
                  )}

                  <View style={styles.detailOpenRow}><View style={styles.detailOpenLeft}><ClipboardList size={16} color={Colors.orange} /><Text style={styles.detailOpenText}>View Booking Details</Text></View><ChevronRight size={17} color={Colors.orange} /></View>

                  {/* Action buttons */}
                  <View style={styles.bookingActions}>
                    {['pending', 'confirmed', 'paid', 'ongoing', 'completed', 'cancelled'].includes(b.status) && (
                      <TouchableOpacity
                        style={styles.chatBtn}
                        onPress={() => setChatBooking(b)}
                        activeOpacity={0.8}
                      >
                        <MessageSquare size={15} color={Colors.black} />
                        <Text style={styles.chatBtnText}>
                          {b.status === 'cancelled' ? 'Chat Support / Caterer' : 'Chat Caterer'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {b.status === 'completed' && !(b as any).reviews?.length && (
                      <TouchableOpacity
                        style={styles.reviewBtn}
                        onPress={() => setReviewBooking(b)}
                        activeOpacity={0.85}
                      >
                        <Star size={15} color={Colors.white} fill={Colors.white} />
                        <Text style={styles.reviewBtnText}>Write Review</Text>
                      </TouchableOpacity>
                    )}

                    {b.status === 'completed' && (b as any).reviews?.length > 0 && (
                      <View style={styles.reviewedBadge}>
                        <CheckCircle2 size={14} color="#15803D" />
                        <Text style={styles.reviewedText}>Review Submitted</Text>
                      </View>
                    )}

                    {['pending', 'confirmed', 'paid'].includes(b.status) && (
                      <TouchableOpacity
                        style={styles.cancelActionBtn}
                        onPress={() => setCancellingBooking(b)}
                        activeOpacity={0.8}
                      >
                        <Ban size={14} color={Colors.error} />
                        <Text style={styles.cancelActionText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  disputeModalContent: {
    maxHeight: '82%',
    paddingBottom: 16,
    paddingHorizontal: 18,
    paddingTop: 22,
    overflow: 'hidden',
  },
  disputeFormScroll: { flexShrink: 1, flexGrow: 0 },
  disputeFormBody: { paddingBottom: 12 },
  disputeModalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  disputeFooterButton: {
    minHeight: 50,
    justifyContent: 'center',
    marginTop: 0,
  },

  detailHeaderTitle: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  detailSectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  detailSectionIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  detailSectionSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  detailLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 },
  detailRowValue: { flexShrink: 1, maxWidth: '57%' },
  detailSubheading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  detailOpenRow: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailOpenLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailOpenText: { fontSize: 13, fontWeight: '800', color: Colors.orange },

  disputeButton: { marginTop: 10, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', borderRadius: 12, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  disputeButtonText: { fontSize: 12, fontWeight: '800', color: '#B91C1C', flexShrink: 1 },
  disputeNotice: { marginTop: 12, borderRadius: 12, padding: 12, backgroundColor: '#FFFBEB', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#FDE68A' },
  disputeNoticeTitle: { fontSize: 12, fontWeight: '800', color: '#92400E', flexShrink: 1 },
  detailText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginTop: 7 },
  evidenceItem: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 12, paddingTop: 12 },
  evidenceImage: { width: '100%', height: 280, backgroundColor: '#F9FAFB', borderRadius: 12, marginTop: 10 },
  refundConfirmButton: { backgroundColor: '#15803D', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 14 },
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  
  // Payment Modal Styling
  paymentModalRoot: { flex: 1, backgroundColor: '#F9FAFB' },
  paymentModalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  paymentModalTitle: { fontSize: 18, fontWeight: '900', color: Colors.black },
  paymentCloseBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  paymentCloseText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  paymentModalBody: { padding: 20, paddingBottom: 40 },
  
  paySummaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1
  },
  paySectionTitle: { fontSize: 14, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  paymentSectionHeaderWrap: { marginBottom: 12, marginTop: 4 },
  methodInfoSub: { fontSize: 12, color: Colors.textSecondary },
  paySummaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  paySummaryLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  paySummaryVal: { fontSize: 13, color: Colors.black, fontWeight: '800', maxWidth: '60%', textAlign: 'right' },

  // --- Rectangular Vertical Payment Method List UI ---
  paymentMethodsList: { gap: 10, marginBottom: 20 },
  rectangularMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  rectangularMethodRowActive: {
    borderColor: Colors.orange,
    backgroundColor: '#FFF7ED',
  },
  methodIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodIconBadgeActive: {
    backgroundColor: '#FFEDD5',
  },
  rectangularMethodDetails: {
    flex: 1,
  },
  rectangularMethodName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: Colors.black,
    marginBottom: 2,
  },
  rectangularMethodNameActive: {
    color: Colors.orange,
  },
  rectangularMethodSub: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  customAccountRowText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.orange,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  radioCircleActive: {
    borderColor: Colors.orange,
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.orange,
  },

  confirmPayBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: Colors.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  confirmPayBtnText: { color: Colors.white, fontSize: 15, fontWeight: '900' },
  secureNotice: { textAlign: 'center', fontSize: 11, color: Colors.textMuted, fontWeight: '600', lineHeight: 16 },

  header: { 
    backgroundColor: Colors.white, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6',
    paddingBottom: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  pageTitle: { fontSize: 24, fontWeight: '900', color: Colors.black, letterSpacing: -0.5 },
  pageSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  countBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  countBadgeText: { fontSize: 13, fontWeight: '800', color: Colors.orange },

  filterOuterWrap: { backgroundColor: Colors.white },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  filterChip: { 
    paddingHorizontal: 14, 
    paddingVertical: 7, 
    borderRadius: 16, 
    backgroundColor: '#F1F5F9', 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
  },
  filterChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  filterText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  filterTextActive: { color: Colors.white, fontWeight: '800' },

  list: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },

  bookingCard: { 
    backgroundColor: Colors.white, 
    borderRadius: 20, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    overflow: 'hidden', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 12, 
    elevation: 2 
  },
  bookingCardUrgent: { borderColor: Colors.error, borderWidth: 1.5 },
  
  statusBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 10 
  },
  statusTextRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  statusDate: { fontSize: 11, fontWeight: '700', opacity: 0.9 },

  cardContent: { padding: 16 },

  catererRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  catererLogo: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#F3F4F6' },
  catererLogoPlaceholder: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.orange, justifyContent: 'center', alignItems: 'center' },
  catererLogoText: { color: Colors.white, fontSize: 18, fontWeight: '900' },
  catererName: { fontSize: 16, fontWeight: '800', color: Colors.black, marginBottom: 3 },
  catererCityRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  catererCity: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  
  tierPill: { 
    backgroundColor: '#FFF7ED', 
    borderWidth: 1, 
    borderColor: '#FED7AA',
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 10,
    maxWidth: 100,
  },
  tierPillText: { fontSize: 11, fontWeight: '800', color: Colors.orange, textAlign: 'center' },

  eventInfoRow: { 
    flexDirection: 'row', 
    backgroundColor: '#F9FAFB', 
    borderRadius: 14, 
    padding: 12, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#F3F4F6',
    alignItems: 'center'
  },
  eventInfoItem: { flex: 1, alignItems: 'center' },
  eventInfoDivider: { width: 1, height: 24, backgroundColor: '#E5E7EB' },
  eventInfoLabel: { fontSize: 9, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.8, marginBottom: 3 },
  eventInfoValue: { fontSize: 13, fontWeight: '900', color: Colors.black },

  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  venueText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', flex: 1 },

  rejectionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  rejectionTitle: { fontSize: 12, fontWeight: '900', color: '#991B1B', marginBottom: 2 },
  rejectionText: { fontSize: 12, fontWeight: '600', color: '#B91C1C', lineHeight: 16 },

  cancelledBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  cancelledTitle: { fontSize: 12, fontWeight: '900', color: '#374151', marginBottom: 2 },
  cancelledText: { fontSize: 12, fontWeight: '600', color: '#4B5563', lineHeight: 16 },

  ctaSection: { gap: 10, marginTop: 4 },
  deadlineBox: { 
    backgroundColor: '#FEF3C7', 
    borderRadius: 12, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderWidth: 1, 
    borderColor: '#FDE68A', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  deadlineBoxUrgent: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  deadlineLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deadlineLabel: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  deadlineDate: { fontSize: 12, fontWeight: '900', color: '#92400E' },

  payBtn: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: Colors.orange, 
    borderRadius: 14, 
    paddingVertical: 14, 
    shadowColor: Colors.orange, 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 8, 
    elevation: 3 
  },
  payBtnText: { color: Colors.white, fontWeight: '900', fontSize: 14 },
  payNote: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 2, lineHeight: 15 },

  statusMessageBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: '#DCFCE7', 
    borderRadius: 12, 
    padding: 12, 
    borderWidth: 1, 
    borderColor: '#86EFAC',
    marginBottom: 4
  },
  statusMessageText: { fontSize: 12, color: '#15803D', fontWeight: '700', flex: 1 },

  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 6 },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 18 },
  browseBtn: { backgroundColor: Colors.orange, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  browseBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },

  bookingActions: { flexDirection: 'row', gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6', flexWrap: 'wrap' },
  chatBtn: {
    flex: 1, 
    minWidth: 100,
    backgroundColor: '#F3F4F6',
    borderRadius: 12, 
    paddingVertical: 12, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chatBtnText: { fontSize: 13, fontWeight: '800', color: Colors.black },
  reviewBtn: {
    flex: 1, 
    minWidth: 100,
    backgroundColor: Colors.orange,
    borderRadius: 12, 
    paddingVertical: 12, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reviewBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  reviewedBadge: {
    flex: 1,
    minWidth: 100,
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7', 
    borderRadius: 12,
    paddingVertical: 12, 
    borderWidth: 1, 
    borderColor: '#86EFAC',
  },
  reviewedText: { fontSize: 13, fontWeight: '800', color: '#15803D' },
  cancelActionBtn: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  cancelActionText: { fontSize: 13, fontWeight: '800', color: Colors.error },

  modalOverlay: {
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20
  },
  modalContent: {
    backgroundColor: Colors.white, 
    borderRadius: 20, 
    padding: 24, 
    width: '100%',
    maxHeight: '90%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: Colors.black, marginBottom: 8 },
  refundPreviewBox: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 12, padding: 12, marginBottom: 14 },
  refundPreviewHeading: { fontSize: 12, fontWeight: '800', color: '#9A3412', marginBottom: 4 },
  refundPreviewAmount: { fontSize: 24, fontWeight: '900', color: Colors.orange },
  refundPreviewDetail: { fontSize: 12, fontWeight: '600', color: '#7C2D12', marginTop: 4 },
  refundPreviewGrace: { fontSize: 12, fontWeight: '800', color: '#15803D', marginTop: 6 },
  refundPreviewDisclaimer: { fontSize: 10, color: '#9A3412', marginTop: 8 },
  modalWarningText: { fontSize: 13, color: '#B91C1C', fontWeight: '600', lineHeight: 18, marginBottom: 16, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 10, borderWidth: 1, borderColor: '#FECACA' },
  modalSubPrompt: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 12 },
  
  reasonRow: {
    padding: 14, borderRadius: 12, borderWidth: 1, 
    borderColor: '#E5E7EB', marginBottom: 10,
    backgroundColor: '#F9FAFB'
  },
  reasonRowSelected: {
    borderColor: Colors.error, backgroundColor: '#FEF2F2'
  },
  reasonText: { fontSize: 14, color: Colors.black, fontWeight: '600' },
  reasonTextSelected: { color: Colors.error, fontWeight: '800' },
  
  customInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, 
    padding: 14, height: 80, textAlignVertical: 'top', 
    marginBottom: 10, fontSize: 14, backgroundColor: '#F9FAFB'
  },
  
  refundDestinationSection: { marginTop: 12, marginBottom: 10 },
  refundDestinationHint: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16, marginBottom: 12 },
  refundMethodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  refundMethodRowSelected: { borderColor: Colors.orange, backgroundColor: '#FFF7ED' },
  refundMethodLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.black },
  refundMethodLabelSelected: { color: Colors.orange },
  refundFieldLabel: { fontSize: 12, fontWeight: '800', color: Colors.black, marginTop: 8, marginBottom: 6 },
  refundFieldInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    backgroundColor: '#F9FAFB', paddingHorizontal: 14, height: 46,
    marginBottom: 8, fontSize: 14, color: Colors.black,
  },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  closeBtn: {
    flex: 1, padding: 14, borderRadius: 12, 
    borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center'
  },
  closeBtnText: { fontWeight: '800', color: Colors.black, fontSize: 14 },
  confirmCancelBtn: {
    flex: 1, padding: 14, borderRadius: 12, 
    backgroundColor: Colors.error, alignItems: 'center',
    shadowColor: Colors.error, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3
  },
  confirmCancelText: { fontWeight: '900', color: Colors.white, fontSize: 14 },
});
