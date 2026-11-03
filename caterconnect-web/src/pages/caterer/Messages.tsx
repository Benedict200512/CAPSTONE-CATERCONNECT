import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Search,
  Send,
  MessageSquare,
  ArrowLeft,
  UserRound,
  CalendarDays,
  Loader2,
  RefreshCw,
  Paperclip,
  X,
  Smile,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  MoreVertical,
  Reply,
  Pencil,
  Pin,
  Trash2,
  Check,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import CatererPageHeader from '../../components/CatererPageHeader';
import CatererSkeleton from '../../components/CatererSkeleton';
import { useSearchParams } from 'react-router-dom';
import './Messages.css';

type BookingInfo = {
  id: string;
  customer_id: string;
  event_date: string | null;
  event_type: string | null;
  guest_count?: number | null;
  status?: string | null;
  caterers: {
    business_name: string;
    logo_url: string | null;
    user_id: string;
  } | null;
};

type ProfileInfo = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type CustomerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  address: string | null;
  avatar_url: string | null;
};

type BookingDetails = {
  id: string;
  customer_id: string;
  event_date: string | null;
  event_type: string | null;
  guest_count: number | null;
  status: string | null;
  package_name: string | null;
  package_capacity: number | null;
};

type Message = {
  id: string;
  booking_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url: string | null;
  reactions: Record<string, string> | null;
  is_read: boolean;
  created_at: string;
  reply_to: string | null;
  is_edited: boolean;
  is_pinned: boolean;
  edited_at: string | null;
  pinned_at: string | null;
};

type Conversation = {
  bookingId: string;
  customerId: string;
  customerName: string;
  customerAvatar: string | null;
  bookingInfo: string;
  eventDate: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isMine: boolean;
};

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🎉'];

const EMOJI_CATEGORIES = [
  {
    name: 'All',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
      '😊', '😇', '🙂', '🙃', '😉', '😍', '🥰', '😘',
      '😋', '😎', '🤩', '🥳', '😭', '😢', '😮', '😲',
      '😴', '🤔', '🙄', '😬', '🤗', '🤝', '🙏', '👏',
      '👍', '👎', '👋', '👌', '✌️', '🤞', '💪', '❤️',
      '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔',
      '💕', '💖', '💗', '💓', '💯', '🔥', '✨', '⭐',
      '🎉', '🎊', '🎂', '🍰', '🍕', '🍔', '🍗', '🍽️',
    ],
  },
  {
    name: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
      '😊', '😇', '🙂', '🙃', '😉', '😍', '🥰', '😘',
      '😋', '😎', '🤩', '🥳', '😭', '😢', '😮', '😲',
      '😴', '🤔', '🙄', '😬', '🤗', '😌', '😏', '🤭',
    ],
  },
  {
    name: 'Gestures',
    emojis: [
      '👋', '🤚', '✋', '🖐️', '👌', '🤌', '🤏', '✌️',
      '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆',
      '👇', '☝️', '👍', '👎', '✊', '👊', '👏', '🙌',
      '👐', '🤝', '🙏', '💪',
    ],
  },
  {
    name: 'Hearts',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '💕', '💞', '💓', '💗', '💖', '💘',
      '💝', '💟', '❣️', '💌',
    ],
  },
  {
    name: 'Celebration',
    emojis: [
      '🎉', '🎊', '🎈', '🎁', '🎂', '🥳', '🎆', '🎇',
      '✨', '⭐', '🌟', '💫', '🔥', '👏', '🙌', '🏆',
      '🥇', '🎖️', '🍾', '🥂',
    ],
  },
];

const formatBookingInfo = (
  eventType: string | null,
  eventDate: string | null
) => {
  const type = eventType || 'Event';

  if (!eventDate) return type;

  const date = new Date(`${eventDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) return type;

  return `${type} · ${date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
};

const formatDate = (value: string | null) => {
  if (!value) return 'Not specified';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return 'Not specified';

  return date.toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatMessageTime = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatConversationTime = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return formatMessageTime(value);
  }

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  });
};

const getDateLabel = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatStatus = (status: string | null) => {
  if (!status) return 'Not specified';

  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
};

const getFileExtension = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension && /^[a-z0-9]+$/.test(extension)) {
    return extension;
  }

  const mimeExtensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  return mimeExtensions[file.type] || 'jpg';
};

export default function Messages() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();

  const requestedBookingId = searchParams.get('bookingId');
  const requestedCustomerId = searchParams.get('receiverId');

  const autoOpenedBookingRef = useRef<string | null>(null);
  const myId = session?.user?.id ?? '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');

  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [inboxError, setInboxError] = useState('');
  const [chatError, setChatError] = useState('');
  const [sendError, setSendError] = useState('');

  const [messageInput, setMessageInput] = useState('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState('');
  const [previewImage, setPreviewImage] = useState('');

  const [reactionMessageId, setReactionMessageId] = useState<string | null>(
    null
  );
  const [reactionLoadingId, setReactionLoadingId] = useState<string | null>(
    null
  );

  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageInput, setEditMessageInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [savingMessageAction, setSavingMessageAction] = useState(false);

  const [bookingDetails, setBookingDetails] =
    useState<BookingDetails | null>(null);
  const [loadingBookingDetails, setLoadingBookingDetails] = useState(false);
  const [bookingDetailsError, setBookingDetailsError] = useState('');
  const [showBookingDetails, setShowBookingDetails] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('All');

  // CUSTOMER PROFILE
  const [customerProfile, setCustomerProfile] =
    useState<CustomerProfile | null>(null);
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);
  const [loadingCustomerProfile, setLoadingCustomerProfile] = useState(false);
  const [customerProfileError, setCustomerProfileError] = useState('');

  // PINNED MESSAGES JUMP
  const [currentPinnedIndex, setCurrentPinnedIndex] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedBookingIdRef = useRef<string | null>(null);

  // COMPUTED PINNED MESSAGES
  const pinnedMessages = useMemo(() => {
    return messages.filter((m) => m.is_pinned);
  }, [messages]);

  // RESET PINNED INDEX WHEN CONVERSATION OR PINNED LIST CHANGES
  useEffect(() => {
    if (currentPinnedIndex >= pinnedMessages.length) {
      setCurrentPinnedIndex(0);
    }
  }, [pinnedMessages.length, currentPinnedIndex]);

  // JUMP TO PINNED MESSAGE IN CHAT
  const scrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('messages-highlight-pinned');
      setTimeout(() => {
        messageElement.classList.remove('messages-highlight-pinned');
      }, 2000);
    }
  };

  // AUTOMATICALLY OPEN CHATROOM FROM BOOKING PAGE
  useEffect(() => {
    const openRequestedConversation = async () => {
      if (
        !myId ||
        !requestedBookingId ||
        !requestedCustomerId ||
        loadingInbox
      ) {
        return;
      }

      if (autoOpenedBookingRef.current === requestedBookingId) {
        return;
      }

      try {
        setInboxError('');

        const existingConversation = conversations.find(
          (conversation) =>
            conversation.bookingId === requestedBookingId &&
            conversation.customerId === requestedCustomerId
        );

        if (existingConversation) {
          autoOpenedBookingRef.current = requestedBookingId;
          await selectConversation(existingConversation);
          return;
        }

        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .select(`
            id,
            customer_id,
            event_date,
            event_type,
            caterers(business_name, logo_url, user_id)
          `)
          .eq('id', requestedBookingId)
          .eq('customer_id', requestedCustomerId)
          .maybeSingle();

        if (bookingError) throw bookingError;

        if (!bookingData) {
          throw new Error('The requested booking could not be found.');
        }

        const booking = bookingData as unknown as BookingInfo;

        if (booking.caterers?.user_id !== myId) {
          throw new Error(
            'You are not authorized to access this customer conversation.'
          );
        }

        const { data: customerData, error: customerError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', booking.customer_id)
          .maybeSingle();

        if (customerError) throw customerError;

        if (!customerData) {
          throw new Error('Customer profile could not be found.');
        }

        const customer = customerData as ProfileInfo;

        const newConversation: Conversation = {
          bookingId: booking.id,
          customerId: booking.customer_id,
          customerName: customer.full_name || 'Customer',
          customerAvatar: customer.avatar_url,
          bookingInfo: formatBookingInfo(
            booking.event_type,
            booking.event_date
          ),
          eventDate: booking.event_date,
          lastMessage: 'Start a conversation',
          lastMessageTime: new Date().toISOString(),
          unreadCount: 0,
          isMine: false,
        };

        autoOpenedBookingRef.current = requestedBookingId;

        setConversations((current) => {
          const alreadyExists = current.some(
            (item) => item.bookingId === newConversation.bookingId
          );

          return alreadyExists
            ? current
            : [newConversation, ...current];
        });

        await selectConversation(newConversation);
      } catch (error) {
        console.error('Failed to open requested chatroom:', error);
        setInboxError(getErrorMessage(error));
      }
    };

    void openRequestedConversation();
  }, [
    myId,
    requestedBookingId,
    requestedCustomerId,
    loadingInbox,
    conversations,
  ]);

  useEffect(() => {
    selectedBookingIdRef.current = selectedConversation?.bookingId ?? null;
  }, [selectedConversation]);

  // LOAD CONVERSATIONS
  const loadConversations = useCallback(async () => {
    if (!myId) {
      setConversations([]);
      setLoadingInbox(false);
      return;
    }

    try {
      setInboxError('');

      const { data: messageRows, error: messageError } = await supabase
        .from('messages')
        .select(`
          id,
          booking_id,
          sender_id,
          receiver_id,
          content,
          image_url,
          reactions,
          is_read,
          created_at,
          reply_to,
          is_edited,
          is_pinned,
          edited_at,
          pinned_at
        `)
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order('created_at', { ascending: false });

      if (messageError) throw messageError;

      const rows = messageRows ?? [];

      if (rows.length === 0) {
        setConversations([]);
        return;
      }

      const latestByBooking = new Map<string, (typeof rows)[number]>();

      for (const message of rows) {
        if (message.booking_id && !latestByBooking.has(message.booking_id)) {
          latestByBooking.set(message.booking_id, message);
        }
      }

      const latestMessages = Array.from(latestByBooking.values());
      const bookingIds = latestMessages.map((message) => message.booking_id);

      if (bookingIds.length === 0) {
        setConversations([]);
        return;
      }

      const { data: bookingRows, error: bookingError } = await supabase
        .from('bookings')
        .select(
          'id, customer_id, event_date, event_type, caterers(business_name, logo_url, user_id)'
        )
        .in('id', bookingIds);

      if (bookingError) throw bookingError;

      const bookings = (bookingRows ?? []) as unknown as BookingInfo[];

      const validBookings = bookings.filter(
        (booking) => booking.caterers?.user_id === myId
      );

      if (validBookings.length === 0) {
        setConversations([]);
        return;
      }

      const validBookingIds = new Set(
        validBookings.map((booking) => booking.id)
      );

      const customerIds = [
        ...new Set(validBookings.map((booking) => booking.customer_id)),
      ];

      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', customerIds);

      if (profileError) throw profileError;

      const profiles = (profileRows ?? []) as ProfileInfo[];

      const profileMap = new Map(
        profiles.map((profile) => [profile.id, profile])
      );

      const { data: unreadRows, error: unreadError } = await supabase
        .from('messages')
        .select('booking_id')
        .in('booking_id', Array.from(validBookingIds))
        .eq('receiver_id', myId)
        .eq('is_read', false);

      if (unreadError) throw unreadError;

      const unreadCounts = new Map<string, number>();

      for (const row of unreadRows ?? []) {
        unreadCounts.set(
          row.booking_id,
          (unreadCounts.get(row.booking_id) ?? 0) + 1
        );
      }

      const bookingMap = new Map(
        validBookings.map((booking) => [booking.id, booking])
      );

      const result: Conversation[] = latestMessages
        .filter((message) => validBookingIds.has(message.booking_id))
        .map((message) => {
          const booking = bookingMap.get(message.booking_id)!;
          const customer = profileMap.get(booking.customer_id);
          const messageContent = message.content?.trim();

          return {
            bookingId: booking.id,
            customerId: booking.customer_id,
            customerName: customer?.full_name || 'Customer',
            customerAvatar: customer?.avatar_url ?? null,
            bookingInfo: formatBookingInfo(
              booking.event_type,
              booking.event_date
            ),
            eventDate: booking.event_date,
            lastMessage:
              messageContent ||
              (message.image_url ? '📷 Photo' : 'New message'),
            lastMessageTime: message.created_at,
            unreadCount: unreadCounts.get(booking.id) ?? 0,
            isMine: message.sender_id === myId,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.lastMessageTime).getTime() -
            new Date(a.lastMessageTime).getTime()
        );

      setConversations(result);

      const selectedId = selectedBookingIdRef.current;

      if (selectedId) {
        const updated = result.find((item) => item.bookingId === selectedId);
        if (updated) setSelectedConversation(updated);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setInboxError(getErrorMessage(error));
    } finally {
      setLoadingInbox(false);
    }
  }, [myId]);

  // LOAD CUSTOMER PROFILE
  const loadCustomerProfile = useCallback(async () => {
    if (!selectedConversation || !myId) return;

    try {
      setLoadingCustomerProfile(true);
      setCustomerProfileError('');
      setCustomerProfile(null);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone_number, address, avatar_url')
        .eq('id', selectedConversation.customerId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error('Customer profile could not be found.');
      }

      setCustomerProfile(data as CustomerProfile);
    } catch (error) {
      console.error('Failed to load customer profile:', error);
      setCustomerProfileError(getErrorMessage(error));
    } finally {
      setLoadingCustomerProfile(false);
    }
  }, [selectedConversation, myId]);

  const openCustomerProfile = async () => {
    setShowCustomerProfile(true);
    await loadCustomerProfile();
  };

  const closeCustomerProfile = () => {
    setShowCustomerProfile(false);
    setCustomerProfile(null);
    setCustomerProfileError('');
  };

  // LOAD BOOKING DETAILS
  const loadBookingDetails = useCallback(
    async (bookingId: string) => {
      if (!myId || !bookingId) return;

      try {
        setLoadingBookingDetails(true);
        setBookingDetailsError('');
        setBookingDetails(null);

        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id,
            customer_id,
            event_date,
            event_type,
            guest_count,
            status,
            caterers(user_id),
            packages(name, guest_capacity)
          `)
          .eq('id', bookingId)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          throw new Error('Booking details could not be found.');
        }

        if (selectedBookingIdRef.current !== bookingId) return;

        const booking = data as unknown as {
          id: string;
          customer_id: string;
          event_date: string | null;
          event_type: string | null;
          guest_count: number | null;
          status: string | null;
          caterers: { user_id: string } | null;
          packages:
            | {
                name: string;
                guest_capacity: number | null;
              }
            | {
                name: string;
                guest_capacity: number | null;
              }[]
            | null;
        };

        if (booking.caterers?.user_id !== myId) {
          throw new Error('You are not authorized to view this booking.');
        }

        const packageData = Array.isArray(booking.packages)
          ? booking.packages[0] ?? null
          : booking.packages;

        setBookingDetails({
          id: booking.id,
          customer_id: booking.customer_id,
          event_date: booking.event_date,
          event_type: booking.event_type,
          guest_count: booking.guest_count,
          status: booking.status,
          package_name: packageData?.name ?? null,
          package_capacity: packageData?.guest_capacity ?? null,
        });
      } catch (error) {
        console.error('Failed to load booking details:', error);
        setBookingDetailsError(getErrorMessage(error));
      } finally {
        setLoadingBookingDetails(false);
      }
    },
    [myId]
  );

  useEffect(() => {
    const bookingId = selectedConversation?.bookingId;

    setBookingDetails(null);
    setBookingDetailsError('');
    setShowBookingDetails(false);

    if (bookingId) {
      void loadBookingDetails(bookingId);
    }
  }, [selectedConversation?.bookingId, loadBookingDetails]);

  // LOAD MESSAGES AND MARK INCOMING MESSAGES AS READ
  const loadMessages = useCallback(
    async (bookingId: string, showLoader = true) => {
      if (!myId || !bookingId) return;

      try {
        if (showLoader) setLoadingMessages(true);

        setChatError('');

        const { data, error } = await supabase
          .from('messages')
          .select(`
            id,
            booking_id,
            sender_id,
            receiver_id,
            content,
            image_url,
            reactions,
            is_read,
            created_at,
            reply_to,
            is_edited,
            is_pinned,
            edited_at,
            pinned_at
          `)
          .eq('booking_id', bookingId)
          .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (selectedBookingIdRef.current !== bookingId) return;

        const loadedMessages = (data ?? []) as Message[];
        setMessages(loadedMessages);

        const unreadIds = loadedMessages
          .filter(
            (message) =>
              message.receiver_id === myId &&
              message.sender_id !== myId &&
              !message.is_read
          )
          .map((message) => message.id);

        if (unreadIds.length > 0) {
          const { data: updatedRows, error: readError } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('booking_id', bookingId)
            .eq('receiver_id', myId)
            .in('id', unreadIds)
            .select('id');

          if (readError) {
            console.error('Unable to mark messages as read:', readError);
          } else {
            const updatedIds = new Set(
              (updatedRows ?? []).map((row) => row.id)
            );

            setMessages((current) =>
              current.map((message) =>
                updatedIds.has(message.id)
                  ? { ...message, is_read: true }
                  : message
              )
            );
          }
        }

        await loadConversations();
      } catch (error) {
        console.error('Failed to load messages:', error);
        setChatError(getErrorMessage(error));
      } finally {
        if (showLoader) setLoadingMessages(false);
      }
    },
    [myId, loadConversations]
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // REALTIME MESSAGE UPDATES
  useEffect(() => {
    if (!myId) return;

    const channel = supabase
      .channel(`caterer-inbox:${myId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${myId}`,
        },
        (payload) => {
          const bookingId =
            (payload.new as Message)?.booking_id ??
            (payload.old as Message)?.booking_id;

          if (bookingId && selectedBookingIdRef.current === bookingId) {
            void loadMessages(bookingId, false);
          }

          void loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${myId}`,
        },
        (payload) => {
          const bookingId =
            (payload.new as Message)?.booking_id ??
            (payload.old as Message)?.booking_id;

          if (bookingId && selectedBookingIdRef.current === bookingId) {
            void loadMessages(bookingId, false);
          }

          void loadConversations();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId, loadConversations, loadMessages]);

  // SCROLL TO LATEST MESSAGE
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // SEARCH
  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return conversations;

    return conversations.filter((conversation) =>
      [
        conversation.customerName,
        conversation.bookingInfo,
        conversation.lastMessage,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [conversations, search]);

  // SELECT CONVERSATION
  const selectConversation = async (conversation: Conversation) => {
    selectedBookingIdRef.current = conversation.bookingId;

    setSelectedConversation(conversation);
    setMessages([]);
    setSendError('');
    setChatError('');
    setMessageInput('');
    setSelectedFile(null);
    setFilePreview('');
    setShowEmojiPicker(false);
    setReactionMessageId(null);
    setCurrentPinnedIndex(0);
    closeCustomerProfile();

    await loadMessages(conversation.bookingId);
  };

  const closeConversation = () => {
    selectedBookingIdRef.current = null;

    setSelectedConversation(null);
    setMessages([]);
    setChatError('');
    setSendError('');
    setMessageInput('');
    setSelectedFile(null);
    setFilePreview('');
    setBookingDetails(null);
    setShowBookingDetails(false);
    setShowEmojiPicker(false);
    setReactionMessageId(null);
    setCurrentPinnedIndex(0);
    closeCustomerProfile();
  };

  // EMOJI PICKER
  const activeEmojis =
    EMOJI_CATEGORIES.find(
      (category) => category.name === activeEmojiCategory
    )?.emojis ?? EMOJI_CATEGORIES[0].emojis;

  const insertEmoji = (emoji: string) => {
    setMessageInput((current) => current + emoji);
    setShowEmojiPicker(false);
  };

  // IMAGE SELECTION AND PREVIEW
  const handleFileSelection = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setSendError('');

    if (!file.type.startsWith('image/')) {
      setSendError('Please select an image file.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSendError('Image size must not exceed 5 MB.');
      event.target.value = '';
      return;
    }

    if (filePreview) URL.revokeObjectURL(filePreview);

    const previewUrl = URL.createObjectURL(file);

    setSelectedFile(file);
    setFilePreview(previewUrl);
  };

  const removeSelectedFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);

    setSelectedFile(null);
    setFilePreview('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  // UPLOAD IMAGE TO SUPABASE STORAGE
  const uploadImage = async (file: File, bookingId: string) => {
    const extension = getFileExtension(file);
    const filePath = `${myId}/${bookingId}-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  // SEND TEXT OR IMAGE MESSAGE
  const sendMessage = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!selectedConversation || !myId || sending) return;

    const content = messageInput.trim();

    if (!content && !selectedFile) return;

    setSending(true);
    setSendError('');
    setShowEmojiPicker(false);

    let imageUrl: string | null = null;

    try {
      if (selectedFile) {
        setUploading(true);
        imageUrl = await uploadImage(
          selectedFile,
          selectedConversation.bookingId
        );
      }

      setUploading(false);

      const { error } = await supabase.from('messages').insert({
        booking_id: selectedConversation.bookingId,
        sender_id: myId,
        receiver_id: selectedConversation.customerId,
        content: content || (imageUrl ? '📷 Photo' : ''),
        image_url: imageUrl,
        reactions: {},
        is_read: false,
        reply_to: replyingTo?.id ?? null,
      });

      if (error) throw error;

      setMessageInput('');
      setReplyingTo(null);
      removeSelectedFile();

      await loadMessages(selectedConversation.bookingId, false);
      await loadConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
      setSendError(getErrorMessage(error));
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  // MESSAGE REACTIONS
  const toggleReaction = async (message: Message, emoji: string) => {
    if (!myId || reactionLoadingId === message.id) return;

    setReactionLoadingId(message.id);
    setSendError('');

    try {
      const current = { ...(message.reactions ?? {}) };

      if (current[myId] === emoji) {
        delete current[myId];
      } else {
        current[myId] = emoji;
      }

      const { data, error } = await supabase
        .from('messages')
        .update({ reactions: current })
        .eq('id', message.id)
        .eq('booking_id', message.booking_id)
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .select('id, reactions');

      if (error) throw error;

      if (
        !data ||
        data.length !== 1 ||
        data[0].id !== message.id ||
        !data[0].reactions ||
        typeof data[0].reactions !== 'object'
      ) {
        throw new Error('Reaction update was not confirmed. Please refresh.');
      }

      setMessages((currentMessages) =>
        currentMessages.map((item) =>
          item.id === message.id
            ? {
                ...item,
                reactions: data[0].reactions as Record<string, string>,
              }
            : item
        )
      );

      setReactionMessageId(null);
    } catch (error) {
      console.error('Failed to update reaction:', error);
      setSendError(getErrorMessage(error));
    } finally {
      setReactionLoadingId(null);
    }
  };

  // REPLY TO MESSAGE
  const startReply = (message: Message) => {
    setReplyingTo(message);
    setMessageInput('');
    setActiveMessageMenu(null);
    setReactionMessageId(null);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  // EDIT MESSAGE
  const startEdit = (message: Message) => {
    if (message.sender_id !== myId) return;

    if (message.image_url && message.content === '📷 Photo') {
      setSendError('Photo-only messages cannot be edited.');
      return;
    }

    setEditingMessageId(message.id);
    setEditMessageInput(message.content);
    setActiveMessageMenu(null);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditMessageInput('');
  };

  const saveEditedMessage = async (message: Message) => {
    const content = editMessageInput.trim();

    if (!content || !myId || savingMessageAction) return;

    if (message.sender_id !== myId) return;

    try {
      setSavingMessageAction(true);
      setSendError('');

      const { data, error } = await supabase
        .from('messages')
        .update({
          content,
          is_edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq('id', message.id)
        .eq('sender_id', myId)
        .select()
        .single();

      if (error) throw error;

      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? (data as Message) : item
        )
      );

      setEditingMessageId(null);
      setEditMessageInput('');

      if (selectedConversation) {
        await loadConversations();
      }
    } catch (error) {
      console.error('Failed to edit message:', error);
      setSendError(getErrorMessage(error));
    } finally {
      setSavingMessageAction(false);
    }
  };

  // PIN / UNPIN MESSAGE
  const togglePinMessage = async (message: Message) => {
    if (!myId || savingMessageAction) return;

    try {
      setSavingMessageAction(true);
      setSendError('');

      const nextPinnedState = !message.is_pinned;

      const { data, error } = await supabase
        .from('messages')
        .update({
          is_pinned: nextPinnedState,
          pinned_at: nextPinnedState ? new Date().toISOString() : null,
        })
        .eq('id', message.id)
        .eq('booking_id', message.booking_id)
        .select()
        .single();

      if (error) throw error;

      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? (data as Message) : item
        )
      );

      setActiveMessageMenu(null);
    } catch (error) {
      console.error('Failed to pin message:', error);
      setSendError(getErrorMessage(error));
    } finally {
      setSavingMessageAction(false);
    }
  };

  // DELETE MESSAGE
  const deleteMessage = async (message: Message) => {
    if (!myId || message.sender_id !== myId || savingMessageAction) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this message? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setSavingMessageAction(true);
      setSendError('');

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', message.id)
        .eq('sender_id', myId);

      if (error) throw error;

      setMessages((current) =>
        current.filter((item) => item.id !== message.id)
      );

      setActiveMessageMenu(null);
    } catch (error) {
      console.error('Failed to delete message:', error);
      setSendError(getErrorMessage(error));
    } finally {
      setSavingMessageAction(false);
    }
  };

  const totalUnread = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0
  );

  return (
    <div className="caterer-messages-page">
      <CatererPageHeader
        className="messages-page-heading"
        icon={<MessageSquare size={25} />}
        title="Messages"
        description="Communicate with customers about their catering bookings."
        action={totalUnread > 0 ? <span className="messages-total-unread">{totalUnread} unread</span> : undefined}
      />

      <div className="messages-workspace">
        {/* INBOX */}
        <aside
          className={`messages-inbox ${
            selectedConversation ? 'messages-inbox-hidden' : ''
          }`}
        >
          <div className="messages-inbox-header">
            <div>
              <h2>Conversations</h2>
              <span>{conversations.length} conversations</span>
            </div>
          </div>

          <div className="messages-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {loadingInbox ? (
            <CatererSkeleton variant="conversation-list" label="Loading conversations" />
          ) : inboxError ? (
            <div className="messages-state messages-error-state">
              <p>{inboxError}</p>
              <button onClick={() => void loadConversations()}>
                <RefreshCw size={15} />
                Try again
              </button>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="messages-state">
              <MessageSquare size={34} />
              <h3>
                {search ? 'No conversations found' : 'No messages yet'}
              </h3>
              <p>
                {search
                  ? 'Try searching with another name or keyword.'
                  : 'Customer conversations will appear here when messages are exchanged.'}
              </p>
            </div>
          ) : (
            <div className="messages-conversation-list">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.bookingId}
                  type="button"
                  className={`messages-conversation-item ${
                    selectedConversation?.bookingId === conversation.bookingId
                      ? 'active'
                      : ''
                  }${conversation.unreadCount > 0 ? ' unread' : ''}`}
                  onClick={() => void selectConversation(conversation)}
                >
                  <div className="messages-avatar">
                    {conversation.customerAvatar ? (
                      <img
                        src={conversation.customerAvatar}
                        alt={conversation.customerName}
                      />
                    ) : (
                      <UserRound size={22} />
                    )}
                  </div>

                  <div className="messages-conversation-content">
                    <div className="messages-conversation-top">
                      <strong>{conversation.customerName}</strong>
                      <span>
                        {formatConversationTime(
                          conversation.lastMessageTime
                        )}
                      </span>
                    </div>

                    <div className="messages-conversation-booking">
                      {conversation.bookingInfo}
                    </div>

                    <div className="messages-conversation-bottom">
                      <p>
                        {conversation.isMine ? 'You: ' : ''}
                        {conversation.lastMessage}
                      </p>

                      {conversation.unreadCount > 0 && (
                        <span className="messages-unread-badge">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* CHAT AREA */}
        <section
          className={`messages-chat ${
            selectedConversation ? 'messages-chat-visible' : ''
          }`}
        >
          {!selectedConversation ? (
            <div className="messages-chat-placeholder">
              <div className="messages-placeholder-icon">
                <MessageSquare size={38} />
              </div>
              <h2>Select a conversation</h2>
              <p>
                Choose a customer conversation to view messages and respond
                to booking inquiries.
              </p>
            </div>
          ) : (
            <>
              {/* CHAT HEADER */}
              <header className="messages-chat-header">
                <button
                  type="button"
                  className="messages-back-button"
                  onClick={closeConversation}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={20} />
                </button>

                <button
                  type="button"
                  className="messages-customer-profile-trigger"
                  onClick={() => void openCustomerProfile()}
                  title="View customer profile"
                >
                  <div className="messages-avatar messages-header-avatar">
                    {selectedConversation.customerAvatar ? (
                      <img
                        src={selectedConversation.customerAvatar}
                        alt={selectedConversation.customerName}
                      />
                    ) : (
                      <UserRound size={22} />
                    )}
                  </div>

                  <div className="messages-header-details">
                    <h2>{selectedConversation.customerName}</h2>
                    <p>{selectedConversation.bookingInfo}</p>
                  </div>
                </button>
              </header>

              {/* BOOKING DETAILS DROPDOWN */}
              <div className="messages-booking-details">
                <button
                  type="button"
                  className="messages-booking-details-toggle"
                  onClick={() =>
                    setShowBookingDetails((current) => !current)
                  }
                  aria-expanded={showBookingDetails}
                >
                  <div className="messages-booking-details-title">
                    <CalendarDays size={18} />
                    <div>
                      <strong>Booking Details</strong>
                    </div>
                  </div>

                  {showBookingDetails ? (
                    <ChevronUp size={19} />
                  ) : (
                    <ChevronDown size={19} />
                  )}
                </button>

                {showBookingDetails && (
                  <div className="messages-booking-details-content">
                    {loadingBookingDetails ? (
                      <CatererSkeleton variant="booking-detail" label="Loading booking details" />
                    ) : bookingDetailsError ? (
                      <div className="messages-booking-error">
                        <p>{bookingDetailsError}</p>
                        <button
                          type="button"
                          onClick={() =>
                            void loadBookingDetails(
                              selectedConversation.bookingId
                            )
                          }
                        >
                          <RefreshCw size={14} />
                          Try again
                        </button>
                      </div>
                    ) : bookingDetails ? (
                      <div className="messages-booking-grid">
                        <div className="messages-booking-detail-item">
                          <span>Package</span>
                          <strong>
                            {bookingDetails.package_name || 'Not specified'}
                          </strong>
                        </div>

                        <div className="messages-booking-detail-item">
                          <span>Event Date</span>
                          <strong>
                            {formatDate(bookingDetails.event_date)}
                          </strong>
                        </div>

                        <div className="messages-booking-detail-item">
                          <span>Event Type</span>
                          <strong>
                            {bookingDetails.event_type || 'Not specified'}
                          </strong>
                        </div>

                        <div className="messages-booking-detail-item">
                          <span>Booked Guests</span>
                          <strong>
                            {bookingDetails.guest_count ?? 'Not specified'}
                          </strong>
                        </div>

                        <div className="messages-booking-detail-item">
                          <span>Package Capacity</span>
                          <strong>
                            {bookingDetails.package_capacity ?? 'Not specified'}
                          </strong>
                        </div>

                        <div className="messages-booking-detail-item">
                          <span>Booking Status</span>
                          <strong className="messages-booking-status">
                            {formatStatus(bookingDetails.status)}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <p className="messages-booking-empty">
                        Booking details are unavailable.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* PINNED MESSAGES BANNER */}
              {pinnedMessages.length > 0 && (
                <div className="messages-pinned-banner">
                  <div className="messages-pinned-banner-content">
                    <Pin size={16} className="messages-pinned-banner-icon" />
                    <div
                      className="messages-pinned-banner-text"
                      onClick={() =>
                        scrollToMessage(pinnedMessages[currentPinnedIndex].id)
                      }
                      role="button"
                      tabIndex={0}
                      title="Click to jump to message"
                    >
                      <strong>
                        Pinned Message{' '}
                        {pinnedMessages.length > 1
                          ? `(${currentPinnedIndex + 1}/${pinnedMessages.length})`
                          : ''}
                      </strong>
                      <p>
                        {pinnedMessages[currentPinnedIndex]?.content?.trim() ||
                          (pinnedMessages[currentPinnedIndex]?.image_url
                            ? '📷 Photo'
                            : 'Pinned message')}
                      </p>
                    </div>
                  </div>

                  <div className="messages-pinned-banner-actions">
                    {pinnedMessages.length > 1 && (
                      <div className="messages-pinned-banner-nav">
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentPinnedIndex((prev) =>
                              prev === 0 ? pinnedMessages.length - 1 : prev - 1
                            )
                          }
                          title="Previous pinned message"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentPinnedIndex((prev) =>
                              prev === pinnedMessages.length - 1 ? 0 : prev + 1
                            )
                          }
                          title="Next pinned message"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                    )}

                    {/* CHEVRON JUMP BUTTON */}
                    <button
                      type="button"
                      className="messages-pinned-banner-jump"
                      onClick={() =>
                        scrollToMessage(pinnedMessages[currentPinnedIndex].id)
                      }
                      title="Jump to message"
                      aria-label="Jump to pinned message"
                    >
                      <ChevronRight size={18} />
                    </button>

                    <button
                      type="button"
                      className="messages-pinned-banner-unpin"
                      onClick={() =>
                        void togglePinMessage(pinnedMessages[currentPinnedIndex])
                      }
                      title="Unpin message"
                      disabled={savingMessageAction}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* MESSAGES LIST */}
              <div className="messages-chat-body">
                {loadingMessages ? (
                  <CatererSkeleton variant="message-thread" label="Loading messages" />
                ) : chatError ? (
                  <div className="messages-state messages-error-state">
                    <p>{chatError}</p>
                    <button
                      onClick={() =>
                        void loadMessages(selectedConversation.bookingId)
                      }
                    >
                      <RefreshCw size={15} />
                      Try again
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="messages-state">
                    <MessageSquare size={32} />
                    <h3>Start a conversation</h3>
                    <p>Send a message or photo to this customer.</p>
                  </div>
                ) : (
                  <div className="messages-list">
                    {messages.map((message, index) => {
                      const isMine = message.sender_id === myId;
                      const previousMessage = messages[index - 1];

                      const currentDate = getDateLabel(message.created_at);
                      const previousDate = previousMessage
                        ? getDateLabel(previousMessage.created_at)
                        : '';

                      const showDate =
                        index === 0 || currentDate !== previousDate;

                      const reactionCounts = Object.entries(
                        message.reactions ?? {}
                      ).reduce<Record<string, number>>((counts, [, emoji]) => {
                        counts[emoji] = (counts[emoji] ?? 0) + 1;
                        return counts;
                      }, {});

                      const myReaction = message.reactions?.[myId];
                      const messageContent = message.content?.trim();

                      const showMessageText =
                        Boolean(messageContent) &&
                        !(message.image_url && messageContent === '📷 Photo');

                      return (
                        <div key={message.id}>
                          {showDate && (
                            <div className="messages-date-separator">
                              <span>{currentDate}</span>
                            </div>
                          )}

                          <div
                            id={`message-${message.id}`}
                            className={`messages-row ${
                              isMine ? 'messages-row-mine' : ''
                            }`}
                          >
                            <div className="messages-message-group">
                              <div className="messages-action-toolbar">
                                <div className="messages-reaction-container">
                                  <button
                                    type="button"
                                    title="React"
                                    onClick={() =>
                                      setReactionMessageId(
                                        reactionMessageId === message.id
                                          ? null
                                          : message.id
                                      )
                                    }
                                  >
                                    <Smile size={17} />
                                  </button>

                                  {reactionMessageId === message.id && (
                                    <div className="messages-reaction-picker-new">
                                      {REACTION_EMOJIS.map((emoji) => (
                                        <button
                                          type="button"
                                          key={emoji}
                                          onClick={() => {
                                            void toggleReaction(
                                              message,
                                              emoji
                                            );
                                            setReactionMessageId(null);
                                          }}
                                          disabled={
                                            reactionLoadingId === message.id
                                          }
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  title="Reply"
                                  onClick={() => startReply(message)}
                                >
                                  <Reply size={17} />
                                </button>

                                <div className="messages-more-container">
                                  <button
                                    type="button"
                                    title="More options"
                                    onClick={() =>
                                      setActiveMessageMenu(
                                        activeMessageMenu === message.id
                                          ? null
                                          : message.id
                                      )
                                    }
                                  >
                                    <MoreVertical size={18} />
                                  </button>

                                  {activeMessageMenu === message.id && (
                                    <div className="messages-more-menu">
                                      {isMine && (
                                        <button
                                          type="button"
                                          onClick={() => startEdit(message)}
                                        >
                                          <Pencil size={16} />
                                          Edit
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() =>
                                          void togglePinMessage(message)
                                        }
                                        disabled={savingMessageAction}
                                      >
                                        <Pin size={16} />
                                        {message.is_pinned ? 'Unpin' : 'Pin'}
                                      </button>

                                      {isMine && (
                                        <button
                                          type="button"
                                          className="messages-delete-action"
                                          onClick={() =>
                                            void deleteMessage(message)
                                          }
                                          disabled={savingMessageAction}
                                        >
                                          <Trash2 size={16} />
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* MESSAGE BUBBLE */}
                              <div
                                className={`messages-bubble ${
                                  isMine ? 'messages-bubble-mine' : ''
                                }`}
                              >
                                {message.reply_to && (() => {
                                  const originalMessage = messages.find(
                                    (item) => item.id === message.reply_to
                                  );

                                  if (!originalMessage) return null;

                                  return (
                                    <div className="messages-reply-reference">
                                      <strong>
                                        {originalMessage.sender_id === myId
                                          ? 'You'
                                          : selectedConversation.customerName}
                                      </strong>
                                      <span>
                                        {originalMessage.content || '📷 Photo'}
                                      </span>
                                    </div>
                                  );
                                })()}

                                {editingMessageId === message.id ? (
                                  <div className="messages-edit-box">
                                    <textarea
                                      value={editMessageInput}
                                      onChange={(event) =>
                                        setEditMessageInput(event.target.value)
                                      }
                                      maxLength={5000}
                                      autoFocus
                                    />

                                    <div className="messages-edit-actions">
                                      <button
                                        type="button"
                                        onClick={cancelEdit}
                                      >
                                        Cancel
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          void saveEditedMessage(message)
                                        }
                                        disabled={
                                          !editMessageInput.trim() ||
                                          savingMessageAction
                                        }
                                      >
                                        <Check size={15} />
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  showMessageText && (
                                    <p className="messages-text">
                                      {messageContent}
                                    </p>
                                  )
                                )}

                                {message.image_url && (
                                  <button
                                    type="button"
                                    className="messages-image-button"
                                    onClick={() =>
                                      setPreviewImage(message.image_url!)
                                    }
                                    aria-label="View attached image"
                                  >
                                    <img
                                      src={message.image_url}
                                      alt="Message attachment"
                                    />
                                  </button>
                                )}

                                {message.is_edited && (
                                  <span className="messages-edited-label">
                                    Edited
                                  </span>
                                )}

                                {message.is_pinned && (
                                  <span className="messages-pinned-label">
                                    <Pin size={12} />
                                    Pinned
                                  </span>
                                )}

                                {/* REACTIONS INSIDE BUBBLE */}
                                {Object.keys(reactionCounts).length > 0 && (
                                  <div
                                    className={`messages-reactions ${
                                      isMine
                                        ? 'messages-reactions-mine'
                                        : ''
                                    }`}
                                  >
                                    {Object.entries(reactionCounts).map(
                                      ([emoji, count]) => (
                                        <button
                                          type="button"
                                          key={emoji}
                                          className={
                                            myReaction === emoji
                                              ? 'messages-reaction active'
                                              : 'messages-reaction'
                                          }
                                          onClick={() =>
                                            void toggleReaction(
                                              message,
                                              emoji
                                            )
                                          }
                                          disabled={
                                            reactionLoadingId === message.id
                                          }
                                        >
                                          {emoji}
                                          {count > 1 && <small>{count}</small>}
                                        </button>
                                      )
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* TIMESTAMP AND STATUS */}
                              <div
                                className={`messages-message-meta ${
                                  isMine ? 'messages-message-meta-mine' : ''
                                }`}
                              >
                                <span>
                                  {formatMessageTime(message.created_at)}
                                </span>

                                {isMine && (
                                  <span className="messages-message-status">
                                    {message.is_read ? 'Seen' : 'Sent'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* ERROR */}
              {sendError && (
                <div className="messages-send-error">{sendError}</div>
              )}

              {/* IMAGE PREVIEW BEFORE SENDING */}
              {filePreview && (
                <div className="messages-attachment-preview">
                  <div className="messages-attachment-preview-image">
                    <img src={filePreview} alt="Selected attachment" />
                  </div>

                  <div className="messages-attachment-preview-info">
                    <strong>{selectedFile?.name}</strong>
                    <span>Ready to send</span>
                  </div>

                  <button
                    type="button"
                    onClick={removeSelectedFile}
                    aria-label="Remove selected image"
                    disabled={sending}
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              {replyingTo && (
                <div className="messages-reply-preview">
                  <div>
                    <strong>
                      Replying to{' '}
                      {replyingTo.sender_id === myId
                        ? 'yourself'
                        : selectedConversation.customerName}
                    </strong>
                    <p>{replyingTo.content || '📷 Photo'}</p>
                  </div>

                  <button
                    type="button"
                    onClick={cancelReply}
                    aria-label="Cancel reply"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              {/* COMPOSER */}
              <form className="messages-composer" onSubmit={sendMessage}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleFileSelection}
                />

                <button
                  type="button"
                  className="messages-attach-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  aria-label="Attach image"
                  title="Attach image"
                >
                  <Paperclip size={20} />
                </button>

                <div className="messages-emoji-container">
                  <button
                    type="button"
                    className="messages-emoji-button"
                    onClick={() =>
                      setShowEmojiPicker((current) => !current)
                    }
                    disabled={sending}
                    aria-label="Open emoji picker"
                    title="Add emoji"
                    aria-expanded={showEmojiPicker}
                  >
                    <Smile size={20} />
                  </button>

                  {showEmojiPicker && (
                    <div className="messages-emoji-picker">
                      <div className="messages-emoji-picker-header">
                        <strong>Choose an emoji</strong>
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(false)}
                          aria-label="Close emoji picker"
                        >
                          <X size={17} />
                        </button>
                      </div>

                      <div className="messages-emoji-categories">
                        {EMOJI_CATEGORIES.map((category) => (
                          <button
                            type="button"
                            key={category.name}
                            className={
                              activeEmojiCategory === category.name
                                ? 'active'
                                : ''
                            }
                            onClick={() =>
                              setActiveEmojiCategory(category.name)
                            }
                          >
                            {category.name}
                          </button>
                        ))}
                      </div>

                      <div className="messages-emoji-grid">
                        {activeEmojis.map((emoji, index) => (
                          <button
                            type="button"
                            key={`${emoji}-${index}`}
                            onClick={() => insertEmoji(emoji)}
                            aria-label={`Insert ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Type your message..."
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  disabled={sending}
                  maxLength={5000}
                />

                <button
                  type="submit"
                  disabled={
                    (!messageInput.trim() && !selectedFile) || sending
                  }
                  aria-label="Send message"
                >
                  {sending ? (
                    <Loader2 className="messages-spinner" size={19} />
                  ) : (
                    <Send size={19} />
                  )}
                  <span>
                    {uploading ? 'Uploading...' : 'Send'}
                  </span>
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {/* CUSTOMER PROFILE MODAL */}
      {showCustomerProfile && (
        <div
          className="messages-profile-modal-overlay"
          onClick={closeCustomerProfile}
          role="presentation"
        >
          <div
            className="messages-profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="messages-profile-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="messages-profile-modal-header">
              <h2 id="messages-profile-title">Customer Profile</h2>

              <button
                type="button"
                onClick={closeCustomerProfile}
                aria-label="Close customer profile"
              >
                <X size={21} />
              </button>
            </div>

            {loadingCustomerProfile ? (
              <CatererSkeleton variant="customer-profile" label="Loading customer profile" />
            ) : customerProfileError ? (
              <div className="messages-profile-error">
                <p>{customerProfileError}</p>
                <button
                  type="button"
                  onClick={() => void loadCustomerProfile()}
                >
                  <RefreshCw size={15} />
                  Try again
                </button>
              </div>
            ) : customerProfile ? (
              <div className="messages-profile-content">
                <div className="messages-profile-avatar">
                  {customerProfile.avatar_url ? (
                    <img
                      src={customerProfile.avatar_url}
                      alt={customerProfile.full_name || 'Customer'}
                    />
                  ) : (
                    <UserRound size={36} />
                  )}
                </div>

                <h3>
                  {customerProfile.full_name || 'Customer'}
                </h3>

                <div className="messages-profile-information">
                  <div className="messages-profile-item">
                    <Mail size={19} />
                    <div>
                      <span>Email Address</span>
                      <strong>
                        {customerProfile.email || 'Not provided'}
                      </strong>
                    </div>
                  </div>

                  <div className="messages-profile-item">
                    <Phone size={19} />
                    <div>
                      <span>Phone Number</span>
                      <strong>
                        {customerProfile.phone_number || 'Not provided'}
                      </strong>
                    </div>
                  </div>

                  <div className="messages-profile-item">
                    <MapPin size={19} />
                    <div>
                      <span>Address</span>
                      <strong>
                        {customerProfile.address || 'Not provided'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* FULL IMAGE PREVIEW */}
      {previewImage && (
        <div
          className="messages-image-modal"
          onClick={() => setPreviewImage('')}
          role="presentation"
        >
          <button
            type="button"
            className="messages-image-modal-close"
            onClick={() => setPreviewImage('')}
            aria-label="Close image preview"
          >
            <X size={24} />
          </button>

          <img
            src={previewImage}
            alt="Full message attachment"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
