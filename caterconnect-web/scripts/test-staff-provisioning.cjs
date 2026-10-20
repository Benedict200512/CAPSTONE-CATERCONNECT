// Offline mocked authorization/creation/error tests. Never calls Supabase.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(filename, imports = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, filename), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require: () => imports, Request, Response, TextEncoder, crypto: require('node:crypto').webcrypto });
  return module.exports;
}
const { createStaffHandler, ProvisionError } = load('../../caterconnect-mobile/supabase/functions/create-staff-account/handler.ts');
function fixture(overrides = {}) {
  const calls = [];
  const dependency = {
    origin: 'https://portal.example',
    verifyToken: async () => { calls.push('jwt'); return 'admin'; },
    authorize: async () => { calls.push('authorize'); },
    create: async (_actor, name, email) => { calls.push(['create', name, email]); return 'new-user'; },
    finish: async () => { calls.push('finish'); },
    activate: async user => { calls.push(['activate', user]); },
    ...overrides,
  };
  return { calls, run: createStaffHandler(dependency) };
}
function request(body = { fullName: ' New Staff ', email: ' NEW@EXAMPLE.COM ', password: 'Test-Only-Password-42' }, token = 'jwt') {
  return new Request('https://function.example', { method: 'POST', headers: { Origin: 'https://portal.example', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
}
test('verified JWT and admin authorization precede creation; role always staff', async () => {
  const f = fixture(); const result = await f.run(request());
  assert.equal(result.status, 201);
  assert.deepEqual(await result.json(), { ok: true, id: 'new-user', role: 'staff' });
  assert.deepEqual(f.calls, ['jwt', 'authorize', ['create', 'New Staff', 'new@example.com'], 'finish', ['activate', 'new-user']]);
});
test('missing/invalid JWT cannot reach creation', async () => {
  const f = fixture(); assert.equal((await f.run(request({}, ''))).status, 401); assert.equal(f.calls.length, 0);
  const invalid = fixture({ verifyToken: async () => null });
  assert.equal((await invalid.run(request())).status, 401); assert.equal(invalid.calls.length, 0);
});
test('customer/staff/suspended admin authorization rejection has no Auth write', async () => {
  for (const actor of ['customer', 'staff', 'suspended-admin']) {
    const f = fixture({ verifyToken: async () => actor, authorize: async () => { throw new ProvisionError(403, 'An active administrator is required.'); } });
    assert.equal((await f.run(request())).status, 403); assert.equal(f.calls.length, 0);
  }
});
test('duplicate email stops before assignment', async () => {
  const f = fixture({ create: async () => { throw new ProvisionError(409, 'Existing account'); } });
  assert.equal((await f.run(request())).status, 409); assert.deepEqual(f.calls, ['jwt', 'authorize']);
});
test('caller cannot choose admin/customer role; invalid fields fail before creation', async () => {
  for (const body of [{ fullName: 'Staff', email: 'new@example.com', role: 'admin' }, { fullName: '', email: 'bad' }]) {
    const f = fixture(); assert.equal((await f.run(request(body))).status, 400); assert.deepEqual(f.calls, ['jwt', 'authorize']);
  }
});
test('assignment failure reports partial Auth identity without leaking request data', async () => {
  const f = fixture({ finish: async () => { throw Error('private infrastructure detail'); } });
  const response = await f.run(request()); const result = await response.json();
  assert.equal(response.status, 502); assert.equal(result.accountCreated, true); assert.equal(result.code, 'FINALIZATION_UNCONFIRMED'); assert.match(result.error, /Activation was not attempted/);
  assert.ok(!f.calls.some(call => Array.isArray(call) && call[0] === 'activate')); assert.ok(!JSON.stringify(result).includes('private infrastructure'));
});
test('missing, short and oversized passwords are rejected server-side', async () => {
  for (const password of [undefined, '', 'short', 'x'.repeat(73), '\u00e9'.repeat(40)]) {
    const f = fixture();
    const response = await f.run(request({ fullName: 'Staff', email: 'staff@example.com', password }));
    assert.equal(response.status, 400); assert.deepEqual(f.calls, ['jwt', 'authorize']);
  }
});

test('accepted password passes unchanged to Auth adapter and is never returned', async () => {
  let received;
  const password = '  Test-Pass-42  ';
  const f = fixture({ create: async (_actor, _name, _email, _nonce, value) => { received = value; return 'new-user'; } });
  const response = await f.run(request({ fullName: 'Staff', email: 'staff@example.com', password }));
  assert.equal(response.status, 201); assert.equal(received, password);
  const body = await response.text(); assert.ok(!body.includes(password) && !body.includes('password'));
});

test('uncertain creation is reported separately and never finalizes or retries', async () => {
  let attempts = 0;
  const f = fixture({ create: async () => { attempts++; throw Error('network outcome unknown'); } });
  const response = await f.run(request()); const body = await response.json();
  assert.equal(response.status, 503); assert.equal(body.code, 'CREATION_UNCONFIRMED');
  assert.equal(body.accountCreated, null); assert.equal(attempts, 1);
  assert.deepEqual(f.calls, ['jwt', 'authorize']);
});

test('activation failure reports uncertainty, with no automatic retry or deletion', async () => {
  let attempts = 0;
  const f = fixture({ activate: async () => { attempts++; throw Error('unban may have committed'); } });
  const response = await f.run(request()); const body = await response.json();
  assert.equal(response.status, 502); assert.equal(body.code, 'ACTIVATION_UNCONFIRMED');
  assert.equal(body.accountCreated, true); assert.equal(attempts, 1);
  assert.match(body.error, /activation may have succeeded/);
  assert.deepEqual(f.calls, ['jwt', 'authorize', ['create', 'New Staff', 'new@example.com'], 'finish']);
});

function edgeFixture({ finalizationFails = false, activationFails = false, existing = false, authDuplicate = false } = {}) {
  const calls = [];
  let banned = false;
  let handler;
  const server = {
    from: () => ({ select: () => ({ ilike: () => ({ limit: async () => ({ data: existing ? [{ id: 'existing-customer' }] : [], error: null }) }) }) }),
    rpc: async (_name, args) => {
      calls.push(args.p_user ? 'finalize' : 'authorize');
      if (args.p_user) assert.equal(args.p_user, 'fresh-staff');
      return { data: args.p_user, error: args.p_user && finalizationFails ? { code: '42501' } : null };
    },
    auth: { admin: {
      createUser: async attributes => {
        calls.push('create');
        assert.equal(attributes.ban_duration, '876000h');
        assert.equal(attributes.user_metadata.role, undefined);
        assert.ok(attributes.app_metadata.cc_staff_provision_nonce);
        if (authDuplicate) return { data: { user: null }, error: { code: 'email_exists' } };
        banned = true;
        return { data: { user: { id: 'fresh-staff', banned_until: '2099-01-01T00:00:00Z' } }, error: null };
      },
      updateUserById: async (id, attributes) => {
        calls.push('activate');
        assert.equal(id, 'fresh-staff'); assert.equal(attributes.ban_duration, 'none');
        assert.ok(calls.includes('finalize'));
        if (activationFails) return { data: { user: null }, error: { message: 'network failure' } };
        banned = false;
        return { data: { user: { id, banned_until: null } }, error: null };
      },
    } },
  };
  const verifier = { auth: { getUser: async () => ({ data: { user: { id: 'active-admin' } }, error: null }) } };
  const env = { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'fake-server-key', SUPABASE_ANON_KEY: 'fake-anon-key', STAFF_PORTAL_ORIGIN: 'https://portal.example' };
  const filename = '../../caterconnect-mobile/supabase/functions/create-staff-account/index.ts';
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, filename), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    exports: {}, Request, Response, TextEncoder, URL, crypto: require('node:crypto').webcrypto,
    Deno: { env: { get: key => env[key] }, serve: value => { handler = value; } },
    require: name => name === './handler.ts' ? { createStaffHandler, ProvisionError }
      : { createClient: (_url, key) => key === env.SUPABASE_SERVICE_ROLE_KEY ? server : verifier },
  });
  return { run: handler, calls, isBanned: () => banned };
}

test('actual adapter creates banned identity, finalizes, and activates only that identity', async () => {
  const f = edgeFixture(); const response = await f.run(request());
  assert.equal(response.status, 201); assert.equal(f.isBanned(), false);
  assert.deepEqual(f.calls, ['authorize', 'create', 'finalize', 'activate']);
});

test('actual adapter leaves failed-finalization identity banned and never unbans it', async () => {
  const f = edgeFixture({ finalizationFails: true }); const response = await f.run(request());
  assert.equal(response.status, 502); assert.equal(f.isBanned(), true);
  assert.equal((await response.json()).code, 'FINALIZATION_UNCONFIRMED');
  assert.deepEqual(f.calls, ['authorize', 'create', 'finalize']);
});

test('actual adapter activation error leaves mocked ban intact, reports uncertainty', async () => {
  const f = edgeFixture({ activationFails: true }); const response = await f.run(request());
  assert.equal(response.status, 502); assert.equal(f.isBanned(), true);
  assert.equal((await response.json()).code, 'ACTIVATION_UNCONFIRMED');
  assert.deepEqual(f.calls, ['authorize', 'create', 'finalize', 'activate']);
});

test('existing profiles and Auth duplicates never reach finalization or activation', async () => {
  for (const settings of [{ existing: true }, { authDuplicate: true }]) {
    const f = edgeFixture(settings); const response = await f.run(request());
    assert.equal(response.status, 409);
    assert.ok(!f.calls.includes('finalize') && !f.calls.includes('activate'));
  }
});

test('frontend sends name/email/password only and surfaces duplicate or partial-creation errors', async () => {
  let response; let args;
  const { createStaffAccount } = load('../src/lib/staffProvisioning.ts', { supabase: { functions: { invoke: async (...values) => { args = values; return response; } } } });
  response = { data: { ok: true, id: 'new-user', role: 'staff' }, error: null };
  await createStaffAccount(' Staff ', ' STAFF@EXAMPLE.COM ', 'Test-Only-Password-42');
  assert.equal(args[0], 'create-staff-account'); assert.equal(JSON.stringify(args[1].body), JSON.stringify({ fullName: 'Staff', email: 'staff@example.com', password: 'Test-Only-Password-42' }));
  response = { data: null, error: { context: new Response(JSON.stringify({ error: 'Existing account' }), { status: 409 }) } };
  await assert.rejects(createStaffAccount('Staff', 'staff@example.com', 'Test-Only-Password-42'), /Existing account/);
  response = { data: { ok: true, id: 'x', role: 'admin' }, error: null };
  await assert.rejects(createStaffAccount('Staff', 'staff@example.com', 'Test-Only-Password-42'), /could not be confirmed/);
});
test('database draft closes customer conversion and restricts new provisioning to service role', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/proposals/staff_provisioning_proposal.sql'), 'utf8');
  for (const text of ["RAISE EXCEPTION 'PROPOSAL ONLY:", "target_role NOT IN ('staff','admin')", "auth.role() IS DISTINCT FROM 'service_role'", "p.status::text='active'", 'raw_app_meta_data', 'cc_staff_provision_nonce', 'u.last_sign_in_at IS NULL', 'TO service_role;', 'p.proacl IS NOT DISTINCT FROM f.proacl']) assert.ok(sql.includes(text));
  const adapter = fs.readFileSync(path.join(__dirname, '../../caterconnect-mobile/supabase/functions/create-staff-account/index.ts'), 'utf8');
  assert.ok(adapter.includes('verifier.auth.getUser(token)'));
  assert.ok(adapter.includes('server.auth.admin.createUser'));
  assert.ok(!adapter.includes('listUsers'));
  assert.ok(adapter.includes("ban_duration: '876000h'"));
  assert.ok(adapter.includes("updateUserById(user, { ban_duration: 'none' })"));
  assert.ok(sql.includes('u.banned_until>clock_timestamp()'));
  const replacement = sql.split('$replacement$')[1];
  assert.ok(!replacement.includes("p_role='customer'"));
  assert.ok(replacement.includes("p_role NOT IN ('staff','admin')"));
});

test('SQL preserves the installed RPC baseline, real safeguards and guarded transaction', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/proposals/staff_provisioning_proposal.sql'), 'utf8');
  const original = fs.readFileSync(path.join(__dirname, '../../supabase/proposals/profiles_role_protection_EXECUTE.sql'), 'utf8');
  const declaration = original.slice(original.indexOf('CREATE FUNCTION public.cc_profile_role1_assign_staff_role('), original.indexOf('ALTER FUNCTION public.cc_profile_role1_assign_staff_role'));
  const normalize = text => text.replace(/\r\n/g, '\n');
  assert.equal(normalize(sql.split('$expected$')[1]), normalize(declaration.split('AS $$')[1].split('$$;')[0]));
  assert.ok(sql.includes("RAISE EXCEPTION 'PROPOSAL ONLY:"));
  assert.ok(sql.includes('\nBEGIN;\n') && sql.includes('\nCOMMIT;'));
  for (const guard of ['p.proowner=f.proowner', 'p.proacl IS NOT DISTINCT FROM f.proacl', 'p.proconfig IS NOT DISTINCT FROM f.proconfig', "attname='banned_until'", 'u.banned_until>clock_timestamp()']) assert.ok(sql.includes(guard));
  assert.ok(!/\b(?:CREATE|ALTER|DROP)\s+POLICY\b/i.test(sql));
  assert.ok(!/\b(?:GRANT|REVOKE)\s+(?:INSERT|UPDATE)\b/i.test(sql));
  const config = fs.readFileSync(path.join(__dirname, '../../caterconnect-mobile/supabase/config.toml'), 'utf8');
  assert.ok(config.includes('[functions.create-staff-account]'));
  assert.ok(config.includes('verify_jwt = true'));
  assert.ok(!config.includes('SERVICE_ROLE_KEY'));
});

test('frontend validates password confirmation and retains staff login routing', () => {
  const ui = fs.readFileSync(path.join(__dirname, '../src/pages/admin/PlatformSettings.tsx'), 'utf8');
  const handler = ui.slice(ui.indexOf('const handleCreateStaff'), ui.indexOf('const planDetails'));
  assert.ok(handler.indexOf('await createStaffAccount(fullName, email, staffPassword)') < handler.indexOf("supabase.from('profiles')"));
  assert.ok(handler.includes('setStaffList(data ?? [])'));
  assert.ok(handler.includes('setStaffError('));
  assert.ok(handler.includes('do not create it again'));
  assert.ok(ui.includes('disabled={creatingStaff'));
  assert.ok(!ui.includes('value="customer"'));
  const app = fs.readFileSync(path.join(__dirname, '../src/App.tsx'), 'utf8');
  assert.ok(!app.includes('StaffPasswordSetup'));
  assert.ok(app.includes("<ProtectedRoute allow={['staff', 'admin']}>"));
  assert.ok(app.includes("<ProtectedRoute allow={['admin']}>"));
  const login = fs.readFileSync(path.join(__dirname, '../src/pages/Login.tsx'), 'utf8');
  assert.ok(login.includes("else if (role === 'staff') navigate('/staff')"));
  assert.ok(handler.includes('staffPassword !== confirmStaffPassword'));
  assert.ok(handler.indexOf('staffPassword !== confirmStaffPassword') < handler.indexOf('await createStaffAccount'));
  assert.ok(handler.includes("setStaffPassword('')") && handler.includes("setConfirmStaffPassword('')"));
  for (const id of ['staff-password', 'staff-confirm-password']) assert.ok(new RegExp('id="' + id + '"\\s+type="password"').test(ui));
  for (const frontend of [ui, fs.readFileSync(path.join(__dirname, '../src/lib/staffProvisioning.ts'), 'utf8')]) {
    assert.ok(!frontend.includes('SERVICE_ROLE_KEY') && !frontend.includes('auth.admin'));
  }
});
