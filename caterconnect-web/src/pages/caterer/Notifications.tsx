import { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  FileWarning,
  Inbox,
  LoaderCircle,
  MessageCircle,
  MessageSquareText,
  PartyPopper,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Wallet,
  XCircle,
  Clock3,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import CatererPageHeader from '../../components/CatererPageHeader';
import CatererSkeleton from '../../components/CatererSkeleton';
import './Notifications.css';

type NotificationType =
  | 'booking_submitted'
  | 'booking_approved'
  | 'booking_rejected'
  | 'payment_submitted'
  | 'payment_verified'
  | 'downpayment_paid'
  | 'booking_completed'
  | 'booking_cancelled'
  | 'package_customized'
  | 'new_booking_request'
  | 'new_message'
  | 'new_review'
  | 'subscription'
  | 'downpayment_deadline'
  | 'refund_transfer_submitted'
  | 'refund_dispute_opened'
  | 'refund_dispute_response'
  | 'refund_confirmed'
  | 'refund_overdue'
  | 'refund_dispute_submitted'
  | 'refund_dispute_responded'
  | 'refund_received'
  | 'account_flagged';

type CatererNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  booking_id: string | null;
  is_read: boolean;
  created_at: string;
};

const NOTIFICATION_APPEARANCE: Partial<Record<NotificationType, { icon: LucideIcon; color: string; background: string }>> = {
  booking_submitted: { icon: Clock3, color: '#2563EB', background: '#EFF6FF' },
  booking_approved: { icon: CheckCircle2, color: '#166534', background: '#DCFCE7' },
  booking_rejected: { icon: XCircle, color: '#DC2626', background: '#FEE2E2' },
  payment_submitted: { icon: CreditCard, color: '#D97706', background: '#FEF3C7' },
  downpayment_paid: { icon: ShieldCheck, color: '#166534', background: '#DCFCE7' },
  payment_verified: { icon: CheckCircle2, color: '#166534', background: '#DCFCE7' },
  booking_completed: { icon: PartyPopper, color: '#166534', background: '#DCFCE7' },
  booking_cancelled: { icon: XCircle, color: '#4B5563', background: '#F3F4F6' },
  package_customized: { icon: Sparkles, color: '#7C3AED', background: '#F5F3FF' },
  new_booking_request: { icon: Bell, color: '#D97706', background: '#FEF3C7' },
  new_message: { icon: MessageCircle, color: '#2563EB', background: '#EFF6FF' },
  new_review: { icon: Star, color: '#F59E0B', background: '#FEF3C7' },
  subscription: { icon: RefreshCw, color: '#7C3AED', background: '#F5F3FF' },
  downpayment_deadline: { icon: AlertTriangle, color: '#DC2626', background: '#FEE2E2' },
  refund_dispute_opened: { icon: FileWarning, color: '#D97706', background: '#FEF3C7' },
  refund_dispute_submitted: { icon: FileWarning, color: '#D97706', background: '#FEF3C7' },
  refund_dispute_response: { icon: MessageSquareText, color: '#2563EB', background: '#EFF6FF' },
  refund_dispute_responded: { icon: MessageSquareText, color: '#2563EB', background: '#EFF6FF' },
  refund_transfer_submitted: { icon: ReceiptText, color: '#2563EB', background: '#EFF6FF' },
  refund_confirmed: { icon: FileCheck2, color: '#166534', background: '#DCFCE7' },
  refund_received: { icon: Wallet, color: '#166534', background: '#DCFCE7' },
  refund_overdue: { icon: AlertTriangle, color: '#DC2626', background: '#FEE2E2' },
  account_flagged: { icon: ShieldAlert, color: '#DC2626', background: '#FEE2E2' },
};

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(date);
}

function formatNotificationType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CatererNotifications() {
  const { session, catererData } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user?.id;
  const [notifications, setNotifications] = useState<CatererNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async (showLoading = true) => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setError('');
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    setError('');

    try {
      const [listResult, unreadResult] = await Promise.all([
        supabase.from('notifications')
          .select('id,user_id,title,message,type,booking_id,is_read,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false),
      ]);
      if (listResult.error) throw listResult.error;
      if (unreadResult.error) throw unreadResult.error;
      setNotifications((listResult.data ?? []) as CatererNotification[]);
      setUnreadCount(unreadResult.count ?? 0);
    } catch (failure) {
      console.error('Failed to load caterer notifications:', failure);
      setError(failure instanceof Error ? failure.message : 'Unable to load notifications. Please try again.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const refreshFromRealtime = async () => {
      if (active) await loadNotifications(false);
    };
    void loadNotifications();

    const channel = supabase
      .channel(`caterer-notifications-page-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => void refreshFromRealtime())
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Caterer notifications subscription status:', status);
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, userId]);

  async function markNotificationRead(notification: CatererNotification) {
    if (!userId || notification.is_read) return;
    setError('');
    const { error: updateError } = await supabase.from('notifications')
      .update({ is_read: true })
      .eq('id', notification.id)
      .eq('user_id', userId);
    if (updateError) {
      setError(updateError.message || 'Unable to mark notification as read.');
      return;
    }
    setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
    setUnreadCount((count) => Math.max(0, count - 1));
  }

  async function markAllRead() {
    if (!userId || unreadCount === 0) return;
    setError('');
    const { error: updateError } = await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (updateError) {
      setError(updateError.message || 'Unable to mark notifications as read.');
      return;
    }
    setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
  }

  async function openNotification(notification: CatererNotification) {
    await markNotificationRead(notification);
    if (notification.type === 'account_flagged') return;
    if (notification.type === 'new_message') {
      const params = new URLSearchParams();
      if (notification.booking_id) {
        params.set('bookingId', notification.booking_id);
        if (catererData?.id) {
          const { data, error: bookingError } = await supabase.from('bookings')
            .select('customer_id')
            .eq('id', notification.booking_id)
            .eq('caterer_id', catererData.id)
            .maybeSingle();
          if (!bookingError && data?.customer_id) params.set('receiverId', data.customer_id);
        }
      }
      const search = params.toString();
      navigate(`/caterer/messages${search ? `?${search}` : ''}`);
    } else if (notification.type === 'subscription') {
      navigate('/caterer/profile');
    } else if (notification.booking_id || notification.type === 'new_review') {
      navigate('/caterer/bookings');
    }
  }

  async function refresh() {
    setRefreshing(true);
    await loadNotifications(false);
    setRefreshing(false);
  }

  return (
    <div className="caterer-notifications-page">
      <CatererPageHeader
        icon={<Bell size={25} />}
        title="Notifications"
        description="Bookings, payments, messages & account updates"
        action={(
          <div className="caterer-notifications-actions">
            {unreadCount > 0 && (
              <button type="button" className="notifications-mark-all" onClick={() => void markAllRead()}>
                <Check size={15} /> Mark all read
              </button>
            )}
            <button type="button" className="notifications-refresh" onClick={() => void refresh()} disabled={refreshing || loading} aria-label="Refresh notifications" title="Refresh notifications">
              {refreshing ? <LoaderCircle size={17} className="notifications-spin" /> : <RefreshCw size={17} />}
            </button>
          </div>
        )}
      />

      {unreadCount > 0 && (
        <div className="notifications-unread-banner">
          <AlertCircle size={16} />
          You have {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}.
        </div>
      )}

      {error && <div className="notifications-error" role="alert"><AlertCircle size={18} /><span>{error}</span><button type="button" onClick={() => void refresh()}>Try again</button></div>}

      {loading ? (
        <CatererSkeleton variant="notifications" label="Loading notifications" />
      ) : notifications.length === 0 ? (
        <div className="notifications-empty">
          <span><Inbox size={32} /></span>
          <h2>No notifications yet</h2>
          <p>Updates about bookings, downpayments, messages, subscriptions, and account activity will appear here.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => {
            const appearance = notification.title.trim().toLowerCase() === 'refund dispute update'
              ? { icon: MessageSquareText, color: '#2563EB', background: '#EFF6FF' }
              : NOTIFICATION_APPEARANCE[notification.type] ?? { icon: Bell, color: '#F97316', background: '#FFF7ED' };
            const Icon = appearance.icon;
            return (
              <button
                type="button"
                key={notification.id}
                className={`notification-card${notification.is_read ? '' : ' unread'}`}
                onClick={() => void openNotification(notification)}
              >
                <span className="notification-card-icon" style={{ color: appearance.color, backgroundColor: appearance.background }}><Icon size={20} /></span>
                <span className="notification-card-content">
                  <span className="notification-card-title-row">
                    <strong>{notification.title}</strong>
                    {!notification.is_read && <i aria-label="Unread" />}
                  </span>
                  <span className="notification-card-message">{notification.message}</span>
                  <span className="notification-card-meta">
                    <span>{formatNotificationType(notification.type)}</span>
                    <time dateTime={notification.created_at}>{formatNotificationDate(notification.created_at)}</time>
                  </span>
                </span>
                {!notification.is_read && <span className="notification-unread-label">Unread</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
