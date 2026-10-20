import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator, Alert, AppState, FlatList, Keyboard, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Image, Modal, Dimensions, ScrollView,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import ConversationCustomerProfile from '@/components/ConversationCustomerProfile';
import { nextReactions, persistMessageReactions, reactionError } from '@/lib/messageReactions';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft, Send, Image as ImageIcon, Smile,
  X, MessageSquare, ChevronDown, ChevronUp, CalendarDays
} from 'lucide-react-native';

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url?: string | null;
  reactions?: Record<string, string>; // userId -> emoji
  is_read: boolean;
  created_at: string;
};

type Props = {
  bookingId: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string | null;
  bookingInfo?: string;
  onClose?: () => void;
};

type BookingDetails = {
  customerId: string;
  packageName: string | null;
  eventDate: string | null;
  eventType: string | null;
  guests: number | null;
  capacity: number | null;
  status: string | null;
};

const QUICK_QUESTIONS = [
  "What's included in my package?",
  'Are tables and chairs included?',
  'Can we discuss the event setup?',
  'What time will your team arrive?',
  'Can you accommodate special dietary requirements?',
  'Do you provide decorations and table setup?',
];

const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🎉', '👏'];
// Keep emoji grapheme sequences in their own native text runs. On some Android
// builds the styled message bubble's text font does not select an emoji glyph.
// The Unicode code points are left unchanged; this is display-only.
const EMOJI_PATTERN = /([\u00A9\u00AE\u203C-\u3299\u{1F000}-\u{1FAFF}\u2600-\u27BF](?:\uFE0F|\uFE0E)?(?:\u200D[\u00A9\u00AE\u203C-\u3299\u{1F000}-\u{1FAFF}\u2600-\u27BF](?:\uFE0F|\uFE0E)?)*)/gu;

function renderMessageContent(content: string) {
  return content.split(EMOJI_PATTERN).filter(Boolean).map((part, index) => {
    const isEmoji = new RegExp(`^(?:${EMOJI_PATTERN.source})$`, 'u').test(part);
    return isEmoji ? (
      <Text key={index} style={{ fontFamily: Platform.OS === 'android' ? 'Noto Color Emoji' : undefined, fontSize: 17, fontWeight: 'normal' }}>{part}</Text>
    ) : <Text key={index}>{part}</Text>;
  });
}

// Full message-composer emoji selection; reactions remain unchanged.
const MESSAGE_EMOJIS = [
  '😀', '😃', '😄', '😁', '😊', '😍', '🥰', '😘',
  '😂', '🤣', '🥹', '😅', '😉', '😎', '🤩', '🥳',
  '😢', '😭', '😔', '😮', '😱', '😡', '🤔', '🙏',
  '👍', '👎', '👏', '🙌', '🤝', '💪', '👋', '👌',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '💕', '💖',
  '🎉', '🎂', '🎈', '✨', '🔥', '💯', '✅', '🌸',
];

export default function ChatScreen({
  bookingId, receiverId, receiverName, receiverAvatar, bookingInfo, onClose,
}: Props) {
  const { session, profile } = useAuth();
  const [showQuickQuestions, setShowQuickQuestions] = useState(false);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [loading, setLoading]     = useState(true);
  const [text, setText]           = useState('');
  const [sending, setSending]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const refreshMessages = useRef<() => void>(() => {});
  const [showBookingDetails, setShowBookingDetails] = useState(false);
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<{ thread: string; data: BookingDetails | null; loading: boolean; error: boolean } | null>(null);
  const refreshBookingDetails = useRef<() => void>(() => {});
  
  // Reaction & Emoji picker state
  const [selectedMsgForReaction, setSelectedMsgForReaction] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState<'all' | 'faces' | 'gestures' | 'hearts' | 'celebrate'>('all');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const reacting = useRef(new Set<string>());
  const pendingReactions = useRef(new Map<string, { actor: string; emoji: string | undefined }>());

  const flatListRef = useRef<FlatList>(null);
  const composerRef = useRef<TextInput>(null);
  const myId = session?.user?.id ?? '';
  const thread = `${myId}:${bookingId}`;
  const currentThread = useRef(thread);
  currentThread.current = thread;
  const latestOutgoingId = [...messages].reverse().find(message => message.sender_id === myId)?.id;
  const detailsState = bookingDetails?.thread === thread ? bookingDetails : null;
  const details = detailsState?.data;
  const canViewCustomer = !!details && details.customerId === receiverId && receiverId !== myId;
  useEffect(() => { setShowCustomerProfile(false); }, [thread, receiverId]);

  // Read-only context query, separate from Stage 2 message/read-state logic.
  useFocusEffect(useCallback(() => {
    if (!myId || !bookingId) return;
    let active = true;
    let version = 0;
    const isCurrent = () => active && currentThread.current === thread;
    const loadDetails = async () => {
      const request = ++version;
      setBookingDetails({ thread, data: null, loading: true, error: false });
      try {
        const { data, error } = await supabase.from('bookings')
          .select('id, customer_id, event_date, event_type, guest_count, status, caterers(user_id), packages(name, guest_capacity)')
          .eq('id', bookingId).maybeSingle();
        if (!isCurrent() || request !== version) return;
        if (error || !data) throw new Error('Booking unavailable');
        const caterer = Array.isArray(data.caterers) ? data.caterers[0] : data.caterers;
        if (data.customer_id !== myId && caterer?.user_id !== myId) throw new Error('Not a participant');
        const selectedPackage = Array.isArray(data.packages) ? data.packages[0] : data.packages;
        setBookingDetails({ thread, loading: false, error: false, data: {
          customerId: data.customer_id,
          packageName: selectedPackage?.name || null,
          eventDate: data.event_date || null, eventType: data.event_type || null,
          guests: typeof data.guest_count === 'number' && data.guest_count > 0 ? data.guest_count : null,
          capacity: typeof selectedPackage?.guest_capacity === 'number' && selectedPackage.guest_capacity > 0 ? selectedPackage.guest_capacity : null,
          status: data.status || null,
        } });
      } catch {
        if (isCurrent() && request === version) setBookingDetails({ thread, data: null, loading: false, error: true });
      }
    };
    refreshBookingDetails.current = () => { if (isCurrent()) void loadDetails(); };
    setShowBookingDetails(false);
    void loadDetails();
    return () => { active = false; refreshBookingDetails.current = () => {}; };
  }, [bookingId, myId, thread]));

  const eventDate = details?.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(details.eventDate)
    ? new Date(`${details.eventDate}T12:00:00`) : null;
  const detailRows = [
    ['Package', details?.packageName || 'Not available'],
    ['Event date', eventDate && !Number.isNaN(eventDate.getTime()) ? eventDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not available'],
    ...(details?.eventType ? [['Event type', details.eventType]] : []),
    ...(details?.guests !== null && details?.guests !== undefined ? [['Booked guests', `${details.guests}`]] : []),
    ...(details?.capacity !== null && details?.capacity !== undefined ? [['Package capacity', `${details.capacity} guests per package`]] : []),
    ['Status', details?.status ? details.status.charAt(0).toUpperCase() + details.status.slice(1).replace(/_/g, ' ') : 'Not available'],
  ];

  // ── Load messages ──────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    if (!bookingId || !myId) return;
    let active = true;
    let requestVersion = 0;
    const pendingReads = new Set<string>();
    const isCurrent = () => active && currentThread.current === thread;
    const isVisible = () => isCurrent() && AppState.currentState === 'active';
    setMessages([]);
    setLoading(true);
    setReceiptError(null);

    const mergeMessages = (incoming: Message[]) => {
      setMessages(previous => {
        const byId = new Map(previous.map(message => [message.id, message]));
        incoming.forEach(message => {
          const pending = pendingReactions.current.get(`${thread}:${message.id}`);
          if (pending) {
            const reactions = { ...(message.reactions ?? {}) };
            if (pending.emoji === undefined) delete reactions[pending.actor]; else reactions[pending.actor] = pending.emoji;
            message = { ...message, reactions };
          }
          const existing = byId.get(message.id);
          byId.set(message.id, existing ? { ...existing, ...message, is_read: existing.is_read === true || message.is_read === true } : message);
        });
        return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    };
    const markIncomingRead = async (ids: string[]) => {
      const targets = ids.filter(id => !pendingReads.has(id));
      if (!isVisible() || targets.length === 0) return;
      targets.forEach(id => pendingReads.add(id));
      try {
        const { data, error } = await supabase.from('messages')
          .update({ is_read: true }).eq('booking_id', bookingId)
          .eq('receiver_id', myId).neq('sender_id', myId)
          .in('id', targets).select('id, is_read');
        if (!isCurrent()) return;
        if (error) throw error;
        const confirmed = new Set((data ?? []).filter(item => item.is_read === true).map(item => item.id));
        if (confirmed.size !== targets.length) throw new Error('Read update was not confirmed');
        setMessages(previous => previous.map(message => confirmed.has(message.id) && message.receiver_id === myId
          ? { ...message, is_read: true } : message));
        setReceiptError(null);
      } catch {
        if (isCurrent()) setReceiptError('Read status could not be updated. Tap Refresh to retry.');
      } finally { targets.forEach(id => pendingReads.delete(id)); }
    };
    const loadMessages = async () => {
      if (!isVisible()) return;
      const version = ++requestVersion;
      try {
        const { data, error } = await supabase.from('messages').select('*')
          .eq('booking_id', bookingId).or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
          .order('created_at', { ascending: true });
        if (!isCurrent() || version !== requestVersion) return;
        if (error) throw error;
        const loaded = (data ?? []) as Message[];
        // Merge persisted rows with live arrivals so a slower SELECT cannot
        // discard a newer message or revert a database-confirmed read receipt.
        mergeMessages(loaded);
        setLoading(false);
        await markIncomingRead(loaded.filter(message => message.receiver_id === myId && message.sender_id !== myId && message.is_read !== true).map(message => message.id));
      } catch {
        if (isCurrent() && version === requestVersion) setReceiptError('Messages could not be refreshed. Tap Refresh to retry.');
      } finally {
        if (isCurrent() && version === requestVersion) setLoading(false);
      }
    };
    refreshMessages.current = () => { void loadMessages(); };
    const channel = supabase.channel(`chat:${myId}:${bookingId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` }, payload => {
        if (!isCurrent() || (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE')) return;
        const message = payload.new as Message & { booking_id: string };
        if (message.booking_id !== bookingId || (message.sender_id !== myId && message.receiver_id !== myId)) return;
        mergeMessages([message]);
        if (message.receiver_id === myId && message.sender_id !== myId && message.is_read !== true) void markIncomingRead([message.id]);
      })
      .subscribe(status => {
        if (!isCurrent()) return;
        if (status === 'SUBSCRIBED') void loadMessages();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setReceiptError('Live read receipts are unavailable. Refresh or reopen the chat to check.');
      });
    void loadMessages();
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void loadMessages();
    });
    return () => {
      active = false;
      refreshMessages.current = () => {};
      appState.remove();
      void supabase.removeChannel(channel);
    };
  }, [bookingId, myId, thread]));

  // ── Auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  // ── Send text/image message ────────────────────────────────────────────
  const handleSend = async (customContent?: string, imageUrl?: string) => {
    const contentToSend = customContent !== undefined ? customContent : text.trim();
    if ((!contentToSend && !imageUrl) || !myId) return;

    if (!receiverId || receiverId.trim() === '') {
      Alert.alert('Error', 'Could not identify the recipient. Please reopen the chat.');
      return;
    }

    if (!customContent) setText('');
    setShowEmojiPicker(false);
    setSending(true);

    const { data: persisted, error } = await supabase.from('messages').insert({
      booking_id:  bookingId,
      sender_id:   myId,
      receiver_id: receiverId,
      content:     contentToSend || (imageUrl ? '📷 Photo' : ''),
      image_url:   imageUrl || null,
      reactions:   {},
      is_read:     false,
    }).select('*').single();

    if (error) {
      if (!customContent) setText(contentToSend);
      Alert.alert('Error', error.message || 'Failed to send message.');
    } else if (persisted && currentThread.current === thread) {
      setMessages(previous => {
        const existing = previous.find(message => message.id === persisted.id);
        const message = { ...(persisted as Message), is_read: existing?.is_read === true || persisted.is_read === true };
        return [...previous.filter(item => item.id !== message.id), message]
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    }
    setSending(false);
  };

  // ── Pick & Upload Image using Base64 Strategy ──────────────────────────
  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Permission to access photos was denied.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true, // Request base64 directly to avoid RN blob/fetch bugs
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const base64 = asset.base64;
    if (!base64) {
      Alert.alert('Error', 'Failed to retrieve image data.');
      return;
    }

    try {
      setUploading(true);
      const ext = asset.uri.split('.').pop()?.toLowerCase().split('?')[0] ?? 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const path = `${myId}/${bookingId}-${Date.now()}.${ext}`;

      // Decode base64 → Uint8Array
      const byteChars = atob(base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(path, byteArray, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data: publicUrlData } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(path);

      await handleSend('', publicUrlData.publicUrl);
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  // ── Add Reaction ───────────────────────────────────────────────────────
  const handleReact = async (msgId: string, emoji: string) => {
    const msg = messages.find(m => m.id === msgId);
    const key = `${thread}:${msgId}`;
    if (!msg || !myId || reacting.current.has(key) || (msg.sender_id !== myId && msg.receiver_id !== myId)) return;
    const activeThread = thread;
    const before = msg.reactions?.[myId];
    const next = nextReactions(msg.reactions, myId, emoji);
    reacting.current.add(key);
    pendingReactions.current.set(key, { actor: myId, emoji: next[myId] });
    setSelectedMsgForReaction(null);
    setMessages(previous => previous.map(message => message.id === msgId ? { ...message, reactions: next } : message));
    try {
      const saved = await persistMessageReactions(bookingId, msgId, myId, next);
      if (currentThread.current !== activeThread) return;
      pendingReactions.current.delete(key);
      setMessages(previous => previous.map(message => message.id === msgId ? { ...message, reactions: saved } : message));
      refreshMessages.current();
    } catch (error) {
      if (currentThread.current !== activeThread) return;
      pendingReactions.current.delete(key);
      // Roll back only this actor, retaining any other live reactions received.
      setMessages(previous => previous.map(message => {
        if (message.id !== msgId) return message;
        const restored = { ...(message.reactions ?? {}) };
        if (before === undefined) delete restored[myId]; else restored[myId] = before;
        return { ...message, reactions: restored };
      }));
      Alert.alert('Reaction not saved', reactionError(error));
      refreshMessages.current();
    } finally { reacting.current.delete(key); pendingReactions.current.delete(key); }
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
    const reactionsList = msg.reactions ? Object.values(msg.reactions) : [];

    return (
      <View style={[s.msgRow, isMine && s.msgRowMine]}>
        {!isMine && (
          receiverAvatar ? (
            <Image source={{ uri: receiverAvatar }} style={s.msgAvatar} />
          ) : (
            <View style={s.msgAvatarPlaceholder}>
              <Text style={s.msgAvatarText}>{receiverName.charAt(0)}</Text>
            </View>
          )
        )}

        <View style={[s.bubbleContainer, isMine && s.bubbleContainerMine]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={() => setSelectedMsgForReaction(msg)}
        >
          <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
            {msg.image_url && (
              <TouchableOpacity onPress={() => setPreviewImage(msg.image_url ?? null)}>
                <Image source={{ uri: msg.image_url }} style={s.bubbleImage} resizeMode="cover" />
              </TouchableOpacity>
            )}
            {!!msg.content && msg.content !== '📷 Photo' && (
              <Text style={[s.bubbleText, isMine && s.bubbleTextMine]}>{renderMessageContent(msg.content)}</Text>
            )}
          </View>

          {/* Message Reactions Badge */}
          {reactionsList.length > 0 && (
            <View style={[s.reactionsBadge, isMine ? s.reactionsBadgeMine : s.reactionsBadgeTheirs]}>
              {Array.from(new Set(reactionsList)).map((emoji, idx) => (
                <Text key={idx} style={{ fontSize: 12 }}>{emoji}</Text>
              ))}
              {reactionsList.length > 1 && (
                <Text style={s.reactionCountText}>{reactionsList.length}</Text>
              )}
            </View>
          )}
        </TouchableOpacity>
        <Text style={[s.messageMeta, isMine && s.messageMetaMine, reactionsList.length > 0 && { marginTop: 16 }]}>
          {formatTime(msg.created_at)}
          {isMine && msg.id === latestOutgoingId && !loading ? ` · ${msg.is_read === true ? 'Seen' : 'Sent'}` : ''}
        </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === 'ios' ? 56 : 44 }]}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={s.headerBack} activeOpacity={0.7}>
            <ChevronLeft size={20} color={Colors.black} />
          </TouchableOpacity>
        )}
        <View style={s.headerInfo}>
          <TouchableOpacity disabled={!canViewCustomer} accessibilityRole={canViewCustomer ? 'button' : undefined} accessibilityLabel={canViewCustomer ? 'View customer profile avatar' : receiverName} onPress={() => setShowCustomerProfile(true)}>
          {receiverAvatar ? (
            <Image source={{ uri: receiverAvatar }} style={s.headerAvatar} />
          ) : (
            <View style={s.headerAvatarPlaceholder}>
              <Text style={s.headerAvatarText}>{receiverName.charAt(0)}</Text>
            </View>
          )}
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, minHeight: 44, justifyContent: 'center' }} disabled={!canViewCustomer} accessibilityRole={canViewCustomer ? 'button' : undefined} accessibilityLabel={canViewCustomer ? `View customer profile for ${receiverName}` : receiverName} onPress={() => setShowCustomerProfile(true)}>
            <Text style={s.headerName} numberOfLines={1}>{receiverName}</Text>
            <Text style={s.headerSub}>Booking conversation</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ConversationCustomerProfile visible={showCustomerProfile && canViewCustomer} bookingId={bookingId} customerId={receiverId} onClose={() => setShowCustomerProfile(false)} />
      <View style={s.bookingContext}>
        <TouchableOpacity style={s.bookingContextToggle} accessibilityRole="button" accessibilityLabel="Booking details" accessibilityState={{ expanded: showBookingDetails }}
          onPress={() => {
            setShowBookingDetails(previous => !previous);
            if (!showBookingDetails) refreshBookingDetails.current();
          }}>
          <CalendarDays size={14} color={Colors.orangeDark} />
          <Text style={s.bookingContextText} numberOfLines={1}>{details?.packageName || 'Booking details'}</Text>
          {showBookingDetails ? <ChevronUp size={16} color={Colors.orangeDark} /> : <ChevronDown size={16} color={Colors.orangeDark} />}
        </TouchableOpacity>
        {showBookingDetails && (
          <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={s.bookingDetailsBody}>
            {!detailsState || detailsState.loading ? <ActivityIndicator size="small" color={Colors.orange} /> : detailsState.error ? (
              <View>
                <Text style={s.detailLabel}>Booking details are unavailable.</Text>
                <TouchableOpacity accessibilityRole="button" onPress={() => refreshBookingDetails.current()} style={{ paddingVertical: 8 }}><Text style={{ color: Colors.orangeDark, fontWeight: '700' }}>Retry</Text></TouchableOpacity>
              </View>
            ) : detailRows.map(([label, value]) => (
              <View key={label} style={s.detailRow}><Text style={s.detailLabel}>{label}</Text><Text style={s.detailValue}>{value}</Text></View>
            ))}
          </ScrollView>
        )}
      </View>

      {receiptError && (
        <View style={s.receiptNotice}>
          <Text accessibilityRole="alert" style={s.receiptNoticeText}>{receiptError}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh messages and read status" onPress={() => refreshMessages.current()} style={{ paddingVertical: 8 }}>
            <Text style={{ color: Colors.orangeDark, fontWeight: '700' }}>Refresh</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : messages.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIconWrap}>
            <MessageSquare size={36} color={Colors.orange} />
          </View>
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

      {/* Uploading overlay indicator */}
      {uploading && (
        <View style={s.uploadingBanner}>
          <ActivityIndicator size="small" color={Colors.orange} />
          <Text style={s.uploadingText}>Uploading photo...</Text>
        </View>
      )}

      {/* Draft suggestions only: sending still requires the existing Send button. */}
      {profile?.id === myId && profile.role === 'customer' && (
        <View style={s.quickQuestions}>
          <TouchableOpacity
            style={s.quickQuestionsToggle}
            accessibilityRole="button"
            accessibilityLabel="Quick Questions"
            accessibilityState={{ expanded: showQuickQuestions }}
            onPress={() => setShowQuickQuestions(previous => !previous)}
          >
            <MessageSquare size={14} color={Colors.orangeDark} />
            <Text style={s.quickQuestionsTitle}>Quick Questions</Text>
            <Text style={s.quickQuestionsHint}>Tap to draft</Text>
            {showQuickQuestions ? <ChevronDown size={16} color={Colors.orangeDark} /> : <ChevronUp size={16} color={Colors.orangeDark} />}
          </TouchableOpacity>
          {showQuickQuestions && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.questionChips}>
              {QUICK_QUESTIONS.map(question => (
                <TouchableOpacity
                  key={question}
                  style={s.questionChip}
                  accessibilityRole="button"
                  accessibilityLabel={`Draft message: ${question}`}
                  onPress={() => {
                    setText(question);
                    composerRef.current?.focus();
                  }}
                >
                  <Text style={s.questionChipText}>{question}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

       {/* Message emoji picker (separate from message reactions) */}
       {showEmojiPicker && (
         <View style={s.emojiPickerPanel}>
           <View style={s.emojiPickerHeader}>
             <View style={s.emojiPickerHeading}>
               <Smile size={17} color={Colors.orangeDark} />
               <Text style={s.emojiPickerTitle}>Choose an emoji</Text>
             </View>
             <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close emoji picker" onPress={() => setShowEmojiPicker(false)} style={s.emojiCloseBtn}>
               <X size={18} color={Colors.textSecondary} />
             </TouchableOpacity>
           </View>
           <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={s.emojiCategories}>
             {([
               ['all', 'All'], ['faces', 'Smileys'], ['gestures', 'Gestures'],
               ['hearts', 'Hearts'], ['celebrate', 'Celebration'],
             ] as const).map(([key, label]) => (
               <TouchableOpacity key={key} onPress={() => setEmojiCategory(key)} accessibilityRole="button" accessibilityState={{ selected: emojiCategory === key }} style={[s.emojiCategory, emojiCategory === key && s.emojiCategoryActive]}>
                 <Text style={[s.emojiCategoryText, emojiCategory === key && s.emojiCategoryTextActive]}>{label}</Text>
               </TouchableOpacity>
             ))}
           </ScrollView>
           <ScrollView style={s.emojiPickerScroll} contentContainerStyle={s.emojiPickerGrid} keyboardShouldPersistTaps="always" nestedScrollEnabled>
             {(emojiCategory === 'all' ? MESSAGE_EMOJIS
               : emojiCategory === 'faces' ? MESSAGE_EMOJIS.slice(0, 24)
               : emojiCategory === 'gestures' ? MESSAGE_EMOJIS.slice(24, 32)
               : emojiCategory === 'hearts' ? MESSAGE_EMOJIS.slice(32, 40)
               : MESSAGE_EMOJIS.slice(40)).map(emoji => (
               <TouchableOpacity
                 key={emoji}
                 accessibilityRole="button"
                 accessibilityLabel={`Insert ${emoji} emoji`}
                 onPress={() => setText(previous => previous + emoji)}
                 style={s.emojiOptionBtn}
               >
                 <Text style={s.emojiOptionText}>{emoji}</Text>
               </TouchableOpacity>
             ))}
           </ScrollView>
         </View>
       )}

      {/* Input Bar */}
      <View style={s.inputBar}>
        <TouchableOpacity style={s.attachBtn} onPress={handlePickImage} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Attach photo">
          <ImageIcon size={22} color={Colors.orange} />
        </TouchableOpacity>

        <TouchableOpacity style={s.attachBtn} onPress={() => { if (!showEmojiPicker) Keyboard.dismiss(); setShowEmojiPicker(previous => !previous); }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={showEmojiPicker ? "Close emoji picker" : "Open emoji picker"} accessibilityState={{ expanded: showEmojiPicker }}>
          <Smile size={22} color={showEmojiPicker ? Colors.orange : Colors.textSecondary} />
        </TouchableOpacity>

        <TextInput
          ref={composerRef}
          accessibilityLabel="Message"
          style={s.input}
          placeholder="Type a message..."
          placeholderTextColor={Colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!text.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Send size={18} color={Colors.white} />
          )}
        </TouchableOpacity>
      </View>

      {/* Reaction Modal Popup on Long Press */}
      <Modal
        visible={!!selectedMsgForReaction}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMsgForReaction(null)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedMsgForReaction(null)}
        >
          <View style={s.reactionPopupContainer}>
            {QUICK_EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={s.reactionPopupItem}
                onPress={() => selectedMsgForReaction && handleReact(selectedMsgForReaction.id, emoji)}
              >
                <Text style={{ fontSize: 26 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={s.imagePreviewRoot}>
          <TouchableOpacity style={s.closePreviewBtn} onPress={() => setPreviewImage(null)}>
            <X size={24} color={Colors.white} />
          </TouchableOpacity>
          {previewImage && (
            <Image source={{ uri: previewImage }} style={s.fullScreenImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.orangeLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F3F4F6' },
  headerAvatarPlaceholder: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#FED7AA',
  },
  headerAvatarText: { color: Colors.orange, fontWeight: '900', fontSize: 18 },
  headerName: { fontSize: 16, fontWeight: '900', color: Colors.black, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', marginTop: 3 },
  bookingContext: { backgroundColor: Colors.orangeLight, borderBottomWidth: 1, borderBottomColor: '#FED7AA' },
  bookingContextToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  bookingDetailsBody: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailLabel: { flex: 1, color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  detailValue: { flex: 1.5, color: Colors.textPrimary, fontSize: 12, lineHeight: 18, fontWeight: '600', textAlign: 'right' },
  bookingContextText: { flex: 1, color: Colors.textPrimary, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  quickQuestions: { backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
  quickQuestionsToggle: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 12 },
  quickQuestionsTitle: { flex: 1, color: Colors.orangeDark, fontSize: 12, fontWeight: '700' },
  quickQuestionsHint: { color: Colors.textSecondary, fontSize: 11 },
  questionChips: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  questionChip: { backgroundColor: Colors.orangeLight, borderWidth: 1, borderColor: '#FED7AA', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  questionChipText: { color: '#9A3412', fontSize: 12, lineHeight: 18, fontWeight: '600' },

  messagesList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },

  dateSeparator: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginVertical: 16,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dateText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', backgroundColor: Colors.white, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 18 },
  msgRowMine: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 32, height: 32, borderRadius: 12, marginBottom: 2, backgroundColor: '#F3F4F6' },
  msgAvatarPlaceholder: {
    width: 32, height: 32, borderRadius: 12,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#FED7AA',
    marginBottom: 2,
  },
  msgAvatarText: { fontSize: 13, fontWeight: '900', color: Colors.orange },

  bubbleContainer: { maxWidth: '75%', position: 'relative' },
  bubbleContainerMine: { alignItems: 'flex-end' },

  bubble: {
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
  },
  bubbleMine: {
    backgroundColor: Colors.orangeDark, borderBottomLeftRadius: 22, borderBottomRightRadius: 6,
    borderColor: Colors.orangeDark,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2,
  },
  bubbleTheirs: { 
    backgroundColor: Colors.white, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  bubbleImage: { width: 220, height: 160, borderRadius: 14, marginBottom: 6 },
  bubbleText: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22, fontWeight: '400' },
  bubbleTextMine: { color: Colors.white },
  messageMeta: { fontSize: 11, lineHeight: 16, color: Colors.textSecondary, alignSelf: 'flex-start', marginTop: 5, marginHorizontal: 4 },
  messageMetaMine: { alignSelf: 'flex-end', textAlign: 'right' },
  receiptNotice: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: Colors.orangeLight },
  receiptNoticeText: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary },

  reactionsBadge: {
    position: 'absolute', bottom: -10,
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: Colors.white, borderRadius: 12,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  reactionsBadgeMine: { right: 12 },
  reactionsBadgeTheirs: { left: 12 },
  reactionCountText: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, marginLeft: 2 },

  uploadingBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFF7ED', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#FED7AA',
  },
  uploadingText: { fontSize: 12, fontWeight: '800', color: Colors.orange },

  emojiPickerPanel: { backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  emojiPickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  emojiPickerHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emojiPickerTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  emojiCloseBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  emojiCategories: { paddingHorizontal: 12, gap: 6, paddingBottom: 10 },
  emojiCategory: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#F9FAFB' },
  emojiCategoryActive: { backgroundColor: Colors.orangeLight, borderWidth: 1, borderColor: '#FED7AA' },
  emojiCategoryText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 12 },
  emojiCategoryTextActive: { color: Colors.orangeDark },
  emojiPickerScroll: { maxHeight: 210 },
  emojiPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 14 },
  emojiOptionBtn: { width: '12.5%', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  emojiOptionText: { fontSize: 25 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 6,
    paddingHorizontal: 12, paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 14,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03, shadowRadius: 8, elevation: 8,
  },
  attachBtn: {
    width: 36, height: 42, borderRadius: 14,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  input: {
    flex: 1, backgroundColor: '#F9FAFB',
    borderRadius: 18, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.black,
    maxHeight: 120, minHeight: 44, fontWeight: '500',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 16,
    backgroundColor: Colors.orange,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  sendBtnDisabled: { backgroundColor: '#E5E7EB', shadowOpacity: 0 },

  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: '#FED7AA',
  },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  emptySub: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  reactionPopupContainer: {
    flexDirection: 'row', backgroundColor: Colors.white,
    borderRadius: 30, paddingHorizontal: 14, paddingVertical: 10, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  reactionPopupItem: { padding: 4 },

  imagePreviewRoot: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  closePreviewBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  fullScreenImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 },
});
