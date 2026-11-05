import { useRef, useState } from 'react';

import {

  ActivityIndicator, Alert, Platform,

  ScrollView, StyleSheet, Text,

  TouchableOpacity, View,

} from 'react-native';

import { Colors } from '@/constants/colors';

import { useAuth } from '@/context/AuthContext';

import { bookingPaymentUnavailable, payBookingDownpayment } from '@/lib/bookingPayment';

import { supabase } from '@/lib/supabase';
import { useBookingRefresh } from '@/hooks/useBookingRefresh';

// ── Lucide Icons ──

import {

  ArrowLeft, ClipboardList, Receipt, AlertCircle, 

  CreditCard, SmartphoneNfc, CheckCircle2, ShieldCheck

} from 'lucide-react-native';

type Props = {

  bookingId: string;

  onClose: () => void;

};

// GCash Brand Color

const GCASH_BLUE = '#007DFE';

export default function PaymentScreen({ bookingId, onClose }: Props) {

  const { session, profile } = useAuth();

  const [booking, setBooking] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  const [paying, setPaying] = useState(false);
  const [loadError, setLoadError] = useState('');
  const loadScope = useRef('');
  loadScope.current = `${session?.user.id ?? ''}:${bookingId}`;

  const loadPayment = async () => {
    const scope = loadScope.current;
    try {
      const { data, error } = await supabase.from('bookings')
        .select('*, caterers(business_name, contact_phone, user_id, downpayment_percent), packages(name, tier)')
        .eq('id', bookingId).eq('customer_id', session?.user.id ?? '').maybeSingle();
      if (scope !== loadScope.current) return;
      if (error) throw error;
      setBooking(data);
      setLoadError('');
    } catch (error: any) {
      if (scope === loadScope.current) setLoadError(error?.message || 'Payment details could not be loaded.');
    } finally { if (scope === loadScope.current) setLoading(false); }
  };
  useBookingRefresh(session?.user.id ? `${session.user.id}:${bookingId}:payment` : null, loadPayment);

  const handlePayGCash = async () => {
    if (!booking || !session?.user || !profile || paying) return;
    const unavailable = bookingPaymentUnavailable(booking);
    if (unavailable) { Alert.alert('Payment unavailable', unavailable); return; }
    Alert.alert('Pay Downpayment', 'Continue to the existing Xendit test checkout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', onPress: async () => {
        setPaying(true);
        try {
          const outcome = await payBookingDownpayment(booking.id, profile.full_name);
          await loadPayment();
          if (outcome === 'success') Alert.alert('Payment Confirmed', 'Your downpayment was verified and saved by the server.', [{ text: 'OK', onPress: onClose }]);
          else if (outcome === 'failed') Alert.alert('Payment Failed', 'The provider reports this payment failed.');
          else Alert.alert('Payment confirmation pending', 'Refresh to check the booking. Reopening checkout in this app session reuses the existing attempt. Do not pay again elsewhere.');
        } catch (error: any) { Alert.alert('Payment unavailable', error?.message || 'Refresh before trying again.'); }
        finally { setPaying(false); }
      } },
    ]);
  };

  if (loading) {

    return (

      <View style={styles.center}>

        <ActivityIndicator size="large" color={Colors.orange} />

        <Text style={styles.loadingText}>Loading payment details...</Text>

      </View>

    );

  }

  if (!booking) {

    return (

      <View style={styles.center}>

        <AlertCircle size={32} color={Colors.textMuted} style={{ marginBottom: 12 }} />

        <Text style={styles.errorText}>{loadError || 'Booking not found.'}</Text>
        <TouchableOpacity style={styles.backBtnPill} onPress={() => void loadPayment()}><Text style={styles.backBtnPillText}>Retry</Text></TouchableOpacity>

        <TouchableOpacity style={styles.backBtnPill} onPress={onClose}>

          <Text style={styles.backBtnPillText}>Go Back</Text>

        </TouchableOpacity>

      </View>

    );

  }

  const caterer = booking.caterers as any;

  const pkg = booking.packages as any;

  const deadlineDate = booking.downpayment_deadline

    ? new Date(booking.downpayment_deadline).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    : '—';

  return (

    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ width: '100%', maxWidth: 960, alignSelf: 'center', paddingBottom: 40 }}>

      {/* ── HEADER ── */}

      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>

        <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>

          <ArrowLeft size={20} color={Colors.black} />

          <Text style={styles.backText}>Cancel</Text>

        </TouchableOpacity>

        <Text style={styles.pageTitle}>Complete Payment</Text>

        <Text style={styles.pageSub}>Secure your booking by paying the downpayment.</Text>

      </View>

      {/* ── DEADLINE WARNING ── */}

      <View style={styles.deadlineBox}>

        <View style={styles.deadlineIconWrap}>

          <AlertCircle size={20} color="#B45309" />

        </View>

        <View style={{ flex: 1 }}>

          <Text style={styles.deadlineTitle}>Payment Deadline: {deadlineDate}</Text>

          <Text style={styles.deadlineNote}>Your booking will be automatically cancelled if payment is not received in time.</Text>

        </View>

      </View>

      {/* ── BOOKING SUMMARY ── */}

      <View style={styles.card}>

        <View style={styles.cardTitleRow}>

          <View style={[styles.cardIconWrap, { backgroundColor: '#F3F4F6' }]}>

            <ClipboardList size={18} color={Colors.textSecondary} />

          </View>

          <Text style={styles.cardTitle}>Booking Summary</Text>

        </View>

        <View style={styles.cardBody}>

          {[

            { label: 'Caterer', value: caterer?.business_name ?? '—' },

            { label: 'Package', value: pkg?.name ?? '—' },

            { label: 'Event Date', value: booking.event_date ? new Date(booking.event_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },

            { label: 'Guests', value: `${booking.guest_count} guests` },

            { label: 'Venue', value: booking.venue ?? '—' },

          ].map((row, index) => (

            <View key={row.label} style={[styles.summaryRow, index === 4 && { borderBottomWidth: 0, paddingBottom: 0 }]}>

              <Text style={styles.summaryLabel}>{row.label}</Text>

              <Text style={styles.summaryValue} numberOfLines={1}>{row.value}</Text>

            </View>

          ))}

        </View>

      </View>

      {/* ── PAYMENT BREAKDOWN ── */}

      <View style={styles.card}>

        <View style={styles.cardTitleRow}>

          <View style={[styles.cardIconWrap, { backgroundColor: '#FEF3C7' }]}>

            <Receipt size={18} color="#D97706" />

          </View>

          <Text style={styles.cardTitle}>Payment Breakdown</Text>

        </View>

        <View style={styles.cardBody}>

          <View style={styles.amountRow}>

            <Text style={styles.amountLabel}>Total Booking Amount</Text>

            <Text style={styles.amountValue}>₱{Number(booking.total_cost).toLocaleString()}</Text>

          </View>

          <View style={styles.amountRow}>

            <Text style={styles.amountLabel}>Downpayment ({booking.downpayment_percent ?? caterer?.downpayment_percent ?? 50}%)</Text>

            <Text style={styles.amountValue}>₱{Number(booking.downpayment_amount).toLocaleString()}</Text>

          </View>

          <View style={styles.downpayCard}>

            <Text style={styles.downpayLabel}>AMOUNT DUE NOW</Text>

            <Text style={styles.downpayAmount}>₱{Number(booking.downpayment_amount).toLocaleString()}</Text>

          </View>

          <View style={styles.remainingRow}>

            <Text style={styles.remainingLabel}>Balance to pay on event day</Text>

            <Text style={styles.remainingValue}>₱{(Number(booking.total_cost) - Number(booking.downpayment_amount)).toLocaleString()}</Text>

          </View>

        </View>

      </View>

      {/* ── PAYMENT METHOD ── */}

      <View style={styles.card}>

        <View style={styles.cardTitleRow}>

          <View style={[styles.cardIconWrap, { backgroundColor: '#E0E7FF' }]}>

            <CreditCard size={18} color="#4F46E5" />

          </View>

          <Text style={styles.cardTitle}>Payment Method</Text>

        </View>

        <View style={styles.gcashBox}>

          <View style={styles.gcashIconWrap}>

            <SmartphoneNfc size={22} color="#FFFFFF" />

          </View>

          <View style={{ flex: 1 }}>

            <Text style={styles.gcashLabel}>GCash e-Wallet</Text>

            <Text style={styles.gcashSub}>Fast, secure, and instant</Text>

          </View>

          <CheckCircle2 size={24} color={GCASH_BLUE} />

        </View>

      </View>

      {/* ── PAY BUTTON ── */}

      <View style={styles.footer}>

        <TouchableOpacity

          style={[styles.payBtn, paying && styles.payBtnDisabled]}

          onPress={handlePayGCash}

          disabled={paying || !!bookingPaymentUnavailable(booking)}

          activeOpacity={0.85}

        >

          {paying ? (

            <ActivityIndicator color="white" />

          ) : (

            <View style={styles.payBtnContent}>

              <Text style={styles.payBtnText}>

                Pay ₱{Number(booking.downpayment_amount).toLocaleString()}

              </Text>

            </View>

          )}

        </TouchableOpacity>
        {!!bookingPaymentUnavailable(booking) && <Text style={{ color: Colors.textSecondary, fontSize: 13, padding: 12 }}>{bookingPaymentUnavailable(booking)}</Text>}

        <View style={styles.secureNote}>

          <ShieldCheck size={14} color="#10B981" />

          <Text style={styles.secureNoteText}>

            Secured by Xendit · Payments go directly to {caterer?.business_name}

          </Text>

        </View>

      </View>

    </ScrollView>

  );

}

const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: '#F9FAFB' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },

  loadingText: { marginTop: 12, fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },

  errorText: { fontSize: 16, color: Colors.black, fontWeight: '700', marginBottom: 16 },

  // Header

  header: { paddingHorizontal: 24, paddingBottom: 24 },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, alignSelf: 'flex-start' },

  backText: { fontSize: 15, color: Colors.black, fontWeight: '700' },

  backBtnPill: { backgroundColor: Colors.black, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },

  backBtnPillText: { color: Colors.white, fontWeight: '700' },

  pageTitle: { fontSize: 28, fontWeight: '900', color: Colors.black, letterSpacing: -0.5, marginBottom: 6 },

  pageSub: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  // Deadline Box

  deadlineBox: {

    flexDirection: 'row', alignItems: 'flex-start', gap: 12,

    marginHorizontal: 20, marginBottom: 20,

    backgroundColor: '#FFFBEB', borderRadius: 16,

    padding: 16, borderWidth: 1, borderColor: '#FDE68A',

  },

  deadlineIconWrap: { marginTop: 2 },

  deadlineTitle: { fontSize: 13, fontWeight: '800', color: '#92400E', marginBottom: 4 },

  deadlineNote: { fontSize: 12, color: '#B45309', lineHeight: 18 },

  // Cards

  card: {

    backgroundColor: Colors.white,

    marginHorizontal: 20,

    marginBottom: 16,

    borderRadius: 24,

    borderWidth: 1, 

    borderColor: '#F3F4F6',

    shadowColor: '#000',

    shadowOffset: { width: 0, height: 4 },

    shadowOpacity: 0.03,

    shadowRadius: 12,

    elevation: 2,

    overflow: 'hidden',

  },

  cardTitleRow: { 

    flexDirection: 'row', alignItems: 'center', gap: 12, 

    padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',

    backgroundColor: '#FAFAFA' 

  },

  cardIconWrap: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  cardTitle: { fontSize: 16, fontWeight: '900', color: Colors.black, letterSpacing: -0.3 },

  cardBody: { padding: 20 },

  // Summary

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', borderStyle: 'dashed' },

  summaryLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },

  summaryValue: { fontSize: 14, fontWeight: '700', color: Colors.black, flex: 1, textAlign: 'right', marginLeft: 20 },

  // Breakdown

  amountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },

  amountLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },

  amountValue: { fontSize: 14, fontWeight: '800', color: Colors.black },

  downpayCard: { 

    backgroundColor: Colors.orangeLight, borderRadius: 16, 

    padding: 16, marginTop: 12, marginBottom: 16, 

    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',

    borderWidth: 1, borderColor: '#FED7AA'

  },

  downpayLabel: { fontSize: 12, fontWeight: '900', color: '#9A3412', letterSpacing: 0.5 },

  downpayAmount: { fontSize: 22, fontWeight: '900', color: Colors.orange },

  remainingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },

  remainingLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '500', flex: 1 },

  remainingValue: { fontSize: 14, fontWeight: '800', color: Colors.textSecondary },

  // Payment Method

  gcashBox: { 

    flexDirection: 'row', alignItems: 'center', gap: 14, 

    padding: 20, backgroundColor: Colors.white 

  },

  gcashIconWrap: { 

    width: 48, height: 48, borderRadius: 16, 

    backgroundColor: GCASH_BLUE, 

    justifyContent: 'center', alignItems: 'center',

    shadowColor: GCASH_BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4

  },

  gcashLabel: { fontSize: 16, fontWeight: '900', color: Colors.black, marginBottom: 2 },

  gcashSub: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  // Footer & Button

  footer: { paddingHorizontal: 20, paddingTop: 12 },

  payBtn: {

    backgroundColor: GCASH_BLUE,

    borderRadius: 20,

    paddingVertical: 18,

    alignItems: 'center',

    justifyContent: 'center',

    marginBottom: 16,

    shadowColor: GCASH_BLUE,

    shadowOffset: { width: 0, height: 6 },

    shadowOpacity: 0.3,

    shadowRadius: 16,

    elevation: 8,

  },

  payBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  payBtnDisabled: { opacity: 0.7 },

  payBtnText: { color: 'white', fontWeight: '900', fontSize: 17, letterSpacing: 0.5 },

  secureNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10 },

  secureNoteText: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', fontWeight: '500' },

});
