import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import ChatScreen from './ChatScreen';
import {
  MessageSquare, ArrowLeft, Inbox, ChevronRight, Sparkles
} from 'lucide-react-native';

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

    // Batch fetch bookings with caterer business info
    const bookingIds = [...seenBookings];
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, event_date, event_type, caterers(business_name, logo_url, user_id)')
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

        let otherPersonName = other?.full_name ?? 'Unknown';
        let otherPersonAvatar = other?.avatar_url ?? null;

        // If the other person is a caterer associated with this booking, use their business name and logo
        if (booking?.caterers) {
          const catererData = Array.isArray(booking.caterers) ? booking.caterers[0] : booking.caterers;
          if (catererData && catererData.user_id !== myId) {
            if (catererData.business_name) {
              otherPersonName = catererData.business_name;
            }
            if (catererData.logo_url) {
              otherPersonAvatar = catererData.logo_url;
            }
          }
        }

        const bookingInfo = booking
          ? `${booking.event_type ?? 'Event'} · ${new Date(booking.event_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`
          : '';

        return {
          bookingId:        msg.booking_id,
          bookingInfo,
          otherPersonId:    otherId,
          otherPersonName,
          otherPersonAvatar,
          lastMessage:      msg.content,
          lastMessageTime:  msg.created_at,
          unreadCount:      unreadMap[msg.booking_id] ?? 0,
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
      <View style={[s.header, { paddingTop: Platform.OS === 'ios' ? 56 : 44 }]}>
        <View style={s.headerLeftGroup}>
          {onClose ? (
            <TouchableOpacity onPress={onClose} style={s.headerBack} activeOpacity={0.7}>
              <ArrowLeft size={20} color={Colors.black} />
            </TouchableOpacity>
          ) : (
            <View style={s.headerIconWrap}>
              <MessageSquare size={22} color={Colors.orange} />
            </View>
          )}
          <View>
            <Text style={s.headerTitle}>Messages</Text>
            <Text style={s.headerSub}>Chat with your confirmed caterers</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIconWrap}>
            <Inbox size={36} color={Colors.orange} />
          </View>
          <Text style={s.emptyTitle}>No messages yet</Text>
          <Text style={s.emptySub}>
            Once you have a confirmed booking, you can directly chat with your caterer here.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          {conversations.map(conv => (
            <TouchableOpacity
              key={conv.bookingId}
              style={[s.convCard, conv.unreadCount > 0 && s.convCardUnread]}
              onPress={() => setOpenChat(conv)}
              activeOpacity={0.85}
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
                  <Text style={[s.convName, conv.unreadCount > 0 && s.convNameBold]} numberOfLines={1}>
                    {conv.otherPersonName}
                  </Text>
                  <Text style={s.convTime}>{timeAgo(conv.lastMessageTime)}</Text>
                </View>
                {conv.bookingInfo && (
                  <View style={s.bookingInfoBadge}>
                    <Sparkles size={11} color={Colors.orange} />
                    <Text style={s.convBookingInfo} numberOfLines={1}>{conv.bookingInfo}</Text>
                  </View>
                )}
                <Text
                  style={[s.convLastMsg, conv.unreadCount > 0 && s.convLastMsgBold]}
                  numberOfLines={1}
                >
                  {conv.isMine ? 'You: ' : ''}{conv.lastMessage}
                </Text>
              </View>

              <ChevronRight size={18} color={Colors.textMuted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#FED7AA',
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: Colors.black, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },

  convCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 18,
    marginBottom: 12,
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
  },
  convCardUnread: { backgroundColor: '#FFFDFB', borderColor: '#FED7AA', borderWidth: 1.5 },
  convAvatarWrap: { position: 'relative' },
  convAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F3F4F6' },
  convAvatarPlaceholder: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#FED7AA',
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
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  convName: { fontSize: 15, fontWeight: '800', color: Colors.black, flex: 1, marginRight: 8 },
  convNameBold: { fontWeight: '900' },
  convTime: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  
  bookingInfoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF7ED', alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    marginBottom: 5, borderWidth: 1, borderColor: '#FED7AA',
  },
  convBookingInfo: { fontSize: 11, color: Colors.orange, fontWeight: '800' },
  
  convLastMsg: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  convLastMsgBold: { color: Colors.black, fontWeight: '800' },

  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: '#FED7AA',
  },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 6 },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19, fontWeight: '500' },
});