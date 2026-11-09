import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pencil,
  Pin,
  RefreshCw,
  Reply,
  Search,
  Send,
  Smile,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import CustomerHeader from "./CustomerHeader";
import "./CustomerMessages.css";

type MessageRow = {
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
type BookingRow = {
  id: string;
  customer_id: string;
  event_date: string | null;
  event_type: string | null;
  caterers: {
    business_name: string;
    logo_url: string | null;
    user_id: string;
  } | null;
};
type Conversation = {
  bookingId: string;
  catererId: string;
  catererName: string;
  logo: string | null;
  eventLabel: string;
  preview: string;
  time: string;
  unread: number;
  isMine: boolean;
};
const COLUMNS =
  "id,booking_id,sender_id,receiver_id,content,image_url,reactions,is_read,created_at,reply_to,is_edited,is_pinned,edited_at,pinned_at";
const REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🎉"];
const QUICK_QUESTIONS = [
  "What's included in my package?",
  "Are tables and chairs included?",
  "Can we discuss the event setup?",
  "What time will your team arrive?",
  "Can you accommodate special dietary requirements?",
  "Do you provide decorations and table setup?",
];
const EMOJI_CATEGORIES = {
  All: [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "😂",
    "🤣",
    "😊",
    "😍",
    "🥰",
    "😘",
    "😋",
    "😎",
    "🤩",
    "🥳",
    "😢",
    "😭",
    "😔",
    "😮",
    "😱",
    "😡",
    "🤔",
    "🙏",
    "👍",
    "👎",
    "👏",
    "🙌",
    "🤝",
    "💪",
    "👋",
    "👌",
    "❤️",
    "🧡",
    "💛",
    "💚",
    "💙",
    "💜",
    "💕",
    "💖",
    "🎉",
    "🎂",
    "🎈",
    "✨",
    "🔥",
    "💯",
  ],
  Smileys: [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "😂",
    "🤣",
    "😊",
    "😍",
    "🥰",
    "😘",
    "😋",
    "😎",
    "🤩",
    "🥳",
    "😢",
    "😭",
    "😔",
    "😮",
    "😱",
    "😡",
    "🤔",
    "😴",
  ],
  Gestures: [
    "👍",
    "👎",
    "👏",
    "🙌",
    "🤝",
    "💪",
    "👋",
    "👌",
    "✌️",
    "🤞",
    "🙏",
    "👊",
  ],
  Hearts: [
    "❤️",
    "🧡",
    "💛",
    "💚",
    "💙",
    "💜",
    "🖤",
    "🤍",
    "💕",
    "💖",
    "💗",
    "💝",
  ],
  Celebration: [
    "🎉",
    "🎊",
    "🎈",
    "🎁",
    "🎂",
    "🥳",
    "✨",
    "⭐",
    "🔥",
    "🏆",
    "🍰",
    "🎇",
  ],
} as const;
type EmojiCategory = keyof typeof EMOJI_CATEGORIES;

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : String(e ?? "Something went wrong");
const shortDate = (s: string) =>
  new Date(s).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
const clock = (s: string) =>
  new Date(s).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
const eventLabel = (type: string | null, date: string | null) =>
  `${type || "Event"}${date ? ` · ${shortDate(date + "T00:00:00")}` : ""}`;

export default function CustomerMessages() {
  const { session } = useAuth();
  const myId = session?.user.id ?? "";
  const [params] = useSearchParams();
  const requestedId = params.get("bookingId");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const openedRequestedRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inboxError, setInboxError] = useState("");
  const [chatError, setChatError] = useState("");
  const [actionError, setActionError] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [editing, setEditing] = useState<MessageRow | null>(null);
  const [editText, setEditText] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState<EmojiCategory>("All");
  const [quickQuestionsOpen, setQuickQuestionsOpen] = useState(false);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const composerInput = useRef<HTMLInputElement>(null);

  const [showBooking, setShowBooking] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const chatBottom = useRef<HTMLDivElement>(null);
  const [booking, setBooking] = useState<BookingRow | null>(null);

  const selected =
    conversations.find((c) => c.bookingId === selectedId) ?? null;
  const filtered = useMemo(
    () =>
      conversations.filter((c) =>
        `${c.catererName} ${c.eventLabel} ${c.preview}`
          .toLowerCase()
          .includes(search.toLowerCase().trim()),
      ),
    [conversations, search],
  );
  const pinned = useMemo(() => messages.filter((m) => m.is_pinned), [messages]);
  const unreadTotal = conversations.reduce((sum, c) => sum + c.unread, 0);
  const activePinned = pinned.length
    ? pinned[((pinnedIndex % pinned.length) + pinned.length) % pinned.length]
    : null;
  const jumpToMessage = (id: string) => {
    const target = document.getElementById(`cc-cm-message-${id}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (target) {
      target.classList.add("cc-cm-jump-highlight");
      window.setTimeout(
        () => target.classList.remove("cc-cm-jump-highlight"),
        1300,
      );
    }
  };

  const loadInbox = useCallback(
    async (showLoading = false) => {
      if (!myId) {
        setLoadingInbox(false);
        return;
      }
      if (showLoading) setLoadingInbox(true);
      try {
        setInboxError("");
        const { data, error } = await supabase
          .from("messages")
          .select(COLUMNS)
          .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const all = (data ?? []) as MessageRow[];
        const newest = new Map<string, MessageRow>();
        all.forEach((m) => {
          if (m.booking_id && !newest.has(m.booking_id))
            newest.set(m.booking_id, m);
        });
        const ids = [...newest.keys()];
        if (requestedId && !ids.includes(requestedId)) ids.push(requestedId);
        if (!ids.length) {
          setConversations([]);
          return;
        }
        const { data: rows, error: bookingErr } = await supabase
          .from("bookings")
          .select(
            "id,customer_id,event_date,event_type,caterers(business_name,logo_url,user_id)",
          )
          .in("id", ids)
          .eq("customer_id", myId);
        if (bookingErr) throw bookingErr;
        const valid = (rows ?? []) as unknown as BookingRow[];
        const entries = valid
          .filter((b) => !!b.caterers?.user_id)
          .map((b) => {
            const m = newest.get(b.id);
            return {
              bookingId: b.id,
              catererId: b.caterers!.user_id,
              catererName: b.caterers!.business_name,
              logo: b.caterers!.logo_url,
              eventLabel: eventLabel(b.event_type, b.event_date),
              preview: m
                ? m.content || (m.image_url ? "📷 Photo" : "New message")
                : "Start a conversation",
              time: m?.created_at ?? "",
              isMine: m?.sender_id === myId,
              unread: all.filter(
                (x) =>
                  x.booking_id === b.id && x.receiver_id === myId && !x.is_read,
              ).length,
            } as Conversation;
          });
        entries.sort((a, b) => (b.time || "").localeCompare(a.time || ""));
        setConversations(entries);
      } catch (e) {
        setInboxError(errorText(e));
      } finally {
        setLoadingInbox(false);
      }
    },
    [myId, requestedId],
  );

  const loadChat = useCallback(
    async (bookingId: string, spin = true) => {
      if (!myId) return;
      if (spin) setLoadingChat(true);
      try {
        setChatError("");
        const { data, error } = await supabase
          .from("messages")
          .select(COLUMNS)
          .eq("booking_id", bookingId)
          .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (selectedIdRef.current !== bookingId) return;
        const rows = (data ?? []) as MessageRow[];
        setMessages(rows);
        const unreadIds = rows
          .filter((m) => m.receiver_id === myId && !m.is_read)
          .map((m) => m.id);
        if (unreadIds.length) {
          const { error: readError } = await supabase
            .from("messages")
            .update({ is_read: true })
            .eq("booking_id", bookingId)
            .eq("receiver_id", myId)
            .in("id", unreadIds);
          if (readError)
            console.warn("Unable to mark messages as read", readError);
          else
            setConversations((cs) =>
              cs.map((c) =>
                c.bookingId === bookingId ? { ...c, unread: 0 } : c,
              ),
            );
        }
      } catch (e) {
        setChatError(errorText(e));
      } finally {
        if (spin) setLoadingChat(false);
      }
    },
    [myId],
  );

  const openConversation = useCallback(
    (id: string) => {
      selectedIdRef.current = id;
      setSelectedId(id);
      setMessages([]);
      setChatError("");
      setActionError("");
      setReplyTo(null);
      setEditing(null);
      setDraft("");
      setAttachment(null);
      setMenuId(null);
      setShowBooking(false);
      setEmojiOpen(false);
      setReactionTarget(null);
      setPinnedIndex(0);
      void loadChat(id);
    },
    [loadChat],
  );

  useEffect(() => {
    void loadInbox(true);
  }, [loadInbox]);
  useEffect(() => {
    if (
      requestedId &&
      openedRequestedRef.current !== requestedId &&
      conversations.some((c) => c.bookingId === requestedId)
    ) {
      openedRequestedRef.current = requestedId;
      openConversation(requestedId);
    }
  }, [conversations, requestedId, openConversation]);
  useEffect(() => {
    if (!selectedId || !myId) {
      setBooking(null);
      return;
    }
    let active = true;
    void supabase
      .from("bookings")
      .select(
        "id,customer_id,event_date,event_type,caterers(business_name,logo_url,user_id)",
      )
      .eq("id", selectedId)
      .eq("customer_id", myId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setBooking(data as unknown as BookingRow | null);
      });
    return () => {
      active = false;
    };
  }, [selectedId, myId]);
  useEffect(() => {
    chatBottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, selectedId]);
  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`customer-messages:${myId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${myId}`,
        },
        () => {
          void loadInbox();
          if (selectedIdRef.current)
            void loadChat(selectedIdRef.current, false);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${myId}`,
        },
        () => {
          void loadInbox();
          if (selectedIdRef.current)
            void loadChat(selectedIdRef.current, false);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId, loadInbox, loadChat]);
  // Periodic refresh is a fallback when realtime is unavailable or restricted.
  useEffect(() => {
    if (!myId) return;
    const timer = window.setInterval(() => {
      void loadInbox();
      if (selectedIdRef.current) void loadChat(selectedIdRef.current, false);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [myId, loadInbox, loadChat]);

  const chooseFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        file.type,
      ) ||
      file.size > 5 * 1024 * 1024
    ) {
      setActionError("Choose a JPG, PNG, WebP, or GIF image up to 5 MB.");
      e.target.value = "";
      return;
    }
    setAttachment(file);
    setActionError("");
  };
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || busy || (!draft.trim() && !attachment)) return;
    setBusy(true);
    setActionError("");
    try {
      let imageUrl: string | null = null;
      if (attachment) {
        const rawExt = attachment.name.split(".").pop()?.toLowerCase() || "jpg";
        const ext = ["jpg", "jpeg", "png", "webp", "gif"].includes(rawExt)
          ? rawExt
          : "jpg";
        const path = `${myId}/${selected.bookingId}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("chat-attachments")
          .upload(path, attachment, {
            contentType: attachment.type,
            upsert: false,
          });
        if (upErr) throw upErr;
        imageUrl = supabase.storage.from("chat-attachments").getPublicUrl(path)
          .data.publicUrl;
      }
      const { error } = await supabase.from("messages").insert({
        booking_id: selected.bookingId,
        sender_id: myId,
        receiver_id: selected.catererId,
        content: draft.trim() || (imageUrl ? "📷 Photo" : ""),
        image_url: imageUrl,
        reactions: {},
        is_read: false,
        reply_to: replyTo?.id ?? null,
      });
      if (error) throw error;
      setDraft("");
      setReplyTo(null);
      setAttachment(null);
      if (fileInput.current) fileInput.current.value = "";
      await loadChat(selected.bookingId, false);
      await loadInbox();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const editMessage = async () => {
    if (
      !selected ||
      !editing ||
      !editText.trim() ||
      busy ||
      editing.sender_id !== myId
    )
      return;
    setBusy(true);
    setActionError("");
    try {
      const { error } = await supabase
        .from("messages")
        .update({
          content: editText.trim(),
          is_edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq("id", editing.id)
        .eq("booking_id", selected.bookingId)
        .eq("sender_id", myId);
      if (error) throw error;
      setEditing(null);
      await loadChat(selected.bookingId, false);
      await loadInbox();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const deleteMessage = async (message: MessageRow) => {
    if (
      !selected ||
      message.sender_id !== myId ||
      busy ||
      !window.confirm("Delete this message?")
    )
      return;
    setBusy(true);
    setActionError("");
    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", message.id)
        .eq("booking_id", selected.bookingId)
        .eq("sender_id", myId);
      if (error) throw error;
      setMenuId(null);
      await loadChat(selected.bookingId, false);
      await loadInbox();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const setPin = async (message: MessageRow) => {
    if (!selected || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const next = !message.is_pinned;
      const { error } = await supabase
        .from("messages")
        .update({
          is_pinned: next,
          pinned_at: next ? new Date().toISOString() : null,
        })
        .eq("id", message.id)
        .eq("booking_id", selected.bookingId)
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`);
      if (error) throw error;
      setMenuId(null);
      await loadChat(selected.bookingId, false);
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const react = async (message: MessageRow, emoji: string) => {
    if (!selected || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const reactions = { ...(message.reactions ?? {}) };
      if (reactions[myId] === emoji) delete reactions[myId];
      else reactions[myId] = emoji;
      const { error } = await supabase
        .from("messages")
        .update({ reactions })
        .eq("id", message.id)
        .eq("booking_id", selected.bookingId)
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`);
      if (error) throw error;
      setMenuId(null);
      await loadChat(selected.bookingId, false);
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cc-customer-messages-page">
      <CustomerHeader activePage="messages" />
      <main className="cc-customer-messages-main">
        <div className="cc-cm-heading">
          <div>
            <span className="cc-cm-eyebrow">CUSTOMER MESSAGES</span>
            <h1>Messages</h1>
            <p>Chat with your caterers about your bookings.</p>
          </div>
          <div className="cc-cm-heading-actions">
            {unreadTotal > 0 && (
              <span className="cc-cm-unread-total">{unreadTotal} unread</span>
            )}
            <button
              type="button"
              aria-label="Refresh conversations"
              title="Refresh conversations"
              onClick={() => void loadInbox(true)}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
        <div className="cc-cm-workspace">
          <aside
            className={`cc-cm-inbox ${selectedId ? "cc-cm-hide-mobile" : ""}`}
          >
            <div className="cc-cm-inbox-heading">
              <strong>Conversations</strong>
              <small>{conversations.length} chats</small>
            </div>
            <label className="cc-cm-search">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                aria-label="Search conversations"
              />
            </label>
            <div className="cc-cm-conversations">
              {loadingInbox ? (
                <div className="cc-cm-state">
                  <Loader2 className="cc-cm-spin" size={25} />
                  Loading conversations...
                </div>
              ) : inboxError ? (
                <div className="cc-cm-state error">
                  {inboxError}
                  <button onClick={() => void loadInbox(true)}>
                    Try again
                  </button>
                </div>
              ) : !filtered.length ? (
                <div className="cc-cm-state">
                  <MessageSquare size={35} />
                  <h3>
                    {search
                      ? "No matching conversations"
                      : "No conversations yet"}
                  </h3>
                  <p>
                    {search
                      ? "Try another search."
                      : "Conversations appear here after messages are exchanged. You can also open a chat from a booking when that feature is available."}
                  </p>
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    type="button"
                    key={c.bookingId}
                    onClick={() => openConversation(c.bookingId)}
                    className={`cc-cm-conversation ${c.bookingId === selectedId ? "active" : ""}`}
                  >
                    <span className="cc-cm-avatar">
                      {c.logo ? (
                        <img src={c.logo} alt="" />
                      ) : (
                        <Store size={23} />
                      )}
                    </span>
                    <span className="cc-cm-conversation-info">
                      <span className="cc-cm-conversation-top">
                        <strong>{c.catererName}</strong>
                        <small>{c.time ? shortDate(c.time) : ""}</small>
                      </span>
                      <span className="cc-cm-event">{c.eventLabel}</span>
                      <span className="cc-cm-preview">
                        {c.isMine ? "You: " : ""}
                        {c.preview}
                      </span>
                    </span>
                    {c.unread > 0 && (
                      <span className="cc-cm-bubble-count">{c.unread}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </aside>
          <section
            className={`cc-cm-chat ${selectedId ? "cc-cm-chat-open" : ""}`}
          >
            {!selected ? (
              <div className="cc-cm-chat-empty">
                <span>
                  <MessageSquare size={38} />
                </span>
                <h2>Select a conversation</h2>
                <p>Choose a caterer conversation to view your messages.</p>
              </div>
            ) : (
              <>
                <div className="cc-cm-chat-heading">
                  <button
                    type="button"
                    className="cc-cm-back"
                    aria-label="Back to conversations"
                    onClick={() => {
                      selectedIdRef.current = null;
                      setSelectedId(null);
                    }}
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <span className="cc-cm-avatar">
                    {selected.logo ? (
                      <img src={selected.logo} alt="" />
                    ) : (
                      <Store size={21} />
                    )}
                  </span>
                  <div>
                    <h2>{selected.catererName}</h2>
                    <p>{selected.eventLabel}</p>
                  </div>
                </div>
                <div className="cc-cm-booking">
                  <button
                    type="button"
                    onClick={() => setShowBooking(!showBooking)}
                    aria-expanded={showBooking}
                  >
                    <span>
                      <CalendarDays size={17} /> Booking details
                    </span>
                    {showBooking ? (
                      <ChevronUp size={17} />
                    ) : (
                      <ChevronDown size={17} />
                    )}
                  </button>
                  {showBooking && (
                    <div className="cc-cm-booking-info">
                      <strong>{booking?.event_type || "Event"}</strong>
                      <span>{booking?.event_date || "Date not specified"}</span>
                      <span>Booking reference: {selected.bookingId}</span>
                    </div>
                  )}
                </div>
                {activePinned && (
                  <div className="cc-cm-pinned cc-cm-pinned-jump">
                    <Pin size={17} />
                    <button
                      type="button"
                      onClick={() => jumpToMessage(activePinned.id)}
                      title="Jump to pinned message"
                    >
                      <strong>
                        Pinned Message{" "}
                        {pinned.length > 1
                          ? `(${(pinnedIndex % pinned.length) + 1}/${pinned.length})`
                          : ""}
                      </strong>
                      <span>{activePinned.content || "📷 Photo"}</span>
                    </button>
                    {pinned.length > 1 && (
                      <button
                        type="button"
                        className="cc-cm-pinned-next"
                        onClick={() => setPinnedIndex((i) => i + 1)}
                        aria-label="Next pinned message"
                      >
                        Next
                      </button>
                    )}
                    <button
                      type="button"
                      className="cc-cm-pinned-jump-action"
                      onClick={() => jumpToMessage(activePinned.id)}
                    >
                      Jump
                    </button>
                  </div>
                )}
                <div className="cc-cm-chat-scroll">
                  {loadingChat ? (
                    <div className="cc-cm-state">
                      <Loader2 className="cc-cm-spin" size={24} />
                      Loading messages...
                    </div>
                  ) : chatError ? (
                    <div className="cc-cm-state error">
                      {chatError}
                      <button onClick={() => void loadChat(selected.bookingId)}>
                        Retry
                      </button>
                    </div>
                  ) : !messages.length ? (
                    <div className="cc-cm-state">
                      <MessageSquare size={30} />
                      <h3>Start the conversation</h3>
                      <p>Send a message about your catering booking.</p>
                    </div>
                  ) : (
                    <div className="cc-cm-message-list">
                      {messages.map((m) => {
                        const mine = m.sender_id === myId;
                        const parent = m.reply_to
                          ? messages.find((x) => x.id === m.reply_to)
                          : null;
                        return (
                          <div
                            key={m.id}
                            id={`cc-cm-message-${m.id}`}
                            className={`cc-cm-message-row ${mine ? "mine" : ""}`}
                          >
                            <div className="cc-cm-message-group">
                              <div className="cc-cm-bubble-wrap">
                                <div
                                  className={`cc-cm-message-bubble ${mine ? "mine" : ""}`}
                                >
                                  {parent && (
                                    <div className="cc-cm-reply-reference">
                                      ↪ {parent.content || "Photo"}
                                    </div>
                                  )}
                                  {m.image_url && (
                                    <button
                                      className="cc-cm-image"
                                      type="button"
                                      onClick={() =>
                                        setImagePreview(m.image_url)
                                      }
                                    >
                                      <img
                                        src={m.image_url}
                                        alt="Chat attachment"
                                      />
                                    </button>
                                  )}
                                  {m.content && <p>{m.content}</p>}
                                </div>
                                {m.reactions &&
                                  Object.keys(m.reactions).length > 0 && (
                                    <div className="cc-cm-reactions">
                                      {Object.entries(m.reactions).map(
                                        ([id, emoji]) => (
                                          <span key={id}>{emoji}</span>
                                        ),
                                      )}
                                    </div>
                                  )}
                              </div>
                              <div
                                className="cc-cm-hover-actions"
                                role="group"
                                aria-label="Message actions"
                              >
                                {mine && (
                                  <button
                                    type="button"
                                    title="More actions"
                                    aria-label="More message actions"
                                    aria-expanded={menuId === m.id}
                                    onClick={() => {
                                      setMenuId(menuId === m.id ? null : m.id);
                                      setReactionTarget(null);
                                    }}
                                  >
                                    <MoreVertical size={17} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  title="Reply"
                                  aria-label="Reply to message"
                                  onClick={() => {
                                    setReplyTo(m);
                                    setMenuId(null);
                                    setReactionTarget(null);
                                    composerInput.current?.focus();
                                  }}
                                >
                                  <Reply size={17} />
                                </button>
                                <button
                                  type="button"
                                  title="React"
                                  aria-label="React to message"
                                  aria-expanded={reactionTarget === m.id}
                                  onClick={() => {
                                    setReactionTarget(
                                      reactionTarget === m.id ? null : m.id,
                                    );
                                    setMenuId(null);
                                  }}
                                >
                                  <Smile size={17} />
                                </button>
                                {!mine && (
                                  <button
                                    type="button"
                                    title="More actions"
                                    aria-label="More message actions"
                                    aria-expanded={menuId === m.id}
                                    onClick={() => {
                                      setMenuId(menuId === m.id ? null : m.id);
                                      setReactionTarget(null);
                                    }}
                                  >
                                    <MoreVertical size={17} />
                                  </button>
                                )}
                              </div>
                              {reactionTarget === m.id && (
                                <div
                                  className="cc-cm-react-picker"
                                  role="group"
                                  aria-label="Choose a reaction"
                                >
                                  {REACTIONS.map((emoji) => (
                                    <button
                                      type="button"
                                      key={emoji}
                                      title={`React ${emoji}`}
                                      disabled={busy}
                                      onClick={() => {
                                        setReactionTarget(null);
                                        void react(m, emoji);
                                      }}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="cc-cm-message-meta">
                                {m.is_pinned && <Pin size={12} />}{" "}
                                {clock(m.created_at)}{" "}
                                {m.is_edited && "· edited"}{" "}
                                {mine && m.is_read && "· seen"}
                              </div>
                              {menuId === m.id && (
                                <div className="cc-cm-menu">
                                  <button
                                    type="button"
                                    onClick={() => void setPin(m)}
                                    disabled={busy}
                                  >
                                    <Pin size={15} />
                                    {m.is_pinned ? "Unpin" : "Pin"}
                                  </button>
                                  {mine && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditing(m);
                                          setEditText(m.content);
                                          setMenuId(null);
                                        }}
                                      >
                                        <Pencil size={15} /> Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void deleteMessage(m)}
                                        disabled={busy}
                                      >
                                        <Trash2 size={15} /> Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                              {editing?.id === m.id && (
                                <div className="cc-cm-edit">
                                  <textarea
                                    value={editText}
                                    onChange={(e) =>
                                      setEditText(e.target.value)
                                    }
                                  />
                                  <div>
                                    <button onClick={() => setEditing(null)}>
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => void editMessage()}
                                      disabled={!editText.trim() || busy}
                                    >
                                      <Check size={15} /> Save
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatBottom} />
                    </div>
                  )}
                </div>
                {actionError && (
                  <div className="cc-cm-error" role="alert">
                    {actionError}
                  </div>
                )}
                <div className="cc-cm-quick">
                  <button
                    className="cc-cm-quick-toggle"
                    type="button"
                    onClick={() => setQuickQuestionsOpen((v) => !v)}
                    aria-expanded={quickQuestionsOpen}
                  >
                    <span>
                      <MessageSquare size={15} /> Quick Questions
                    </span>
                    <span>
                      {quickQuestionsOpen ? "Hide" : "Tap to draft"}{" "}
                      {quickQuestionsOpen ? (
                        <ChevronUp size={15} />
                      ) : (
                        <ChevronDown size={15} />
                      )}
                    </span>
                  </button>
                  {quickQuestionsOpen && (
                    <div className="cc-cm-quick-list">
                      {QUICK_QUESTIONS.map((question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => {
                            setDraft(question);
                            composerInput.current?.focus();
                          }}
                          title={question}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {replyTo && (
                  <div className="cc-cm-composer-preview">
                    <div>
                      <strong>Replying to message</strong>
                      <span>{replyTo.content || "Photo"}</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Cancel reply"
                      onClick={() => setReplyTo(null)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
                {attachment && (
                  <div className="cc-cm-composer-preview">
                    <div>
                      <strong>Selected image</strong>
                      <span>{attachment.name}</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() => {
                        setAttachment(null);
                        if (fileInput.current) fileInput.current.value = "";
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
                <form className="cc-cm-composer" onSubmit={send}>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    hidden
                    onChange={chooseFile}
                  />
                  <button
                    type="button"
                    title="Attach image"
                    aria-label="Attach image"
                    onClick={() => fileInput.current?.click()}
                    disabled={busy}
                  >
                    <ImagePlus size={21} />
                  </button>
                  <div className="cc-cm-emoji-wrap">
                    <button
                      type="button"
                      title="Insert emoji"
                      aria-label="Insert emoji"
                      onClick={() => setEmojiOpen(!emojiOpen)}
                    >
                      <Smile size={21} />
                    </button>
                    {emojiOpen && (
                      <div
                        className="cc-cm-emoji-popover"
                        role="group"
                        aria-label="Choose an emoji"
                      >
                        <div className="cc-cm-emoji-head">
                          <strong>
                            <Smile size={17} /> Choose an emoji
                          </strong>
                          <button
                            type="button"
                            onClick={() => setEmojiOpen(false)}
                            aria-label="Close emoji picker"
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="cc-cm-emoji-tabs">
                          {(
                            Object.keys(EMOJI_CATEGORIES) as EmojiCategory[]
                          ).map((category) => (
                            <button
                              type="button"
                              key={category}
                              className={
                                emojiCategory === category ? "active" : ""
                              }
                              onClick={() => setEmojiCategory(category)}
                            >
                              {category}
                            </button>
                          ))}
                        </div>
                        <div className="cc-cm-emoji-grid">
                          {EMOJI_CATEGORIES[emojiCategory].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              aria-label={`Insert ${emoji}`}
                              onClick={() => {
                                setDraft((value) => value + emoji);
                                composerInput.current?.focus();
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    ref={composerInput}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type your message..."
                    aria-label="Type a message"
                    disabled={busy}
                    maxLength={5000}
                  />
                  <button
                    className="cc-cm-send"
                    type="submit"
                    aria-label="Send message"
                    disabled={busy || (!draft.trim() && !attachment)}
                  >
                    {busy ? (
                      <Loader2 className="cc-cm-spin" size={19} />
                    ) : (
                      <Send size={19} />
                    )}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
        <p className="cc-cm-footer-note">
          Messages are linked to your catering bookings.{" "}
          <Link to="/customer">Browse caterers</Link>
        </p>
      </main>
      {imagePreview && (
        <div
          className="cc-cm-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Chat image preview"
          onClick={() => setImagePreview(null)}
        >
          <button type="button" aria-label="Close image preview">
            <X size={24} />
          </button>
          <img
            onClick={(e) => e.stopPropagation()}
            src={imagePreview}
            alt="Full-size chat attachment"
          />
        </div>
      )}
    </div>
  );
}
