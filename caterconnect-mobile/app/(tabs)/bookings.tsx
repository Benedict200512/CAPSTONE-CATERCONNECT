// app/(tabs)/CustomerBookings.tsx
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { initiateGCashPayment, openGCashCheckout } from '../../lib/xendit';
import ReviewScreen from '../../screens/auth/ReviewScreen';
import ChatScreen from '../../screens/auth/ChatScreen';
import {
  Clock, CheckCircle2, CreditCard, RefreshCw, PartyPopper,
  XCircle, Ban, ClipboardList, MapPin, AlertTriangle, MessageSquare, Star, AlertCircle, Check, Wallet, Smartphone, Building2, ShieldCheck, Lock
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
  payment_receipt_url: string | null;
  // --- Refund Tracking Fields ---
  refund_status: 'none' | 'pending' | 'processed' | 'failed';
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
  packages: { name: string; tier: string } | null;
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

const CANCELLATION_REASONS = [
  "Event date changed",
  "Found another caterer",
  "Budget constraints",
  "Event was cancelled entirely",
  "Other"
];

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

export default function CustomerBookings() {
  const { session } = useAuth();
  const router = useRouter();
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
  const [isCancelling, setIsCancelling] = useState(false);

  // Caterer Cancelled Direct Refund Input State
  const [catererRefundInput, setCatererRefundInput] = useState('');
  const [submittingCatererRefundId, setSubmittingCatererRefundId] = useState<string | null>(null);

  const load = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    let query = supabase
      .from('bookings')
      .select(`
        *,
        caterers(id, business_name, logo_url, city, user_id, accepted_payment_methods, accepted_payment_details),
        packages(name, tier),
        reviews(id)
      `)
      .eq('customer_id', session.user.id)
      .order('created_at', { ascending: false });
    
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    let fetchedBookings = (data as any) ?? [];

    const now = new Date();
    const overdueBookings = fetchedBookings.filter((b: Booking) => 
      b.status === 'confirmed' && 
      b.downpayment_deadline && 
      new Date(b.downpayment_deadline) < now
    );

    if (overdueBookings.length > 0) {
      for (const ob of overdueBookings) {
        await supabase
          .from('bookings')
          .update({ 
            status: 'cancelled',
            cancelled_by: 'system',
            cancellation_reason: 'System Auto-Cancel: Payment deadline exceeded.',
            cancelled_at: new Date().toISOString()
          })
          .eq('id', ob.id);
          
        ob.status = 'cancelled';
        ob.cancelled_by = 'system';
        ob.cancellation_reason = 'System Auto-Cancel: Payment deadline exceeded.';
        ob.cancelled_at = new Date().toISOString();
      }
    }

    setBookings(fetchedBookings);
    setLoading(false);
  };

  useEffect(() => { load(); }, [session, filter]);

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
        const nowISO = new Date().toISOString();
        const automatedReceiptRef = `Xendit Automated E-Receipt (${selectedPaymentMethod.toUpperCase()}) - ChargeID: ${paymentResult.chargeId}`;

        await supabase
          .from('bookings')
          .update({
            status: 'paid',
            payment_method: selectedPaymentMethod,
            payment_submitted_at: nowISO,
            payment_verified_at: nowISO,
            payment_receipt_url: automatedReceiptRef,
          })
          .eq('id', payingBookingId);

        Alert.alert('Payment Successful!', `Downpayment verified automatically via Xendit (${selectedPaymentMethod.toUpperCase()}). Your booking is now secured!`);
        setPayingBookingId(null);
        load();
      } else if (checkoutStatus === 'failed') {
        Alert.alert('Payment Failed', 'The Xendit transaction failed or was declined.');
      } else {
        Alert.alert('Payment Cancelled', 'The payment session was closed or cancelled.');
      }
    } catch (err: any) {
      Alert.alert('Payment Error', err.message || 'An unexpected error occurred.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const getCancelWarningMessage = (booking: Booking | null) => {
    if (!booking) return '';
    const eventDate = new Date(booking.event_date);
    const today = new Date();
    eventDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (booking.status === 'pending') {
      return 'Are you sure you want to cancel this pending booking request?';
    } else if (diffDays > 7) {
      return booking.status === 'paid'
        ? 'Since this is more than 7 days before your event, your booking will be cancelled and your downpayment is eligible for a full refund.'
        : 'Since this is more than 7 days before your event, you can cancel freely with no penalty.';
    } else {
      return booking.status === 'paid'
        ? '⚠️️ Warning: This is less than 7 days before your event. Per our policy, your downpayment is non-refundable because ingredients and staff have already been prepared.'
        : '⚠️ Warning: This is less than 7 days before your event. Are you sure you want to cancel?';
    }
  };

  const confirmCancelBooking = async () => {
    if (!cancellingBooking) return;
    
    const finalReason = selectedReason === 'Other' ? customReason.trim() : selectedReason;
    
    if (!finalReason) {
      Alert.alert("Missing Reason", "Please select or specify a reason for cancelling.");
      return;
    }

    const eventDate = new Date(cancellingBooking.event_date);
    const today = new Date();
    eventDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const isPaid = cancellingBooking.status === 'paid';
    const isEligibleForRefund = isPaid && diffDays > 7;

    if (isEligibleForRefund && !refundAccount.trim()) {
      Alert.alert("GCash Details Required", "Please enter your GCash account details so platform staff can disburse your refund immediately.");
      return;
    }

    setIsCancelling(true);
    
    const targetRefundStatus = isEligibleForRefund ? 'pending' : 'none';
    const targetRefundAmount = isEligibleForRefund ? cancellingBooking.downpayment_amount : 0;

    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: 'cancelled',
        cancelled_by: 'customer',
        cancellation_reason: finalReason,
        cancelled_at: new Date().toISOString(),
        refund_status: targetRefundStatus,
        refund_amount: targetRefundAmount,
        refund_account_details: isEligibleForRefund ? refundAccount.trim() : null
      })
      .eq('id', cancellingBooking.id);

    setIsCancelling(false);

    if (error) {
      Alert.alert('Cancellation Failed', `Error: ${error.message}`);
    } else {
      if (isEligibleForRefund) {
        Alert.alert('Refund Requested', 'Your booking is cancelled. Platform staff will review your GCash details and disburse your refund instantly.');
      } else if (isPaid && diffDays <= 7) {
        Alert.alert('Cancelled', 'Booking cancelled. As per policy (under 7 days), the downpayment is non-refundable.');
      } else {
        Alert.alert('Cancelled', 'Your booking has been successfully cancelled.');
      }
      
      setCancellingBooking(null);
      setSelectedReason('');
      setCustomReason('');
      setRefundAccount('');
      load();
    }
  };

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

      {/* Cancellation Reason Modal */}
      <Modal visible={!!cancellingBooking} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel Booking</Text>
            
            <Text style={styles.modalWarningText}>
              {getCancelWarningMessage(cancellingBooking)}
            </Text>

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

            {cancellingBooking?.status === 'paid' && (() => {
              const eventDate = new Date(cancellingBooking.event_date);
              const today = new Date();
              eventDate.setHours(0, 0, 0, 0);
              today.setHours(0, 0, 0, 0);
              const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              
              if (diffDays > 7) {
                return (
                  <View style={{ marginTop: 10, marginBottom: 10 }}>
                    <Text style={styles.modalSubPrompt}>Enter GCash Number & Name for Refund:</Text>
                    <TextInput
                      style={styles.customInput}
                      placeholder="e.g., 09123456789 - Juan Dela Cruz"
                      placeholderTextColor={Colors.textMuted}
                      value={refundAccount}
                      onChangeText={setRefundAccount}
                    />
                  </View>
                );
              }
              return null;
            })()}

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.closeBtn} 
                onPress={() => {
                  setCancellingBooking(null);
                  setSelectedReason('');
                  setCustomReason('');
                  setRefundAccount('');
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
              <View key={b.id} style={[styles.bookingCard, paymentOverdue && styles.bookingCardUrgent]}>
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
                        
                        {/* ── If Caterer Cancelled & Downpayment was paid, let customer enter account details ── */}
                        {b.cancelled_by === 'caterer' && Number(b.downpayment_amount) > 0 && (!b.refund_account_details || b.refund_status === 'none') && (
                          <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#FED7AA' }}>
                            <Text style={{ fontSize: 12, fontWeight: '900', color: Colors.orange, marginBottom: 4 }}>
                              Downpayment Refund Available (₱{Number(b.downpayment_amount).toLocaleString()})
                            </Text>
                            <Text style={{ fontSize: 11.5, color: Colors.textSecondary, marginBottom: 8, lineHeight: 16 }}>
                              The caterer cancelled your booking. Please enter your GCash details so platform staff can disburse your refund.
                            </Text>
                            <TextInput
                              style={[styles.customInput, { height: 44, padding: 10, marginBottom: 8, fontSize: 13 }]}
                              placeholder="e.g., 09123456789 - Juan Dela Cruz"
                              placeholderTextColor={Colors.textMuted}
                              value={catererRefundInput}
                              onChangeText={setCatererRefundInput}
                            />
                            <TouchableOpacity
                              style={{ backgroundColor: Colors.orange, paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
                              onPress={async () => {
                                if (!catererRefundInput.trim()) {
                                  Alert.alert("Missing Details", "Please enter your GCash account details.");
                                  return;
                                }
                                setSubmittingCatererRefundId(b.id);
                                const { error } = await supabase
                                  .from('bookings')
                                  .update({
                                    refund_status: 'pending',
                                    refund_amount: b.downpayment_amount,
                                    refund_account_details: catererRefundInput.trim()
                                  })
                                  .eq('id', b.id);
                                setSubmittingCatererRefundId(null);

                                if (error) {
                                  Alert.alert("Error", error.message);
                                } else {
                                  Alert.alert("Submitted", "Your GCash refund details have been submitted to platform staff.");
                                  setCatererRefundInput('');
                                  load();
                                }
                              }}
                            >
                              <Text style={{ color: Colors.white, fontWeight: '800', fontSize: 12.5 }}>
                                {submittingCatererRefundId === b.id ? 'Submitting...' : 'Submit Refund Account Details'}
                              </Text>
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
                                GCash Account: <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '700' }}>{b.refund_account_details}</Text>
                              </Text>
                            )}

                            {b.refund_status === 'pending' && (
                              <Text style={{ fontSize: 11, color: '#D97706', marginTop: 4, fontWeight: '700' }}>
                                ⏳ Platform staff are verifying your GCash details to disburse your refund immediately.
                              </Text>
                            )}

                            {b.refund_status === 'processed' && (
                              <Text style={{ fontSize: 11, color: '#16A34A', marginTop: 4, fontWeight: '700' }}>
                                ✅ Refund successfully disbursed to your GCash account!
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
                      <Text style={styles.statusMessageText}>Downpayment secured via Xendit ({b.payment_method?.toUpperCase() || 'ONLINE'}). E-receipt generated automatically!</Text>
                    </View>
                  )}

                  {b.status === 'completed' && (
                    <View style={styles.statusMessageBox}>
                      <PartyPopper size={16} color="#15803D" />
                      <Text style={styles.statusMessageText}>Event successfully completed. Hope you had a great experience!</Text>
                    </View>
                  )}

                  {/* Action buttons */}
                  <View style={styles.bookingActions}>
                    {['confirmed', 'paid', 'ongoing', 'completed', 'cancelled'].includes(b.status) && (
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
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: Colors.black, marginBottom: 8 },
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