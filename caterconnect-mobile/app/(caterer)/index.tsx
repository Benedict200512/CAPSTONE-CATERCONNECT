import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import NotificationsScreen from '../../screens/auth/NotificationsScreen';
import { 
  X, Bell, ClipboardList, CheckCircle2, Hourglass, CreditCard, 
  Package, UtensilsCrossed, MessageCircle, Calendar, Users, 
  Star, ChevronRight, ArrowUpRight, Inbox, ShieldAlert
} from 'lucide-react-native';

export default function CatererDashboard() {
  const { profile, catererData, session } = useAuth();
  const router = useRouter();
  
  const displayName = catererData?.business_name || profile?.full_name || 'Loading...';
  const displayInitial = displayName.charAt(0).toUpperCase();

  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);

  // FIX: Also check if catererData is missing (!catererData?.id)
  const isPendingVerification = 
    !catererData?.id || 
    catererData?.verification_status === 'pending' || 
    catererData?.verification_status === 'rejected';

  useEffect(() => {
    loadUnreadCount();
    // Only load stats if the caterer has an ID and is actually approved
    if (catererData?.id && !isPendingVerification) {
      loadStats();
    }
  }, [catererData?.id, isPendingVerification]);

  const loadStats = async () => {
    const [total, completed, pending] = await Promise.all([
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('caterer_id', catererData!.id),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('caterer_id', catererData!.id).eq('status', 'completed'),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('caterer_id', catererData!.id).eq('status', 'pending'),
    ]);

    const { data: recent } = await supabase
      .from('bookings')
      .select('id, status, event_date, guest_count, total_cost, profiles(full_name)')
      .eq('caterer_id', catererData!.id)
      .order('created_at', { ascending: false })
      .limit(3);

    setStats({
      total: total.count ?? 0,
      completed: completed.count ?? 0,
      pending: pending.count ?? 0,
    });
    setRecentBookings(recent ?? []);
  };

  const loadUnreadCount = async () => {
    if (!session?.user?.id) return;
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false);
    setUnreadCount(count ?? 0);
  };

  const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
    pending:          { bg: '#FEF3C7', color: '#92400E' },
    confirmed:        { bg: '#DCFCE7', color: '#166534' },
    awaiting_payment: { bg: '#DBEAFE', color: '#1E40AF' },
    paid:             { bg: '#DCFCE7', color: '#166534' },
    completed:        { bg: '#F0FDF4', color: '#166534' },
    rejected:         { bg: '#FEE2E2', color: '#991B1B' },
    cancelled:        { bg: '#F3F4F6', color: '#6B7280' },
  };

  const planColors: Record<string, string> = {
    free: '#6B7280', basic: '#2563EB', standard: '#D97706', premium: '#7C3AED',
  };
  const currentPlan = catererData?.subscription_plan ?? 'free';
  const planColor = planColors[currentPlan] ?? Colors.orange;
  const isPremium = currentPlan === 'premium';

  const statCards = [
    { icon: ClipboardList, label: 'Total Bookings', value: String(stats.total), color: Colors.black, tint: '#F3F4F6' },
    { icon: CheckCircle2, label: 'Completed', value: String(stats.completed), color: '#16A34A', tint: '#F0FDF4' },
    { icon: Hourglass, label: 'Pending', value: String(stats.pending), color: '#D97706', tint: '#FEF3C7' },
    { icon: CreditCard, label: 'Plan', value: currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1), color: planColor, tint: planColor + '18' },
  ];

  const quickActions = [
    { icon: Package, label: 'Packages', path: '/(caterer)/packages', bg: '#EFF6FF', color: '#2563EB' },
    { icon: UtensilsCrossed, label: 'Menu Items', path: '/(caterer)/menu', bg: '#FFF7ED', color: '#EA580C' },
    { icon: ClipboardList, label: 'Bookings', path: '/(caterer)/bookings', bg: '#F0FDF4', color: '#16A34A' },
    { icon: MessageCircle, label: 'Consultations', path: '/(caterer)/consultation', bg: '#F5F3FF', color: '#7C3AED' },
  ];

  return (
    <>
      <Modal visible={showNotifs} animationType="slide" presentationStyle="pageSheet">
        <NotificationsScreen />
        <TouchableOpacity
          style={styles.closeNotifBtn}
          onPress={() => { setShowNotifs(false); loadUnreadCount(); }}
        >
          <X size={20} color={Colors.white} />
          <Text style={styles.closeNotifText}>Close</Text>
        </TouchableOpacity>
      </Modal>

      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.headerGreeting}>Welcome back,</Text>
            <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notifBtn} onPress={() => setShowNotifs(true)}>
              <Bell size={20} color={Colors.black} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => router.push('/(caterer)/profile')}
            >
              {catererData?.logo_url ? (
                <Image source={{ uri: catererData.logo_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{displayInitial}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {isPendingVerification ? (
          <View style={styles.pendingContainer}>
            <View style={styles.pendingIconWrap}>
              <ShieldAlert size={48} color={Colors.orange} />
            </View>
            <Text style={styles.pendingTitle}>Verification Required</Text>
            <Text style={styles.pendingSub}>
              Note: Proceed to send valid business documents so that platform staff can verify your account and unlock your dashboard.
            </Text>
            <TouchableOpacity 
              style={styles.pendingBtn} 
              onPress={() => router.push('/(caterer)/profile')}
              activeOpacity={0.85}
            >
              <Text style={styles.pendingBtnText}>Edit Profile</Text>
              <ArrowUpRight size={18} color={Colors.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            <TouchableOpacity
              style={[styles.subBanner, { borderColor: planColor + '40' }]}
              onPress={() => router.push('/(caterer)/profile')}
              activeOpacity={0.85}
            >
              <View style={styles.subBannerLeft}>
                <Text style={[styles.subBannerLabel, { color: planColor }]}>CURRENT PLAN</Text>
                <Text style={styles.subBannerPlan}>
                  {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
                </Text>
                <Text style={styles.subBannerUsage}>
                  {catererData?.monthly_booking_count ?? 0} bookings used this month
                </Text>
              </View>
              {isPremium ? (
                <View style={[styles.subUpgradeBtn, { backgroundColor: planColor }]}>
                  <Star size={16} color={Colors.white} fill={Colors.white} />
                  <Text style={styles.subUpgradeBtnText}>Premium</Text>
                </View>
              ) : (
                <View style={[styles.subUpgradeBtn, { backgroundColor: planColor }]}>
                  <Text style={styles.subUpgradeBtnText}>Upgrade</Text>
                  <ArrowUpRight size={16} color={Colors.white} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.statsGrid}>
              {statCards.map((s) => (
                <View key={s.label} style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: s.tint }]}>
                    <s.icon size={22} color={s.color} />
                  </View>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsGrid}>
                {quickActions.map((a) => (
                  <TouchableOpacity
                    key={a.label}
                    style={[styles.actionCard, { backgroundColor: a.bg, borderColor: a.color + '20' }]}
                    onPress={() => router.push(a.path as any)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.actionIconWrap, { backgroundColor: a.color + '15' }]}>
                      <a.icon size={24} color={a.color} />
                    </View>
                    <Text style={[styles.actionLabel, { color: a.color }]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Recent Bookings</Text>
                {recentBookings.length > 0 && (
                  <TouchableOpacity style={styles.seeAllRow} onPress={() => router.push('/(caterer)/bookings')}>
                    <Text style={styles.seeAll}>See all</Text>
                    <ChevronRight size={16} color={Colors.orange} />
                  </TouchableOpacity>
                )}
              </View>

              {recentBookings.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconWrap}>
                    <Inbox size={32} color={Colors.textSecondary} />
                  </View>
                  <Text style={styles.emptyTitle}>No bookings yet</Text>
                  <Text style={styles.emptySub}>
                    Once you're verified and customers book you, they'll appear here.
                  </Text>
                </View>
              ) : (
                recentBookings.map((b) => {
                  const ss = STATUS_STYLE[b.status] ?? STATUS_STYLE.pending;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={styles.recentBookingCard}
                      onPress={() => router.push('/(caterer)/bookings')}
                      activeOpacity={0.85}
                    >
                      <View style={styles.recentBookingLeft}>
                        <View style={styles.recentBookingAvatar}>
                          <Text style={styles.recentBookingAvatarText}>
                            {((b.profiles as any)?.full_name ?? 'C').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.recentBookingName}>
                            {(b.profiles as any)?.full_name ?? '—'}
                          </Text>
                          <View style={styles.recentBookingMetaRow}>
                            <Calendar size={12} color={Colors.textSecondary} />
                            <Text style={styles.recentBookingDate}>
                              {b.event_date ? new Date(b.event_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </Text>
                          </View>
                          <View style={styles.recentBookingMetaRow}>
                            <Users size={12} color={Colors.textSecondary} />
                            <Text style={styles.recentBookingGuests}>{b.guest_count} guests</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.recentBookingRight}>
                        <Text style={styles.recentBookingAmount}>₱{Number(b.total_cost).toLocaleString()}</Text>
                        <View style={[styles.recentStatusBadge, { backgroundColor: ss.bg }]}>
                          <Text style={[styles.recentStatusText, { color: ss.color }]}>
                            {b.status.replace('_', ' ').toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  closeNotifBtn: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.black, borderRadius: 30,
    paddingHorizontal: 28, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  closeNotifText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingBottom: 24,
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03, shadowRadius: 16, elevation: 4,
    zIndex: 10,
  },
  headerGreeting: { fontSize: 14, color: Colors.textSecondary, marginBottom: 2 },
  headerName: { fontSize: 24, fontWeight: '800', color: Colors.black, letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  notifBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: Colors.error, borderRadius: 12,
    minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: Colors.white,
  },
  notifBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  avatarBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
    overflow: 'hidden',
  },
  avatarImage: { width: 44, height: 44, borderRadius: 22, resizeMode: 'cover' },
  avatarText: { color: Colors.white, fontWeight: '800', fontSize: 18 },
  pendingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: -40, 
  },
  pendingIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },
  pendingTitle: { fontSize: 22, fontWeight: '800', color: Colors.black, textAlign: 'center', marginBottom: 12 },
  pendingSub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  pendingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.orange, borderRadius: 24,
    paddingHorizontal: 28, paddingVertical: 16,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  pendingBtnText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
  subBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, marginTop: 24, marginBottom: 20,
    backgroundColor: Colors.white, borderRadius: 24,
    padding: 20, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04, shadowRadius: 12, elevation: 3,
  },
  subBannerLeft: { flex: 1, gap: 4 },
  subBannerLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  subBannerPlan: { fontSize: 20, fontWeight: '800', color: Colors.black },
  subBannerUsage: { fontSize: 13, color: Colors.textSecondary },
  subUpgradeBtn: { 
    flexDirection: 'row', gap: 6, borderRadius: 20, 
    paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center',
  },
  subUpgradeBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12, marginBottom: 12 },
  statCard: {
    width: '48%', backgroundColor: Colors.white,
    borderRadius: 24, padding: 16,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02, shadowRadius: 8, elevation: 2,
  },
  statIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  statValue: { fontSize: 24, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
  statLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: Colors.black, letterSpacing: -0.5 },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: { fontSize: 14, color: Colors.orange, fontWeight: '700' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: '48%', borderRadius: 24, padding: 20, alignItems: 'center',
    borderWidth: 1, gap: 12,
  },
  actionIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
  },
  actionLabel: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  emptyCard: {
    backgroundColor: Colors.white, borderRadius: 24,
    padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.black, marginBottom: 8 },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  recentBookingCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  recentBookingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  recentBookingAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.orangeLight,
    justifyContent: 'center', alignItems: 'center',
  },
  recentBookingAvatarText: { fontSize: 18, fontWeight: '800', color: Colors.orange },
  recentBookingName: { fontSize: 16, fontWeight: '700', color: Colors.black, marginBottom: 4 },
  recentBookingMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  recentBookingDate: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  recentBookingGuests: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  recentBookingRight: { alignItems: 'flex-end', gap: 8 },
  recentBookingAmount: { fontSize: 16, fontWeight: '800', color: Colors.black },
  recentStatusBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  recentStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});