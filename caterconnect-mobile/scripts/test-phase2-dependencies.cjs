// Offline mocked webhook behavior + SQL/source contracts. No SQL/network/users.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { test } = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const helperFile = 'caterconnect-mobile/supabase/functions/xendit-webhook/record-booking-callback.ts';
const compiled = ts.transpileModule(read(helperFile), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleObject = { exports: {} };
vm.runInNewContext(compiled, { module: moduleObject, exports: moduleObject.exports, Date });
const { recordBookingCallback } = moduleObject.exports;

function fixture({ status = 'confirmed', receipt = null, verified = null, readError = false, updateError = false, race = null } = {}) {
  const row = { id: 'booking', status, payment_receipt_url: receipt, payment_verified_at: verified };
  const writes = [];
  const client = { from(table) {
    assert.equal(table, 'bookings');
    let patch;
    const filters = [];
    const query = {
      select() {
        if (!patch) return this;
        if (race) race(row);
        if (updateError) return Promise.resolve({ data: null, error: { message: 'database failure' } });
        const matches = filters.every(([key, value]) => row[key] === value);
        if (matches) { Object.assign(row, patch); writes.push(patch); }
        return Promise.resolve({ data: matches ? [{ id: row.id }] : [], error: null });
      },
      eq(key, value) { filters.push([key, value]); return this; },
      is(key, value) { filters.push([key, value]); return this; },
      update(value) { patch = value; return this; },
      maybeSingle: async () => ({ data: { ...row }, error: readError ? { message: 'read failed' } : null }),
    };
    return query;
  } };
  return { client, row, writes };
}

test('first callback records awaiting verification without marking paid or changing refunds', async () => {
  const f = fixture();
  assert.equal(await recordBookingCallback(f.client, 'booking', 'new-charge'), 'processed');
  assert.equal(f.row.status, 'awaiting_payment');
  assert.equal(f.row.payment_verified_at, null);
  assert.deepEqual(Object.keys(f.writes[0]).sort(), ['payment_receipt_url', 'payment_submitted_at', 'status']);
});
test('duplicate/delayed callbacks cannot reopen protected or unaccepted states', async () => {
  for (const status of ['pending', 'rejected', 'cancelled', 'paid', 'ongoing', 'completed', 'awaiting_payment']) {
    const f = fixture({ status });
    assert.equal(await recordBookingCallback(f.client, 'booking', 'charge'), 'ignored');
    assert.equal(f.row.status, status); assert.equal(f.writes.length, 0);
  }
  const duplicate = fixture({ receipt: 'charge' });
  assert.equal(await recordBookingCallback(duplicate.client, 'booking', 'charge'), 'ignored');
  const verified = fixture({ verified: '2026-01-01T00:00:00Z' });
  assert.equal(await recordBookingCallback(verified.client, 'booking', 'charge'), 'ignored');
});
test('new charge after an authorized payment rejection can be recorded; old charge cannot', async () => {
  const f = fixture({ receipt: 'rejected-charge' });
  assert.equal(await recordBookingCallback(f.client, 'booking', 'rejected-charge'), 'ignored');
  assert.equal(await recordBookingCallback(f.client, 'booking', 'replacement-charge'), 'processed');
  assert.equal(f.row.payment_receipt_url, 'replacement-charge');
});
test('concurrent callbacks update once; only winner is eligible for notifications', async () => {
  const f = fixture();
  const results = await Promise.all([
    recordBookingCallback(f.client, 'booking', 'charge'), recordBookingCallback(f.client, 'booking', 'charge'),
  ]);
  assert.deepEqual(results.sort(), ['ignored', 'processed']); assert.equal(f.writes.length, 1);
});
test('cancellation/completion/verification/receipt races produce zero writes', async () => {
  for (const race of [row => { row.status = 'cancelled'; }, row => { row.status = 'completed'; },
    row => { row.payment_verified_at = 'verified'; }, row => { row.payment_receipt_url = 'different'; }]) {
    const f = fixture({ race });
    assert.equal(await recordBookingCallback(f.client, 'booking', 'charge'), 'ignored');
    assert.equal(f.writes.length, 0);
  }
});
test('database failure is retryable rather than acknowledged as successful', async () => {
  for (const options of [{ readError: true }, { updateError: true }]) {
    const f = fixture(options); assert.equal(await recordBookingCallback(f.client, 'booking', 'charge'), 'retry');
    assert.equal(f.writes.length, 0);
  }
});

function webhookFixture(f) {
  let serveHandler;
  let notifications = 0;
  const client = { from(table) {
    if (table === 'notifications') return { insert: async () => { notifications++; return { error: null }; } };
    const query = f.client.from(table);
    query.single = async () => ({ data: { customer_id: 'customer', caterers: { user_id: 'owner', business_name: 'Business' }, profiles: { full_name: 'Customer' } } });
    return query;
  } };
  const source = read('caterconnect-mobile/supabase/functions/xendit-webhook/index.ts');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports: {}, Response, Date,
    console: { log() {}, error() {} },
    Deno: { env: { get: key => key === 'XENDIT_WEBHOOK_TOKEN' ? 'fake-test-token' : 'fake-config' } },
    require: name => name.includes('record-booking-callback') ? { recordBookingCallback }
      : name.includes('server.ts') ? { serve: handler => { serveHandler = handler; } } : { createClient: () => client },
  });
  return { run: serveHandler, notifications: () => notifications };
}
const callback = () => new Request('https://example.test', { method: 'POST', headers: { 'x-callback-token': 'fake-test-token' },
  body: JSON.stringify({ event: 'payment.succeeded', data: { id: 'charge', reference_id: 'booking_booking_123', metadata: { type: 'booking' } } }) });
test('verified webhook uses guarded Paid transition and database notifications instead of legacy manual-review callback', () => {
  const source = read('caterconnect-mobile/supabase/functions/xendit-webhook/index.ts');
  assert.ok(source.includes('verifyBookingInvoice(client, payment)'));
  assert.ok(!source.includes('recordBookingCallback') && !source.includes("from('notifications')"));
});
test('verified webhook returns retryable errors and never logs raw database errors', () => {
  const source = read('caterconnect-mobile/supabase/functions/xendit-webhook/index.ts');
  assert.ok(source.includes("result.outcome === 'retry'"));
  assert.ok(source.includes("status: 503"));
  assert.ok(!source.includes('paymentError') && !source.includes('upgradeError'));
});

test('subscription flow uses a single verified handler and monthly proposals remain byte-for-byte unchanged', () => {
  const s = read('caterconnect-mobile/supabase/functions/xendit-webhook/index.ts');
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  assert.ok(s.includes('verifySubscriptionPayment(client, payment)'));
  assert.ok(!s.includes('monthly_booking_count:') && !s.includes('booking_count_reset_at:'));
  for (const [file, expected] of [
    ['monthly_booking_quota_proposal.sql', '3ee99312d9a2866ddb6fe80b737d526196213717bf111da950bc3b9e2dd488b4'],
    ['monthly_booking_quota_rollback_proposal.sql', 'd1c3babe2f46c7b254d0b44dca8418f0fbf628dffb3988c216cd22963bded3d2'],
  ]) assert.equal(hash(fs.readFileSync(path.join(root, 'supabase/proposals', file))), expected);
});
test('guarded grant migration snapshots prior access and refuses unexpected losses', () => {
  const sql = read('supabase/proposals/phase2_security_dependencies_proposal.sql');
  for (const fragment of ["RAISE EXCEPTION 'PROPOSAL ONLY:", 'REVOKE INSERT ON public.caterers FROM PUBLIC,anon,authenticated RESTRICT',
    "column_name NOT IN ('subscription_plan','subscription_expires_at')", "role_name='service_role'", 'IS DISTINCT FROM s.can_insert',
    'REVOKE TRUNCATE ON public.bookings FROM anon,authenticated RESTRICT', 'IS DISTINCT FROM s.can_truncate',
    'IS DISTINCT FROM s.can_delete', 'Trusted subscription function drift', 'RLS policy drift', 'Existing trigger drift',
    'literal Free-plan default', 'safe NULL expiry initialization']) assert.ok(sql.includes(fragment), fragment);
  assert.ok(!/\b(?:CREATE|ALTER|DROP)\s+POLICY\b/i.test(sql));
  assert.ok(!sql.includes('REVOKE UPDATE') && !sql.includes('REVOKE DELETE'));
});
test('terminal/reversal SQL guard covers final row values without interfering with quota updates', () => {
  const sql = read('supabase/proposals/phase2_security_dependencies_proposal.sql');
  assert.ok(sql.includes('IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW;'));
  assert.ok(sql.includes("IF OLD.status::text='completed' THEN"));
  assert.ok(sql.includes("AND NEW.status::text IN ('pending','rejected')"));
  assert.ok(sql.includes('AFTER UPDATE ON public.bookings'));
  assert.ok(!/CREATE TRIGGER[\s\S]*?AFTER UPDATE OF status/.test(sql));
  const body = sql.split('CREATE FUNCTION public.cc_phase2_dependency1_guard_status()')[1].split('$$;')[0];
  assert.ok(!body.includes('auth.uid') && !body.includes('current_user') && !body.includes('UPDATE public.'));
  assert.ok(sql.includes('tgtype=17'));
});
test('registration omits protected fields; staff approval preserves existing subscription', () => {
  const registration = read('caterconnect-mobile/app/(caterer)/edit-profile.tsx');
  const insert = registration.split("supabase.from('caterers').insert({")[1].split('}).select')[0];
  for (const field of ['user_id:', 'business_name:', 'verification_status:']) assert.ok(insert.includes(field));
  assert.ok(!insert.includes('subscription_plan') && !insert.includes('subscription_expires_at'));
  const approval = read('caterconnect-web/src/pages/staff/CatererVerification.tsx');
  const update = approval.split("supabase.from('caterers').update({")[1].split("}).eq('id', id)")[0];
  for (const field of ['verification_status:', 'rejection_reason:', 'staff_notes:', 'reviewed_at:', 'reviewed_by:']) assert.ok(update.includes(field));
  assert.ok(!update.includes('subscription_plan') && !update.includes('subscription_expires_at'));
});
