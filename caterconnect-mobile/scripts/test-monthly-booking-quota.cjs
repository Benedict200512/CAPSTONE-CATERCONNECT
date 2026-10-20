// Offline regression checks: Supabase is mocked; no credentials/network/SQL.
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../lib/monthlyBookingQuota.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const statuses = ['confirmed', 'awaiting_payment', 'paid', 'ongoing', 'completed'];

function fixture({ used = 3, unassigned = 0, error = null, ownerError = null, user = 'owner', plan = 'free', expiry = null } = {}) {
  const calls = [];
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: user } } } }) },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      const query = {
        select(fields, options) { call.fields = fields; call.options = options; return this; },
        eq(field, value) { call.filters.push([field, value]); return this; },
        is(field, value) { call.filters.push([field, value]); call.unassigned = true; return this; },
        in(field, values) { call.filters.push([field, Array.from(values)]); return this; },
        single: async () => ({ data: { id: 'caterer', subscription_plan: plan, subscription_expires_at: expiry }, error: ownerError }),
        then(resolve, reject) { return Promise.resolve({ count: call.unassigned ? unassigned : used, error }).then(resolve, reject); },
      };
      return query;
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module, Date, require(name) {
    if (name === './supabase') return { supabase };
    if (name === './availability') return { COMMITTED_BOOKING_STATUSES: statuses };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return { api: module.exports, calls };
}

test('Manila month boundary uses UTC+8, independent of event dates', () => {
  const { api } = fixture();
  assert.equal(api.manilaQuotaMonth(Date.parse('2026-09-30T15:59:59Z')), '2026-09-01');
  assert.equal(api.manilaQuotaMonth(Date.parse('2026-09-30T16:00:00Z')), '2026-10-01');
});

test('plan display matches limits and expiry fallback; unknown entitlement is rejected', () => {
  const { api } = fixture();
  const now = Date.parse('2026-10-01T00:00:00Z');
  const future = '2026-11-01T00:00:00Z';
  for (const [plan, limit] of [['free', 5], ['basic', 20], ['standard', 50], ['premium', null]]) {
    assert.equal(api.monthlyPlanLimit(plan, future, now), limit);
  }
  assert.equal(api.monthlyPlanLimit('premium', '2026-09-01T00:00:00Z', now), 5);
  assert.throws(() => api.monthlyPlanLimit('premium', null, now));
  assert.throws(() => api.monthlyPlanLimit('unknown', future, now));
});

test('monthly error classification does not swallow daily capacity or unrelated errors', () => {
  const { api } = fixture();
  const message = 'Monthly accepted-booking limit reached. Please review your subscription.';
  assert.equal(api.isMonthlyQuotaRejection({ code: '23514', message }), true);
  assert.equal(api.isMonthlyQuotaRejection({ code: '23514', message: 'This event date has reached the caterer daily booking limit.' }), false);
  assert.equal(api.isMonthlyQuotaRejection({ code: '42501', message }), false);
  assert.equal(api.isMonthlyQuotaRejection(null), false);
});

test('usage reads only owned, period-tagged committed bookings; no legacy counter fallback', async () => {
  const { api, calls } = fixture();
  const result = await api.loadMonthlyBookingQuota('caterer', 'owner');
  assert.equal(result.status, 'ready');
  assert.equal(result.used, 3);
  assert.equal(result.remaining, 2);
  assert.ok(calls[0].filters.some(([key, value]) => key === 'user_id' && value === 'owner'));
  assert.ok(!calls[0].fields.includes('monthly_booking_count'));
  for (const call of calls.slice(1)) {
    assert.equal(call.fields, 'quota_month');
    assert.equal(call.options.count, 'exact');
    assert.equal(call.options.head, true);
    assert.deepEqual(call.filters.find(([key]) => key === 'status')[1], statuses);
    assert.ok(call.filters.some(([key, value]) => key === 'caterer_id' && value === 'caterer'));
  }
  assert.ok(calls[1].filters.some(([key, value]) => key === 'quota_month' && value === api.manilaQuotaMonth()));
});

test('missing migration and unassigned legacy commitments show setup required', async () => {
  const missing = fixture({ error: { code: '42703', message: 'column bookings.quota_month does not exist' } });
  assert.equal((await missing.api.loadMonthlyBookingQuota('caterer', 'owner')).status, 'setup');
  const legacy = fixture({ unassigned: 1 });
  assert.equal((await legacy.api.loadMonthlyBookingQuota('caterer', 'owner')).status, 'setup');
});

test('failed/unknown counts and failed owner authorization never become zero usage', async () => {
  for (const options of [{ used: null }, { error: { code: '42501' } }, { ownerError: { code: '42501' } }, { user: 'other' }]) {
    const { api } = fixture(options);
    assert.equal((await api.loadMonthlyBookingQuota('caterer', 'owner')).status, 'unavailable');
  }
});

test('over-limit commitments remain visible; Premium reports unlimited remaining', async () => {
  const over = fixture({ used: 7 });
  const overResult = await over.api.loadMonthlyBookingQuota('caterer', 'owner');
  assert.equal(overResult.used, 7);
  assert.equal(overResult.remaining, 0);
  const premium = fixture({ used: 99, plan: 'premium', expiry: '2099-01-01T00:00:00Z' });
  const premiumResult = await premium.api.loadMonthlyBookingQuota('caterer', 'owner');
  assert.equal(premiumResult.status, 'ready');
  assert.equal(premiumResult.limit, null);
  assert.equal(premiumResult.remaining, null);
});
