import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Platform,
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import PaymentScreen from '../../screens/auth/PaymentScreen';
import ReviewScreen from '../../screens/auth/ReviewScreen';
import ChatScreen from '../../screens/auth/ChatScreen';

// ── Custom icon set (PNG) — replaces all emoji glyphs. ──────────
// All STATUS_CONFIG icons are single-color outlines (safe to tint per-status).
// Drop these into assets/icons/ alongside the rest of your icon set.
const ICONS = {
  hourglass: require('../../assets/icons/hourglass.png'),
  checkOutline: require('../../assets/icons/check_outline.png'),
  card: require('../../assets/icons/card.png'),
  refreshAmber: require('../../assets/icons/refresh_amber.png'),
  confetti: require('../../assets/icons/confetti.png'),
  xOutline: require('../../assets/icons/x_outline.png'),
  banned: require('../../assets/icons/banned.png'),
  clipboard: require('../../assets/icons/clipboard.png'),
  pin: require('../../assets/icons/pin.png'),
  warning: require('../../assets/icons/warning.png'),
  clock: require('../../assets/icons/clock.png'),
};

type Booking = {
  id: string; status: string;
  event_date: string; event_type: string | null;
  guest_count: number; total_cost: number;
  downpayment_amount: number; downpayment_deadline: string | null;
  venue: string | null; created_at: string;
  caterers: { business_name: string; logo_url: string | null; city: string | null } | null;
  packages: { name: string; tier: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:   { label: 'Pending Review',   color: '#92400E', bg: '#FEF3C7', icon: ICONS.hourglass },
  confirmed: { label: 'Confirmed',        color: '#166534', bg: '#DCFCE7', icon: ICONS.checkOutline },
  paid:      { label: 'Payment Verified', color: '#166534', bg: '#DCFCE7', icon: ICONS.checkOutline },
  ongoing:   { label: 'Event Ongoing',    color: '#D97706', bg: '#FFFBEB', icon: ICONS.refreshAmber },
  completed: { label: 'Completed',        color: '#166534', bg: '#DCFCE7', icon: ICONS.confetti },
  rejected:  { label: 'Rejected',         color: '#991B1B', bg: '#FEE2E2', icon: ICONS.xOutline },
  cancelled: { label: 'Cancelled',        color: '#6B7280', bg: '#F3F4F6', icon: ICONS.banned },
};

const TIER_CONFIG: Record<string, { color: string; bg: string }> = {
  bronze:  { color: '#B45309', bg: '#FEF3C7' },
  silver:  { color: '#6B7280', bg: '#F3F4F6' },
  gold:    { color: '#D97706', bg: '#FFFBEB' },
  premium: { color: '#7C3AED', bg: '#F5F3FF' },
};

const FILTERS = ['all', 'pending', 'confirmed', 'paid', 'ongoing', 'completed'];

export default function CustomerBookings() {
  const { session } = useAuth();
  const router = useRouter();
  const [bookings, setBookings]         = useState<Booking[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState('all');
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [chatBooking, setChatBooking]     = useState<Booking | null>(null);

  const load = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    let query = supabase
  .from('bookings')
  .select(`
    *,
    caterers(id, business_name, logo_url, city, user_id),
    packages(name, tier),
    reviews(id)
  `)
  .eq('customer_id', session.user.id)
  .order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setBookings((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [session, filter]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  const deadlinePassed = (d: string | null) =>
    d ? new Date(d) < new Date() : false;

  return (
    <View style={styles.root}>
      {/* Payment modal */}
      <Modal visible={!!payingBookingId} animationType="slide" presentationStyle="pageSheet">
        {payingBookingId && (
          <PaymentScreen bookingId={payingBookingId} onClose={() => { setPayingBookingId(null); load(); }} />
        )}
      </Modal>

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

      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}>
        <Text style={styles.pageTitle}>My Bookings</Text>
        <Text style={styles.pageSub}>{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} style={[styles.filterChip, filter === f && styles.filterChipActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label ?? f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.orange} /></View>
      ) : bookings.length === 0 ? (
        <View style={styles.center}>
          <Image source={ICONS.clipboard} style={styles.iconEmpty} />
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySub}>Browse caterers and make your first booking!</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.browseBtnText}>Browse Caterers</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {bookings.map(b => {
            const sc = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;
            const tc = TIER_CONFIG[(b.packages as any)?.tier] ?? TIER_CONFIG.bronze;
            const needsPayment = b.status === 'confirmed';
            const paymentOverdue = needsPayment && deadlinePassed(b.downpayment_deadline);

            return (
              <View key={b.id} style={[styles.bookingCard, paymentOverdue && styles.bookingCardUrgent]}>
                {/* Status */}
                <View style={[styles.statusBar, { backgroundColor: sc.bg }]}>
                  <View style={styles.statusTextRow}>
                    <Image source={sc.icon} style={[styles.iconStatus, { tintColor: sc.color }]} />
                    <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                  <Text style={[styles.statusDate, { color: sc.color }]}>{formatDate(b.created_at)}</Text>
                </View>

                <View style={styles.cardContent}>
                  {/* Caterer */}
                  <View style={styles.catererRow}>
                    {(b.caterers as any)?.logo_url ? (
                      <Image source={{ uri: (b.caterers as any).logo_url }} style={styles.catererLogo} />
                    ) : (
                      <View style={styles.catererLogoPlaceholder}>
                        <Text style={styles.catererLogoText}>{((b.caterers as any)?.business_name ?? 'C').charAt(0)}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catererName}>{(b.caterers as any)?.business_name ?? '—'}</Text>
                      <View style={styles.catererCityRow}>
                        <Image source={ICONS.pin} style={styles.iconPinSm} />
                        <Text style={styles.catererCity}>{(b.caterers as any)?.city ?? 'Cebu'}</Text>
                      </View>
                    </View>
                    {b.packages && (
                      <View style={[styles.tierPill, { backgroundColor: tc.bg }]}>
                        <Text style={[styles.tierPillText, { color: tc.color }]}>{b.packages.name}</Text>
                      </View>
                    )}
                  </View>

                  {/* Event info */}
                  <View style={styles.eventInfoRow}>
                    <View style={styles.eventInfoItem}>
                      <Text style={styles.eventInfoLabel}>DATE</Text>
                      <Text style={styles.eventInfoValue}>{formatDate(b.event_date)}</Text>
                    </View>
                    <View style={styles.eventInfoItem}>
                      <Text style={styles.eventInfoLabel}>GUESTS</Text>
                      <Text style={styles.eventInfoValue}>{b.guest_count}</Text>
                    </View>
                    <View style={styles.eventInfoItem}>
                      <Text style={styles.eventInfoLabel}>TOTAL</Text>
                      <Text style={[styles.eventInfoValue, { color: Colors.orange }]}>
                        ₱{Number(b.total_cost).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {/* Venue */}
                  {b.venue && (
                    <View style={styles.venueRow}>
                      <Image source={ICONS.pin} style={styles.iconPinSm} />
                      <Text style={styles.venueText}>{b.venue}</Text>
                    </View>
                  )}

                  {/* CTA — Pay downpayment */}
                  {b.status === 'confirmed' && (
                    <View style={styles.ctaSection}>
                      <View style={[styles.deadlineBox, paymentOverdue && styles.deadlineBoxUrgent]}>
                        <View style={styles.deadlineLabelRow}>
                          <Image
                            source={paymentOverdue ? ICONS.warning : ICONS.clock}
                            style={[styles.iconDeadline, paymentOverdue && { tintColor: Colors.error }]}
                          />
                          <Text style={[styles.deadlineLabel, paymentOverdue && { color: Colors.error }]}>
                            {paymentOverdue ? 'Payment Overdue!' : 'Downpayment Deadline'}
                          </Text>
                        </View>
                        <Text style={[styles.deadlineDate, paymentOverdue && { color: Colors.error }]}>
                          {b.downpayment_deadline ? formatDate(b.downpayment_deadline) : '—'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.payBtn}
                        onPress={() => setPayingBookingId(b.id)}
                      >
                        <Image source={ICONS.card} style={styles.iconPayBtn} />
                        <Text style={styles.payBtnText}>Pay ₱{Number(b.downpayment_amount).toLocaleString()} via GCash</Text>
                      </TouchableOpacity>
                      <Text style={styles.payNote}>
                        Payment is processed automatically via Xendit. Once GCash confirms your payment, your booking status updates to Paid instantly.
                      </Text>
                    </View>
                  )}

                  {b.status === 'paid' && (
                    <View style={styles.paidBox}>
                      <Image source={ICONS.checkOutline} style={[styles.iconInlineBox, { tintColor: '#166534' }]} />
                      <Text style={styles.paidBoxText}>Downpayment verified by Xendit. Your booking is fully confirmed!</Text>
                    </View>
                  )}

                  {b.status === 'completed' && (
                    <View style={styles.completedBox}>
                      <Image source={ICONS.confetti} style={[styles.iconInlineBox, { tintColor: '#166534' }]} />
                      <Text style={styles.completedText}>Event completed! Thank you for using CaterConnect.</Text>
                    </View>
                  )}

                  {/* Action buttons */}
                  <View style={styles.bookingActions}>
                    {/* Chat — available for confirmed and above */}
                    {['confirmed', 'paid', 'ongoing', 'completed'].includes(b.status) && (
                      <TouchableOpacity
                        style={styles.chatBtn}
                        onPress={() => setChatBooking(b)}
                      >
                        <Text style={styles.chatBtnText}>Message Caterer</Text>
                      </TouchableOpacity>
                    )}

                    {/* Review — only for completed, only if not yet reviewed */}
                    {b.status === 'completed' && !(b as any).reviews?.length && (
                      <TouchableOpacity
                        style={styles.reviewBtn}
                        onPress={() => setReviewBooking(b)}
                      >
                        <Text style={styles.reviewBtnText}>Leave a Review</Text>
                      </TouchableOpacity>
                    )}

                    {/* Already reviewed */}
                    {b.status === 'completed' && (b as any).reviews?.length > 0 && (
                      <View style={styles.reviewedBadge}>
                        <Image source={ICONS.checkOutline} style={[styles.iconReviewed, { tintColor: Colors.success }]} />
                        <Text style={styles.reviewedText}>Reviewed</Text>
                      </View>
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
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pageTitle: { fontSize: 26, fontWeight: '900', color: Colors.black },
  pageSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: Colors.white, fontWeight: '800' },
  list: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },

  bookingCard: { backgroundColor: Colors.white, borderRadius: 18, marginBottom: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  bookingCardUrgent: { borderColor: Colors.error, borderWidth: 2 },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  statusTextRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconStatus: { width: 14, height: 14 },
  statusText: { fontSize: 13, fontWeight: '800' },
  statusDate: { fontSize: 11, fontWeight: '600', opacity: 0.8 },
  cardContent: { padding: 14 },
  catererRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  catererLogo: { width: 44, height: 44, borderRadius: 12 },
  catererLogoPlaceholder: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.orange, justifyContent: 'center', alignItems: 'center' },
  catererLogoText: { color: Colors.white, fontSize: 18, fontWeight: '900' },
  catererName: { fontSize: 15, fontWeight: '800', color: Colors.black, marginBottom: 2 },
  catererCityRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconPinSm: { width: 11, height: 11, tintColor: Colors.textSecondary },
  catererCity: { fontSize: 12, color: Colors.textSecondary },
  tierPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tierPillText: { fontSize: 11, fontWeight: '800' },
  eventInfoRow: { flexDirection: 'row', backgroundColor: Colors.bgInput, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  eventInfoItem: { flex: 1, alignItems: 'center' },
  eventInfoLabel: { fontSize: 9, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1, marginBottom: 4 },
  eventInfoValue: { fontSize: 14, fontWeight: '900', color: Colors.black },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  venueText: { fontSize: 12, color: Colors.textSecondary },
  ctaSection: { gap: 10 },
  deadlineBox: { backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FDE68A', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deadlineBoxUrgent: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  deadlineLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconDeadline: { width: 14, height: 14, tintColor: '#92400E' },
  deadlineLabel: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  deadlineDate: { fontSize: 13, fontWeight: '900', color: '#92400E' },
  payBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 13, shadowColor: Colors.orange, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  iconPayBtn: { width: 16, height: 16, tintColor: Colors.white },
  payBtnText: { color: Colors.white, fontWeight: '900', fontSize: 14 },
  payNote: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 16 },
  paidBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DCFCE7', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#86EFAC' },
  paidBoxText: { fontSize: 13, color: '#166534', fontWeight: '700', flex: 1 },
  iconInlineBox: { width: 15, height: 15 },
  completedBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DCFCE7', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#86EFAC' },
  completedText: { fontSize: 13, color: '#166534', fontWeight: '700', flex: 1 },
  iconEmpty: { width: 52, height: 52, marginBottom: 12, tintColor: Colors.border },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.black, marginBottom: 6 },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  browseBtn: { backgroundColor: Colors.orange, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  browseBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },

  // Action buttons
  bookingActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chatBtn: {
    flex: 1, backgroundColor: Colors.bgInput,
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  chatBtnText: { fontSize: 13, fontWeight: '800', color: Colors.black },
  reviewBtn: {
    flex: 1, backgroundColor: Colors.orange,
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  reviewBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  reviewedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.success + '20', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: Colors.success + '40',
  },
  iconReviewed: { width: 13, height: 13 },
  reviewedText: { fontSize: 13, fontWeight: '800', color: Colors.success },
});