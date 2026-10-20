// Offline AuthProvider regression checks; Supabase/React are mocked.
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../context/AuthContext.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;

async function providerFixture(caterer, role = 'caterer') {
  const effects = [];
  const state = [];
  const calls = [];
  const session = { user: { id: 'user' } };
  const profile = { id: 'user', role };
  let hook = 0;
  let authCallback;
  let unsubscribed = false;
  const React = {
    createContext: () => ({ Provider: 'provider' }),
    createElement: (_type, props) => props,
    useContext: () => {},
    useEffect: callback => effects.push(callback),
    useState(initial) {
      const index = hook++;
      state[index] = index === 0 ? session : initial;
      return [state[index], value => { state[index] = value; }];
    },
  };
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange(callback) {
        authCallback = callback;
        return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
      },
    },
    from(table) {
      calls.push(table);
      return {
        select() { return this; }, eq() { return this; },
        single: async () => ({ data: profile }),
        maybeSingle: async () => ({ data: caterer }),
        update() { throw new Error('Client writes must not occur'); },
      };
    },
    rpc() { throw new Error('No invented maintenance RPC'); },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module, require(name) {
    if (name === 'react') return React;
    if (name === '../lib/supabase') return { supabase };
    throw new Error(`Unexpected runtime dependency: ${name}`);
  } });
  const rendered = module.exports.AuthProvider({ children: null });
  const cleanups = effects.map(effect => effect());
  // Drain the mocked read chain without timers or real network access.
  for (let i = 0; i < 8; i++) await Promise.resolve();
  return { state, calls, reload: rendered.value.reloadProfile,
    signOut() { authCallback('SIGNED_OUT', null); },
    cleanup() { cleanups.forEach(cleanup => cleanup?.()); return unsubscribed; } };
}

test('expired subscription and due counter remain persisted server values on login/reload', async () => {
  const caterer = Object.freeze({ id: 'business', subscription_plan: 'premium',
    subscription_expires_at: '2000-01-01T00:00:00Z', monthly_booking_count: 12,
    booking_count_reset_at: '2000-01-01T00:00:00Z' });
  const fixture = await providerFixture(caterer);
  assert.equal(fixture.state[2], caterer);
  assert.equal(fixture.state[3], false);
  await fixture.reload();
  assert.equal(fixture.state[2], caterer);
  assert.equal(caterer.monthly_booking_count, 12);
  assert.equal(caterer.subscription_plan, 'premium');
  assert.equal(fixture.cleanup(), true);
});

test('active activation result reloads read-only, preserving plan, expiry and usage', async () => {
  const caterer = Object.freeze({ id: 'business', subscription_plan: 'standard',
    subscription_expires_at: '2099-01-01T00:00:00Z', monthly_booking_count: 8,
    booking_count_reset_at: null });
  const fixture = await providerFixture(caterer);
  await fixture.reload();
  assert.equal(fixture.state[2], caterer);
  assert.equal(caterer.monthly_booking_count, 8);
});

test('customer login never queries or modifies caterer subscription state', async () => {
  const fixture = await providerFixture(null, 'customer');
  assert.deepEqual(fixture.calls, ['profiles']);
  assert.equal(fixture.state[1].role, 'customer');
  fixture.signOut();
  assert.equal(fixture.state[0], null);
});

test('missing caterer row does not prevent session/profile loading', async () => {
  const fixture = await providerFixture(null);
  assert.equal(fixture.state[0].user.id, 'user');
  assert.equal(fixture.state[1].role, 'caterer');
  assert.equal(fixture.state[2], null);
  assert.equal(fixture.state[3], false);
});
