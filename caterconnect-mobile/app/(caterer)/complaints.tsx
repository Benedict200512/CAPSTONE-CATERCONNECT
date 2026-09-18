import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  FileText, ClipboardList, Inbox, AlertTriangle, 
  CheckCircle2, Clock, ShieldAlert, ChevronRight 
} from 'lucide-react-native';

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
      'Complaint Submitted',
      'Our platform staff will review your complaint within 24–48 hours.',
      [{ text: 'OK', onPress: () => {
        setComplaintType(''); setAgainst(''); setSubject('');
        setDescription(''); setPriority('medium');
        setTab('history');
      }}]
    );
  };

  const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
    open:      { bg: '#F3F4F6', color: '#374151', label: 'Open' },
    in_review: { bg: '#DBEAFE', color: '#1D4ED8', label: 'In Review' },
    resolved:  { bg: '#DCFCE7', color: '#15803D', label: 'Resolved' },
    closed:    { bg: '#E5E7EB', color: '#6B7280', label: 'Closed' },
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}>
        <View style={styles.headerIconWrap}>
          <ShieldAlert size={24} color={Colors.orange} />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.pageTitle}>Support & Complaints</Text>
          <Text style={styles.pageSub}>Report issues with customers or platform problems</Text>
        </View>
      </View>

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
          <ClipboardList size={16} color={tab === 'history' ? Colors.white : Colors.textSecondary} />
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>My Complaints</Text>
        </TouchableOpacity>
      </View>

      {tab === 'new' && (
        <View style={styles.formWrap}>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>COMPLAINT TYPE *</Text>
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

            <Text style={styles.fieldLabel}>AGAINST (CUSTOMER NAME)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Juan Dela Cruz"
              placeholderTextColor={Colors.textMuted}
              value={against}
              onChangeText={setAgainst}
            />

            <Text style={styles.fieldLabel}>SUBJECT</Text>
            <TextInput
              style={styles.input}
              placeholder="Brief title for your complaint"
              placeholderTextColor={Colors.textMuted}
              value={subject}
              onChangeText={setSubject}
            />

            <Text style={styles.fieldLabel}>DESCRIPTION *</Text>
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
                    <Text style={[styles.priorityText, active && { color: colors[p], fontWeight: '800' }]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.infoBox}>
            <AlertTriangle size={18} color="#1D4ED8" style={{ marginTop: 2 }} />
            <Text style={styles.infoBoxText}>
              Complaints are reviewed by our platform staff within 24–48 hours. Provide as much detail as possible to help us resolve the issue quickly.
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
        <View style={{ paddingHorizontal: 20 }}>
          {loadingHistory ? (
            <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} />
          ) : complaints.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Inbox size={40} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No complaints submitted</Text>
              <Text style={styles.emptySub}>Your submitted complaint history and resolution updates will appear here.</Text>
            </View>
          ) : (
            complaints.map((c) => {
              const ss = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.open;
              return (
                <View key={c.id} style={styles.historyCard}>
                  <View style={styles.historyTop}>
                    <Text style={styles.historyType}>{c.complaint_type}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
                      <Text style={[styles.statusText, { color: ss.color }]}>{ss.label}</Text>
                    </View>
                  </View>
                  {c.subject && <Text style={styles.historySubject}>{c.subject}</Text>}
                  <Text style={styles.historyDesc} numberOfLines={2}>{c.description}</Text>
                  
                  <View style={styles.historyFooter}>
                    <View style={styles.dateRow}>
                      <Clock size={12} color={Colors.textMuted} />
                      <Text style={styles.historyDate}>
                        {new Date(c.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                  </View>

                  {c.resolution_notes && (
                    <View style={styles.resolutionBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <CheckCircle2 size={14} color="#15803D" />
                        <Text style={styles.resolutionLabel}>Staff Resolution</Text>
                      </View>
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, 
    paddingBottom: 20, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 14 
  },
  headerIconWrap: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFF7ED',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FED7AA'
  },
  headerTextWrap: { flex: 1 },
  pageTitle: { fontSize: 22, fontWeight: '900', color: Colors.black, letterSpacing: -0.5 },
  pageSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  
  tabRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginVertical: 20 },
  tabBtn: { 
    flex: 1, flexDirection: 'row', gap: 8, paddingVertical: 12, borderRadius: 14, 
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, 
    borderWidth: 1.5, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1
  },
  tabBtnActive: { backgroundColor: Colors.black, borderColor: Colors.black },
  tabText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white },
  
  formWrap: { paddingHorizontal: 20 },
  card: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2
  },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' },
  typeChipActive: { backgroundColor: '#FFF7ED', borderColor: Colors.orange },
  typeChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  typeChipTextActive: { color: Colors.orange, fontWeight: '800' },
  
  input: { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.black, fontWeight: '500' },
  textarea: { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 },
  
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' },
  priorityText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  
  infoBox: { flexDirection: 'row', backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16, marginTop: 16, gap: 12, borderWidth: 1, borderColor: '#DBEAFE' },
  infoBoxText: { flex: 1, fontSize: 13, color: '#1E3A8A', lineHeight: 20, fontWeight: '500' },
  
  submitBtn: { backgroundColor: Colors.orange, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20, shadowColor: Colors.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  submitBtnText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
  
  emptyWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.black, marginBottom: 6 },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  
  historyCard: { backgroundColor: Colors.white, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9', padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  historyType: { fontSize: 14, fontWeight: '800', color: Colors.black, flex: 1, marginRight: 8 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  historySubject: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  historyDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 12 },
  historyFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyDate: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  
  resolutionBox: { marginTop: 12, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#86EFAC' },
  resolutionLabel: { fontSize: 12, fontWeight: '800', color: '#15803D' },
  resolutionText: { fontSize: 13, color: '#166534', lineHeight: 19, marginTop: 2 },
});