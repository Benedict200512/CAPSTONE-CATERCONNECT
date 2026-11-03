// Real local PostgreSQL integration tests. Never reads project connection secrets.
// Application tables/functions/policies/grants come from the four catalog exports.
// auth.users is only a referenced UUID anchor, not a mock Auth authorization API.
// Block-calendar and private quota tracker DDL come from their installed scripts.
// The user confirmed source role OID 16485 = authenticated on 2026-10-19.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const metadata = name => JSON.parse(read(`supabase/metadata/${name}.json`));
const pkg = metadata('package_feature_metadata');
const core = metadata('caterer_booking_schema_metadata');
const support = metadata('package_supporting_metadata');
const transfer = metadata('refund_transfer_submissions_metadata').table;
// The first two exports contain a second layer of escaped newlines.
const decode = s => s.replace(/\\r/g, '\r').replace(/\\n/g, '\n');
const unescapeExport = x => JSON.parse(JSON.stringify(x), (k, v) => typeof v === 'string' ? decode(v) : v);
const p = unescapeExport(pkg), b = unescapeExport(core);
const qi = s => '"' + s.replace(/"/g, '""') + '"';
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";
const role = s => s.toLowerCase() === 'public' ? 'PUBLIC' : qi(s);
const roleNames = { '16485': 'authenticated' };
const policySQL = (t, policy) => {
  if (policy.definition) return policy.definition;
  const cmd = { r: 'SELECT', a: 'INSERT', w: 'UPDATE', d: 'DELETE', '*': 'ALL' };
  const roles = policy.roles.map(r => {
    if (/^\d+$/.test(r)) { assert.ok(roleNames[r], `Unmapped policy role ${r}`); return roleNames[r]; }
    return r;
  });
  return `CREATE POLICY ${qi(policy.name || policy.policyname)} ON public.${qi(t)} AS ${
    policy.permissive === false || policy.permissive === 'RESTRICTIVE' ? 'RESTRICTIVE' : 'PERMISSIVE'
  } FOR ${cmd[policy.command] || policy.cmd} TO ${roles.map(role).join(',')}${
    (policy.using || policy.qual) ? ` USING (${policy.using || policy.qual})` : ''}${
    policy.with_check ? ` WITH CHECK (${policy.with_check})` : ''};`;
};
const packageTable = { table: 'packages', ...p.security, columns: p.columns, constraints: p.constraints,
  indexes: p.indexes, triggers: p.triggers, raw_table_acl: p.security.table_acl };
const tables = [packageTable, ...b.tables, ...support.tables,
  { ...transfer, table: 'refund_transfer_submissions', table_grants: transfer.grants }];
const functions = new Map();
for (const f of [...p.function_definitions, ...b.function_definitions, ...support.function_definitions]) {
  const def = f.definition.replace(/\r\n/g, '\n');
  // Deduplicate by the qualified declaration (not source database OIDs).
  const declaration = def.slice(0, def.indexOf('\n'));
  if (functions.has(declaration)) assert.equal(functions.get(declaration).definition.replace(/\r\n/g, '\n'), def);
  else functions.set(declaration, f);
}
for (const t of transfer.triggers) functions.set(t.function_definition.split('\n')[0], {
  definition: t.function_definition, owner: t.function_owner, acl: null,
});
const aclLetters = { a: 'INSERT', r: 'SELECT', w: 'UPDATE', d: 'DELETE', D: 'TRUNCATE', x: 'REFERENCES', t: 'TRIGGER', m: 'MAINTAIN', X: 'EXECUTE' };
function aclSQL(acl, kind, object) {
  let sql = `REVOKE ALL ON ${kind} ${object} FROM PUBLIC,anon,authenticated,service_role;\n`;
  for (const item of acl || []) {
    const [, grantee, privileges] = item.match(/^(.*?)=([^/]*)\//);
    let previous;
    for (const letter of privileges) {
      if (letter === '*') { sql += `GRANT ${previous} ON ${kind} ${object} TO ${role(grantee || 'public')} WITH GRANT OPTION;\n`; continue; }
      previous = aclLetters[letter]; assert.ok(previous, `Unknown ACL ${letter}`);
      sql += `GRANT ${previous} ON ${kind} ${object} TO ${role(grantee || 'public')};\n`;
    }
  }
  return sql;
}
const bin = process.env.CC_TEST_POSTGRES_BIN || 'C:\\Program Files\\PostgreSQL\\18\\bin';
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-package-pg-'));
const data = path.join(scratch, 'data');
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^PG/i.test(key)) delete env[key];
const options = { env, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024 };
const run = (name, args, extra = {}) => execFileSync(path.join(bin, name + '.exe'), args, { ...options, ...extra });
let port, started = false, passed = 0;
const args = () => ['-X', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'];
const sql = input => run('psql', args(), { input });
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const owner = uid(1), other = uid(2), customer = uid(3), outsider = uid(4);
const cat = uid(11), cat2 = uid(12), pack = uid(21), pack2 = uid(22);
const oldAccepted = uid(31), oldCompleted = uid(32);
const auth = (actor, dbRole = 'authenticated') => `SET LOCAL ROLE ${qi(dbRole)}; SELECT set_config('request.jwt.claim.sub',${lit(actor)},true); SELECT set_config('request.jwt.claim.role',${lit(dbRole)},true);`;
const date = n => `(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date + ${n}`;
const booking = (id, state = 'pending', day = 100, packageId = pack, catererId = cat) => `INSERT INTO public.bookings(id,customer_id,caterer_id,package_id,event_date,guest_count,total_cost,downpayment_amount,status) VALUES (${lit(id)},${lit(customer)},${lit(catererId)},${lit(packageId)},${date(day)},10,12000,1200,${lit(state)});`;
const ensure = (condition, message) => `SELECT test.assert((${condition}),${lit(message)});`;
const fails = (statement, code = '23514', message = '') => `DO $test$ BEGIN BEGIN ${statement} RAISE EXCEPTION 'Expected rejection did not occur'; EXCEPTION WHEN SQLSTATE '${code}' THEN ${message ? `IF position(${lit(message)} IN SQLERRM)=0 THEN RAISE; END IF;` : 'NULL;'} END; END $test$;`;
function check(name, statement) { sql(`BEGIN; ${statement} ROLLBACK;`); passed++; console.log('PASS ' + name); }
function fixture() {
  const roles = new Set(['anon','authenticated','service_role','supabase_auth_admin']);
  for (const t of tables) {
    for (const g of t.table_grants || []) roles.add(g.grantee);
    for (const c of t.columns) for (const g of c.column_grants || []) roles.add(g.grantee);
    for (const a of t.raw_table_acl || []) roles.add(a.split('=')[0]);
  }
  for (const f of functions.values()) { roles.add(f.owner); for (const a of f.acl || []) roles.add(a.split('=')[0]); }
  let text = [...roles].filter(r => r && !['postgres','public'].includes(r.toLowerCase())).map(r => `CREATE ROLE ${qi(r)} NOLOGIN${r==='service_role'?' BYPASSRLS':''};`).join('\n');
  text += `CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin; CREATE SCHEMA test; GRANT USAGE ON SCHEMA public,auth,test TO anon,authenticated,service_role; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION test.assert(ok boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',msg; END IF; END $$;`;
  for (const t of tables) {
    assert.equal(t.owner, 'postgres');
    text += `CREATE TABLE public.${qi(t.table)} (${t.columns.map(c => {
      assert.ok(!c.generated && !c.identity, 'Review generated/identity column');
      const def = c.default_or_generated_expression ?? c.default;
      return `${qi(c.name)} ${c.type}${def ? ` DEFAULT ${def}` : ''}${c.nullable ? '' : ' NOT NULL'}`;
    }).join(',')});\n`;
  }
  // Establish every referenced unique key before installing cross-table FKs.
  for (const foreign of [false, true]) for (const t of tables) for (const c of t.constraints) {
    if (/^FOREIGN KEY/i.test(c.definition) === foreign) text += `ALTER TABLE public.${qi(t.table)} ADD CONSTRAINT ${qi(c.name)} ${c.definition};\n`;
  }
  for (const f of functions.values()) text += f.definition + ';\n';
  for (const f of functions.values()) {
    const signature = f.definition.match(/FUNCTION\s+([\w.]+)\(/i)[1];
    // Query the newly parsed signature, avoiding exported argument-default text.
    text += `DO $acl$ DECLARE s text; BEGIN FOR s IN SELECT oid::regprocedure::text FROM pg_proc WHERE pronamespace=${lit(signature.split('.')[0])}::regnamespace AND proname=${lit(signature.split('.')[1])} LOOP EXECUTE 'ALTER FUNCTION '||s||' OWNER TO ${f.owner}'; END LOOP; END $acl$;\n`;
    if (f.acl) {
      // All exported overloaded non-trigger helpers have explicit signatures.
      const identity = f.signature?.includes('.') ? f.signature : `${signature.split('.')[0]}.${f.signature}`;
      text += aclSQL(f.acl, 'FUNCTION', identity);
    }
  }
  for (const t of tables) {
    text += `ALTER TABLE public.${qi(t.table)} ${t.rls_enabled ? 'ENABLE' : 'DISABLE'} ROW LEVEL SECURITY;`;
    if (t.rls_forced) text += `ALTER TABLE public.${qi(t.table)} FORCE ROW LEVEL SECURITY;`;
    const grants = t.table_grants;
    if (t.raw_table_acl) text += aclSQL(t.raw_table_acl, 'TABLE', `public.${qi(t.table)}`);
    else if (grants) {
      text += `REVOKE ALL ON public.${qi(t.table)} FROM PUBLIC,anon,authenticated,service_role;`;
      for (const g of grants) text += `GRANT ${g.privilege} ON public.${qi(t.table)} TO ${role(g.grantee)}${g.grantable ? ' WITH GRANT OPTION' : ''};`;
    }
    for (const c of t.columns) for (const g of c.column_grants || []) text += `GRANT ${g.privilege}(${qi(c.name)}) ON public.${qi(t.table)} TO ${role(g.grantee)}${g.grantable ? ' WITH GRANT OPTION' : ''};`;
    for (const policy of t.policies) text += policySQL(t.table, policy) + '\n';
    for (const i of t.indexes) {
      const definition = typeof i === 'string' ? i : i.definition;
      const name = typeof i === 'string' ? i.match(/INDEX\s+(\w+)/i)[1] : i.name;
      if (!t.constraints.some(c => c.name === name)) text += definition + ';\n';
    }
    for (const trigger of t.triggers) {
      text += trigger.definition + ';\n';
      const mode = { O: 'ENABLE', A: 'ENABLE ALWAYS', R: 'ENABLE REPLICA', D: 'DISABLE' }[trigger.enabled_code || trigger.enabled];
      assert.ok(mode); text += `ALTER TABLE public.${qi(t.table)} ${mode} TRIGGER ${qi(trigger.name)};\n`;
    }
  }
  // Installed implementation support, copied from source, never a guard stub.
  const availability = read('supabase/proposals/availability_daily_capacity_EXECUTE.sql');
  text += availability.slice(availability.indexOf('CREATE TABLE public.caterer_blocked_dates ('), availability.indexOf('CREATE FUNCTION public.cc_availability1_booking_guard()'));
  text += availability.slice(availability.indexOf('CREATE FUNCTION public.cc_availability1_block_guard()'), availability.indexOf('-- Preserve signature and row shape;'));
  const monthly = read('supabase/proposals/monthly_booking_quota_EXECUTE.sql');
  text += 'CREATE SCHEMA cc_monthly1_private; REVOKE ALL ON SCHEMA cc_monthly1_private FROM PUBLIC,anon,authenticated;';
  text += monthly.match(/CREATE TABLE cc_monthly1_private.touched_bookings[^;]+;/)[0];
  text += 'REVOKE ALL ON cc_monthly1_private.touched_bookings FROM PUBLIC,anon,authenticated;';
  return text;
}
function asyncSQL(input, application) {
  const child = spawn(path.join(bin, 'psql.exe'), args(), { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', d => stdout += d); child.stderr.on('data', d => stderr += d);
  const done = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr })); });
  child.stdin.end(`SET application_name=${lit(application)}; SET statement_timeout='12s'; ${input}`);
  return done;
}
async function waitState(application, wait) {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    if (sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=${lit(application)} AND (${wait}));`).trim() === 't') return;
    await new Promise(r => setTimeout(r, 40));
  }
  throw new Error(`Timed out waiting for ${application}: ${wait}`);
}
async function race(name, first, second, expectSecondFailure) {
  const a = asyncSQL(`BEGIN; ${first} SELECT pg_sleep(2); COMMIT;`, 'cc_package_a');
  await waitState('cc_package_a', "wait_event='PgSleep'");
  const bb = asyncSQL(`BEGIN; ${second} COMMIT;`, 'cc_package_b');
  await waitState('cc_package_b', "wait_event_type='Lock'");
  const [ra, rb] = await Promise.all([a, bb]);
  assert.equal(ra.code, 0, ra.stderr);
  if (expectSecondFailure) { assert.notEqual(rb.code, 0); assert.match(rb.stderr, expectSecondFailure); }
  else assert.equal(rb.code, 0, rb.stderr);
  passed++; console.log('PASS ' + name + ' (observed second session waiting on database lock)');
}
(async () => {
  port = await new Promise((resolve, reject) => { const s = net.createServer(); s.on('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  try {
    run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
    started = true;
    run('pg_ctl', ['-D', data, '-l', path.join(scratch, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start'], { stdio: 'ignore' });
    assert.equal(path.resolve(sql('SHOW data_directory;').trim()).toLowerCase(), path.resolve(data).toLowerCase());
    console.log('Isolated PostgreSQL ' + sql('SHOW server_version;').trim());
    sql(fixture()); console.log('Imported four metadata exports; verified policy role mapping 16485=authenticated.');
    let privilegeAssertions = '';
    for (const t of tables) for (const c of t.columns) {
      for (const e of c.effective_privileges || []) for (const [priv, expected] of Object.entries(e.privileges || Object.fromEntries(['select','insert','update','references'].filter(k => k in e).map(k => [k,e[k]])))) {
        if (expected !== null) privilegeAssertions += ensure(`has_column_privilege(${lit(e.role)},${lit('public.'+t.table)},${lit(c.name)},${lit(priv)}) IS ${expected ? 'TRUE' : 'FALSE'}`, `Imported privilege ${t.table}.${c.name} ${e.role} ${priv}`);
      }
    }
    sql(privilegeAssertions);
    passed++; console.log('PASS imported column privileges match collected effective privileges');
    sql(`INSERT INTO auth.users(id) VALUES (${lit(owner)}),(${lit(other)}),(${lit(customer)}),(${lit(outsider)}); INSERT INTO public.profiles(id,role,full_name,email) VALUES (${lit(owner)},'caterer','Owner','owner@example.test'),(${lit(other)},'caterer','Other','other@example.test'),(${lit(customer)},'customer','Customer','customer@example.test'),(${lit(outsider)},'customer','Outsider','outsider@example.test'); INSERT INTO public.system_settings(id) VALUES ('main');`);
    for (const plan of support.subscription_plan_configuration) sql(`INSERT INTO public.subscription_plans(id,name,price,max_packages) VALUES (${lit(plan.id)},${lit(plan.id)},0,${plan.max_packages === null ? 'NULL' : plan.max_packages});`);
    sql(`INSERT INTO public.caterers(id,user_id,business_name,verification_status,subscription_plan,subscription_expires_at) VALUES (${lit(cat)},${lit(owner)},'Test One','approved','free',NULL),(${lit(cat2)},${lit(other)},'Test Two','approved','premium',now()+interval '1 year'); INSERT INTO public.packages(id,caterer_id,tier,name,price,guest_capacity) VALUES (${lit(pack)},${lit(cat)},'bronze','Existing',12000,10),(${lit(pack2)},${lit(cat2)},'bronze','Other',24000,20); ${booking(oldAccepted, 'confirmed', 20)} ${booking(oldCompleted, 'completed', 21)}`);
    const before = sql(`SELECT jsonb_build_object('packages',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.packages p),'bookings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM public.bookings b));`).trim();
    const proposalPath = 'supabase/proposals/package_publication_proposal.sql';
    const proposal = read(proposalPath);
    const stop = /DO \$\$ BEGIN\r?\n  RAISE EXCEPTION 'PROPOSAL ONLY: package publishing requires separate execution approval';\r?\nEND \$\$;\r?\n/;
    assert.equal([...proposal.matchAll(new RegExp(stop.source, 'g'))].length, 1);
    let failed;
    try { sql(proposal); } catch (e) { failed = e; }
    assert.ok(failed && String(failed.stderr).includes('PROPOSAL ONLY'));
    assert.equal(sql("SELECT to_regnamespace('cc_package_publish1_private') IS NULL;").trim(),'t');
    passed++; console.log('PASS proposal stop aborts installation atomically');
    const execution = proposal.replace(stop, '');
    sql(execution);
    passed++; console.log('PASS complete installation and original-catalog preservation assertions');
    assert.equal(sql(`SELECT jsonb_build_object('packages',(SELECT jsonb_agg(to_jsonb(p)-'publication_status' ORDER BY id) FROM public.packages p),'bookings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM public.bookings b));`).trim(), before);
    passed++; console.log('PASS original package references/prices/capacities and all booking fields unchanged');
    if (process.argv.includes('--internal-notes')) {
      await require('./test-booking-internal-notes-postgres.cjs')({ sql, check, race, ensure, fails, auth, lit, uid,
        owner, other, customer, outsider, cat, cat2, pack, oldAccepted, oldCompleted, booking, read });
    }
    if (process.argv.includes('--reports')) {
      await require('./test-caterer-reports-postgres.cjs')({sql,check,ensure,fails,auth,lit,uid,
        owner,other,customer,outsider,cat,pack,booking,read});
    }
    if (process.argv.includes('--invoice-payment')) {
      await require('./test-xendit-invoice-postgres.cjs')({sql,check,ensure,fails,auth,lit,
        owner,customer,cat,pack,oldAccepted,read});
    }
    if (process.argv.includes('--pricing-math')) {
      await require('./test-fixed-pricing-math-postgres.cjs')({check,fails,read});
    }
    check('existing packages published; new packages default unpublished', `${ensure("(SELECT bool_and(publication_status='published') FROM public.packages)",'old visibility')} ${auth(owner)} INSERT INTO public.packages(caterer_id,tier,name,price,guest_capacity) VALUES (${lit(cat)},'bronze','New',100,10); ${ensure("(SELECT publication_status='unpublished' FROM public.packages WHERE name='New')",'new default')}`);
    for (const status of ['published','unpublished','archived']) {
      check(`owner can set ${status}; foreign owner cannot update`, `${auth(owner)} UPDATE public.packages SET publication_status=${lit(status)} WHERE id=${lit(pack)}; ${ensure(`(SELECT publication_status=${lit(status)} FROM public.packages WHERE id=${lit(pack)})`,'owner status')} ${auth(other)} WITH updated AS (UPDATE public.packages SET publication_status='published' WHERE id=${lit(pack)} RETURNING id) ${ensure('(SELECT count(*)=0 FROM updated)','foreign owner wrote')}`);
    }
    check('archive restores to unpublished; only three status values accepted', `${auth(owner)} UPDATE public.packages SET publication_status='archived' WHERE id=${lit(pack)}; UPDATE public.packages SET publication_status='unpublished' WHERE id=${lit(pack)}; ${ensure(`(SELECT publication_status='unpublished' FROM public.packages WHERE id=${lit(pack)})`,'restore')} ${fails(`UPDATE public.packages SET publication_status='draft' WHERE id=${lit(pack)};`)}`);
    check('package identity and caterer assignment immutable even for service role', `${auth(owner,'service_role')} ${fails(`UPDATE public.packages SET caterer_id=${lit(cat2)} WHERE id=${lit(pack)};`,'42501')} ${fails(`UPDATE public.packages SET id=${lit(uid(999))} WHERE id=${lit(pack)};`,'42501')}`);
    for (const status of ['unpublished','archived']) {
      check(`${status}: public/outsider cannot discover; participants retain history`, `UPDATE public.packages SET publication_status=${lit(status)} WHERE id=${lit(pack)}; ${auth(outsider)} ${ensure(`NOT EXISTS(SELECT 1 FROM public.packages WHERE id=${lit(pack)})`,'outsider saw hidden')} ${auth('','anon')} ${ensure(`NOT EXISTS(SELECT 1 FROM public.packages WHERE id=${lit(pack)})`,'anon saw hidden')} ${auth(customer)} ${ensure(`EXISTS(SELECT 1 FROM public.bookings b JOIN public.packages p ON p.id=b.package_id WHERE b.id=${lit(oldCompleted)})`,'history join unavailable')} ${ensure(`NOT EXISTS(SELECT 1 FROM public.packages WHERE id=${lit(pack)} AND publication_status='published')`,'discovery filter leaked history')} ${auth(owner)} ${ensure(`EXISTS(SELECT 1 FROM public.packages WHERE id=${lit(pack)})`,'owner lost hidden package')}`);
      check(`${status}: reject new booking, first confirmation and reconfirmation`, `${booking(uid(41))} ${booking(uid(42),'cancelled',101)} UPDATE public.packages SET publication_status=${lit(status)} WHERE id=${lit(pack)}; ${auth(customer)} ${fails(booking(uid(43)), '23514', 'not published')} ${auth(owner)} ${fails(`UPDATE public.bookings SET status='confirmed' WHERE id=${lit(uid(41))};`,'23514','not published')} ${fails(`UPDATE public.bookings SET status='confirmed' WHERE id=${lit(uid(42))};`,'23514','not published')} ${ensure(`(SELECT count(*)=2 FROM public.bookings WHERE id IN (${lit(uid(41))},${lit(uid(42))}) AND status IN ('pending','cancelled'))`,'failed confirmation changed row')}`);
    }
    check('published booking eligible; mismatched caterer/package rejected', `${auth(customer)} ${booking(uid(44))} ${ensure(`EXISTS(SELECT 1 FROM public.bookings WHERE id=${lit(uid(44))})`,'published insert')} ${fails(booking(uid(45),'pending',100,pack2,cat),'23514','not published')}`);
    check('package reassignment rechecks publication', `${booking(uid(46))} UPDATE public.packages SET publication_status='archived' WHERE id=${lit(pack2)}; ${auth(owner,'service_role')} ${fails(`UPDATE public.bookings SET package_id=${lit(pack2)},caterer_id=${lit(cat2)} WHERE id=${lit(uid(46))};`,'23514','not published')}`);
    check('accepted hidden package retains payment, completion and notification workflows', `UPDATE public.packages SET publication_status='archived' WHERE id=${lit(pack)}; ${auth(owner)} UPDATE public.bookings SET status='awaiting_payment',payment_receipt_url='local-test' WHERE id=${lit(oldAccepted)}; ${auth(owner,'service_role')} UPDATE public.bookings SET status='paid',payment_verified_at=now(),payment_reference='local-reference' WHERE id=${lit(oldAccepted)}; UPDATE public.bookings SET status='ongoing' WHERE id=${lit(oldAccepted)}; UPDATE public.bookings SET status='completed' WHERE id=${lit(oldAccepted)}; ${ensure(`(SELECT status='completed' AND total_cost=12000 FROM public.bookings WHERE id=${lit(oldAccepted)})`,'payment/completion changed amount')} ${ensure(`EXISTS(SELECT 1 FROM public.notifications WHERE booking_id=${lit(oldAccepted)} AND type='payment_verified')`,'payment notification missing')}`);
    check('hidden accepted package cancellation/refund evidence/dispute resolution remain functional', `UPDATE public.packages SET publication_status='unpublished' WHERE id=${lit(pack)}; ${auth(owner,'service_role')} UPDATE public.bookings SET status='cancelled',cancelled_at=now(),refund_status='pending',refund_amount=1200 WHERE id=${lit(oldAccepted)}; INSERT INTO public.refund_transfer_submissions(booking_id,caterer_id,transfer_reference,proof_path) VALUES (${lit(oldAccepted)},${lit(cat)},'test-reference','local-proof'); ${auth(customer)} INSERT INTO public.refund_disputes(booking_id,customer_id,reason) VALUES (${lit(oldAccepted)},${lit(customer)},'Test refund investigation reason'); ${auth(owner,'service_role')} UPDATE public.bookings SET refund_status='processed',refunded_at=now() WHERE id=${lit(oldAccepted)}; ${ensure(`(SELECT status='resolved' FROM public.refund_disputes WHERE booking_id=${lit(oldAccepted)})`,'refund not resolved')}`);
    check('Free quantity limit still counts archived packages; fourth insert rejected', `${auth(owner)} INSERT INTO public.packages(caterer_id,tier,name,price,guest_capacity) VALUES (${lit(cat)},'bronze','Two',100,10),(${lit(cat)},'bronze','Three',100,10); UPDATE public.packages SET publication_status='archived' WHERE caterer_id=${lit(cat)}; ${fails(`INSERT INTO public.packages(caterer_id,tier,name,price,guest_capacity) VALUES (${lit(cat)},'bronze','Four',100,10);`,'P0001','Package limit reached')}`);
    check('unlimited package plan retains existing quantity behavior', `${auth(other)} INSERT INTO public.packages(caterer_id,tier,name,price,guest_capacity) SELECT ${lit(cat2)},'bronze','Unlimited '||n,100,10 FROM generate_series(1,5) n; ${ensure(`(SELECT count(*)=6 FROM public.packages WHERE caterer_id=${lit(cat2)})`,'unlimited capped')}`);
    check('history blocks privileged physical DELETE and TRUNCATE; unused package delete remains allowed', `${auth(owner,'service_role')} ${fails(`DELETE FROM public.packages WHERE id=${lit(pack)};`,'23514','booking history')} ${fails('TRUNCATE public.packages CASCADE;',process.argv.includes('--internal-notes') ? '42501' : '23514')} INSERT INTO public.packages(id,caterer_id,tier,name,price,guest_capacity) VALUES (${lit(uid(25))},${lit(cat2)},'bronze','Unused',100,10); DELETE FROM public.packages WHERE id=${lit(uid(25))}; ${ensure(`NOT EXISTS(SELECT 1 FROM public.packages WHERE id=${lit(uid(25))})`,'unused delete blocked')}`);
    check('completed booking retention, identity/month assignment and cascade protections remain', `${auth(owner,'service_role')} ${fails(`DELETE FROM public.bookings WHERE id=${lit(oldCompleted)};`,'23514')} ${fails(`UPDATE public.bookings SET quota_month=quota_month+31 WHERE id=${lit(oldCompleted)};`,'42501')} ${fails(`UPDATE public.bookings SET caterer_id=${lit(cat2)} WHERE id=${lit(oldCompleted)};`,'42501')} RESET ROLE; ${fails(`DELETE FROM auth.users WHERE id=${lit(customer)};`,'23514')}`);
    check('blocked date still rejects confirmation without changing quota cache', `${booking(uid(51),'pending',130)} ${auth(owner)} INSERT INTO public.caterer_blocked_dates(caterer_id,event_date) VALUES (${lit(cat)},${date(130)}); ${fails(`UPDATE public.bookings SET status='confirmed' WHERE id=${lit(uid(51))};`,'23514','blocked')} ${ensure(`(SELECT monthly_booking_count=2 FROM public.caterers WHERE id=${lit(cat)})`,'cache changed on rejection')}`);
    check('daily committed states fill slots; cancelled/rejected do not', `UPDATE public.caterers SET subscription_plan='premium',subscription_expires_at=now()+interval '1 year' WHERE id=${lit(cat)}; ${booking(uid(52),'confirmed',140)} ${booking(uid(53),'cancelled',140)} ${booking(uid(54),'rejected',140)} ${auth(owner)} ${fails(`UPDATE public.bookings SET status='confirmed' WHERE id=${lit(uid(53))};`,'23514','daily booking limit')} UPDATE public.bookings SET status='cancelled' WHERE id=${lit(uid(52))}; UPDATE public.bookings SET status='confirmed' WHERE id=${lit(uid(53))};`);
    check('monthly quota rejects sixth commitment, releases cancellation, preserves completed count', `${booking(uid(61),'confirmed',151)} ${booking(uid(62),'confirmed',152)} ${booking(uid(63),'confirmed',153)} ${booking(uid(64),'pending',154)} ${auth(owner)} ${fails(`UPDATE public.bookings SET status='confirmed' WHERE id=${lit(uid(64))};`,'23514','Monthly accepted-booking limit')} UPDATE public.bookings SET status='cancelled' WHERE id=${lit(uid(61))}; UPDATE public.bookings SET status='confirmed' WHERE id=${lit(uid(64))}; ${ensure(`(SELECT monthly_booking_count=5 FROM public.caterers WHERE id=${lit(cat)})`,'incorrect monthly usage')}`);
    // Real overlapping sessions. All rows are disposable fixture records.
    sql(booking(uid(71),'pending',171));
    await race('unpublish first serializes and rejects waiting confirmation', `UPDATE public.packages SET publication_status='unpublished' WHERE id=${lit(pack)};`, `${auth(owner)} UPDATE public.bookings SET status='confirmed' WHERE id=${lit(uid(71))};`, /not published/);
    check('losing concurrent confirmation rolled back booking/cache/notifications', `${ensure(`(SELECT status='pending' FROM public.bookings WHERE id=${lit(uid(71))})`,'race changed booking')} ${ensure(`(SELECT monthly_booking_count=2 FROM public.caterers WHERE id=${lit(cat)})`,'race changed cache')} ${ensure(`NOT EXISTS(SELECT 1 FROM public.notifications WHERE booking_id=${lit(uid(71))} AND type='booking_approved')`,'race notified failed confirmation')}`);
    sql(`UPDATE public.packages SET publication_status='published' WHERE id=${lit(pack)};`);
    await race('confirmation first commits before waiting unpublish', `${auth(owner)} UPDATE public.bookings SET status='confirmed' WHERE id=${lit(uid(71))};`, `UPDATE public.packages SET publication_status='unpublished' WHERE id=${lit(pack)};`);
    check('accepted booking survives later unpublish', `${ensure(`(SELECT status='confirmed' FROM public.bookings WHERE id=${lit(uid(71))})`,'lost accepted race')} ${ensure(`(SELECT publication_status='unpublished' FROM public.packages WHERE id=${lit(pack)})`,'unpublish lost')}`);
    sql(`DELETE FROM public.bookings WHERE id=${lit(uid(71))}; UPDATE public.packages SET publication_status='published' WHERE id=${lit(pack)}; UPDATE public.caterers SET subscription_plan='premium',subscription_expires_at=now()+interval '1 year' WHERE id=${lit(cat)}; ${booking(uid(72),'pending',172)} ${booking(uid(73),'pending',172)}`);
    await race('two concurrent confirmations cannot exceed daily capacity', `${auth(owner)} UPDATE public.bookings SET status='confirmed' WHERE id=${lit(uid(72))};`, `${auth(owner)} UPDATE public.bookings SET status='confirmed' WHERE id=${lit(uid(73))};`, /daily booking limit/);
    sql(`DELETE FROM public.bookings WHERE id IN (${lit(uid(72))},${lit(uid(73))}); UPDATE public.caterers SET subscription_plan='free',subscription_expires_at=NULL WHERE id=${lit(cat)}; ${booking(uid(74),'confirmed',174)} ${booking(uid(75),'confirmed',175)} ${booking(uid(76),'pending',176)} ${booking(uid(77),'pending',177)}`);
    await race('two concurrent confirmations cannot exceed monthly quota', `${auth(owner)} UPDATE public.bookings SET status='confirmed' WHERE id=${lit(uid(76))};`, `${auth(owner)} UPDATE public.bookings SET status='confirmed' WHERE id=${lit(uid(77))};`, /Monthly accepted-booking limit/);
    check('both daily and monthly guards remain enabled with package guard', ensure("(SELECT count(*)=3 FROM pg_trigger WHERE tgrelid='public.bookings'::regclass AND tgname IN ('cc_availability1_booking_guard','cc_monthly1_check_booking','cc_package_publish1_booking_guard') AND tgenabled IN ('O','A'))",'disabled enforcement'));
    if (process.argv.includes('--pricing-full')) {
      await require('./test-fixed-pricing-full-postgres.cjs')({sql,check,race,ensure,fails,auth,lit,uid,read,
        owner,other,customer,outsider,cat,cat2,pack,pack2,oldAccepted,oldCompleted});
    }
    if (process.argv.includes('--truncate-hardening')) {
      await require('./test-pricing-detail-truncate-hardening-postgres.cjs')({sql,check,ensure,fails,auth,lit,uid,read,
        owner,other,customer,outsider,cat,cat2,oldAccepted});
    }
    if (process.argv.includes('--subscription-payment')) {
      await require('./test-xendit-subscription-postgres.cjs')({sql,check,race,ensure,fails,auth,lit,uid,read,
        owner,other,customer,cat,cat2});
    }
    const executionPath = path.join(root, 'supabase/proposals/package_publication_EXECUTE.sql');
    if (fs.existsSync(executionPath)) assert.deepEqual(fs.readFileSync(executionPath),Buffer.from(execution));
    console.log(`RESULT: ${passed}/${passed} PostgreSQL checks passed. Tested package-publication execution SHA256: ${require('node:crypto').createHash('sha256').update(execution).digest('hex')}`);
    console.log('Execution candidate verified in memory; creating a file is a separate local preparation step.');
  } finally {
    if (started && fs.existsSync(path.join(data,'postmaster.pid'))) run('pg_ctl',['-D',data,'-m','fast','-w','stop'],{stdio:'ignore'});
    console.log('Disposable cluster stopped. Local artifacts: ' + scratch);
  }
})().catch(error => { console.error(error.stderr || error.stack || error); process.exitCode=1; });
