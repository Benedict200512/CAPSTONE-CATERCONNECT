// app/(tabs)/notifications.tsx
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter, Href } from 'expo-router'; 
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { NotificationType } from '../../lib/notifications';
import {
  Bell, CheckCircle2, XCircle, CreditCard, PartyPopper,
  Sparkles, Check, Inbox, Clock, AlertCircle,
  Star, MessageCircle, MessageSquareText, RefreshCw, AlertTriangle, ShieldCheck,
  ReceiptText, Wallet, FileWarning, FileCheck2
} from 'lucide-react-native';

type Notification = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  booking_id: string | null;
  is_read: boolean;
  created_at: string;
};

const TYPE_CONFIG: Record<NotificationType, { color: string; bg: string; icon: any }> = {
  booking_submitted:    { color: '#2563EB', bg: '#EFF6FF', icon: Clock },
  booking_approved:     { color: '#166534', bg: '#DCFCE7', icon: CheckCircle2 },
  booking_rejected:     { color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
  payment_submitted:    { color: '#D97706', bg: '#FEF3C7', icon: CreditCard },
  downpayment_paid:     { color: '#166534', bg: '#DCFCE7', icon: ShieldCheck },
  payment_verified:     { color: '#166534', bg: '#DCFCE7', icon: CheckCircle2 },
  booking_completed:    { color: '#166534', bg: '#DCFCE7', icon: PartyPopper },
  booking_cancelled:    { color: '#4B5563', bg: '#F3F4F6', icon: XCircle },
  package_customized:   { color: '#7C3AED', bg: '#F5F3FF', icon: Sparkles },
  new_booking_request:  { color: '#D97706', bg: '#FEF3C7', icon: Bell },
  new_message:          { color: '#2563EB', bg: '#EFF6FF', icon: MessageCircle },
  new_review:           { color: '#F59E0B', bg: '#FEF3C7', icon: Star },
  subscription:         { color: '#7C3AED', bg: '#F5F3FF', icon: RefreshCw },
  downpayment_deadline: { color: '#DC2626', bg: '#FEE2E2', icon: AlertTriangle },
  refund_dispute_opened: { color: '#D97706', bg: '#FEF3C7', icon: FileWarning },
  refund_dispute_submitted: { color: '#D97706', bg: '#FEF3C7', icon: FileWarning },
  refund_dispute_response: { color: '#2563EB', bg: '#EFF6FF', icon: MessageSquareText },
  refund_dispute_responded: { color: '#2563EB', bg: '#EFF6FF', icon: MessageSquareText },
  refund_transfer_submitted: { color: '#2563EB', bg: '#EFF6FF', icon: ReceiptText },
  refund_confirmed: { color: '#166534', bg: '#DCFCE7', icon: FileCheck2 },
  refund_received: { color: '#166534', bg: '#DCFCE7', icon: Wallet },
  refund_overdue: { color: '#DC2626', bg: '#FEE2E2', icon: AlertTriangle },
};

export default function NotificationsScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    setNotifications(data ?? []);
    setUnreadCount(data?.filter((n) => !n.is_read).length ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [session]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!session?.user?.id) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotificationPress = async (notif: Notification) => {
    if (!notif.is_read) {
      await markRead(notif.id);
    }

    if (notif.type === 'new_message') {
      router.push({
        pathname: profile?.id === session?.user.id && profile?.role === 'caterer'
          ? '/(caterer)/messages' : '/(tabs)/messages',
        params: { booking_id: notif.booking_id ?? undefined }
      } as Href);
    } 
    else if (notif.type === 'new_review') {
      // Reviews are associated with bookings, not the profile dashboard.
      // Pass the booking ID so the bookings screen can open its summary.
      router.push({
        pathname: profile?.role === 'caterer' ? '/(caterer)/bookings' : '/bookings',
        params: {
          ...(notif.booking_id ? { id: notif.booking_id } : {}),
          notification_id: notif.id,
        },
      } as Href);
    }
    else if (notif.type.includes('subscription')) {
      router.push('/profile' as Href);
    }
    else if (notif.booking_id) {
      router.push({
        pathname: '/bookings',
        params: { id: notif.booking_id, notification_id: notif.id }
      } as Href);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 44 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Bell size={20} color={Colors.orange} />
          </View>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.pageTitle} numberOfLines={1}>Notifications</Text>
            <Text style={styles.pageSub} numberOfLines={1}>Bookings, payments & messages</Text>
          </View>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn} activeOpacity={0.8}>
            <Check size={13} color={Colors.orange} />
            <Text style={styles.markAllText} numberOfLines={1}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <AlertCircle size={15} color="#92400E" />
          <Text style={styles.unreadBannerText}>You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
        >
          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Inbox size={36} color={Colors.orange} />
              </View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySub}>You'll be notified here about bookings, downpayments, messages, and subscription updates.</Text>
            </View>
          ) : (
            notifications.map((notif) => {
              const isRefundDisputeUpdate = notif.title.trim().toLowerCase() === 'refund dispute update';
              const config = isRefundDisputeUpdate
                ? { color: '#2563EB', bg: '#EFF6FF', icon: MessageSquareText }
                : TYPE_CONFIG[notif.type] ?? { color: Colors.orange, bg: '#FFF7ED', icon: Bell };
              const IconComponent = config.icon;
              
              return (
                <TouchableOpacity
                  key={notif.id}
                  style={[styles.notifCard, !notif.is_read && styles.notifCardUnread]}
                  onPress={() => handleNotificationPress(notif)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.notifIcon, { backgroundColor: config.bg }]}>
                    <IconComponent size={20} color={config.color} />
                  </View>
                  <View style={styles.notifBody}>
                    <View style={styles.notifTitleRow}>
                      <Text style={styles.notifTitle} numberOfLines={1}>{notif.title}</Text>
                      {!notif.is_read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notifMessage} numberOfLines={2}>{notif.message}</Text>
                    <Text style={styles.notifTime}>{timeAgo(notif.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingHorizontal: 16, paddingBottom: 16, backgroundColor: Colors.white, 
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6' 
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 },
  headerIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#FED7AA', flexShrink: 0,
  },
  headerTitleContainer: { flex: 1 },
  pageTitle: { fontSize: 20, fontWeight: '900', color: Colors.black, letterSpacing: -0.5 },
  pageSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1, fontWeight: '500' },

  markAllBtn: { 
    backgroundColor: '#FFF7ED', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, 
    borderWidth: 1, borderColor: '#FED7AA', flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0
  },
  markAllText: { fontSize: 11.5, fontWeight: '800', color: Colors.orange },

  unreadBanner: { 
    backgroundColor: '#FEF3C7', borderBottomWidth: 1, borderBottomColor: '#FDE68A', 
    paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 
  },
  unreadBannerText: { fontSize: 13, fontWeight: '800', color: '#92400E' },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 20 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: '#FED7AA',
  },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 6 },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', fontWeight: '500', lineHeight: 18 },

  notifCard: { 
    backgroundColor: Colors.white, borderRadius: 18, padding: 16, marginBottom: 12, 
    flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: '#E5E7EB', 
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 
  },
  notifCardUnread: { borderColor: Colors.orange, borderWidth: 1.5, backgroundColor: '#FFFDFB' },
  notifIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifBody: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  notifTitle: { fontSize: 14, fontWeight: '800', color: Colors.black, flex: 1, marginRight: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.orange, flexShrink: 0 },
  notifMessage: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 6, fontWeight: '500' },
  notifTime: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
});
