import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { CUSTOMER_EMERGENCY_MESSAGE, eventTimingLabel, isUrgentEvent } from '../lib/emergencyCancellation';
import { refundStatusLabel } from './BookingRefundSummary';

type Booking = {
  status: string; cancelled_by: string | null; event_date: string | null;
  refund_amount: number | null; refund_status: string | null; refund_due_at?: string | null;
};

export default function CustomerEmergencyAssistance({ booking, onFind, showRefund = true }: {
  booking: Booking; onFind: () => void; showRefund?: boolean;
}) {
  if (booking.status !== 'cancelled' || booking.cancelled_by !== 'caterer') return null;
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>Cancelled by Caterer.</Text>
    <Text style={styles.body}>{CUSTOMER_EMERGENCY_MESSAGE}</Text>
    <Text style={styles.body}>Original event date: {booking.event_date || 'Not recorded'} · {eventTimingLabel(booking.event_date)}</Text>
    {isUrgentEvent(booking.event_date) && <Text accessibilityRole="alert" style={styles.urgent}>Urgent assistance: Your event is within 7 Philippine calendar days. Explore alternatives promptly and contact caterers directly to check availability.</Text>}
    {showRefund && <>
      <Text style={styles.body}>Recorded refund: {booking.refund_amount == null ? 'Not recorded' : Number(booking.refund_amount).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</Text>
      <Text style={styles.body}>Refund status: {booking.refund_status ? refundStatusLabel(booking.refund_status) : 'Not recorded'}</Text>
      <Text style={styles.body}>Refund deadline: {booking.refund_due_at ? new Date(booking.refund_due_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'Not recorded'}</Text>
    </>}
    <Text style={styles.body}>If a refund is due and your destination is missing, provide your refund account using the existing refund controls.</Text>
    <TouchableOpacity accessibilityRole="button" onPress={event => { event.stopPropagation(); onFind(); }} style={styles.button}>
      <Text style={styles.buttonText}>Find Alternative Caterers</Text>
    </TouchableOpacity>
    <Text style={styles.body}>Replacement availability is not guaranteed. No new booking is created and your details are not sent to other caterers.</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA', borderWidth: 1, borderRadius: 12, padding: 14, marginVertical: 12, gap: 10 },
  title: { color: '#9A3412', fontSize: 16, fontWeight: '800' },
  body: { color: Colors.textPrimary, fontSize: 13, lineHeight: 20 },
  urgent: { color: '#B91C1C', fontSize: 14, lineHeight: 21, fontWeight: '700' },
  button: { backgroundColor: Colors.orange, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', minHeight: 48 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, textAlign: 'center' },
});
