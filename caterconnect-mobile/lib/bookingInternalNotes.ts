import { supabase } from './supabase';

export const INTERNAL_NOTE_LIMIT = 5000;
export type InternalNote = { note: string; revision: number };

export function internalNotesError(error: unknown): string {
  const failure = error as { code?: string; message?: string } | null;
  if (['PGRST202', '42883'].includes(failure?.code ?? '')) {
    return 'Internal notes setup is not installed yet. Please contact platform support.';
  }
  if (failure?.code === '40001') return 'Notes changed elsewhere. Your draft is kept. Reload the saved note before trying again.';
  return failure?.message || 'Could not access internal notes. Please try again.';
}

function parseNote(data: unknown): InternalNote {
  const rows = data as InternalNote[] | null;
  const row = rows?.[0];
  if (rows?.length !== 1 || !row || typeof row.note !== 'string' || !Number.isSafeInteger(row.revision) || row.revision < 0) {
    throw new Error('Internal notes could not be verified. Please reload.');
  }
  return { note: row.note, revision: row.revision };
}

export async function loadInternalNote(bookingId: string): Promise<InternalNote> {
  const { data, error } = await supabase.rpc('get_booking_internal_notes', { p_booking_id: bookingId });
  if (error) throw error;
  return parseNote(data);
}

export async function saveInternalNote(bookingId: string, note: string, revision: number): Promise<InternalNote> {
  if (note.length > INTERNAL_NOTE_LIMIT) throw new Error('Internal notes must be at most 5000 characters.');
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Reload the saved note before trying again.');
  const { data, error } = await supabase.rpc('save_booking_internal_notes', {
    p_booking_id: bookingId, p_note: note, p_expected_revision: revision,
  });
  if (error) throw error;
  return parseNote(data);
}
