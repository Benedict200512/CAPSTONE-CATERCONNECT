import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Linking,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { sendNotification } from '../../lib/notifications';
import ChatScreen from '../../screens/auth/ChatScreen';
import { initiateGCashPayment, openGCashCheckout } from '../../lib/xendit';
import {
  Clock, CheckCircle, CreditCard, RefreshCw, PartyPopper,
  XCircle, Ban, Inbox, Calendar, Users, Package, User,
  Phone, Sparkles, Star, MessageSquare, Zap, X, Check,
  MapPin, ExternalLink, ShieldCheck, AlertTriangle, ShieldAlert
} from 'lucide-react-native';

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
  payment_receipt_url: string | null;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
  customized_items: any[] | null;
  created_at: string;
  rejection_reason: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  // --- Refund Tracking & Account Fields ---
  refund_status: 'none' | 'pending' | 'processed' | 'failed';
  refund_amount: number;
  refunded_at: string | null;
  refund_account_details: string | null;
  profiles: { full_name: string; email: string; avatar_url: string | null; phone_number: string | null } | null;
  packages: { name: string; tier: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:   { label: 'Pending',   color: '#B45309', bg: '#FEF3C7', icon: Clock },
  confirmed: { label: 'Confirmed', color: '#15803D', bg: '#DCFCE7', icon: CheckCircle },
  paid:      { label: 'Paid',      color: '#15803D', bg: '#DCFCE7', icon: ShieldCheck },
  ongoing:   { label: 'Ongoing',   color: '#C2410C', bg: '#FFEDD5', icon: RefreshCw },
  completed: { label: 'Completed', color: '#1E40AF', bg: '#DBEAFE', icon: PartyPopper },
  rejected:  { label: 'Rejected',  color: '#B91C1C', bg: '#FEE2E2', icon: XCircle },
  cancelled: { label: 'Cancelled', color: '#4B5563', bg: '#F3F4F6', icon: Ban },
};

const FILTERS = ['all', 'pending', 'confirmed', 'paid', 'ongoing', 'completed', 'cancelled', 'rejected'];

// Caterer-specific preset cancellation reasons
const CATERER_CANCEL_REASONS = [
  "Equipment or kitchen failure",
  "Staffing emergency",
  "Personal/Family emergency",
  "Event location/logistics issue",
  "Other"
];

// Helper to calculate 7-Day Rule warning message from Caterer POV
const getCancelWarningMessage = (booking: Booking | null) => {
  if (!booking) return '';
  const eventDate = new Date(booking.event_date);
  const today = new Date();
  eventDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 7) {
    return "⚠️ CRITICAL: This event is less than 7 days away. Cancelling now leaves the client in a very difficult position. Platform staff will process the client refund and your account will be marked with a penalty debt.";
  }
  return "Since the client has already booked, platform staff will handle the refund disbursement. Note that sudden cancellations may impact your vendor standing.";
};

export default function CatererBookings() {
  const { catererData, refreshCatererData } = useAuth() as any;
  const [bookings, setBookings]        = useState<Booking[]>([]);
  const [loading, setLoading]          = useState(true);
  const [filter, setFilter]            = useState('all');
  const [selected, setSelected]        = useState<Booking | null>(null);
  const [updating, setUpdating]        = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  // States for Caterer Emergency Cancellation
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  // State for Xendit Debt Payment & Tracking Amount
  const [payingDebt, setPayingDebt] = useState(false);
  const [localStanding, setLocalStanding] = useState<string | null>(null);
  const [totalDebt, setTotalDebt] = useState(0);

  // Counts and Chat States
  const [counts, setCounts]            = useState<Record<string, number>>({});
  const [chatBooking, setChatBooking] = useState<Booking | null>(null);

  const load = async () => {
    if (!catererData?.id) return;
    setLoading(true);

    if (refreshCatererData) {
      await refreshCatererData();
    }

    let query = supabase
      .from('bookings')
      .select('*, customer_id, profiles(full_name, email, avatar_url, phone_number), packages(name, tier), reviews(id, food_quality, service_quality, timeliness, overall, comment, caterer_reply, created_at)')
      .eq('caterer_id', catererData.id)
      .order('created_at', { ascending: false });

    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setBookings((data as any) ?? []);

    // Calculate total outstanding debt from processed refunds
    const { data: processedRefunds } = await supabase
      .from('bookings')
      .select('refund_amount, downpayment_amount')
      .eq('caterer_id', catererData.id)
      .eq('refund_status', 'processed');

    const calculatedDebt = processedRefunds?.reduce(
      (sum, b) => sum + Number(b.refund_amount || b.downpayment_amount || 0), 
      0
    ) || 0;
    setTotalDebt(calculatedDebt);

    const statuses = ['pending', 'confirmed', 'paid', 'ongoing', 'completed', 'cancelled', 'rejected'];
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

  const handleAction = async (action: string, booking: Booking) => {
    setUpdating(true);
    let updates: Record<string, any> = {};
    let notifTitle = '';
    let notifMsg = '';
    let notifType: any = 'booking_approved';

    switch (action) {
      case 'confirm':
        updates = { status: 'confirmed' };
        notifTitle = 'Booking Approved!';
        
        const formattedDeadline = booking.downpayment_deadline 
          ? new Date(booking.downpayment_deadline).toLocaleString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: 'numeric', minute: '2-digit', hour12: true,
            })
          : 'soon';

        notifMsg = `Your booking has been approved! Please complete your downpayment by ${formattedDeadline} to avoid automatic cancellation.`;
        notifType = 'booking_approved';
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
        notifTitle = 'Booking Rejected';
        notifMsg = `Your booking was rejected. Reason: ${rejectReason}`;
        notifType = 'booking_rejected';
        break;

      case 'caterer_cancel':
        const finalCancelReason = selectedReason === 'Other' ? customReason.trim() : selectedReason;
        if (!finalCancelReason) {
          Alert.alert('Required', 'Please select or specify a reason for cancellation.');
          setUpdating(false); return;
        }
        
        const isPaid = booking.status === 'paid';
        
        updates = {
          status: 'cancelled',
          cancelled_by: 'caterer',
          cancellation_reason: finalCancelReason,
          cancelled_at: new Date().toISOString(),
          refund_status: isPaid ? 'pending' : 'none',
          refund_amount: isPaid ? booking.downpayment_amount : 0
        };
        notifTitle = 'Booking Cancelled by Caterer';
        notifMsg = isPaid 
          ? `The caterer had to cancel your booking. Reason: ${finalCancelReason}. Platform staff are processing your refund.`
          : `The caterer had to cancel your booking. Reason: ${finalCancelReason}.`;
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
    setShowCancelModal(false);
    setRejectReason('');
    setSelectedReason('');
    setCustomReason('');
    load();
  };

  const handlePayDebt = async () => {
    if (!catererData?.id) return;
    try {
      setPayingDebt(true);

      if (totalDebt <= 0) {
        Alert.alert('Notice', 'No active outstanding balance found.');
        setPayingDebt(false);
        return;
      }

      const paymentResult = await initiateGCashPayment({
        type: 'debt',
        amount: totalDebt,
        referenceId: `DEBT-${catererData.id}-${Date.now()}`,
        customerName: catererData.business_name || 'Caterer Partner',
        customerEmail: catererData.email || 'caterer@example.com',
        description: `Settlement of outstanding platform debt for ${catererData.business_name}`,
      });

      if (!paymentResult.success || !paymentResult.checkoutUrl || !paymentResult.chargeId) {
        throw new Error(paymentResult.error || 'Failed to initialize payment gateway.');
      }

      const checkoutOutcome = await openGCashCheckout(
        paymentResult.checkoutUrl,
        paymentResult.chargeId,
        paymentResult.webUrl
      );

      if (checkoutOutcome === 'success') {
        const { error: updateError } = await supabase
          .from('caterers')
          .update({ account_standing: 'good_standing' })
          .eq('id', catererData.id);

        if (updateError) throw updateError;

        setLocalStanding('good_standing');
        setTotalDebt(0);
        if (refreshCatererData) refreshCatererData();

        Alert.alert(
          'Payment Successful! 🎉', 
          'Your debt has been settled and your account standing has been automatically restored to Good Standing.'
        );
        load();
      } else if (checkoutOutcome === 'failed') {
        Alert.alert('Payment Failed', 'The GCash transaction failed or was declined. Please try again.');
      } else {
        Alert.alert('Payment Cancelled', 'You closed the payment window before completion.');
      }

    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred during payment processing.');
    } finally {
      setPayingDebt(false);
    }
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

  const accountStanding = localStanding ?? catererData?.account_standing ?? 'good_standing';

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <View>
          <Text style={styles.pageTitle}>Bookings</Text>
          <Text style={styles.pageSub}>{counts.all ?? 0} total requests · {counts.pending ?? 0} pending action</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={load} activeOpacity={0.8}>
          <RefreshCw size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Caterer Account Standing / Debt Flag Banner */}
      {accountStanding !== 'good_standing' && (
        <View style={[
          styles.debtBanner, 
          accountStanding === 'owing_debt' ? styles.debtBannerWarning : styles.debtBannerDanger
        ]}>
          <ShieldAlert size={20} color={accountStanding === 'owing_debt' ? '#D97706' : '#DC2626'} />
          <View style={{ flex: 1 }}>
            <Text style={[
              styles.debtBannerTitle,
              { color: accountStanding === 'owing_debt' ? '#92400E' : '#991B1B' }
            ]}>
              {accountStanding === 'owing_debt' ? 'Action Required: Outstanding Platform Debt' : 'Account Restricted'}
            </Text>
            <Text style={[
              styles.debtBannerText,
              { color: accountStanding === 'owing_debt' ? '#B45309' : '#B91C1C' }
            ]}>
              {accountStanding === 'owing_debt'
                ? `Your account is flagged with an outstanding balance of ₱${totalDebt.toLocaleString()} due to a recent cancellation refund. Settle your balance via Xendit GCash below to instantly restore your good standing.`
                : `Your caterer account has been ${accountStanding}. Please contact platform administration to resolve your account standing.`}
            </Text>

            {/* Xendit Payment Button */}
            {accountStanding === 'owing_debt' && (
              <TouchableOpacity
                style={styles.payDebtBtn}
                onPress={handlePayDebt}
                disabled={payingDebt}
                activeOpacity={0.85}
              >
                {payingDebt ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <CreditCard size={16} color="#FFF" />
                    <Text style={styles.payDebtBtnText}>Pay Debt of ₱{totalDebt.toLocaleString()} via GCash (Xendit)</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Filter Tabs */}
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

      {/* Booking Detail Modal */}
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

              {/* Cancellation Details Banner */}
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
                    
                    {/* Refund Tracking Status */}
                    {selected.refund_status && selected.refund_status !== 'none' && (
                      <View style={{ marginTop: 8, padding: 10, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.black, marginBottom: 4 }}>
                          Platform Refund Status: 
                          <Text style={{ color: selected.refund_status === 'processed' ? '#15803D' : '#D97706' }}> {selected.refund_status.toUpperCase()}</Text>
                        </Text>
                        <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                          Amount: ₱{Number(selected.refund_amount).toLocaleString()}
                        </Text>
                        <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' }}>
                          {selected.refund_status === 'processed' 
                            ? 'Platform staff successfully disbursed this refund. Your account standing has been flagged with an outstanding debt.'
                            : 'Platform staff are reviewing and processing this refund disbursement.'}
                        </Text>
                      </View>
                    )}
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

              {/* Customer Section */}
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

              {/* Event & Location Section */}
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

              {/* Financials */}
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

              {/* Action Suite */}
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

                {/* Caterer Emergency Cancellation Button */}
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

                {/* Structured Caterer Cancellation Input Box */}
                {showCancelModal && (
                  <View style={[styles.rejectContainer, { marginTop: 10, borderColor: '#FCA5A5' }]}>
                    <Text style={styles.fieldLabel}>Emergency Reason for Cancellation *</Text>
                    
                    <Text style={{ fontSize: 13, color: '#B91C1C', fontWeight: '600', marginBottom: 12, padding: 10, backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#FECACA' }}>
                      {getCancelWarningMessage(selected)}
                    </Text>

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

                {!['cancelled', 'rejected'].includes(selected.status) && (
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

      {/* Chat Screen Modal */}
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

  debtBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  debtBannerWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  debtBannerDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  debtBannerTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  debtBannerText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  payDebtBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  payDebtBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  filterOuterWrap: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginTop: 12,
  },
  filterRow: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    gap: 8, 
    alignItems: 'center',
  },
  filterChip: { 
    paddingHorizontal: 14, 
    paddingVertical: 7, 
    borderRadius: 16, 
    backgroundColor: '#F1F5F9', 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
  },
  filterChipActive: { 
    backgroundColor: Colors.orange, 
    borderColor: Colors.orange,
  },
  filterText: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: Colors.textSecondary,
  },
  filterTextActive: { 
    color: Colors.white, 
    fontWeight: '800',
  },

  list: { flex: 1 },
  bookingCard: {
    backgroundColor: Colors.white, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9',
    overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2,
  },
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
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingTop: Platform.OS === 'ios' ? 60 : 16,
  },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '900', color: Colors.black },
  
  statusBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 16 },
  statusBannerText: { fontSize: 14, fontWeight: '900' },

  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 16,
    padding: 14,
  },
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

  reasonRow: {
    padding: 14, borderRadius: 12, borderWidth: 1, 
    borderColor: '#E5E7EB', marginBottom: 10,
    backgroundColor: '#F9FAFB'
  },
  reasonRowSelected: {
    borderColor: '#FCA5A5', backgroundColor: '#FEF2F2'
  },
  reasonText: { fontSize: 14, color: Colors.black, fontWeight: '600' },
  reasonTextSelected: { color: '#B91C1C', fontWeight: '800' },

  chatBtn: { marginTop: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, borderWidth: 1.5, borderColor: '#E2E8F0' },
  chatBtnText: { fontSize: 15, fontWeight: '900', color: Colors.black },

  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 6 },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});