import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  booking_id: string | null;
  is_read: boolean;
  created_at: string;
};

const TYPE_ICONS: Record<string, string> = {
  booking_submitted:    '📋',
  booking_approved:     '✅',
  booking_rejected:     '❌',
  payment_submitted:    '💳',
  payment_verified:     '✅',
  booking_completed:    '🎉',
  booking_cancelled:    '❌',
  package_customized:   '✨',
  new_booking_request:  '🔔',
};

const TYPE_COLORS: Record<string, string> = {
  booking_approved:  '#DCFCE7',
  payment_verified:  '#DCFCE7',
  booking_completed: '#DCFCE7',
  booking_rejected:  '#FEE2E2',
  booking_cancelled: '#FEE2E2',
  booking_submitted: '#DBEAFE',
  new_booking_request: '#FEF3C7',
  payment_submitted: '#FEF3C7',
  package_customized: '#F5F3FF',
};

export default function NotificationsScreen() {
  const { session } = useAuth();
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
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}>
        <Text style={styles.pageTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadBannerText}>🔔 {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
        >
          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySub}>You'll be notified about bookings, payments, and updates here.</Text>
            </View>
          ) : (
            notifications.map((notif) => {
              const bgColor = TYPE_COLORS[notif.type] ?? '#F9FAFB';
              return (
                <TouchableOpacity
                  key={notif.id}
                  style={[styles.notifCard, !notif.is_read && styles.notifCardUnread]}
                  onPress={() => { if (!notif.is_read) markRead(notif.id); }}
                  activeOpacity={0.85}
                >
                  <View style={[styles.notifIcon, { backgroundColor: bgColor }]}>
                    <Text style={styles.notifIconText}>{TYPE_ICONS[notif.type] ?? '📢'}</Text>
                  </View>
                  <View style={styles.notifBody}>
                    <View style={styles.notifTitleRow}>
                      <Text style={styles.notifTitle}>{notif.title}</Text>
                      {!notif.is_read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notifMessage}>{notif.message}</Text>
                    <Text style={styles.notifTime}>{timeAgo(notif.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pageTitle: { fontSize: 24, fontWeight: '900', color: Colors.black },
  markAllBtn: { backgroundColor: Colors.bgInput, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  markAllText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  unreadBanner: { backgroundColor: Colors.orangeLight, borderBottomWidth: 1, borderBottomColor: '#FFB26B', paddingHorizontal: 20, paddingVertical: 10 },
  unreadBannerText: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.black, marginBottom: 8 },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  notifCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  notifCardUnread: { borderColor: Colors.orange, borderWidth: 1.5 },
  notifIcon: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifIconText: { fontSize: 22 },
  notifBody: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  notifTitle: { fontSize: 14, fontWeight: '800', color: Colors.black, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.orange, flexShrink: 0 },
  notifMessage: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 6 },
  notifTime: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
});