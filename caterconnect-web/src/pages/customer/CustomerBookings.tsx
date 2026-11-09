import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  ChevronRight,
  MessageSquare,
  Package,
  RefreshCw,
  Search,
  Users,
  XCircle,
  MapPin,
  ReceiptText,
  ArrowLeft,
  Info,
  CheckCircle2,
  UtensilsCrossed,
  ListChecks,
  CreditCard,
  Store,
  ShieldCheck,
  Lock,
  ExternalLink,
  AlertCircle,
  Ban,
  Wallet,
  AlertTriangle,
  FileText,
  Star,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import CustomerHeader from "./CustomerHeader";
import "./CustomerBookings.css";

type Caterer = {
  id: string;
  business_name: string;
  logo_url: string | null;
  city: string | null;
  user_id: string;
  accepted_payment_methods?: string[] | null;
};
type CateringPackage = {
  name: string;
  tier: string | null;
  description?: string | null;
  includes?: unknown;
  inclusions?: unknown;
  food_inclusions?: unknown;
  menu?: unknown;
  menu_items?: unknown;
  included_items?: unknown;
};
type Booking = {
  id: string;
  customer_id: string;
  status: string;
  event_date: string | null;
  event_time: string | null;
  event_type: string | null;
  guest_count: number | null;
  venue: string | null;
  total_cost: number | null;
  downpayment_amount: number | null;
  payment_verified_at: string | null;
  payment_submitted_at?: string | null;
  payment_reference?: string | null;
  payment_receipt_url?: string | null;
  downpayment_deadline?: string | null;
  customized_items?: unknown;
  cancelled_by?: string | null;
  refund_due_at?: string | null;
  refunded_at?: string | null;
  payment_method: string | null;
  refund_status: string | null;
  refund_amount: number | null;
  refund_account_details?: string | null;
  cancellation_reason: string | null;
  rejection_reason: string | null;
  created_at: string;
  special_requests: string | null;
  caterers: Caterer | Caterer[] | null;
  packages: CateringPackage | CateringPackage[] | null;
};
type BookingReview = {
  id: string;
  customer_id: string;
  booking_id: string;
  food_quality: number;
  service_quality: number;
  timeliness: number;
  overall: number;
  comment: string | null;
  caterer_reply: string | null;
  caterer_replied_at: string | null;
  created_at: string;
};
type RatingKey = "food_quality" | "service_quality" | "timeliness" | "overall";
const REVIEW_CATEGORIES: { key: RatingKey; label: string; icon: string }[] = [
  { key: "food_quality", label: "Food Quality", icon: "🍽️" },
  { key: "service_quality", label: "Service Quality", icon: "🤝" },
  { key: "timeliness", label: "Timeliness", icon: "⏰" },
  { key: "overall", label: "Overall", icon: "⭐" },
];
const REVIEW_STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];
const emptyReviewRatings = () => ({ food_quality: 0, service_quality: 0, timeliness: 0, overall: 0 });
type Filter =
  | "all"
  | "pending"
  | "confirmed"
  | "awaiting_payment"
  | "paid"
  | "ongoing"
  | "completed"
  | "rejected"
  | "cancelled";
const tabs: { id: Filter; label: string }[] = [
  { id: "all", label: "All Bookings" },
  { id: "pending", label: "Pending Review" },
  { id: "confirmed", label: "Confirmed" },
  { id: "awaiting_payment", label: "Awaiting Payment" },
  { id: "paid", label: "Downpayment Verified" },
  { id: "ongoing", label: "Event Ongoing" },
  { id: "completed", label: "Completed" },
  { id: "rejected", label: "Rejected" },
  { id: "cancelled", label: "Cancelled" },
];
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending Review",
  confirmed: "Confirmed",
  awaiting_payment: "Awaiting Payment",
  paid: "Downpayment Verified",
  ongoing: "Event Ongoing",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
const bookingStatusLabel = (status: string) =>
  STATUS_LABELS[status] ??
  status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Compare Manila calendar days; avoid UTC/local timezone shifting the event date.
const eventCountdown = (eventDate: string | null): string | null => {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return null;
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const manilaToday = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
  const toDay = (value: string) => {
    const [y, m, d] = value.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const days = Math.round((toDay(eventDate) - toDay(manilaToday)) / 86400000);
  if (!Number.isFinite(days)) return null;
  if (days < 0) return "Event has passed";
  if (days === 0) return "Event is today!";
  if (days === 1) return "1 day left";
  return `${days} days left`;
};
const one = <T,>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;
const peso = (value: number | null) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
      }).format(value);
const date = (value: string | null) => {
  if (!value) return "Not specified";
  const stamp = value.length === 10 ? `${value}T00:00:00` : value;
  const parsed = new Date(stamp);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};
const label = (value: string | null | undefined) =>
  value
    ? value
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Not specified";
// Read-only package display: supports both arrays and legacy JSON text.
const describeIncluded = (source: unknown): string[] => {
  if (source == null || source === "") return [];
  let value = source;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [String(value)];
    }
  }
  if (Array.isArray(value)) return value.flatMap(describeIncluded);
  if (typeof value === "object" && value !== null) {
    const row = value as Record<string, unknown>;
    const name = row.name ?? row.item_name ?? row.menu_item_name ?? row.title;
    if (name != null) {
      const count = row.quantity ?? row.qty;
      return [
        String(name) +
          (count != null ? ` × ${count}` : "") +
          (row.price_per_guest != null &&
          Number.isFinite(Number(row.price_per_guest))
            ? ` · ${peso(Number(row.price_per_guest))}/guest`
            : ""),
      ];
    }
    return Object.entries(row).flatMap(([key, item]) =>
      item == null
        ? []
        : [
            `${key.replace(/_/g, " ")}: ${typeof item === "object" ? JSON.stringify(item) : String(item)}`,
          ],
    );
  }
  return [String(value)];
};

const methodName = (method: string | null): string => {
  const codes: Record<string, string> = {
    gcash: "GCash",
    maya: "Maya",
    paymaya: "Maya",
    bpi: "BPI Online Banking",
    bdo: "BDO Online Banking",
    card: "Credit / Debit Card",
    credit_card: "Credit / Debit Card",
    debit_card: "Credit / Debit Card",
    bank_transfer: "Bank Transfer",
  };
  const normalized =
    method
      ?.trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_") ?? "";
  if (
    !normalized ||
    ["online", "online_gateway", "xendit", "unknown"].includes(normalized)
  )
    return "Payment method not recorded";
  return codes[normalized] ?? method!.trim();
};
const dateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Not recorded";

// The backend Xendit checkout and webhook are authoritative. Never write a paid
// booking status, a receipt, or a payment reference from the browser.
type PaymentMethod = "gcash" | "maya" | "bpi" | "bdo" | "card";
const PAYMENT_METHODS: {
  id: PaymentMethod;
  label: string;
  description: string;
}[] = [
  { id: "gcash", label: "GCash", description: "E-wallet" },
  { id: "maya", label: "Maya", description: "E-wallet / QR" },
  { id: "bpi", label: "BPI Online", description: "Online banking" },
  { id: "bdo", label: "BDO Online", description: "Online banking" },
  { id: "card", label: "Credit / Debit Card", description: "Card checkout" },
];
type Checkout = {
  ownerId: string;
  bookingId: string;
  amount: number;
  chargeId: string;
  checkoutUrl: string;
  webUrl?: string;
};
const activeCheckouts = new Map<string, Checkout>();
const checkoutInProgress = new Set<string>();
const checkoutKey = (uid: string, bid: string) => `${uid}:${bid}`;
const paymentUnavailable = (
  booking: Booking,
  checkout: Checkout | null,
): string | null => {
  if (
    !["confirmed", "awaiting_payment"].includes(booking.status) ||
    booking.payment_verified_at
  )
    return "This booking is not awaiting a downpayment.";
  if (booking.refund_status !== "none" || booking.payment_reference)
    return "A refund or payment reference already exists. Refresh before paying.";
  if (
    booking.payment_receipt_url &&
    booking.payment_receipt_url !== checkout?.chargeId
  )
    return "Payment verification may already be pending. Refresh before paying again.";
  if (
    !Number.isFinite(Number(booking.downpayment_amount)) ||
    Number(booking.downpayment_amount) <= 0
  )
    return "The recorded downpayment amount is invalid.";
  return null;
};
const errorMessage = (value: unknown): string =>
  value instanceof Error
    ? value.message
    : typeof value === "object" && value !== null && "message" in value
      ? String(value.message)
      : "Please refresh and try again.";
const trustedCheckoutUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    // Do not open untrusted protocols or arbitrary provider redirects.
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

// Mirror Mobile's *estimated* cancellation tiers. The Edge Function computes the final refund.
const CANCELLATION_REASONS = [
  "Event date changed",
  "Found another caterer",
  "Budget constraints",
  "Event was cancelled entirely",
  "Other",
];
const REFUND_METHODS = ["gcash", "maya", "bpi", "bdo", "other_bank"] as const;
type RefundMethod = (typeof REFUND_METHODS)[number];
type RefundEvidence = {
  id: string;
  status: string;
  created_at?: string | null;
  submitted_at?: string | null;
  transfer_reference?: string | null;
  reference_number?: string | null;
  proofUrl?: string | null;
};
type RefundDispute = {
  status: string;
  reason: string;
  created_at: string;
  caterer_response: string | null;
};
const daysBeforeEvent = (eventDate: string | null, now = new Date()): number | null => {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const today = Date.UTC(part("year"), part("month") - 1, part("day"));
  const [y, m, d] = eventDate.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86400000);
};
type CancellationEstimate = {
  days: number | null;
  percentage: number;
  amount: number;
  grace: boolean;
  available: boolean;
};
const refundEstimate = (booking: Booking | null, now = Date.now()): CancellationEstimate => {
  const days = booking ? daysBeforeEvent(booking.event_date, new Date(now)) : null;
  if (!booking || days === null)
    return { days, percentage: 0, amount: 0, grace: false, available: false };
  const verified = booking.status === "paid" && !!booking.payment_verified_at;
  if (!verified || days < 7)
    return { days, percentage: 0, amount: 0, grace: false, available: true };
  const hours = (now - new Date(booking.payment_verified_at!).getTime()) / 3600000;
  const grace = Number.isFinite(hours) && hours >= 0 && hours <= 24;
  const percentage =
    grace || days >= 30 ? 100 : days >= 15 ? 75 : days >= 8 ? 50 : 25;
  return {
    days,
    percentage,
    amount: Math.round(Number(booking.downpayment_amount ?? 0) * percentage) / 100,
    grace,
    available: true,
  };
};

// Supabase FunctionHttpError may carry a JSON response with a useful, safe message.
const cancellationFunctionError = async (error: unknown): Promise<string> => {
  if (error && typeof error === "object" && "context" in error) {
    const context = error.context;
    if (context && typeof context === "object" && "json" in context &&
        typeof context.json === "function") {
      try {
        const payload: unknown = await context.json();
        if (payload && typeof payload === "object" && "error" in payload &&
            typeof payload.error === "string" && payload.error.length <= 500) {
          return payload.error;
        }
      } catch { /* Preserve the normal function error when no JSON body exists. */ }
    }
  }
  return errorMessage(error);
};
const refundDetails = (
  method: RefundMethod,
  holder: string,
  number: string,
  bank: string,
) => ({
  method,
  bank_name:
    method === "other_bank"
      ? bank.trim()
      : method === "bpi"
        ? "BPI"
        : method === "bdo"
          ? "BDO"
          : null,
  account_holder: holder.trim(),
  account_number: number.trim(),
});
const validateRefundDetails = (
  method: RefundMethod,
  holder: string,
  number: string,
  bank: string,
): string | null => {
  const wallet = method === "gcash" || method === "maya";
  if (
    !holder.trim() ||
    !number.trim() ||
    (method === "other_bank" && !bank.trim())
  )
    return "Enter the account holder, account number, and bank name if applicable.";
  if (holder.trim().length > 120 || bank.trim().length > 120)
    return "Account or bank name is too long (maximum 120 characters).";
  if (
    !(wallet
      ? /^09\d{9}$/.test(number.trim())
      : /^\d{6,20}$/.test(number.trim()))
  )
    return wallet
      ? "Enter an 11-digit Philippine wallet number starting with 09."
      : "Enter a 6–20 digit bank account number.";
  return null;
};
const displayRefundAccount = (raw: string | null | undefined) => {
  if (!raw) return "Not provided";
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (!obj || typeof obj !== "object" || Array.isArray(obj))
      return "Account details recorded";
    // Mask sensitive account data in the summary; the intended recipient is already identified server-side.
    const method = String(obj.method ?? "Account").replace(/_/g, " ");
    const number = String(obj.account_number ?? obj.mobile_number ?? "");
    return `${method.toUpperCase()}${number ? ` · ending ${number.slice(-4)}` : ""}`;
  } catch {
    return "Account details recorded";
  }
};

const matches = (status: string, filter: Filter) =>
  filter === "all" || status === filter;
const stages = ["Requested", "Confirmed", "Downpayment", "Completed"];
const stageIndex = (status: string) => {
  if (status === "completed") return 3;
  if (["paid", "ongoing"].includes(status)) return 2;
  if (["confirmed", "awaiting_payment"].includes(status)) return 1;
  return 0;
};

export default function CustomerBookings() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const linkedBookingId = searchParams.get("bookingId");
  const openedLinkedBooking = useRef<string | null>(null);
  const userId = session?.user?.id;
  const [rows, setRows] = useState<Booking[]>([]);
  const [reviewsByBooking, setReviewsByBooking] = useState<Record<string, BookingReview>>({});
  const [reviewsError, setReviewsError] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewRatings, setReviewRatings] = useState(emptyReviewRatings);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const reviewInFlight = useRef(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("gcash");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const paymentScope = useRef("");
  // Phase 4D: all financial/status changes go through the installed server functions.
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("gcash");
  const [refundHolder, setRefundHolder] = useState("");
  const [refundNumber, setRefundNumber] = useState("");
  const [refundBank, setRefundBank] = useState("");
  const [refundDestinationId, setRefundDestinationId] = useState<string | null>(
    null,
  );
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const refundInFlight = useRef(false);
  const [refundError, setRefundError] = useState("");
  const [cancellationNow, setCancellationNow] = useState(() => Date.now());
  const [refundNotice, setRefundNotice] = useState("");
  const [evidence, setEvidence] = useState<RefundEvidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [currentDispute, setCurrentDispute] = useState<RefundDispute | null>(
    null,
  );
  const [refundDetailError, setRefundDetailError] = useState("");
  const [refundDetailsVersion, setRefundDetailsVersion] = useState(0);
  const cancelBooking = rows.find((b) => b.id === cancelId) ?? null;
  const destinationBooking =
    rows.find((b) => b.id === refundDestinationId) ?? null;
  const disputeBooking = rows.find((b) => b.id === disputeId) ?? null;
  const cancellationPreview = refundEstimate(cancelBooking, cancellationNow);
  // Keep the estimate current while the modal is open. Re-read before the final write.
  useEffect(() => {
    if (!cancelId) return;
    setCancellationNow(Date.now());
    const timer = window.setInterval(() => setCancellationNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, [cancelId]);
  const clearRefundFields = () => {
    setRefundMethod("gcash");
    setRefundHolder("");
    setRefundNumber("");
    setRefundBank("");
    setCancelReason("");
    setOtherReason("");
    setRefundError("");
  };
  const openCancellation = (booking: Booking) => {
    clearRefundFields();
    setRefundNotice("");
    setCancelId(booking.id);
    setSelectedId(null);
  };
  const openRefundDestination = (booking: Booking) => {
    clearRefundFields();
    setRefundNotice("");
    setRefundDestinationId(booking.id);
    setSelectedId(null);
  };
  const getFreshForRefund = async (id: string) => {
    if (!userId) throw new Error("Sign in to continue.");
    return freshBooking(id, userId);
  };
  const submitCancellation = async () => {
    if (!cancelBooking || !userId || refundInFlight.current) return;
    const reason = cancelReason === "Other" ? otherReason.trim() : cancelReason;
    if (reason.length < 3 || reason.length > 1000) {
      setRefundError("Choose a cancellation reason (3–1,000 characters).");
      return;
    }
    refundInFlight.current = true;
    setRefundBusy(true);
    setRefundError("");
    try {
      const latest = await getFreshForRefund(cancelBooking.id);
      if (!["pending", "confirmed", "paid"].includes(latest.status))
        throw new Error(
          "This booking is no longer eligible for Customer cancellation. Refresh the page.",
        );
      const estimate = refundEstimate(latest);
      if (!estimate.available) {
        throw new Error("The event date is unavailable. Refresh your booking before cancelling.");
      }
      // The database decides the final refund. Stop if the preview is no longer
      // representative (status, payment, dates, or amounts changed), so the user
      // can review the updated account requirements before submitting.
      const previewChanged =
        latest.status !== cancelBooking.status ||
        latest.event_date !== cancelBooking.event_date ||
        latest.payment_verified_at !== cancelBooking.payment_verified_at ||
        Number(latest.downpayment_amount ?? 0) !== Number(cancelBooking.downpayment_amount ?? 0) ||
        estimate.percentage !== cancellationPreview.percentage ||
        estimate.amount !== cancellationPreview.amount ||
        estimate.grace !== cancellationPreview.grace ||
        estimate.days !== cancellationPreview.days;
      if (previewChanged) {
        setRows((current) => current.map((item) => item.id === latest.id
          ? { ...item, ...latest, caterers: item.caterers, packages: item.packages }
          : item));
        setCancellationNow(Date.now());
        throw new Error("Booking or refund details changed. Please review the updated estimate and confirm again.");
      }
      let account: ReturnType<typeof refundDetails> | null = null;
      if (estimate.amount > 0) {
        const invalid = validateRefundDetails(
          refundMethod,
          refundHolder,
          refundNumber,
          refundBank,
        );
        if (invalid) throw new Error(invalid);
        account = refundDetails(
          refundMethod,
          refundHolder,
          refundNumber,
          refundBank,
        );
      }
      const { data, error } = await supabase.functions.invoke(
        "cancel-customer-booking",
        {
          body: {
            booking_id: latest.id,
            reason,
            refund_account_details: account,
          },
        },
      );
      if (error) throw new Error(await cancellationFunctionError(error));
      if (!data?.success || !data?.booking)
        throw new Error(
          data?.error ?? "The server did not confirm cancellation.",
        );
      setCancelId(null);
      clearRefundFields();
      setRefundNotice(
        `Booking cancelled. Final refund recorded: ${peso(Number(data.booking.refund_amount ?? 0))} (${Number(data.booking.refund_percentage ?? 0)}%).`,
      );
      await load();
    } catch (cause) {
      setRefundError(errorMessage(cause));
    } finally {
      setRefundBusy(false);
      refundInFlight.current = false;
    }
  };
  const submitRefundDestination = async () => {
    if (!destinationBooking || refundInFlight.current) return;
    const invalid = validateRefundDetails(
      refundMethod,
      refundHolder,
      refundNumber,
      refundBank,
    );
    if (invalid) {
      setRefundError(invalid);
      return;
    }
    refundInFlight.current = true;
    setRefundBusy(true);
    setRefundError("");
    try {
      const latest = await getFreshForRefund(destinationBooking.id);
      if (
        latest.status !== "cancelled" ||
        latest.cancelled_by !== "caterer" ||
        Number(latest.refund_amount) <= 0 ||
        latest.refund_account_details
      )
        throw new Error(
          "This booking no longer needs a refund account. Refresh to see its status.",
        );
      const { error } = await supabase.rpc("submit_emergency_refund_account", {
        p_booking_id: latest.id,
        p_account_details: refundDetails(
          refundMethod,
          refundHolder,
          refundNumber,
          refundBank,
        ),
      });
      if (error) throw error;
      setRefundDestinationId(null);
      clearRefundFields();
      setRefundNotice(
        "Your refund account was submitted. The caterer must arrange the transfer. Never share an OTP or PIN.",
      );
      await load();
    } catch (cause) {
      setRefundError(errorMessage(cause));
    } finally {
      setRefundBusy(false);
      refundInFlight.current = false;
    }
  };
  const confirmRefund = async (booking: Booking) => {
    if (
      refundInFlight.current ||
      !window.confirm(
        `Confirm only if ${peso(booking.refund_amount)} has actually arrived in your account. A screenshot alone is not proof of receipt. Continue?`,
      )
    )
      return;
    refundInFlight.current = true;
    setRefundBusy(true);
    setRefundDetailError("");
    try {
      const latest = await getFreshForRefund(booking.id);
      if (
        latest.status !== "cancelled" ||
        latest.refund_status !== "awaiting_customer_confirmation"
      )
        throw new Error("Refund status changed. Refresh before confirming.");
      const { data, error } = await supabase.functions.invoke(
        "confirm-customer-refund",
        { body: { booking_id: latest.id } },
      );
      if (error) throw error;
      if (!data?.success || data.refund_status !== "processed")
        throw new Error(
          data?.error ?? "The server did not confirm the refund.",
        );
      setRefundNotice("Refund receipt confirmed by the server.");
      await load();
      setRefundDetailsVersion((v) => v + 1);
    } catch (cause) {
      setRefundDetailError(errorMessage(cause));
    } finally {
      setRefundBusy(false);
      refundInFlight.current = false;
    }
  };
  const submitDispute = async () => {
    if (!disputeBooking || !userId || refundInFlight.current) return;
    const reason = disputeReason.trim();
    if (reason.length < 10 || reason.length > 2000) {
      setRefundError("Describe the refund issue in 10–2,000 characters.");
      return;
    }
    refundInFlight.current = true;
    setRefundBusy(true);
    setRefundError("");
    try {
      const latest = await getFreshForRefund(disputeBooking.id);
      if (
        latest.status !== "cancelled" ||
        latest.refund_status !== "awaiting_customer_confirmation" ||
        Number(latest.refund_amount) <= 0
      )
        throw new Error("This refund is not awaiting customer confirmation.");
      const { data: transfer, error: evidenceError } = await supabase
        .from("refund_transfer_submissions")
        .select("booking_id")
        .eq("booking_id", latest.id)
        .in("status", ["submitted", "verified"])
        .limit(1);
      if (evidenceError) throw evidenceError;
      if (!transfer?.length)
        throw new Error(
          "A refund transfer submission is required before reporting a missing transfer.",
        );
      const { error } = await supabase
        .from("refund_disputes")
        .insert({ booking_id: latest.id, customer_id: userId, reason });
      if (error) throw error;
      setDisputeId(null);
      setDisputeReason("");
      setRefundNotice(
        "Missing-refund report submitted. The refund remains unresolved.",
      );
      setRefundDetailsVersion((v) => v + 1);
      await load();
    } catch (cause) {
      setRefundError(errorMessage(cause));
    } finally {
      setRefundBusy(false);
      refundInFlight.current = false;
    }
  };

  paymentScope.current = `${userId ?? ""}:${paymentBookingId ?? ""}`;
  const paymentBooking =
    rows.find((booking) => booking.id === paymentBookingId) ?? null;
  const paymentCaterer = paymentBooking ? one(paymentBooking.caterers) : null;
  const availableMethods = PAYMENT_METHODS.filter(
    (method) =>
      !paymentCaterer?.accepted_payment_methods?.length ||
      paymentCaterer.accepted_payment_methods.includes(method.id),
  );
  const freshBooking = async (id: string, owner: string): Promise<Booking> => {
    const { data, error: readError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .eq("customer_id", owner)
      .maybeSingle();
    if (readError) throw readError;
    if (!data) throw new Error("Booking unavailable. Refresh My Bookings.");
    return data as Booking;
  };
  const openPayment = (booking: Booking) => {
    if (!userId) return;
    const stored = activeCheckouts.get(checkoutKey(userId, booking.id)) ?? null;
    setCheckout(stored);
    setPaymentError("");
    setPaymentNotice("");
    const caterer = one(booking.caterers);
    const allowed = PAYMENT_METHODS.filter(
      (method) =>
        !caterer?.accepted_payment_methods?.length ||
        caterer.accepted_payment_methods.includes(method.id),
    );
    setPaymentMethod(allowed[0]?.id ?? "gcash");
    setPaymentBookingId(booking.id);
  };
  const startPayment = async () => {
    if (!paymentBooking || !userId || paymentBusy) return;
    const id = paymentBooking.id;
    const scope = checkoutKey(userId, id);
    if (checkoutInProgress.has(scope)) return;
    const isCurrent = () => paymentScope.current === scope;
    checkoutInProgress.add(scope);
    setPaymentBusy(true);
    setPaymentError("");
    try {
      if (!availableMethods.some((method) => method.id === paymentMethod))
        throw new Error(
          "This caterer does not support the selected checkout method.",
        );
      const current = await freshBooking(id, userId);
      if (!isCurrent()) return;
      const existing = activeCheckouts.get(scope) ?? null;
      const unavailable = paymentUnavailable(current, existing);
      if (unavailable) throw new Error(unavailable);
      if (existing) {
        if (Number(current.downpayment_amount) !== existing.amount)
          throw new Error(
            "The amount changed during checkout. Contact support before attempting another payment.",
          );
        setCheckout(existing);
        setPaymentNotice(
          "Your existing checkout is ready. Open it below, or check its payment status.",
        );
        return;
      }
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user || auth.user.id !== userId)
        throw new Error("Please sign in again before making a payment.");
      const { data, error: functionError } = await supabase.functions.invoke(
        "xendit-payment",
        {
          body: {
            type: "booking",
            amount: Number(current.downpayment_amount),
            referenceId: `booking_${id}_${Date.now()}`,
            customerName: String(
              auth.user.user_metadata?.full_name ||
                auth.user.email ||
                "Customer",
            ),
            customerEmail: auth.user.email ?? "",
            description: `Downpayment for Booking #${id.slice(0, 8)}`,
            paymentMethod,
          },
        },
      );
      if (functionError || data?.error)
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : data?.error?.message ||
                functionError?.message ||
                "Checkout could not be created.",
        );
      if (!isCurrent()) return;
      const checkoutUrl = trustedCheckoutUrl(data?.checkoutUrl);
      if (!checkoutUrl || typeof data?.chargeId !== "string" || !data.chargeId)
        throw new Error(
          "Xendit did not provide a valid checkout link and charge ID.",
        );
      const attempt: Checkout = {
        ownerId: userId,
        bookingId: id,
        amount: Number(current.downpayment_amount),
        chargeId: data.chargeId,
        checkoutUrl,
        webUrl: trustedCheckoutUrl(data?.webUrl) ?? undefined,
      };
      activeCheckouts.set(scope, attempt);
      setCheckout(attempt);
      setPaymentNotice(
        "Checkout prepared. Open the secure Xendit page to complete your payment.",
      );
    } catch (cause) {
      if (isCurrent()) setPaymentError(errorMessage(cause));
    } finally {
      checkoutInProgress.delete(scope);
      if (isCurrent()) setPaymentBusy(false);
    }
  };
  const checkPayment = async () => {
    if (!checkout || !paymentBookingId || !userId || paymentBusy) return;
    const scope = checkoutKey(userId, paymentBookingId);
    const isCurrent = () => paymentScope.current === scope;
    setPaymentBusy(true);
    setPaymentError("");
    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        "xendit-check-status",
        {
          body: { chargeId: checkout.chargeId },
        },
      );
      if (functionError) throw functionError;
      if (!isCurrent()) return;
      const status = String(data?.status ?? "").toUpperCase();
      if (
        ["SUCCEEDED", "PAID"].includes(status) &&
        data?.databaseConfirmed === true
      ) {
        const fresh = await freshBooking(paymentBookingId, userId);
        if (!isCurrent()) return;
        if (!fresh.payment_verified_at) {
          setPaymentNotice(
            "Xendit reports success, but booking verification is still being synchronized. Refresh shortly.",
          );
        } else {
          activeCheckouts.delete(scope);
          setCheckout(null);
          setPaymentNotice(
            "Downpayment verified by the server. Your booking record is updated.",
          );
        }
      } else if (["FAILED", "VOIDED", "EXPIRED"].includes(status)) {
        activeCheckouts.delete(scope);
        setCheckout(null);
        setPaymentNotice(
          "Xendit reports that this attempt failed or expired. Refresh before trying again.",
        );
      } else {
        setPaymentNotice(
          "Payment is still pending or awaiting server verification. Do not start another payment.",
        );
      }
      await load();
    } catch (cause) {
      if (isCurrent()) setPaymentError(errorMessage(cause));
    } finally {
      if (isCurrent()) setPaymentBusy(false);
    }
  };

  const load = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setReviewsByBooking({});
      setReviewsError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setReviewsError("");
    try {
      // Mirrors the Mobile customer-owned booking query. Reading this page never modifies booking status.
      const { data, error: queryError } = await supabase
        .from("bookings")
        .select(
          "*,caterers(id,business_name,logo_url,city,user_id,accepted_payment_methods),packages(*)",
        )
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      const bookings = (data ?? []) as unknown as Booking[];
      setRows(bookings);
      // Review lookup is independent: a review/RLS error must not hide bookings.
      const found: Record<string, BookingReview> = {};
      const bookingIds = bookings.map((booking) => booking.id);
      try {
        for (let offset = 0; offset < bookingIds.length; offset += 80) {
          const batch = bookingIds.slice(offset, offset + 80);
          for (let page = 0; ; page += 500) {
            const reviewResponse: { data: BookingReview[] | null; error: { message: string } | null } = await supabase
              .from("reviews")
              .select("id,booking_id,customer_id,food_quality,service_quality,timeliness,overall,comment,caterer_reply,caterer_replied_at,created_at")
              .eq("customer_id", userId)
              .in("booking_id", batch)
              .order("created_at", { ascending: false })
              .range(page * 500, page * 500 + 499);
            if (reviewResponse.error) throw new Error(reviewResponse.error.message);
            const reviewRows: BookingReview[] = reviewResponse.data ?? [];
            for (const review of reviewRows) {
              if (review.customer_id === userId && batch.includes(review.booking_id) && !found[review.booking_id]) {
                found[review.booking_id] = review as BookingReview;
              }
            }
            if (reviewRows.length < 500) break;
          }
        }
        setReviewsByBooking(found);
      } catch (reviewCause) {
        setReviewsByBooking({});
        setReviewsError(`Review information could not be loaded: ${errorMessage(reviewCause)}. Refresh to retry.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load bookings.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Open only a booking returned by the customer-owned query. This also works
  // when a notification points to a booking hidden by the selected status tab.
  useEffect(() => {
    if (!linkedBookingId || loading || openedLinkedBooking.current === `${userId}:${linkedBookingId}`) return;
    if (rows.some((row) => row.id === linkedBookingId)) {
      openedLinkedBooking.current = `${userId}:${linkedBookingId}`;
      setSelectedId(linkedBookingId);
    }
  }, [linkedBookingId, loading, rows, userId]);

  // Read transfer status and a prior dispute only for the active, customer-owned cancelled booking.
  useEffect(() => {
    const selected = rows.find((b) => b.id === selectedId);
    let active = true;
    setEvidence([]);
    setCurrentDispute(null);
    setRefundDetailError("");
    if (
      !selected ||
      !userId ||
      selected.status !== "cancelled" ||
      Number(selected.refund_amount) <= 0
    )
      return;
    const readRefund = async () => {
      setEvidenceLoading(true);
      try {
        const { data: transfers, error } = await supabase
          .from("refund_transfer_submissions")
          .select("*")
          .eq("booking_id", selected.id);
        if (error) throw error;
        const results = await Promise.all(
          (transfers ?? []).map(async (row: Record<string, unknown>) => {
            const path =
              row.proof_storage_path ??
              row.proof_path ??
              row.receipt_path ??
              row.storage_path;
            let proofUrl: string | null = null;
            if (typeof path === "string" && path) {
              const { data: signed, error: signError } = await supabase.storage
                .from("refund-proofs")
                .createSignedUrl(path, 600);
              if (!signError) proofUrl = signed?.signedUrl ?? null;
            }
            return { ...row, proofUrl } as RefundEvidence;
          }),
        );
        const { data: disputes, error: disputeError } = await supabase
          .from("refund_disputes")
          .select("status,reason,created_at,caterer_response")
          .eq("booking_id", selected.id)
          .limit(1);
        if (disputeError) throw disputeError;
        if (active) {
          setEvidence(results);
          setCurrentDispute((disputes?.[0] ?? null) as RefundDispute | null);
        }
      } catch (cause) {
        if (active) setRefundDetailError(errorMessage(cause));
      } finally {
        if (active) setEvidenceLoading(false);
      }
    };
    void readRefund();
    return () => {
      active = false;
    };
  }, [selectedId, userId, rows, refundDetailsVersion]);

  const openReview = (booking: Booking) => {
    if (!userId || booking.status !== "completed" || reviewsError || reviewsByBooking[booking.id]) return;
    setReviewId(booking.id);
    setReviewRatings(emptyReviewRatings());
    setReviewComment("");
    setReviewError("");
    setSelectedId(null);
  };
  const submitReview = async () => {
    if (!reviewId || !userId || reviewInFlight.current) return;
    if (REVIEW_CATEGORIES.some(({ key }) => reviewRatings[key] < 1 || reviewRatings[key] > 5)) {
      setReviewError("Please rate all four categories before submitting.");
      return;
    }
    reviewInFlight.current = true;
    setReviewBusy(true);
    setReviewError("");
    try {
      // Recheck the customer's booking and existing review before inserting.
      // Supabase RLS/constraints must independently enforce review eligibility.
      const latest = await freshBooking(reviewId, userId);
      if (latest.status !== "completed") throw new Error("Only completed bookings can be reviewed.");
      const catererId = (latest as Booking & { caterer_id?: string }).caterer_id;
      if (!catererId) throw new Error("Caterer information is missing. Refresh My Bookings.");
      const { data: existing, error: existingError } = await supabase.from("reviews")
        .select("id").eq("customer_id", userId).eq("booking_id", reviewId).limit(1);
      if (existingError) throw existingError;
      if (existing?.length) {
        setReviewId(null);
        await load();
        throw new Error("You have already reviewed this booking. Your review has been refreshed.");
      }
      const { error: insertError } = await supabase.from("reviews").insert({
        booking_id: reviewId,
        customer_id: userId,
        caterer_id: catererId,
        food_quality: reviewRatings.food_quality,
        service_quality: reviewRatings.service_quality,
        timeliness: reviewRatings.timeliness,
        overall: reviewRatings.overall,
        comment: reviewComment.trim() || null,
      });
      if (insertError) throw insertError;
      setReviewId(null);
      setReviewNotice("Thank you! Your review has been submitted.");
      await load();
    } catch (cause) {
      setReviewError(errorMessage(cause));
    } finally {
      setReviewBusy(false);
      reviewInFlight.current = false;
    }
  };
  const reviewBooking = rows.find((b) => b.id === reviewId) ?? null;
  const reviewCaterer = reviewBooking ? one(reviewBooking.caterers) : null;
  const reviewAverage = REVIEW_CATEGORIES.every(({ key }) => reviewRatings[key] > 0)
    ? (REVIEW_CATEGORIES.reduce((sum, { key }) => sum + reviewRatings[key], 0) / 4).toFixed(1)
    : null;
  const renderReview = (review: BookingReview) => (
    <div className="cc-cb-review-readonly" key={review.id}>
      <div className="cc-cb-review-overall">
        <span aria-label={`Overall rating ${review.overall} out of 5`}>
          {[1, 2, 3, 4, 5].map((value) => <Star key={value} size={19} fill={value <= review.overall ? "currentColor" : "none"} />)}
        </span>
        <strong>{review.overall}/5</strong>
        <small>{date(review.created_at)}</small>
      </div>
      <p className="cc-cb-review-comment">{review.comment || "No written comment provided."}</p>
      <p className="cc-cb-review-subratings">Food {review.food_quality}/5 · Service {review.service_quality}/5 · Timeliness {review.timeliness}/5</p>
      {review.caterer_reply ? <div className="cc-cb-review-reply">
        <strong>Caterer Reply</strong>
        <p>{review.caterer_reply}</p>
        {review.caterer_replied_at && <small>{date(review.caterer_replied_at)}</small>}
      </div> : <p className="cc-cb-review-subratings">The caterer has not replied yet.</p>}
    </div>
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (b) =>
        matches(b.status, filter) &&
        (!q ||
          [
            b.id,
            one(b.caterers)?.business_name,
            one(b.packages)?.name,
            b.event_type,
            b.venue,
          ].some((v) =>
            String(v ?? "")
              .toLowerCase()
              .includes(q),
          )),
    );
  }, [rows, filter, search]);
  const selected = rows.find((b) => b.id === selectedId) ?? null;
  const selectedCaterer = selected ? one(selected.caterers) : null;
  const selectedPackage = selected ? one(selected.packages) : null;
  const isStopped =
    selected?.status === "cancelled" || selected?.status === "rejected";

  return (
    <div className="cc-cb-page">
      <CustomerHeader activePage="bookings" />
      <main className="cc-cb-main">
        <Link className="cc-cb-back" to="/customer">
          <ArrowLeft size={16} /> Back to Marketplace
        </Link>
        <div className="cc-cb-heading">
          <div>
            <span className="cc-cb-eyebrow">
              <CalendarDays size={16} /> YOUR EVENTS
            </span>
            <h1>My Bookings</h1>
            <p>
              Track your catering requests and view important event details.
            </p>
          </div>
          <button
            className="cc-cb-refresh"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? "cc-cb-spin" : ""} />{" "}
            Refresh
          </button>
        </div>
        <div className="cc-cb-toolbar">
          <div className="cc-cb-tabs" role="group" aria-label="Filter bookings">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={filter === t.id ? "active" : ""}
                onClick={() => setFilter(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="cc-cb-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bookings, caterers or events"
              aria-label="Search bookings"
            />
          </label>
        </div>
        {reviewNotice && (
          <div className="cc-cb-refund-banner" role="status">
            <CheckCircle2 size={17} /> {reviewNotice}
            <button type="button" aria-label="Dismiss review notification" onClick={() => setReviewNotice("")}><XCircle size={17} /></button>
          </div>
        )}
        {reviewsError && (
          <div className="cc-cb-error" role="alert">{reviewsError} <button type="button" onClick={() => void load()}>Retry</button></div>
        )}
        {refundNotice && (
          <div className="cc-cb-refund-banner" role="status">
            <CheckCircle2 size={17} />
            {refundNotice}
            <button
              type="button"
              onClick={() => setRefundNotice("")}
              aria-label="Dismiss notification"
            >
              <XCircle size={17} />
            </button>
          </div>
        )}
        {error && (
          <div className="cc-cb-error" role="alert">
            {error}{" "}
            <button type="button" onClick={() => void load()}>
              Retry
            </button>
          </div>
        )}
        {loading ? (
          <div className="cc-cb-empty">
            <RefreshCw className="cc-cb-spin" size={30} />
            <h2>Loading bookings...</h2>
          </div>
        ) : filtered.length === 0 ? (
          <div className="cc-cb-empty">
            <CalendarDays size={43} />
            <h2>{rows.length ? "No matching bookings" : "No bookings yet"}</h2>
            <p>
              {rows.length
                ? "Try a different search or status."
                : "Browse catering packages to plan your next event."}
            </p>
            <Link to="/customer#browse">Explore Caterers</Link>
          </div>
        ) : (
          <div className="cc-cb-grid">
            {filtered.map((b) => {
              const caterer = one(b.caterers);
              const pkg = one(b.packages);
              return (
                <article className="cc-cb-card" key={b.id}>
                  <div className="cc-cb-card-head">
                    <span className={`cc-cb-status cc-cb-status-${b.status}`}>
                      {bookingStatusLabel(b.status)}
                    </span>
                    <span className="cc-cb-created">
                      Requested {date(b.created_at)}
                    </span>
                  </div>
                  <div className="cc-cb-provider">
                    {caterer?.logo_url ? (
                      <img src={caterer.logo_url} alt="" />
                    ) : (
                      <span className="cc-cb-fallback">
                        <Package size={23} />
                      </span>
                    )}
                    <div>
                      <h2>{caterer?.business_name ?? "Catering Service"}</h2>
                      <p>{pkg?.name ?? "Custom booking"}</p>
                    </div>
                  </div>
                  {!["cancelled", "rejected"].includes(b.status) &&
                    eventCountdown(b.event_date) && (
                      <div className="cc-cb-countdown">
                        <CalendarDays size={15} />
                        {eventCountdown(b.event_date)}
                      </div>
                    )}
                  <div className="cc-cb-facts">
                    <span>
                      <CalendarDays size={16} />
                      {date(b.event_date)}
                    </span>
                    <span>
                      <Users size={16} />
                      {b.guest_count ?? "—"} guests
                    </span>
                    <span>
                      <MapPin size={16} />
                      {b.venue || caterer?.city || "Venue not specified"}
                    </span>
                  </div>
                  {b.status === "completed" && (
                    <div className="cc-cb-card-review">
                      {reviewsByBooking[b.id] ? <span className="cc-cb-reviewed-badge"><CheckCircle2 size={16} /> Review Submitted</span>
                        : <button type="button" className="cc-cb-review-trigger" disabled={!!reviewsError} onClick={() => openReview(b)}><Star size={17} /> Write Review</button>}
                    </div>
                  )}
                  <div className="cc-cb-card-bottom">
                    <div>
                      <small>Estimated Total</small>
                      <strong>{peso(b.total_cost)}</strong>
                    </div>
                    <button type="button" onClick={() => setSelectedId(b.id)}>
                      View Details <ChevronRight size={17} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className="cc-cb-note">
          <Info size={16} /> Booking statuses and downpayment amounts are read
          from Supabase. Checkout uses the existing Xendit functions; only the
          trusted server can verify a payment. Cancellation and refund requests
          use the existing trusted backend. Reviews are available for completed bookings.
        </p>
      </main>
      {paymentBooking && (
        <div
          className="cc-cb-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !paymentBusy)
              setPaymentBookingId(null);
          }}
        >
          <section
            className="cc-cb-modal cc-cb-pay-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-cb-payment-title"
          >
            <header>
              <div>
                <span className="cc-cb-eyebrow">
                  <ShieldCheck size={16} /> SECURE CHECKOUT
                </span>
                <h2 id="cc-cb-payment-title">Pay Downpayment</h2>
                <p>Booking #{paymentBooking.id.slice(0, 8)}</p>
              </div>
              <button
                type="button"
                className="cc-cb-close"
                aria-label="Close payment"
                disabled={paymentBusy}
                onClick={() => setPaymentBookingId(null)}
              >
                <XCircle size={23} />
              </button>
            </header>
            <div className="cc-cb-detail-content">
              <div className="cc-cb-pay-summary">
                <h3>
                  <ReceiptText size={18} /> Booking Summary
                </h3>
                <dl className="cc-cb-detail-grid">
                  <div>
                    <dt>Caterer</dt>
                    <dd>
                      {paymentCaterer?.business_name || "Catering Service"}
                    </dd>
                  </div>
                  <div>
                    <dt>Package</dt>
                    <dd>
                      {one(paymentBooking.packages)?.name || "Catering Package"}
                    </dd>
                  </div>
                  <div>
                    <dt>Event Date</dt>
                    <dd>{date(paymentBooking.event_date)}</dd>
                  </div>
                  <div>
                    <dt>Guests</dt>
                    <dd>{paymentBooking.guest_count ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Total Cost</dt>
                    <dd>{peso(paymentBooking.total_cost)}</dd>
                  </div>
                  <div>
                    <dt>Balance After Downpayment</dt>
                    <dd>
                      {paymentBooking.total_cost != null &&
                      paymentBooking.downpayment_amount != null
                        ? peso(
                            Math.max(
                              0,
                              paymentBooking.total_cost -
                                paymentBooking.downpayment_amount,
                            ),
                          )
                        : "—"}
                    </dd>
                  </div>
                </dl>
                <div className="cc-cb-pay-due">
                  <span>Required downpayment</span>
                  <strong>{peso(paymentBooking.downpayment_amount)}</strong>
                </div>
                <p className="cc-cb-detail-footnote">
                  <AlertCircle size={15} /> Recorded deadline:{" "}
                  {dateTime(paymentBooking.downpayment_deadline)}. The
                  backend—not the browser—determines eligibility.
                </p>
              </div>
              <h3>
                <CreditCard size={18} /> Select Payment Method
              </h3>
              {availableMethods.length === 0 ? (
                <p className="cc-cb-alert">
                  The caterer has no supported Xendit methods configured.
                </p>
              ) : (
                <div
                  className="cc-cb-pay-methods"
                  role="radiogroup"
                  aria-label="Payment method"
                >
                  {availableMethods.map((method) => (
                    <label
                      key={method.id}
                      className={`cc-cb-pay-method ${paymentMethod === method.id ? "active" : ""}`}
                    >
                      <input
                        type="radio"
                        name="cc-cb-payment-method"
                        value={method.id}
                        checked={paymentMethod === method.id}
                        disabled={paymentBusy || !!checkout}
                        onChange={() => setPaymentMethod(method.id)}
                      />
                      <span>
                        <strong>{method.label}</strong>
                        <small>{method.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {paymentError && (
                <p className="cc-cb-error" role="alert">
                  {paymentError}
                </p>
              )}
              {paymentNotice && (
                <p className="cc-cb-pay-notice" role="status">
                  {paymentNotice}
                </p>
              )}
              {checkout && (
                <div className="cc-cb-pay-continued">
                  <a
                    className="cc-cb-pay-link"
                    href={checkout.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={17} /> Open Xendit Checkout
                  </a>
                  <button
                    type="button"
                    onClick={() => void checkPayment()}
                    disabled={paymentBusy}
                  >
                    <RefreshCw
                      size={16}
                      className={paymentBusy ? "cc-cb-spin" : ""}
                    />{" "}
                    Check Payment Status
                  </button>
                  <small>
                    Keep this page open while completing checkout in the new
                    tab. Do not start a second payment.
                  </small>
                </div>
              )}
              <p className="cc-cb-detail-footnote">
                <ShieldCheck size={15} /> Never share your OTP or PIN. Payment
                is recognized only after server verification.
              </p>
            </div>
            <footer>
              {!checkout && (
                <button
                  type="button"
                  className="cc-cb-pay-action"
                  onClick={() => void startPayment()}
                  disabled={
                    paymentBusy ||
                    availableMethods.length === 0 ||
                    !!paymentUnavailable(paymentBooking, null)
                  }
                >
                  <Lock size={17} />{" "}
                  {paymentBusy
                    ? "Preparing checkout…"
                    : `Continue to Xendit · ${peso(paymentBooking.downpayment_amount)}`}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPaymentBookingId(null)}
                disabled={paymentBusy}
              >
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
      {(cancelBooking || destinationBooking) && (
        <div
          className="cc-cb-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !refundBusy) {
              setCancelId(null);
              setRefundDestinationId(null);
              clearRefundFields();
            }
          }}
        >
          <section
            className="cc-cb-modal cc-cb-refund-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-cb-refund-title"
          >
            <header>
              <div>
                <span className="cc-cb-eyebrow">
                  <Wallet size={16} /> BOOKING & REFUNDS
                </span>
                <h2 id="cc-cb-refund-title">
                  {cancelBooking ? "Cancel Booking" : "Submit Refund Account"}
                </h2>
                <p>
                  Booking #
                  {(cancelBooking ?? destinationBooking)!.id.slice(0, 8)}
                </p>
              </div>
              <button
                type="button"
                className="cc-cb-close"
                disabled={refundBusy}
                onClick={() => {
                  setCancelId(null);
                  setRefundDestinationId(null);
                  clearRefundFields();
                }}
                aria-label="Close"
              >
                <XCircle size={22} />
              </button>
            </header>
            <div className="cc-cb-detail-content">
              {cancelBooking && (
                <>
                  <p className="cc-cb-muted">
                    Pending requests can be cancelled without a refund. Only
                    verified payments may qualify for a refund. The final amount
                    is calculated by the server.
                  </p>
                  <div className="cc-cb-refund-preview" aria-live="polite">
                    <small>Estimated Cancellation Refund</small>
                    {cancellationPreview.available ? (
                      <>
                        <strong>{peso(cancellationPreview.amount)}</strong>
                        <span>
                          {cancellationPreview.percentage}% of verified downpayment
                          · {cancellationPreview.days} days before event
                        </span>
                        {cancellationPreview.grace && (
                          <span>24-hour post-verification grace period applied</span>
                        )}
                      </>
                    ) : (
                      <span className="cc-cb-estimate-unavailable">
                        Refund estimate unavailable: this booking has no valid event date.
                        Refresh the booking before cancelling.
                      </span>
                    )}
                    <small>
                      Estimate only; server policy and current booking status
                      determine the final amount.
                    </small>
                  </div>
                  <fieldset
                    className="cc-cb-refund-fieldset"
                    disabled={refundBusy}
                  >
                    <legend>Why are you cancelling?</legend>
                    {CANCELLATION_REASONS.map((reason) => (
                      <label key={reason} className="cc-cb-refund-choice">
                        <input
                          type="radio"
                          name="cc-cb-reason"
                          checked={cancelReason === reason}
                          onChange={() => setCancelReason(reason)}
                        />
                        {reason}
                      </label>
                    ))}
                    {cancelReason === "Other" && (
                      <textarea
                        value={otherReason}
                        maxLength={1000}
                        onChange={(e) => setOtherReason(e.target.value)}
                        placeholder="Please explain your reason…"
                        rows={3}
                      />
                    )}
                  </fieldset>
                </>
              )}
              {destinationBooking && (
                <p className="cc-cb-muted">
                  Your caterer cancelled the booking. Provide an account for the
                  refund of{" "}
                  <strong>{peso(destinationBooking.refund_amount)}</strong>.
                  This does not transfer money automatically.
                </p>
              )}
              {(destinationBooking ||
                (cancelBooking && cancellationPreview.amount > 0)) && (
                <fieldset
                  className="cc-cb-refund-fieldset"
                  disabled={refundBusy}
                >
                  <legend>Refund destination</legend>
                  <div className="cc-cb-refund-methods">
                    {REFUND_METHODS.map((method) => (
                      <label key={method} className="cc-cb-refund-choice">
                        <input
                          type="radio"
                          name="cc-cb-refund-method"
                          checked={refundMethod === method}
                          onChange={() => {
                            setRefundMethod(method);
                            setRefundNumber("");
                            setRefundBank("");
                          }}
                        />
                        {method === "other_bank"
                          ? "Other bank"
                          : method.toUpperCase()}
                      </label>
                    ))}
                  </div>
                  {refundMethod === "other_bank" && (
                    <label className="cc-cb-refund-field">
                      Bank name
                      <input
                        type="text"
                        maxLength={120}
                        value={refundBank}
                        onChange={(e) => setRefundBank(e.target.value)}
                        placeholder="Enter bank name"
                      />
                    </label>
                  )}
                  <label className="cc-cb-refund-field">
                    Account holder's full name
                    <input
                      type="text"
                      autoComplete="name"
                      maxLength={120}
                      value={refundHolder}
                      onChange={(e) => setRefundHolder(e.target.value)}
                      placeholder="Name registered to this account"
                    />
                  </label>
                  <label className="cc-cb-refund-field">
                    {["gcash", "maya"].includes(refundMethod)
                      ? "Mobile wallet number"
                      : "Bank account number"}
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={20}
                      value={refundNumber}
                      onChange={(e) => setRefundNumber(e.target.value)}
                      placeholder={
                        ["gcash", "maya"].includes(refundMethod)
                          ? "09XXXXXXXXX"
                          : "Account number"
                      }
                    />
                  </label>
                  <p className="cc-cb-detail-footnote">
                    <ShieldCheck size={15} /> Never enter a wallet PIN or OTP.
                    The caterer arranges the transfer after your account details
                    are saved.
                  </p>
                </fieldset>
              )}
              {refundError && (
                <p className="cc-cb-error" role="alert">
                  {refundError}
                </p>
              )}
            </div>
            <footer>
              <button
                type="button"
                disabled={refundBusy}
                onClick={() => {
                  setCancelId(null);
                  setRefundDestinationId(null);
                  clearRefundFields();
                }}
              >
                {cancelBooking ? "Keep Booking" : "Close"}
              </button>
              <button
                type="button"
                className="cc-cb-refund-primary"
                disabled={refundBusy || (!!cancelBooking && (!cancelReason || !cancellationPreview.available))}
                onClick={() =>
                  void (cancelBooking
                    ? submitCancellation()
                    : submitRefundDestination())
                }
              >
                {refundBusy
                  ? "Submitting…"
                  : cancelBooking
                    ? "Confirm Cancellation"
                    : "Submit Refund Account"}
              </button>
            </footer>
          </section>
        </div>
      )}
      {disputeBooking && (
        <div
          className="cc-cb-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !refundBusy) setDisputeId(null);
          }}
        >
          <section
            className="cc-cb-modal cc-cb-refund-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-cb-dispute-title"
          >
            <header>
              <div>
                <span className="cc-cb-eyebrow">REFUND SUPPORT</span>
                <h2 id="cc-cb-dispute-title">Report Missing Refund</h2>
                <p>Booking #{disputeBooking.id.slice(0, 8)}</p>
              </div>
              <button
                type="button"
                className="cc-cb-close"
                disabled={refundBusy}
                onClick={() => setDisputeId(null)}
                aria-label="Close"
              >
                <XCircle size={22} />
              </button>
            </header>
            <div className="cc-cb-detail-content">
              <p className="cc-cb-muted">
                Only report a refund that has transfer evidence but has not
                arrived in your account. Refunds remain pending while the issue
                is reviewed.
              </p>
              <label className="cc-cb-refund-field">
                Describe your concern
                <textarea
                  rows={5}
                  maxLength={2000}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Explain which transfer is missing…"
                />
              </label>
              {refundError && (
                <p className="cc-cb-error" role="alert">
                  {refundError}
                </p>
              )}
            </div>
            <footer>
              <button
                type="button"
                disabled={refundBusy}
                onClick={() => setDisputeId(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="cc-cb-refund-primary"
                disabled={refundBusy}
                onClick={() => void submitDispute()}
              >
                {refundBusy ? "Submitting…" : "Submit Report"}
              </button>
            </footer>
          </section>
        </div>
      )}
      {reviewBooking && (
        <div className="cc-cb-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !reviewBusy) setReviewId(null); }}>
          <section className="cc-cb-modal cc-cb-review-modal" role="dialog" aria-modal="true" aria-labelledby="cc-cb-review-title">
            <header>
              <div>
                <span className="cc-cb-eyebrow"><Star size={16} /> YOUR EXPERIENCE</span>
                <h2 id="cc-cb-review-title">Write a Review</h2>
                <p>Booking #{reviewBooking.id.slice(0, 8)}</p>
              </div>
              <button type="button" className="cc-cb-close" disabled={reviewBusy} aria-label="Close review" onClick={() => setReviewId(null)}><XCircle size={22} /></button>
            </header>
            <div className="cc-cb-detail-content cc-cb-review-form-body">
              <div className="cc-cb-review-caterer">
                {reviewCaterer?.logo_url ? <img src={reviewCaterer.logo_url} alt="" /> : <span className="cc-cb-fallback"><Store size={24} /></span>}
                <div><small>You're reviewing</small><strong>{reviewCaterer?.business_name ?? "Catering Service"}</strong></div>
              </div>
              {reviewAverage && <div className="cc-cb-review-average"><strong>{reviewAverage}</strong><span>★ ★ ★ ★ ★<small>Your average score</small></span></div>}
              <div className="cc-cb-review-rating-card">
                <h3>Rate Your Experience</h3>
                {REVIEW_CATEGORIES.map(({ key, label: ratingLabel, icon }) => (
                  <div className="cc-cb-review-rating-row" key={key}>
                    <div><span aria-hidden="true">{icon}</span><label>{ratingLabel}<small>{reviewRatings[key] ? REVIEW_STAR_LABELS[reviewRatings[key]] : "Choose a rating"}</small></label></div>
                    <div className="cc-cb-review-stars" role="group" aria-label={`${ratingLabel} rating`}>
                      {[1, 2, 3, 4, 5].map(value => <button type="button" key={value} disabled={reviewBusy} aria-label={`${value} star${value === 1 ? "" : "s"}`} aria-pressed={reviewRatings[key] === value} className={value <= reviewRatings[key] ? "active" : ""} onClick={() => setReviewRatings(current => ({ ...current, [key]: value }))}><Star size={25} fill={value <= reviewRatings[key] ? "currentColor" : "none"} /></button>)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="cc-cb-review-rating-card">
                <h3>Share Your Experience</h3>
                <p>Tell others what you loved (or didn't love).</p>
                <textarea rows={5} maxLength={2000} value={reviewComment} disabled={reviewBusy} onChange={(e) => setReviewComment(e.target.value)} placeholder="The food was amazing, especially the lechon!" aria-label="Optional written review" />
                <small>{reviewComment.length}/2000 · Optional</small>
              </div>
              {reviewError && <div role="alert" className="cc-cb-error">{reviewError}</div>}
              <p className="cc-cb-review-disclaimer">Reviews are submitted to CaterConnect and may be displayed publicly with a caterer response. Only one review per completed booking is supported.</p>
            </div>
            <footer>
              <button type="button" disabled={reviewBusy} onClick={() => setReviewId(null)}>Cancel</button>
              <button type="button" className="cc-cb-review-submit" disabled={reviewBusy || REVIEW_CATEGORIES.some(({ key }) => !reviewRatings[key])} onClick={() => void submitReview()}><Star size={17} /> {reviewBusy ? "Submitting…" : "Submit Review"}</button>
            </footer>
          </section>
        </div>
      )}
      {selected && (
        <div
          className="cc-cb-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <section
            className="cc-cb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-cb-detail-title"
          >
            <header>
              <div>
                <span className="cc-cb-eyebrow">BOOKING DETAILS</span>
                <h2 id="cc-cb-detail-title">
                  {selectedCaterer?.business_name ?? "Catering Booking"}
                </h2>
                <p>Reference: {selected.id}</p>
              </div>
              <button
                type="button"
                className="cc-cb-close"
                aria-label="Close details"
                onClick={() => setSelectedId(null)}
              >
                <XCircle size={23} />
              </button>
            </header>
            <div className="cc-cb-detail-content">
              <span className={`cc-cb-status cc-cb-status-${selected.status}`}>
                {bookingStatusLabel(selected.status)}
              </span>
              {!isStopped && (
                <div className="cc-cb-timeline">
                  {stages.map((step, i) => (
                    <div
                      className={i <= stageIndex(selected.status) ? "done" : ""}
                      key={step}
                    >
                      <span>
                        {i < stageIndex(selected.status) ? (
                          <CheckCircle2 size={17} />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <small>{step}</small>
                    </div>
                  ))}
                </div>
              )}
              <h3>
                <Store size={17} /> Caterer Information
              </h3>
              <div className="cc-cb-detail-provider">
                {selectedCaterer?.logo_url ? (
                  <img src={selectedCaterer.logo_url} alt="" />
                ) : (
                  <span className="cc-cb-fallback">
                    <Store size={24} />
                  </span>
                )}
                <div>
                  <strong>
                    {selectedCaterer?.business_name ?? "Catering Service"}
                  </strong>
                  <small>
                    <MapPin size={13} />{" "}
                    {selectedCaterer?.city || "Location not provided"}
                  </small>
                </div>
              </div>

              <h3>
                <Package size={17} /> Package & Inclusions
              </h3>
              <div className="cc-cb-detail-section">
                <div className="cc-cb-package-heading">
                  <span className="cc-cb-package-tier">
                    {label(selectedPackage?.tier)}
                  </span>
                  <strong>{selectedPackage?.name ?? "Custom booking"}</strong>
                  {selectedPackage?.description && (
                    <p>{selectedPackage.description}</p>
                  )}
                </div>
                {(
                  [
                    ["Food Inclusions", selectedPackage?.food_inclusions],
                    [
                      "Included Services",
                      selectedPackage?.includes ?? selectedPackage?.inclusions,
                    ],
                    [
                      "Package Menu",
                      selectedPackage?.menu ?? selectedPackage?.menu_items,
                    ],
                    ["Other Inclusions", selectedPackage?.included_items],
                  ] as [string, unknown][]
                ).map(([heading, source]) => {
                  const entries = describeIncluded(source);
                  return entries.length ? (
                    <div key={heading} className="cc-cb-inclusion-block">
                      <h4>
                        <ListChecks size={15} /> {heading}
                      </h4>
                      <ul>
                        {entries.map((entry, i) => (
                          <li key={`${heading}-${i}`}>{entry}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null;
                })}
                {!selectedPackage?.food_inclusions &&
                  !selectedPackage?.includes &&
                  !selectedPackage?.inclusions &&
                  !selectedPackage?.menu &&
                  !selectedPackage?.menu_items &&
                  !selectedPackage?.included_items && (
                    <p className="cc-cb-muted">
                      Detailed package inclusions are not recorded for this
                      package.
                    </p>
                  )}
              </div>

              <h3>
                <CalendarDays size={17} /> Event Information
              </h3>
              <dl className="cc-cb-detail-grid">
                <div>
                  <dt>Event Type</dt>
                  <dd>{selected.event_type || "Not specified"}</dd>
                </div>
                <div>
                  <dt>Event Date</dt>
                  <dd>{date(selected.event_date)}</dd>
                </div>
                <div>
                  <dt>Event Time</dt>
                  <dd>{selected.event_time || "Not specified"}</dd>
                </div>
                <div>
                  <dt>Guests</dt>
                  <dd>{selected.guest_count ?? "—"}</dd>
                </div>
                <div className="cc-cb-detail-span">
                  <dt>Venue</dt>
                  <dd>{selected.venue || "Not specified"}</dd>
                </div>
              </dl>
              {selected.special_requests && (
                <div className="cc-cb-detail-section cc-cb-special-request">
                  <h4>Special Requests</h4>
                  <p className="cc-cb-request">{selected.special_requests}</p>
                </div>
              )}

              <h3>
                <UtensilsCrossed size={17} /> Selected Menu & Customizations
              </h3>
              <div className="cc-cb-detail-section">
                {describeIncluded(selected.customized_items).length ? (
                  <ul className="cc-cb-addon-list">
                    {describeIncluded(selected.customized_items).map(
                      (entry, i) => (
                        <li key={i}>{entry}</li>
                      ),
                    )}
                  </ul>
                ) : (
                  <p className="cc-cb-muted">
                    No additional menu customizations were recorded.
                  </p>
                )}
              </div>

              <h3>
                <CreditCard size={17} /> Payment Summary
              </h3>
              <dl className="cc-cb-detail-grid">
                <div>
                  <dt>Booking Total</dt>
                  <dd>{peso(selected.total_cost)}</dd>
                </div>
                <div>
                  <dt>Required Downpayment</dt>
                  <dd>{peso(selected.downpayment_amount)}</dd>
                </div>
                <div>
                  <dt>Verified Downpayment</dt>
                  <dd>
                    {selected.payment_verified_at
                      ? peso(selected.downpayment_amount)
                      : "Not verified"}
                  </dd>
                </div>
                {selected.payment_verified_at &&
                  !["cancelled", "rejected"].includes(selected.status) && (
                    <div>
                      <dt>Balance After Downpayment</dt>
                      <dd>
                        {selected.total_cost != null &&
                        selected.downpayment_amount != null
                          ? peso(
                              Math.max(
                                0,
                                selected.total_cost -
                                  selected.downpayment_amount,
                              ),
                            )
                          : "—"}
                      </dd>
                    </div>
                  )}
                <div>
                  <dt>Payment Method</dt>
                  <dd>{methodName(selected.payment_method)}</dd>
                </div>
                <div>
                  <dt>Payment Reference</dt>
                  <dd>{selected.payment_reference || "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Payment Submitted</dt>
                  <dd>{dateTime(selected.payment_submitted_at)}</dd>
                </div>
                <div>
                  <dt>Payment Verified</dt>
                  <dd>{dateTime(selected.payment_verified_at)}</dd>
                </div>
                <div>
                  <dt>Recorded Payment Deadline</dt>
                  <dd>{dateTime(selected.downpayment_deadline)}</dd>
                </div>
              </dl>
              <p className="cc-cb-detail-footnote">
                <ShieldCheck size={15} /> Payment information is read from saved
                records. A displayed deadline does not itself confirm payment
                eligibility or automatic cancellation.
              </p>
              {selected.status === "cancelled" && (
                <>
                  <h3>
                    <ReceiptText size={17} /> Cancellation & Refund
                  </h3>
                  <dl className="cc-cb-detail-grid">
                    <div>
                      <dt>Reason</dt>
                      <dd>{selected.cancellation_reason || "Not provided"}</dd>
                    </div>
                    <div>
                      <dt>Cancelled By</dt>
                      <dd>{label(selected.cancelled_by)}</dd>
                    </div>
                    <div>
                      <dt>Refund Status</dt>
                      <dd>{label(selected.refund_status)}</dd>
                    </div>
                    <div>
                      <dt>Refund Amount</dt>
                      <dd>{peso(selected.refund_amount)}</dd>
                    </div>
                    <div>
                      <dt>Refund Deadline</dt>
                      <dd>{dateTime(selected.refund_due_at)}</dd>
                    </div>
                    <div>
                      <dt>Refund Received</dt>
                      <dd>{dateTime(selected.refunded_at)}</dd>
                    </div>
                    <div>
                      <dt>Refund Destination</dt>
                      <dd>
                        {displayRefundAccount(selected.refund_account_details)}
                      </dd>
                    </div>
                  </dl>
                  {selected.cancelled_by === "caterer" &&
                    Number(selected.refund_amount) > 0 &&
                    ["pending", "overdue"].includes(
                      selected.refund_status ?? "",
                    ) &&
                    !selected.refund_account_details && (
                      <button
                        type="button"
                        className="cc-cb-refund-primary"
                        onClick={() => openRefundDestination(selected)}
                      >
                        <Wallet size={17} /> Provide Refund Account
                      </button>
                    )}
                  {Number(selected.refund_amount) > 0 && (
                    <div className="cc-cb-refund-status-card">
                      <h3>
                        <FileText size={17} /> Refund Transfer Evidence
                      </h3>
                      {evidenceLoading && (
                        <p className="cc-cb-muted">
                          Loading transfer evidence…
                        </p>
                      )}
                      {!evidenceLoading && !evidence.length && (
                        <p className="cc-cb-muted">
                          No transfer evidence has been submitted yet.
                        </p>
                      )}
                      {evidence.map((item, i) => (
                        <div className="cc-cb-transfer-item" key={item.id || i}>
                          <strong>
                            Submission {i + 1} · {label(item.status)}
                          </strong>
                          <small>
                            {dateTime(item.submitted_at ?? item.created_at)}
                          </small>
                          {(item.transfer_reference ||
                            item.reference_number) && (
                            <p>
                              Reference:{" "}
                              {item.transfer_reference ?? item.reference_number}
                            </p>
                          )}
                          {item.proofUrl ? (
                            <a
                              href={item.proofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View transfer proof
                            </a>
                          ) : (
                            <small>
                              Proof image unavailable or restricted.
                            </small>
                          )}
                        </div>
                      ))}
                      {refundDetailError && (
                        <p className="cc-cb-error" role="alert">
                          {refundDetailError}
                        </p>
                      )}
                      {selected.refund_status ===
                        "awaiting_customer_confirmation" &&
                        evidence.some((e) =>
                          ["submitted", "verified"].includes(e.status),
                        ) && (
                          <div className="cc-cb-refund-actions">
                            <button
                              type="button"
                              className="cc-cb-refund-primary"
                              disabled={refundBusy}
                              onClick={() => void confirmRefund(selected)}
                            >
                              <CheckCircle2 size={17} />{" "}
                              {refundBusy
                                ? "Processing…"
                                : "I Received My Refund"}
                            </button>
                            {!currentDispute && (
                              <button
                                type="button"
                                className="cc-cb-refund-secondary"
                                disabled={refundBusy}
                                onClick={() => {
                                  setRefundError("");
                                  setDisputeId(selected.id);
                                  setSelectedId(null);
                                }}
                              >
                                <AlertTriangle size={17} /> I Haven't Received
                                My Refund
                              </button>
                            )}
                          </div>
                        )}
                      {currentDispute && (
                        <div className="cc-cb-refund-dispute">
                          <strong>
                            Refund issue reported ·{" "}
                            {label(currentDispute.status)}
                          </strong>
                          <p>{currentDispute.reason}</p>
                          {currentDispute.caterer_response && (
                            <p>
                              <strong>Caterer response:</strong>{" "}
                              {currentDispute.caterer_response}
                            </p>
                          )}
                        </div>
                      )}
                      {selected.refund_status === "processed" && (
                        <p className="cc-cb-refund-success">
                          Refund receipt has been confirmed.
                        </p>
                      )}
                      <p className="cc-cb-detail-footnote">
                        The caterer transfers money directly to your account.
                        Staff monitor the process. Only confirm receipt after
                        checking your actual wallet or bank balance.
                      </p>
                    </div>
                  )}
                </>
              )}
              {(selected.status === "completed" || reviewsByBooking[selected.id]) && (
                <section className="cc-cb-review-section">
                  <h3><Star size={18} /> Customer Review</h3>
                  {reviewsByBooking[selected.id] ? renderReview(reviewsByBooking[selected.id]) : (
                    <div className="cc-cb-review-empty">
                      <p>Share your experience with this completed booking.</p>
                      <button type="button" className="cc-cb-review-trigger" disabled={!!reviewsError} onClick={() => openReview(selected)}><Star size={17} /> Write Review</button>
                    </div>
                  )}
                </section>
              )}
              {selected.status === "rejected" && selected.rejection_reason && (
                <p className="cc-cb-alert">
                  Reason for rejection: {selected.rejection_reason}
                </p>
              )}
            </div>
            <footer>
              <Link
                to={`/customer/messages?bookingId=${encodeURIComponent(selected.id)}`}
              >
                <MessageSquare size={17} /> Chat Caterer
              </Link>
              {["confirmed", "awaiting_payment"].includes(selected.status) &&
                !selected.payment_verified_at && (
                  <button
                    type="button"
                    className="cc-cb-pay-action"
                    onClick={() => {
                      openPayment(selected);
                      setSelectedId(null);
                    }}
                  >
                    <Lock size={16} /> Pay Downpayment
                  </button>
                )}
              {["pending", "confirmed", "paid"].includes(selected.status) && (
                <button
                  type="button"
                  className="cc-cb-cancel-trigger"
                  onClick={() => openCancellation(selected)}
                >
                  <Ban size={16} /> Cancel Booking
                </button>
              )}
              <button type="button" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
