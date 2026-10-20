import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import ChatScreen from './ChatScreen';
import {
  MessageSquare, ChevronLeft, Inbox, ChevronRight, Sparkles, Search, X
} from 'lucide-react-native';

type Conversation = {
  accountId: string;
  bookingId: string;
  bookingInfo: string;
  otherPersonId: string;
  otherPersonName: string;
  participantName?: string;
  otherPersonAvatar: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isMine: boolean;
};

export default function MessagesInboxScreen({ onClose }: { onClose?: () => void }) {
  const { session } = useAuth();
  const router = useRouter();
  const { booking_id: requestedBookingId } = useLocalSearchParams<{ booking_id?: string | string[] }>();
  const bookingId = typeof requestedBookingId === 'string' ? requestedBookingId : '';
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading]             = useState(true);
  const [openChat, setOpenChat]           = useState<Conversation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const loadedAccount = useRef('');
  const refreshInbox = useRef<() => void>(() => {});

  const myId = session?.user?.id ?? '';
  const currentAccount = useRef(myId);
  currentAccount.current = myId;

  useFocusEffect(useCallback(() => {
    if (!requestedBookingId || !myId) return;
    let active = true;
    const isCurrent = () => active && currentAccount.current === myId;
    setOpenChat(null);

    const openRequestedBooking = async () => {
      try {
        // Route parameters are untrusted. Resolve ownership from the booking,
        // not from notification text or a caller-supplied receiver ID.
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) return;
        const { data: booking, error } = await supabase.from('bookings')
          .select('id, customer_id, event_date, event_type, caterers(business_name, logo_url, user_id)')
          .eq('id', bookingId).maybeSingle();
        if (!isCurrent() || error || !booking) return;
        const caterer = Array.isArray(booking.caterers) ? booking.caterers[0] : booking.caterers;
        if (!caterer?.user_id || !booking.customer_id) return;
        const isCustomer = booking.customer_id === myId;
        if (!isCustomer && caterer.user_id !== myId) return;
        const receiverId = isCustomer ? caterer.user_id : booking.customer_id;
        if (receiverId === myId) return;

        let name = isCustomer ? caterer.business_name || 'Caterer' : 'Customer';
        let avatar = isCustomer ? caterer.logo_url : null;
        if (!isCustomer) {
          const { data: customer, error: profileError } = await supabase.from('profiles')
            .select('full_name, avatar_url').eq('id', receiverId).maybeSingle();
          if (!isCurrent()) return;
          if (!profileError && customer) {
            name = customer.full_name || 'Customer';
            avatar = customer.avatar_url;
          }
        }
        if (!isCurrent()) return;
        setOpenChat({
          accountId: myId, bookingId: booking.id,
          bookingInfo: `${booking.event_type ?? 'Event'} · ${new Date(booking.event_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`,
          otherPersonId: receiverId, otherPersonName: name, otherPersonAvatar: avatar,
          lastMessage: '', lastMessageTime: '', unreadCount: 0, isMine: false,
        });
      } catch {
        // Invalid, inaccessible or failed requests leave the normal inbox open.
      } finally {
        if (isCurrent()) router.setParams({ booking_id: undefined });
      }
    };
    void openRequestedBooking();
    return () => { active = false; };
  }, [bookingId, requestedBookingId, myId, router]));

  const loadConversations = useCallback(async (isCurrent: () => boolean) => {
    if (!myId || !isCurrent()) return;
    if (loadedAccount.current !== myId) setLoading(true);
    try {

    // Get distinct booking_ids I'm involved in, with last message per booking
    const { data: msgs, error: messageError } = await supabase
      .from('messages')
      .select('id, booking_id, sender_id, receiver_id, content, is_read, created_at')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
      .order('created_at', { ascending: false });

    if (!isCurrent()) return;
    if (messageError) throw messageError;
    if (!msgs || msgs.length === 0) {
      setConversations([]); setLoadError(null); loadedAccount.current = myId;
      return;
    }

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
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', [...new Set(otherIds)]);
    if (!isCurrent()) return;
    if (profileError) throw profileError;

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    // Batch fetch bookings with caterer business info
    const bookingIds = [...seenBookings];
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id, customer_id, event_date, event_type, caterers(business_name, logo_url, user_id)')
      .in('id', bookingIds);
    if (!isCurrent()) return;
    if (bookingError) throw bookingError;

    const bookingMap = Object.fromEntries((bookings ?? []).map(b => [b.id, b]));

    // Batch fetch unread counts per booking
    // Keep this separate: the latest-message response may hit the API row cap.
    const { data: unreadMsgs, error: unreadError } = await supabase
      .from('messages')
      .select('booking_id')
      .in('booking_id', bookingIds)
      .eq('receiver_id', myId)
      .eq('is_read', false);
    if (!isCurrent()) return;
    if (unreadError) throw unreadError;
    const unreadMap: Record<string, number> = {};
    (unreadMsgs ?? []).forEach(m => {
      if (m.booking_id) {
        unreadMap[m.booking_id] = (unreadMap[m.booking_id] ?? 0) + 1;
      }
    });

    // Build conversations
    const convs: Conversation[] = latestPerBooking
      .filter(msg => {
        const booking = bookingMap[msg.booking_id];
        if (!booking) return false;
        const caterer = Array.isArray(booking.caterers) ? booking.caterers[0] : booking.caterers;
        return booking.customer_id === myId || caterer?.user_id === myId;
      })
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
          accountId:        myId,
          bookingId:        msg.booking_id,
          bookingInfo,
          otherPersonId:    otherId,
          otherPersonName,
          participantName: other?.full_name ?? undefined,
          otherPersonAvatar,
          lastMessage:      msg.content,
          lastMessageTime:  msg.created_at,
          unreadCount:      unreadMap[msg.booking_id] ?? 0,
          isMine,
        };
      });

    setConversations(convs);
    setLoadError(null);
    loadedAccount.current = myId;
    } catch {
      if (isCurrent()) setLoadError('Unable to refresh messages. Please try again.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [myId]);

  useFocusEffect(useCallback(() => {
    if (!myId) {
      setConversations([]); setLoadError(null); setLiveError(null); setLoading(false);
      loadedAccount.current = '';
      return;
    }
    let active = true;
    let inFlight = false;
    let queued = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const isCurrent = () => active && currentAccount.current === myId;
    const refresh = async () => {
      if (!isCurrent()) return;
      if (inFlight) { queued = true; return; }
      inFlight = true;
      try {
        do {
          queued = false;
          await loadConversations(isCurrent);
        } while (queued && isCurrent());
      } finally { inFlight = false; }
    };
    const scheduleRefresh = () => {
      if (!isCurrent()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = undefined; void refresh(); }, 200);
    };
    refreshInbox.current = scheduleRefresh;
    setLiveError(null);
    if (loadedAccount.current !== myId) setLoading(true);
    const channel = supabase.channel(`inbox:${myId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${myId}` }, scheduleRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${myId}` }, scheduleRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${myId}` }, scheduleRefresh)
      .subscribe(status => {
        if (!isCurrent()) return;
        if (status === 'SUBSCRIBED') {
          // Refresh after the initial subscription is established, closing the
          // focus-fetch/subscription gap, and again following a reconnect.
          setLiveError(null);
          scheduleRefresh();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setLiveError('Live updates are unavailable. Tap Retry to refresh messages.');
        }
      });
    // Coalesce focus and initial subscription acknowledgements when possible.
    scheduleRefresh();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      refreshInbox.current = () => {};
      void supabase.removeChannel(channel);
    };
  }, [myId, loadConversations]));

  const visibleConversations = conversations.filter(conversation => conversation.accountId === myId);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredConversations = visibleConversations.filter(conversation =>
    !normalizedQuery || [conversation.otherPersonName, conversation.participantName, conversation.bookingInfo, conversation.lastMessage]
      .some(value => value?.toLowerCase().includes(normalizedQuery)));

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
      <Modal visible={!!openChat && openChat.accountId === myId} animationType="slide" presentationStyle="fullScreen">
        {openChat && openChat.accountId === myId && (
          <ChatScreen
            bookingId={openChat.bookingId}
            receiverId={openChat.otherPersonId}
            receiverName={openChat.otherPersonName}
            receiverAvatar={openChat.otherPersonAvatar}
            bookingInfo={openChat.bookingInfo}
            onClose={() => { setOpenChat(null); refreshInbox.current(); }}
          />
        )}
      </Modal>

      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === 'ios' ? 56 : 44 }]}>
        <View style={s.headerLeftGroup}>
          {onClose ? (
            <TouchableOpacity onPress={onClose} style={s.headerBack} activeOpacity={0.7}>
              <ChevronLeft size={20} color={Colors.black} />
            </TouchableOpacity>
          ) : (
            <View style={s.headerIconWrap}>
              <MessageSquare size={22} color={Colors.orange} />
            </View>
          )}
          <View>
            <Text style={s.headerTitle}>Messages</Text>
            <Text style={s.headerSub}>Messages about your bookings</Text>
          </View>
        </View>
      </View>

      <View style={s.searchContainer}>
        <View style={s.searchBar}>
          <Search size={18} color={Colors.orange} />
          <TextInput
            style={s.searchInput}
            accessibilityLabel="Search conversations"
            placeholder="Search names, bookings or messages"
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear conversation search" onPress={() => setSearchQuery('')} style={s.clearSearch}>
              <X size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {(loadError || liveError) && (
        <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.orangeLight }}>
          <Text accessibilityRole="alert" style={{ color: Colors.textSecondary, fontSize: 13 }}>{loadError || liveError}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => refreshInbox.current()} style={{ alignSelf: 'flex-start', paddingVertical: 8 }}>
            <Text style={{ color: Colors.orange, fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : visibleConversations.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIconWrap}>
            <Inbox size={36} color={Colors.orange} />
          </View>
          <Text style={s.emptyTitle}>{loadError ? 'Messages unavailable' : 'No messages yet'}</Text>
          <Text style={s.emptySub}>
            {loadError ? 'Please retry to load your booking conversations.' : 'Open a booking and start a chat. Your conversations will appear here, even while the booking is pending.'}
          </Text>
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIconWrap}><Search size={32} color={Colors.orange} /></View>
          <Text style={s.emptyTitle}>No conversations found</Text>
          <Text style={s.emptySub}>Try another name or message, or clear your search.</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => setSearchQuery('')} style={{ padding: 12 }}>
            <Text style={{ color: Colors.orange, fontWeight: '700' }}>Clear search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 16 }}>
          {filteredConversations.map(conv => (
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
  searchContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, paddingRight: 4, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, minHeight: 46 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 13, color: Colors.textPrimary },
  clearSearch: { padding: 10 },
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
