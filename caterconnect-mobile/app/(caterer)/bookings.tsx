import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { sendNotification } from '../../lib/notifications';
import ChatScreen from '../../screens/auth/ChatScreen';


const ICONS = {
  hourglass: require('../../assets/icons/hourglass.png'),
  checkSuccess: require('../../assets/icons/check_success.png'),
  card: require('../../assets/icons/card.png'),
  refreshAmber: require('../../assets/icons/refresh_amber.png'),
  refresh: require('../../assets/icons/refresh.png'),
  confetti: require('../../assets/icons/confetti.png'),
  rejected: require('../../assets/icons/rejected.png'),
  banned: require('../../assets/icons/banned.png'),
  emptyInbox: require('../../assets/icons/empty_inbox.png'),
  clipboard: require('../../assets/icons/clipboard.png'),
  guests: require('../../assets/icons/guests.png'),
  package: require('../../assets/icons/package.png'),
  person: require('../../assets/icons/person.png'),
  phone: require('../../assets/icons/phone.png'),
  sparkles: require('../../assets/icons/sparkles.png'),
  camera: require('../../assets/icons/camera.png'),
  star: require('../../assets/icons/star.png'),
  chat: require('../../assets/icons/chat.png'),
  bolt: require('../../assets/icons/bolt.png'),
  close: require('../../assets/icons/close.png'),
  checkOutline: require('../../assets/icons/check_outline.png'),
  xOutline: require('../../assets/icons/x_outline.png'),
};

type Booking = {
  id: string;
  customer_id: string; // ← added
  status: string;
  event_date: string;
  event_type: string | null;
  guest_count: number;
  total_cost: number;
  downpayment_amount: number;
  downpayment_deadline: string | null;
  venue: string | null;
  special_requests: string | null;
  payment_receipt_url: string | null;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
  customized_items: any[] | null;
  created_at: string;
  profiles: { full_name: string; email: string; avatar_url: string | null; phone_number: string | null } | null;
  packages: { name: string; tier: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:   { label: 'Pending',   color: '#92400E', bg: '#FEF3C7', icon: ICONS.hourglass },
  confirmed: { label: 'Confirmed', color: '#166534', bg: '#DCFCE7', icon: ICONS.checkOutline },
  paid:      { label: 'Paid',      color: '#166534', bg: '#DCFCE7', icon: ICONS.checkOutline },
  ongoing:   { label: 'Ongoing',   color: '#92400E', bg: '#FEF3C7', icon: ICONS.refreshAmber },
  completed: { label: 'Completed', color: '#166534', bg: '#DCFCE7', icon: ICONS.confetti },
  rejected:  { label: 'Rejected',  color: '#991B1B', bg: '#FEE2E2', icon: ICONS.xOutline },
  cancelled: { label: 'Cancelled', color: '#6B7280', bg: '#F3F4F6', icon: ICONS.banned },
};

const FILTERS = ['all', 'pending', 'confirmed', 'paid', 'ongoing', 'completed'];

export default function CatererBookings() {
  const { catererData, session } = useAuth();
  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState('all');
  const [selected, setSelected]       = useState<Booking | null>(null);
  const [updating, setUpdating]       = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [counts, setCounts]           = useState<Record<string, number>>({});
  const [chatBooking, setChatBooking] = useState<Booking | null>(null);

  const load = async () => {
    if (!catererData?.id) return;
    setLoading(true);

    let query = supabase
      .from('bookings')
      .select('*, customer_id, profiles(full_name, email, avatar_url, phone_number), packages(name, tier), reviews(id, food_quality, service_quality, timeliness, overall, comment, caterer_reply, created_at)')
      .eq('caterer_id', catererData.id)
      .order('created_at', { ascending: false });

    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setBookings((data as any) ?? []);

    const statuses = ['pending', 'confirmed', 'paid', 'ongoing', 'completed'];
    const countRes = await Promise.all(
      statuses.map(s => supabase.from('bookings').select('id', { count: 'exact', head: true })
        .eq('caterer_id', catererData.id).eq('status', s))
    );
    const c: Record<string, number> = {};
    statuses.forEach((s, i) => { c[s] = countRes[i].count ?? 0; });
    c.all = Object.values(c).reduce((a, b) => a + b, 0);
    setCounts(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, [catererData?.id, filter]);

  const notifyCustomer = async (booking: Booking, title: string, message: string) => {
    const { data } = await supabase.from('bookings').select('customer_id').eq('id', booking.id).single();
    if (data?.customer_id) {
      await sendNotification({
        user_id: data.customer_id,
        title,
        message,
        type: 'booking_approved',
        booking_id: booking.id,
      });
    }
  };

  const handleAction = async (action: string, booking: Booking) => {
    setUpdating(true);
    let updates: Record<string, any> = {};
    let notifTitle = '';
    let notifMsg = '';
    let notifType:
      | 'booking_submitted' | 'booking_approved' | 'booking_rejected'
      | 'payment_submitted' | 'payment_verified' | 'booking_completed'
      | 'booking_cancelled' | 'package_customized' | 'new_booking_request'
      = 'booking_approved';

    switch (action) {
      case 'confirm':
        updates = { status: 'confirmed' };
        notifTitle = 'Booking Confirmed!';
        notifMsg = `Your booking has been confirmed! Please pay the downpayment of ₱${booking.downpayment_amount.toLocaleString()} before the deadline.`;
        notifType = 'booking_approved';
        break;
      case 'reject':
        if (!rejectReason.trim()) {
          Alert.alert('Required', 'Please provide a reason for rejection.');
          setUpdating(false); return;
        }
        updates = { status: 'rejected' };
        notifTitle = 'Booking Rejected';
        notifMsg = `Your booking was rejected. Reason: ${rejectReason}`;
        notifType = 'booking_rejected';
        break;
      case 'mark_ongoing':
        updates = { status: 'ongoing' };
        notifTitle = 'Event is Ongoing';
        notifMsg = 'Your event has started! We hope you enjoy your catering service.';
        notifType = 'booking_approved';
        break;
      case 'complete':
        updates = { status: 'completed' };
        notifTitle = 'Event Completed!';
        notifMsg = 'Your event has been marked as completed. Please leave a review for your caterer!';
        notifType = 'booking_completed';
        break;
    }

    const { error } = await supabase.from('bookings').update(updates).eq('id', booking.id);
    if (error) { Alert.alert('Error', error.message); setUpdating(false); return; }


    const { data: bData } = await supabase.from('bookings').select('customer_id').eq('id', booking.id).single();
    if (bData?.customer_id) {
      await sendNotification({
        user_id: bData.customer_id,
        title: notifTitle,
        message: notifMsg,
        type: notifType,
        booking_id: booking.id,
      });
    }

    setUpdating(false);
    setSelected(null);
    setShowRejectModal(false);
    setRejectReason('');
    load();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}>
        <View>
          <Text style={styles.pageTitle}>Bookings</Text>
          <Text style={styles.pageSub}>{counts.all ?? 0} total · {counts.pending ?? 0} pending</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Image source={ICONS.refresh} style={styles.iconRefresh} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Text>
            {counts[f] !== undefined && counts[f] > 0 && (
              <View style={[styles.filterCount, filter === f && styles.filterCountActive]}>
                <Text style={[styles.filterCountText, filter === f && styles.filterCountTextActive]}>{counts[f]}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.orange} /></View>
      ) : bookings.length === 0 ? (
        <View style={styles.center}>
          <Image source={ICONS.emptyInbox} style={styles.iconEmpty} />
          <Text style={styles.emptyTitle}>No{filter !== 'all' ? filter.replace('_', ' ') : ''} bookings</Text>
          <Text style={styles.emptySub}>Bookings will appear here once customers book your services.</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {bookings.map(b => {
            const sc = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;
            return (
              <TouchableOpacity key={b.id} style={styles.bookingCard} onPress={() => setSelected(b)} activeOpacity={0.85}>
                <View style={[styles.cardStripe, { backgroundColor: sc.bg }]}>
                  <View style={styles.cardStripeLeft}>
                    <Image source={sc.icon} style={[styles.iconStripe, { tintColor: sc.color }]} />
                    <Text style={[styles.cardStripeText, { color: sc.color }]}>{sc.label}</Text>
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
                      <Text style={styles.customerName}>{b.profiles?.full_name ?? '—'}</Text>
                      <Text style={styles.customerEmail}>{b.profiles?.email ?? ''}</Text>
                    </View>
                    <View style={styles.cardAmount}>
                      <Text style={styles.cardAmountValue}>₱{Number(b.total_cost).toLocaleString()}</Text>
                      <Text style={styles.cardAmountSub}>total</Text>
                    </View>
                  </View>

                  <View style={styles.cardDetailRow}>
                    <View style={styles.cardDetail}>
                      <Image source={ICONS.clipboard} style={styles.iconDetail} />
                      <Text style={styles.cardDetailText}>{formatDate(b.event_date)}</Text>
                    </View>
                    <View style={styles.cardDetail}>
                      <Image source={ICONS.guests} style={styles.iconDetail} />
                      <Text style={styles.cardDetailText}>{b.guest_count} guests</Text>
                    </View>
                    <View style={styles.cardDetail}>
                      <Image source={ICONS.confetti} style={styles.iconDetail} />
                      <Text style={styles.cardDetailText}>{b.event_type ?? '—'}</Text>
                    </View>
                  </View>

                  {b.packages && (
                    <View style={styles.pkgTag}>
                      <Image source={ICONS.package} style={styles.iconPkgTag} />
                      <Text style={styles.pkgTagText}>{b.packages.name}</Text>
                    </View>
                  )}

                  {b.status === 'pending' && (
                    <View style={styles.quickActions}>
                      <TouchableOpacity
                        style={[styles.quickBtn, styles.quickBtnConfirm]}
                        onPress={() => { setSelected(b); }}
                      >
                        <Image source={ICONS.checkSuccess} style={styles.iconQuickBtn} />
                        <Text style={styles.quickBtnText}>Review & Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => { setSelected(null); setShowRejectModal(false); setRejectReason(''); }}
              >
                <Image source={ICONS.close} style={[styles.iconModalClose, { tintColor: Colors.textSecondary }]} />
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Booking Detail</Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
              {(() => {
                const sc = STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.pending;
                return (
                  <View style={[styles.statusBanner, { backgroundColor: sc.bg }]}>
                    <Image source={sc.icon} style={[styles.iconStatusBanner, { tintColor: sc.color }]} />
                    <Text style={[styles.statusBannerText, { color: sc.color }]}>
                      {sc.label}
                    </Text>
                  </View>
                );
              })()}

              <View style={styles.modalBody}>
                <View style={styles.modalSection}>
                  <View style={styles.modalSectionTitleRow}>
                    <Image source={ICONS.person} style={styles.iconSectionTitle} />
                    <Text style={styles.modalSectionTitle}>Customer</Text>
                  </View>
                  <View style={styles.modalCard}>
                    <View style={styles.modalCustomerRow}>
                      {selected.profiles?.avatar_url ? (
                        <Image source={{ uri: selected.profiles.avatar_url }} style={styles.modalAvatar} />
                      ) : (
                        <View style={styles.modalAvatarPlaceholder}>
                          <Text style={styles.modalAvatarText}>{(selected.profiles?.full_name ?? 'C').charAt(0)}</Text>
                        </View>
                      )}
                      <View>
                        <Text style={styles.modalCustomerName}>{selected.profiles?.full_name ?? '—'}</Text>
                        <Text style={styles.modalCustomerSub}>{selected.profiles?.email}</Text>
                        {selected.profiles?.phone_number && (
                          <View style={styles.modalCustomerPhoneRow}>
                            <Image source={ICONS.phone} style={styles.iconPhoneSm} />
                            <Text style={styles.modalCustomerSub}>{selected.profiles.phone_number}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <View style={styles.modalSectionTitleRow}>
                    <Image source={ICONS.clipboard} style={styles.iconSectionTitle} />
                    <Text style={styles.modalSectionTitle}>Event Details</Text>
                  </View>
                  <View style={styles.modalCard}>
                    {[
                      { label: 'Package',    value: selected.packages?.name ?? '—' },
                      { label: 'Date',       value: formatDate(selected.event_date) },
                      { label: 'Guests',     value: `${selected.guest_count} pax` },
                      { label: 'Event Type', value: selected.event_type ?? '—' },
                      { label: 'Venue',      value: selected.venue ?? '—' },
                      ...(selected.special_requests ? [{ label: 'Special Requests', value: selected.special_requests }] : []),
                    ].map(row => (
                      <View key={row.label} style={styles.modalRow}>
                        <Text style={styles.modalRowLabel}>{row.label}</Text>
                        <Text style={styles.modalRowValue}>{row.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {selected.customized_items && selected.customized_items.length > 0 && (
                  <View style={styles.modalSection}>
                    <View style={styles.modalSectionTitleRow}>
                      <Image source={ICONS.sparkles} style={styles.iconSectionTitle} />
                      <Text style={styles.modalSectionTitle}>Add-ons Requested</Text>
                    </View>
                    <View style={styles.modalCard}>
                      {selected.customized_items.map((item: any, i: number) => (
                        <View key={i} style={styles.modalRow}>
                          <Text style={styles.modalRowLabel}>{item.name} ×{item.quantity}</Text>
                          <Text style={styles.modalRowValue}>₱{item.price_per_guest}/guest</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.modalSection}>
                  <View style={styles.modalSectionTitleRow}>
                    <Image source={ICONS.card} style={styles.iconSectionTitle} />
                    <Text style={styles.modalSectionTitle}>Payment</Text>
                  </View>
                  <View style={styles.modalCard}>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalRowLabel}>Total Cost</Text>
                      <Text style={[styles.modalRowValue, { color: Colors.orange, fontSize: 18 }]}>
                        ₱{Number(selected.total_cost).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalRowLabel}>Downpayment</Text>
                      <Text style={styles.modalRowValue}>₱{Number(selected.downpayment_amount).toLocaleString()}</Text>
                    </View>
                    {selected.downpayment_deadline && (
                      <View style={styles.modalRow}>
                        <Text style={styles.modalRowLabel}>Deadline</Text>
                        <Text style={[styles.modalRowValue, { color: Colors.error }]}>
                          {formatDate(selected.downpayment_deadline)}
                        </Text>
                      </View>
                    )}
                    {selected.payment_verified_at && (
                      <View style={[styles.paymentReceiptBox]}>
                        <View style={styles.paymentReceiptLabelRow}>
                          <Image source={ICONS.card} style={styles.iconCameraSm} />
                          <Text style={styles.paymentReceiptLabel}>Payment verified by Xendit</Text>
                        </View>
                        <Text style={styles.paymentReceiptTime}>{formatDate(selected.payment_verified_at)}</Text>
                        {selected.payment_receipt_url && (
                          <Text style={styles.paymentReceiptRef}>Ref: {selected.payment_receipt_url}</Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                {(selected as any).reviews?.length > 0 && (
                  <View style={styles.modalSection}>
                    <View style={styles.modalSectionTitleRow}>
                      <Image source={ICONS.star} style={styles.iconSectionTitle} />
                      <Text style={styles.modalSectionTitle}>Customer Review</Text>
                    </View>
                    {(selected as any).reviews.map((r: any) => (
                      <View key={r.id} style={styles.modalCard}>
                        <View style={styles.reviewStarsRow}>
                          {['Food', 'Service', 'Time', 'Overall'].map((label, i) => {
                            const vals = [r.food_quality, r.service_quality, r.timeliness, r.overall];
                            return (
                              <View key={label} style={styles.reviewStarItem}>
                                <Text style={styles.reviewStarLabel}>{label}</Text>
                                <View style={styles.reviewStarValRow}>
                                  <Text style={styles.reviewStarVal}>{vals[i]}</Text>
                                  <Image source={ICONS.star} style={styles.iconStarTiny} />
                                </View>
                              </View>
                            );
                          })}
                        </View>
                        {r.comment && (
                          <Text style={styles.reviewComment}>"{r.comment}"</Text>
                        )}
                        {!r.caterer_reply && (
                          <TouchableOpacity
                            style={styles.replyBtn}
                            onPress={async () => {
                              Alert.prompt('Reply to Review', 'Write your response:', async (reply) => {
                                if (!reply?.trim()) return;
                                await supabase.from('reviews').update({
                                  caterer_reply: reply.trim(),
                                  caterer_replied_at: new Date().toISOString(),
                                }).eq('id', r.id);
                                load();
                                setSelected(null);
                              });
                            }}
                          >
                            <Image source={ICONS.chat} style={styles.iconReplyBtn} />
                            <Text style={styles.replyBtnText}>Reply to Review</Text>
                          </TouchableOpacity>
                        )}
                        {r.caterer_reply && (
                          <View style={styles.catererReplyBox}>
                            <Text style={styles.catererReplyLabel}>YOUR REPLY</Text>
                            <Text style={styles.catererReplyText}>{r.caterer_reply}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.modalSection}>
                  <View style={styles.modalSectionTitleRow}>
                    <Image source={ICONS.bolt} style={styles.iconSectionTitle} />
                    <Text style={styles.modalSectionTitle}>Actions</Text>
                  </View>

                  {selected.status === 'pending' && !showRejectModal && (
                    <View style={styles.actionGroup}>
                      <Text style={styles.actionNote}>
                        Review this booking request and confirm or reject it.
                      </Text>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnConfirm]}
                        onPress={() => handleAction('confirm', selected)}
                        disabled={updating}
                      >
                        {updating ? <ActivityIndicator color="white" /> : (
                          <View style={styles.actionBtnRow}>
                            <Image source={ICONS.checkSuccess} style={styles.iconActionBtn} />
                            <Text style={styles.actionBtnText}>Confirm Booking</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnReject]}
                        onPress={() => setShowRejectModal(true)}
                        disabled={updating}
                      >
                        <View style={styles.actionBtnRow}>
                          <Image source={ICONS.rejected} style={styles.iconActionBtn} />
                          <Text style={[styles.actionBtnText, { color: Colors.error }]}>Reject Booking</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}

                  {selected.status === 'pending' && showRejectModal && (
                    <View style={styles.actionGroup}>
                      <Text style={styles.fieldLabel}>Reason for Rejection *</Text>
                      <TextInput
                        style={[styles.fieldInput, { minHeight: 80 }]}
                        placeholder="Tell the customer why you're rejecting their request..."
                        placeholderTextColor={Colors.textMuted}
                        value={rejectReason}
                        onChangeText={setRejectReason}
                        multiline
                        textAlignVertical="top"
                      />
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnReject, { marginTop: 8 }]}
                        onPress={() => handleAction('reject', selected)}
                        disabled={updating}
                      >
                        {updating ? <ActivityIndicator color={Colors.error} /> : <Text style={[styles.actionBtnText, { color: Colors.error }]}>Confirm Rejection</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowRejectModal(false)} style={{ marginTop: 8, alignItems: 'center' }}>
                        <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {selected.status === 'confirmed' && (
                    <View style={styles.actionGroup}>
                      <View style={styles.waitingBox}>
                        <View style={styles.waitingTextRow}>
                          <Image source={ICONS.hourglass} style={styles.iconWaiting} />
                          <Text style={styles.waitingText}>Waiting for customer to complete GCash payment.</Text>
                        </View>
                        <Text style={styles.waitingDeadline}>
                          Deadline: {selected.downpayment_deadline ? formatDate(selected.downpayment_deadline) : '—'}
                        </Text>
                        <Text style={styles.waitingNote}>
                          Payment will be confirmed automatically by Xendit once the customer completes their GCash transaction. No manual verification needed.
                        </Text>
                      </View>
                    </View>
                  )}

                  {selected.status === 'paid' && (
                    <View style={styles.actionGroup}>
                      <View style={styles.paidBanner}>
                        <Image source={ICONS.checkOutline} style={[styles.iconPaidBanner, { tintColor: '#166534' }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.paidBannerTitle}>Downpayment Confirmed by Xendit</Text>
                          <Text style={styles.paidBannerSub}>
                            The customer paid ₱{Number(selected.downpayment_amount).toLocaleString()} via GCash, and it has been successfully transferred to your GCash account.
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#D97706' }]}
                        onPress={() => handleAction('mark_ongoing', selected)}
                        disabled={updating}
                      >
                        {updating ? <ActivityIndicator color="white" /> : (
                          <View style={styles.actionBtnRow}>
                            <Image source={ICONS.refresh} style={[styles.iconActionBtn, { tintColor: Colors.white }]} />
                            <Text style={styles.actionBtnText}>Mark as Ongoing</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* ONGOING — mark complete */}
                  {selected.status === 'ongoing' && (
                    <View style={styles.actionGroup}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnConfirm]}
                        onPress={() => handleAction('complete', selected)}
                        disabled={updating}
                      >
                        {updating ? <ActivityIndicator color="white" /> : (
                          <View style={styles.actionBtnRow}>
                            <Image source={ICONS.confetti} style={[styles.iconActionBtn, { tintColor: Colors.white }]} />
                            <Text style={styles.actionBtnText}>Mark as Completed</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {['completed', 'rejected', 'cancelled'].includes(selected.status) && (
                    <View style={styles.finalStatusBox}>
                      <View style={styles.finalStatusRow}>
                        {selected.status === 'completed' && (
                          <>
                            <Image source={ICONS.confetti} style={[styles.iconFinalStatus, { tintColor: Colors.textSecondary }]} />
                            <Text style={styles.finalStatusText}>This booking has been completed.</Text>
                          </>
                        )}
                        {selected.status === 'rejected' && (
                          <>
                            <Image source={ICONS.rejected} style={styles.iconFinalStatus} />
                            <Text style={styles.finalStatusText}>This booking was rejected.</Text>
                          </>
                        )}
                        {selected.status === 'cancelled' && (
                          <>
                            <Image source={ICONS.banned} style={styles.iconFinalStatus} />
                            <Text style={styles.finalStatusText}>This booking was cancelled.</Text>
                          </>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Message Customer button */}
                  {!['cancelled', 'rejected'].includes(selected.status) && (
                    <TouchableOpacity
                      style={styles.chatBtn}
                      onPress={() => { setSelected(null); setChatBooking(selected); }}
                    >
                      <Image source={ICONS.chat} style={[styles.iconChatBtn, { tintColor: Colors.black }]} />
                      <Text style={styles.chatBtnText}>Message Customer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Chat Modal */}
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
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 4,
  },
  pageTitle: { fontSize: 26, fontWeight: '900', color: Colors.black },
  pageSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  refreshBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.bgInput, justifyContent: 'center', alignItems: 'center' },
  iconRefresh: { width: 17, height: 17 },

  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  filterChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.white, fontWeight: '800' },
  filterCount: { backgroundColor: Colors.bgInput, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterCountText: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary },
  filterCountTextActive: { color: Colors.white },

  list: { flex: 1 },
  bookingCard: {
    backgroundColor: Colors.white, marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  cardStripe: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  cardStripeLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconStripe: { width: 13, height: 13 },
  cardStripeText: { fontSize: 13, fontWeight: '800' },
  cardStripeTime: { fontSize: 11, fontWeight: '600', opacity: 0.8 },
  cardBody: { padding: 14 },
  cardCustomerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  customerAvatar: { width: 42, height: 42, borderRadius: 21 },
  customerAvatarPlaceholder: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.orangeLight, justifyContent: 'center', alignItems: 'center' },
  customerAvatarText: { fontSize: 16, fontWeight: '900', color: Colors.orange },
  customerName: { fontSize: 15, fontWeight: '800', color: Colors.black, marginBottom: 2 },
  customerEmail: { fontSize: 12, color: Colors.textSecondary },
  cardAmount: { alignItems: 'flex-end' },
  cardAmountValue: { fontSize: 17, fontWeight: '900', color: Colors.orange },
  cardAmountSub: { fontSize: 10, color: Colors.textMuted },
  cardDetailRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  cardDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconDetail: { width: 13, height: 13, tintColor: Colors.textSecondary },
  cardDetailText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  pkgTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.bgInput, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  iconPkgTag: { width: 11, height: 11, tintColor: Colors.textSecondary },
  pkgTagText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  quickActions: { marginTop: 4 },
  quickBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderRadius: 10, paddingVertical: 10, borderWidth: 1.5 },
  quickBtnConfirm: { backgroundColor: Colors.success, borderColor: Colors.success },
  iconQuickBtn: { width: 13, height: 13 },
  quickBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13 },

  modal: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
  },
  modalCloseBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  iconModalClose: { width: 12, height: 12 },
  modalClose: { fontSize: 13, color: Colors.textSecondary, fontWeight: '700' },
  modalTitle: { fontSize: 16, fontWeight: '900', color: Colors.black },
  statusBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 20 },
  iconStatusBanner: { width: 16, height: 16 },
  statusBannerText: { fontSize: 15, fontWeight: '900', textAlign: 'center' },
  modalBody: { padding: 20 },
  modalSection: { marginBottom: 20 },
  modalSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  iconSectionTitle: { width: 15, height: 15, tintColor: Colors.black },
  modalSectionTitle: { fontSize: 14, fontWeight: '900', color: Colors.black },
  modalCard: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  modalCustomerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalAvatar: { width: 50, height: 50, borderRadius: 25 },
  modalAvatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.orange, justifyContent: 'center', alignItems: 'center' },
  modalAvatarText: { color: Colors.white, fontSize: 20, fontWeight: '900' },
  modalCustomerName: { fontSize: 16, fontWeight: '800', color: Colors.black, marginBottom: 2 },
  modalCustomerSub: { fontSize: 12, color: Colors.textSecondary },
  modalCustomerPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  iconPhoneSm: { width: 10, height: 10, tintColor: Colors.textSecondary },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  modalRowLabel: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  modalRowValue: { fontSize: 13, fontWeight: '700', color: Colors.black, flex: 1, textAlign: 'right' },
  paymentReceiptBox: { marginTop: 10, backgroundColor: '#DCFCE7', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#86EFAC' },
  paymentReceiptLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  iconCameraSm: { width: 13, height: 13, tintColor: '#166534' },
  paymentReceiptLabel: { fontSize: 13, fontWeight: '800', color: '#166534' },
  paymentReceiptTime: { fontSize: 12, color: '#166534' },
  paymentReceiptRef: { fontSize: 11, color: '#6B7280', marginTop: 4 },

  reviewStarsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  reviewStarItem: { alignItems: 'center' },
  reviewStarLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 4 },
  reviewStarValRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  reviewStarVal: { fontSize: 16, fontWeight: '900', color: Colors.orange },
  iconStarTiny: { width: 11, height: 11 },
  reviewComment: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, fontStyle: 'italic', marginBottom: 12 },
  replyBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, backgroundColor: Colors.bgInput, borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  iconReplyBtn: { width: 14, height: 14, tintColor: Colors.black },
  replyBtnText: { fontSize: 13, fontWeight: '800', color: Colors.black },
  catererReplyBox: { backgroundColor: Colors.orangeLight, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FFB26B', marginTop: 8 },
  catererReplyLabel: { fontSize: 10, fontWeight: '800', color: Colors.orange, marginBottom: 4 },
  catererReplyText: { fontSize: 13, color: '#92400E', lineHeight: 19 },

  actionGroup: { gap: 10 },
  actionNote: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border },
  actionBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5 },
  actionBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconActionBtn: { width: 16, height: 16 },
  actionBtnConfirm: { backgroundColor: Colors.success, borderColor: Colors.success },
  actionBtnReject: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  actionBtnText: { fontSize: 15, fontWeight: '900', color: Colors.white },
  waitingBox: { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FDE68A' },
  waitingTextRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  iconWaiting: { width: 15, height: 15, tintColor: '#92400E', marginTop: 1 },
  waitingText: { fontSize: 13, color: '#92400E', fontWeight: '700', flex: 1 },
  waitingDeadline: { fontSize: 12, color: '#B45309' },
  waitingNote: { fontSize: 11, color: '#B45309', marginTop: 6, lineHeight: 16 },
  paidBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#DCFCE7', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#86EFAC',
  },
  iconPaidBanner: { width: 22, height: 22, marginTop: 1 },
  paidBannerTitle: { fontSize: 14, fontWeight: '800', color: '#166534', marginBottom: 4 },
  paidBannerSub: { fontSize: 12, color: '#166534', lineHeight: 18 },
  finalStatusBox: { backgroundColor: Colors.bgInput, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  finalStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  iconFinalStatus: { width: 16, height: 16 },
  finalStatusText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textAlign: 'center' },

  chatBtn: {
    marginTop: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgInput,
    borderRadius: 12, paddingVertical: 14,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  iconChatBtn: { width: 16, height: 16 },
  chatBtnText: { fontSize: 15, fontWeight: '800', color: Colors.black },

  fieldLabel: { fontSize: 13, fontWeight: '800', color: Colors.black, marginBottom: 8 },
  fieldInput: {
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: Colors.black,
  },
  iconEmpty: { width: 56, height: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.black, marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});