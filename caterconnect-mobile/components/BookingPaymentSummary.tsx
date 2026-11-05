import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';

type PaymentSnapshot = {
  status: string;
  total_cost: number;
  downpayment_amount: number;
  payment_method: string | null;
  payment_reference?: string | null;
  payment_receipt_url: string | null;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
  downpayment_deadline: string | null;
};

// Presentation only: no checkout, persistence, or payment-state decisions.
export default function BookingPaymentSummary({ booking, methodLabel }: {
  booking: PaymentSnapshot; methodLabel: string;
}) {
  const money = (value: number) => Number(value).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
  const date = (value: string | null) => value ? new Date(value).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }) : 'Not recorded';
  const rows: [string, string][] = [
    ['Total booking price', money(booking.total_cost)],
    ['Required downpayment', money(booking.downpayment_amount)],
    ['Verified downpayment', booking.payment_verified_at ? money(booking.downpayment_amount) : 'Not verified'],
  ];
  if (booking.payment_verified_at && !['cancelled', 'rejected'].includes(booking.status)) {
    rows.push(['Balance after downpayment', money(Math.max(0, Number(booking.total_cost) - Number(booking.downpayment_amount)))]);
  }
  rows.push(['Payment method', methodLabel], ['Xendit reference', booking.payment_reference || 'Not recorded']);
  if (booking.payment_receipt_url) rows.push(['Receipt record', booking.payment_receipt_url]);
  rows.push(['Submitted', date(booking.payment_submitted_at)], ['Verified', date(booking.payment_verified_at)],
    ['Payment deadline', date(booking.downpayment_deadline)]);
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.title}>Payment Summary</Text>
    {rows.map(([label, value]) => <View key={label} style={styles.row}>
      <Text style={styles.label}>{label}</Text><Text selectable style={styles.value}>{value}</Text>
    </View>)}
    <Text style={styles.note}>Balance uses the recorded verified downpayment only. Additional or offline payments are not included.</Text>
  </View>;
}

const styles = StyleSheet.create({
  section: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  label: { flex: 1, fontSize: 14, lineHeight: 21, color: Colors.textSecondary },
  value: { flex: 1.2, fontSize: 14, lineHeight: 21, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right' },
  note: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary, marginTop: 10 },
});
