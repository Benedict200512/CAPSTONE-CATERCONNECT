import { supabase } from './supabase';

export type MessageReactions = Record<string, string>;
export function nextReactions(current: MessageReactions | undefined, actor: string, emoji: string): MessageReactions {
  if (!actor || !emoji) throw new Error('Reaction unavailable');
  const next = { ...(current ?? {}) };
  if (next[actor] === emoji) delete next[actor];
  else next[actor] = emoji;
  return next;
}

export function reactionError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === '42501') return 'Reaction permission was denied. Only authorized conversation participants can react. (42501)';
  if (code === '42703' || code === 'PGRST204') return `The message reaction field needs database setup. (${code})`;
  if (code === '23514' || code === '22P02') return `The database rejected this reaction format. (${code})`;
  if (code === '23505') return 'This reaction already exists. Refresh the conversation.';
  const diagnostic = typeof code === 'string' && /^[A-Z0-9]{5,10}$/.test(code) ? ` (${code})` : '';
  return `Reaction was not confirmed. Refresh the conversation and try again.${diagnostic}`;
}

// Retains the existing messages.reactions storage pending the targeted catalog
// review. This client write cannot make whole-map updates atomic or replace RLS.
export async function persistMessageReactions(bookingId: string, messageId: string, actor: string, reactions: MessageReactions): Promise<MessageReactions> {
  const { data, error } = await supabase.from('messages').update({ reactions })
    .eq('id', messageId).eq('booking_id', bookingId)
    .or(`sender_id.eq.${actor},receiver_id.eq.${actor}`).select('id,reactions');
  if (error) throw error;
  if (data?.length !== 1 || data[0].id !== messageId || !data[0].reactions
    || typeof data[0].reactions !== 'object' || Array.isArray(data[0].reactions)
    || Object.values(data[0].reactions).some(value => typeof value !== 'string')
    || data[0].reactions[actor] !== reactions[actor]) {
    throw new Error('Reaction update was not confirmed');
  }
  return data[0].reactions;
}
