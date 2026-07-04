import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import NotificationsScreen from '../../screens/auth/NotificationsScreen';

const ICONS = {
  close: require('../../assets/icons/close.png'),
  bell: require('../../assets/icons/bell.png'),
  clipboard: require('../../assets/icons/clipboard.png'),
  checkSuccess: require('../../assets/icons/check_success.png'),
  hourglass: require('../../assets/icons/hourglass.png'),
  card: require('../../assets/icons/card.png'),
  package: require('../../assets/icons/package.png'),
  plate: require('../../assets/icons/plate.png'),
  chat: require('../../assets/icons/chat.png'),
  calendar: require('../../assets/icons/calendar.png'),
  guests: require('../../assets/icons/guests.png'),
  star: require('../../assets/icons/star.png'),
  arrowRight: require('../../assets/icons/arrow_right.png'),
  arrowUpWhite: require('../../assets/icons/arrow_up_white.png'),
  emptyInbox: require('../../assets/icons/empty_inbox.png'),
};

export default function CatererDashboard() {
  const { profile, catererData, session } = useAuth();
  const router = useRouter();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Caterer';

  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    if (!catererData?.id) return;
    loadStats();
    loadUnreadCount();
  }, [catererData?.id]);

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
    { icon: ICONS.clipboard, label: 'Total Bookings', value: String(stats.total), color: Colors.black, tint: '#F3F4F6' },
    { icon: ICONS.checkSuccess, label: 'Completed', value: String(stats.completed), color: '#16A34A', tint: '#F0FDF4' },
    { icon: ICONS.hourglass, label: 'Pending', value: String(stats.pending), color: '#D97706', tint: '#FEF3C7' },
    { icon: ICONS.card, label: 'Plan', value: currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1), color: planColor, tint: planColor + '18' },
  ];

  const quickActions = [
    { icon: ICONS.package, label: 'Packages', path: '/(caterer)/packages', bg: '#EFF6FF', color: '#2563EB' },
    { icon: ICONS.plate, label: 'Menu Items', path: '/(caterer)/menu', bg: '#FFF7ED', color: '#EA580C' },
    { icon: ICONS.clipboard, label: 'Bookings', path: '/(caterer)/bookings', bg: '#F0FDF4', color: '#16A34A' },
    { icon: ICONS.chat, label: 'Consultations', path: '/(caterer)/consultation', bg: '#F5F3FF', color: '#7C3AED' },
  ];

  return (
    <>
      <Modal visible={showNotifs} animationType="slide" presentationStyle="pageSheet">
        <NotificationsScreen />
        <TouchableOpacity
          style={styles.closeNotifBtn}
          onPress={() => { setShowNotifs(false); loadUnreadCount(); }}
        >
          <Image source={ICONS.close} style={styles.iconClose} />
          <Text style={styles.closeNotifText}>Close</Text>
        </TouchableOpacity>
      </Modal>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}>
          <View>
            <Text style={styles.headerGreeting}>Welcome back,</Text>
            <Text style={styles.headerName}>{firstName}</Text>
          </View>
          <View style={styles.headerRight}>
            {/* Notification bell */}
            <TouchableOpacity style={styles.notifBtn} onPress={() => setShowNotifs(true)}>
              <Image source={ICONS.bell} style={styles.iconBell} />
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
              <Text style={styles.avatarText}>
                {(profile?.full_name ?? 'C').charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.subBanner, { borderColor: planColor }]}
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
            <View style={[styles.subUpgradeBtn, { backgroundColor: planColor, flexDirection: 'row', gap: 6 }]}>
              <Image source={ICONS.star} style={styles.iconStarSm} />
              <Text style={styles.subUpgradeBtnText}>Premium</Text>
            </View>
          ) : (
            <View style={[styles.subUpgradeBtn, { backgroundColor: planColor, flexDirection: 'row', gap: 6 }]}>
              <Text style={styles.subUpgradeBtnText}>Upgrade</Text>
              <Image source={ICONS.arrowUpWhite} style={styles.iconArrowUpSm} />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.statsGrid}>
          {statCards.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: s.tint }]}>
                <Image source={s.icon} style={[styles.statIcon, { tintColor: s.color }]} />
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
                style={[styles.actionCard, { backgroundColor: a.bg, borderColor: a.color + '30' }]}
                onPress={() => router.push(a.path as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: a.color + '20' }]}>
                  <Image source={a.icon} style={[styles.actionIcon, { tintColor: a.color }]} />
                </View>
                <Text style={[styles.actionLabel, { color: a.color }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent bookings */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Bookings</Text>
            {recentBookings.length > 0 && (
              <TouchableOpacity style={styles.seeAllRow} onPress={() => router.push('/(caterer)/bookings')}>
                <Text style={styles.seeAll}>See all</Text>
                <Image source={ICONS.arrowRight} style={styles.iconArrowSm} />
              </TouchableOpacity>
            )}
          </View>

          {recentBookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Image source={ICONS.emptyInbox} style={styles.emptyIcon} />
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
                        <Image source={ICONS.calendar} style={styles.iconMetaSm} />
                        <Text style={styles.recentBookingDate}>
                          {b.event_date ? new Date(b.event_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </Text>
                      </View>
                      <View style={styles.recentBookingMetaRow}>
                        <Image source={ICONS.guests} style={styles.iconMetaSm} />
                        <Text style={styles.recentBookingGuests}>{b.guest_count} guests</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.recentBookingRight}>
                    <Text style={styles.recentBookingAmount}>₱{Number(b.total_cost).toLocaleString()}</Text>
                    <View style={[styles.recentStatusBadge, { backgroundColor: ss.bg }]}>
                      <Text style={[styles.recentStatusText, { color: ss.color }]}>{b.status}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  closeNotifBtn: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.black, borderRadius: 30,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  closeNotifText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  iconClose: { width: 14, height: 14 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 20,
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 6,
  },
  headerGreeting: { fontSize: 13, color: Colors.textSecondary },
  headerName: { fontSize: 22, fontWeight: '900', color: Colors.black },
  headerRight: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  notifBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.bgInput,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    position: 'relative',
  },
  iconBell: { width: 18, height: 18 },
  notifBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.error, borderRadius: 10,
    minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3, borderWidth: 2, borderColor: Colors.white,
  },
  notifBadgeText: { color: Colors.white, fontSize: 9, fontWeight: '900' },
  avatarBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: Colors.white, fontWeight: '900', fontSize: 18 },

  subBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    margin: 20, backgroundColor: Colors.white, borderRadius: 16,
    padding: 16, borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  subBannerLeft: { flex: 1 },
  subBannerLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
  subBannerPlan: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 2 },
  subBannerUsage: { fontSize: 12, color: Colors.textSecondary },
  subUpgradeBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  subUpgradeBtnText: { color: Colors.white, fontWeight: '900', fontSize: 13 },
  iconStarSm: { width: 14, height: 14 },
  iconArrowUpSm: { width: 12, height: 12 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12, marginBottom: 8 },
  statCard: {
    width: '47%', backgroundColor: Colors.white,
    borderRadius: 16, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  statIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  statIcon: { width: 20, height: 20 },
  statValue: { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  statLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },

  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: Colors.black },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAll: { fontSize: 13, color: Colors.orange, fontWeight: '700' },
  iconArrowSm: { width: 11, height: 11 },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: '47%', borderRadius: 16, padding: 16, alignItems: 'center',
    borderWidth: 1, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  actionIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  actionIcon: { width: 24, height: 24 },
  actionLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center' },

  emptyCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.bgInput,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  emptyIcon: { width: 30, height: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Colors.black, marginBottom: 4 },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },

  recentBookingCard: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  recentBookingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  recentBookingAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.orangeLight,
    justifyContent: 'center', alignItems: 'center',
  },
  recentBookingAvatarText: { fontSize: 16, fontWeight: '900', color: Colors.orange },
  recentBookingName: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 3 },
  recentBookingMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 1 },
  iconMetaSm: { width: 10, height: 10 },
  recentBookingDate: { fontSize: 11, color: Colors.textSecondary },
  recentBookingGuests: { fontSize: 11, color: Colors.textMuted },
  recentBookingRight: { alignItems: 'flex-end', gap: 6 },
  recentBookingAmount: { fontSize: 14, fontWeight: '900', color: Colors.orange },
  recentStatusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  recentStatusText: { fontSize: 10, fontWeight: '800' },
});