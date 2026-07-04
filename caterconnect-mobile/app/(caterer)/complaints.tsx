import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const COMPLAINT_TYPES = [
  'Fraudulent Customer',
  'False Booking / No-Show',
  'Abusive Customer Behavior',
  'Payment Dispute',
  'Unfair Review / False Rating',
  'Platform Policy Issue',
  'Technical Issue',
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

export default function CatererComplaints() {
  const { session } = useAuth();
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
      reporter_role:  'caterer',
      against_name:   against.trim() || null,
      complaint_type: complaintType,
      subject:        subject.trim() || null,
      description:    description.trim(),
      priority,
      status:         'open',
    });

    setSubmitting(false);

    if (error) { Alert.alert('Error', error.message); return; }

    Alert.alert(
      '✅ Complaint Submitted',
      'Our platform staff will review your complaint within 24–48 hours.',
      [{ text: 'OK', onPress: () => {
        setComplaintType(''); setAgainst(''); setSubject('');
        setDescription(''); setPriority('medium');
        setTab('history');
      }}]
    );
  };

  const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
    open:      { bg: '#F3F4F6', color: '#374151' },
    in_review: { bg: '#DBEAFE', color: '#1D4ED8' },
    resolved:  { bg: '#DCFCE7', color: '#15803D' },
    closed:    { bg: '#E5E7EB', color: '#6B7280' },
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}>
        <Text style={styles.pageTitle}>Complaints</Text>
        <Text style={styles.pageSub}>Report issues with customers or platform problems</Text>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'new' && styles.tabBtnActive]}
          onPress={() => setTab('new')}
        >
          <Text style={[styles.tabText, tab === 'new' && styles.tabTextActive]}>📝 New Complaint</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]}
          onPress={() => setTab('history')}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>📋 My Complaints</Text>
        </TouchableOpacity>
      </View>

      {tab === 'new' && (
        <View style={styles.formWrap}>
          <Text style={styles.fieldLabel}>Complaint Type *</Text>
          <View style={styles.typeGrid}>
            {COMPLAINT_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, complaintType === t && styles.typeChipActive]}
                onPress={() => setComplaintType(t)}
                activeOpacity={0.75}
              >
                <Text style={[styles.typeChipText, complaintType === t && styles.typeChipTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Against (Customer Name)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Juan Dela Cruz"
            placeholderTextColor={Colors.textMuted}
            value={against}
            onChangeText={setAgainst}
          />

          <Text style={styles.fieldLabel}>Subject</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief title for your complaint"
            placeholderTextColor={Colors.textMuted}
            value={subject}
            onChangeText={setSubject}
          />

          <Text style={styles.fieldLabel}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe the issue in detail. Include booking IDs, dates, amounts..."
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <Text style={styles.fieldLabel}>Priority</Text>
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
                >
                  <Text style={[styles.priorityText, active && { color: colors[p], fontWeight: '800' }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoBoxText}>
              ℹ️ Complaints are reviewed by our platform staff within 24–48 hours. Provide as much detail as possible to help us resolve the issue quickly.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.65 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="white" />
              : <Text style={styles.submitBtnText}>Submit Complaint</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {tab === 'history' && (
        <View style={{ padding: 20 }}>
          {loadingHistory ? (
            <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} />
          ) : complaints.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>No complaints submitted</Text>
              <Text style={styles.emptySub}>Your complaint history will appear here.</Text>
            </View>
          ) : (
            complaints.map((c) => {
              const ss = STATUS_COLOR[c.status] ?? STATUS_COLOR.open;
              return (
                <View key={c.id} style={styles.historyCard}>
                  <View style={styles.historyTop}>
                    <Text style={styles.historyType}>{c.complaint_type}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
                      <Text style={[styles.statusText, { color: ss.color }]}>{c.status.replace('_', ' ')}</Text>
                    </View>
                  </View>
                  {c.subject && <Text style={styles.historySubject}>{c.subject}</Text>}
                  <Text style={styles.historyDesc} numberOfLines={2}>{c.description}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(c.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
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
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  pageTitle: { fontSize: 26, fontWeight: '900', color: Colors.black, marginBottom: 4 },
  pageSub: { fontSize: 14, color: Colors.textSecondary },
  tabRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  tabBtnActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  tabText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white },
  formWrap: { paddingHorizontal: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.black, marginBottom: 8, marginTop: 16 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  typeChipActive: { backgroundColor: Colors.orangeLight, borderColor: Colors.orange },
  typeChipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  typeChipTextActive: { color: Colors.orange, fontWeight: '800' },
  input: { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.black },
  textarea: { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 },
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  priorityText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  infoBox: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, marginTop: 20, borderWidth: 1, borderColor: '#BFDBFE' },
  infoBoxText: { fontSize: 13, color: '#1D4ED8', lineHeight: 20 },
  submitBtn: { backgroundColor: Colors.orange, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20, shadowColor: Colors.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.black, marginBottom: 6 },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  historyCard: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 12 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  historyType: { fontSize: 14, fontWeight: '800', color: Colors.black, flex: 1, marginRight: 8 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  historySubject: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  historyDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 19, marginBottom: 8 },
  historyDate: { fontSize: 11, color: Colors.textMuted },
  resolutionBox: { marginTop: 10, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#86EFAC' },
  resolutionLabel: { fontSize: 11, fontWeight: '800', color: '#15803D', marginBottom: 4 },
  resolutionText: { fontSize: 13, color: '#166534', lineHeight: 19 },
});