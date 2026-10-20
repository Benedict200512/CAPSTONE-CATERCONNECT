import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronDown, ChevronUp, HelpCircle, Search } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
type FAQ = {
  id: string;
  category: string;
  question: string;
  answer: string;
};
const CUSTOMER_FAQS: FAQ[] = [
  {
    id: 'booking',
    category: 'Bookings',
    question: 'How do I book a catering service?',
    answer:
      'Browse caterers, select a package, enter your event details, customize your order, and submit your booking request. Track its status in Bookings.',
  },
  {
    id: 'availability',
    category: 'Bookings',
    question: 'How do I know if a caterer is available?',
    answer:
      'Choose your event date during booking. Availability is checked before submission, but the caterer must still review and accept your request.',
  },
  {
    id: 'downpayment',
    category: 'Payments',
    question: 'How do I pay the downpayment?',
    answer:
      'Open your booking and follow the payment instructions. Available payment methods are shown at checkout. Your payment status updates after verification.',
  },
  {
    id: 'cancel',
    category: 'Cancellations',
    question: 'Can I cancel my booking?',
    answer:
      'Cancellation depends on the booking status. Review the cancellation details in your booking before confirming. Refund eligibility depends on the cancellation policy.',
  },
{
  id: 'refund',
  category: 'Refunds',
  question: 'How much of my downpayment can be refunded?',
  answer:
    'The refund amount depends on how many days remain before your event when you cancel. ' +
    '30 days or more: 100% refund; ' +
    '15–29 days: 75% refund; ' +
    '8–14 days: 50% refund; ' +
    'exactly 7 days: 25% refund; ' +
    'fewer than 7 days: no refund. ' +
    'Refund percentages are calculated based on the downpayment you have already paid.',
},
{
  id: 'refund-grace-period',
  category: 'Refunds',
  question: 'What is the 24-hour cancellation grace period?',
  answer:
    'If you cancel within 24 hours after your downpayment was verified, you receive a 100% refund of the verified downpayment if your event is at least 7 calendar days away. ' +
    'The 24 hours begin at payment verification, not booking creation or payment submission. ' +
    'If fewer than 7 days remain before the event, no refund is due even during the grace period.',
},
{
  id: 'caterer-cancel',
  category: 'Refunds',
  question: 'What happens if the caterer cancels my booking?',
  answer:
    'If the caterer cancels your booking, you are entitled to a 100% refund of your paid downpayment, regardless of how many days remain before the event. ' +
    'The caterer is responsible for processing the refund.',
},
{
  id: 'refund-time',
  category: 'Refunds',
  question: 'How does the refund process work?',
  answer:
    'Once a booking is cancelled and a refund is required, the caterer has 3 days (72 hours) to process the refund. ' +
    'The caterer sends the refund and submits proof of the transaction. ' +
    'The customer then confirms that the refund has been received. ' +
    'If either party encounters a problem, they can flag the refund for Platform Staff to investigate. ' +
    'Platform Staff monitors refund transactions but does not directly process refunds.',
},
  {
    id: 'complaint',
    category: 'Support',
    question: 'What if I have a problem with a caterer?',
    answer:
      'Use the Complaints section to report a serious issue. Include the booking details and a clear description so Platform Staff can review it.',
  },
  {
    id: 'account',
    category: 'Account',
    question: 'How do I update my profile?',
    answer:
      'Open Profile and select Edit Profile to update the information available for your account.',
  },
];
const CATERER_FAQS: FAQ[] = [
  {
    id: 'booking-requests',
    category: 'Bookings',
    question: 'How do I manage booking requests?',
    answer: 'Open Bookings to review event details, requested packages, and customer requirements. Accept or reject requests according to your availability.',
  },
  {
    id: 'package-management',
    category: 'Packages & Menu',
    question: 'How do I create or edit a catering package?',
    answer: 'Open Packages to add or update package pricing, guest capacity, inclusions, and other package information.',
  },
  {
    id: 'menu-management',
    category: 'Packages & Menu',
    question: 'How do I update my food menu?',
    answer: 'Open Menu to add, edit, or manage food items and their prices.',
  },
  {
    id: 'payment-status',
    category: 'Payments',
    question: 'How can I check whether a customer paid the downpayment?',
    answer: 'Open the booking details and check its payment status. A successful payment is reflected after verification through the payment system.',
  },
  {
    id: 'customer-cancellation',
    category: 'Cancellations',
    question: 'What happens if the customer cancels a booking?',
    answer: 'The customer can cancel according to the booking rules. If a verified downpayment was paid, the refund percentage is based on the days remaining before the event.',
  },
  {
    id: 'customer-refund',
    category: 'Refunds',
    question: 'How much must I refund when a customer cancels?',
    answer: 'For customer-initiated cancellations, refund the verified downpayment as follows: 30 days or more before the event: 100%; 15–29 days: 75%; 8–14 days: 50%; exactly 7 days: 25%; fewer than 7 days: 0%. A 24-hour grace period after payment verification gives a 100% refund if at least 7 calendar days remain before the event.',
  },
  {
    id: 'customer-grace-period',
    category: 'Refunds',
    question: 'How does the 24-hour grace period affect a customer cancellation?',
    answer: 'A customer cancelling within 24 hours after downpayment verification receives a 100% refund of the verified downpayment if at least 7 calendar days remain before the event. The 24 hours start at payment verification. Fewer than 7 days before the event means no refund, even during the grace period.',
  },
  {
    id: 'caterer-cancellation',
    category: 'Refunds',
    question: 'What if I cancel a customer booking?',
    answer: 'If you cancel a booking after the customer paid a verified downpayment, you must refund 100% of that downpayment, regardless of the number of days before the event.',
  },
  {
    id: 'refund-process',
    category: 'Refunds',
    question: 'How do I process a refund?',
    answer: 'Process an eligible refund within 3 days (72 hours) of cancellation. Send the money to the customer and submit the transfer reference and proof. The customer confirms receipt. Either party can flag a problem for Platform Staff to investigate; staff do not send the refund.',
  },
  {
    id: 'subscription',
    category: 'Subscriptions',
    question: 'How do I manage my subscription?',
    answer: 'Open your Business Profile and Subscription section to review available plans and package or booking limits.',
  },
  {
    id: 'verification',
    category: 'Verification',
    question: 'How do I get my catering business verified?',
    answer: 'Complete your business profile and submit the required verification documents for Platform Staff review.',
  },
  {
    id: 'complaints',
    category: 'Support',
    question: 'How can I report a problem with a customer?',
    answer: 'Use Complaints to submit details of the issue so Platform Staff can review it.',
  },
  {
    id: 'account',
    category: 'Account',
    question: 'How do I update my business information?',
    answer: 'Open Business Profile and choose Edit Profile to update your available business and contact information.',
  },
];
export default function FAQScreen() {
  // Shared screen; show FAQs for the signed-in user's role.
  const { profile } = useAuth();
  const isCaterer = profile?.role === 'caterer';
  const faqs = isCaterer ? CATERER_FAQS : CUSTOMER_FAQS;
  const categories = useMemo(
    () => ['All', ...new Set(faqs.map((faq) => faq.category))],
    [faqs]
  );
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useEffect(() => {
    setCategory('All');
    setExpandedId(null);
    setSearch('');
  }, [isCaterer]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return faqs.filter((faq) => {
      const matchesCategory = category === 'All' || faq.category === category;
      const matchesSearch =
        !query ||
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [search, category, faqs]);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Help Center</Text>
        <Text style={styles.subtitle}>Frequently Asked Questions</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <HelpCircle size={26} color={Colors.orange} />
          <View style={styles.introText}>
            <Text style={styles.introTitle}>How can we help?</Text>
            <Text style={styles.introSubtitle}>Find answers to common CaterConnect questions.</Text>
          </View>
        </View>
        <View style={styles.searchBox}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search FAQs..."
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            accessibilityLabel="Search frequently asked questions"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          {categories.map((item) => {
            const active = category === item;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.chip, active && styles.activeChip]}
                onPress={() => setCategory(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.activeChipText]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={styles.sectionTitle}>Common questions</Text>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No matching questions</Text>
            <Text style={styles.emptyText}>Try a different search or category.</Text>
          </View>
        ) : (
          filtered.map((faq) => {
            const expanded = expandedId === faq.id;
            return (
              <View key={faq.id} style={styles.faqCard}>
                <TouchableOpacity
                  style={styles.questionRow}
                  onPress={() => setExpandedId(expanded ? null : faq.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                >
                  <View style={styles.questionText}>
                    <Text style={styles.categoryLabel}>{faq.category}</Text>
                    <Text style={styles.question}>{faq.question}</Text>
                  </View>
                  {expanded ? (
                    <ChevronUp size={20} color={Colors.orange} />
                  ) : (
                    <ChevronDown size={20} color={Colors.textMuted} />
                  )}
                </TouchableOpacity>
                {expanded && (
                  <View style={styles.answerWrap}>
                    <Text style={styles.answer}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: { fontSize: 24, fontWeight: '900', color: Colors.black },
  subtitle: { marginTop: 4, fontSize: 13, color: Colors.textSecondary },
  content: { padding: 20, paddingBottom: 48 },
  intro: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 18, borderRadius: 18, backgroundColor: '#FFF7ED', marginBottom: 18,
  },
  introText: { flex: 1 },
  introTitle: { fontSize: 17, fontWeight: '800', color: Colors.black },
  introSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 14, paddingHorizontal: 14, marginBottom: 16,
  },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 14, color: Colors.black },
  categories: { gap: 8, paddingBottom: 18 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: '#E5E7EB',
  },
  activeChip: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  chipText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  activeChipText: { color: Colors.white },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: Colors.black, marginBottom: 12 },
  faqCard: {
    backgroundColor: Colors.white, borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 16, marginBottom: 12, overflow: 'hidden',
  },
  questionRow: {
    padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  questionText: { flex: 1 },
  categoryLabel: {
    color: Colors.orange, fontWeight: '800', fontSize: 10,
    textTransform: 'uppercase', marginBottom: 5,
  },
  question: { color: Colors.black, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  answerWrap: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  answer: { color: Colors.textSecondary, fontSize: 13, lineHeight: 21 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { color: Colors.black, fontSize: 16, fontWeight: '800' },
  emptyText: { color: Colors.textSecondary, fontSize: 13, marginTop: 6 },
});
