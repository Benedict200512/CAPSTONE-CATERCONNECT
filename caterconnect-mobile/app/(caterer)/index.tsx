// app/(caterer)/index.tsx

import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Animated,
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';

import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

import NotificationsScreen from '../../screens/auth/NotificationsScreen';
import MonthlyBookingQuotaSummary from '../../components/MonthlyBookingQuotaSummary';
import AvailabilityMonthCalendar from '../../components/AvailabilityMonthCalendar';
import { availabilityError, loadAvailability, manilaToday, shiftMonth } from '../../lib/availability';
import { loadCatererReport, reportError, reportRange, type CatererReport } from '../../lib/catererReports';

import {
  X,
  Bell,
  ClipboardList,
  CheckCircle2,
  Hourglass,
  CreditCard,
  Package,
  UtensilsCrossed,
  Calendar,
  Users,
  Star,
  ChevronRight,
  ArrowUpRight,
  Inbox,
  ShieldAlert,
  BarChart3,
  UserRound,
  FileCheck,
  ShieldCheck,
  Clock,
  CalendarDays,
  TrendingUp,
} from 'lucide-react-native';

export default function CatererDashboard() {
  const { profile, catererData, session } = useAuth();
  const router = useRouter();

  const displayName =
    catererData?.business_name || profile?.full_name || 'Loading...';

  const displayInitial = displayName.charAt(0).toUpperCase();

  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
  });

  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availabilityMonth, setAvailabilityMonth] = useState(() => manilaToday().slice(0, 7));
  const [availabilitySelected, setAvailabilitySelected] = useState(() => manilaToday());
  const [availabilityData, setAvailabilityData] = useState<Awaited<ReturnType<typeof loadAvailability>> | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityErrorMessage, setAvailabilityErrorMessage] = useState('');
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);
  const [trendReport, setTrendReport] = useState<CatererReport | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState('');
  const [trendRefreshKey, setTrendRefreshKey] = useState(0);

  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [shimmerAnim]);

  const verificationStatus = catererData?.verification_status;

  const isUnsubmitted = verificationStatus === 'unsubmitted';
  const isPending = verificationStatus === 'pending';
  const isRejected = verificationStatus === 'rejected';

  const isPendingVerification =
    !loading &&
    (!catererData?.id ||
      isUnsubmitted ||
      isPending ||
      isRejected);

  useEffect(() => {
    let isMounted = true;

    const initializeDashboard = async () => {
      setLoading(true);

      try {
        await loadUnreadCount();

        if (
          catererData?.id &&
          catererData?.verification_status === 'approved'
        ) {
          await loadStats();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeDashboard();

    return () => {
      isMounted = false;
    };
  }, [catererData?.id, catererData?.verification_status]);

  const loadStats = async () => {
    if (!catererData?.id) return;

    try {
      const [total, completed, pending] = await Promise.all([
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('caterer_id', catererData.id),

        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('caterer_id', catererData.id)
          .eq('status', 'completed'),

        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('caterer_id', catererData.id)
          .eq('status', 'pending'),
      ]);

      let recent: any[] | null = null;

      for (const photoField of [
        'avatar_url',
        'profile_picture',
        'profile_image_url',
        'profile_photo_url',
        'image_url',
      ]) {
        const response = await supabase
          .from('bookings')
          .select(
            `id, status, event_date, guest_count, total_cost, profiles(full_name, ${photoField})`
          )
          .eq('caterer_id', catererData.id)
          .order('created_at', { ascending: false })
          .limit(3);

        if (!response.error) {
          recent = (response.data ?? []).map((booking: any) => {
            const customerProfile = Array.isArray(booking.profiles)
              ? booking.profiles[0]
              : booking.profiles;

            return {
              ...booking,
              customerPhoto: customerProfile?.[photoField] ?? null,
            };
          });

          break;
        }

        if (
          !/column|schema cache|does not exist|could not find/i.test(
            response.error.message
          )
        ) {
          break;
        }
      }

      if (recent === null) {
        const response = await supabase
          .from('bookings')
          .select(
            'id, status, event_date, guest_count, total_cost, profiles(full_name)'
          )
          .eq('caterer_id', catererData.id)
          .order('created_at', { ascending: false })
          .limit(3);

        if (response.error) throw response.error;

        recent = response.data ?? [];
      }

      setStats({
        total: total.count ?? 0,
        completed: completed.count ?? 0,
        pending: pending.count ?? 0,
      });

      setRecentBookings(recent);
    } catch (err) {
      console.error('Error loading caterer dashboard:', err);
    }
  };

  useEffect(() => {
    let current = true;

    if (!catererData?.id || !session?.user?.id || catererData.verification_status !== 'approved') {
      setAvailabilityData(null);
      setAvailabilityLoading(false);
      return () => { current = false; };
    }

    setAvailabilityLoading(true);
    setAvailabilityErrorMessage('');
    loadAvailability(catererData.id, session.user.id, availabilityMonth)
      .then((data) => {
        if (current) setAvailabilityData(data);
      })
      .catch((error) => {
        if (current) setAvailabilityErrorMessage(availabilityError(error));
      })
      .finally(() => {
        if (current) setAvailabilityLoading(false);
      });

    return () => { current = false; };
  }, [catererData?.id, catererData?.verification_status, session?.user?.id, availabilityMonth, availabilityRefreshKey]);

  const dashboardMonth = manilaToday().slice(0, 7);
  const reportThisMonth = reportRange('This Month');
  const dashboardTrendRange = {
    start: `${shiftMonth(dashboardMonth, -5)}-01`,
    end: reportThisMonth.end,
  };

  useEffect(() => {
    let current = true;

    if (!catererData?.id || profile?.role !== 'caterer' || catererData.verification_status !== 'approved') {
      setTrendReport(null);
      setTrendLoading(false);
      return () => { current = false; };
    }

    setTrendLoading(true);
    setTrendError('');
    loadCatererReport(dashboardTrendRange)
      .then((report) => {
        if (current) setTrendReport(report);
      })
      .catch((error) => {
        if (current) setTrendError(reportError(error));
      })
      .finally(() => {
        if (current) setTrendLoading(false);
      });

    return () => { current = false; };
  }, [catererData?.id, catererData?.verification_status, profile?.role, dashboardTrendRange.start, dashboardTrendRange.end, trendRefreshKey]);

  const trendMonths = useMemo(() => {
    if (!trendReport) return [];
    const recorded = new Map(trendReport.months.map((month) => [month.month.slice(0, 7), month.count]));
    return Array.from({ length: 5 }, (_, index) => {
      const date = new Date(`${dashboardMonth}-01T00:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() - (4 - index));
      const month = date.toISOString().slice(0, 7);
      return {
        month,
        label: date.toLocaleDateString('en-PH', { month: 'short', timeZone: 'UTC' }),
        count: recorded.get(month) ?? 0,
      };
    });
  }, [trendReport, dashboardMonth]);
  const maxTrendCount = Math.max(1, ...trendMonths.map((month) => month.count));

  const loadUnreadCount = async () => {
    if (!session?.user?.id) return;

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false);

    if (!error) {
      setUnreadCount(count ?? 0);
    }
  };

  const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
    pending: { bg: '#FEF3C7', color: '#92400E' },
    confirmed: { bg: '#DCFCE7', color: '#166534' },
    awaiting_payment: { bg: '#DBEAFE', color: '#1E40AF' },
    paid: { bg: '#DCFCE7', color: '#166534' },
    completed: { bg: '#F0FDF4', color: '#166534' },
    rejected: { bg: '#FEE2E2', color: '#991B1B' },
    cancelled: { bg: '#F3F4F6', color: '#6B7280' },
  };

  const planColors: Record<string, string> = {
    free: '#6B7280',
    basic: '#2563EB',
    standard: '#D97706',
    premium: '#7C3AED',
  };

  const currentPlan = catererData?.subscription_plan ?? 'free';
  const planColor = planColors[currentPlan] ?? Colors.orange;
  const isPremium = currentPlan === 'premium';
  const selectedDateCount = availabilityData?.counts[availabilitySelected] ?? 0;
  const selectedDateBlocked = availabilityData?.blocked.includes(availabilitySelected) ?? false;
  const selectedDateFull = !!availabilityData && !selectedDateBlocked && selectedDateCount >= availabilityData.capacity;

  const statCards = [
    {
      icon: ClipboardList,
      label: 'Total Bookings',
      value: String(stats.total),
      color: '#F97316',
      tint: '#FFF1E6',
    },
    {
      icon: CheckCircle2,
      label: 'Completed',
      value: String(stats.completed),
      color: '#16A34A',
      tint: '#F0FDF4',
    },
    {
      icon: Hourglass,
      label: 'Pending',
      value: String(stats.pending),
      color: '#D97706',
      tint: '#FEF3C7',
    },
    {
      icon: CreditCard,
      label: 'Plan',
      value:
        currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1),
      color: planColor,
      tint: planColor + '18',
    },
  ];

  const quickActions = [
    {
      icon: BarChart3,
      label: 'Reports & Analytics',
      description: 'View trends and financial insights',
      path: '/(caterer)/reports',
      bg: '#FFF1E7',
      color: '#C65000',
    },
    {
      icon: Calendar,
      label: 'Availability',
      description: 'Manage dates and booking limits',
      path: '/(caterer)/availability',
      bg: '#FFF1E7',
      color: '#F97316',
    },
    {
      icon: Package,
      label: 'Packages',
      description: 'Create and manage your packages',
      path: '/(caterer)/packages',
      bg: '#EFF6FF',
      color: '#2563EB',
    },
    {
      icon: UtensilsCrossed,
      label: 'Menu Items',
      description: 'Add menu items and categories',
      path: '/(caterer)/menu',
      bg: '#ECFDF3',
      color: '#16A34A',
    },
    {
      icon: ClipboardList,
      label: 'Bookings',
      description: 'View and manage your bookings',
      path: '/(caterer)/bookings',
      bg: '#FFF1E7',
      color: '#F97316',
    },
  ];

  // SKELETON LOADING SCREEN
  if (loading) {
    const pulse = (style: any) => (
      <Animated.View
        style={[
          styles.skeletonBox,
          style,
          { opacity: shimmerAnim },
        ]}
      />
    );

    return (
      <View style={styles.container}>
        <View
          style={[
            styles.header,
            { paddingTop: Platform.OS === 'ios' ? 56 : 40 },
          ]}
        >
          <View style={{ flex: 1, gap: 8 }}>
            {pulse({ width: 150, height: 12, borderRadius: 6 })}
            {pulse({ width: 142, height: 24, borderRadius: 10 })}
            {pulse({ width: '75%', height: 27, borderRadius: 10 })}
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {pulse({ width: 44, height: 44, borderRadius: 22 })}
            {pulse({ width: 44, height: 44, borderRadius: 22 })}
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ width: '100%', maxWidth: 1280, alignSelf: 'center', paddingBottom: 44 }}
        >
          <View style={styles.statsGrid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.statCard}>
                {pulse({ width: 38, height: 38, borderRadius: 13 })}
                {pulse({ width: 82, height: 28, borderRadius: 8 })}
                {pulse({ width: 106, height: 13, borderRadius: 6 })}
              </View>
            ))}
          </View>

          <View style={styles.skeletonSubscription}>
            <View style={{ flex: 1, gap: 10 }}>
              {pulse({ width: 122, height: 10, borderRadius: 5 })}
              {pulse({ width: '70%', height: 21, borderRadius: 7 })}
              {pulse({ width: '90%', height: 12, borderRadius: 6 })}
              {pulse({ width: '76%', height: 12, borderRadius: 6 })}
            </View>
            {pulse({ width: 84, height: 38, borderRadius: 18 })}
          </View>

          <View style={styles.skeletonFeatureCard}>
            {pulse({ width: 120, height: 10, borderRadius: 5 })}
            {pulse({ width: 172, height: 21, borderRadius: 7 })}
            {pulse({ width: '95%', height: 12, borderRadius: 6 })}
            {pulse({ width: 144, height: 36, borderRadius: 10 })}
            <View style={styles.skeletonCalendarMonthRow}>
              {pulse({ width: 34, height: 34, borderRadius: 17 })}
              {pulse({ width: 130, height: 16, borderRadius: 7 })}
              {pulse({ width: 34, height: 34, borderRadius: 17 })}
            </View>
            <View style={styles.skeletonCalendarWeekdays}>
              {Array.from({ length: 7 }, (_, i) => <View key={i} style={styles.skeletonCalendarWeekday}>{pulse({ width: 20, height: 9, borderRadius: 5 })}</View>)}
            </View>
            <View style={styles.skeletonCalendarGrid}>
              {Array.from({ length: 42 }, (_, i) => (
                <View key={i} style={styles.skeletonCalendarCell}>
                  {pulse({ width: '72%', height: 34, borderRadius: 8 })}
                </View>
              ))}
            </View>
            <View style={styles.skeletonLegendRow}>
              {[0, 1, 2].map((i) => <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>{pulse({ width: 9, height: 9, borderRadius: 5 })}{pulse({ width: 46, height: 10, borderRadius: 5 })}</View>)}
            </View>
            {pulse({ width: '82%', height: 11, borderRadius: 5 })}
          </View>

          <View style={styles.skeletonFeatureCard}>
            {pulse({ width: 138, height: 10, borderRadius: 5 })}
            {pulse({ width: 188, height: 21, borderRadius: 7 })}
            {pulse({ width: '95%', height: 12, borderRadius: 6 })}
            <View style={styles.skeletonTrendChart}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.skeletonTrendColumn}>
                  {pulse({ width: 22, height: 12, borderRadius: 5 })}
                  {pulse({ width: '70%', height: 104, borderRadius: 9 })}
                  {pulse({ width: 34, height: 11, borderRadius: 5 })}
                  {pulse({ width: 28, height: 10, borderRadius: 5 })}
                </View>
              ))}
            </View>
            <View style={styles.skeletonLegendRow}>{pulse({ width: 10, height: 10, borderRadius: 5 })}{pulse({ width: 182, height: 10, borderRadius: 5 })}</View>
            {pulse({ width: 184, height: 38, borderRadius: 10 })}
          </View>

          <View style={styles.skeletonSection}>
            {pulse({ width: 132, height: 21, borderRadius: 7 })}
            {pulse({ width: 190, height: 12, borderRadius: 6 })}
            {[0, 1].map((i) => (
              <View key={i} style={styles.skeletonRecentBooking}>
                {pulse({ width: 48, height: 48, borderRadius: 24 })}
                <View style={{ flex: 1, gap: 8 }}>
                  {pulse({ width: '72%', height: 14, borderRadius: 6 })}
                  {pulse({ width: '55%', height: 11, borderRadius: 5 })}
                  {pulse({ width: '64%', height: 11, borderRadius: 5 })}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  {pulse({ width: 70, height: 14, borderRadius: 6 })}
                  {pulse({ width: 62, height: 20, borderRadius: 10 })}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <>
      <Modal
        visible={showNotifs}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <NotificationsScreen />

        <TouchableOpacity
          style={styles.closeNotifBtn}
          onPress={() => {
            setShowNotifs(false);
            loadUnreadCount();
          }}
        >
          <X size={20} color={Colors.white} />
          <Text style={styles.closeNotifText}>Close</Text>
        </TouchableOpacity>
      </Modal>

      <View style={styles.container}>
        {/* HEADER */}
        <View
          style={[
            styles.header,
            { paddingTop: Platform.OS === 'ios' ? 56 : 40 },
          ]}
        >
          <View style={{ flex: 1, paddingRight: 12, flexShrink: 1 }}>
            <Text style={styles.headerDate} numberOfLines={2}>
              {new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Manila',
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }).format(new Date()).toUpperCase()}
            </Text>

            <View style={styles.greetingRow}>
              <Text style={styles.headerGreeting}>Welcome Back!{displayName ? ',' : ''}</Text>
              {displayName ? (
                <Text style={styles.headerName} numberOfLines={2}>
                  {displayName}
                </Text>
              ) : null}
            </View>

          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => setShowNotifs(true)}
            >
              <Bell size={20} color={Colors.black} />

              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => router.push('/(caterer)/profile')}
            >
              {catererData?.logo_url ? (
                <Image
                  source={{ uri: catererData.logo_url }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {displayInitial}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* VERIFICATION STATUS SCREEN */}
        {isPendingVerification ? (
          <ScrollView
            contentContainerStyle={styles.pendingScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.pendingContainer}>
              <View style={styles.pendingIconWrap}>
                {isPending ? (
                  <Clock size={48} color="#D97706" />
                ) : isRejected ? (
                  <ShieldAlert size={48} color="#DC2626" />
                ) : (
                  <ShieldAlert size={48} color={Colors.orange} />
                )}
              </View>

              <View
                style={[
                  styles.verificationBadge,
                  isPending && styles.verificationBadgePending,
                  isRejected && styles.verificationBadgeRejected,
                ]}
              >
                <View
                  style={[
                    styles.verificationDot,
                    isPending && { backgroundColor: '#D97706' },
                    isRejected && { backgroundColor: '#DC2626' },
                  ]}
                />

                <Text
                  style={[
                    styles.verificationBadgeText,
                    isPending && { color: '#92400E' },
                    isRejected && { color: '#991B1B' },
                  ]}
                >
                  {isPending
                    ? 'UNDER REVIEW'
                    : isRejected
                    ? 'APPLICATION REJECTED'
                    : 'ACTION REQUIRED'}
                </Text>
              </View>

              <Text style={styles.pendingTitle}>
                {isUnsubmitted
                  ? 'Complete Your Business Profile'
                  : isPending
                  ? 'Your Application Is Under Review'
                  : isRejected
                  ? 'Verification Rejected'
                  : 'Verification Required'}
              </Text>

              <Text style={styles.pendingSub}>
                {isUnsubmitted
                  ? 'Please complete your business details and submit your required verification documents to begin the verification process.'
                  : isPending
                  ? 'Thank you for submitting your business application! Your business details and verification documents have been successfully submitted. Our Platform Staff will review your application. Please wait for the verification result.'
                  : isRejected
                  ? 'Your verification application was rejected. Please review the feedback below, correct the necessary information, and resubmit your application.'
                  : 'Your business profile could not be found. Please contact Platform Staff for assistance.'}
              </Text>

              {/* PENDING APPLICATION CHECKLIST */}
              {isPending && (
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewCardTitle}>
                    Verification Progress
                  </Text>

                  <View style={styles.reviewStep}>
                    <View style={styles.reviewStepIcon}>
                      <FileCheck size={19} color="#16A34A" />
                    </View>

                    <View style={styles.reviewStepText}>
                      <Text style={styles.reviewStepTitle}>
                        Business Details Submitted
                      </Text>
                      <Text style={styles.reviewStepDescription}>
                        Your business information has been received.
                      </Text>
                    </View>

                    <CheckCircle2 size={20} color="#16A34A" />
                  </View>

                  <View style={styles.reviewStep}>
                    <View style={styles.reviewStepIcon}>
                      <ShieldCheck size={19} color="#16A34A" />
                    </View>

                    <View style={styles.reviewStepText}>
                      <Text style={styles.reviewStepTitle}>
                        Documents Submitted
                      </Text>
                      <Text style={styles.reviewStepDescription}>
                        Your verification documents are on file.
                      </Text>
                    </View>

                    <CheckCircle2 size={20} color="#16A34A" />
                  </View>

                  <View style={styles.reviewStep}>
                    <View
                      style={[
                        styles.reviewStepIcon,
                        styles.reviewStepIconPending,
                      ]}
                    >
                      <Clock size={19} color="#D97706" />
                    </View>

                    <View style={styles.reviewStepText}>
                      <Text style={styles.reviewStepTitle}>
                        Staff Review
                      </Text>
                      <Text style={styles.reviewStepDescription}>
                        Waiting for Platform Staff to review your application.
                      </Text>
                    </View>

                    <View style={styles.waitingBadge}>
                      <Text style={styles.waitingBadgeText}>
                        Waiting
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* REJECTION REASON */}
              {isRejected && catererData?.rejection_reason && (
                <View style={styles.rejectionCard}>
                  <Text style={styles.rejectionTitle}>
                    Reason for Rejection
                  </Text>

                  <Text style={styles.rejectionText}>
                    {catererData.rejection_reason}
                  </Text>
                </View>
              )}

              {/* ACTION BUTTONS */}
              {(isUnsubmitted || isRejected) && (
                <TouchableOpacity
                  style={styles.pendingBtn}
                  onPress={() =>
                    router.push('/(caterer)/edit-profile')
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.pendingBtnText}>
                    {isUnsubmitted
                      ? 'Complete Business Profile'
                      : 'Edit & Resubmit'}
                  </Text>

                  <ArrowUpRight size={18} color={Colors.white} />
                </TouchableOpacity>
              )}

              {isPending && (
                <View style={styles.waitingNotice}>
                  <Clock size={17} color="#92400E" />

                  <Text style={styles.waitingNoticeText}>
                    No further action is needed right now. Please wait while
                    Platform Staff reviews your application.
                  </Text>
                </View>
              )}

              <Text style={styles.pendingFooter}>
                Thank you for choosing CaterConnect.
              </Text>
            </View>
          </ScrollView>
        ) : (
          /* APPROVED CATERER DASHBOARD */
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ width: '100%', maxWidth: 1280, alignSelf: 'center', flexGrow: 1 }}
          >
            <View style={styles.dashboardBody}>
              <View
                pointerEvents="none"
                style={[styles.backgroundBlob, styles.blobTopRight]}
              />
              <View
                pointerEvents="none"
                style={[styles.backgroundBlob, styles.blobUpperLeft]}
              />
              <View
                pointerEvents="none"
                style={[styles.backgroundBlob, styles.blobMidRight]}
              />
              <View
                pointerEvents="none"
                style={[styles.backgroundBlob, styles.blobLowerLeft]}
              />
              <View
                pointerEvents="none"
                style={[styles.backgroundBlob, styles.blobBottomRight]}
              />
              <View
                pointerEvents="none"
                style={[styles.backgroundBlob, styles.blobBottomLeft]}
              />

              <View style={styles.statsGrid}>
                {statCards.map((s) => {
                  const StatIcon = s.icon;

                  return (
                    <View key={s.label} style={styles.statCard}>
                      <View
                        style={[
                          styles.statIconWrap,
                          { backgroundColor: s.tint },
                        ]}
                      >
                        <StatIcon size={20} color={s.color} />
                      </View>

                      <Text
                        style={styles.statLabel}
                        numberOfLines={2}
                      >
                        {s.label}
                      </Text>

                      <Text
                        style={[styles.statValue, { color: s.color }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {s.value}
                      </Text>

                      <View
                        style={[
                          styles.statAccent,
                          { backgroundColor: s.color },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>

              {/* SUBSCRIPTION */}
              <TouchableOpacity
                style={[
                  styles.subBanner,
                  { borderColor: planColor + '40' },
                ]}
                onPress={() => router.push('/(caterer)/subscription')}
                activeOpacity={0.85}
              >
                <View style={styles.subBannerHeader}>
                  <View style={styles.planHeading}>
                    <View
                      style={[
                        styles.planIcon,
                        { backgroundColor: planColor + '16' },
                      ]}
                    >
                      <CreditCard size={19} color={planColor} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.subBannerLabel,
                          { color: planColor },
                        ]}
                      >
                        YOUR SUBSCRIPTION
                      </Text>

                      <Text style={styles.subBannerPlan}>
                        {currentPlan.charAt(0).toUpperCase() +
                          currentPlan.slice(1)}{' '}
                        Plan
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.subUpgradeBtn,
                      { backgroundColor: planColor },
                    ]}
                  >
                    {isPremium ? (
                      <>
                        <Star
                          size={16}
                          color={Colors.white}
                          fill={Colors.white}
                        />
                        <Text style={styles.subUpgradeBtnText}>
                          Premium
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.subUpgradeBtnText}>
                          Upgrade
                        </Text>
                        <ArrowUpRight
                          size={16}
                          color={Colors.white}
                        />
                      </>
                    )}
                  </View>
                </View>
                <MonthlyBookingQuotaSummary compact />
              </TouchableOpacity>

              {/* CALENDAR OVERVIEW */}
              <View style={styles.section}>
                <View style={styles.dashboardFeatureCard}>
                  <View style={styles.dashboardFeatureHeading}>
                    <View style={styles.dashboardFeatureCopy}>
                      <Text style={styles.dashboardEyebrow}>CALENDAR OVERVIEW</Text>
                      <Text style={styles.dashboardFeatureTitle}>Monthly Availability</Text>
                      <Text style={styles.dashboardFeatureDescription}>
                        Committed bookings and dates blocked from new requests.
                      </Text>
                    </View>
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={styles.dashboardFeatureButton}
                      onPress={() => router.push('/(caterer)/availability')}
                      activeOpacity={0.8}
                    >
                      <CalendarDays size={15} color={Colors.white} />
                      <Text style={styles.dashboardFeatureButtonText}>Check Availability</Text>
                    </TouchableOpacity>
                  </View>

                  {availabilityLoading ? (
                    <ActivityIndicator color={Colors.orange} style={styles.dashboardFeedback} />
                  ) : availabilityErrorMessage ? (
                    <View style={styles.dashboardFeedback}>
                      <Text style={styles.dashboardError}>{availabilityErrorMessage}</Text>
                      <TouchableOpacity onPress={() => setAvailabilityRefreshKey((key) => key + 1)}>
                        <Text style={styles.dashboardLink}>Try again</Text>
                      </TouchableOpacity>
                    </View>
                  ) : availabilityData ? (
                    <>
                      <AvailabilityMonthCalendar
                        month={availabilityMonth}
                        selected={availabilitySelected}
                        blocked={availabilityData.blocked}
                        counts={availabilityData.counts}
                        capacity={availabilityData.capacity}
                        onSelect={setAvailabilitySelected}
                        onMonthChange={(month) => {
                          setAvailabilityMonth(month);
                          setAvailabilitySelected(`${month}-01`);
                        }}
                      />
                      <View style={styles.calendarLegend}>
                        <View style={styles.calendarLegendItem}><View style={styles.calendarLegendOpen} /><Text style={styles.calendarLegendText}>Open</Text></View>
                        <View style={styles.calendarLegendItem}><View style={styles.calendarLegendFull} /><Text style={styles.calendarLegendText}>Fully booked</Text></View>
                        <View style={styles.calendarLegendItem}><View style={styles.calendarLegendBlocked} /><Text style={styles.calendarLegendText}>Blocked</Text></View>
                      </View>
                      <Text style={styles.calendarCapacity}>
                        Daily limit: {availabilityData.capacity} bookings. Pending requests are not included.
                      </Text>
                      <Text style={styles.calendarSelectedStatus}>
                        {availabilitySelected}: {selectedDateCount} committed bookings · {selectedDateBlocked ? 'Blocked' : selectedDateFull ? 'Fully booked' : 'Open'}
                      </Text>
                    </>
                  ) : null}
                </View>
              </View>

              {/* MONTHLY BOOKING TRENDS */}
              <View style={styles.section}>
                <View style={styles.dashboardFeatureCard}>
                  <View style={styles.dashboardTrendsHeading}>
                    <View style={styles.dashboardFeatureCopy}>
                      <Text style={styles.dashboardEyebrow}>BOOKING PERFORMANCE</Text>
                      <Text style={styles.dashboardFeatureTitle}>Monthly Booking Trends</Text>
                      <Text style={styles.dashboardFeatureDescription}>
                        Bookings by creation month across all statuses; this is activity, not a success count.
                      </Text>
                    </View>
                    <View style={styles.dashboardTrendsIcon}>
                      <TrendingUp size={19} color={Colors.orange} />
                    </View>
                  </View>

                  {trendLoading ? (
                    <ActivityIndicator color={Colors.orange} style={styles.dashboardFeedback} />
                  ) : trendError ? (
                    <View style={styles.dashboardFeedback}>
                      <Text style={styles.dashboardError}>{trendError}</Text>
                      <TouchableOpacity onPress={() => setTrendRefreshKey((key) => key + 1)}>
                        <Text style={styles.dashboardLink}>Try again</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      {trendMonths.length > 0 ? (
                        <View style={styles.dashboardTrendChart}>
                          {trendMonths.map((month) => (
                            <View key={month.month} accessibilityLabel={`${month.month}: ${month.count} bookings`} style={styles.dashboardTrendColumn}>
                              <Text style={styles.dashboardTrendCount}>{month.count}</Text>
                              <View style={styles.dashboardTrendTrack}>
                                <View style={[styles.dashboardTrendBar, {
                                  height: `${month.count / maxTrendCount * 100}%`,
                                  backgroundColor: month.count === maxTrendCount && month.count > 0 ? '#E96808' : '#FDBA74',
                                }]} />
                              </View>
                              <Text style={styles.dashboardTrendMonth}>{month.label}</Text>
                              <Text style={styles.dashboardTrendYear}>{month.month.slice(0, 4)}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.dashboardFeatureDescription}>Trend data is unavailable.</Text>
                      )}
                      <View style={styles.dashboardTrendLegend}>
                        <View style={styles.dashboardTrendLegendDot} />
                        <Text style={styles.calendarLegendText}>Monthly bookings · Philippine Standard Time</Text>
                      </View>
                    </>
                  )}
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.dashboardReportButton}
                    onPress={() => router.push(quickActions[0].path as any)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dashboardReportButtonText}>View Report &amp; Analytics</Text>
                    <ChevronRight size={17} color={Colors.orange} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* RECENT BOOKINGS */}
              <View style={styles.section}>
                <View style={styles.sectionRow}>
                  <View>
                    <Text style={styles.sectionTitle}>
                      Recent Bookings
                    </Text>
                    <Text style={styles.sectionSubtitle}>
                      Your latest customer booking requests
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.seeAllRow}
                    onPress={() =>
                      router.push('/(caterer)/bookings')
                    }
                  >
                    <Text style={styles.seeAll}>View all</Text>
                    <ChevronRight
                      size={16}
                      color={Colors.orange}
                    />
                  </TouchableOpacity>
                </View>

                {recentBookings.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <View style={styles.emptyIconWrap}>
                      <Inbox
                        size={32}
                        color={Colors.textSecondary}
                      />
                    </View>

                    <Text style={styles.emptyTitle}>
                      No bookings yet
                    </Text>

                    <Text style={styles.emptySub}>
                      Once customers book your catering service, their
                      requests will appear here.
                    </Text>
                  </View>
                ) : (
                  recentBookings.map((b) => {
                    const statusStyle =
                      STATUS_STYLE[b.status] ?? STATUS_STYLE.pending;

                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={styles.recentBookingCard}
                        onPress={() =>
                          router.push('/(caterer)/bookings')
                        }
                        activeOpacity={0.85}
                      >
                        <View style={styles.recentBookingLeft}>
                          <View style={styles.recentBookingAvatar}>
                            {typeof b.customerPhoto === 'string' &&
                            /^https?:\/\//i.test(b.customerPhoto) ? (
                              <Image
                                source={{ uri: b.customerPhoto }}
                                style={styles.customerAvatarImage}
                                onError={() =>
                                  setRecentBookings((previous) =>
                                    previous.map((item) =>
                                      item.id === b.id
                                        ? {
                                            ...item,
                                            customerPhoto: null,
                                          }
                                        : item
                                    )
                                  )
                                }
                              />
                            ) : (
                              <UserRound
                                size={23}
                                color={Colors.orange}
                              />
                            )}
                          </View>

                          <View style={styles.recentBookingInfo}>
                            <Text
                              style={styles.recentBookingName}
                              numberOfLines={1}
                            >
                              {(b.profiles as any)?.full_name ?? '—'}
                            </Text>

                            <View style={styles.recentBookingMetaRow}>
                              <Calendar
                                size={12}
                                color={Colors.textSecondary}
                              />
                              <Text style={styles.recentBookingDate}>
                                {b.event_date
                                  ? new Date(
                                      b.event_date
                                    ).toLocaleDateString('en-PH', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })
                                  : '—'}
                              </Text>
                            </View>

                            <View style={styles.recentBookingMetaRow}>
                              <Users
                                size={12}
                                color={Colors.textSecondary}
                              />
                              <Text style={styles.recentBookingGuests}>
                                {b.guest_count} guests
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.recentBookingRight}>
                          <Text
                            style={styles.recentBookingAmount}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            ₱{Number(b.total_cost).toLocaleString()}
                          </Text>

                          <View
                            style={[
                              styles.recentStatusBadge,
                              { backgroundColor: statusStyle.bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.recentStatusText,
                                { color: statusStyle.color },
                              ]}
                            >
                              {b.status.replace('_', ' ').toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              <View style={{ height: 40 }} />
            </View>
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  dashboardBody: {
    flexGrow: 1,
    position: 'relative',
    paddingBottom: 8,
  },

  skeletonBox: {
    backgroundColor: '#E5E7EB',
  },

  skeletonWelcome: {
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 24,
    padding: 22,
    gap: 13,
    backgroundColor: '#FFF1E6',
  },

  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  skeletonSection: {
    paddingHorizontal: 20,
    paddingTop: 26,
    gap: 12,
  },

  skeletonSubscription: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EEF4',
  },

  skeletonRecentBooking: {
    minHeight: 76,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EEF4',
  },

  skeletonFeatureCard: {
    marginHorizontal: 20,
    padding: 18,
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5EAF0',
  },

  skeletonCalendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },

  skeletonCalendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  skeletonCalendarWeekdays: {
    flexDirection: 'row',
    marginTop: 2,
  },

  skeletonCalendarWeekday: {
    width: '14.285%',
    alignItems: 'center',
    paddingVertical: 5,
  },

  skeletonCalendarCell: {
    width: '14.285%',
    minHeight: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },

  skeletonLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },

  skeletonTrendChart: {
    minHeight: 160,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: 8,
    paddingBottom: 4,
  },

  skeletonTrendColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
  },

  backgroundBlob: {
    position: 'absolute',
    backgroundColor: '#FED7AA',
    opacity: 0.3,
  },

  blobTopRight: {
    top: -75,
    right: -95,
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.32,
  },

  blobUpperLeft: {
    top: 345,
    left: -100,
    width: 230,
    height: 230,
    borderRadius: 115,
    opacity: 0.34,
  },

  blobMidRight: {
    top: 820,
    right: -110,
    width: 245,
    height: 245,
    borderRadius: 123,
    opacity: 0.28,
  },

  blobLowerLeft: {
    top: 1290,
    left: -90,
    width: 205,
    height: 205,
    borderRadius: 103,
    opacity: 0.33,
  },

  blobBottomRight: {
    top: 1740,
    right: -85,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.26,
  },

  blobBottomLeft: {
    top: 2190,
    left: -75,
    width: 170,
    height: 170,
    borderRadius: 85,
    opacity: 0.25,
  },

  closeNotifBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.black,
    borderRadius: 30,
    paddingHorizontal: 28,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },

  closeNotifText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 15,
  },

  header: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 10,
  },

  headerGreeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172033',
    letterSpacing: -0.8,
  },

  headerDate: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexShrink: 1,
    marginBottom: 4,
    color: '#8993a2',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    lineHeight: 14,
  },

  greetingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    alignSelf: 'stretch',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 2,
    marginBottom: 0,
  },

  greetingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F97316',
  },

  waveEmoji: {
    fontSize: 17,
    lineHeight: 21,
  },

  headerCaption: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
    marginTop: 3,
  },

  headerName: {
    flexShrink: 1,
    maxWidth: '100%',
    fontSize: 22,
    fontWeight: '800',
    color: '#f97316',
    letterSpacing: -0.8,
    lineHeight: 29,
  },

  headerRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexShrink: 0,
  },

  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.error,
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.white,
  },

  notifBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
  },

  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.orange,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },

  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    resizeMode: 'cover',
  },

  avatarText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 18,
  },

  // VERIFICATION SCREEN

  pendingScroll: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  pendingContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 35,
    paddingBottom: 30,
  },

  pendingIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },

  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFF1E6',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 17,
  },

  verificationBadgePending: {
    backgroundColor: '#FEF3C7',
  },

  verificationBadgeRejected: {
    backgroundColor: '#FEE2E2',
  },

  verificationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F97316',
  },

  verificationBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#C2410C',
  },

  pendingTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: Colors.black,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.4,
  },

  pendingSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 25,
  },

  reviewCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E9EEF4',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },

  reviewCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.black,
    marginBottom: 18,
  },

  reviewStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 18,
  },

  reviewStepIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },

  reviewStepIconPending: {
    backgroundColor: '#FEF3C7',
  },

  reviewStepText: {
    flex: 1,
  },

  reviewStepTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.black,
    marginBottom: 3,
  },

  reviewStepDescription: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  waitingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
  },

  waitingBadgeText: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '800',
  },

  waitingNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 15,
    padding: 14,
    marginTop: 4,
  },

  waitingNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 19,
    fontWeight: '600',
  },

  rejectionCard: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },

  rejectionTitle: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },

  rejectionText: {
    color: '#7F1D1D',
    fontSize: 13,
    lineHeight: 20,
  },

  pendingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.orange,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 16,
    shadowColor: Colors.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 18,
  },

  pendingBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 15,
  },

  pendingFooter: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 24,
    textAlign: 'center',
  },

  // APPROVED DASHBOARD

  subBanner: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 14,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },

  subBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  subBannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },

  subBannerPlan: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.black,
  },

  subUpgradeBtn: {
    flexDirection: 'row',
    gap: 5,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 10,
    alignItems: 'center',
    alignSelf: 'center',
  },

  subUpgradeBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    columnGap: 12,
    rowGap: 12,
    marginBottom: 4,
  },

  statCard: {
    width: '47%',
    flexGrow: 1,
    minHeight: 128,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9EEF4',
    gap: 7,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.025,
    shadowRadius: 6,
    elevation: 1,
    overflow: 'hidden',
  },

  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },

  statValue: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 4,
  },

  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
    lineHeight: 17,
  },

  section: {
    paddingHorizontal: 20,
    paddingTop: 26,
  },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 13,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: -0.35,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 3,
  },

  dashboardFeatureCard: {
    width: '100%',
    padding: 18,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5EAF0',
    shadowColor: '#18222C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.035,
    shadowRadius: 10,
    elevation: 1,
  },

  dashboardFeatureHeading: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 13,
    marginBottom: 17,
  },

  dashboardTrendsHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },

  dashboardFeatureCopy: {
    flex: 1,
    minWidth: 0,
  },

  dashboardEyebrow: {
    marginBottom: 6,
    color: '#F97316',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },

  dashboardFeatureTitle: {
    color: '#202A35',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },

  dashboardFeatureDescription: {
    marginTop: 5,
    color: '#75808C',
    fontSize: 12,
    lineHeight: 18,
  },

  dashboardFeatureButton: {
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: Colors.orange,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    alignSelf: 'flex-start',
  },

  dashboardFeatureButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '800',
  },

  dashboardFeedback: {
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },

  dashboardError: {
    color: Colors.error,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  dashboardLink: {
    color: Colors.orange,
    fontSize: 13,
    fontWeight: '800',
  },

  calendarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },

  calendarLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  calendarLegendOpen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DCFCE7',
  },

  calendarLegendFull: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.orangeLight,
  },

  calendarLegendBlocked: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: Colors.orangeLight,
    borderWidth: 1,
    borderColor: Colors.orange,
  },

  calendarLegendText: {
    color: Colors.textSecondary,
    fontSize: 10,
  },

  calendarCapacity: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },

  calendarSelectedStatus: {
    marginTop: 5,
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },

  dashboardTrendsIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: 12,
    backgroundColor: '#FFF1E6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  dashboardTrendChart: {
    width: '100%',
    minHeight: 188,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: 8,
    paddingBottom: 4,
  },

  dashboardTrendColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 7,
  },

  dashboardTrendCount: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
  },

  dashboardTrendTrack: {
    width: 27,
    height: 128,
    backgroundColor: '#FFF7ED',
    borderRadius: 9,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },

  dashboardTrendBar: {
    width: '100%',
    borderRadius: 8,
  },

  dashboardTrendMonth: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },

  dashboardTrendYear: {
    color: '#64748B',
    fontSize: 9,
  },

  dashboardTrendLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 7,
  },

  dashboardTrendLegendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FDBA74',
  },

  dashboardReportButton: {
    minHeight: 42,
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFE2CC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  dashboardReportButtonText: {
    color: Colors.orange,
    fontSize: 12,
    fontWeight: '800',
  },

  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  seeAll: {
    fontSize: 13,
    color: Colors.orange,
    fontWeight: '700',
  },

  actionsList: {
    gap: 10,
  },

  actionRow: {
    minHeight: 76,
    backgroundColor: Colors.white,
    borderRadius: 19,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E9EEF4',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.025,
    shadowRadius: 5,
    elevation: 1,
  },

  actionIconWrap: {
    width: 43,
    height: 43,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },

  actionTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#172033',
    marginBottom: 3,
  },

  actionDescription: {
    fontSize: 11,
    color: '#7B8798',
    lineHeight: 15,
  },

  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },

  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 8,
  },

  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  recentBookingCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9EEF4',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },

  recentBookingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },

  recentBookingAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },

  customerAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    resizeMode: 'cover',
  },

  recentBookingName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 4,
  },

  recentBookingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },

  recentBookingDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  recentBookingGuests: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  recentBookingRight: {
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '42%',
    flexShrink: 1,
  },

  recentBookingAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.black,
  },

  recentStatusBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  recentStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  recentBookingInfo: {
    flex: 1,
    minWidth: 0,
  },

  welcomeCard: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: '#F97316',
    borderRadius: 24,
    padding: 22,
    overflow: 'hidden',
    gap: 6,
  },

  cardBlobLarge: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(255,255,255,0.13)',
    top: -118,
    right: -78,
  },

  cardBlobSmall: {
    position: 'absolute',
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(255,210,159,0.23)',
    top: 64,
    right: -40,
  },

  cardBlobBottom: {
    position: 'absolute',
    width: 175,
    height: 175,
    borderRadius: 88,
    backgroundColor: 'rgba(194,65,12,0.17)',
    bottom: -128,
    left: -72,
  },

  cardAccentRing: {
    position: 'absolute',
    width: 172,
    height: 172,
    borderRadius: 86,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    top: -90,
    right: -42,
  },

  welcomeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  welcomeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  welcomeTag: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },

  welcomeTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.7,
  },

  welcomeTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },

  welcomeSubtitle: {
    fontSize: 12,
    lineHeight: 19,
    color: '#FFEDD5',
  },

  welcomeLine: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.24)',
    marginVertical: 12,
  },

  welcomeBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 17,
  },

  welcomeMetric: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  welcomeMetricLabel: {
    fontSize: 11,
    color: '#FFEDD5',
    marginTop: 2,
  },

  welcomeDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  welcomeArrow: {
    marginLeft: 'auto',
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  planHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },

  planIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statAccent: {
    height: 3,
    width: 28,
    borderRadius: 5,
    opacity: 0.55,
    marginTop: 'auto',
  },
});
