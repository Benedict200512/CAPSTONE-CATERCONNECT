import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Image, Modal, Dimensions,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft, Send, Image as ImageIcon, Smile,
  Check, CheckCheck, X, MessageSquare
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

const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🎉', '👏'];

export default function ChatScreen({
  bookingId, receiverId, receiverName, receiverAvatar, bookingInfo, onClose,
}: Props) {
  const { session } = useAuth();
  const [messages, setMessages]   = useState<Message[]>([]);
  const [loading, setLoading]     = useState(true);
  const [text, setText]           = useState('');
  const [sending, setSending]     = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Reaction & Emoji picker state
  const [selectedMsgForReaction, setSelectedMsgForReaction] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const myId = session?.user?.id ?? '';

  // ── Load messages ──────────────────────────────────────────────────────
  const loadMessages = async () => {
    if (!bookingId || !myId) return;
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
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => {
              const exists = prev.find(m => m.id === payload.new.id);
              if (exists) return prev;
              return [...prev, payload.new as Message];
            });
            if (payload.new.receiver_id === myId) {
              supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id);
            }
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? (payload.new as Message) : m));
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

  // ── Send text/image message ────────────────────────────────────────────
  const handleSend = async (customContent?: string, imageUrl?: string) => {
    const contentToSend = customContent !== undefined ? customContent : text.trim();
    if ((!contentToSend && !imageUrl) || !myId) return;

    if (!receiverId || receiverId.trim() === '') {
      Alert.alert('Error', 'Could not identify the recipient. Please reopen the chat.');
      return;
    }

    if (!customContent) setText('');
    setSending(true);

    const { error } = await supabase.from('messages').insert({
      booking_id:  bookingId,
      sender_id:   myId,
      receiver_id: receiverId,
      content:     contentToSend || (imageUrl ? '📷 Photo' : ''),
      image_url:   imageUrl || null,
      reactions:   {},
      is_read:     false,
    });

    if (error) {
      if (!customContent) setText(contentToSend);
      Alert.alert('Error', error.message || 'Failed to send message.');
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
    if (!msg) return;

    const currentReactions = { ...(msg.reactions || {}) };
    if (currentReactions[myId] === emoji) {
      delete currentReactions[myId];
    } else {
      currentReactions[myId] = emoji;
    }

    const { error } = await supabase
      .from('messages')
      .update({ reactions: currentReactions })
      .eq('id', msgId);

    if (error) {
      Alert.alert('Error', 'Failed to react to message');
    }
    setSelectedMsgForReaction(null);
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

        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={() => setSelectedMsgForReaction(msg)}
          style={[s.bubbleContainer, isMine && s.bubbleContainerMine]}
        >
          <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
            {msg.image_url && (
              <TouchableOpacity onPress={() => setPreviewImage(msg.image_url ?? null)}>
                <Image source={{ uri: msg.image_url }} style={s.bubbleImage} resizeMode="cover" />
              </TouchableOpacity>
            )}
            {!!msg.content && msg.content !== '📷 Photo' && (
              <Text style={[s.bubbleText, isMine && s.bubbleTextMine]}>{msg.content}</Text>
            )}
            
            <View style={s.bubbleMeta}>
              <Text style={[s.bubbleTime, isMine && s.bubbleTimeMine]}>
                {formatTime(msg.created_at)}
              </Text>
              {isMine && (
                <View style={{ marginLeft: 2 }}>
                  {msg.is_read ? <CheckCheck size={13} color="rgba(255,255,255,0.9)" /> : <Check size={13} color="rgba(255,255,255,0.7)" />}
                </View>
              )}
            </View>
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
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === 'ios' ? 56 : 44 }]}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={s.headerBack} activeOpacity={0.7}>
            <ArrowLeft size={20} color={Colors.black} />
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
          <View style={{ flex: 1 }}>
            <Text style={s.headerName} numberOfLines={1}>{receiverName}</Text>
            {bookingInfo && <Text style={s.headerSub} numberOfLines={1}>{bookingInfo}</Text>}
          </View>
        </View>
      </View>

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

      {/* Emoji Quick Toolbar */}
      {showEmojiPicker && (
        <View style={s.emojiPickerBar}>
          {QUICK_EMOJIS.map(emoji => (
            <TouchableOpacity
              key={emoji}
              onPress={() => {
                setText(prev => prev + emoji);
                setShowEmojiPicker(false);
              }}
              style={s.emojiOptionBtn}
            >
              <Text style={{ fontSize: 22 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Input Bar */}
      <View style={s.inputBar}>
        <TouchableOpacity style={s.attachBtn} onPress={handlePickImage} activeOpacity={0.7}>
          <ImageIcon size={22} color={Colors.orange} />
        </TouchableOpacity>

        <TouchableOpacity style={s.attachBtn} onPress={() => setShowEmojiPicker(!showEmojiPicker)} activeOpacity={0.7}>
          <Smile size={22} color={showEmojiPicker ? Colors.orange : Colors.textSecondary} />
        </TouchableOpacity>

        <TextInput
          style={s.input}
          placeholder="Type a message..."
          placeholderTextColor={Colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />

        <TouchableOpacity
          style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!text.trim() || sending}
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
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F3F4F6',
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
  headerSub: { fontSize: 12, color: Colors.orange, fontWeight: '700', marginTop: 1 },

  messagesList: { padding: 16, paddingBottom: 16 },

  dateSeparator: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginVertical: 16,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dateText: { fontSize: 11, color: Colors.textMuted, fontWeight: '700' },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
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
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
  },
  bubbleMine: {
    backgroundColor: Colors.orange, borderBottomLeftRadius: 20, borderBottomRightRadius: 6,
    borderColor: Colors.orange,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2,
  },
  bubbleTheirs: { 
    backgroundColor: Colors.white, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  bubbleImage: { width: 220, height: 160, borderRadius: 14, marginBottom: 6 },
  bubbleText: { fontSize: 14, color: Colors.black, lineHeight: 20, fontWeight: '500' },
  bubbleTextMine: { color: Colors.white },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  bubbleTime: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.8)' },

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

  emojiPickerBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: Colors.white, paddingVertical: 10, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  emojiOptionBtn: { padding: 4 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 16, paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 32 : 14,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03, shadowRadius: 8, elevation: 8,
  },
  attachBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  input: {
    flex: 1, backgroundColor: '#F9FAFB',
    borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.black,
    maxHeight: 120, minHeight: 42, fontWeight: '500',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
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