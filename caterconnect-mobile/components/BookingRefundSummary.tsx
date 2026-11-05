import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';

export function refundStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = { none: 'No refund due', pending: 'Pending transfer', overdue: 'Transfer overdue',
    awaiting_customer_confirmation: 'Awaiting Customer confirmation', processed: 'Processed', failed: 'Refund failed' };
  return labels[status ?? 'none'] ?? String(status).replace(/_/g, ' ');
}

type RefundSnapshot = { cancelled_by: string | null; cancellation_reason: string | null; refund_status: string;
  refund_amount: number; refund_due_at?: string | null; refunded_at: string | null; refund_account_details: string | null };

// Read-only presentation of existing fields; eligibility and saving remain in the screens.
export default function BookingRefundSummary({ booking, children }: { booking: RefundSnapshot; children?: ReactNode }) {
  const rows: [string, string][] = [
    ['Cancelled by', booking.cancelled_by === 'caterer' ? 'Caterer' : booking.cancelled_by === 'customer' ? 'Customer' : booking.cancelled_by ?? 'Not recorded'],
    ['Reason', booking.cancellation_reason ?? 'Not recorded'],
    ['Refund status', refundStatusLabel(booking.refund_status)],
    ['Refund amount', Number(booking.refund_amount).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })],
    ['Refund deadline', booking.refund_due_at ? new Date(booking.refund_due_at).toLocaleString('en-PH') : 'Not recorded'],
  ];
  if (booking.refunded_at) rows.push(['Customer confirmed receipt', new Date(booking.refunded_at).toLocaleString('en-PH')]);
  if (booking.refund_account_details) {
    try {
      const d = JSON.parse(booking.refund_account_details);
      if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Legacy destination');
      const method = d.method || d.payment_method || d.refund_method;
      const labels: Record<string, string> = { gcash: 'GCash', maya: 'Maya', bpi: 'BPI', bdo: 'BDO', other_bank: 'Other Bank' };
      rows.push(['Refund method', labels[String(method).toLowerCase()] ?? String(method || 'Not recorded')],
        ['Account name', String(d.account_holder || d.account_holder_name || d.account_name || d.name || 'Not recorded')],
        ['Account number', String(d.account_number || d.mobile_number || d.number || d.gcash_number || 'Not recorded')]);
      if (d.bank_name) rows.push(['Bank', String(d.bank_name)]);
    } catch { rows.push(['Refund destination', booking.refund_account_details]); }
  }
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.heading}>Cancellation & Refund</Text>
    {rows.map(([label, value]) => <View key={label} style={styles.row}><Text style={styles.label}>{label}</Text><Text selectable style={styles.value}>{value}</Text></View>)}
    {!booking.refund_account_details && Number(booking.refund_amount) > 0 && ['pending', 'overdue'].includes(booking.refund_status) && <Text style={styles.notice}>Waiting for Customer refund account details. Transfer proof can be submitted after the destination is provided and the transfer is completed.</Text>}
    {children}
  </View>;
}



const styles = StyleSheet.create({
  section: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 14 },
  heading: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  label: { flex: 1, fontSize: 14, lineHeight: 21, color: Colors.textSecondary },
  value: { flex: 1.2, fontSize: 14, lineHeight: 21, color: Colors.textPrimary, fontWeight: '600', textAlign: 'right' },
  notice: { fontSize: 13, lineHeight: 20, color: Colors.textSecondary, marginTop: 10 },

});
