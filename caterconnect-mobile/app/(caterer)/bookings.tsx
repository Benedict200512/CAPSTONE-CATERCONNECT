// app/(tabs)/CatererBookings.tsx
import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import {
  ActivityIndicator, Alert, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Linking,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useBookingRefresh } from '../../hooks/useBookingRefresh';
import ChatScreen from '../../screens/auth/ChatScreen';
import MonthlyBookingQuotaSummary from '../../components/MonthlyBookingQuotaSummary';
import BookingInternalNotes from '../../components/BookingInternalNotes';
import { isMonthlyQuotaRejection } from '../../lib/monthlyBookingQuota';
import {
  Clock, CheckCircle, RefreshCw, PartyPopper,
  XCircle, Ban, Inbox, Calendar, Users, Package, User,
  Phone, Sparkles, Star, MessageSquare, Zap, X, Check,
  MapPin, ExternalLink, ShieldCheck, AlertTriangle, ShieldAlert,
  MessageSquareText, FileText, Shield
} from 'lucide-react-native';

type Review = {
  id: string;
  food_quality: number;
  service_quality: number;
  timeliness: number;
  overall: number;
  comment: string | null;
  caterer_reply: string | null;
  created_at: string;
};

type Booking = {
  id: string;
  customer_id: string;
  status: string;
  event_date: string;
  event_time: string | null;
  event_type: string | null;
  guest_count: number;
  total_cost: number;
  downpayment_amount: number;
  downpayment_deadline: string | null;
  venue: string | null;
  special_requests: string | null;
  payment_method: string | null;
  payment_receipt_url: string | null;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
  customized_items: any[] | null;
  created_at: string;
  rejection_reason: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  refund_status: 'none' | 'pending' | 'overdue' | 'awaiting_customer_confirmation' | 'processed' | 'failed';
  refund_amount: number;
  refund_due_at?: string | null;
  refunded_at: string | null;
  refund_account_details: string | null;
  profiles: { full_name: string; email: string; avatar_url: string | null; phone_number: string | null } | null;
  packages: { name: string; tier: string } | null;
  reviews: Review[] | null;
};

type RefundDispute = {
  id: string;
  booking_id: string;
  customer_id: string;
  reason: string;
  status: 'open' | 'investigating' | 'resolved';
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  caterer_response: string | null;
  caterer_responded_at: string | null;
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
  pending:   { label: 'Pending',    color: '#B45309', bg: '#FEF3C7', icon: Clock },
  confirmed: { label: 'Confirmed', color: '#15803D', bg: '#DCFCE7', icon: CheckCircle },
  paid:      { label: 'Paid',      color: '#15803D', bg: '#DCFCE7', icon: ShieldCheck },
  ongoing:   { label: 'Ongoing',   color: '#C2410C', bg: '#FFEDD5', icon: RefreshCw },
  completed: { label: 'Completed', color: '#1E40AF', bg: '#DBEAFE', icon: PartyPopper },
  rejected:  { label: 'Rejected',  color: '#B91C1C', bg: '#FEE2E2', icon: XCircle },
  cancelled: { label: 'Cancelled', color: '#4B5563', bg: '#F3F4F6', icon: Ban },
};

const FILTERS = ['all', 'pending', 'confirmed', 'paid', 'ongoing', 'completed', 'cancelled', 'rejected'];

const CATERER_CANCEL_REASONS = [
  "Equipment or kitchen failure",
  "Staffing emergency",
  "Personal/Family emergency",
  "Event location/logistics issue",
  "Other"
];

const hasVerifiedDownpayment = (booking: Booking): boolean =>
  Boolean(
    booking.payment_verified_at &&
    Number.isFinite(Number(booking.downpayment_amount)) &&
    Number(booking.downpayment_amount) > 0
  );

type RefundTransferSubmission = {
  booking_id: string;
  transfer_reference: string;
  proof_path: string;
  status: 'submitted' | 'verified' | 'rejected';
  submitted_at: string;
  review_note: string | null;
  submitted_late: boolean | null;
};

const formatRefundDestination = (raw: string | null): string => {
  if (!raw) return '';
  try {
    const details = JSON.parse(raw);
    if (!details || typeof details !== 'object') return raw;
    const method = String(details.method || details.payment_method || details.refund_method || 'Refund account');
    const name = String(details.account_holder || details.account_holder_name || details.account_name || details.name || '');
    const number = String(details.account_number || details.mobile_number || details.number || details.gcash_number || '');
    const bank = String(details.bank_name || '');
    return [method.toUpperCase(), bank, name, number].filter(Boolean).join(' · ');
  } catch {
    return raw;
  }
};

const getCancelWarningMessage = (booking: Booking | null) => {
  if (!booking) return '';
  const refund = hasVerifiedDownpayment(booking)
    ? Number(booking.downpayment_amount)
    : 0;
  const [year, month, day] = booking.event_date.slice(0, 10).split('-').map(Number);
  const today = new Date();
  const daysBeforeEvent = Math.round(
    (Date.UTC(year, month - 1, day) -
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) /
      86400000
  );
  const urgency = daysBeforeEvent < 7
    ? '⚠️ URGENT: The event is less than 7 days away. The Customer may have difficulty finding a replacement. '
    : '';

  return refund > 0
    ? `${urgency}Cancelling as the Caterer requires a 100% refund of the verified downpayment (₱${refund.toLocaleString('en-PH')}), regardless of the event date. You are responsible for transferring the refund to the Customer’s chosen account. Platform Staff monitors the refund and handles disputes.`
    : `${urgency}No verified downpayment is recorded, so cancelling this booking does not create a refund. The Customer will be notified.`;
};

export default function CatererBookings() {
  const { catererData, refreshCatererData } = useAuth() as any;
  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [quotaRefresh, setQuotaRefresh] = useState(0);
  const [refundAlerts, setRefundAlerts] = useState<Booking[]>([]);
  const [clockNow, setClockNow] = useState(Date.now());
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState('all');
  const [selected, setSelected]         = useState<Booking | null>(null);
  const [updating, setUpdating]         = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [refundSubmissions, setRefundSubmissions] = useState<Record<string, RefundTransferSubmission>>({});
  const [disputes, setDisputes] = useState<RefundDispute[]>([]);
  const [disputesError, setDisputesError] = useState('');
  const [showDisputes, setShowDisputes] = useState(false);
  const [disputeFilter, setDisputeFilter] = useState<'all' | 'open' | 'investigating' | 'resolved'>('all');
  const [activeDispute, setActiveDispute] = useState<RefundDispute | null>(null);
  const [disputeReply, setDisputeReply] = useState('');
  const [savingDisputeReply, setSavingDisputeReply] = useState(false);
  const [disputeProofUrl, setDisputeProofUrl] = useState<string | null>(null);
  const [loadingDisputeProof, setLoadingDisputeProof] = useState(false);
  const [refundReference, setRefundReference] = useState('');
  const [refundProof, setRefundProof] = useState<{ base64: string; mimeType: string; uri: string } | null>(null);
  const [submittingRefund, setSubmittingRefund] = useState(false);


  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);

  const [counts, setCounts]            = useState<Record<string, number>>({});
  const [chatBooking, setChatBooking] = useState<Booking | null>(null);

  const loadScope = useRef('');
  loadScope.current = `${catererData?.id ?? ''}:${filter}`;
  const loadVersion = useRef(0);
  const load = async (silent = false) => {
    const scope = loadScope.current;
    const version = ++loadVersion.current;
    const isCurrent = () => scope === loadScope.current && version === loadVersion.current;
    if (!catererData?.id) return;
    if (!silent) setLoading(true);

    if (refreshCatererData) {
      await refreshCatererData();
      if (!isCurrent()) return;
    }

    let query = supabase
      .from('bookings')
      .select('*, customer_id, profiles(full_name, email, avatar_url, phone_number), packages(name, tier), reviews(id, food_quality, service_quality, timeliness, overall, comment, caterer_reply, created_at)')
      .eq('caterer_id', catererData.id)
      .order('created_at', { ascending: false });

    if (filter !== 'all') query = query.eq('status', filter);
    const { data, error: bookingLoadError } = await query;
    if (!isCurrent()) return;
    if (bookingLoadError) { setLoading(false); return; }
    setBookings((data as any) ?? []);

    // Fetch actionable refund deadlines separately so alerts remain visible under every filter.
    const { data: refundAlertRows, error: refundAlertError } = await supabase
      .from('bookings')
      .select('*, customer_id, profiles(full_name, email, avatar_url, phone_number), packages(name, tier), reviews(id, food_quality, service_quality, timeliness, overall, comment, caterer_reply, created_at)')
      .eq('caterer_id', catererData.id)
      .eq('status', 'cancelled')
      .in('refund_status', ['pending', 'overdue'])
      .gt('refund_amount', 0);
    if (!isCurrent()) return;
    if (refundAlertError) {
      console.warn('Unable to load refund deadline alerts:', refundAlertError.message);
      setRefundAlerts([]);
    } else {
      setRefundAlerts((refundAlertRows ?? []) as unknown as Booking[]);
    }

    // Load refund disputes independently of the booking status filter.
    const { data: ownedBookings, error: ownedError } = await supabase
      .from('bookings').select('id').eq('caterer_id', catererData.id);
    if (!isCurrent()) return;
    if (ownedError) {
      setDisputesError(ownedError.message);
      setDisputes([]);
    } else if (!ownedBookings?.length) {
      setDisputes([]);
      setDisputesError('');
    } else {
      const { data: disputeRows, error: disputeError } = await supabase
        .from('refund_disputes')
        .select('id,booking_id,customer_id,reason,status,created_at,updated_at,resolved_at,caterer_response,caterer_responded_at')
        .in('booking_id', ownedBookings.map(b => b.id))
        .order('created_at', { ascending: false });
      if (!isCurrent()) return;
      setDisputesError(disputeError?.message ?? '');
      setDisputes((disputeRows as RefundDispute[]) ?? []);
    }

    // Refund evidence is tracked separately from bookings.refund_status.
    const { data: transferRows, error: transferError } = await supabase
      .from('refund_transfer_submissions')
      .select('booking_id, transfer_reference, proof_path, status, submitted_at, review_note, submitted_late')
      .eq('caterer_id', catererData.id);
    if (!isCurrent()) return;
    if (!transferError) {
      const byBooking: Record<string, RefundTransferSubmission> = {};
      (transferRows ?? []).forEach((row: any) => { byBooking[row.booking_id] = row; });
      setRefundSubmissions(byBooking);
    }

    const statuses = ['pending', 'confirmed', 'paid', 'ongoing', 'completed', 'cancelled', 'rejected'];
    const countRes = await Promise.all(
      statuses.map(s => supabase.from('bookings').select('id', { count: 'exact', head: true })
        .eq('caterer_id', catererData.id).eq('status', s))
    );
    if (!isCurrent()) return;
    const c: Record<string, number> = {};
    statuses.forEach((s, i) => { c[s] = countRes[i].count ?? 0; });
    c.all = Object.values(c).reduce((a, b) => a + b, 0);
    setCounts(c);
    if (selected) {
      const { data: current } = await supabase.from('bookings')
        .select('*, customer_id, profiles(full_name, email, avatar_url, phone_number), packages(name, tier), reviews(id, food_quality, service_quality, timeliness, overall, comment, caterer_reply, created_at)')
        .eq('id', selected.id).eq('caterer_id', catererData.id).maybeSingle();
      if (!isCurrent()) return;
      if (current) setSelected(previous => previous?.id === current.id ? current as unknown as Booking : previous);
    }
    setLoading(false);
  };

  useBookingRefresh(catererData?.id ? `${catererData.id}:${filter}` : null, () => load(true));
  // Update deadline labels while the screen is open.
  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const getRefundAlert = (booking: Booking) => {
    if (booking.status !== 'cancelled' ||
        !['pending', 'overdue'].includes(booking.refund_status) ||
        Number(booking.refund_amount) <= 0) return null;
    const dueString = booking.refund_due_at ||
      (booking.cancelled_at
        ? new Date(new Date(booking.cancelled_at).getTime() + 72 * 60 * 60 * 1000).toISOString()
        : null);
    if (!dueString) return { urgent: true, title: 'Refund deadline unavailable', detail: 'Check the refund deadline with Platform Staff.' };
    const dueMs = new Date(dueString).getTime();
    if (!Number.isFinite(dueMs)) return { urgent: true, title: 'Refund deadline unavailable', detail: 'Check the refund deadline with Platform Staff.' };
    const remaining = dueMs - clockNow;
    const dateLabel = new Date(dueMs).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
    const dueDay = new Date(dueMs).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const today = new Date(clockNow).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    if (remaining <= 0 || booking.refund_status === 'overdue') {
      return { urgent: true, title: 'OVERDUE — Refund action required', detail: `Deadline: ${dateLabel} (Philippine time). Submit proof after transferring the refund.` };
    }
    if (dueDay === today) {
      return { urgent: true, title: 'REFUND DUE TODAY', detail: `Transfer and submit proof by ${dateLabel} (Philippine time).` };
    }
    if (remaining <= 24 * 60 * 60 * 1000) {
      return { urgent: true, title: 'Refund due within 24 hours', detail: `Transfer and submit proof by ${dateLabel} (Philippine time).` };
    }
    return { urgent: false, title: 'Refund deadline approaching', detail: `Transfer and submit proof by ${dateLabel} (Philippine time).` };
  };


  const openDispute = async (dispute: RefundDispute) => {
    setActiveDispute(dispute);
    setDisputeReply(dispute.caterer_response ?? '');
    setDisputeProofUrl(null);
    const submission = refundSubmissions[dispute.booking_id];
    if (!submission?.proof_path) return;
    setLoadingDisputeProof(true);
    const { data, error } = await supabase.storage
      .from('refund-proofs').createSignedUrl(submission.proof_path, 300);
    if (error) console.warn('Unable to load refund proof:', error.message);
    setDisputeProofUrl(data?.signedUrl ?? null);
    setLoadingDisputeProof(false);
  };

  const submitDisputeReply = async () => {
    if (!activeDispute || savingDisputeReply || activeDispute.status === 'resolved') return;
    const reply = disputeReply.trim();
    if (reply.length < 10 || reply.length > 2000) {
      Alert.alert('Response required', 'Enter 10 to 2000 characters describing your investigation.');
      return;
    }
    setSavingDisputeReply(true);
    try {
      const { error } = await supabase.rpc('caterer_respond_to_refund_dispute', {
        p_dispute_id: activeDispute.id,
        p_response: reply,
      });
      if (error) throw error;
      setDisputes(prev => prev.map(d => d.id === activeDispute.id
        ? { ...d, status: 'investigating', caterer_response: reply, caterer_responded_at: new Date().toISOString() }
        : d));
      setActiveDispute(null);
      // Database trigger sends the customer notification after the RPC updates the dispute.
      Alert.alert(
        'Response saved',
        'Your investigation update was recorded. The customer notification is generated by Supabase. Only the Customer can confirm receipt of the refund.'
      );
      void load();
    } catch (error: any) {
      Alert.alert('Unable to save response', error?.message ?? 'Please try again.');
    } finally {
      setSavingDisputeReply(false);
    }
  };

  const handleAction = async (action: string, booking: Booking) => {
    if (updating) return;
    setUpdating(true);
    try {
    let updates: Record<string, any> = {};

    switch (action) {
      case 'confirm':
        updates = { status: 'confirmed' };
        break;

      case 'reject':
        if (!rejectReason.trim()) {
          Alert.alert('Required', 'Please provide a reason for rejection.');
          setUpdating(false); return;
        }
        updates = { 
          status: 'rejected',
          rejection_reason: rejectReason
        };
        break;

      case 'caterer_cancel': {
        if (!['confirmed', 'paid'].includes(booking.status)) {
          Alert.alert('Cancellation Unavailable', 'Only confirmed or paid bookings can be cancelled here.');
          setUpdating(false); return;
        }
        const finalCancelReason = selectedReason === 'Other' ? customReason.trim() : selectedReason;
        if (!finalCancelReason) {
          Alert.alert('Required', 'Please select or specify a reason for cancellation.');
          setUpdating(false); return;
        }

        const refundAmount = hasVerifiedDownpayment(booking)
          ? Number(booking.downpayment_amount)
          : 0;
        updates = {
          status: 'cancelled',
          cancelled_by: 'caterer',
          cancellation_reason: finalCancelReason,
          cancelled_at: new Date().toISOString(),
          refund_status: refundAmount > 0 ? 'pending' : 'none',
          refund_amount: refundAmount,
          refunded_at: null,
        };
        break;
      }

      case 'mark_ongoing':
        updates = { status: 'ongoing' };
        break;

      case 'complete':
        updates = { status: 'completed' };
        break;
    }

    // Re-read cancellation eligibility to avoid acting on stale booking data.
    if (action === 'caterer_cancel') {
      const { data: current, error: readError } = await supabase
        .from('bookings')
        .select('status, payment_verified_at, downpayment_amount')
        .eq('id', booking.id)
        .eq('caterer_id', catererData.id)
        .single();
      if (readError || !current || current.status !== booking.status) {
        Alert.alert('Booking Changed', 'This booking has changed. Refresh and try again.');
        setUpdating(false); load(); return;
      }
      const verifiedAmount = current.payment_verified_at
        ? Number(current.downpayment_amount) : 0;
      updates.refund_amount = Number.isFinite(verifiedAmount) && verifiedAmount > 0
        ? verifiedAmount : 0;
      updates.refund_status = updates.refund_amount > 0 ? 'pending' : 'none';
    }

    let updateQuery = supabase.from('bookings').update(updates).eq('id', booking.id);
    if (action === 'caterer_cancel') {
      updateQuery = updateQuery.eq('caterer_id', catererData.id).eq('status', booking.status);
    }
    if (action === 'confirm') {
      updateQuery = updateQuery.eq('caterer_id', catererData.id).eq('status', 'pending');
    }
    const { data: updatedRows, error } = await updateQuery.select('id');
    if (error || (['confirm', 'caterer_cancel'].includes(action) && updatedRows?.length !== 1)) {
      if (action === 'confirm' && isMonthlyQuotaRejection(error)) {
        setQuotaRefresh(value => value + 1);
        Alert.alert('Monthly booking limit reached', 'This booking remains pending. Your plan has reached its monthly accepted-booking limit. Review Plans & Billing or confirm in a later month. Pending requests are still allowed.');
        return;
      }
      Alert.alert('Error', error?.message || 'The booking was not updated. It may have changed or you may no longer have permission. Refresh and try again.');
      setUpdating(false); return;
    }

    setUpdating(false);
    setQuotaRefresh(value => value + 1);
    setSelected(null);
    setShowRejectModal(false);
    setShowCancelModal(false);
    setRejectReason('');
    setSelectedReason('');
    setCustomReason('');
    load();
    } catch (error) {
      Alert.alert('Booking not updated', error instanceof Error ? error.message : 'Please refresh and try again.');
    } finally {
      setUpdating(false);
    }
  };

  const pickRefundProof = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to select your transfer receipt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Invalid image', 'Could not read the receipt. Please choose another image.');
      return;
    }
    setRefundProof({
      base64: asset.base64,
      mimeType: asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
      uri: asset.uri,
    });
  };

  const submitRefundTransfer = async (booking: Booking) => {
    if (submittingRefund || !catererData?.id) return;
    const reference = refundReference.trim();
    if (reference.length < 5 || reference.length > 200) {
      Alert.alert('Reference required', 'Enter a transfer reference between 5 and 200 characters.');
      return;
    }
    if (!refundProof) {
      Alert.alert('Receipt required', 'Select a screenshot or receipt of the completed transfer.');
      return;
    }
    if (!booking.refund_account_details?.trim()) {
      Alert.alert('Destination missing', 'Wait for the Customer to provide their refund destination.');
      return;
    }

    setSubmittingRefund(true);
    let uploadedPath: string | null = null;
    let submissionAttempted = false;
    try {
      const { data: current, error: checkError } = await supabase
        .from('bookings')
        .select('id, status, refund_status, refund_amount, refund_account_details')
        .eq('id', booking.id)
        .eq('caterer_id', catererData.id)
        .single();
      if (checkError || !current || current.status !== 'cancelled' ||
          !['pending', 'overdue'].includes(current.refund_status) ||
          Number(current.refund_amount) <= 0 || !current.refund_account_details) {
        throw new Error('This booking is no longer eligible for refund proof submission. Refresh the page.');
      }

      const { data: existing, error: existingError } = await supabase
        .from('refund_transfer_submissions')
        .select('status')
        .eq('booking_id', booking.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) throw new Error('A transfer submission already exists. Contact Platform Staff if a correction is needed.');

      const extension = refundProof.mimeType === 'image/png' ? 'png' : 'jpg';
      uploadedPath = `${booking.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('refund-proofs')
        .upload(uploadedPath, decode(refundProof.base64), {
          contentType: refundProof.mimeType,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      submissionAttempted = true;
      const { data: functionResult, error: functionError } = await supabase.functions.invoke(
        'submit-refund-proof',
        {
          body: {
            booking_id: booking.id,
            transfer_reference: reference,
            proof_path: uploadedPath,
          },
        },
      );
      if (functionError) throw functionError;
      if (functionResult?.success !== true ||
          functionResult?.submission?.refund_status !== 'awaiting_customer_confirmation') {
        throw new Error(functionResult?.error || 'Refund submission was not confirmed by the server.');
      }

      uploadedPath = null;
      // Database trigger sends the customer notification when the evidence row is inserted.

      setRefundReference('');
      setRefundProof(null);
      setSelected(null);
      Alert.alert(
        'Proof submitted',
        functionResult.submission.submitted_late
          ? 'Transfer proof was submitted after the deadline and recorded as late. The Customer must confirm receipt of the funds.'
          : 'Transfer proof submitted. The Customer must confirm receipt of the funds.',
      );
      await load();
    } catch (error: any) {
      // Never delete a receipt after a server submission was attempted:
      // a network timeout may occur after the server committed the evidence.
      if (uploadedPath && !submissionAttempted) {
        const { error: cleanupError } = await supabase.storage.from('refund-proofs').remove([uploadedPath]);
        if (cleanupError) console.warn('Refund upload cleanup failed:', cleanupError.message);
      }
      Alert.alert(
        'Submission not confirmed',
        submissionAttempted
          ? 'The server did not confirm the result. Refresh bookings before retrying. Your receipt was kept to avoid losing evidence.'
          : error?.message || 'Unable to upload refund evidence.',
      );
      if (submissionAttempted) await load();
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handleReplyReview = async (reviewId: string) => {
    const text = replyText[reviewId]?.trim();
    if (!text) {
      Alert.alert('Required', 'Please enter a reply message.');
      return;
    }
    setUpdating(true);
    const { error } = await supabase
      .from('reviews')
      .update({ caterer_reply: text })
      .eq('id', reviewId);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Reply sent successfully!');
      setReplyText(prev => ({ ...prev, [reviewId]: '' }));
      setReplyingId(null);
      load();
      if (selected) {
        const { data: updatedBooking } = await supabase
          .from('bookings')
          .select('*, customer_id, profiles(full_name, email, avatar_url, phone_number), packages(name, tier), reviews(id, food_quality, service_quality, timeliness, overall, comment, caterer_reply, created_at)')
          .eq('id', selected.id)
          .single();
        if (updatedBooking) setSelected(updatedBooking as any);
      }
    }
    setUpdating(false);
  };

  const getRefundDeadlineLabel = (booking: Booking): string | null => {
    if (booking.status !== 'cancelled' || !['pending', 'overdue'].includes(booking.refund_status) || Number(booking.refund_amount) <= 0) return null;
    const start = booking.refund_due_at || (booking.cancelled_at ? new Date(new Date(booking.cancelled_at).getTime() + 72 * 60 * 60 * 1000).toISOString() : null);
    if (!start) return 'Refund deadline unavailable';
    const due = new Date(start);
    if (Number.isNaN(due.getTime())) return 'Refund deadline unavailable';
    const formatted = due.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    return clockNow >= due.getTime() ? `OVERDUE · Due ${formatted}` : `Due by ${formatted} (72 hours after cancellation)`;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatTime = (t: string | null) => {
    if (!t) return 'Time TBA';
    return t;
  };

  const openMapPin = (venueQuery: string) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(venueQuery)}`,
      android: `geo:0,0?q=${encodeURIComponent(venueQuery)}`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueQuery)}`);
      });
    }
  };

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const accountStanding = catererData?.account_standing ?? 'good_standing';

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <View>
          <Text style={styles.pageTitle}>Bookings</Text>
          <Text style={styles.pageSub}>{counts.all ?? 0} total requests · {counts.pending ?? 0} pending action</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { void load(); }} activeOpacity={0.8}>
          <RefreshCw size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <MonthlyBookingQuotaSummary compact refreshKey={quotaRefresh} />
      </View>

      {accountStanding !== 'good_standing' && (
        <View style={[
          styles.debtBanner,
          accountStanding === 'refund_overdue' ? styles.debtBannerWarning : styles.debtBannerDanger,
        ]}>
          <ShieldAlert size={20} color={accountStanding === 'refund_overdue' ? '#D97706' : '#DC2626'} />
          <View style={{ flex: 1 }}>
            <Text style={[
              styles.debtBannerTitle,
              { color: accountStanding === 'refund_overdue' ? '#92400E' : '#991B1B' },
            ]}>
              {accountStanding === 'refund_overdue'
                ? 'Action Required: Overdue Customer Refund'
                : 'Account Restricted'}
            </Text>
            <Text style={[
              styles.debtBannerText,
              { color: accountStanding === 'refund_overdue' ? '#B45309' : '#B91C1C' },
            ]}>
              {accountStanding === 'refund_overdue'
                ? 'A customer refund has passed its 72-hour proof deadline. Submit transfer evidence for each outstanding refund. Only the Customer can confirm receipt; no platform debt payment is required.'
                : 'Your caterer account is suspended. Contact platform administration for account assistance.'}
            </Text>
          </View>
        </View>
      )}

      {refundAlerts.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFFFF', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color="#B91C1C" />
            <Text style={{ fontWeight: '900', fontSize: 14, color: '#991B1B', flex: 1 }}>
              Refund deadlines — {refundAlerts.length} action{refundAlerts.length === 1 ? '' : 's'} required
            </Text>
          </View>
          {refundAlerts
            .slice()
            .sort((a, b) => {
              const aDue = new Date(a.refund_due_at || a.cancelled_at || 0).getTime();
              const bDue = new Date(b.refund_due_at || b.cancelled_at || 0).getTime();
              return aDue - bDue;
            })
            .map(b => {
              const warning = getRefundAlert(b);
              if (!warning) return null;
              return (
                <TouchableOpacity key={b.id}
                  onPress={() => { setShowDisputes(false); setSelected(b); }}
                  activeOpacity={0.85}
                  style={{
                    padding: 12, borderRadius: 10, borderWidth: 1,
                    borderColor: warning.urgent ? '#FCA5A5' : '#FCD34D',
                    backgroundColor: warning.urgent ? '#FEF2F2' : '#FFFBEB',
                  }}>
                  <Text style={{ fontWeight: '900', color: warning.urgent ? '#991B1B' : '#92400E', fontSize: 13 }}>
                    {warning.title} · ₱{Number(b.refund_amount).toLocaleString('en-PH')}
                  </Text>
                  <Text style={{ marginTop: 4, fontSize: 12, color: '#78350F' }}>
                    {b.profiles?.full_name || 'Customer'} · {warning.detail}
                  </Text>
                  <Text style={{ marginTop: 5, fontWeight: '700', fontSize: 12, color: '#1D4ED8' }}>
                    Tap to open refund details ›
                  </Text>
                </TouchableOpacity>
              );
            })}
          <Text style={{ fontSize: 11, color: '#64748B', paddingBottom: 6 }}>
            Deadline reminders are shown in-app. Refresh to check the latest refund status.
          </Text>
        </View>
      )}

      <View style={styles.disputeToggleWrap}>
        <TouchableOpacity
          style={[styles.disputeToggle, showDisputes && styles.disputeToggleActive]}
          onPress={() => setShowDisputes(v => !v)}
          activeOpacity={0.85}
        >
          <ShieldAlert size={18} color={showDisputes ? '#FFFFFF' : '#B91C1C'} />
          <Text style={[styles.disputeToggleText, showDisputes && { color: '#FFFFFF' }]}>
            {showDisputes ? 'Back to Bookings' : 'Customer Refund Disputes'}
          </Text>
          {disputes.filter(d => d.status !== 'resolved').length > 0 && (
            <View style={styles.disputeCount}>
              <Text style={styles.disputeCountText}>{disputes.filter(d => d.status !== 'resolved').length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {showDisputes ? (
        <ScrollView style={styles.list} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
          <View style={styles.disputeHeadingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.disputeHeading}>Refund Disputes</Text>
              <Text style={styles.disputeSubheading}>Investigate customer reports and respond with updates.</Text>
            </View>
            <TouchableOpacity onPress={() => { void load(); }} style={styles.refreshBtn}>
              <RefreshCw size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
            {(['all', 'open', 'investigating', 'resolved'] as const).map(f => (
              <TouchableOpacity key={f} onPress={() => setDisputeFilter(f)}
                style={[styles.filterChip, disputeFilter === f && styles.filterChipActive]}>
                <Text style={[styles.filterText, disputeFilter === f && styles.filterTextActive]}>
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? disputes.length : disputes.filter(d => d.status === f).length})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {!!disputesError && (
            <View style={styles.disputeErrorBox}>
              <AlertTriangle size={18} color="#B91C1C" />
              <Text style={{ color: '#991B1B', flex: 1 }}>{disputesError}</Text>
            </View>
          )}
          {loading ? <ActivityIndicator size="large" color={Colors.orange} /> :
            disputes.filter(d => disputeFilter === 'all' || d.status === disputeFilter).length === 0 ? (
              <View style={styles.disputeEmpty}>
                <ShieldCheck size={38} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No refund disputes</Text>
                <Text style={styles.emptySub}>Customer reports will appear here.</Text>
              </View>
            ) : disputes.filter(d => disputeFilter === 'all' || d.status === disputeFilter).map(d => {
              const related = bookings.find(b => b.id === d.booking_id);
              return (
                <TouchableOpacity key={d.id} style={styles.disputeCard} onPress={() => openDispute(d)}>
                  <View style={styles.disputeCardTop}>
                    <View style={styles.disputeCustomerIcon}><ShieldAlert size={20} color="#B91C1C" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.disputeCardTitle}>{related?.profiles?.full_name ?? 'Customer refund report'}</Text>
                      <Text style={styles.disputeCardMeta}>{new Date(d.created_at).toLocaleString('en-PH')}</Text>
                    </View>
                    <View style={[styles.disputeBadge, { backgroundColor: d.status === 'resolved' ? '#DCFCE7' : d.status === 'investigating' ? '#DBEAFE' : '#FEF3C7' }]}>
                      <Text style={{ fontWeight: '800', fontSize: 11, color: d.status === 'resolved' ? '#166534' : d.status === 'investigating' ? '#1D4ED8' : '#92400E' }}>{d.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.disputeReason} numberOfLines={3}>{d.reason}</Text>
                  <View style={styles.disputeCardBottom}>
                    <Text style={styles.disputeAmount}>Refund: ₱{Number(related?.refund_amount ?? 0).toLocaleString('en-PH')}</Text>
                    <Text style={styles.disputeOpenText}>View Details  ›</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
        </ScrollView>
      ) : (
        <>
      <View style={styles.filterOuterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map(f => {
            const isActive = filter === f;
            const label = f === 'all' ? 'All Bookings' : STATUS_CONFIG[f]?.label ?? f;
            const count = counts[f] || 0;

            return (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setFilter(f)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {label} {count > 0 ? `(${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.orange} /></View>
      ) : bookings.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Inbox size={40} color={Colors.orange} />
          </View>
          <Text style={styles.emptyTitle}>No {filter !== 'all' ? filter.replace('_', ' ') : ''} bookings</Text>
          <Text style={styles.emptySub}>Bookings will show up here once clients send requests your way.</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 14 }}>
          {bookings.map(b => {
            const sc = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;
            const StatusIcon = sc.icon;

            let displayLabel = sc.label;
            if (b.status === 'cancelled') {
              displayLabel = b.cancelled_by === 'caterer' ? 'Cancelled by You' : 'Cancelled by Customer';
            }

            return (
              <TouchableOpacity key={b.id} style={styles.bookingCard} onPress={() => setSelected(b)} activeOpacity={0.9}>
                <View style={[styles.cardStripe, { backgroundColor: sc.bg }]}>
                  <View style={styles.cardStripeLeft}>
                    <StatusIcon size={14} color={sc.color} />
                    <Text style={[styles.cardStripeText, { color: sc.color }]}>{displayLabel}</Text>
                  </View>
                  <Text style={[styles.cardStripeTime, { color: sc.color }]}>{timeAgo(b.created_at)}</Text>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardCustomerRow}>
                    {b.profiles?.avatar_url ? (
                      <Image source={{ uri: b.profiles.avatar_url }} style={styles.customerAvatar} />
                    ) : (
                      <View style={styles.customerAvatarPlaceholder}>
                        <Text style={styles.customerAvatarText}>
                          {(b.profiles?.full_name ?? 'C').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customerName} numberOfLines={1}>{b.profiles?.full_name ?? '—'}</Text>
                      <Text style={styles.eventTypeName} numberOfLines={1}>{b.event_type ?? 'Catering Event'}</Text>
                    </View>
                    <View style={styles.cardAmount}>
                      <Text style={styles.cardAmountValue}>₱{Number(b.total_cost).toLocaleString()}</Text>
                      <Text style={styles.cardAmountSub}>total cost</Text>
                    </View>
                  </View>

                  <View style={styles.cardMetaGrid}>
                    <View style={styles.metaItem}>
                      <Calendar size={13} color={Colors.textSecondary} />
                      <Text style={styles.metaText}>{formatDate(b.event_date)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Clock size={13} color={Colors.textSecondary} />
                      <Text style={styles.metaText}>{formatTime(b.event_time)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Users size={13} color={Colors.textSecondary} />
                      <Text style={styles.metaText}>{b.guest_count} guests</Text>
                    </View>
                  </View>

                  {b.venue && (
                    <View style={styles.venueRow}>
                      <MapPin size={13} color={Colors.orange} />
                      <Text style={styles.venueText} numberOfLines={1}>{b.venue}</Text>
                    </View>
                  )}

                  {b.packages && (
                    <View style={styles.pkgTag}>
                      <Package size={12} color={Colors.textSecondary} />
                      <Text style={styles.pkgTagText}>{b.packages.name}</Text>
                    </View>
                  )}

                  {getRefundAlert(b) && (() => {
                    const warning = getRefundAlert(b)!;
                    return (
                      <View style={{
                        marginTop: 10, padding: 10, borderRadius: 9, borderWidth: 1,
                        borderColor: warning.urgent ? '#FCA5A5' : '#FCD34D',
                        backgroundColor: warning.urgent ? '#FEF2F2' : '#FFFBEB',
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <AlertTriangle size={15} color={warning.urgent ? '#B91C1C' : '#B45309'} />
                          <Text style={{ fontSize: 12, fontWeight: '900', color: warning.urgent ? '#991B1B' : '#92400E', flex: 1 }}>
                            {warning.title} · ₱{Number(b.refund_amount).toLocaleString('en-PH')}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#78350F', marginTop: 4 }}>{warning.detail}</Text>
                      </View>
                    );
                  })()}

                  {b.status === 'pending' && (
                    <View style={styles.quickActions}>
                      <View style={[styles.quickBtn, styles.quickBtnConfirm]}>
                        <Check size={14} color={Colors.white} strokeWidth={3} />
                        <Text style={styles.quickBtnText}>Review & Respond</Text>
                      </View>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

        </>
      )}

      <Modal visible={!!activeDispute} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => setActiveDispute(null)}>
        {activeDispute && (() => {
          const related = bookings.find(b => b.id === activeDispute.booking_id);
          const submission = refundSubmissions[activeDispute.booking_id];
          return (
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setActiveDispute(null)} style={styles.modalCloseBtn}>
                  <X size={20} color={Colors.black} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Refund Dispute</Text>
                <View style={{ width: 36 }} />
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }}>
                <View style={styles.disputeCard}>
                  <Text style={styles.disputeSectionTitle}>Customer Report</Text>
                  <Text style={styles.disputeCardMeta}>{related?.profiles?.full_name ?? 'Customer'} · {new Date(activeDispute.created_at).toLocaleString('en-PH')}</Text>
                  <Text style={styles.disputeReason}>{activeDispute.reason}</Text>
                  <Text style={styles.disputeAmount}>Dispute: {activeDispute.status.toUpperCase()}</Text>
                </View>
                <View style={styles.disputeCard}>
                  <Text style={styles.disputeSectionTitle}>Refund & Transfer Evidence</Text>
                  <Text style={styles.disputeInfo}>Amount: ₱{Number(related?.refund_amount ?? 0).toLocaleString('en-PH')}</Text>
                  <Text style={styles.disputeInfo}>Refund status: {related?.refund_status ?? 'Pending'}</Text>
                  <Text style={styles.disputeInfo}>Customer destination: {formatRefundDestination(related?.refund_account_details ?? null) || 'Not provided'}</Text>
                  {submission ? (
                    <>
                      <Text style={styles.disputeInfo}>Transfer reference: {submission.transfer_reference}</Text>
                      <Text style={styles.disputeInfo}>Proof status: {submission.status}</Text>
                      <Text style={styles.disputeInfo}>Submitted: {new Date(submission.submitted_at).toLocaleString('en-PH')}</Text>
                      {loadingDisputeProof && <ActivityIndicator color={Colors.orange} />}
                      {disputeProofUrl && <Image source={{ uri: disputeProofUrl }} resizeMode="contain" style={styles.disputeReceiptImage} />}
                      {!loadingDisputeProof && !disputeProofUrl && <Text style={styles.refundHint}>Receipt image unavailable. Check your storage access policy.</Text>}
                    </>
                  ) : <Text style={styles.refundHint}>No transfer proof has been submitted yet.</Text>}
                </View>
                <View style={styles.disputeCard}>
                  <Text style={styles.disputeSectionTitle}>Investigation Response</Text>
                  {activeDispute.caterer_responded_at && <Text style={styles.disputeCardMeta}>Last response: {new Date(activeDispute.caterer_responded_at).toLocaleString('en-PH')}</Text>}
                  {activeDispute.status === 'resolved' ? (
                    <Text style={styles.disputeInfo}>{activeDispute.caterer_response ?? 'This dispute has been resolved following Customer confirmation.'}</Text>
                  ) : (
                    <>
                      <Text style={styles.refundHint}>Explain the transfer status, what you checked, and next steps. Do not claim the refund is received without Customer confirmation.</Text>
                      <TextInput style={styles.disputeResponseInput} multiline textAlignVertical="top"
                        placeholder="Describe your investigation (10–2000 characters)..."
                        placeholderTextColor={Colors.textMuted}
                        maxLength={2000} value={disputeReply} onChangeText={setDisputeReply} />
                      <Text style={styles.disputeCardMeta}>{disputeReply.length}/2000 characters</Text>
                      <TouchableOpacity style={[styles.actionBtn, styles.actionBtnConfirm, { opacity: savingDisputeReply ? 0.6 : 1 }]}
                        onPress={submitDisputeReply} disabled={savingDisputeReply}>
                        {savingDisputeReply ? <ActivityIndicator color="#FFFFFF" /> :
                          <View style={styles.btnRow}><MessageSquareText size={17} color="#FFFFFF" /><Text style={styles.actionBtnText}>Save Investigation Update</Text></View>}
                      </TouchableOpacity>
                    </>
                  )}
                  <Text style={styles.refundHint}>Only the Customer can confirm receiving the refund. Staff monitors disputes.</Text>
                </View>
              </ScrollView>
            </View>
          );
        })()}
      </Modal>

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => { 
                  setSelected(null); 
                  setShowRejectModal(false); 
                  setShowCancelModal(false);
                  setRejectReason(''); 
                  setSelectedReason('');
                  setCustomReason('');
                  setRefundReference('');
                  setRefundProof(null);
                }}
                activeOpacity={0.8}
              >
                <X size={20} color={Colors.black} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Booking Summary</Text>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 20 }}>
              {(() => {
                const sc = STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.pending;
                const StatusIcon = sc.icon;
                let bannerLabel = sc.label;
                if (selected.status === 'cancelled') {
                  bannerLabel = selected.cancelled_by === 'caterer' ? 'Cancelled by You' : 'Cancelled by Customer';
                }
                return (
                  <View style={[styles.statusBanner, { backgroundColor: sc.bg }]}>
                    <StatusIcon size={18} color={sc.color} />
                    <Text style={[styles.statusBannerText, { color: sc.color }]}>
                      Status: {bannerLabel}
                    </Text>
                  </View>
                );
              })()}

              {['paid', 'ongoing', 'completed'].includes(selected.status) && (
                <View style={styles.receiptViewerBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <ShieldCheck size={18} color="#15803D" />
                    <Text style={styles.receiptViewerTitle}>Verified Downpayment E-Receipt</Text>
                  </View>
                  
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptLabel}>Payment Channel:</Text>
                    <Text style={styles.receiptVal}>{displayXenditPaymentMethod(selected.payment_method)}</Text>
                  </View>

                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptLabel}>Verified Downpayment:</Text>
                    <Text style={[styles.receiptVal, { color: '#15803D', fontWeight: '900' }]}>
                      ₱{Number(selected.downpayment_amount).toLocaleString()} · {displayXenditPaymentMethod(selected.payment_method)} via Xendit
                    </Text>
                  </View>

                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptLabel}>Payment Status:</Text>
                    <Text style={[styles.receiptVal, { color: '#15803D', fontWeight: '900' }]}>
                      SECURED & VERIFIED ✓
                    </Text>
                  </View>

                  {selected.payment_verified_at && (
                    <View style={styles.receiptDetailRow}>
                      <Text style={styles.receiptLabel}>Verified Timestamp:</Text>
                      <Text style={styles.receiptVal}>
                        {new Date(selected.payment_verified_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit', hour12: true
                        })}
                      </Text>
                    </View>
                  )}

                  <View style={[styles.receiptRefContainer, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#BBF7D0' }]}>
                    <Text style={styles.receiptLabel}>Transaction Reference:</Text>
                    <Text 
                      style={[
                        styles.receiptVal, 
                        { 
                          fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', 
                          fontSize: 11, 
                          textAlign: 'left', 
                          marginTop: 4, 
                          flexWrap: 'wrap' 
                        }
                      ]}
                    >
                      {selected.payment_receipt_url || `XENDIT-BK-${selected.id.slice(0, 8).toUpperCase()}`}
                    </Text>
                  </View>
                </View>
              )}

              {selected.status === 'cancelled' && (
                <View style={styles.alertBox}>
                  <Ban size={16} color="#4B5563" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertBoxTitle}>Booking Cancelled</Text>
                    <Text style={styles.alertBoxText}>
                      Initiated by: {selected.cancelled_by === 'caterer' ? 'You (Caterer)' : 'Customer'}
                    </Text>
                    {selected.cancellation_reason && (
                      <Text style={styles.alertBoxText}>Reason: {selected.cancellation_reason}</Text>
                    )}
                    
                    {selected.refund_status && selected.refund_status !== 'none' && (
                      <View style={{ marginTop: 8, padding: 10, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.black, marginBottom: 4 }}>
                          Refund Status: 
                          <Text style={{ color: selected.refund_status === 'processed' ? '#15803D' : '#D97706' }}> {selected.refund_status.toUpperCase()}</Text>
                        </Text>
                        <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                          Amount: ₱{Number(selected.refund_amount).toLocaleString()}
                        </Text>
                        {getRefundDeadlineLabel(selected) && (
                          <Text style={{ fontSize: 12, fontWeight: '800', color: getRefundDeadlineLabel(selected)?.startsWith('OVERDUE') ? '#B91C1C' : '#B45309', marginTop: 5 }}>
                            Refund deadline: {getRefundDeadlineLabel(selected)}
                          </Text>
                        )}
                        {selected.refund_account_details ? (
                          <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 4 }} selectable>
                            Customer refund destination: {formatRefundDestination(selected.refund_account_details)}
                          </Text>
                        ) : ['pending', 'overdue'].includes(selected.refund_status) ? (
                          <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 4 }}>
                            Awaiting the Customer’s refund destination details.
                          </Text>
                        ) : null}
                        <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' }}>
                          {selected.refund_status === 'processed' 
                            ? 'Refund completed after Customer confirmation. Keep your transfer receipt for your records.'
                            : 'You are responsible for transferring the refund. Platform Staff monitors progress and flags reported issues.'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {selected.status === 'cancelled' && ['pending', 'overdue', 'awaiting_customer_confirmation'].includes(selected.refund_status) &&
                Number(selected.refund_amount) > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionHeaderLabel}>REFUND TRANSFER & PROOF</Text>
                  <View style={styles.modalCard}>
                    <Text style={styles.refundTitle}>
                      Refund due: ₱{Number(selected.refund_amount).toLocaleString('en-PH')}
                    </Text>
                    <Text style={styles.refundHint}>
                      Transfer the money to the Customer using their selected account. Submit proof after the actual transfer. Platform Staff monitors the progress; the Customer confirms receiving the funds.
                    </Text>
                    {selected.refund_account_details ? (
                      <View style={styles.refundDestinationBox}>
                        <Text style={styles.fieldLabel}>Customer refund destination</Text>
                        <Text selectable style={styles.refundDestinationText}>
                          {formatRefundDestination(selected.refund_account_details)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.refundWaiting}>
                        Waiting for the Customer to provide a refund account. Do not transfer money until the destination is confirmed.
                      </Text>
                    )}
                    {refundSubmissions[selected.id] ? (
                      <View style={styles.refundDestinationBox}>
                        <Text style={styles.fieldLabel}>
                          Transfer proof: {refundSubmissions[selected.id].status.toUpperCase()}
                        </Text>
                        <Text style={styles.refundDestinationText}>
                          Reference: {refundSubmissions[selected.id].transfer_reference}
                        </Text>
                        <Text style={styles.refundHint}>
                          Submitted {new Date(refundSubmissions[selected.id].submitted_at).toLocaleString('en-PH')}
                          {refundSubmissions[selected.id].submitted_late ? ' · LATE' : ''}
                        </Text>
                        {refundSubmissions[selected.id].review_note && (
                          <Text style={styles.refundHint}>
                            Staff note: {refundSubmissions[selected.id].review_note}
                          </Text>
                        )}
                        <Text style={styles.refundHint}>
                          {refundSubmissions[selected.id].status === 'rejected'
                            ? 'An issue was flagged with this evidence. Contact Platform Staff about corrections.'
                            : 'Evidence is on record. The refund remains pending until the Customer confirms receiving the money.'}
                        </Text>
                      </View>
                    ) : selected.refund_account_details && ['pending', 'overdue'].includes(selected.refund_status) ? (
                      <View style={{ gap: 10, marginTop: 12 }}>
                        <Text style={styles.fieldLabel}>Transfer reference number *</Text>
                        <TextInput
                          style={styles.fieldInput}
                          placeholder="Enter bank or wallet transaction reference"
                          placeholderTextColor={Colors.textMuted}
                          value={refundReference}
                          onChangeText={setRefundReference}
                          autoCapitalize="characters"
                          maxLength={120}
                        />
                        <TouchableOpacity
                          style={styles.refundProofButton}
                          onPress={pickRefundProof}
                          disabled={submittingRefund}
                        >
                          <FileText size={17} color="#1D4ED8" />
                          <Text style={styles.refundProofButtonText}>
                            {refundProof ? 'Change receipt image' : 'Choose transfer receipt image *'}
                          </Text>
                        </TouchableOpacity>
                        {refundProof && (
                          <Image source={{ uri: refundProof.uri }} style={styles.refundProofPreview} resizeMode="contain" />
                        )}
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.actionBtnConfirm]}
                          disabled={submittingRefund}
                          onPress={() => submitRefundTransfer(selected)}
                        >
                          {submittingRefund
                            ? <ActivityIndicator color="#FFFFFF" />
                            : <Text style={styles.actionBtnText}>Submit Transfer Proof for Verification</Text>}
                        </TouchableOpacity>
                        <Text style={styles.refundHint}>
                          Submitting proof does not automatically mark the refund as processed.
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}

              {selected.status === 'rejected' && selected.rejection_reason && (
                <View style={[styles.alertBox, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
                  <XCircle size={16} color="#B91C1C" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertBoxTitle, { color: '#991B1B' }]}>Rejection Reason</Text>
                    <Text style={[styles.alertBoxText, { color: '#B91C1C' }]}>{selected.rejection_reason}</Text>
                  </View>
                </View>
              )}

              <View style={styles.modalSection}>
                <Text style={styles.sectionHeaderLabel}>CUSTOMER DETAILS</Text>
                <View style={styles.modalCard}>
                  <View style={styles.modalCustomerRow}>
                    {selected.profiles?.avatar_url ? (
                      <Image source={{ uri: selected.profiles.avatar_url }} style={styles.modalAvatar} />
                    ) : (
                      <View style={styles.modalAvatarPlaceholder}>
                        <Text style={styles.modalAvatarText}>{(selected.profiles?.full_name ?? 'C').charAt(0)}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalCustomerName}>{selected.profiles?.full_name ?? '—'}</Text>
                      <Text style={styles.modalCustomerSub}>{selected.profiles?.email}</Text>
                      {selected.profiles?.phone_number && (
                        <View style={styles.phoneRow}>
                          <Phone size={11} color={Colors.textSecondary} />
                          <Text style={styles.modalCustomerSub}>{selected.profiles.phone_number}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionHeaderLabel}>EVENT & LOCATION</Text>
                <View style={styles.modalCard}>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalRowLabel}>Package Selected</Text>
                    <Text style={styles.modalRowValue}>{selected.packages?.name ?? 'Custom Setup'}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalRowLabel}>Event Date & Time</Text>
                    <Text style={styles.modalRowValue}>{formatDate(selected.event_date)} @ {formatTime(selected.event_time)}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalRowLabel}>Guest Count</Text>
                    <Text style={styles.modalRowValue}>{selected.guest_count} guests</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalRowLabel}>Event Type</Text>
                    <Text style={styles.modalRowValue}>{selected.event_type ?? 'Catering'}</Text>
                  </View>

                  {selected.venue && (
                    <TouchableOpacity 
                      style={styles.mapPinCard} 
                      onPress={() => openMapPin(selected.venue!)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.mapPinIconBox}>
                        <MapPin size={18} color={Colors.orange} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mapPinTitle}>Venue Location</Text>
                        <Text style={styles.mapPinAddress} numberOfLines={2}>{selected.venue}</Text>
                      </View>
                      <ExternalLink size={16} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  )}

                  {selected.special_requests && (
                    <View style={[styles.modalRow, { borderBottomWidth: 0, marginTop: 8 }]}>
                      <Text style={styles.modalRowLabel}>Special Requests:</Text>
                      <Text style={[styles.modalRowValue, { fontStyle: 'italic', color: Colors.textSecondary }]}>
                        "{selected.special_requests}"
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <BookingInternalNotes key={selected.id} bookingId={selected.id} />

              <View style={styles.modalSection}>
                <Text style={styles.sectionHeaderLabel}>FINANCIAL BREAKDOWN</Text>
                <View style={styles.modalCard}>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalRowLabel}>Total Cost</Text>
                    <Text style={[styles.modalRowValue, { color: Colors.orange, fontSize: 16 }]}>
                      ₱{Number(selected.total_cost).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalRowLabel}>Required Downpayment</Text>
                    <Text style={styles.modalRowValue}>₱{Number(selected.downpayment_amount).toLocaleString()}</Text>
                  </View>
                  {selected.downpayment_deadline && (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalRowLabel}>Payment Deadline</Text>
                      <Text style={[styles.modalRowValue, { color: Colors.error }]}>
                        {formatDate(selected.downpayment_deadline)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {selected.reviews && selected.reviews.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionHeaderLabel}>CUSTOMER REVIEW</Text>
                  {selected.reviews.map(rev => (
                    <View key={rev.id} style={styles.modalCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', gap: 2 }}>
                          {[1, 2, 3, 4, 5].map(i => (
                            <Star
                              key={i}
                              size={14}
                              color={i <= Math.round(rev.overall) ? '#F59E0B' : '#E5E7EB'}
                              fill={i <= Math.round(rev.overall) ? '#F59E0B' : 'transparent'}
                            />
                          ))}
                        </View>
                        <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                          {formatDate(rev.created_at)}
                        </Text>
                      </View>

                      {rev.comment && (
                        <Text style={{ fontSize: 14, color: Colors.black, fontStyle: 'italic', marginBottom: 12 }}>
                          "{rev.comment}"
                        </Text>
                      )}

                      {rev.caterer_reply ? (
                        <View style={styles.catererReply}>
                          <View style={styles.catererReplyHeader}>
                            <MessageSquareText size={14} color="#2563EB" />
                            <Text style={styles.catererReplyLabel}>Your Response</Text>
                          </View>
                          <Text style={styles.catererReplyText}>{rev.caterer_reply}</Text>
                        </View>
                      ) : (
                        <View style={{ marginTop: 8 }}>
                          {replyingId === rev.id ? (
                            <View style={{ gap: 8 }}>
                              <TextInput
                                style={styles.fieldInput}
                                placeholder="Write a professional reply..."
                                placeholderTextColor={Colors.textMuted}
                                value={replyText[rev.id] || ''}
                                onChangeText={(t) => setReplyText(prev => ({ ...prev, [rev.id]: t }))}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                              />
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                  style={[styles.actionBtn, styles.actionBtnConfirm, { flex: 1, paddingVertical: 12 }]}
                                  onPress={() => handleReplyReview(rev.id)}
                                  disabled={updating}
                                >
                                  {updating ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.actionBtnText}>Send Reply</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.actionBtn, { backgroundColor: '#F1F5F9', flex: 1, paddingVertical: 12 }]}
                                  onPress={() => setReplyingId(null)}
                                >
                                  <Text style={[styles.actionBtnText, { color: Colors.black }]}>Cancel</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={[styles.actionBtn, { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingVertical: 12 }]}
                              onPress={() => setReplyingId(rev.id)}
                            >
                              <View style={styles.btnRow}>
                                <MessageSquare size={16} color="#1D4ED8" />
                                <Text style={[styles.actionBtnText, { color: '#1D4ED8', fontSize: 13 }]}>Reply to Review</Text>
                              </View>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.modalSection}>
                <Text style={styles.sectionHeaderLabel}>MANAGEMENT ACTIONS</Text>

                {selected.status === 'pending' && !showRejectModal && (
                  <View style={{ gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnConfirm]}
                      onPress={() => handleAction('confirm', selected)}
                      disabled={updating}
                      activeOpacity={0.85}
                    >
                      {updating ? <ActivityIndicator color="#FFF" /> : (
                        <View style={styles.btnRow}>
                          <Check size={18} color="#FFF" />
                          <Text style={styles.actionBtnText}>Confirm Booking Request</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnReject]}
                      onPress={() => setShowRejectModal(true)}
                      disabled={updating}
                      activeOpacity={0.85}
                    >
                      <View style={styles.btnRow}>
                        <X size={18} color={Colors.error} />
                        <Text style={[styles.actionBtnText, { color: Colors.error }]}>Reject Booking</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                {selected.status === 'pending' && showRejectModal && (
                  <View style={styles.rejectContainer}>
                    <Text style={styles.fieldLabel}>Reason for Rejection *</Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="Explain why you cannot accommodate this request..."
                      placeholderTextColor={Colors.textMuted}
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnReject, { marginTop: 10 }]}
                      onPress={() => handleAction('reject', selected)}
                      disabled={updating}
                    >
                      {updating ? <ActivityIndicator color={Colors.error} /> : <Text style={[styles.actionBtnText, { color: Colors.error }]}>Submit Rejection</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowRejectModal(false)} style={{ marginTop: 8, alignItems: 'center' }}>
                      <Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selected.status === 'paid' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#D97706' }]}
                    onPress={() => handleAction('mark_ongoing', selected)}
                    disabled={updating}
                  >
                    <Text style={styles.actionBtnText}>Mark Event as Ongoing</Text>
                  </TouchableOpacity>
                )}

                {selected.status === 'ongoing' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnConfirm]}
                    onPress={() => handleAction('complete', selected)}
                    disabled={updating}
                  >
                    <Text style={styles.actionBtnText}>Mark Event as Completed</Text>
                  </TouchableOpacity>
                )}

                {['confirmed', 'paid'].includes(selected.status) && !showCancelModal && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', marginTop: 10 }]}
                    onPress={() => setShowCancelModal(true)}
                    disabled={updating}
                    activeOpacity={0.85}
                  >
                    <View style={styles.btnRow}>
                      <AlertTriangle size={18} color="#B91C1C" />
                      <Text style={[styles.actionBtnText, { color: '#B91C1C' }]}>Emergency Cancellation</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {showCancelModal && (
                  <View style={[styles.rejectContainer, { marginTop: 10, borderColor: '#FCA5A5' }]}>
                    <Text style={styles.fieldLabel}>Emergency Reason for Cancellation *</Text>
                    
                    <Text style={{ fontSize: 13, color: '#B91C1C', fontWeight: '600', marginBottom: 12, padding: 10, backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#FECACA' }}>
                      {getCancelWarningMessage(selected)}
                    </Text>

                    <View style={{ padding: 12, backgroundColor: '#FFF7ED', borderRadius: 10, marginBottom: 12 }}>
                      <Text style={{ fontWeight: '900', color: '#9A3412', fontSize: 14 }}>
                        {hasVerifiedDownpayment(selected)
                          ? `Full Customer Refund: ₱${Number(selected.downpayment_amount).toLocaleString('en-PH')} (100%)`
                          : 'No Verified Payment — Refund: ₱0'}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#9A3412', marginTop: 4 }}>
                        {hasVerifiedDownpayment(selected)
                          ? 'You must transfer the refund to the Customer’s selected GCash, Maya, BPI, BDO, or Other Bank account. Cancellation does not automatically transfer funds.'
                          : 'No refund is due unless a payment was verified.'}
                      </Text>
                    </View>

                    {CATERER_CANCEL_REASONS.map((reason) => (
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
                        style={styles.fieldInput}
                        placeholder="Please specify your emergency..."
                        placeholderTextColor={Colors.textMuted}
                        value={customReason}
                        onChangeText={setCustomReason}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    )}

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#DC2626', marginTop: 10 }]}
                      onPress={() => handleAction('caterer_cancel', selected)}
                      disabled={updating}
                    >
                      {updating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.actionBtnText}>Confirm Cancel & Notify Client</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowCancelModal(false)} style={{ marginTop: 12, alignItems: 'center' }}>
                      <Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>Back</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selected.status !== 'rejected' && (
                  <TouchableOpacity
                    style={styles.chatBtn}
                    onPress={() => { setSelected(null); setChatBooking(selected); }}
                    activeOpacity={0.85}
                  >
                    <MessageSquare size={16} color={Colors.black} />
                    <Text style={styles.chatBtnText}>Open Client Chatroom</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      <Modal visible={!!chatBooking} animationType="slide" presentationStyle="fullScreen">
        {chatBooking && (
          <ChatScreen
            bookingId={chatBooking.id}
            receiverId={chatBooking.customer_id}
            receiverName={chatBooking.profiles?.full_name ?? 'Customer'}
            receiverAvatar={chatBooking.profiles?.avatar_url ?? null}
            bookingInfo={`${chatBooking.event_type ?? 'Event'} · ${formatDate(chatBooking.event_date)}`}
            onClose={() => setChatBooking(null)}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  disputeToggleWrap: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFFFF' },
  disputeToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  disputeToggleActive: { backgroundColor: '#B91C1C', borderColor: '#B91C1C' },
  disputeToggleText: { color: '#991B1B', fontSize: 13, fontWeight: '900' },
  disputeCount: { backgroundColor: '#FEE2E2', borderRadius: 12, minWidth: 23, height: 23, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  disputeCountText: { color: '#991B1B', fontSize: 11, fontWeight: '900' },
  disputeHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  disputeHeading: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  disputeSubheading: { fontSize: 12, color: '#64748B', marginTop: 4 },
  disputeCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  disputeCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  disputeCustomerIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  disputeCardTitle: { color: '#0F172A', fontWeight: '900', fontSize: 14 },
  disputeCardMeta: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  disputeBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 },
  disputeReason: { color: '#334155', fontSize: 13, lineHeight: 21 },
  disputeCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 },
  disputeAmount: { color: '#B91C1C', fontWeight: '800', fontSize: 13 },
  disputeOpenText: { color: '#C2410C', fontSize: 12, fontWeight: '800' },
  disputeEmpty: { padding: 45, alignItems: 'center', gap: 12 },
  disputeErrorBox: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, backgroundColor: '#FEF2F2', borderRadius: 12 },
  disputeSectionTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  disputeInfo: { color: '#475569', fontSize: 13, lineHeight: 21 },
  disputeReceiptImage: { width: '100%', height: 230, borderRadius: 12, backgroundColor: '#F8FAFC' },
  disputeResponseInput: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, minHeight: 125, padding: 12, backgroundColor: '#F8FAFC', color: '#0F172A', fontSize: 14 },

  refundTitle: { fontSize: 16, fontWeight: '900', color: '#14532D', marginBottom: 8 },
  refundHint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginTop: 6 },
  refundDestinationBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  refundDestinationText: { fontSize: 13, fontWeight: '700', color: Colors.black, lineHeight: 20 },
  refundWaiting: { fontSize: 13, color: '#B45309', marginTop: 12, lineHeight: 20 },
  refundProofButton: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 14, backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  refundProofButtonText: { color: '#1D4ED8', fontWeight: '800', fontSize: 13 },
  refundProofPreview: { width: '100%', height: 180, backgroundColor: '#F8FAFC', borderRadius: 12 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  pageTitle: { fontSize: 26, fontWeight: '900', color: Colors.black, letterSpacing: -0.5 },
  pageSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  refreshBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  debtBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1 },
  debtBannerWarning: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  debtBannerDanger: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  debtBannerTitle: { fontSize: 14, fontWeight: '900', marginBottom: 4 },
  debtBannerText: { fontSize: 12, fontWeight: '600', lineHeight: 18 },
  payDebtBtn: { backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  payDebtBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  paymentModalContainer: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  paymentModalTitle: { fontSize: 18, fontWeight: '900', color: Colors.black },
  paymentOptionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  paymentOptionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  paymentOptionText: { fontSize: 15, fontWeight: '800', color: Colors.black },
  paymentOptionSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  receiptViewerBox: { backgroundColor: '#DCFCE7', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#86EFAC' },
  receiptViewerTitle: { fontSize: 13, fontWeight: '900', color: '#15803D' },
  receiptDetailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#BBF7D0' },
  receiptLabel: { fontSize: 12, color: '#166534', fontWeight: '600' },
  receiptVal: { fontSize: 12, color: '#14532D', fontWeight: '800', textAlign: 'right' },
  receiptRefContainer: { paddingVertical: 4 },
  filterOuterWrap: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginTop: 12 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  filterText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  filterTextActive: { color: Colors.white, fontWeight: '800' },
  list: { flex: 1 },
  bookingCard: { backgroundColor: Colors.white, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2 },
  cardStripe: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  cardStripeLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardStripeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  cardStripeTime: { fontSize: 11, fontWeight: '600', opacity: 0.8 },
  cardBody: { padding: 16 },
  cardCustomerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  customerAvatar: { width: 44, height: 44, borderRadius: 22 },
  customerAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center' },
  customerAvatarText: { fontSize: 16, fontWeight: '900', color: Colors.orange },
  customerName: { fontSize: 15, fontWeight: '800', color: Colors.black, marginBottom: 2 },
  eventTypeName: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  cardAmount: { alignItems: 'flex-end' },
  cardAmountValue: { fontSize: 17, fontWeight: '900', color: Colors.orange },
  cardAmountSub: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  cardMetaGrid: { flexDirection: 'row', gap: 16, marginBottom: 10, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  venueText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', flex: 1 },
  pkgTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  pkgTagText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '700' },
  quickActions: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  quickBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 12 },
  quickBtnConfirm: { backgroundColor: Colors.orange },
  quickBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  modal: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingTop: Platform.OS === 'ios' ? 60 : 16 },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '900', color: Colors.black },
  statusBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 16 },
  statusBannerText: { fontSize: 14, fontWeight: '900' },
  alertBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 16, padding: 14 },
  alertBoxTitle: { fontSize: 13, fontWeight: '900', color: '#374151', marginBottom: 2 },
  alertBoxText: { fontSize: 12, fontWeight: '600', color: '#4B5563', lineHeight: 16 },
  modalSection: { gap: 8 },
  sectionHeaderLabel: { fontSize: 11, fontWeight: '900', color: Colors.textMuted, letterSpacing: 1, marginLeft: 4 },
  modalCard: { backgroundColor: Colors.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  modalCustomerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalAvatar: { width: 48, height: 48, borderRadius: 24 },
  modalAvatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.orange, justifyContent: 'center', alignItems: 'center' },
  modalAvatarText: { color: Colors.white, fontSize: 18, fontWeight: '900' },
  modalCustomerName: { fontSize: 16, fontWeight: '900', color: Colors.black, marginBottom: 2 },
  modalCustomerSub: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  modalRowLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500', flex: 1 },
  modalRowValue: { fontSize: 13, fontWeight: '800', color: Colors.black, flex: 1, textAlign: 'right' },
  mapPinCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FFEDD5', borderRadius: 14, padding: 12, marginTop: 12 },
  mapPinIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  mapPinTitle: { fontSize: 11, fontWeight: '800', color: Colors.orange, marginBottom: 2, letterSpacing: 0.5 },
  mapPinAddress: { fontSize: 13, fontWeight: '700', color: Colors.black },
  actionBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  actionBtnConfirm: { backgroundColor: Colors.orange },
  actionBtnReject: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' },
  actionBtnText: { fontSize: 15, fontWeight: '900', color: Colors.white },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rejectContainer: { backgroundColor: Colors.white, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#FEE2E2' },
  fieldLabel: { fontSize: 13, fontWeight: '800', color: Colors.black, marginBottom: 8 },
  fieldInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, fontSize: 14, color: Colors.black },
  reasonRow: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, backgroundColor: '#F9FAFB' },
  reasonRowSelected: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  reasonText: { fontSize: 14, color: Colors.black, fontWeight: '600' },
  reasonTextSelected: { color: '#B91C1C', fontWeight: '800' },
  chatBtn: { marginTop: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, borderWidth: 1.5, borderColor: '#E2E8F0' },
  chatBtnText: { fontSize: 15, fontWeight: '900', color: Colors.black },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 6 },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  catererReply: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  catererReplyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  catererReplyLabel: { fontSize: 12, fontWeight: '900', color: '#1D4ED8' },
  catererReplyText:  { fontSize: 13, color: '#1E3A8A', lineHeight: 18 },
});
