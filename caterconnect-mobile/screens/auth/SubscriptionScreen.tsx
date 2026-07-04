import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform,
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { initiateGCashPayment, openGCashCheckout } from '@/lib/xendit';
import { supabase } from '@/lib/supabase';

// ── Custom icon set (PNG) — replaces all emoji glyphs. ──────────
// Drop these into assets/icons/ alongside the rest of your icon set.
const ICONS = {
  close: require('../../assets/icons/close.png'),
  star: require('../../assets/icons/star.png'),
  fireWhite: require('../../assets/icons/fire_white.png'),
  checkBlue: require('../../assets/icons/check_blue.png'),
  tag: require('../../assets/icons/tag.png'),
  check: require('../../assets/icons/check.png'),
  chevronUp: require('../../assets/icons/chevron_up.png'),
  chevronDown: require('../../assets/icons/chevron_down.png'),
  lock: require('../../assets/icons/lock.png'),
};

const PLANS = [
  {
    id: 'free',
    name: 'Free Plan',
    price: 0,
    color: '#6B7280',
    bg: '#F3F4F6',
    border: '#E5E7EB',
    badgeIcon: ICONS.tag,
    features: [
      '3 catering packages',
      '5 booking requests/month',
      'Basic profile visibility',
      'Lower search placement',
    ],
    limitations: true,
  },
  {
    id: 'basic',
    name: 'Basic Plan',
    price: 299,
    color: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    badgeIcon: ICONS.checkBlue,
    features: [
      'Unlimited packages',
      '20 booking requests/month',
      'Higher search visibility',
      'Improved Budget Match placement',
      'Profile customization',
    ],
    limitations: false,
  },
  {
    id: 'standard',
    name: 'Standard Plan',
    price: 499,
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
    badgeIcon: ICONS.fireWhite,
    features: [
      'All Basic features',
      '50 booking requests/month',
      'Featured listing placement',
      'Priority Budget Match results',
      'Increased promotional visibility',
    ],
    limitations: false,
    popular: true,
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    price: 999,
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#DDD6FE',
    badgeIcon: ICONS.star,
    features: [
      'All Standard features',
      'Unlimited booking requests',
      'Featured Caterer Badge',
      'Top search placement',
      '#1 Budget Match ranking',
      'Homepage feature placements',
    ],
    limitations: false,
    badgeLabel: 'PREMIUM',
  },
];

const PLAN_ICON: Record<string, any> = {
  free: ICONS.tag,
  basic: ICONS.checkBlue,
  standard: ICONS.fireWhite,
  premium: ICONS.star,
};

type SubscriptionScreenProps = {
  onClose?: () => void;
};

export default function SubscriptionScreen({ onClose }: SubscriptionScreenProps) {
  const { catererData, session, profile } = useAuth();
  const [paying, setPaying] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [catererData?.id]);

  const loadHistory = async () => {
    if (!catererData?.id) return;
    const { data } = await supabase
      .from('subscription_payments')
      .select('*')
      .eq('caterer_id', catererData.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setPaymentHistory(data ?? []);
  };

  const handleUpgrade = async (plan: typeof PLANS[0]) => {
    if (plan.id === 'free') return;
    if (plan.id === catererData?.subscription_plan) {
      Alert.alert('Already on this plan', 'You are currently subscribed to this plan.');
      return;
    }
    if (!catererData?.id || !session?.user || !profile) return;

    Alert.alert(
      `Upgrade to ${plan.name}`,
      `You will be charged ₱${plan.price}/month via GCash. Proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay with GCash',
          onPress: async () => {
            setPaying(plan.id);

            const referenceId = `sub_${catererData.id}_${plan.id}_${Date.now()}`;

            const result = await initiateGCashPayment({
              type: 'subscription',
              amount: plan.price,
              referenceId,
              customerName: profile.full_name,
              customerEmail: session.user.email ?? '',
              description: `CaterConnect ${plan.name} - Monthly Subscription`,
            });

            if (!result.success || !result.checkoutUrl) {
              Alert.alert('Payment Error', result.error ?? 'Failed to initiate payment.');
              setPaying(null);
              return;
            }

            const outcome = await openGCashCheckout(result.checkoutUrl!, result.chargeId!, result.webUrl,);
            setPaying(null);

            if (outcome === 'success') {
              Alert.alert(
                'Payment Successful!',
                `Your ${plan.name} has been activated! It may take a moment to reflect.`,
              );
              loadHistory();
            } else if (outcome === 'failed') {
              Alert.alert('Payment Failed', 'Your GCash payment was not completed. Please try again.');
            } else {
              Alert.alert('Payment Cancelled', 'You cancelled the payment.');
            }
          },
        },
      ]
    );
  };

  const currentPlan = catererData?.subscription_plan ?? 'free';
  const expiresAt = (catererData as any)?.subscription_expires_at;
  const currentPlanColor = PLANS.find((p) => p.id === currentPlan)?.color ?? Colors.orange;
  const currentPlanIcon = PLAN_ICON[currentPlan] ?? ICONS.tag;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Subscription Plans</Text>
            <Text style={styles.pageSub}>Upgrade to get more bookings and visibility</Text>
          </View>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Image source={ICONS.close} style={[styles.iconClose, { tintColor: Colors.textSecondary }]} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Current plan banner */}
      <View style={[styles.currentPlanBanner, { borderColor: currentPlanColor }]}>
        <View style={styles.currentPlanLeft}>
          <Text style={[styles.currentPlanLabel, { color: currentPlanColor }]}>YOUR CURRENT PLAN</Text>
          <Text style={styles.currentPlanName}>
            {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
          </Text>
          {expiresAt && currentPlan !== 'free' && (
            <Text style={styles.currentPlanExpiry}>
              Renews {new Date(expiresAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          )}
          <Text style={styles.currentPlanUsage}>
            {catererData?.monthly_booking_count ?? 0} bookings used this month
          </Text>
        </View>
        <View style={[styles.currentPlanBadge, { backgroundColor: currentPlanColor + '18' }]}>
          <Image
            source={currentPlanIcon}
            style={[
              styles.currentPlanBadgeIcon,
              currentPlanIcon !== ICONS.fireWhite && currentPlanIcon !== ICONS.star && { tintColor: currentPlanColor },
            ]}
          />
        </View>
      </View>

      {/* Plan cards */}
      <View style={{ padding: 20, gap: 14 }}>
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isPaying = paying === plan.id;

          return (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                { borderColor: isCurrent ? plan.color : plan.border },
                isCurrent && { backgroundColor: plan.bg },
              ]}
            >
              {/* Ribbon badge: current / popular / premium — priority order, only one shows */}
              {isCurrent ? (
                <View style={[styles.ribbonBadge, { backgroundColor: plan.color }]}>
                  <Image source={ICONS.check} style={[styles.ribbonIcon, { tintColor: Colors.white }]} />
                  <Text style={styles.ribbonBadgeText}>CURRENT PLAN</Text>
                </View>
              ) : plan.popular ? (
                <View style={[styles.ribbonBadge, { backgroundColor: plan.color }]}>
                  <Image source={ICONS.fireWhite} style={styles.ribbonIcon} />
                  <Text style={styles.ribbonBadgeText}>MOST POPULAR</Text>
                </View>
              ) : plan.badgeLabel ? (
                <View style={[styles.ribbonBadge, { backgroundColor: plan.color }]}>
                  <Image source={ICONS.star} style={styles.ribbonIcon} />
                  <Text style={styles.ribbonBadgeText}>{plan.badgeLabel}</Text>
                </View>
              ) : null}

              {/* Plan header */}
              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                <View style={styles.planPriceWrap}>
                  {plan.price === 0 ? (
                    <Text style={[styles.planPrice, { color: plan.color }]}>FREE</Text>
                  ) : (
                    <>
                      <Text style={[styles.planPrice, { color: plan.color }]}>₱{plan.price}</Text>
                      <Text style={styles.planPricePer}>/month</Text>
                    </>
                  )}
                </View>
              </View>

              {/* Features */}
              <View style={styles.featuresList}>
                {plan.features.map((feat) => (
                  <View key={feat} style={styles.featureRow}>
                    <Image source={ICONS.check} style={[styles.iconFeatureCheck, { tintColor: plan.color }]} />
                    <Text style={styles.featureText}>{feat}</Text>
                  </View>
                ))}
              </View>

              {/* CTA button */}
              {plan.id !== 'free' && (
                <TouchableOpacity
                  style={[
                    styles.upgradeBtn,
                    { backgroundColor: isCurrent ? plan.color + '33' : plan.color },
                    isPaying && styles.upgradeBtnDisabled,
                  ]}
                  onPress={() => handleUpgrade(plan)}
                  disabled={isCurrent || isPaying}
                  activeOpacity={0.85}
                >
                  {isPaying ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : isCurrent ? (
                    <View style={styles.upgradeBtnRow}>
                      <Image source={ICONS.check} style={[styles.iconUpgradeBtn, { tintColor: plan.color }]} />
                      <Text style={[styles.upgradeBtnText, { color: plan.color }]}>Current Plan</Text>
                    </View>
                  ) : (
                    <Text style={styles.upgradeBtnText}>
                      Upgrade • Pay ₱{plan.price} via GCash
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Payment history */}
      <TouchableOpacity
        style={styles.historyToggle}
        onPress={() => setShowHistory(!showHistory)}
        activeOpacity={0.8}
      >
        <Image source={showHistory ? ICONS.chevronUp : ICONS.chevronDown} style={styles.iconChevron} />
        <Text style={styles.historyToggleText}>
          {showHistory ? 'Hide' : 'Show'} Payment History
        </Text>
      </TouchableOpacity>

      {showHistory && (
        <View style={styles.historyList}>
          {paymentHistory.length === 0 ? (
            <Text style={styles.historyEmpty}>No payment history yet.</Text>
          ) : (
            paymentHistory.map((p) => (
              <View key={p.id} style={styles.historyRow}>
                <View>
                  <Text style={styles.historyPlan}>{p.plan_id?.toUpperCase()} Plan</Text>
                  <Text style={styles.historyDate}>
                    {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyAmount}>₱{Number(p.amount).toLocaleString()}</Text>
                  <View style={[styles.historyStatus, { backgroundColor: p.status === 'confirmed' ? '#DCFCE7' : '#FEF3C7' }]}>
                    <Text style={[styles.historyStatusText, { color: p.status === 'confirmed' ? '#166534' : '#92400E' }]}>
                      {p.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* Note */}
      <View style={styles.noteBox}>
        <Image source={ICONS.lock} style={[styles.iconNote, { tintColor: '#1E40AF' }]} />
        <Text style={styles.noteText}>
          Payments are processed securely via GCash through Xendit. Your subscription activates automatically upon successful payment.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  pageTitle: { fontSize: 26, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  pageSub: { fontSize: 14, color: Colors.textSecondary },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bg,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 12,
  },
  iconClose: { width: 13, height: 13 },

  currentPlanBanner: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: Colors.white, borderRadius: 18,
    padding: 18, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center',
  },
  currentPlanLeft: { flex: 1 },
  currentPlanLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  currentPlanName: { fontSize: 22, fontWeight: '900', color: Colors.black, marginBottom: 3 },
  currentPlanExpiry: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  currentPlanUsage: { fontSize: 12, color: Colors.textSecondary },
  currentPlanBadge: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  currentPlanBadgeIcon: { width: 26, height: 26 },

  planCard: {
    backgroundColor: Colors.white, borderRadius: 20,
    padding: 20, borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    overflow: 'hidden',
  },
  ribbonBadge: {
    position: 'absolute', top: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderBottomLeftRadius: 14, paddingHorizontal: 12, paddingVertical: 6,
  },
  ribbonIcon: { width: 11, height: 11 },
  ribbonBadgeText: { color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, marginTop: 8 },
  planName: { fontSize: 18, fontWeight: '900' },
  planPriceWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  planPrice: { fontSize: 24, fontWeight: '900' },
  planPricePer: { fontSize: 13, color: Colors.textSecondary },
  featuresList: { gap: 10, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconFeatureCheck: { width: 16, height: 16, marginTop: 1 },
  featureText: { fontSize: 13, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  upgradeBtn: {
    borderRadius: 50, paddingVertical: 14,
    alignItems: 'center',
  },
  upgradeBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconUpgradeBtn: { width: 14, height: 14 },
  upgradeBtnDisabled: { opacity: 0.6 },
  upgradeBtnText: { color: 'white', fontWeight: '900', fontSize: 14 },

  historyToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 12, padding: 12,
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  iconChevron: { width: 13, height: 13 },
  historyToggleText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  historyList: { marginHorizontal: 20, backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  historyEmpty: { padding: 20, textAlign: 'center', color: Colors.textMuted, fontSize: 13 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  historyPlan: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 2 },
  historyDate: { fontSize: 11, color: Colors.textMuted },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyAmount: { fontSize: 15, fontWeight: '900', color: Colors.orange },
  historyStatus: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  historyStatusText: { fontSize: 10, fontWeight: '800' },

  noteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginHorizontal: 20, backgroundColor: '#EFF6FF', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#BFDBFE',
  },
  iconNote: { width: 15, height: 15, marginTop: 2 },
  noteText: { fontSize: 12, color: '#1E40AF', lineHeight: 19, flex: 1 },
});