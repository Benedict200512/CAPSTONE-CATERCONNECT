import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  ShieldAlert, FileText, History, Send,
  Building2, AlignLeft, AlertCircle, Info, Inbox,
  Clock, Sparkles, CheckCircle2, XCircle
} from 'lucide-react-native';

const COMPLAINT_TYPES = [
  'Caterer No-Show',
  'Food Quality Issue',
  'Overcharging / Wrong Amount',
  'Unprofessional Behavior',
  'Booking Cancellation Issue',
  'Payment Problem',
  'Other',
];

type Complaint = {
  id: string;
  complaint_type: string;
  subject: string | null;
  description: string;
  priority: string;
  status: string;
  resolution_notes: string | null;
  created_at: string;
};

export default function CustomerComplaints() {
  const { session, profile } = useAuth();
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form state
  const [complaintType, setComplaintType] = useState('');
  const [against, setAgainst] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [submitting, setSubmitting] = useState(false);

  const loadHistory = async () => {
    if (!session?.user?.id) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from('complaints')
      .select('id, complaint_type, subject, description, priority, status, resolution_notes, created_at')
      .eq('reporter_id', session.user.id)
      .order('created_at', { ascending: false });
    setComplaints(data ?? []);
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab]);

  const handleSubmit = async () => {
    if (!complaintType) { Alert.alert('Required', 'Please select a complaint type.'); return; }
    if (!description.trim()) { Alert.alert('Required', 'Please describe the issue.'); return; }
    if (!session?.user?.id) return;

    setSubmitting(true);
    const { error } = await supabase.from('complaints').insert({
      reporter_id:    session.user.id,
      reporter_role:  'customer',
      against_name:   against.trim() || null,
      complaint_type: complaintType,
      subject:        subject.trim() || null,
      description:    description.trim(),
      priority,
      status:         'open',
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert(
      'Complaint Submitted',
      'Our platform staff will review your complaint and get back to you promptly.',
      [{ text: 'OK', onPress: () => {
        setComplaintType(''); setAgainst(''); setSubject('');
        setDescription(''); setPriority('medium');
        setTab('history');
      }}]
    );
  };

  const statusConfig: Record<string, { bg: string; color: string; label: string; icon: any }> = {
    open:      { bg: '#F3F4F6', color: '#374151', label: 'Open', icon: Clock },
    in_review: { bg: '#EFF6FF', color: '#2563EB', label: 'In Review', icon: Sparkles },
    resolved:  { bg: '#DCFCE7', color: '#166534', label: 'Resolved', icon: CheckCircle2 },
    closed:    { bg: '#E5E7EB', color: '#4B5563', label: 'Closed', icon: XCircle },
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 44 }]}>
        <View style={styles.headerIconWrap}>
          <ShieldAlert size={22} color={Colors.orange} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Complaints & Issues</Text>
          <Text style={styles.pageSub}>Report issues securely to platform moderation</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'new' && styles.tabBtnActive]}
          onPress={() => setTab('new')}
          activeOpacity={0.8}
        >
          <FileText size={16} color={tab === 'new' ? Colors.white : Colors.textSecondary} />
          <Text style={[styles.tabText, tab === 'new' && styles.tabTextActive]}>New Complaint</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]}
          onPress={() => setTab('history')}
          activeOpacity={0.8}
        >
          <History size={16} color={tab === 'history' ? Colors.white : Colors.textSecondary} />
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>My Reports</Text>
        </TouchableOpacity>
      </View>

      {/* ── NEW COMPLAINT FORM ── */}
      {tab === 'new' && (
        <View style={styles.formWrap}>
          <View style={styles.formCard}>
            {/* Complaint type */}
            <Text style={styles.fieldLabel}>COMPLAINT TYPE *</Text>
            <View style={styles.typeGrid}>
              {COMPLAINT_TYPES.map((t) => {
                const isSelected = complaintType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, isSelected && styles.typeChipActive]}
                    onPress={() => setComplaintType(t)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.typeChipText, isSelected && styles.typeChipTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Against */}
            <Text style={styles.fieldLabel}>AGAINST (CATERER / BUSINESS NAME)</Text>
            <View style={styles.inputWrap}>
              <Building2 size={18} color={Colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Maria's Catering Services"
                placeholderTextColor={Colors.textMuted}
                value={against}
                onChangeText={setAgainst}
              />
            </View>

            {/* Subject */}
            <Text style={styles.fieldLabel}>SUBJECT</Text>
            <View style={styles.inputWrap}>
              <FileText size={18} color={Colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Brief title summarizing the issue"
                placeholderTextColor={Colors.textMuted}
                value={subject}
                onChangeText={setSubject}
              />
            </View>

            {/* Description */}
            <Text style={styles.fieldLabel}>DESCRIPTION *</Text>
            <View style={[styles.inputWrap, { alignItems: 'flex-start', paddingVertical: 12 }]}>
              <AlignLeft size={18} color={Colors.textSecondary} style={{ marginTop: 2 }} />
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Describe the issue in comprehensive detail. Include dates, specific amounts, or transaction numbers..."
                placeholderTextColor={Colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            {/* Priority */}
            <Text style={styles.fieldLabel}>PRIORITY LEVEL</Text>
            <View style={styles.priorityRow}>
              {(['low', 'medium', 'high'] as const).map((p) => {
                const colors = { low: '#16A34A', medium: '#D97706', high: '#DC2626' };
                const bgs    = { low: '#DCFCE7', medium: '#FEF3C7', high: '#FEE2E2' };
                const active = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priorityBtn, active && { backgroundColor: bgs[p], borderColor: colors[p] }]}
                    onPress={() => setPriority(p)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.priorityText, active && { color: colors[p], fontWeight: '900' }]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Info box */}
            <View style={styles.infoBox}>
              <Info size={16} color="#2563EB" style={{ marginTop: 2 }} />
              <Text style={styles.infoBoxText}>
                Your report will be reviewed by our platform staff within 24–48 hours. Providing accurate details ensures a faster investigation.
              </Text>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Send size={16} color={Colors.white} />
                  <Text style={styles.submitBtnText}>Submit Complaint</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── HISTORY ── */}
      {tab === 'history' && (
        <View style={{ paddingHorizontal: 20 }}>
          {loadingHistory ? (
            <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} />
          ) : complaints.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Inbox size={36} color={Colors.orange} />
              </View>
              <Text style={styles.emptyTitle}>No complaints filed</Text>
              <Text style={styles.emptySub}>Your submitted moderation reports and their resolutions will appear here.</Text>
            </View>
          ) : (
            complaints.map((c) => {
              const sc = statusConfig[c.status] ?? statusConfig.open;
              const StatusIcon = sc.icon;
              return (
                <View key={c.id} style={styles.historyCard}>
                  <View style={styles.historyTop}>
                    <Text style={styles.historyType} numberOfLines={1}>{c.complaint_type}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <StatusIcon size={12} color={sc.color} />
                      <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                    </View>
                  </View>
                  {c.subject && <Text style={styles.historySubject}>{c.subject}</Text>}
                  <Text style={styles.historyDesc} numberOfLines={2}>{c.description}</Text>
                  <Text style={styles.historyDate}>
                    Filed on {new Date(c.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </Text>
                  {c.resolution_notes && (
                    <View style={styles.resolutionBox}>
                      <Text style={styles.resolutionLabel}>Staff Resolution:</Text>
                      <Text style={styles.resolutionText}>{c.resolution_notes}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { 
    paddingHorizontal: 20, 
    paddingBottom: 16, 
    backgroundColor: Colors.white, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  pageTitle: { fontSize: 22, fontWeight: '900', color: Colors.black, letterSpacing: -0.5 },
  pageSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },

  tabRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginVertical: 16 },
  tabBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02, shadowRadius: 6, elevation: 1,
  },
  tabBtnActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  tabText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white, fontWeight: '800' },

  formWrap: { paddingHorizontal: 20 },
  formCard: {
    backgroundColor: Colors.white, borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
  },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8, marginTop: 16 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
  },
  typeChipActive: { backgroundColor: '#FFF7ED', borderColor: Colors.orange },
  typeChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  typeChipTextActive: { color: Colors.orange, fontWeight: '900' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingHorizontal: 12, gap: 10,
  },
  input: { flex: 1, fontSize: 14, color: Colors.black, paddingVertical: 12, fontWeight: '600' },
  textarea: { minHeight: 110, textAlignVertical: 'top', paddingTop: 2 },

  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    alignItems: 'center', backgroundColor: '#F9FAFB',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  priorityText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },

  infoBox: {
    flexDirection: 'row', gap: 10,
    backgroundColor: '#EFF6FF', borderRadius: 12,
    padding: 12, marginTop: 20,
    borderWidth: 1, borderColor: '#BFDBFE',
    alignItems: 'flex-start',
  },
  infoBoxText: { fontSize: 12, color: '#1E40AF', lineHeight: 18, flex: 1, fontWeight: '600' },

  submitBtn: {
    backgroundColor: Colors.orange, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 20,
    shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  submitBtnText: { color: Colors.white, fontWeight: '900', fontSize: 15 },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: '#FED7AA',
  },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: Colors.black, marginBottom: 6 },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', fontWeight: '500' },

  historyCard: {
    backgroundColor: Colors.white, borderRadius: 18,
    borderWidth: 1, borderColor: '#E5E7EB',
    padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
  },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  historyType: { fontSize: 14, fontWeight: '800', color: Colors.black, flex: 1, marginRight: 8 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusText: { fontSize: 11, fontWeight: '800' },
  historySubject: { fontSize: 13, fontWeight: '700', color: Colors.black, marginBottom: 4 },
  historyDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 8, fontWeight: '500' },
  historyDate: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  resolutionBox: {
    marginTop: 12, backgroundColor: '#F0FDF4',
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#86EFAC',
  },
  resolutionLabel: { fontSize: 11, fontWeight: '900', color: '#15803D', marginBottom: 4 },
  resolutionText: { fontSize: 13, color: '#166534', lineHeight: 19, fontWeight: '500' },
});