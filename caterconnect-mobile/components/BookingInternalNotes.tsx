import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LockKeyhole, RefreshCw } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { INTERNAL_NOTE_LIMIT, internalNotesError, loadInternalNote, saveInternalNote, type InternalNote } from '../lib/bookingInternalNotes';

export default function BookingInternalNotes({ bookingId }: { bookingId: string }) {
  const { session, catererData } = useAuth();
  const identity = `${session?.user.id ?? ''}:${catererData?.id ?? ''}:${bookingId}`;
  const current = useRef(identity);
  current.current = identity;
  const request = useRef(0);
  const [state, setState] = useState<{ identity: string; saved: InternalNote | null; draft: string; error: string; message: string; loading: boolean; saving: boolean }>({
    identity, saved: null, draft: '', error: '', message: '', loading: true, saving: false,
  });
  const reload = async () => {
    const version = ++request.current;
    setState({ identity, saved: null, draft: '', error: '', message: '', loading: true, saving: false });
    try {
      if (!session?.user.id || !catererData?.id) throw new Error('Sign in with your caterer account to access internal notes.');
      const result = await loadInternalNote(bookingId);
      if (current.current === identity && version === request.current) setState({ identity, saved: result, draft: result.note, error: '', message: '', loading: false, saving: false });
    } catch (error) {
      if (current.current === identity && version === request.current) setState({ identity, saved: null, draft: '', error: internalNotesError(error), message: '', loading: false, saving: false });
    }
  };
  useEffect(() => { void reload(); return () => { request.current++; }; }, [identity]);
  const visible = state.identity === identity ? state : null;
  const save = async () => {
    if (!visible?.saved || visible.loading || visible.saving) return;
    const version = ++request.current;
    setState(prev => ({ ...prev, saving: true, error: '', message: '' }));
    try {
      const result = await saveInternalNote(bookingId, visible.draft, visible.saved.revision);
      if (current.current === identity && version === request.current) setState({ identity, saved: result, draft: result.note, error: '', message: result.note ? 'Internal notes saved.' : 'Internal notes cleared.', loading: false, saving: false });
    } catch (error) {
      if (current.current === identity && version === request.current) setState(prev => ({ ...prev, saving: false, error: internalNotesError(error) }));
    }
  };
  const reloadWithConfirmation = () => {
    if (visible?.saved && visible.draft !== visible.saved.note) {
      Alert.alert('Reload saved notes?', 'This replaces your unsaved draft with the latest saved note.', [
        { text: 'Keep draft', style: 'cancel' }, { text: 'Reload', onPress: () => { void reload(); } },
      ]);
    } else void reload();
  };
  return <View style={styles.card}>
    <View style={styles.header}><LockKeyhole size={19} color="#A64200" /><Text style={styles.title}>Internal Notes</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reload internal notes" disabled={!visible || visible.loading || visible.saving} style={styles.reload} onPress={reloadWithConfirmation}>
        <RefreshCw size={18} color="#475569" />
      </TouchableOpacity>
    </View>
    <Text style={styles.privacy}>Private — Only visible to your catering team.</Text>
    {!visible || visible.loading ? <View style={styles.loading}><ActivityIndicator color="#FF7A00" /><Text style={styles.hint}>Loading internal notes…</Text></View> : <>
      {visible.saved && <>
        <TextInput accessibilityLabel="Private internal booking notes" multiline textAlignVertical="top" maxLength={INTERNAL_NOTE_LIMIT}
          editable={!visible.saving} style={styles.input} placeholder="Setup reminders, staffing, timing, or other operational notes…" placeholderTextColor="#64748B"
          value={visible.draft} onChangeText={draft => setState(prev => ({ ...prev, draft, message: '' }))} />
        <Text style={styles.counter}>{visible.draft.length.toLocaleString()} / {INTERNAL_NOTE_LIMIT.toLocaleString()}</Text>
        <View style={styles.actions}>
          <TouchableOpacity accessibilityRole="button" disabled={visible.saving || !visible.draft} style={styles.clear} onPress={() => setState(prev => ({ ...prev, draft: '', message: '' }))}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: visible.saving || visible.draft === visible.saved.note, busy: visible.saving }}
            disabled={visible.saving || visible.draft === visible.saved.note} onPress={() => void save()}
            style={[styles.save, (visible.saving || visible.draft === visible.saved.note) && styles.disabled]}>
            {visible.saving ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.saveText}>Save Notes</Text>}
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Tap Save Notes to apply changes, including clearing a note.</Text>
      </>}
      {!!visible.error && <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text>}
      {!!visible.message && <Text accessibilityLiveRegion="polite" style={styles.success}>{visible.message}</Text>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: '#0F172A', fontSize: 17, fontWeight: '700' },
  reload: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  privacy: { color: '#A64200', fontSize: 12, lineHeight: 19 },
  input: { minHeight: 140, backgroundColor: '#F8FAFC', color: '#0F172A', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 14, fontSize: 14, lineHeight: 22 },
  counter: { color: '#64748B', fontSize: 11, textAlign: 'right' },
  loading: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12 },
  clear: { minHeight: 46, padding: 12, justifyContent: 'center' },
  clearText: { color: '#475569', fontSize: 14, fontWeight: '600' },
  save: { minHeight: 46, minWidth: 124, backgroundColor: '#FF7A00', borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#0F172A', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  hint: { color: '#64748B', fontSize: 11, lineHeight: 18 },
  error: { color: '#B91C1C', fontSize: 13, lineHeight: 20 },
  success: { color: '#166534', fontSize: 13, lineHeight: 20 },
});
