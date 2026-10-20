import { createClient } from 'npm:@supabase/supabase-js@2.108.2';
import { createStaffHandler, ProvisionError } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anon = Deno.env.get('SUPABASE_ANON_KEY');
const origin = Deno.env.get('STAFF_PORTAL_ORIGIN');
if (!url || !key || !anon || !origin || new URL(origin).origin !== origin) throw new Error('Staff provisioning configuration missing or invalid');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const server = createClient(url, key, options);
const verifier = createClient(url, anon, options);

Deno.serve(createStaffHandler({
  origin,
  async verifyToken(token) {
    const { data, error } = await verifier.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  async authorize(actor) {
    const { error } = await server.rpc('cc_staff_provision1_finalize', { p_actor: actor, p_user: null, p_nonce: null });
    if (error) {
      if (error.code === '42501') throw new ProvisionError(403, 'An active administrator is required.');
      throw error;
    }
  },
  async create(actor, fullName, email, nonce, password) {
    // Also reject retained/orphan profiles, case-insensitively. Escape LIKE
    // metacharacters so an email's underscores/percent signs stay literal.
    const emailPattern = email.replace(/[\\%_]/g, character => '\\' + character);
    const { data: existing, error: lookupError } = await server.from('profiles').select('id').ilike('email', emailPattern).limit(1);
    if (lookupError) throw lookupError;
    if (existing?.length) throw new ProvisionError(409, 'This email already belongs to an account. Existing accounts cannot be converted to staff.');
    // Atomic Auth create rejects duplicates. Never look up/promote an existing ID.
    // Password travels over HTTPS to Auth only; never log or return it.
    const { data, error } = await server.auth.admin.createUser({
      email, password, email_confirm: true, ban_duration: '876000h',
      user_metadata: { full_name: fullName },
      app_metadata: { cc_staff_provision_actor: actor, cc_staff_provision_nonce: nonce },
    });
    if (error) {
      if (['email_exists', 'user_already_exists'].includes(error.code ?? '')) throw new ProvisionError(409, 'This email already belongs to an account. Existing accounts cannot be converted to staff.');
      if (error.code === 'weak_password') throw new ProvisionError(400, 'Password does not meet the project password policy.');
      throw error;
    }
    if (!data.user || !data.user.banned_until || Date.parse(data.user.banned_until) <= Date.now()
      || !Number.isFinite(Date.parse(data.user.banned_until))) throw new Error('New banned Auth identity not confirmed');
    return data.user.id;
  },
  async finish(actor, user, nonce) {
    const { data, error } = await server.rpc('cc_staff_provision1_finalize', { p_actor: actor, p_user: user, p_nonce: nonce });
    if (error || data !== user) throw new Error('Staff assignment failed');
  },
  async activate(user) {
    // Only the ID returned by this request's successful NEW-user creation is
    // passed here, and only after finalization returned that same ID.
    const { data, error } = await server.auth.admin.updateUserById(user, { ban_duration: 'none' });
    if (error || data.user?.id !== user) throw new Error('Staff activation not confirmed');
    if (data.user.banned_until && (!Number.isFinite(Date.parse(data.user.banned_until))
      || Date.parse(data.user.banned_until) > Date.now())) throw new Error('Staff identity remains banned');
  },
}));
