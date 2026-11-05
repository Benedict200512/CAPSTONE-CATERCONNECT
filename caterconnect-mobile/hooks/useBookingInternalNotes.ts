import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

type NoteRow = { note: string; revision: string };
type NoteState = NoteRow & {
  key: string; savedNote: string; loading: boolean; saving: boolean;
  error: string; message: string; review: boolean;
};
const emptyState = (key: string): NoteState => ({
  key, note: '', savedNote: '', revision: '', loading: true, saving: false,
  error: '', message: '', review: false,
});
export const INTERNAL_NOTE_LIMIT = 5000;
export const noteLength = (note: string) => Array.from(note).length;

function validateNoteResponse(data: unknown): NoteRow {
  if (!Array.isArray(data) || data.length !== 1) throw new Error('Invalid note response');
  const row = data[0] as Record<string, unknown> | null;
  if (!row || typeof row.note !== 'string' || noteLength(row.note) > INTERNAL_NOTE_LIMIT) {
    throw new Error('Invalid note response');
  }
  const value = row.revision;
  // Keep bigint as decimal text; reject already-rounded JSON numbers.
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isSafeInteger(value))) {
    throw new Error('Invalid note revision');
  }
  const revision = String(value);
  if (!/^(0|[1-9]\d*)$/.test(revision) || revision.length > 19 ||
      (revision.length === 19 && revision > '9223372036854775807')) {
    throw new Error('Invalid note revision');
  }
  return { note: row.note, revision };
}

function noteError(error: unknown, saving: boolean): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === '40001') return 'This note changed elsewhere. Your draft is preserved. Load the latest saved note, compare it with your draft, then save again.';
  if (code === '42501') return 'You are not authorized to access this private note. Reopen the booking with the assigned Caterer account.';
  if (code === 'PGRST202' || code === '42883') return 'The private notes service is unavailable. Retry or contact support.';
  return saving
    ? 'The save could not be confirmed. Your draft is preserved. Load the latest saved note before trying again.'
    : 'Private notes could not be loaded. Retry to load the saved note.';
}

// Identical contract on Web and Mobile. Never read or write shared booking notes.
export function useBookingInternalNotes(bookingId: string | null, userId: string | null) {
  const key = bookingId && userId ? `${userId}:${bookingId}` : '';
  const currentKey = useRef(key);
  currentKey.current = key;
  const scopeRef = useRef<{ key: string; active: boolean; request: number; loading: boolean } | null>(null);
  const busy = useRef(false);
  const [state, setState] = useState<NoteState>(() => emptyState(''));
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = async (preserveDraft: boolean) => {
    const scope = scopeRef.current;
    if (!scope?.active || !bookingId || !userId || scope.key !== key || busy.current) return;
    const request = ++scope.request;
    scope.loading = true;
    const before = stateRef.current;
    const keepDraft = preserveDraft && before.key === key && before.note !== before.savedNote;
    const isCurrent = () => scope.active && currentKey.current === key && request === scope.request;
    setState(previous => ({ ...(previous.key === key ? previous : emptyState(key)),
      loading: true, error: '', message: '' }));
    try {
      const { data, error } = await supabase.rpc('get_booking_internal_notes', { p_booking_id: bookingId });
      if (!isCurrent()) return;
      if (error) throw error;
      const row = validateNoteResponse(data);
      setState({ ...emptyState(key), ...row, note: keepDraft ? before.note : row.note,
        savedNote: row.note, loading: false, review: keepDraft,
        message: keepDraft ? 'Latest saved note loaded below. Your draft is unchanged; compare before saving.' : '' });
    } catch (error) {
      if (isCurrent()) setState(previous => ({ ...previous, loading: false, revision: '', error: noteError(error, false) }));
    } finally {
      if (request === scope.request) scope.loading = false;
    }
  };
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const scope = { key, active: true, request: 0, loading: false };
    scopeRef.current = scope;
    setState(emptyState(key));
    if (key) void loadRef.current(false);
    return () => { scope.active = false; scope.request += 1; };
  }, [key]);

  const visible = state.key === key ? state : emptyState(key);
  const ready = !!key && !visible.loading && !!visible.revision;
  const dirty = visible.note !== visible.savedNote;

  const save = async () => {
    const scope = scopeRef.current;
    const before = stateRef.current;
    if (!scope?.active || scope.loading || scope.key !== key || !key || !bookingId || busy.current ||
        before.key !== key || before.loading || !before.revision || before.note === before.savedNote) return;
    if (noteLength(before.note) > INTERNAL_NOTE_LIMIT) return;
    busy.current = true;
    const request = ++scope.request;
    const isCurrent = () => scope.active && currentKey.current === key && request === scope.request;
    setState(previous => ({ ...previous, saving: true, error: '', message: '' }));
    try {
      const { data, error } = await supabase.rpc('save_booking_internal_notes', {
        p_booking_id: bookingId, p_note: before.note, p_expected_revision: before.revision,
      });
      if (!isCurrent()) return;
      if (error) throw error;
      const row = validateNoteResponse(data);
      if (row.revision.length < before.revision.length ||
          (row.revision.length === before.revision.length && row.revision <= before.revision)) {
        throw new Error('Save revision was not advanced');
      }
      setState({ ...emptyState(key), ...row, savedNote: row.note, loading: false,
        message: row.note === '' ? 'Private note cleared.' : 'Private note saved.' });
    } catch (error) {
      if (isCurrent()) setState(previous => ({ ...previous, saving: false, revision: '',
        error: noteError(error, true) }));
    } finally {
      busy.current = false;
      // A different booking may have opened while this save was in flight.
      const currentScope = scopeRef.current;
      if (currentScope?.active && currentScope !== scope && currentKey.current === currentScope.key) {
        void loadRef.current(false);
      }
    }
  };

  return {
    ...visible, ready, dirty, count: noteLength(visible.note),
    canSave: ready && dirty && !visible.saving,
    setNote: (note: string) => {
      if (!ready || visible.saving || scopeRef.current?.loading || busy.current) return;
      const limited = Array.from(note).slice(0, INTERNAL_NOTE_LIMIT).join('');
      setState(previous => previous.key === key ? { ...previous, note: limited, message: '' } : previous);
    },
    reload: () => { void load(true); },
    useSavedNote: () => setState(previous => previous.key === key && !previous.loading && !previous.saving
      ? { ...previous, note: previous.savedNote, review: false, message: '' } : previous),
    save,
  };
}
