// Mocked application behavior and SQL/source contracts. No SQL or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function fixture({ user = 'owner', previous = 'unpublished', rows = [{ id: 'package' }], ownerError = null,
  readError = null, packageData = { id: 'package', publication_status: 'published' }, packages = [] } = {}) {
  const calls = [];
  const supabase = { auth: { getSession: async () => ({ data: { session: { user: { id: user } } }, error: null }) },
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      return { select(fields) { call.fields = fields; return this; },
        eq(key, value) { call.filters.push([key, value]); return this; },
        in(key, value) { call.filters.push([key, Array.from(value)]); return this; },
        order() { return this; },
        update(patch) { call.patch = patch; return this; },
        single: async () => ({ data: { id: 'caterer' }, error: ownerError }),
        maybeSingle: async () => ({ data: packageData, error: readError }),
        then(resolve, reject) {
          const data = call.patch ? rows : table === 'packages' ? packages
            : table === 'caterers' ? [{ id: 'caterer', business_name: 'Caterer', packages }]: [];
          return Promise.resolve({ data, error: call.patch ? readError : null }).then(resolve, reject);
        },
      };
    },
  };
  const cache = new Map();
  const load = name => {
    if (cache.has(name)) return cache.get(name);
    const module = { exports: {} }; cache.set(name, module.exports);
    const code = ts.transpileModule(read(`caterconnect-mobile/lib/${name}.ts`), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, Date, require: dependency => {
      if (dependency === './supabase') return { supabase };
      return load(dependency.replace('./', ''));
    } });
    return module.exports;
  };
  return { calls, load, previous };
}

test('only explicit published status is discoverable; unknown status fails closed', () => {
  const api = fixture().load('packagePublication');
  assert.equal(api.isPublishedPackage({ publication_status: 'published' }), true);
  for (const value of ['unpublished', 'archived', 'unknown', undefined, null]) {
    assert.equal(api.isPublishedPackage({ publication_status: value }), false);
  }
  assert.equal(api.isPublicationStatus('archived'), true);
  assert.equal(api.isPublicationStatus('unknown'), false);
  assert.match(api.packagePublicationError({ code: '42703', message: 'publication_status missing' }), /setup is required/);
});

test('publication action updates only status with owner and stale-state filters', async () => {
  for (const [previous, next] of [['unpublished', 'published'], ['published', 'unpublished'], ['published', 'archived'], ['archived', 'unpublished']]) {
    const f = fixture();
    await f.load('packagePublication').setPackagePublication('package', 'caterer', 'owner', previous, next);
    assert.equal(f.calls[0].table, 'caterers');
    assert.deepEqual(f.calls[0].filters, [['id', 'caterer'], ['user_id', 'owner']]);
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls[1].patch)), { publication_status: next });
    assert.deepEqual(f.calls[1].filters, [['id', 'package'], ['caterer_id', 'caterer'], ['publication_status', previous]]);
  }
});

test('changed account and failed ownership lookup cannot attempt a status write', async () => {
  for (const options of [{ user: 'another' }, { ownerError: { message: 'denied' } }]) {
    const f = fixture(options);
    await assert.rejects(() => f.load('packagePublication').setPackagePublication('package', 'caterer', 'owner', 'unpublished', 'published'));
    assert.ok(!f.calls.some(call => call.patch));
  }
});

test('stale status, denied writes and unknown transitions never report success', async () => {
  for (const options of [{ rows: [] }, { rows: null }, { readError: { message: 'denied' } }]) {
    const f = fixture(options);
    await assert.rejects(() => f.load('packagePublication').setPackagePublication('package', 'caterer', 'owner', 'unpublished', 'published'));
  }
  const f = fixture();
  await assert.rejects(() => f.load('packagePublication').setPackagePublication('package', 'caterer', 'owner', 'unknown', 'published'));
  assert.equal(f.calls.length, 0);
});

test('booking recheck binds package to caterer and explicit published status', async () => {
  const f = fixture();
  await f.load('packagePublication').requirePublishedPackage('package', 'caterer');
  assert.deepEqual(f.calls[0].filters, [['id', 'package'], ['caterer_id', 'caterer'], ['publication_status', 'published']]);
  for (const options of [{ packageData: null }, { packageData: { publication_status: 'archived' } }, { readError: { message: 'network failure' } }]) {
    const denied = fixture(options);
    await assert.rejects(() => denied.load('packagePublication').requirePublishedPackage('package', 'caterer'));
  }
});

const catalog = ['published', 'unpublished', 'archived'].map((publication_status, i) => ({
  id: String(i), caterer_id: 'caterer', publication_status, name: 'Package', price: 100, guest_capacity: 10,
}));
test('marketplace excludes hidden packages even when history permissions return them', async () => {
  const f = fixture({ packages: catalog });
  const result = await f.load('caterers').fetchApprovedCaterers();
  assert.deepEqual(Array.from(result[0].packages, pkg => pkg.id), ['0']);
  assert.ok(f.calls[0].filters.some(([key,value]) => key === 'packages.publication_status' && value === 'published'));
});

test('comparison hides unpublished/archived packages but retains unavailable placeholders', async () => {
  const f = fixture({ packages: catalog });
  const rows = await f.load('packageComparison').loadComparisonPackages(['0','1','2']);
  assert.equal(rows[0].package.id, '0');
  assert.equal(rows[1].package, null); assert.equal(rows[2].package, null);
  assert.ok(f.calls[0].filters.some(([key,value]) => key === 'publication_status' && value === 'published'));
});

test('saved packages hide private listings while preserving removable bookmarks', async () => {
  const f = fixture({ packages: catalog });
  const rows = await f.load('packageBookmarks').loadSavedPackageDetails(catalog.map(pkg => ({ package_id: pkg.id, created_at: 'date' })));
  assert.equal(rows.length, 3); assert.equal(rows[0].package.id, '0');
  assert.equal(rows[1].package, null); assert.equal(rows[2].package, null);
  assert.ok(f.calls[0].filters.some(([key,value]) => key === 'publication_status' && value === 'published'));
});

test('management creates unpublished, edits without resetting status, and archives instead of deleting', () => {
  const ui = read('caterconnect-mobile/app/(caterer)/packages.tsx');
  assert.ok(ui.includes("insert({ ...payload, publication_status: 'unpublished' })"));
  const payload = ui.split('const payload = {')[1].split('};')[0];
  assert.ok(!payload.includes('publication_status'));
  assert.ok(!ui.includes(".delete()"));
  for (const label of ['Publish', 'Unpublish', 'Archive', 'Archived packages', 'Restore as unpublished']) assert.ok(ui.includes(label));
  assert.ok(ui.includes("view === 'archived'"));
  assert.ok(ui.includes(".eq('caterer_id', catererData.id).eq('publication_status', editing.publication_status)"));
});

test('wizard and detail discovery are filtered while booking-history queries stay unfiltered', () => {
  const wizard = read('caterconnect-mobile/app/(tabs)/book/[catererId].tsx');
  assert.ok(wizard.includes(".eq('publication_status', 'published')"));
  const submit = wizard.slice(wizard.indexOf('const handleSubmit = async'));
  assert.ok(submit.indexOf('await requirePublishedPackage(selectedPkg.id, caterer.id)') < submit.indexOf("supabase.from('bookings').insert"));
  assert.ok(read('caterconnect-mobile/app/(tabs)/caterer/[catererId].tsx').includes(".eq('publication_status', 'published')"));
  for (const file of ['caterconnect-mobile/app/(tabs)/bookings.tsx', 'caterconnect-mobile/app/(caterer)/bookings.tsx', 'caterconnect-mobile/screens/auth/ChatScreen.tsx']) {
    assert.ok(!read(file).includes('publication_status'), file);
  }
});

const sql = read('supabase/proposals/package_publication_proposal.sql');
test('guarded SQL preserves existing visibility and defaults only future packages to unpublished', () => {
  assert.ok(sql.includes("RAISE EXCEPTION 'PROPOSAL ONLY:"));
  assert.ok(sql.indexOf("NOT NULL DEFAULT 'published'") < sql.indexOf("SET DEFAULT 'unpublished'"));
  assert.ok(!/\b(?:DELETE FROM|UPDATE)\s+public\.(?:packages|bookings)\b/i.test(sql));
  assert.ok(!/\b(?:DROP|ALTER)\s+POLICY\b/i.test(sql));
  assert.ok(sql.includes('Existing package quantity, booking, payment, daily or monthly trigger function changed'));
  assert.ok(sql.includes('tgtype IN (5,7)') && sql.includes("c.confdeltype='a'"));
});

test('SQL read restriction intersects existing policies; history helper is actor-bound and narrow', () => {
  assert.ok(sql.includes('AS RESTRICTIVE FOR SELECT TO PUBLIC'));
  for (const verb of ['INSERT', 'UPDATE', 'DELETE']) assert.ok(sql.includes(`AS RESTRICTIVE FOR ${verb} TO anon,authenticated`));
  const helper = sql.split('CREATE FUNCTION public.cc_package_publish1_can_read_history')[1].split('$$;')[0];
  assert.ok(helper.includes("RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''"));
  assert.ok(helper.includes('auth.uid() IS NOT NULL') && helper.includes('b.customer_id=auth.uid()'));
  assert.ok(!helper.includes('FROM public.packages') && !helper.includes('EXECUTE'));
  assert.ok(sql.includes('NEW.id IS DISTINCT FROM OLD.id OR NEW.caterer_id IS DISTINCT FROM OLD.caterer_id'));
});

test('SQL eligibility covers first booking/reentry/reassignment and serializes publication races', () => {
  const body = sql.split('CREATE FUNCTION public.cc_package_publish1_booking_guard()')[1].split('$$;')[0];
  assert.ok(body.includes("IF TG_OP='INSERT' THEN needs_check:=true;"));
  assert.ok(body.includes('NEW.package_id IS DISTINCT FROM OLD.package_id'));
  assert.ok(body.includes('NEW.caterer_id IS DISTINCT FROM OLD.caterer_id'));
  assert.ok(body.includes('AND NOT coalesce(OLD.status::text IN'));
  assert.ok(body.indexOf('IF NOT needs_check THEN RETURN NEW;') < body.indexOf('IF NEW.package_id IS NULL'));
  assert.ok(body.indexOf('FOR NO KEY UPDATE;') < body.indexOf('FROM public.packages WHERE id=NEW.package_id FOR SHARE;'));
  assert.ok(body.includes("publication<>'published'"));
  assert.ok(!body.includes('auth.role') && !body.includes('current_user'));
  assert.ok(sql.includes('AFTER INSERT OR UPDATE ON public.bookings'));
  assert.ok(sql.includes('ENABLE ALWAYS TRIGGER cc_package_publish1_booking_guard'));
});

test('SQL protects every referenced package from DELETE and handles TRUNCATE independently', () => {
  const body = sql.split('CREATE FUNCTION public.cc_package_publish1_delete_guard()')[1].split('$$;')[0];
  assert.ok(body.includes("IF TG_OP='TRUNCATE' THEN"));
  assert.ok(body.includes('IF EXISTS(SELECT 1 FROM public.bookings WHERE package_id=OLD.id)'));
  assert.ok(!body.includes('status::text'));
  assert.ok(sql.includes('BEFORE DELETE ON public.packages'));
  assert.ok(sql.includes('BEFORE TRUNCATE ON public.packages'));
});
