import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Image,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  profiles?: { full_name: string; avatar_url: string | null };
};

type Props = {
  bookingId: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string | null;
  bookingInfo?: string;
  onClose?: () => void;
};

export default function ChatScreen({
  bookingId, receiverId, receiverName, receiverAvatar, bookingInfo, onClose,
}: Props) {
  const { session, profile } = useAuth();
  const [messages, setMessages]   = useState<Message[]>([]);
  const [loading, setLoading]     = useState(true);
  const [text, setText]           = useState('');
  const [sending, setSending]     = useState(false);
  const flatListRef               = useRef<FlatList>(null);

  const myId = session?.user?.id ?? '';

  // ── Load messages ──────────────────────────────────────────────────────
  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('booking_id', bookingId)
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
      .order('created_at', { ascending: true });

    setMessages((data as any) ?? []);
    setLoading(false);

    // Mark unread as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('booking_id', bookingId)
      .eq('receiver_id', myId)
      .eq('is_read', false);
  };

  // ── Realtime subscription ──────────────────────────────────────────────
  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`chat:${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          setMessages(prev => {
            const exists = prev.find(m => m.id === payload.new.id);
            if (exists) return prev;
            return [...prev, payload.new as Message];
          });
          // Mark as read if I'm the receiver
          if (payload.new.receiver_id === myId) {
            supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [bookingId]);

  // ── Auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  // ── Send ───────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!text.trim() || !myId) return;

    // Guard: receiverId must be a valid non-empty string
    if (!receiverId || receiverId.trim() === '') {
      console.error('ChatScreen: receiverId is empty — cannot send message');
      Alert.alert('Error', 'Could not identify the recipient. Please close and reopen the chat.');
      return;
    }

    setSending(true);
    const content = text.trim();
    setText('');

    const { error } = await supabase.from('messages').insert({
      booking_id:  bookingId,
      sender_id:   myId,
      receiver_id: receiverId,
      content,
      is_read:     false,
    });

    if (error) {
      setText(content);
      console.error('Send error:', error.message);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
    setSending(false);
  };

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  const formatDateGroup = (d: string) => {
    const date = new Date(d);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Group messages by date
  type GroupedItem = { type: 'date'; date: string } | { type: 'message'; message: Message };

  const groupedItems: GroupedItem[] = [];
  let lastDate = '';
  messages.forEach(msg => {
    const msgDate = new Date(msg.created_at).toDateString();
    if (msgDate !== lastDate) {
      groupedItems.push({ type: 'date', date: formatDateGroup(msg.created_at) });
      lastDate = msgDate;
    }
    groupedItems.push({ type: 'message', message: msg });
  });

  const renderItem = ({ item }: { item: GroupedItem }) => {
    if (item.type === 'date') {
      return (
        <View style={s.dateSeparator}>
          <View style={s.dateLine} />
          <Text style={s.dateText}>{item.date}</Text>
          <View style={s.dateLine} />
        </View>
      );
    }

    const msg = item.message;
    const isMine = msg.sender_id === myId;

    return (
      <View style={[s.msgRow, isMine && s.msgRowMine]}>
        {/* Other person avatar */}
        {!isMine && (
          receiverAvatar ? (
            <Image source={{ uri: receiverAvatar }} style={s.msgAvatar} />
          ) : (
            <View style={s.msgAvatarPlaceholder}>
              <Text style={s.msgAvatarText}>{receiverName.charAt(0)}</Text>
            </View>
          )
        )}

        <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
          <Text style={[s.bubbleText, isMine && s.bubbleTextMine]}>{msg.content}</Text>
          <View style={s.bubbleMeta}>
            <Text style={[s.bubbleTime, isMine && s.bubbleTimeMine]}>
              {formatTime(msg.created_at)}
            </Text>
            {isMine && (
              <Text style={s.readTick}>{msg.is_read ? '✓✓' : '✓'}</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === 'ios' ? 52 : 16 }]}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={s.headerBack}>
            <Text style={s.headerBackText}>←</Text>
          </TouchableOpacity>
        )}
        <View style={s.headerInfo}>
          {receiverAvatar ? (
            <Image source={{ uri: receiverAvatar }} style={s.headerAvatar} />
          ) : (
            <View style={s.headerAvatarPlaceholder}>
              <Text style={s.headerAvatarText}>{receiverName.charAt(0)}</Text>
            </View>
          )}
          <View>
            <Text style={s.headerName}>{receiverName}</Text>
            {bookingInfo && <Text style={s.headerSub}>{bookingInfo}</Text>}
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.orange} />
        </View>
      ) : messages.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>💬</Text>
          <Text style={s.emptyTitle}>Start the conversation</Text>
          <Text style={s.emptySub}>Send a message to {receiverName}</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={groupedItems}
          keyExtractor={(item, i) =>
            item.type === 'date' ? `date-${i}` : item.message.id
          }
          renderItem={renderItem}
          contentContainerStyle={s.messagesList}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Input */}
      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          placeholder="Type a message..."
          placeholderTextColor={Colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Text style={s.sendBtnText}>→</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
    gap: 12,
  },
  headerBack: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgInput,
    justifyContent: 'center', alignItems: 'center',
  },
  headerBackText: { fontSize: 18, fontWeight: '700', color: Colors.black },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
  headerName: { fontSize: 15, fontWeight: '800', color: Colors.black },
  headerSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  messagesList: { padding: 16, paddingBottom: 8 },

  dateSeparator: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginVertical: 16,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: Colors.divider },
  dateText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 },
  msgRowMine: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, marginBottom: 4 },
  msgAvatarPlaceholder: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.orangeLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  msgAvatarText: { fontSize: 12, fontWeight: '900', color: Colors.orange },

  bubble: {
    maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    backgroundColor: Colors.orange, borderBottomLeftRadius: 18, borderBottomRightRadius: 4,
  },
  bubbleTheirs: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  bubbleText: { fontSize: 14, color: Colors.black, lineHeight: 20 },
  bubbleTextMine: { color: Colors.white },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  bubbleTime: { fontSize: 10, color: Colors.textMuted },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  readTick: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 14,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 8,
  },
  input: {
    flex: 1, backgroundColor: Colors.bgInput,
    borderRadius: 22, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: Colors.black,
    maxHeight: 120, minHeight: 44,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  sendBtnDisabled: { backgroundColor: Colors.textMuted, shadowOpacity: 0 },
  sendBtnText: { color: Colors.white, fontSize: 20, fontWeight: '900' },

  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Colors.black },
  emptySub: { fontSize: 13, color: Colors.textSecondary },
});