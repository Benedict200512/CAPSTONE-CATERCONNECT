import { useEffect, useState } from 'react';

import {

  ActivityIndicator, Alert, Modal, Platform,

  ScrollView, StyleSheet, Text,

  TouchableOpacity, View,

} from 'react-native';

import { Colors } from '@/constants/colors';

import { useAuth } from '@/context/AuthContext';

import { initiateGCashPayment, openGCashCheckout } from '@/lib/xendit';

import { supabase } from '@/lib/supabase';
import MonthlyBookingQuotaSummary from '@/components/MonthlyBookingQuotaSummary';
import { useBookingRefresh } from '@/hooks/useBookingRefresh';

import { 

  X, Tag, BadgeCheck, Zap, Crown, CheckCircle2, 

  ChevronDown, ChevronUp, Lock, ArrowRight, ShieldCheck,

  Smartphone, Wallet, Building2, CreditCard

} from 'lucide-react-native';

const PLANS = [

  {

    id: 'free',

    name: 'Free Plan',

    price: 0,

    max_packages: 3,

    max_bookings: 5,

    features: [

      '3 catering packages',

      '5 accepted bookings/month',

      'Basic profile visibility',

      'Lower search placement',

    ],

    ui: { color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', icon: Tag, isDark: false },

  },

  {

    id: 'basic',

    name: 'Basic Plan',

    price: 299,

    max_packages: null,

    max_bookings: 20,

    features: [

      'Unlimited packages',

      '20 accepted bookings/month',

      'Higher search visibility',

      'Improved Budget Match placement',

      'Profile customization',

    ],

    ui: { color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', icon: BadgeCheck, isDark: false },

  },

  {

    id: 'standard',

    name: 'Standard Plan',

    price: 499,

    max_packages: null,

    max_bookings: 50,

    features: [

      'All Basic features',

      '50 accepted bookings/month',

      'Featured listing placement',

      'Priority Budget Match results',

      'Increased promotional visibility',

    ],

    ui: { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', icon: Zap, popular: true, isDark: false },

  },

  {

    id: 'premium',

    name: 'Premium Plan',

    price: 999,

    max_packages: null,

    max_bookings: null,

    features: [

      'All Standard features',

      'Unlimited accepted bookings',

      'Featured Caterer Badge',

      'Top search placement',

      '#1 Budget Match ranking',

      'Homepage feature placements',

    ],

    ui: { color: '#C084FC', bg: '#2E1065', border: '#4C1D95', icon: Crown, badge: 'PRO', isDark: true },

  },

];

const PAYMENT_CHANNELS = [

  { key: 'gcash', label: 'GCash', sub: 'Instant E-Wallet', icon: Smartphone },

  { key: 'maya', label: 'Maya', sub: 'E-Wallet / QR', icon: Wallet },

  { key: 'bpi', label: 'BPI Online', sub: 'Bank Transfer', icon: Building2 },

  { key: 'bdo', label: 'BDO Online', sub: 'Bank Transfer', icon: Building2 },

  { key: 'card', label: 'Credit / Debit Card', sub: 'Visa, Mastercard, JCB', icon: CreditCard },

];

type SubscriptionScreenProps = {

  onClose?: () => void;

};

export default function SubscriptionScreen({ onClose }: SubscriptionScreenProps) {

  const { catererData, session, profile, reloadProfile } = useAuth() as any;

  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);

  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<typeof PLANS[0] | null>(null);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('gcash');

  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  const [showHistory, setShowHistory] = useState(false);
  const [quotaRefresh, setQuotaRefresh] = useState(0);

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

  const handleConfirmUpgrade = async () => {

    if (!selectedPlanForUpgrade) return;

    const plan = selectedPlanForUpgrade;

    if (!catererData?.id || !session?.user || !profile) {

      Alert.alert('Error', 'Missing user profile or caterer session data.');

      return;

    }

    const channel = PAYMENT_CHANNELS.find(c => c.key === selectedPaymentMethod);

    setPayingPlanId(plan.id);

    try {

      const referenceId = `sub_${catererData.id}_${plan.id}_${Date.now()}`;

      const result = await initiateGCashPayment({

        type: 'subscription',

        amount: plan.price,

        referenceId,

        customerName: profile.full_name,

        customerEmail: session.user.email ?? '',

        description: `CaterConnect ${plan.name} - Monthly Subscription`,

        paymentMethod: selectedPaymentMethod,

      });

      if (!result.success || !result.checkoutUrl) {

        throw new Error(result.error ?? 'Failed to initiate payment gateway.');

      }

      const outcome = await openGCashCheckout(result.checkoutUrl!, result.chargeId!, result.webUrl);

      if (outcome === 'success') {

        // Only the verified server-side webhook may activate a subscription.

        // Refresh read-only state; do not write caterers or subscription_payments here.

        if (typeof reloadProfile === 'function') {

          await reloadProfile();

        }

        await loadHistory();
        setQuotaRefresh(value => value + 1);

        setSelectedPlanForUpgrade(null);

        Alert.alert(

          'Subscription Activated',

          'Your payment and active subscription have been confirmed by the server.'

        );

      } else if (outcome === 'failed') {

        Alert.alert('Payment Failed', 'Your transaction was not completed. Please try again.');

      } else if (outcome === 'pending') {
        setSelectedPlanForUpgrade(null);
        Alert.alert('Payment Processing', 'Confirmation is still pending. This screen will refresh automatically. Do not pay again while confirmation is pending.');
      }

    } catch (err: any) {

      Alert.alert('Payment Error', err.message || 'An unexpected error occurred.');

    } finally {

      setPayingPlanId(null);

    }

  };

  useBookingRefresh(catererData?.id && session?.user.id ? `${session.user.id}:${catererData.id}:subscription` : null, async () => {
    await Promise.all([reloadProfile(), loadHistory()]);
    setQuotaRefresh(value => value + 1);
  });

  const currentPlanId = catererData?.subscription_plan ?? 'free';

  const currentPlan = PLANS.find(p => p.id === currentPlanId) ?? PLANS[0];

  const expiresAt = (catererData as any)?.subscription_expires_at;

  return (

    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Checkout Modal for Payment Method Selection ── */}

      <Modal

        visible={!!selectedPlanForUpgrade}

        animationType="slide"

        presentationStyle="pageSheet"

        onRequestClose={() => setSelectedPlanForUpgrade(null)}

      >

        <View style={styles.modalRoot}>

          <View style={styles.modalHeader}>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>

              <ShieldCheck size={22} color={Colors.orange} />

              <Text style={styles.modalTitle}>Complete Subscription</Text>

            </View>

            <TouchableOpacity onPress={() => setSelectedPlanForUpgrade(null)} style={styles.modalCloseBtn}>

              <Text style={styles.modalCloseText}>Cancel</Text>

            </TouchableOpacity>

          </View>

          {selectedPlanForUpgrade && (

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>

              <View style={styles.summaryCard}>

                <Text style={styles.summaryCardTitle}>Selected Plan</Text>

                <View style={styles.summaryRow}>

                  <Text style={styles.summaryLabel}>Plan Tier</Text>

                  <Text style={styles.summaryVal}>{selectedPlanForUpgrade.name}</Text>

                </View>

                <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>

                  <Text style={styles.summaryLabel}>Monthly Fee</Text>

                  <Text style={[styles.summaryVal, { color: Colors.orange, fontWeight: '900' }]}>

                    ₱{selectedPlanForUpgrade.price} / mo

                  </Text>

                </View>

              </View>

              <Text style={styles.modalSectionTitle}>Select Payment Method</Text>

              <Text style={styles.modalSectionSub}>Choose a payment channel for server-verified activation.</Text>

              <View style={styles.paymentMethodsList}>

                {PAYMENT_CHANNELS.map((channel) => {

                  const IconComponent = channel.icon;

                  const isSelected = selectedPaymentMethod === channel.key;

                  return (

                    <TouchableOpacity

                      key={channel.key}

                      style={[styles.methodRow, isSelected && styles.methodRowActive]}

                      onPress={() => setSelectedPaymentMethod(channel.key)}

                      activeOpacity={0.85}

                    >

                      <View style={[styles.methodIconBadge, isSelected && styles.methodIconBadgeActive]}>

                        <IconComponent size={20} color={isSelected ? Colors.orange : Colors.textSecondary} />

                      </View>

                      <View style={{ flex: 1 }}>

                        <Text style={[styles.methodName, isSelected && styles.methodNameActive]}>{channel.label}</Text>

                        <Text style={styles.methodSub}>{channel.sub}</Text>

                      </View>

                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>

                        {isSelected && <View style={styles.radioInnerDot} />}

                      </View>

                    </TouchableOpacity>

                  );

                })}

              </View>

              <TouchableOpacity

                style={styles.payNowBtn}

                onPress={handleConfirmUpgrade}

                disabled={payingPlanId === selectedPlanForUpgrade.id}

                activeOpacity={0.85}

              >

                {payingPlanId === selectedPlanForUpgrade.id ? (

                  <ActivityIndicator color={Colors.white} />

                ) : (

                  <>

                    <Lock size={16} color={Colors.white} />

                    <Text style={styles.payNowBtnText}>

                      Pay ₱{selectedPlanForUpgrade.price} via {PAYMENT_CHANNELS.find(c => c.key === selectedPaymentMethod)?.label}

                    </Text>

                  </>

                )}

              </TouchableOpacity>

              <Text style={styles.secureNotice}>

                🔒 Secure payment processing. Subscriptions activate after server-side payment verification.

              </Text>

            </ScrollView>

          )}

        </View>

      </Modal>

      {/* Main Screen Header */}

      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>

        <View style={styles.headerTop}>

          <View style={{ flex: 1 }}>

            <Text style={styles.pageTitle}>Plans & Billing</Text>

            <Text style={styles.pageSub}>Upgrade to get more bookings and higher visibility.</Text>

          </View>

          {onClose && (

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>

              <X size={20} color={Colors.textSecondary} />

            </TouchableOpacity>

          )}

        </View>

      </View>

      <View style={[styles.activePlanCard, { borderColor: currentPlan.ui.color }]}>

        <View style={styles.activePlanHeader}>

          <View>

            <Text style={[styles.activePlanLabel, { color: currentPlan.ui.color }]}>CURRENT PLAN</Text>

            <Text style={styles.activePlanName}>{currentPlan.name}</Text>

          </View>

          <View style={[styles.activePlanIconWrap, { backgroundColor: currentPlan.ui.color + '15' }]}>

            <currentPlan.ui.icon size={24} color={currentPlan.ui.color} />

          </View>

        </View>

        <View style={styles.usageContainer}>

          <MonthlyBookingQuotaSummary refreshKey={quotaRefresh} />

        </View>

        {expiresAt && currentPlanId !== 'free' && (

          <View style={styles.renewalBox}>

            <ShieldCheck size={16} color={Colors.textSecondary} />

            <Text style={styles.renewalText}>

              Renews {new Date(expiresAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}

            </Text>

          </View>

        )}

      </View>

      {/* Plans List */}

      <View style={styles.plansContainer}>

        {PLANS.map((plan) => {

          const isCurrent = plan.id === currentPlanId;

          const { ui } = plan;

          return (

            <View

              key={plan.id}

              style={[

                styles.planCard,

                { borderColor: isCurrent ? ui.color : ui.border, backgroundColor: ui.bg },

                isCurrent && styles.planCardActive

              ]}

            >

              {isCurrent ? (

                <View style={[styles.ribbon, { backgroundColor: ui.color }]}>

                  <Text style={styles.ribbonText}>ACTIVE</Text>

                </View>

              ) : ui.popular ? (

                <View style={[styles.ribbon, { backgroundColor: ui.color }]}>

                  <Zap size={10} color="#FFF" fill="#FFF" style={{ marginRight: 4 }} />

                  <Text style={styles.ribbonText}>MOST POPULAR</Text>

                </View>

              ) : ui.badge ? (

                <View style={[styles.ribbon, { backgroundColor: ui.color }]}>

                  <Text style={styles.ribbonText}>{ui.badge}</Text>

                </View>

              ) : null}

              <View style={styles.planHeader}>

                <Text style={[styles.planTitle, { color: ui.isDark ? '#FFF' : ui.color }]}>{plan.name}</Text>

                <View style={styles.priceRow}>

                  {plan.price === 0 ? (

                    <Text style={[styles.priceLarge, { color: ui.isDark ? '#FFF' : Colors.black }]}>FREE</Text>

                  ) : (

                    <>

                      <Text style={[styles.priceLarge, { color: ui.isDark ? '#FFF' : Colors.black }]}>₱{plan.price}</Text>

                      <Text style={[styles.priceSub, { color: ui.isDark ? '#A78BFA' : Colors.textSecondary }]}>/mo</Text>

                    </>

                  )}

                </View>

              </View>

              <View style={styles.featureList}>

                {plan.features.map((feat, idx) => (

                  <View key={idx} style={styles.featureRow}>

                    <CheckCircle2 size={16} color={ui.isDark ? '#C084FC' : ui.color} />

                    <Text style={[styles.featureText, { color: ui.isDark ? '#E2E8F0' : Colors.textSecondary }]}>

                      {feat}

                    </Text>

                  </View>

                ))}

              </View>

              {plan.id !== 'free' && (

                <TouchableOpacity

                  style={[

                    styles.upgradeBtn,

                    { backgroundColor: isCurrent ? (ui.isDark ? 'rgba(255,255,255,0.1)' : ui.color + '15') : ui.color }

                  ]}

                  onPress={() => setSelectedPlanForUpgrade(plan)}

                  disabled={isCurrent}

                  activeOpacity={0.85}

                >

                  {isCurrent ? (

                    <Text style={[styles.upgradeBtnText, { color: ui.isDark ? '#FFF' : ui.color }]}>Current Plan</Text>

                  ) : (

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>

                      <Text style={[styles.upgradeBtnText, { color: '#FFF' }]}>Upgrade to {plan.name}</Text>

                      <ArrowRight size={16} color="#FFF" />

                    </View>

                  )}

                </TouchableOpacity>

              )}

            </View>

          );

        })}

      </View>

      <View style={styles.historySection}>

        <TouchableOpacity style={styles.historyToggle} onPress={() => setShowHistory(!showHistory)} activeOpacity={0.8}>

          <Text style={styles.historyToggleText}>Payment History</Text>

          {showHistory ? <ChevronUp size={18} color={Colors.textSecondary} /> : <ChevronDown size={18} color={Colors.textSecondary} />}

        </TouchableOpacity>

        {showHistory && (

          <View style={styles.historyList}>

            {paymentHistory.length === 0 ? (

              <View style={styles.historyEmpty}>

                <Text style={styles.historyEmptyText}>No transactions yet.</Text>

              </View>

            ) : (

              paymentHistory.map((p) => (

                <View key={p.id} style={styles.historyRow}>

                  <View>

                    <Text style={styles.historyPlan}>{p.plan_id.toUpperCase()} Plan</Text>

                    <Text style={styles.historyDate}>

                      {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · {p.payment_method?.toUpperCase() || 'ONLINE'}

                    </Text>

                  </View>

                  <View style={{ alignItems: 'flex-end' }}>

                    <Text style={styles.historyAmount}>₱{Number(p.amount).toLocaleString()}</Text>

                    <View style={[styles.historyStatusBadge, { backgroundColor: p.status === 'confirmed' ? '#DCFCE7' : '#FEF3C7' }]}>

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

      </View>

      <View style={styles.secureNote}>

        <Lock size={16} color="#475569" />

        <Text style={styles.secureNoteText}>

          Payments are securely processed online. Subscriptions update after server-side payment verification.

        </Text>

      </View>

      <View style={{ height: 40 }} />

    </ScrollView>

  );

}

const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: '#F8FAFC' },

  header: { paddingHorizontal: 20, paddingBottom: 16 },

  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },

  pageTitle: { fontSize: 28, fontWeight: '900', color: Colors.black, marginBottom: 4, letterSpacing: -0.5 },

  pageSub: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },

  activePlanCard: { marginHorizontal: 20, marginBottom: 24, backgroundColor: Colors.white, borderRadius: 24, padding: 20, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 3 },

  activePlanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },

  activePlanLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },

  activePlanName: { fontSize: 24, fontWeight: '900', color: Colors.black },

  activePlanIconWrap: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },

  usageContainer: { marginBottom: 16 },

  usageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },

  usageLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  usageValue: { fontSize: 13, fontWeight: '800', color: Colors.black },

  progressTrack: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },

  progressFill: { height: '100%', borderRadius: 4 },

  renewalBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12 },

  renewalText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },

  // Modal Checkout Styles

  modalRoot: { flex: 1, backgroundColor: '#F9FAFB' },

  modalHeader: { 

    flexDirection: 'row', 

    justifyContent: 'space-between', 

    alignItems: 'center', 

    paddingHorizontal: 20, 

    paddingVertical: 16,

    backgroundColor: Colors.white,

    borderBottomWidth: 1,

    borderBottomColor: '#F3F4F6'

  },

  modalTitle: { fontSize: 18, fontWeight: '900', color: Colors.black },

  modalCloseBtn: { paddingVertical: 6, paddingHorizontal: 12 },

  modalCloseText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },

  modalBody: { padding: 20, paddingBottom: 40 },

  summaryCard: {

    backgroundColor: Colors.white,

    borderRadius: 16,

    padding: 16,

    marginBottom: 20,

    borderWidth: 1,

    borderColor: '#E5E7EB',

  },

  summaryCardTitle: { fontSize: 14, fontWeight: '900', color: Colors.black, marginBottom: 8 },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },

  summaryLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  summaryVal: { fontSize: 13, color: Colors.black, fontWeight: '800' },

  modalSectionTitle: { fontSize: 15, fontWeight: '900', color: Colors.black, marginBottom: 2 },

  modalSectionSub: { fontSize: 12, color: Colors.textSecondary, marginBottom: 12, fontWeight: '500' },

  paymentMethodsList: { gap: 10, marginBottom: 20 },

  methodRow: {

    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: Colors.white,

    borderRadius: 14,

    padding: 14,

    borderWidth: 1.5,

    borderColor: '#E2E8F0',

    gap: 12,

  },

  methodRowActive: {

    borderColor: Colors.orange,

    backgroundColor: '#FFF7ED',

  },

  methodIconBadge: {

    width: 40,

    height: 40,

    borderRadius: 10,

    backgroundColor: '#F3F4F6',

    justifyContent: 'center',

    alignItems: 'center',

  },

  methodIconBadgeActive: {

    backgroundColor: '#FFEDD5',

  },

  methodName: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 2 },

  methodNameActive: { color: Colors.orange },

  methodSub: { fontSize: 11.5, color: Colors.textSecondary, fontWeight: '500' },

  radioCircle: {

    width: 20,

    height: 20,

    borderRadius: 10,

    borderWidth: 2,

    borderColor: '#D1D5DB',

    justifyContent: 'center',

    alignItems: 'center',

    backgroundColor: Colors.white,

  },

  radioCircleActive: {

    borderColor: Colors.orange,

  },

  radioInnerDot: {

    width: 10,

    height: 10,

    borderRadius: 5,

    backgroundColor: Colors.orange,

  },

  payNowBtn: {

    backgroundColor: Colors.orange,

    borderRadius: 14,

    paddingVertical: 16,

    flexDirection: 'row',

    justifyContent: 'center',

    alignItems: 'center',

    gap: 8,

    shadowColor: Colors.orange,

    shadowOffset: { width: 0, height: 4 },

    shadowOpacity: 0.2,

    shadowRadius: 8,

    elevation: 3,

    marginBottom: 12,

  },

  payNowBtnText: { color: Colors.white, fontSize: 15, fontWeight: '900' },

  secureNotice: { textAlign: 'center', fontSize: 11, color: Colors.textMuted, fontWeight: '600', lineHeight: 16 },

  plansContainer: { paddingHorizontal: 20, gap: 16 },

  planCard: { borderRadius: 24, padding: 24, borderWidth: 1.5, overflow: 'hidden' },

  planCardActive: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 5 },

  ribbon: { position: 'absolute', top: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, borderBottomLeftRadius: 16 },

  ribbonText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  planHeader: { marginBottom: 20, marginTop: 4 },

  planTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4, letterSpacing: 1 },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },

  priceLarge: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },

  priceSub: { fontSize: 15, fontWeight: '600' },

  featureList: { gap: 12, marginBottom: 24 },

  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  featureText: { fontSize: 14, fontWeight: '500', flex: 1, lineHeight: 20 },

  upgradeBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },

  upgradeBtnText: { fontWeight: '900', fontSize: 15 },

  historySection: { marginHorizontal: 20, marginTop: 24, backgroundColor: Colors.white, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },

  historyToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },

  historyToggleText: { fontSize: 15, fontWeight: '800', color: Colors.black },

  historyList: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },

  historyEmpty: { padding: 30, alignItems: 'center' },

  historyEmptyText: { color: Colors.textMuted, fontSize: 14 },

  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },

  historyPlan: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 4 },

  historyDate: { fontSize: 12, color: Colors.textMuted },

  historyAmount: { fontSize: 16, fontWeight: '900', color: Colors.black, marginBottom: 6 },

  historyStatusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },

  historyStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  secureNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 20, marginTop: 24, padding: 16, backgroundColor: '#F1F5F9', borderRadius: 16 },

  secureNoteText: { fontSize: 12, color: '#475569', lineHeight: 18, flex: 1, fontWeight: '500' },

});
