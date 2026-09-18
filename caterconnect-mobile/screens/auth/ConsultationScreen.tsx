import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Plus, MessageSquare, Clock, CheckCircle2,
  AlertCircle, ChevronRight, HelpCircle, Send, Sparkles, User, ShieldCheck
} from 'lucide-react-native';

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

  const statusConfig: Record<string, { bg: string; text: string; label: string; icon: any }> = {
    open:      { bg: '#EFF6FF', text: '#2563EB', label: 'Open', icon: Clock },
    in_review: { bg: '#FEF3C7', text: '#D97706', label: 'In Review', icon: Sparkles },
    resolved:  { bg: '#DCFCE7', text: '#166534', label: 'Resolved', icon: CheckCircle2 },
    closed:    { bg: '#F3F4F6', text: '#4B5563', label: 'Closed', icon: AlertCircle },
  };

  // ── DETAIL VIEW ──
  if (selected) {
    const sc = statusConfig[selected.status] ?? statusConfig.open;
    const StatusIcon = sc.icon;
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={Colors.black} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Consultation Details</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <StatusIcon size={14} color={sc.text} />
            <Text style={[styles.statusBadgeText, { color: sc.text }]}>
              {sc.label}
            </Text>
          </View>

          {/* Subject */}
          <Text style={styles.detailSubject}>{selected.subject}</Text>
          <Text style={styles.detailDate}>
            Submitted on {new Date(selected.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>

          {/* Message */}
          <View style={styles.messageBox}>
            <View style={styles.messageBoxHeaderRow}>
              <User size={14} color={Colors.textMuted} />
              <Text style={styles.messageBoxLabel}>YOUR MESSAGE</Text>
            </View>
            <Text style={styles.messageBoxText}>{selected.message}</Text>
          </View>

          {/* Staff reply */}
          {selected.staff_reply ? (
            <View style={styles.replyBox}>
              <View style={styles.replyBoxHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} color="#1E40AF" />
                  <Text style={styles.replyBoxLabel}>STAFF REPLY</Text>
                </View>
                {selected.replied_at && (
                  <Text style={styles.replyBoxDate}>
                    {new Date(selected.replied_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                )}
              </View>
              <Text style={styles.replyBoxText}>{selected.staff_reply}</Text>
            </View>
          ) : (
            <View style={styles.pendingReplyBox}>
              <View style={styles.pendingIconWrap}>
                <Clock size={24} color="#D97706" />
              </View>
              <Text style={styles.pendingTitle}>Awaiting Staff Reply</Text>
              <Text style={styles.pendingText}>
                Our platform team is reviewing your concern and will respond within 1–2 business days.
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
        style={{ flex: 1, backgroundColor: '#F9FAFB' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('list')} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={Colors.black} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Consultation</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <Text style={styles.formCardTitle}>How can we assist you?</Text>
            <Text style={styles.formCardSub}>
              Select a category and provide details below. Our support team will get back to you promptly.
            </Text>

            {/* Topic selector */}
            <Text style={styles.fieldLabel}>SELECT TOPIC</Text>
            <View style={styles.topicsGrid}>
              {topics.map((topic) => {
                const isSelected = selectedTopic === topic;
                return (
                  <TouchableOpacity
                    key={topic}
                    style={[styles.topicChip, isSelected && styles.topicChipActive]}
                    onPress={() => { setSelectedTopic(topic); setCustomSubject(''); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.topicChipText, isSelected && styles.topicChipTextActive]}>
                      {topic}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom subject if "Other" selected */}
            {selectedTopic === 'Other' && (
              <>
                <Text style={styles.fieldLabel}>SPECIFY SUBJECT</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="Briefly state your concern..."
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
              placeholder="Provide as much context, order ID, or relevant information as possible..."
              placeholderTextColor={Colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            {/* Info note */}
            <View style={styles.infoNote}>
              <HelpCircle size={16} color="#2563EB" style={{ marginTop: 2 }} />
              <Text style={styles.infoNoteText}>
                Your profile name ({profile?.full_name}) and role ({profile?.role}) will be attached to securely route your ticket.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Send size={16} color={Colors.white} />
                  <Text style={styles.submitBtnText}>Submit Consultation</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── LIST VIEW ──
  const openCount = consultations.filter((c) => c.status === 'open' || c.status === 'in_review').length;
  const resolvedCount = consultations.filter((c) => c.status === 'resolved').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Consultations</Text>
          <Text style={styles.pageSub}>Support tickets & platform inquiries</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => setView('new')} activeOpacity={0.85}>
          <Plus size={16} color={Colors.white} />
          <Text style={styles.newBtnText}>New Ticket</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : consultations.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <MessageSquare size={36} color={Colors.orange} />
          </View>
          <Text style={styles.emptyTitle}>No consultations yet</Text>
          <Text style={styles.emptySub}>
            Have questions regarding bookings, payments, or your account? Our team is ready to assist you.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setView('new')} activeOpacity={0.85}>
            <Text style={styles.emptyBtnText}>Submit First Ticket</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: Colors.black }]}>{consultations.length}</Text>
              <Text style={styles.statLabel}>Total Tickets</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: '#2563EB' }]}>{openCount}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: Colors.success }]}>{resolvedCount}</Text>
              <Text style={styles.statLabel}>Resolved</Text>
            </View>
          </View>

          {/* Consultation cards */}
          {consultations.map((c) => {
            const sc = statusConfig[c.status] ?? statusConfig.open;
            const StatusIcon = sc.icon;
            const hasReply = !!c.staff_reply;
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.consultCard}
                onPress={() => setSelected(c)}
                activeOpacity={0.85}
              >
                <View style={styles.consultCardTop}>
                  <View style={styles.consultCardLeft}>
                    <Text style={styles.consultSubject} numberOfLines={1}>{c.subject}</Text>
                  </View>
                  <View style={[styles.consultStatusBadge, { backgroundColor: sc.bg }]}>
                    <StatusIcon size={12} color={sc.text} />
                    <Text style={[styles.consultStatusText, { color: sc.text }]}>
                      {sc.label}
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
                      <CheckCircle2 size={13} color={Colors.success} />
                      <Text style={styles.replyIndicatorText}>Staff replied</Text>
                    </View>
                  ) : (
                    <View style={styles.noReplyIndicator}>
                      <Clock size={13} color={Colors.textMuted} />
                      <Text style={styles.noReplyIndicatorText}>Awaiting reply</Text>
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 16, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: Colors.black },
  pageTitle: { fontSize: 24, fontWeight: '900', color: Colors.black, letterSpacing: -0.5 },
  pageSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 80 },
  backText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '700' },
  newBtn: {
    backgroundColor: Colors.orange, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
  },
  newBtnText: { color: Colors.white, fontWeight: '800', fontSize: 13 },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: '#FED7AA',
  },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: {
    backgroundColor: Colors.orange, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
  },
  emptyBtnText: { color: Colors.white, fontWeight: '900', fontSize: 14 },

  // Stats
  statsRow: {
    flexDirection: 'row', gap: 12, marginBottom: 20,
  },
  statCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 16,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02, shadowRadius: 6, elevation: 1,
  },
  statNum: { fontSize: 20, fontWeight: '900', marginBottom: 2 },
  statLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '700' },

  // Consultation cards
  consultCard: {
    backgroundColor: Colors.white, borderRadius: 18,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
  },
  consultCardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  consultCardLeft: { flex: 1, marginRight: 8 },
  consultSubject: { fontSize: 15, fontWeight: '800', color: Colors.black },
  consultStatusBadge: { 
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, 
    flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 
  },
  consultStatusText: { fontSize: 11, fontWeight: '800' },
  consultMessage: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  consultCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  consultDate: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  replyIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  replyIndicatorText: { fontSize: 11, color: Colors.success, fontWeight: '800' },
  noReplyIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  noReplyIndicatorText: { fontSize: 11, color: Colors.textMuted, fontWeight: '700' },

  // Detail view
  statusBadge: { 
    alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, 
    marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 6 
  },
  statusBadgeText: { fontSize: 12, fontWeight: '800' },
  detailSubject: { fontSize: 22, fontWeight: '900', color: Colors.black, marginBottom: 6, lineHeight: 28 },
  detailDate: { fontSize: 12, color: Colors.textSecondary, marginBottom: 20, fontWeight: '500' },
  messageBox: {
    backgroundColor: Colors.white, borderRadius: 16,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02, shadowRadius: 6, elevation: 1,
  },
  messageBoxHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  messageBoxLabel: { fontSize: 10, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1 },
  messageBoxText: { fontSize: 14, color: Colors.black, lineHeight: 22, fontWeight: '500' },
  replyBox: {
    backgroundColor: '#EFF6FF', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#BFDBFE',
  },
  replyBoxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  replyBoxLabel: { fontSize: 11, fontWeight: '900', color: '#1E40AF', letterSpacing: 1 },
  replyBoxDate: { fontSize: 11, color: '#3B82F6', fontWeight: '700' },
  replyBoxText: { fontSize: 14, color: '#1E3A8A', lineHeight: 22, fontWeight: '500' },
  pendingReplyBox: {
    alignItems: 'center', backgroundColor: Colors.white,
    borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  pendingIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  pendingTitle: { fontSize: 15, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  pendingText: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18, fontWeight: '500' },

  // Form
  formCard: {
    backgroundColor: Colors.white, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
  },
  formCardTitle: { fontSize: 20, fontWeight: '900', color: Colors.black, marginBottom: 6, letterSpacing: -0.5 },
  formCardSub: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 20, fontWeight: '500' },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  topicChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  topicChipActive: { borderColor: Colors.orange, backgroundColor: '#FFF7ED' },
  topicChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  topicChipTextActive: { color: Colors.orange, fontWeight: '900' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, marginBottom: 16,
  },
  input: { flex: 1, fontSize: 14, color: Colors.black, paddingVertical: 12, fontWeight: '600' },
  textArea: {
    backgroundColor: '#F9FAFB', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    padding: 14, fontSize: 14, color: Colors.black,
    minHeight: 120, marginBottom: 16, fontWeight: '600',
  },
  infoNote: {
    flexDirection: 'row', gap: 10,
    backgroundColor: '#EFF6FF', borderRadius: 12,
    padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: '#BFDBFE',
    alignItems: 'flex-start',
  },
  infoNoteText: { fontSize: 12, color: '#1E40AF', lineHeight: 18, flex: 1, fontWeight: '600' },
  submitBtn: {
    backgroundColor: Colors.orange, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: Colors.textMuted },
  submitBtnText: { color: Colors.white, fontWeight: '900', fontSize: 15 },
});