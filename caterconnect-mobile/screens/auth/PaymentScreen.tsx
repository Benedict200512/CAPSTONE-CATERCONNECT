import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform,
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { initiateGCashPayment, openGCashCheckout } from '@/lib/xendit';
import { supabase } from '@/lib/supabase';

type Props = {
  bookingId: string;
  onClose: () => void;
};

// ── Custom icon set (PNG) — replaces all emoji glyphs. ──────────
// Drop these into assets/icons/ alongside the rest of your icon set.
const ICONS = {
  arrowLeft: require('../../assets/icons/arrow_left.png'),
  clipboard: require('../../assets/icons/clipboard.png'),
  peso: require('../../assets/icons/peso.png'),
  warning: require('../../assets/icons/warning.png'),
  card: require('../../assets/icons/card.png'),
  checkBlue: require('../../assets/icons/check_blue.png'),
  checkSuccess: require('../../assets/icons/check_success.png'),
  lock: require('../../assets/icons/lock.png'),
  gcash: require('../../assets/icons/gcash.png'),
};

export default function PaymentScreen({ bookingId, onClose }: Props) {
  const { session, profile } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('bookings')
        .select('*, caterers(business_name, contact_phone, user_id, downpayment_percent), packages(name, tier)')
        .eq('id', bookingId)
        .single();
      setBooking(data);
      setLoading(false);
    };
    load();
  }, [bookingId]);

  const handlePayGCash = async () => {
    if (!booking || !session?.user || !profile) return;

    Alert.alert(
      'Pay Downpayment via GCash',
      `You will pay ₱${Number(booking.downpayment_amount).toLocaleString()} to ${(booking.caterers as any)?.business_name}. Proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Now',
          onPress: async () => {
            setPaying(true);

            const referenceId = `booking_${booking.id}_${Date.now()}`;

            const result = await initiateGCashPayment({
              type: 'booking',
              amount: booking.downpayment_amount,
              referenceId,
              customerName: profile.full_name,
              customerEmail: session.user.email ?? '',
              description: `Booking downpayment — ${(booking.caterers as any)?.business_name ?? 'Caterer'} — ${booking.event_date}`,
            });

            if (!result.success || !result.checkoutUrl) {
              Alert.alert('Error', result.error ?? 'Failed to initiate payment.');
              setPaying(false);
              return;
            }

            const outcome = await openGCashCheckout(result.checkoutUrl!, result.chargeId!, result.webUrl,);
            setPaying(false);

            if (outcome === 'success') {
              Alert.alert(
                'Payment Sent!',
                'Your GCash payment was successful. Waiting for the caterer to verify.',
                [{ text: 'OK', onPress: onClose }]
              );
            } else if (outcome === 'failed') {
              Alert.alert('Payment Failed', 'Your GCash payment did not go through. Please try again.');
            } else {
              Alert.alert('Cancelled', 'Payment was cancelled.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.orange} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.center}>
        <Text>Booking not found.</Text>
      </View>
    );
  }

  const caterer = booking.caterers as any;
  const pkg = booking.packages as any;
  const deadlineDate = booking.downpayment_deadline
    ? new Date(booking.downpayment_deadline).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Image source={ICONS.arrowLeft} style={styles.iconBack} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Pay Downpayment</Text>
        <Text style={styles.pageSub}>Complete your booking by paying the downpayment</Text>
      </View>

      {/* Booking summary */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Image source={ICONS.clipboard} style={styles.iconCardTitle} />
          <Text style={styles.cardTitle}>Booking Summary</Text>
        </View>
        {[
          { label: 'Caterer', value: caterer?.business_name ?? '—' },
          { label: 'Package', value: pkg?.name ?? '—' },
          { label: 'Event Date', value: booking.event_date ? new Date(booking.event_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
          { label: 'Guests', value: `${booking.guest_count} guests` },
          { label: 'Venue', value: booking.venue ?? '—' },
        ].map((row) => (
          <View key={row.label} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{row.label}</Text>
            <Text style={styles.summaryValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      {/* Payment breakdown */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Image source={ICONS.peso} style={styles.iconCardTitle} />
          <Text style={styles.cardTitle}>Payment Breakdown</Text>
        </View>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Total Booking Amount</Text>
          <Text style={styles.amountValue}>₱{Number(booking.total_cost).toLocaleString()}</Text>
        </View>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Downpayment Required</Text>
          <Text style={styles.amountLabel}>({booking.downpayment_percent ?? caterer?.downpayment_percent ?? 50}%)
          </Text>
        </View>
        <View style={styles.downpayRow}>
          <Text style={styles.downpayLabel}>AMOUNT DUE NOW</Text>
          <Text style={styles.downpayAmount}>₱{Number(booking.downpayment_amount).toLocaleString()}</Text>
        </View>
        <View style={styles.remainingRow}>
          <Text style={styles.remainingLabel}>Remaining balance (pay on event day)</Text>
          <Text style={styles.remainingValue}>₱{(Number(booking.total_cost) - Number(booking.downpayment_amount)).toLocaleString()}</Text>
        </View>
      </View>

      {/* Deadline warning */}
      <View style={styles.deadlineBox}>
        <Image source={ICONS.warning} style={styles.iconWarning} />
        <View style={{ flex: 1 }}>
          <Text style={styles.deadlineTitle}>Payment Deadline</Text>
          <Text style={styles.deadlineDate}>{deadlineDate}</Text>
          <Text style={styles.deadlineNote}>Booking will be automatically cancelled if payment is not received before the deadline.</Text>
        </View>
      </View>

      {/* Payment method */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Image source={ICONS.card} style={styles.iconCardTitle} />
          <Text style={styles.cardTitle}>Payment Method</Text>
        </View>
        <View style={styles.gcashBox}>
          <View style={styles.gcashIconWrap}>
            <Image source={ICONS.gcash} style={styles.iconGcash} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.gcashLabel}>GCash</Text>
            <Text style={styles.gcashSub}>Pay securely using your GCash account</Text>
          </View>
          <Image source={ICONS.checkBlue} style={styles.iconCheckBlue} />
        </View>
      </View>

      {/* Pay button */}
      <TouchableOpacity
        style={[styles.payBtn, paying && styles.payBtnDisabled]}
        onPress={handlePayGCash}
        disabled={paying}
        activeOpacity={0.85}
      >
        {paying ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Text style={styles.payBtnText}>
              Pay ₱{Number(booking.downpayment_amount).toLocaleString()} via GCash
            </Text>
            <Text style={styles.payBtnSub}>You'll be redirected to GCash to complete payment</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.secureNote}>
        <Image source={ICONS.lock} style={styles.iconLockSm} />
        <Text style={styles.secureNoteText}>Secured by Xendit · Payments go directly to {caterer?.business_name}</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  pageTitle: { fontSize: 26, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  pageSub: { fontSize: 13, color: Colors.textSecondary },
  card: {
    backgroundColor: Colors.white, marginHorizontal: 20,
    marginBottom: 14, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: Colors.black },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary },
  summaryValue: { fontSize: 13, fontWeight: '700', color: Colors.black, flex: 1, textAlign: 'right', marginLeft: 12 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  amountLabel: { fontSize: 13, color: Colors.textSecondary },
  amountValue: { fontSize: 13, fontWeight: '700', color: Colors.black },
  downpayRow: { backgroundColor: Colors.orangeLight, borderRadius: 12, padding: 14, marginVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  downpayLabel: { fontSize: 11, fontWeight: '900', color: '#92400E', letterSpacing: 1 },
  downpayAmount: { fontSize: 24, fontWeight: '900', color: Colors.orange },
  remainingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  remainingLabel: { fontSize: 12, color: Colors.textMuted, flex: 1 },
  remainingValue: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  deadlineBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: '#FEF3C7', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#FDE68A',
  },
  deadlineTitle: { fontSize: 13, fontWeight: '800', color: '#92400E', marginBottom: 3 },
  deadlineDate: { fontSize: 14, fontWeight: '900', color: '#78350F', marginBottom: 4 },
  deadlineNote: { fontSize: 11, color: '#92400E', lineHeight: 17 },
  gcashBox: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#2563EB' },
  gcashIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  gcashLabel: { fontSize: 16, fontWeight: '900', color: '#1E40AF', marginBottom: 2 },
  gcashSub: { fontSize: 12, color: '#3B82F6' },
  payBtn: {
    marginHorizontal: 20, backgroundColor: '#2563EB',
    borderRadius: 18, paddingVertical: 18, alignItems: 'center',
    marginBottom: 14, shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { color: 'white', fontWeight: '900', fontSize: 16, marginBottom: 3 },
  payBtnSub: { color: '#93C5FD', fontSize: 11 },
  secureNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 20, marginBottom: 10 },
  secureNoteText: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 17 },

  // ── Icon size presets ──────────────────────────────────────
  iconBack: { width: 16, height: 16 },
  iconCardTitle: { width: 18, height: 18 },
  iconWarning: { width: 22, height: 22, marginTop: 2 },
  iconGcash: { width: 44, height: 44 },
  iconCheckBlue: { width: 26, height: 26 },
  iconLockSm: { width: 12, height: 12 },
});