import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import ChatScreen from './ChatScreen';

type Conversation = {
  bookingId: string;
  bookingInfo: string;
  otherPersonId: string;
  otherPersonName: string;
  otherPersonAvatar: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isMine: boolean;
};

export default function MessagesInboxScreen({ onClose }: { onClose?: () => void }) {
  const { session } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading]             = useState(true);
  const [openChat, setOpenChat]           = useState<Conversation | null>(null);

  const myId = session?.user?.id ?? '';

  const loadConversations = async () => {
    if (!myId) return;

    // Get distinct booking_ids I'm involved in, with last message per booking
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, booking_id, sender_id, receiver_id, content, is_read, created_at')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
      .order('created_at', { ascending: false });

    if (!msgs || msgs.length === 0) { setLoading(false); return; }

    // Get unique booking_ids (first message per booking = latest)
    const seenBookings = new Set<string>();
    const latestPerBooking: typeof msgs = [];
    for (const msg of msgs) {
      if (msg.booking_id && !seenBookings.has(msg.booking_id)) {
        seenBookings.add(msg.booking_id);
        latestPerBooking.push(msg);
      }
    }

    // Collect all other person IDs
    const otherIds = latestPerBooking.map(msg =>
      msg.sender_id === myId ? msg.receiver_id : msg.sender_id
    );

    // Batch fetch profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', [...new Set(otherIds)]);

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    // Batch fetch bookings
    const bookingIds = [...seenBookings];
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, event_date, event_type')
      .in('id', bookingIds);

    const bookingMap = Object.fromEntries((bookings ?? []).map(b => [b.id, b]));

    // Batch fetch unread counts per booking
    const { data: unreadMsgs } = await supabase
      .from('messages')
      .select('booking_id')
      .in('booking_id', bookingIds)
      .eq('receiver_id', myId)
      .eq('is_read', false);

    const unreadMap: Record<string, number> = {};
    (unreadMsgs ?? []).forEach(m => {
      unreadMap[m.booking_id] = (unreadMap[m.booking_id] ?? 0) + 1;
    });

    // Build conversations
    const convs: Conversation[] = latestPerBooking
      .filter(msg => msg.booking_id)
      .map(msg => {
        const isMine = msg.sender_id === myId;
        const otherId = isMine ? msg.receiver_id : msg.sender_id;
        const other = profileMap[otherId];
        const booking = bookingMap[msg.booking_id];

        const bookingInfo = booking
          ? `${booking.event_type ?? 'Event'} · ${new Date(booking.event_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`
          : '';

        return {
          bookingId:         msg.booking_id,
          bookingInfo,
          otherPersonId:     otherId,
          otherPersonName:   other?.full_name ?? 'Unknown',
          otherPersonAvatar: other?.avatar_url ?? null,
          lastMessage:       msg.content,
          lastMessageTime:   msg.created_at,
          unreadCount:       unreadMap[msg.booking_id] ?? 0,
          isMine,
        };
      });

    setConversations(convs);
    setLoading(false);
  };

  useEffect(() => { loadConversations(); }, [myId]);

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={s.root}>
      {/* Chat modal */}
      <Modal visible={!!openChat} animationType="slide" presentationStyle="fullScreen">
        {openChat && (
          <ChatScreen
            bookingId={openChat.bookingId}
            receiverId={openChat.otherPersonId}
            receiverName={openChat.otherPersonName}
            receiverAvatar={openChat.otherPersonAvatar}
            bookingInfo={openChat.bookingInfo}
            onClose={() => { setOpenChat(null); loadConversations(); }}
          />
        )}
      </Modal>

      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === 'ios' ? 52 : 16 }]}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={s.headerBack}>
            <Text style={s.headerBackText}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={s.headerTitle}>Messages</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>💬</Text>
          <Text style={s.emptyTitle}>No messages yet</Text>
          <Text style={s.emptySub}>
            Once you have a confirmed booking, you can chat with your caterer here.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {conversations.map(conv => (
            <TouchableOpacity
              key={conv.bookingId}
              style={[s.convRow, conv.unreadCount > 0 && s.convRowUnread]}
              onPress={() => setOpenChat(conv)}
              activeOpacity={0.8}
            >
              {/* Avatar */}
              <View style={s.convAvatarWrap}>
                {conv.otherPersonAvatar ? (
                  <Image source={{ uri: conv.otherPersonAvatar }} style={s.convAvatar} />
                ) : (
                  <View style={s.convAvatarPlaceholder}>
                    <Text style={s.convAvatarText}>
                      {conv.otherPersonName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                {conv.unreadCount > 0 && (
                  <View style={s.convUnreadDot}>
                    <Text style={s.convUnreadNum}>{conv.unreadCount}</Text>
                  </View>
                )}
              </View>

              {/* Info */}
              <View style={s.convInfo}>
                <View style={s.convTopRow}>
                  <Text style={[s.convName, conv.unreadCount > 0 && s.convNameBold]}>
                    {conv.otherPersonName}
                  </Text>
                  <Text style={s.convTime}>{timeAgo(conv.lastMessageTime)}</Text>
                </View>
                {conv.bookingInfo && (
                  <Text style={s.convBookingInfo}>{conv.bookingInfo}</Text>
                )}
                <Text
                  style={[s.convLastMsg, conv.unreadCount > 0 && s.convLastMsgBold]}
                  numberOfLines={1}
                >
                  {conv.isMine ? 'You: ' : ''}{conv.lastMessage}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 10 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  headerBack: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgInput,
    justifyContent: 'center', alignItems: 'center',
  },
  headerBackText: { fontSize: 18, fontWeight: '700', color: Colors.black },
  headerTitle: { fontSize: 20, fontWeight: '900', color: Colors.black },

  convRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
    backgroundColor: Colors.white,
  },
  convRowUnread: { backgroundColor: '#FFFBF5' },
  convAvatarWrap: { position: 'relative' },
  convAvatar: { width: 52, height: 52, borderRadius: 26 },
  convAvatarPlaceholder: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
  },
  convAvatarText: { color: Colors.white, fontSize: 20, fontWeight: '900' },
  convUnreadDot: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: Colors.orange, borderRadius: 10,
    minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: Colors.white,
  },
  convUnreadNum: { color: Colors.white, fontSize: 10, fontWeight: '900' },

  convInfo: { flex: 1, minWidth: 0 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  convName: { fontSize: 15, fontWeight: '700', color: Colors.black },
  convNameBold: { fontWeight: '900' },
  convTime: { fontSize: 11, color: Colors.textMuted },
  convBookingInfo: { fontSize: 11, color: Colors.orange, fontWeight: '700', marginBottom: 2 },
  convLastMsg: { fontSize: 13, color: Colors.textSecondary },
  convLastMsgBold: { color: Colors.black, fontWeight: '700' },

  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.black },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});