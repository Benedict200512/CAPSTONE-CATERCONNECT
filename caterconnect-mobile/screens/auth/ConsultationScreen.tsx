import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, KeyboardAvoidingView,
    Platform, ScrollView, StyleSheet, Text,
    TextInput, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '@/lib/supabase';

type Consultation = {
  id: string;
  subject: string;
  message: string;
  status: string;
  staff_reply: string | null;
  replied_at: string | null;
  created_at: string;
};

const CONSULTATION_TOPICS = [
  'Help choosing a caterer',
  'Booking issue or concern',
  'Payment or downpayment problem',
  'Account or profile issue',
  'Dispute with caterer',
  'Subscription inquiry',
  'Document verification issue',
  'Other',
];

const CATERER_TOPICS = [
  'Help with my application',
  'Document verification issue',
  'Booking management concern',
  'Subscription plan inquiry',
  'Payment method setup',
  'Account or profile issue',
  'Dispute with customer',
  'Other',
];

export default function ConsultationScreen() {
  const { profile, session } = useAuth();
  const [view, setView] = useState<'list' | 'new'>('list');
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Consultation | null>(null);

  // Form state
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');

  const topics = profile?.role === 'caterer' ? CATERER_TOPICS : CONSULTATION_TOPICS;

  const loadConsultations = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('consultations')
      .select('*')
      .eq('from_user_id', session.user.id)
      .order('created_at', { ascending: false });
    setConsultations(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadConsultations(); }, []);

  const handleSubmit = async () => {
    const finalSubject = selectedTopic === 'Other' ? customSubject.trim() : selectedTopic;
    if (!finalSubject) {
      Alert.alert('Missing info', 'Please select or enter a subject.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Missing info', 'Please describe your concern.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('consultations').insert({
      from_user_id: session?.user?.id,
      from_name: profile?.full_name,
      from_role: profile?.role,
      subject: finalSubject,
      message: message.trim(),
      status: 'open',
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setSelectedTopic('');
    setCustomSubject('');
    setMessage('');
    setView('list');
    Alert.alert(
      'Consultation Submitted ✅',
      'Our platform staff will review your inquiry and reply within 1–2 business days.',
    );
    loadConsultations();
  };

  const statusStyle: Record<string, { bg: string; text: string }> = {
    open:      { bg: '#DBEAFE', text: '#1E40AF' },
    in_review: { bg: '#FEF3C7', text: '#92400E' },
    resolved:  { bg: '#DCFCE7', text: '#166534' },
    closed:    { bg: '#F3F4F6', text: '#6B7280' },
  };

  // ── DETAIL VIEW ──
  if (selected) {
    const ss = statusStyle[selected.status] ?? statusStyle.open;
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Consultation</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
            <Text style={[styles.statusBadgeText, { color: ss.text }]}>
              {selected.status === 'in_review' ? 'In Review' : selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
            </Text>
          </View>

          {/* Subject */}
          <Text style={styles.detailSubject}>{selected.subject}</Text>
          <Text style={styles.detailDate}>
            Submitted {new Date(selected.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>

          {/* Message */}
          <View style={styles.messageBox}>
            <Text style={styles.messageBoxLabel}>YOUR MESSAGE</Text>
            <Text style={styles.messageBoxText}>{selected.message}</Text>
          </View>

          {/* Staff reply */}
          {selected.staff_reply ? (
            <View style={styles.replyBox}>
              <View style={styles.replyBoxHeader}>
                <Text style={styles.replyBoxLabel}>👷 STAFF REPLY</Text>
                {selected.replied_at && (
                  <Text style={styles.replyBoxDate}>
                    {new Date(selected.replied_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </Text>
                )}
              </View>
              <Text style={styles.replyBoxText}>{selected.staff_reply}</Text>
            </View>
          ) : (
            <View style={styles.pendingReplyBox}>
              <Text style={styles.pendingIcon}>⏳</Text>
              <Text style={styles.pendingTitle}>Awaiting Staff Reply</Text>
              <Text style={styles.pendingText}>
                Our platform staff will review your inquiry and respond within 1–2 business days.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── NEW CONSULTATION FORM ──
  if (view === 'new') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('list')} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Consultation</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <Text style={styles.formCardTitle}>What do you need help with?</Text>
            <Text style={styles.formCardSub}>
              Select a topic and describe your concern. Our staff will reply within 1–2 business days.
            </Text>

            {/* Topic selector */}
            <Text style={styles.fieldLabel}>SELECT TOPIC</Text>
            <View style={styles.topicsGrid}>
              {topics.map((topic) => (
                <TouchableOpacity
                  key={topic}
                  style={[styles.topicChip, selectedTopic === topic && styles.topicChipActive]}
                  onPress={() => { setSelectedTopic(topic); setCustomSubject(''); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.topicChipText, selectedTopic === topic && styles.topicChipTextActive]}>
                    {topic}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom subject if "Other" selected */}
            {selectedTopic === 'Other' && (
              <>
                <Text style={styles.fieldLabel}>SPECIFY YOUR SUBJECT</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="Briefly describe the topic..."
                    placeholderTextColor={Colors.textMuted}
                    value={customSubject}
                    onChangeText={setCustomSubject}
                  />
                </View>
              </>
            )}

            {/* Message */}
            <Text style={styles.fieldLabel}>DESCRIBE YOUR CONCERN</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Provide as much detail as possible so our staff can assist you effectively..."
              placeholderTextColor={Colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            {/* Info note */}
            <View style={styles.infoNote}>
              <Text style={styles.infoNoteText}>
                ℹ️ Your name ({profile?.full_name}) and role ({profile?.role}) will be shared with platform staff to help resolve your concern.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.submitBtnText}>SUBMIT CONSULTATION</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── LIST VIEW ──
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Consultations</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => setView('new')}>
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : consultations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No consultations yet</Text>
          <Text style={styles.emptySub}>
            Have a question or concern? Submit a consultation and our platform staff will assist you.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setView('new')}>
            <Text style={styles.emptyBtnText}>Submit a Consultation</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats row */}
          <View style={styles.statsRow}>
            {[
              { label: 'Total', value: consultations.length, color: Colors.black },
              { label: 'Open', value: consultations.filter((c) => c.status === 'open').length, color: '#2563EB' },
              { label: 'Resolved', value: consultations.filter((c) => c.status === 'resolved').length, color: Colors.success },
            ].map((s) => (
              <View key={s.label} style={styles.statCard}>
                <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Consultation cards */}
          {consultations.map((c) => {
            const ss = statusStyle[c.status] ?? statusStyle.open;
            const hasReply = !!c.staff_reply;
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.consultCard}
                onPress={() => setSelected(c)}
                activeOpacity={0.88}
              >
                <View style={styles.consultCardTop}>
                  <View style={styles.consultCardLeft}>
                    <View style={[styles.consultStatusDot, { backgroundColor: ss.text }]} />
                    <Text style={styles.consultSubject} numberOfLines={1}>{c.subject}</Text>
                  </View>
                  <View style={[styles.consultStatusBadge, { backgroundColor: ss.bg }]}>
                    <Text style={[styles.consultStatusText, { color: ss.text }]}>
                      {c.status === 'in_review' ? 'In Review' : c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.consultMessage} numberOfLines={2}>{c.message}</Text>

                <View style={styles.consultCardBottom}>
                  <Text style={styles.consultDate}>
                    {new Date(c.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  {hasReply ? (
                    <View style={styles.replyIndicator}>
                      <Text style={styles.replyIndicatorText}>✅ Staff replied</Text>
                    </View>
                  ) : (
                    <View style={styles.noReplyIndicator}>
                      <Text style={styles.noReplyIndicatorText}>⏳ Awaiting reply</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 16, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: Colors.black },
  backBtn: { width: 60 },
  backText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  newBtn: {
    backgroundColor: Colors.orange, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  newBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13 },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.black, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  emptyBtn: {
    backgroundColor: Colors.orange, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  emptyBtnText: { color: Colors.white, fontWeight: '900', fontSize: 14 },

  // Stats
  statsRow: {
    flexDirection: 'row', gap: 12, marginBottom: 20,
  },
  statCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  statNum: { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  statLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },

  // Consultation cards
  consultCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  consultCardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  consultCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  consultStatusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  consultSubject: { fontSize: 15, fontWeight: '800', color: Colors.black, flex: 1 },
  consultStatusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  consultStatusText: { fontSize: 11, fontWeight: '800' },
  consultMessage: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 12 },
  consultCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  consultDate: { fontSize: 11, color: Colors.textMuted },
  replyIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyIndicatorText: { fontSize: 11, color: Colors.success, fontWeight: '700' },
  noReplyIndicator: {},
  noReplyIndicatorText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  // Detail view
  statusBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 12 },
  statusBadgeText: { fontSize: 12, fontWeight: '800' },
  detailSubject: { fontSize: 22, fontWeight: '900', color: Colors.black, marginBottom: 6, lineHeight: 30 },
  detailDate: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20 },
  messageBox: {
    backgroundColor: Colors.bgInput, borderRadius: 14,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  messageBoxLabel: { fontSize: 10, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  messageBoxText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 22 },
  replyBox: {
    backgroundColor: '#EFF6FF', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#BFDBFE',
  },
  replyBoxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  replyBoxLabel: { fontSize: 10, fontWeight: '800', color: '#1E40AF', letterSpacing: 1.5 },
  replyBoxDate: { fontSize: 11, color: '#3B82F6' },
  replyBoxText: { fontSize: 14, color: '#1E3A8A', lineHeight: 22 },
  pendingReplyBox: {
    alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: 14, padding: 28,
    borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  pendingIcon: { fontSize: 36, marginBottom: 10 },
  pendingTitle: { fontSize: 16, fontWeight: '800', color: Colors.black, marginBottom: 6 },
  pendingText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Form
  formCard: {
    backgroundColor: Colors.white, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  formCardTitle: { fontSize: 20, fontWeight: '900', color: Colors.black, marginBottom: 6 },
  formCardSub: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 20 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 1.5, marginBottom: 10 },
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  topicChip: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.bgInput,
  },
  topicChipActive: { borderColor: Colors.orange, backgroundColor: Colors.orangeLight },
  topicChipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  topicChipTextActive: { color: Colors.orange, fontWeight: '800' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgInput, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, marginBottom: 16,
  },
  input: { flex: 1, fontSize: 15, color: Colors.textPrimary, paddingVertical: 14 },
  textArea: {
    backgroundColor: Colors.bgInput, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, fontSize: 14, color: Colors.textPrimary,
    minHeight: 130, marginBottom: 16,
  },
  infoNote: {
    backgroundColor: '#EFF6FF', borderRadius: 10,
    padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  infoNoteText: { fontSize: 12, color: '#1E40AF', lineHeight: 18 },
  submitBtn: {
    backgroundColor: Colors.orange, borderRadius: 50,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  submitBtnDisabled: { backgroundColor: Colors.textMuted },
  submitBtnText: { color: Colors.white, fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
});