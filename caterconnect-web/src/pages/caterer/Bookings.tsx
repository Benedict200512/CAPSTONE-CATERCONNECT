import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  CalendarRange,
  Search,
  RefreshCw,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  ChevronRight,
  Users,
  MapPin,
  Star,
  ExternalLink,
  CreditCard,
  MessageSquare,
  Wallet,
  Package,
  Utensils,
  Hash,
  Upload,
  Phone,
  Mail,
  FileText,
  Image as ImageIcon,
  Send,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import CatererSkeleton from '../../components/CatererSkeleton';
import CatererPageHeader from '../../components/CatererPageHeader';
import { supabase } from '../../lib/supabase';
import { isMonthlyQuotaRejection, loadMonthlyBookingQuota, type MonthlyQuota } from '../../lib/monthBookingQouta';
import { useNavigate } from 'react-router-dom';

import './Bookings.css';

type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'ongoing'
  | 'completed'
  | 'cancelled'
  | 'rejected';

type BookingFilter = 'all' | BookingStatus;
type BookingAction = 'confirm' | 'reject' | 'ongoing' | 'complete';

const CATERER_CANCEL_REASONS = [
  'Equipment or kitchen failure',
  'Staffing emergency',
  'Personal/Family emergency',
  'Event location/logistics issue',
  'Other',
];

type CustomerProfile = {
  full_name: string | null;
  email?: string | null;
  avatar_url?: string | null;
  phone_number?: string | null;
};

type BookingPackage = {
  name: string | null;
  tier?: string | null;
};

type BookingReview = {
  id: string;
  food_quality: number | null;
  service_quality: number | null;
  timeliness: number | null;
  overall: number | null;
  comment: string | null;
  caterer_reply: string | null;
  caterer_replied_at: string | null;
  created_at: string;
};

type CustomizedItem = {
  name?: string | null;
  quantity?: number | null;
  menu_item_id?: string | null;
  price_per_guest?: number | null;
};

type RefundAccountDetails = {
  method?: string;
  account_holder?: string;
  account_number?: string;
  bank_name?: string;
};

type RefundDisputeStatus = 'open' | 'investigating' | 'resolved';

type RefundDispute = {
  id: string;
  booking_id: string;
  customer_id: string;
  reason: string;
  status: RefundDisputeStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  caterer_response: string | null;
  caterer_responded_at: string | null;
  staff_note: string | null;
  staff_reviewed_at: string | null;
};

type RefundTransferSubmission = {
  booking_id: string;
  transfer_reference: string;
  proof_path: string;
  status: 'submitted' | 'verified' | 'rejected';
  submitted_at: string;
  review_note: string | null;
  submitted_late: boolean | null;
};

type Booking = {
  id: string;
  customer_id: string;
  caterer_id: string;
  package_id: string;
  status: BookingStatus;
  event_date: string;
  event_time: string | null;
  event_type: string | null;
  guest_count: number;
  total_cost: number;
  downpayment_amount: number | null;
  downpayment_deadline: string | null;
  venue: string | null;
  special_requests: string | null;
  caterer_notes: string | null;
  customized_items: unknown;
  payment_method: string | null;
  payment_receipt_url: string | null;
  payment_reference: string | null;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
  rejection_reason: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  refund_status: string | null;
  refund_amount: number | null;
  refund_due_at: string | null;
  refunded_at: string | null;
  refund_account_details: string | null;
  created_at: string;
  customer: CustomerProfile | null;
  packages: BookingPackage | null;
  reviews: BookingReview[] | null;
};

const FILTERS: { label: string; value: BookingFilter }[] = [
  { label: 'All Bookings', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Paid', value: 'paid' },
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Rejected', value: 'rejected' },
];

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'pending',
  confirmed: 'confirmed',
  paid: 'paid',
  ongoing: 'ongoing',
  completed: 'completed',
  cancelled: 'cancelled',
  rejected: 'rejected',
};

const MAX_REFUND_PROOF_SIZE = 10 * 1024 * 1024;

const ALLOWED_REFUND_PROOF_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value ?? 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not specified';

  const datePart = value.substring(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);

  if (!match) return 'Not specified';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return 'Not specified';
  }

  return date.toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(value: string | null | undefined) {
  if (!value?.trim()) return 'Not specified';
  return value.trim();
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not recorded';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Not recorded';

  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function getPaymentMethodLabel(value: string | null | undefined) {
  if (!value) return 'Not recorded';

  const method = value.toLowerCase().trim();

  const labels: Record<string, string> = {
    gcash: 'GCash',
    maya: 'Maya',
    card: 'Credit / Debit Card',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
    bank_transfer: 'Bank Transfer',
    online_banking: 'Online Banking',
    ewallet: 'E-Wallet',
    e_wallet: 'E-Wallet',
    bpi: 'BPI',
    bdo: 'BDO',
    other_bank: 'Other Bank',
  };

  return labels[method] ?? value;
}

function getVenueMapUrl(venue: string | null | undefined) {
  if (!venue?.trim()) return null;

  const coordinateMatch = venue.match(
    /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/
  );

  if (coordinateMatch) {
    const latitude = Number(coordinateMatch[1]);
    const longitude = Number(coordinateMatch[2]);

    if (
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      return `https://www.google.com/maps?q=${latitude},${longitude}`;
    }
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    venue
  )}`;
}

function getPaymentStatus(booking: Booking) {
  if (booking.payment_verified_at) return 'Verified';
  if (booking.payment_submitted_at) return 'Submitted';
  return 'No payment submission recorded';
}

function getStatusLabel(status: BookingStatus) {
  return status.replace('_', ' ');
}

function getDisputeStatusLabel(status: RefundDisputeStatus) {
  switch (status) {
    case 'open':
      return 'Open';
    case 'investigating':
      return 'Under Investigation';
    case 'resolved':
      return 'Resolved';
    default:
      return status;
  }
}

function getCustomizedItems(value: unknown): CustomizedItem[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is CustomizedItem =>
      typeof item === 'object' && item !== null && !Array.isArray(item)
  );
}

function getRefundAccountDetails(
  value: string | null
): RefundAccountDetails | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as RefundAccountDetails;
  } catch {
    return null;
  }
}

function maskAccountNumber(value: string | undefined) {
  if (!value?.trim()) return 'Not provided';
  return value.trim();
}

function getFileExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension && /^[a-z0-9]+$/.test(extension)) {
    return extension;
  }

  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };

  return extensions[file.type] ?? 'file';
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (!(error instanceof Error)) {
    return 'Unable to submit refund proof. Please try again.';
  }

  const context = (error as Error & { context?: unknown }).context;

  if (context instanceof Response) {
    try {
      const responseText = await context.clone().text();

      if (responseText) {
        try {
          const responseData = JSON.parse(responseText);

          return (
            responseData.error ||
            responseData.message ||
            responseData.details ||
            responseText
          );
        } catch {
          return responseText;
        }
      }
    } catch {
      // Use the original error message.
    }
  }

  return error.message || 'Unable to submit refund proof. Please try again.';
}

export default function CatererBookings() {
  const { catererData, session } = useAuth();
  const catererId = catererData?.id;
  const userId = session?.user.id;


const navigate = useNavigate();

const openClientChatroom = (booking: Booking) => {
  const params = new URLSearchParams({
    bookingId: booking.id,
    receiverId: booking.customer_id,
  });

  navigate(`/caterer/messages?${params.toString()}`);
};


  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refundDisputes, setRefundDisputes] = useState<RefundDispute[]>([]);
  const [refundSubmissions, setRefundSubmissions] = useState<Record<string, RefundTransferSubmission>>({});
  const [refundSubmissionError, setRefundSubmissionError] = useState('');
  const [monthlyQuota, setMonthlyQuota] = useState<MonthlyQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaRefreshKey, setQuotaRefreshKey] = useState(0);
  const [clockNow, setClockNow] = useState(Date.now());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState<BookingFilter>('all');
  const [showDisputes, setShowDisputes] = useState(false);
  const [disputeFilter, setDisputeFilter] = useState<RefundDisputeStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const [selectedBooking, setSelectedBooking] =
    useState<Booking | null>(null);

  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // INTERNAL NOTES
  const [internalNote, setInternalNote] = useState('');
  const [savingInternalNote, setSavingInternalNote] = useState(false);
  const [internalNoteMessage, setInternalNoteMessage] = useState('');
  const [internalNoteError, setInternalNoteError] = useState('');

  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [showEmergencyCancelForm, setShowEmergencyCancelForm] =
    useState(false);
  const [emergencyCancelReason, setEmergencyCancelReason] = useState('');
  const [emergencyCancelCustomReason, setEmergencyCancelCustomReason] =
    useState('');

  const [refundProofFile, setRefundProofFile] = useState<File | null>(null);
  const [refundTransferReference, setRefundTransferReference] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundMessage, setRefundMessage] = useState('');
  const [refundError, setRefundError] = useState('');

  const [disputeResponse, setDisputeResponse] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeMessage, setDisputeMessage] = useState('');
  const [disputeError, setDisputeError] = useState('');

  const refundFileInputRef = useRef<HTMLInputElement>(null);

  const resetRefundForm = () => {
    setRefundProofFile(null);
    setRefundTransferReference('');
    setRefundMessage('');
    setRefundError('');

    if (refundFileInputRef.current) {
      refundFileInputRef.current.value = '';
    }
  };

  const resetDisputeForm = () => {
    setDisputeResponse('');
    setDisputeMessage('');
    setDisputeError('');
  };

  const resetActionForms = () => {
    setShowRejectForm(false);
    setRejectionReason('');
    setShowEmergencyCancelForm(false);
    setEmergencyCancelReason('');
    setEmergencyCancelCustomReason('');
  };

  const closeBookingDetails = () => {
    if (
      actionLoading ||
      refundSubmitting ||
      disputeSubmitting ||
      savingInternalNote
    ) {
      return;
    }

    setSelectedBooking(null);
    setInternalNote('');
    setInternalNoteMessage('');
    setInternalNoteError('');
    resetActionForms();
    resetRefundForm();
    resetDisputeForm();
    setActionMessage('');
    setError('');
  };

  const loadBookings = useCallback(async () => {
    if (!catererId) {
      setBookings([]);
      setRefundDisputes([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('bookings')
        .select(`
          id,
          customer_id,
          caterer_id,
          package_id,
          status,
          event_date,
          event_time,
          event_type,
          guest_count,
          total_cost,
          downpayment_amount,
          downpayment_deadline,
          venue,
          special_requests,
          caterer_notes,
          customized_items,
          payment_method,
          payment_receipt_url,
          payment_reference,
          payment_submitted_at,
          payment_verified_at,
          rejection_reason,
          cancelled_by,
          cancellation_reason,
          cancelled_at,
          refund_status,
          refund_amount,
          refund_due_at,
          refunded_at,
          refund_account_details,
          created_at,
          customer:profiles!bookings_customer_id_fkey (
            full_name,
            email,
            avatar_url,
            phone_number
          ),
          packages (
            name,
            tier
          ),
          reviews!reviews_booking_id_fkey (
            id,
            food_quality,
            service_quality,
            timeliness,
            overall,
            comment,
            caterer_reply,
            caterer_replied_at,
            created_at
          )
        `)
        .eq('caterer_id', catererId)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      const rows = (data ?? []) as unknown as Booking[];
      setBookings(rows);

      // Load disputes separately so the existing booking query remains intact.
      const bookingIds = rows.map((booking) => booking.id);

      if (bookingIds.length === 0) {
        setRefundDisputes([]);
        setRefundSubmissions({});
        setRefundSubmissionError('');
      } else {
        const { data: disputeRows, error: disputeQueryError } = await supabase
          .from('refund_disputes')
          .select(`
            id,
            booking_id,
            customer_id,
            reason,
            status,
            created_at,
            updated_at,
            resolved_at,
            caterer_response,
            caterer_responded_at,
            staff_note,
            staff_reviewed_at
          `)
          .in('booking_id', bookingIds)
          .order('created_at', { ascending: false });

        if (disputeQueryError) throw disputeQueryError;

        setRefundDisputes((disputeRows ?? []) as RefundDispute[]);
      }

      const { data: transferRows, error: transferError } = await supabase
        .from('refund_transfer_submissions')
        .select('booking_id, transfer_reference, proof_path, status, submitted_at, review_note, submitted_late')
        .eq('caterer_id', catererId);

      if (transferError) {
        setRefundSubmissionError('Refund transfer evidence could not be loaded. Refresh or contact Platform Staff if this continues.');
      } else {
        const byBooking: Record<string, RefundTransferSubmission> = {};
        (transferRows ?? []).forEach((submission) => {
          byBooking[submission.booking_id] = submission as RefundTransferSubmission;
        });
        setRefundSubmissions(byBooking);
        setRefundSubmissionError('');
      }

      setSelectedBooking((current) => {
        if (!current) return null;
        return rows.find((booking) => booking.id === current.id) ?? null;
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [catererId]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    let active = true;

    if (!catererId || !userId) {
      setMonthlyQuota(null);
      setQuotaLoading(false);
      return () => { active = false; };
    }

    setQuotaLoading(true);
    void loadMonthlyBookingQuota(catererId, userId).then((result) => {
      if (active) setMonthlyQuota(result);
    }).finally(() => {
      if (active) setQuotaLoading(false);
    });

    return () => { active = false; };
  }, [catererId, userId, quotaRefreshKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // =========================================
  // INTERNAL NOTES
  // =========================================

  const handleSaveInternalNote = async () => {
    if (!selectedBooking || !catererId || savingInternalNote) return;

    if (internalNote.length > 2000) {
      setInternalNoteError('Internal notes cannot exceed 2,000 characters.');
      return;
    }

    const bookingId = selectedBooking.id;

    setSavingInternalNote(true);
    setInternalNoteError('');
    setInternalNoteMessage('');

    try {
      const { data, error: updateError } = await supabase
        .from('bookings')
        .update({
          caterer_notes: internalNote.trim() || null,
        })
        .eq('id', bookingId)
        .eq('caterer_id', catererId)
        .select('id, caterer_notes')
        .maybeSingle();

      if (updateError) throw updateError;

      if (!data) {
        throw new Error(
          'Unable to save your internal note. Please refresh and try again.'
        );
      }

      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId
            ? { ...booking, caterer_notes: data.caterer_notes }
            : booking
        )
      );

      setSelectedBooking((current) =>
        current?.id === bookingId
          ? { ...current, caterer_notes: data.caterer_notes }
          : current
      );

      setInternalNote(data.caterer_notes ?? '');
      setInternalNoteMessage('Internal note saved successfully.');
    } catch (err) {
      setInternalNoteError(getErrorMessage(err));
    } finally {
      setSavingInternalNote(false);
    }
  };

  const counts = useMemo(() => {
    const result: Record<BookingFilter, number> = {
      all: bookings.length,
      pending: 0,
      confirmed: 0,
      paid: 0,
      ongoing: 0,
      completed: 0,
      cancelled: 0,
      rejected: 0,
    };

    bookings.forEach((booking) => {
      if (booking.status in result) {
        result[booking.status as BookingStatus] += 1;
      }
    });

    return result;
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesFilter =
        filter === 'all' || booking.status === filter;

      const matchesSearch =
        !keyword ||
        booking.customer?.full_name?.toLowerCase().includes(keyword) ||
        booking.id.toLowerCase().includes(keyword) ||
        booking.event_type?.toLowerCase().includes(keyword) ||
        booking.venue?.toLowerCase().includes(keyword) ||
        booking.packages?.name?.toLowerCase().includes(keyword) ||
        booking.payment_reference?.toLowerCase().includes(keyword);

      return matchesFilter && matchesSearch;
    });
  }, [bookings, filter, search]);

  const refresh = async () => {
    setRefreshing(true);
    await loadBookings();
  };

  const selectedDispute = selectedBooking
    ? refundDisputes.find(
        (dispute) => dispute.booking_id === selectedBooking.id
      ) ?? null
    : null;

  // =========================================
  // BOOKING ACTIONS
  // =========================================

  const handleBookingAction = async (action: BookingAction) => {
    if (!selectedBooking || !catererId || actionLoading) return;

    const booking = selectedBooking;

    let newStatus: BookingStatus;
    let allowedCurrentStatuses: BookingStatus[];

    switch (action) {
      case 'confirm':
        newStatus = 'confirmed';
        allowedCurrentStatuses = ['pending'];
        break;

      case 'reject':
        if (!rejectionReason.trim()) {
          setError('Please provide a reason for rejection.');
          return;
        }

        newStatus = 'rejected';
        allowedCurrentStatuses = ['pending'];
        break;

      case 'ongoing':
        if (booking.status !== 'paid') {
          setError('Only paid bookings can be marked as ongoing.');
          return;
        }

        newStatus = 'ongoing';
        allowedCurrentStatuses = ['paid'];
        break;

      case 'complete':
        newStatus = 'completed';
        allowedCurrentStatuses = ['ongoing'];
        break;
    }

    const actionLabels: Record<BookingAction, string> = {
      confirm: 'confirm this booking',
      reject: 'reject this booking',
      ongoing: 'mark this booking as ongoing',
      complete: 'mark this booking as completed',
    };

    if (!window.confirm(`Are you sure you want to ${actionLabels[action]}?`)) {
      return;
    }

    setActionLoading(true);
    setError('');
    setActionMessage('');

    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
      };

      if (action === 'reject') {
        updateData.rejection_reason = rejectionReason.trim();
      }

      const { data, error: updateError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', booking.id)
        .eq('caterer_id', catererId)
        .in('status', allowedCurrentStatuses)
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;

      if (!data) {
        throw new Error(
          'This booking could not be updated. It may have already changed status. Please refresh and try again.'
        );
      }

      if (action === 'confirm') {
        setQuotaRefreshKey((value) => value + 1);
      }

      const messages: Record<BookingAction, string> = {
        confirm: 'Booking successfully confirmed.',
        reject: 'Booking successfully rejected.',
        ongoing: 'Booking marked as ongoing.',
        complete: 'Booking marked as completed.',
      };

      setActionMessage(messages[action]);
      setShowRejectForm(false);
      setRejectionReason('');

      await loadBookings();
    } catch (err) {
      if (action === 'confirm' && isMonthlyQuotaRejection(err)) {
        setQuotaRefreshKey((value) => value + 1);
        setError(
          'Monthly booking limit reached. This booking remains pending. Review your plan usage or confirm in a later month.'
        );
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setActionLoading(false);
    }
  };

  // =========================================
  // EMERGENCY CANCELLATION
  // =========================================

  const handleEmergencyCancellation = async () => {
    if (!selectedBooking || !catererId || actionLoading) return;

    const booking = selectedBooking;

    if (!['confirmed', 'paid'].includes(booking.status)) {
      setError(
        'Only confirmed or paid bookings can be emergency-cancelled.'
      );
      return;
    }

    if (!emergencyCancelReason) {
      setError('Please select or specify a reason for cancellation.');
      return;
    }

    const finalCancelReason =
      emergencyCancelReason === 'Other'
        ? emergencyCancelCustomReason.trim()
        : emergencyCancelReason;

    if (!finalCancelReason) {
      setError('Please select or specify a reason for cancellation.');
      return;
    }

    const refundAmount = booking.payment_verified_at
      ? Number(booking.downpayment_amount ?? 0)
      : 0;

    const refundStatus = booking.payment_verified_at
      ? 'pending'
      : 'none';

    const confirmed = window.confirm(
      'Are you sure you want to emergency-cancel this booking? The customer will be informed, and this action cannot be undone.'
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError('');
    setActionMessage('');

    try {
      const { data, error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_by: 'caterer',
          cancellation_reason: finalCancelReason,
          cancelled_at: new Date().toISOString(),
          refund_amount: refundAmount,
          refund_status: refundStatus,
        })
        .eq('id', booking.id)
        .eq('caterer_id', catererId)
        .in('status', ['confirmed', 'paid'])
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;

      if (!data) {
        throw new Error(
          'This booking could not be cancelled. Its status may have changed. Please refresh and try again.'
        );
      }

      setActionMessage('Emergency cancellation successfully recorded.');
      resetActionForms();

      await loadBookings();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  // =========================================
  // REFUND PROOF UPLOAD AND SUBMISSION
  // =========================================

  const handleRefundFileChange = (file: File | null) => {
    setRefundError('');
    setRefundMessage('');

    if (!file) {
      setRefundProofFile(null);
      return;
    }

    if (!ALLOWED_REFUND_PROOF_TYPES.includes(file.type)) {
      setRefundProofFile(null);
      setRefundError(
        'Invalid file type. Please upload a JPG, PNG, WebP, or PDF file.'
      );

      if (refundFileInputRef.current) {
        refundFileInputRef.current.value = '';
      }

      return;
    }

    if (file.size > MAX_REFUND_PROOF_SIZE) {
      setRefundProofFile(null);
      setRefundError('The file is too large. Maximum file size is 10 MB.');

      if (refundFileInputRef.current) {
        refundFileInputRef.current.value = '';
      }

      return;
    }

    setRefundProofFile(file);
  };

  const handleRefundProofSubmission = async () => {
    if (!selectedBooking || !catererId || refundSubmitting) return;

    const booking = selectedBooking;
    const selectedFile = refundProofFile;
    const transferReference = refundTransferReference.trim();

    if (booking.status !== 'cancelled' || booking.cancelled_by !== 'caterer') {
      setRefundError('This booking is not eligible for refund submission.');
      return;
    }

    if (!['pending', 'overdue'].includes(booking.refund_status ?? '')) {
      setRefundError('This refund is not currently eligible for submission.');
      return;
    }

    if (Number(booking.refund_amount ?? 0) <= 0) {
      setRefundError('There is no refundable amount for this booking.');
      return;
    }

    if (!booking.refund_due_at) {
      setRefundError('The refund deadline is missing. Please contact support.');
      return;
    }

    if (!booking.refund_account_details) {
      setRefundError(
        'The customer has not submitted their refund destination details yet.'
      );
      return;
    }

    if (!selectedFile) {
      setRefundError('Please select a refund transfer proof file.');
      return;
    }

    if (transferReference.length < 5) {
      setRefundError(
        'The transfer reference must contain at least 5 characters.'
      );
      return;
    }

    if (transferReference.length > 200) {
      setRefundError('The transfer reference cannot exceed 200 characters.');
      return;
    }

    if (!window.confirm(
      `Submit refund proof for ${formatCurrency(booking.refund_amount)}? The customer will be notified and asked to confirm receipt.`
    )) {
      return;
    }

    setRefundSubmitting(true);
    setRefundError('');
    setRefundMessage('');

    let uploadedPath: string | null = null;
    let submissionSucceeded = false;

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(`Unable to retrieve your session: ${sessionError.message}`);
      }

      if (!session?.access_token) {
        throw new Error(
          'Your session has expired. Please sign in again before submitting refund proof.'
        );
      }

      const extension = getFileExtension(selectedFile);
      const safeFileName = `refund-proof-${Date.now()}.${extension}`;
      const proofPath = `${booking.id}/${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('refund-proofs')
        .upload(proofPath, selectedFile, {
          cacheControl: '3600',
          contentType: selectedFile.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Proof upload failed: ${uploadError.message}`);
      }

      uploadedPath = proofPath;

      const { data, error: functionError } =
        await supabase.functions.invoke('submit-refund-proof', {
          body: {
            booking_id: booking.id,
            transfer_reference: transferReference,
            proof_path: proofPath,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

      if (functionError) {
        throw new Error(await getFunctionErrorMessage(functionError));
      }

      if (!data || data.success !== true) {
        throw new Error(
          data?.error ||
            data?.message ||
            'The server did not confirm the refund proof submission.'
        );
      }

      submissionSucceeded = true;

      setRefundMessage(
        'Refund proof successfully submitted. Waiting for customer confirmation.'
      );

      setRefundProofFile(null);
      setRefundTransferReference('');

      if (refundFileInputRef.current) {
        refundFileInputRef.current.value = '';
      }

      setRefundSubmitting(false);

      try {
        await loadBookings();
      } catch (refreshError) {
        console.error('Booking refresh failed:', refreshError);
      }
    } catch (err) {
      const message = getErrorMessage(err);

      console.error('Refund proof submission failed:', err);
      setRefundError(message);

      if (uploadedPath && !submissionSucceeded) {
        const { error: removeError } = await supabase.storage
          .from('refund-proofs')
          .remove([uploadedPath]);

        if (removeError) {
          console.error(
            'Unable to remove unsubmitted refund proof:',
            removeError.message
          );
        }
      }
    } finally {
      setRefundSubmitting(false);
    }
  };

  const openRefundProof = async (proofPath: string) => {
    const proofWindow = window.open('about:blank', '_blank');
    if (!proofWindow) {
      setRefundSubmissionError('Allow pop-ups for this site to view the private refund proof.');
      return;
    }

    try {
      const { data, error: proofError } = await supabase.storage
        .from('refund-proofs')
        .createSignedUrl(proofPath, 300);
      if (proofError || !data?.signedUrl) {
        proofWindow.close();
        throw proofError ?? new Error('The refund proof link could not be created.');
      }
      proofWindow.location.href = data.signedUrl;
    } catch (err) {
      proofWindow.close();
      setRefundSubmissionError(getErrorMessage(err));
    }
  };

  // =========================================
  // CATERER REFUND DISPUTE RESPONSE
  // =========================================

  const handleDisputeResponse = async () => {
    if (!selectedDispute || disputeSubmitting) return;

    const response = disputeResponse.trim();

    if (response.length < 10) {
      setDisputeError(
        'Your response must contain at least 10 characters.'
      );
      return;
    }

    if (response.length > 2000) {
      setDisputeError('Your response cannot exceed 2,000 characters.');
      return;
    }

    if (selectedDispute.status === 'resolved') {
      setDisputeError('This refund dispute has already been resolved.');
      return;
    }

    if (
      !window.confirm(
        'Submit your response to this refund dispute? The customer will be notified.'
      )
    ) {
      return;
    }

    setDisputeSubmitting(true);
    setDisputeError('');
    setDisputeMessage('');

    try {
      const { error: rpcError } = await supabase.rpc(
        'caterer_respond_to_refund_dispute',
        {
          p_dispute_id: selectedDispute.id,
          p_response: response,
        }
      );

      if (rpcError) throw rpcError;

      setDisputeMessage(
        'Your response has been submitted. The customer will be notified.'
      );
      setDisputeResponse('');

      await loadBookings();
    } catch (err) {
      console.error('Refund dispute response failed:', err);
      setDisputeError(getErrorMessage(err));
    } finally {
      setDisputeSubmitting(false);
    }
  };

  const getStatusIcon = (status: BookingStatus) => {
    switch (status) {
      case 'pending':
        return <Clock size={14} />;

      case 'confirmed':
      case 'paid':
      case 'completed':
        return <CheckCircle2 size={14} />;

      case 'ongoing':
        return <CalendarDays size={14} />;

      case 'cancelled':
      case 'rejected':
        return <XCircle size={14} />;

      default:
        return null;
    }
  };

  if (!catererId) {
    return (
      <div className="bookings-page">
        <div className="bookings-empty-state">
          <AlertCircle size={38} />
          <h2>Caterer account unavailable</h2>
          <p>Please make sure your caterer profile is set up correctly.</p>
        </div>
      </div>
    );
  }

  const refundAccount = selectedBooking
    ? getRefundAccountDetails(selectedBooking.refund_account_details)
    : null;

  const canSubmitRefund =
    selectedBooking?.status === 'cancelled' &&
    selectedBooking.cancelled_by === 'caterer' &&
    ['pending', 'overdue'].includes(selectedBooking.refund_status ?? '') &&
    Number(selectedBooking.refund_amount ?? 0) > 0 &&
    !refundSubmissions[selectedBooking.id];

  const refundAlerts = bookings
    .filter((booking) =>
      booking.status === 'cancelled' &&
      ['pending', 'overdue'].includes(booking.refund_status ?? '') &&
      Number(booking.refund_amount ?? 0) > 0
    )
    .map((booking) => {
      const cancelledTime = booking.cancelled_at
        ? Date.parse(booking.cancelled_at)
        : NaN;
      const dueValue = booking.refund_due_at ?? (
        Number.isFinite(cancelledTime)
          ? new Date(cancelledTime + 72 * 60 * 60 * 1000).toISOString()
          : null
      );
      const dueTime = dueValue ? Date.parse(dueValue) : NaN;
      const dateLabel = Number.isFinite(dueTime)
        ? new Date(dueTime).toLocaleString('en-PH', {
            timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
          })
        : null;
      const remaining = dueTime - clockNow;
      const dueDay = Number.isFinite(dueTime)
        ? new Date(dueTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
        : null;
      const today = new Date(clockNow).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

      let title = 'Refund deadline approaching';
      let urgent = false;
      let detail = dateLabel
        ? `Transfer and submit proof by ${dateLabel} (Philippine time).`
        : 'Check the refund deadline with Platform Staff.';

      if (!dateLabel) {
        title = 'Refund deadline unavailable';
        urgent = true;
      } else if (remaining <= 0 || booking.refund_status === 'overdue') {
        title = 'Overdue — refund action required';
        urgent = true;
        detail = `Deadline: ${dateLabel} (Philippine time). Submit proof after transferring the refund.`;
      } else if (dueDay === today) {
        title = 'Refund due today';
        urgent = true;
      } else if (remaining <= 24 * 60 * 60 * 1000) {
        title = 'Refund due within 24 hours';
        urgent = true;
      }

      return { booking, urgent, title, detail, dueTime };
    })
    .sort((left, right) =>
      (Number.isFinite(left.dueTime) ? left.dueTime : 0) -
      (Number.isFinite(right.dueTime) ? right.dueTime : 0)
    );

  return (
    <div className="bookings-page">
      <CatererPageHeader
        icon={<CalendarRange size={25} />}
        title="Bookings"
        description="Manage customer reservations and event requests."
        action={<button
          type="button"
          className="bookings-refresh-button"
          onClick={refresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <LoaderCircle size={16} className="bookings-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Refresh
        </button>}
      />

      {error && (
        <div className="bookings-alert error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <section className="booking-quota-panel" aria-label="Monthly accepted booking usage">
        <div className="booking-quota-heading">
          <div>
            <span>MONTHLY ACCEPTED BOOKINGS</span>
            <strong>Booking quota</strong>
          </div>
          <button
            type="button"
            className="bookings-refresh-button booking-quota-refresh"
            onClick={() => setQuotaRefreshKey((value) => value + 1)}
            disabled={quotaLoading}
            aria-label="Refresh monthly booking usage"
            title="Refresh monthly booking usage"
          >
            <RefreshCw size={15} className={quotaLoading ? 'bookings-spin' : ''} />
          </button>
        </div>

        {quotaLoading && !monthlyQuota ? (
          <CatererSkeleton variant="subscription" label="Loading monthly booking usage" />
        ) : monthlyQuota?.status === 'ready' ? (
          <>
            <div className="booking-quota-values">
              <strong>{monthlyQuota.used} / {monthlyQuota.limit ?? 'Unlimited'} used</strong>
              <span>{monthlyQuota.remaining === null ? 'Unlimited remaining' : `${monthlyQuota.remaining} remaining`}</span>
            </div>
            {monthlyQuota.limit !== null && (
              <div className="booking-quota-track" role="progressbar"
                aria-valuenow={Math.min(100, monthlyQuota.limit > 0 ? monthlyQuota.used / monthlyQuota.limit * 100 : 0)}
                aria-valuemin={0} aria-valuemax={100} aria-label="Monthly accepted booking usage">
                <div style={{ width: `${monthlyQuota.limit > 0 ? Math.min(100, monthlyQuota.used / monthlyQuota.limit * 100) : 0}%` }} />
              </div>
            )}
            <small>{monthlyQuota.month.slice(0, 7)} · Asia/Manila</small>
          </>
        ) : (
          <p className="booking-quota-message">
            {monthlyQuota?.message ?? 'Monthly usage is unavailable. Refresh to try again.'}
          </p>
        )}
        <small className="booking-quota-footnote">
          Pending and rejected requests do not count. The server checks the limit when a booking is confirmed.
        </small>
      </section>

      {catererData?.account_standing && catererData.account_standing !== 'good_standing' && (
        <section className={`booking-standing-alert ${catererData.account_standing === 'refund_overdue' ? 'warning' : 'restricted'}`}>
          <ShieldAlert size={19} />
          <div>
            <strong>
              {catererData.account_standing === 'refund_overdue'
                ? 'Action required: overdue customer refund'
                : 'Account restricted'}
            </strong>
            <p>
              {catererData.account_standing === 'refund_overdue'
                ? 'A customer refund is past its proof deadline. Submit transfer evidence for each outstanding refund. Only the customer can confirm receipt.'
                : 'Your caterer account has restricted standing. Contact Platform Staff for assistance.'}
            </p>
          </div>
        </section>
      )}

      {refundAlerts.length > 0 && (
        <section className="booking-refund-alerts" aria-label="Refund deadline alerts">
          <h2>
            <AlertCircle size={18} />
            Refund deadlines · {refundAlerts.length} action{refundAlerts.length === 1 ? '' : 's'} required
          </h2>
          <div className="booking-refund-alert-list">
            {refundAlerts.map(({ booking, urgent, title, detail }) => (
              <button
                type="button"
                key={booking.id}
                className={`booking-refund-alert ${urgent ? 'urgent' : ''}`}
                onClick={() => {
                  setSelectedBooking(booking);
                  setInternalNote(booking.caterer_notes ?? '');
                  resetActionForms();
                  resetRefundForm();
                  resetDisputeForm();
                }}
              >
                <strong>{title} · {formatCurrency(booking.refund_amount)}</strong>
                <span>{booking.customer?.full_name || 'Customer'} · {detail}</span>
                <small>Open refund details</small>
              </button>
            ))}
          </div>
          <p>Only the customer can confirm receipt of the refund. Proof submission does not mark a refund as processed.</p>
        </section>
      )}

      <div className="bookings-summary">
        <div className="bookings-summary-card">
          <div className="bookings-summary-icon orange">
            <CalendarDays size={20} />
          </div>
          <div>
            <span>Total Bookings</span>
            <strong>{counts.all}</strong>
          </div>
        </div>

        <div className="bookings-summary-card">
          <div className="bookings-summary-icon yellow">
            <Clock size={20} />
          </div>
          <div>
            <span>Pending Requests</span>
            <strong>{counts.pending}</strong>
          </div>
        </div>

        <div className="bookings-summary-card">
          <div className="bookings-summary-icon green">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span>Completed</span>
            <strong>{counts.completed}</strong>
          </div>
        </div>

        <div className="bookings-summary-card">
          <div className="bookings-summary-icon blue">
            <Users size={20} />
          </div>
          <div>
            <span>Ongoing Events</span>
            <strong>{counts.ongoing}</strong>
          </div>
        </div>
      </div>

      <div className="bookings-toolbar">
        {!showDisputes && <div className="bookings-tabs">
          {FILTERS.map((item) => (
            <button
              type="button"
              key={item.value}
              className={`bookings-tab ${
                filter === item.value ? 'active' : ''
              }`}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
              <span>{counts[item.value]}</span>
            </button>
          ))}
        </div>}

        <button
          type="button"
          className={`booking-dispute-toggle ${showDisputes ? 'active' : ''}`}
          onClick={() => setShowDisputes((value) => !value)}
        >
          <ShieldAlert size={15} />
          {showDisputes ? 'Back to Bookings' : 'Customer Refund Disputes'}
          <span>{refundDisputes.filter((dispute) => dispute.status !== 'resolved').length}</span>
        </button>

        {!showDisputes && <div className="bookings-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search bookings..."
          />
        </div>}
      </div>

      {showDisputes ? (
        <section className="booking-disputes-panel" aria-label="Customer refund disputes">
          <div className="booking-disputes-heading">
            <div>
              <h2>Refund Disputes</h2>
              <p>Review customer reports and respond with investigation updates.</p>
            </div>
            <div className="booking-dispute-filters">
              {(['all', 'open', 'investigating', 'resolved'] as const).map((status) => {
                const count = status === 'all'
                  ? refundDisputes.length
                  : refundDisputes.filter((dispute) => dispute.status === status).length;
                return (
                  <button
                    type="button"
                    key={status}
                    className={disputeFilter === status ? 'active' : ''}
                    onClick={() => setDisputeFilter(status)}
                  >
                    {status === 'all' ? 'All' : getDisputeStatusLabel(status)} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <CatererSkeleton variant="booking-rows" label="Loading refund disputes" />
          ) : refundDisputes.filter((dispute) => disputeFilter === 'all' || dispute.status === disputeFilter).length === 0 ? (
            <div className="bookings-empty-state">
              <ShieldCheck size={36} />
              <h3>No refund disputes</h3>
              <p>Customer refund reports will appear here.</p>
            </div>
          ) : (
            <div className="booking-disputes-list">
              {refundDisputes
                .filter((dispute) => disputeFilter === 'all' || dispute.status === disputeFilter)
                .map((dispute) => {
                  const booking = bookings.find((item) => item.id === dispute.booking_id);
                  return (
                    <button
                      type="button"
                      className="booking-dispute-row"
                      key={dispute.id}
                      disabled={!booking}
                      onClick={() => {
                        if (!booking) return;
                        setSelectedBooking(booking);
                        setInternalNote(booking.caterer_notes ?? '');
                        setInternalNoteMessage('');
                        setInternalNoteError('');
                        setError('');
                        setActionMessage('');
                        resetActionForms();
                        resetRefundForm();
                        resetDisputeForm();
                      }}
                    >
                      <span className={`booking-dispute-status ${dispute.status}`}>
                        {getDisputeStatusLabel(dispute.status)}
                      </span>
                      <strong>{booking?.customer?.full_name ?? 'Customer refund report'}</strong>
                      <span>{formatDateTime(dispute.created_at)}</span>
                      <p>{dispute.reason}</p>
                      <small>{booking ? 'Open booking and dispute details' : 'Related booking unavailable'}</small>
                    </button>
                  );
                })}
            </div>
          )}
        </section>
      ) : loading ? (
        <CatererSkeleton variant="booking-rows" label="Loading bookings" />
      ) : filteredBookings.length === 0 ? (
        <div className="bookings-empty-state">
          <CalendarDays size={42} />
          <h2>
            {search
              ? 'No matching bookings'
              : filter === 'all'
                ? 'No bookings yet'
                : `No ${filter} bookings`}
          </h2>
          <p>
            {search
              ? 'Try another search term.'
              : 'Customer booking requests will appear here.'}
          </p>

          <button
            type="button"
            className="bookings-secondary-button"
            onClick={refresh}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      ) : (
        <div className="bookings-list">
          {filteredBookings.map((booking) => (
            <article className="booking-card" key={booking.id}>
              <div className="booking-card-main">
                <div className="booking-customer">
                  {booking.customer?.avatar_url ? (
                    <img
                      src={booking.customer.avatar_url}
                      alt=""
                      className="booking-avatar"
                    />
                  ) : (
                    <div className="booking-avatar-placeholder">
                      {booking.customer?.full_name?.charAt(0) ?? 'C'}
                    </div>
                  )}

                  <div>
                    <h3>
                      {booking.customer?.full_name ?? 'Customer'}
                    </h3>
                    <span>
                      Booking #{booking.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                </div>

                <span
                  className={`booking-status ${STATUS_COLORS[booking.status]}`}
                >
                  {getStatusIcon(booking.status)}
                  {getStatusLabel(booking.status)}
                </span>
              </div>

              <div className="booking-card-details">
                <div>
                  <CalendarDays size={15} />
                  <span>{formatDate(booking.event_date)}</span>
                </div>

                <div>
                  <Clock size={15} />
                  <span>{formatTime(booking.event_time)}</span>
                </div>

                <div>
                  <Users size={15} />
                  <span>{booking.guest_count} guests</span>
                </div>

                <div>
                  <MapPin size={15} />
                  <span>{booking.venue || 'Venue not specified'}</span>
                </div>
              </div>

              <div className="booking-card-footer">
                <div>
                  <small>{booking.packages?.name ?? 'Package'}</small>
                  <strong>{formatCurrency(booking.total_cost)}</strong>
                </div>

                <div className="booking-card-actions">
                  <button
                    type="button"
                    className="booking-chat-button"
                    onClick={() => openClientChatroom(booking)}
                  >
                    <MessageSquare size={15} />
                    Open Client Chatroom
                  </button>

                  <button
                    type="button"
                    className="booking-view-button"
                    onClick={() => {
                      setSelectedBooking(booking);

                      setInternalNote(booking.caterer_notes ?? '');
                      setInternalNoteMessage('');
                      setInternalNoteError('');

                      setError('');
                      setActionMessage('');
                      resetActionForms();
                      resetRefundForm();
                      resetDisputeForm();
                    }}
                  >
                    <Eye size={15} />
                    View Details
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedBooking && (
        <div
          className="booking-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !actionLoading &&
              !refundSubmitting &&
              !disputeSubmitting &&
              !savingInternalNote
            ) {
              closeBookingDetails();
            }
          }}
        >
          <div
            className="booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
          >
            <div className="booking-modal-header">
              <div>
                <h2 id="booking-modal-title">Booking Details</h2>
                <p>
                  Booking #{selectedBooking.id.slice(0, 8).toUpperCase()}
                </p>
              </div>

              <button
                type="button"
                className="booking-modal-close"
                disabled={
                  actionLoading ||
                  refundSubmitting ||
                  disputeSubmitting ||
                  savingInternalNote
                }
                onClick={closeBookingDetails}
              >
                ×
              </button>
            </div>

            <div className="booking-modal-body">
              <div className="booking-detail-status">
                <span
                  className={`booking-status ${
                    STATUS_COLORS[selectedBooking.status]
                  }`}
                >
                  {getStatusIcon(selectedBooking.status)}
                  {getStatusLabel(selectedBooking.status)}
                </span>
              </div>

              {/* BOOKING ACTIONS */}
              {['pending', 'confirmed', 'paid', 'ongoing'].includes(
                selectedBooking.status
              ) && (
                <section className="booking-detail-section booking-actions-section">
                  <h3>
                    <CheckCircle2 size={16} />
                    Booking Actions
                  </h3>

                  {actionMessage && (
                    <div className="booking-action-success">
                      <CheckCircle2 size={16} />
                      {actionMessage}
                    </div>
                  )}

                  {selectedBooking.status === 'pending' && (
                    <>
                      <p>
                        Review the customer's event details before confirming
                        or rejecting this booking request.
                      </p>

                      {!showRejectForm ? (
                        <div className="booking-action-buttons">
                          <button
                            type="button"
                            className="booking-action-button confirm"
                            disabled={actionLoading}
                            onClick={() => handleBookingAction('confirm')}
                          >
                            {actionLoading ? (
                              <LoaderCircle
                                size={17}
                                className="bookings-spin"
                              />
                            ) : (
                              <CheckCircle2 size={17} />
                            )}
                            Confirm Booking
                          </button>

                          <button
                            type="button"
                            className="booking-action-button reject"
                            disabled={actionLoading}
                            onClick={() => {
                              setError('');
                              setShowRejectForm(true);
                            }}
                          >
                            <XCircle size={17} />
                            Reject Booking
                          </button>
                        </div>
                      ) : (
                        <div className="booking-reject-form">
                          <label htmlFor="booking-rejection-reason">
                            Reason for rejecting this booking
                          </label>

                          <textarea
                            id="booking-rejection-reason"
                            value={rejectionReason}
                            onChange={(event) =>
                              setRejectionReason(event.target.value)
                            }
                            placeholder="Explain why you cannot accept this booking..."
                            rows={4}
                          />

                          <small>
                            Please provide a reason for rejecting this booking.
                          </small>

                          <div className="booking-action-buttons">
                            <button
                              type="button"
                              className="booking-action-button reject"
                              disabled={actionLoading}
                              onClick={() => handleBookingAction('reject')}
                            >
                              {actionLoading ? (
                                <LoaderCircle
                                  size={17}
                                  className="bookings-spin"
                                />
                              ) : (
                                <XCircle size={17} />
                              )}
                              Submit Rejection
                            </button>

                            <button
                              type="button"
                              className="bookings-secondary-button"
                              disabled={actionLoading}
                              onClick={() => {
                                setShowRejectForm(false);
                                setRejectionReason('');
                              }}
                            >
                              Go Back
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {['confirmed', 'paid'].includes(selectedBooking.status) && (
                    <div className="booking-emergency-cancel">
                      {!showEmergencyCancelForm ? (
                        <button
                          type="button"
                          className="booking-action-button emergency-cancel"
                          disabled={actionLoading}
                          onClick={() => {
                            setError('');
                            setShowEmergencyCancelForm(true);
                          }}
                        >
                          <XCircle size={17} />
                          Emergency Cancel
                        </button>
                      ) : (
                        <div className="booking-emergency-form">
                          <h4>Emergency Cancellation</h4>

                          <p>
                            Use this option only when an unexpected situation
                            prevents you from providing the catering service.
                            The customer will be notified and may request a
                            refund of their verified downpayment.
                          </p>

                          <label htmlFor="emergency-cancel-reason">
                            Emergency reason
                          </label>

                          <select
                            id="emergency-cancel-reason"
                            value={emergencyCancelReason}
                            onChange={(event) =>
                              setEmergencyCancelReason(event.target.value)
                            }
                            disabled={actionLoading}
                          >
                            <option value="">
                              Select an emergency reason
                            </option>
                            {CATERER_CANCEL_REASONS.map((reason) => (
                              <option key={reason} value={reason}>
                                {reason}
                              </option>
                            ))}
                          </select>

                          {emergencyCancelReason === 'Other' && (
                            <>
                              <label htmlFor="emergency-cancel-custom-reason">
                                Specify the emergency
                              </label>
                              <textarea
                                id="emergency-cancel-custom-reason"
                                value={emergencyCancelCustomReason}
                                onChange={(event) =>
                                  setEmergencyCancelCustomReason(event.target.value)
                                }
                                placeholder="Please specify your emergency..."
                                rows={4}
                                disabled={actionLoading}
                              />
                            </>
                          )}

                          {selectedBooking.payment_verified_at ? (
                            <div className="booking-emergency-refund-info">
                              <Wallet size={17} />
                              <span>
                                A full downpayment refund of{' '}
                                <strong>
                                  {formatCurrency(
                                    selectedBooking.downpayment_amount
                                  )}
                                </strong>{' '}
                                will be recorded.
                              </span>
                            </div>
                          ) : (
                            <div className="booking-emergency-refund-info">
                              <Wallet size={17} />
                              <span>
                                No verified downpayment was recorded, so no
                                refund amount will be due.
                              </span>
                            </div>
                          )}

                          <div className="booking-action-buttons">
                            <button
                              type="button"
                              className="booking-action-button emergency-cancel"
                              disabled={actionLoading}
                              onClick={handleEmergencyCancellation}
                            >
                              {actionLoading ? (
                                <LoaderCircle
                                  size={17}
                                  className="bookings-spin"
                                />
                              ) : (
                                <XCircle size={17} />
                              )}
                              Confirm Cancel & Notify Client
                            </button>

                            <button
                              type="button"
                              className="bookings-secondary-button"
                              disabled={actionLoading}
                              onClick={() => {
                                setShowEmergencyCancelForm(false);
                                setEmergencyCancelReason('');
                                setEmergencyCancelCustomReason('');
                                setError('');
                              }}
                            >
                              Go Back
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedBooking.status === 'paid' && (
                    <>
                      <p>
                        The booking has been accepted. Once the event
                        preparation or service begins, you can mark it as
                        ongoing.
                      </p>

                      <button
                        type="button"
                        className="booking-action-button ongoing"
                        disabled={actionLoading}
                        onClick={() => handleBookingAction('ongoing')}
                      >
                        {actionLoading ? (
                          <LoaderCircle
                            size={17}
                            className="bookings-spin"
                          />
                        ) : (
                          <CalendarDays size={17} />
                        )}
                        Mark as Ongoing
                      </button>
                    </>
                  )}

                  {selectedBooking.status === 'ongoing' && (
                    <>
                      <p>
                        Mark this booking as completed after the catering
                        service and event have finished.
                      </p>

                      <button
                        type="button"
                        className="booking-action-button complete"
                        disabled={actionLoading}
                        onClick={() => handleBookingAction('complete')}
                      >
                        {actionLoading ? (
                          <LoaderCircle
                            size={17}
                            className="bookings-spin"
                          />
                        ) : (
                          <CheckCircle2 size={17} />
                        )}
                        Mark as Completed
                      </button>
                    </>
                  )}
                </section>
              )}

              {/* CUSTOMER INFORMATION */}
              <section className="booking-detail-section">
                <h3>
                  <Users size={16} /> Customer Information
                </h3>

                <div className="booking-customer-details">
                  <div className="booking-customer-profile">
                    {selectedBooking.customer?.avatar_url ? (
                      <img
                        src={selectedBooking.customer.avatar_url}
                        alt="Customer profile"
                        className="booking-avatar"
                      />
                    ) : (
                      <div className="booking-avatar-placeholder">
                        {selectedBooking.customer?.full_name?.charAt(0) ?? 'C'}
                      </div>
                    )}

                    <div className="booking-customer-info">
                      <strong>
                        {selectedBooking.customer?.full_name ?? 'Customer'}
                      </strong>

                      <div className="booking-customer-contact">
                        <span>
                          <Phone size={14} />
                          {selectedBooking.customer?.phone_number ||
                            'No phone number'}
                        </span>

                        <span>
                          <Mail size={14} />
                          {selectedBooking.customer?.email ||
                            'No email address'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="booking-chat-button booking-chat-button-modal"
                  onClick={() => openClientChatroom(selectedBooking)}
                >
                  <MessageSquare size={17} />
                  Open Client Chatroom
                </button>
              </section>

              {/* EVENT INFORMATION */}
              <section className="booking-detail-section">
                <h3>
                  <CalendarDays size={16} /> Event Information
                </h3>

                <p>
                  <strong>Event:</strong>{' '}
                  {selectedBooking.event_type ?? 'Not specified'}
                </p>

                <p>
                  <strong>Date:</strong>{' '}
                  {formatDate(selectedBooking.event_date)}
                </p>

                <p>
                  <strong>Time:</strong>{' '}
                  {formatTime(selectedBooking.event_time)}
                </p>

                <p>
                  <strong>Guests:</strong> {selectedBooking.guest_count}
                </p>

                <p>
                  <strong>Package:</strong>{' '}
                  {selectedBooking.packages?.name ?? 'Not available'}
                </p>

                <p>
                  <strong>Package tier:</strong>{' '}
                  {selectedBooking.packages?.tier ?? 'Not specified'}
                </p>

                <div className="booking-venue-box">
                  <p>
                    <strong>Event venue:</strong>
                  </p>

                  <p>{selectedBooking.venue ?? 'Not specified'}</p>

                  {selectedBooking.venue && (
                    <a
                      href={getVenueMapUrl(selectedBooking.venue) ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="booking-receipt-link"
                    >
                      <MapPin size={15} />
                      Open Venue in Google Maps
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>

                <p>
                  <strong>Special requests:</strong>{' '}
                  {selectedBooking.special_requests ?? 'None'}
                </p>

                <div className="booking-customized-items">
                  <h4>
                    <Utensils size={16} />
                    Customized Items
                  </h4>

                  {getCustomizedItems(selectedBooking.customized_items).length >
                  0 ? (
                    <div className="customized-items-list">
                      {getCustomizedItems(
                        selectedBooking.customized_items
                      ).map((item, index) => (
                        <div
                          className="customized-item-card"
                          key={item.menu_item_id ?? `${item.name}-${index}`}
                        >
                          <div className="customized-item-icon">
                            <Utensils size={19} />
                          </div>

                          <div className="customized-item-info">
                            <strong>
                              {item.name || `Customized Item ${index + 1}`}
                            </strong>

                            <div className="customized-item-meta">
                              <span>
                                <Hash size={12} />
                                Quantity: {Number(item.quantity ?? 0)}
                              </span>

                              {item.menu_item_id && (
                                <span className="customized-item-id">
                                  Menu item selected
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="customized-item-price">
                            <small>Price per guest</small>
                            <strong>
                              {formatCurrency(item.price_per_guest)}
                            </strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="customized-items-empty">
                      <Package size={19} />
                      <span>No customized items selected.</span>
                    </div>
                  )}
                </div>
              </section>

              {/* CATERER-ONLY INTERNAL NOTES */}
              <section className="booking-detail-section booking-internal-notes">
                <h3>
                  <FileText size={16} />
                  Internal Notes
                </h3>

                <p className="booking-internal-notes-description">
                  These notes are for your catering business records. They are
                  intended for internal use and are not displayed in the
                  customer-facing interface.
                </p>

                <textarea
                  value={internalNote}
                  onChange={(event) => {
                    setInternalNote(event.target.value);
                    setInternalNoteError('');
                    setInternalNoteMessage('');
                  }}
                  placeholder="Write private notes about this booking..."
                  rows={5}
                  maxLength={2000}
                  disabled={savingInternalNote}
                />

                <small>{internalNote.length}/2000 characters</small>

                {internalNoteError && (
                  <div className="bookings-alert error">
                    <AlertCircle size={16} />
                    <span>{internalNoteError}</span>
                  </div>
                )}

                {internalNoteMessage && (
                  <div className="booking-action-success">
                    <CheckCircle2 size={16} />
                    {internalNoteMessage}
                  </div>
                )}

                <button
                  type="button"
                  className="booking-action-button confirm"
                  onClick={handleSaveInternalNote}
                  disabled={
                    savingInternalNote ||
                    internalNote.length > 2000
                  }
                >
                  {savingInternalNote ? (
                    <LoaderCircle
                      size={17}
                      className="bookings-spin"
                    />
                  ) : (
                    <FileText size={17} />
                  )}

                  {savingInternalNote
                    ? 'Saving Note...'
                    : 'Save Internal Note'}
                </button>
              </section>

              {/* PAYMENT INFORMATION */}
              <section className="booking-detail-section">
                <h3>
                  <CreditCard size={16} /> Payment Information
                </h3>

                <div className="booking-payment-grid">
                  <div>
                    <span>Total cost</span>
                    <strong>
                      {formatCurrency(selectedBooking.total_cost)}
                    </strong>
                  </div>

                  <div>
                    <span>Required downpayment</span>
                    <strong>
                      {formatCurrency(selectedBooking.downpayment_amount)}
                    </strong>
                  </div>
                </div>

                <p>
                  <strong>Payment method:</strong>{' '}
                  {getPaymentMethodLabel(selectedBooking.payment_method)}
                </p>

                <p>
                  <strong>Payment status:</strong>{' '}
                  <span
                    className={
                      selectedBooking.payment_verified_at
                        ? 'booking-payment-verified'
                        : 'booking-payment-unverified'
                    }
                  >
                    {getPaymentStatus(selectedBooking)}
                  </span>
                </p>

                <p>
                  <strong>Payment reference / Xendit Invoice ID:</strong>
                </p>

                {selectedBooking.payment_reference ? (
                  <div className="booking-reference-box">
                    <code>{selectedBooking.payment_reference}</code>
                  </div>
                ) : (
                  <p>Not available</p>
                )}

                <p>
                  <strong>Payment submitted:</strong>{' '}
                  {formatDateTime(selectedBooking.payment_submitted_at)}
                </p>

                <p>
                  <strong>Payment verified:</strong>{' '}
                  {formatDateTime(selectedBooking.payment_verified_at)}
                </p>

                <p>
                  <strong>Payment deadline:</strong>{' '}
                  {formatDateTime(selectedBooking.downpayment_deadline)}
                </p>

                {selectedBooking.payment_verified_at && (
                  <div className="booking-receipt-notice">
                    <CheckCircle2 size={19} />

                    <div>
                      <strong>Downpayment Successfully Received</strong>
                      <p>
                        The customer's downpayment has been successfully
                        processed through Xendit and the transaction has
                        been verified.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* CUSTOMER REVIEW */}
              <section className="booking-detail-section">
                <h3>
                  <Star size={16} /> Customer Review
                </h3>

                {selectedBooking.reviews &&
                selectedBooking.reviews.length > 0 ? (
                  selectedBooking.reviews.map((review) => (
                    <div className="booking-review-card" key={review.id}>
                      <div className="booking-review-header">
                        <div>
                          <strong>Overall Rating</strong>

                          <div className="booking-review-stars">
                            {Array.from({ length: 5 }, (_, index) => (
                              <Star
                                key={index}
                                size={17}
                                fill={
                                  index < (review.overall ?? 0)
                                    ? '#F59E0B'
                                    : 'none'
                                }
                                color={
                                  index < (review.overall ?? 0)
                                    ? '#F59E0B'
                                    : '#CBD5E1'
                                }
                              />
                            ))}

                            <strong>{review.overall ?? 0}/5</strong>
                          </div>
                        </div>

                        <small>{formatDateTime(review.created_at)}</small>
                      </div>

                      <div className="booking-review-ratings">
                        <div>
                          <span>Food Quality</span>
                          <strong>{review.food_quality ?? '-'}/5</strong>
                        </div>

                        <div>
                          <span>Service Quality</span>
                          <strong>{review.service_quality ?? '-'}/5</strong>
                        </div>

                        <div>
                          <span>Timeliness</span>
                          <strong>{review.timeliness ?? '-'}/5</strong>
                        </div>
                      </div>

                      <div className="booking-review-comment">
                        <strong>
                          <MessageSquare size={14} /> Customer Comment
                        </strong>

                        <p>
                          {review.comment || 'No written comment provided.'}
                        </p>
                      </div>

                      <div className="booking-review-reply">
                        <strong>Your Reply</strong>

                        {review.caterer_reply ? (
                          <>
                            <p>{review.caterer_reply}</p>
                            <small>
                              Replied:{' '}
                              {formatDateTime(review.caterer_replied_at)}
                            </small>
                          </>
                        ) : (
                          <p>You have not replied to this review yet.</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="booking-no-review">
                    <Star size={20} />
                    <p>
                      No customer review has been submitted for this booking
                      yet.
                    </p>
                  </div>
                )}
              </section>

              {/* REJECTION */}
              {selectedBooking.status === 'rejected' && (
                <section className="booking-detail-section">
                  <h3>
                    <XCircle size={16} /> Rejection Reason
                  </h3>

                  <p>
                    {selectedBooking.rejection_reason ??
                      'No reason provided.'}
                  </p>
                </section>
              )}

              {/* CANCELLATION AND REFUND */}
              {selectedBooking.status === 'cancelled' && (
                <section className="booking-detail-section">
                  <h3>
                    <Wallet size={16} /> Cancellation and Refund
                  </h3>

                  <p>
                    <strong>Cancellation date:</strong>{' '}
                    {formatDateTime(selectedBooking.cancelled_at)}
                  </p>

                  {selectedBooking.cancelled_by === 'caterer' && (
                    <p>
                      <strong>Cancellation type:</strong> Emergency
                      cancellation
                    </p>
                  )}

                  <p>
                    <strong>Cancelled by:</strong>{' '}
                    {selectedBooking.cancelled_by ?? 'Not specified'}
                  </p>

                  <p>
                    <strong>Cancellation reason:</strong>{' '}
                    {selectedBooking.cancellation_reason ?? 'Not specified'}
                  </p>

                  <p>
                    <strong>Refund status:</strong>{' '}
                    {selectedBooking.refund_status ?? 'None'}
                  </p>

                  <p>
                    <strong>Refund amount:</strong>{' '}
                    {formatCurrency(selectedBooking.refund_amount)}
                  </p>

                  <p>
                    <strong>Refund deadline:</strong>{' '}
                    {formatDateTime(selectedBooking.refund_due_at)}
                  </p>

                  <p>
                    <strong>Refund completed:</strong>{' '}
                    {formatDateTime(selectedBooking.refunded_at)}
                  </p>

                  {/* CUSTOMER REFUND DESTINATION */}
                  <div className="booking-refund-destination">
                    <h4>
                      <Wallet size={16} />
                      Customer Refund Destination
                    </h4>

                    {refundAccount ? (
                      <>
                        <p>
                          <strong>Payment method:</strong>{' '}
                          {getPaymentMethodLabel(refundAccount.method)}
                        </p>

                        <p>
                          <strong>Account holder:</strong>{' '}
                          {refundAccount.account_holder || 'Not provided'}
                        </p>

                        <p>
                          <strong>Account number:</strong>{' '}
                          {maskAccountNumber(refundAccount.account_number)}
                        </p>

                        {refundAccount.bank_name && (
                          <p>
                            <strong>Bank:</strong>{' '}
                            {refundAccount.bank_name}
                          </p>
                        )}
                      </>
                    ) : (
                      <p>
                        The customer has not submitted valid refund destination
                        details yet.
                      </p>
                    )}
                  </div>

                  {refundSubmissionError && (
                    <div className="bookings-alert error">
                      <AlertCircle size={17} />
                      <span>{refundSubmissionError}</span>
                    </div>
                  )}

                  {refundSubmissions[selectedBooking.id] && (
                    <div className="booking-refund-submission">
                      <h4><FileText size={16} /> Transfer Proof Submitted</h4>
                      <p><strong>Status:</strong> {refundSubmissions[selectedBooking.id].status}</p>
                      <p><strong>Transfer reference:</strong> {refundSubmissions[selectedBooking.id].transfer_reference}</p>
                      <p><strong>Submitted:</strong> {formatDateTime(refundSubmissions[selectedBooking.id].submitted_at)}
                        {refundSubmissions[selectedBooking.id].submitted_late ? ' (late)' : ''}</p>
                      {refundSubmissions[selectedBooking.id].review_note && (
                        <p><strong>Staff note:</strong> {refundSubmissions[selectedBooking.id].review_note}</p>
                      )}
                      <button
                        type="button"
                        className="booking-view-button"
                        onClick={() => void openRefundProof(refundSubmissions[selectedBooking.id].proof_path)}
                      >
                        <ExternalLink size={15} /> View private transfer proof
                      </button>
                      <small>
                        The refund remains pending until the customer confirms receipt. Contact Platform Staff about any issue with submitted evidence.
                      </small>
                    </div>
                  )}

                  {/* REFUND DISPUTE */}
                  {selectedDispute && (
                    <div className="booking-refund-dispute">
                      <h4>
                        <MessageSquare size={17} />
                        Customer Refund Dispute
                      </h4>

                      <p>
                        <strong>Dispute status:</strong>{' '}
                        {getDisputeStatusLabel(selectedDispute.status)}
                      </p>

                      <p>
                        <strong>Reported:</strong>{' '}
                        {formatDateTime(selectedDispute.created_at)}
                      </p>

                      <div className="booking-dispute-reason">
                        <strong>Customer's concern</strong>
                        <p>{selectedDispute.reason}</p>
                      </div>

                      {selectedDispute.caterer_response && (
                        <div className="booking-dispute-response">
                          <strong>Your submitted response</strong>
                          <p>{selectedDispute.caterer_response}</p>
                          <small>
                            Submitted:{' '}
                            {formatDateTime(
                              selectedDispute.caterer_responded_at
                            )}
                          </small>
                        </div>
                      )}

                      {selectedDispute.staff_note && (
                        <div className="booking-dispute-staff-note">
                          <strong>Platform Staff Note</strong>
                          <p>{selectedDispute.staff_note}</p>
                          <small>
                            Reviewed:{' '}
                            {formatDateTime(selectedDispute.staff_reviewed_at)}
                          </small>
                        </div>
                      )}

                      {selectedDispute.status !== 'resolved' ? (
                        <div className="booking-dispute-response-form">
                          <label htmlFor="refund-dispute-response">
                            {selectedDispute.caterer_response
                              ? 'Update your response'
                              : 'Respond to the customer'}
                          </label>

                          <textarea
                            id="refund-dispute-response"
                            value={disputeResponse}
                            onChange={(event) => {
                              setDisputeResponse(event.target.value);
                              setDisputeError('');
                              setDisputeMessage('');
                            }}
                            placeholder="Explain the refund transfer details, provide clarification, or describe the steps you have taken to investigate..."
                            rows={5}
                            maxLength={2000}
                            disabled={disputeSubmitting}
                          />

                          <small>
                            {disputeResponse.length}/2000 characters. At
                            least 10 characters are required.
                          </small>

                          {disputeError && (
                            <div className="bookings-alert error">
                              <AlertCircle size={16} />
                              <span>{disputeError}</span>
                            </div>
                          )}

                          {disputeMessage && (
                            <div className="booking-action-success">
                              <CheckCircle2 size={16} />
                              {disputeMessage}
                            </div>
                          )}

                          <button
                            type="button"
                            className="booking-action-button confirm"
                            disabled={
                              disputeSubmitting ||
                              disputeResponse.trim().length < 10
                            }
                            onClick={handleDisputeResponse}
                          >
                            {disputeSubmitting ? (
                              <LoaderCircle
                                size={17}
                                className="bookings-spin"
                              />
                            ) : (
                              <Send size={17} />
                            )}

                            {disputeSubmitting
                              ? 'Submitting Response...'
                              : 'Submit Response'}
                          </button>

                          <small className="booking-refund-note">
                            Your response will be sent to the customer.
                            The dispute remains open for follow-up until
                            the refund is confirmed as received.
                          </small>
                        </div>
                      ) : (
                        <div className="booking-receipt-notice">
                          <CheckCircle2 size={19} />
                          <div>
                            <strong>Dispute Resolved</strong>
                            <p>
                              This refund dispute has been marked as resolved.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!selectedDispute &&
                    selectedBooking.refund_status ===
                      'awaiting_customer_confirmation' && (
                      <div className="booking-receipt-notice">
                        <Clock size={19} />

                        <div>
                          <strong>Awaiting Customer Confirmation</strong>
                          <p>
                            Your refund transfer proof has been submitted.
                            The customer must confirm whether they received
                            the refund. If they report that it was not
                            received, their dispute will appear here.
                          </p>
                        </div>
                      </div>
                    )}

                  {/* REFUND SUBMISSION FORM */}
                  {canSubmitRefund && (
                    <div className="booking-refund-submit">
                      <h4>
                        <Upload size={17} />
                        Submit Refund Transfer Proof
                      </h4>

                      <p>
                        Transfer the refund to the customer's registered
                        destination first. Then upload your transaction
                        receipt and enter its reference number.
                      </p>

                      <div className="booking-emergency-refund-info">
                        <Wallet size={18} />
                        <span>
                          Refund amount due:{' '}
                          <strong>
                            {formatCurrency(selectedBooking.refund_amount)}
                          </strong>
                        </span>
                      </div>

                      <p>
                        <strong>Refund deadline:</strong>{' '}
                        {formatDateTime(selectedBooking.refund_due_at)}
                      </p>

                      {refundMessage && (
                        <div className="booking-action-success">
                          <CheckCircle2 size={17} />
                          {refundMessage}
                        </div>
                      )}

                      {refundError && (
                        <div className="bookings-alert error">
                          <AlertCircle size={17} />
                          <span>{refundError}</span>
                        </div>
                      )}

                      <div className="booking-refund-upload-field">
                        <label htmlFor="refund-proof-file">
                          Transfer receipt / proof
                        </label>

                        <input
                          ref={refundFileInputRef}
                          id="refund-proof-file"
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                          disabled={refundSubmitting}
                          onChange={(event) =>
                            handleRefundFileChange(
                              event.target.files?.[0] ?? null
                            )
                          }
                        />

                        <small>
                          Accepted formats: JPG, PNG, WebP, PDF. Maximum size:
                          10 MB.
                        </small>

                        {refundProofFile && (
                          <div className="booking-refund-selected-file">
                            {refundProofFile.type === 'application/pdf' ? (
                              <FileText size={18} />
                            ) : (
                              <ImageIcon size={18} />
                            )}

                            <span>{refundProofFile.name}</span>

                            <button
                              type="button"
                              disabled={refundSubmitting}
                              onClick={() => {
                                setRefundProofFile(null);

                                if (refundFileInputRef.current) {
                                  refundFileInputRef.current.value = '';
                                }
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="booking-refund-upload-field">
                        <label htmlFor="refund-transfer-reference">
                          Transfer reference number
                        </label>

                        <input
                          id="refund-transfer-reference"
                          type="text"
                          value={refundTransferReference}
                          onChange={(event) =>
                            setRefundTransferReference(event.target.value)
                          }
                          placeholder="Enter the GCash or bank transfer reference"
                          minLength={5}
                          maxLength={200}
                          disabled={refundSubmitting}
                        />

                        <small>
                          Enter the reference number shown in your transfer
                          receipt. At least 5 characters are required.
                        </small>
                      </div>

                      <button
                        type="button"
                        className="booking-action-button confirm"
                        disabled={
                          refundSubmitting ||
                          !refundProofFile ||
                          refundTransferReference.trim().length < 5
                        }
                        onClick={handleRefundProofSubmission}
                      >
                        {refundSubmitting ? (
                          <LoaderCircle
                            size={17}
                            className="bookings-spin"
                          />
                        ) : (
                          <Upload size={17} />
                        )}

                        {refundSubmitting
                          ? 'Submitting Refund Proof...'
                          : 'Submit Refund Proof'}
                      </button>

                      <small className="booking-refund-note">
                        After submission, the customer will be notified and
                        can confirm whether the refund was received. Staff
                        and administrators can monitor the submission.
                      </small>
                    </div>
                  )}

                  {/* AWAITING CUSTOMER CONFIRMATION */}
                  {selectedBooking.refund_status ===
                    'awaiting_customer_confirmation' &&
                    !selectedDispute && (
                      <div className="booking-receipt-notice">
                        <Clock size={19} />

                        <div>
                          <strong>Awaiting Customer Confirmation</strong>
                          <p>
                            Your refund transfer proof has been submitted.
                            The customer must confirm whether they received
                            the refund.
                          </p>
                        </div>
                      </div>
                    )}

                  {/* COMPLETED REFUND */}
                  {selectedBooking.refund_status === 'processed' && (
                    <div className="booking-receipt-notice">
                      <CheckCircle2 size={19} />

                      <div>
                        <strong>Refund Confirmed</strong>
                        <p>
                          The customer confirmed receipt of the refund.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* NO REFUND */}
                  {Number(selectedBooking.refund_amount ?? 0) <= 0 && (
                    <p>
                      No refund is due for this cancelled booking.
                    </p>
                  )}
                </section>
              )}

              {/* BOOKING CREATED */}
              <section className="booking-detail-section">
                <h3>
                  <Package size={16} /> Booking Record
                </h3>

                <p>
                  <strong>Booking created:</strong>{' '}
                  {formatDateTime(selectedBooking.created_at)}
                </p>
              </section>
            </div>

            <div className="booking-modal-footer">
              <button
                type="button"
                className="bookings-secondary-button"
                disabled={
                  actionLoading ||
                  refundSubmitting ||
                  disputeSubmitting ||
                  savingInternalNote
                }
                onClick={closeBookingDetails}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
