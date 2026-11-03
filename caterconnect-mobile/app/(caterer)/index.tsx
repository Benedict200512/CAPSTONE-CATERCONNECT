// app/(caterer)/index.tsx

import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import {
  Animated,
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
  Sparkles,
  UserRound,
  FileCheck,
  ShieldCheck,
  Clock,
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
            {pulse({ width: 128, height: 18, borderRadius: 9 })}
            {pulse({ width: '75%', height: 24, borderRadius: 10 })}
            {pulse({ width: '85%', height: 11, borderRadius: 6 })}
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {pulse({ width: 44, height: 44, borderRadius: 22 })}
            {pulse({ width: 44, height: 44, borderRadius: 22 })}
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 44 }}
        >
          <View style={styles.skeletonWelcome}>
            <View style={styles.skeletonRow}>
              {pulse({ width: 42, height: 42, borderRadius: 14 })}
              {pulse({ width: 128, height: 23, borderRadius: 14 })}
            </View>

            {pulse({ width: '80%', height: 24, borderRadius: 8 })}
            {pulse({ width: '95%', height: 13, borderRadius: 6 })}
            {pulse({ width: '68%', height: 13, borderRadius: 6 })}
          </View>

          <View style={styles.skeletonSection}>
            {pulse({ width: 154, height: 21, borderRadius: 7 })}
            {pulse({ width: 182, height: 12, borderRadius: 6 })}
          </View>

          <View style={styles.statsGrid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.statCard}>
                {pulse({ width: 38, height: 38, borderRadius: 13 })}
                {pulse({ width: 82, height: 28, borderRadius: 8 })}
                {pulse({ width: 106, height: 13, borderRadius: 6 })}
              </View>
            ))}
          </View>

          <View style={styles.skeletonSection}>
            {pulse({ width: 143, height: 21, borderRadius: 7 })}
            {pulse({ width: 205, height: 12, borderRadius: 6 })}

            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.actionRow}>
                {pulse({ width: 43, height: 43, borderRadius: 15 })}
                <View style={{ flex: 1, gap: 9 }}>
                  {pulse({ width: '72%', height: 15, borderRadius: 7 })}
                  {pulse({ width: '91%', height: 11, borderRadius: 6 })}
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
            <View style={styles.greetingRow}>
              <View style={styles.greetingDot} />
              <Text style={styles.headerGreeting}>Welcome back!</Text>
              <Text style={styles.waveEmoji}>👋</Text>
            </View>

            <Text style={styles.headerName} numberOfLines={2}>
              {displayName}
            </Text>

            <Text style={styles.headerCaption}>
              Here’s what’s happening with your catering business.
            </Text>
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
            contentContainerStyle={{ flexGrow: 1 }}
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

              {/* WELCOME CARD */}
              <View style={styles.welcomeCard}>
                <View
                  pointerEvents="none"
                  style={styles.cardBlobLarge}
                />
                <View
                  pointerEvents="none"
                  style={styles.cardBlobSmall}
                />
                <View
                  pointerEvents="none"
                  style={styles.cardBlobBottom}
                />
                <View
                  pointerEvents="none"
                  style={styles.cardAccentRing}
                />

                <View style={styles.welcomeTop}>
                  <View style={styles.welcomeIcon}>
                    <Sparkles size={20} color="#FFFFFF" />
                  </View>

                  <View style={styles.welcomeTag}>
                    <Text style={styles.welcomeTagText}>
                      CATERER OVERVIEW
                    </Text>
                  </View>
                </View>

                <Text style={styles.welcomeTitle}>
                  Your business, at a glance.
                </Text>

                <Text style={styles.welcomeSubtitle}>
                  Stay on top of reservations and keep your catering business
                  moving.
                </Text>

                <View style={styles.welcomeLine} />

                <View style={styles.welcomeBottom}>
                  <View>
                    <Text style={styles.welcomeMetric}>
                      {stats.total}
                    </Text>
                    <Text style={styles.welcomeMetricLabel}>
                      Total bookings
                    </Text>
                  </View>

                  <View style={styles.welcomeDivider} />

                  <View>
                    <Text style={styles.welcomeMetric}>
                      {stats.pending}
                    </Text>
                    <Text style={styles.welcomeMetricLabel}>
                      Awaiting review
                    </Text>
                  </View>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Open bookings"
                    onPress={() =>
                      router.push('/(caterer)/bookings')
                    }
                    activeOpacity={0.8}
                    style={styles.welcomeArrow}
                  >
                    <ArrowUpRight size={20} color="#F97316" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* SUBSCRIPTION */}
              <TouchableOpacity
                style={[
                  styles.subBanner,
                  { borderColor: planColor + '40' },
                ]}
                onPress={() => router.push('/(caterer)/profile')}
                activeOpacity={0.85}
              >
                <View style={styles.subBannerLeft}>
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

                  <MonthlyBookingQuotaSummary compact />
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
              </TouchableOpacity>

              {/* BOOKING SNAPSHOT */}
              <View style={styles.statsSectionTitle}>
                <View>
                  <Text style={styles.sectionTitle}>
                    Booking Snapshot
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Your latest booking totals
                  </Text>
                </View>
              </View>

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
                        style={[styles.statValue, { color: s.color }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {s.value}
                      </Text>

                      <Text
                        style={styles.statLabel}
                        numberOfLines={2}
                      >
                        {s.label}
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

              {/* QUICK ACTIONS */}
              <View style={styles.section}>
                <View style={styles.sectionRow}>
                  <View>
                    <Text style={styles.sectionTitle}>
                      Quick Actions
                    </Text>
                    <Text style={styles.sectionSubtitle}>
                      Manage your catering business
                    </Text>
                  </View>
                </View>

                <View style={styles.actionsList}>
                  {quickActions.map((a) => {
                    const ActionIcon = a.icon;

                    return (
                      <TouchableOpacity
                        key={a.label}
                        style={styles.actionRow}
                        onPress={() => router.push(a.path as any)}
                        activeOpacity={0.78}
                      >
                        <View
                          style={[
                            styles.actionIconWrap,
                            { backgroundColor: a.bg },
                          ]}
                        >
                          <ActionIcon
                            size={21}
                            color={a.color}
                            strokeWidth={2.2}
                          />
                        </View>

                        <View style={styles.actionTextWrap}>
                          <Text style={styles.actionLabel}>
                            {a.label}
                          </Text>
                          <Text style={styles.actionDescription}>
                            {a.description}
                          </Text>
                        </View>

                        <ChevronRight
                          size={19}
                          color="#94A3B8"
                        />
                      </TouchableOpacity>
                    );
                  })}
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
                      Your latest customer requests
                    </Text>
                  </View>

                  {recentBookings.length > 0 && (
                    <TouchableOpacity
                      style={styles.seeAllRow}
                      onPress={() =>
                        router.push('/(caterer)/bookings')
                      }
                    >
                      <Text style={styles.seeAll}>See all</Text>
                      <ChevronRight
                        size={16}
                        color={Colors.orange}
                      />
                    </TouchableOpacity>
                  )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 19,
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 10,
  },

  headerGreeting: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F97316',
  },

  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 8,
    backgroundColor: '#FFF1E6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
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
    fontSize: 20,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: -0.45,
    lineHeight: 25,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 20,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },

  subBannerLeft: {
    flex: 1,
    gap: 4,
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
    minHeight: 142,
    backgroundColor: Colors.white,
    borderRadius: 20,
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
    fontSize: 29,
    fontWeight: '900',
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
    marginBottom: 7,
  },

  planIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statsSectionTitle: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 13,
  },

  statAccent: {
    height: 3,
    width: 28,
    borderRadius: 5,
    opacity: 0.55,
    marginTop: 'auto',
  },
});
