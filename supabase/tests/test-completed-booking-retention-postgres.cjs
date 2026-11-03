// Real PostgreSQL tests against a freshly initialized local disposable cluster.
// Never reads project environment files, connection strings or Supabase secrets.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const bin = process.env.CC_TEST_POSTGRES_BIN || 'C:\\Program Files\\PostgreSQL\\18\\bin';
const proposals = path.resolve(__dirname, '../proposals');
const read = name => fs.readFileSync(path.join(proposals, name), 'utf8');
const monthlyBytes = fs.readFileSync(path.join(proposals, 'monthly_booking_quota_EXECUTE.sql'));
const monthly = monthlyBytes.toString('utf8');
const proposal = read('completed_booking_retention_proposal.sql');
const stop = /DO \$\$ BEGIN\r?\n  RAISE EXCEPTION 'PROPOSAL ONLY: completed booking retention requires separate execution approval';\r?\nEND \$\$;\r?\n/g;
assert.equal([...proposal.matchAll(stop)].length, 1);
const retention = proposal.replace(stop, ''); // Memory only until tests pass.
const retentionExecutionPath = path.join(proposals, 'completed_booking_retention_EXECUTE.sql');
if (fs.existsSync(retentionExecutionPath)) {
  assert.deepEqual(fs.readFileSync(retentionExecutionPath), Buffer.from(retention), 'Execution copy must match tested stop-only removal');
}
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-retention-pg-'));
const data = path.join(scratch, 'data');
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^PG/i.test(key)) delete env[key];
const options = { encoding: 'utf8', windowsHide: true, env, timeout: 60000, maxBuffer: 4 * 1024 * 1024 };
const run = (name, args, extra = {}) => execFileSync(path.join(bin, name + '.exe'), args, { ...options, ...extra });
let port;
let started = false;
let passed = 0;
const sql = input => run('psql', ['-X', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-q'], { input });
function check(name, input) {
  sql(input);
  passed++;
  console.log('PASS ' + name);
}
function rejects(name, input, message) {
  let error;
  try { sql(input); } catch (failure) { error = failure; }
  assert.ok(error, name + ' must fail');
  assert.ok(String(error.stderr).includes(message), String(error.stderr));
  passed++;
  console.log('PASS ' + name);
}
const seed = `
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
INSERT INTO public.profiles(id) SELECT id FROM auth.users;
INSERT INTO public.caterers(id,user_id) SELECT id,id FROM auth.users;
INSERT INTO public.bookings(id,caterer_id,customer_id,status)
SELECT ('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',status
FROM unnest(ARRAY['completed','pending','confirmed','awaiting_payment','paid','ongoing','cancelled','rejected']) WITH ORDINALITY s(status,n);
INSERT INTO public.bookings(id,caterer_id,customer_id,status) VALUES
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','pending');
`;
const expect23514 = statement => `DO $test$ BEGIN
  BEGIN ${statement}; RAISE EXCEPTION 'Guard failed to reject operation';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $test$;`;
const assertOriginal = `RESET ROLE;
SELECT test.assert((SELECT count(*)=9 FROM public.bookings),'booking rows changed');
SELECT test.assert((SELECT count(*)=2 FROM auth.users),'Auth fixture rows changed');
SELECT test.assert((SELECT count(*)=2 FROM public.profiles),'profile rows changed');
SELECT test.assert((SELECT count(*)=2 FROM public.caterers),'caterer rows changed');
SELECT test.assert((SELECT count(*)=0 FROM test.deletion_audit),'trigger side effects escaped rollback');`;

(async () => {
  // Reserve an unused local port. A bind collision makes startup fail, not reuse
  // another server. Verify data_directory before running any fixture SQL.
  port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const selected = server.address().port;
      server.close(() => resolve(selected));
    });
  });
  try {
    run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
    started = true;
    // Detached server handles must not retain execFileSync's captured pipes on
    // Windows. A file receives server logs; no console window is opened.
    run('pg_ctl', ['-D', data, '-l', path.join(scratch, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start'], { stdio: 'ignore' });
    assert.equal(path.resolve(sql('SHOW data_directory;').trim()).toLowerCase(), path.resolve(data).toLowerCase());
    console.log('Isolated local PostgreSQL: ' + sql('SHOW server_version;').trim());
    sql(`
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE test_truncator NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA test;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE, role text DEFAULT 'customer');
CREATE TABLE public.caterers(id uuid PRIMARY KEY,user_id uuid REFERENCES public.profiles ON DELETE CASCADE,
 subscription_plan text DEFAULT 'free',subscription_expires_at timestamptz,
 monthly_booking_count integer DEFAULT 0,booking_count_reset_at timestamptz);
CREATE TABLE public.bookings(id uuid PRIMARY KEY,caterer_id uuid REFERENCES public.caterers ON DELETE CASCADE,
 customer_id uuid REFERENCES public.profiles ON DELETE CASCADE,status text NOT NULL DEFAULT 'pending');
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth,test TO anon,authenticated,service_role,test_truncator;
GRANT SELECT ON public.profiles TO anon,authenticated;
GRANT SELECT,INSERT ON public.caterers TO anon,authenticated;
GRANT UPDATE(monthly_booking_count,booking_count_reset_at) ON public.caterers TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,TRUNCATE ON public.bookings TO anon,authenticated;
GRANT ALL ON public.bookings,public.profiles,public.caterers,auth.users TO service_role;
GRANT TRUNCATE ON public.bookings TO test_truncator;
-- Subscription stand-ins model ONLY the verified UPDATE/reset behavior.
CREATE FUNCTION public.activate_paid_subscription(p_id uuid,p_plan text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.caterers SET subscription_plan=p_plan,subscription_expires_at=clock_timestamp()+interval '30 days',monthly_booking_count=0 WHERE id=p_id;
END; $$;
CREATE FUNCTION public.staff_correct_subscription_plan(p_id uuid,p_plan text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.caterers SET subscription_plan=p_plan,subscription_expires_at=clock_timestamp()+interval '30 days' WHERE id=p_id;
END; $$;
REVOKE ALL ON FUNCTION public.activate_paid_subscription(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_paid_subscription(uuid,text) TO service_role;
CREATE FUNCTION public.handle_new_booking_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
 UPDATE public.caterers SET monthly_booking_count=monthly_booking_count+1 WHERE id=NEW.caterer_id; RETURN NEW;
END; $$;
CREATE TRIGGER on_booking_created_increment_count AFTER INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.handle_new_booking_count();
CREATE FUNCTION test.assert(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF;
END; $$;
`);
    check('security dependency execution SQL installs as stored', read('phase2_security_dependencies_EXECUTE.sql'));
    rejects('retention proposal safety stop rolls back', proposal, 'PROPOSAL ONLY:');
    check('retention installation leaves FK/ACL/RLS/trigger assertions intact', retention);

    // Compare live catalogs with the hashes/signatures used by monthly preflight.
    const expected = [...monthly.matchAll(/\('(cc_(?:phase2_dependency1|completed_retention1)_guard_\w+)',(\d+),(true|false),'([OA])','([a-f0-9]{32})'\)/g)]
      .map(([, name, bits, definer, enabled, hash]) => ({ name, bits: Number(bits), definer: definer === 'true', enabled, hash }));
    assert.equal(expected.length, 3);
    const installed = JSON.parse(sql(`SELECT json_agg(x ORDER BY name) FROM (
 SELECT t.tgname AS name,t.tgtype AS bits,p.prosecdef AS definer,t.tgenabled::text AS enabled,
 md5(replace(p.prosrc,chr(13)||chr(10),chr(10))) AS hash
 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid='public.bookings'::regclass
 AND t.tgname IN ('cc_phase2_dependency1_guard_status','cc_completed_retention1_guard_delete','cc_completed_retention1_guard_truncate')) x;`).trim());
    assert.deepEqual(installed, expected.sort((a,b) => a.name.localeCompare(b.name)));
    passed++; console.log('PASS live trigger signatures, modes, security settings and normalized source hashes');

    sql(`CREATE TABLE test.deletion_audit(id uuid);
CREATE FUNCTION test.audit_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 INSERT INTO test.deletion_audit VALUES(OLD.id); RETURN OLD; END; $$;
CREATE TRIGGER a_test_delete_audit BEFORE DELETE ON public.bookings FOR EACH ROW EXECUTE FUNCTION test.audit_delete();
ALTER TABLE public.bookings ENABLE ALWAYS TRIGGER a_test_delete_audit;
CREATE FUNCTION test.cleanup() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ DELETE FROM public.bookings $$;`);

    check('service-role completed DELETE and mixed DELETE rejected atomically', `BEGIN; ${seed} SET LOCAL ROLE service_role;
${expect23514("DELETE FROM public.bookings WHERE status='completed'")}
${expect23514('DELETE FROM public.bookings')}
${assertOriginal} ROLLBACK;`);
    check('earlier writes in failed deletion unit also roll back', `BEGIN; ${seed} SET LOCAL ROLE service_role;
${expect23514("DELETE FROM public.bookings WHERE status='pending'; DELETE FROM public.bookings WHERE status='completed'")}
${assertOriginal} ROLLBACK;`);
    for (const table of ['auth.users','public.profiles','public.caterers']) {
      check(table + ' account cascade rejected atomically', `BEGIN; ${seed} SET LOCAL ROLE service_role;
${expect23514(`DELETE FROM ${table} WHERE id='00000000-0000-0000-0000-000000000001'`)}
${assertOriginal} ROLLBACK;`);
    }
    check('SECURITY DEFINER cleanup cannot bypass completed retention', `BEGIN; ${seed} SET LOCAL ROLE service_role;
${expect23514('SELECT test.cleanup()')} ${assertOriginal} ROLLBACK;`);
    for (const operation of ['TRUNCATE public.bookings', 'TRUNCATE auth.users CASCADE']) {
      check(operation + ' rejected atomically', `BEGIN; ${seed} SET LOCAL ROLE service_role;
${expect23514(operation)} ${assertOriginal} ROLLBACK;`);
    }
    check('TRUNCATE guard sees completed rows hidden from caller by RLS', `BEGIN; ${seed} SET LOCAL ROLE test_truncator;
${expect23514('TRUNCATE public.bookings')} ${assertOriginal} ROLLBACK;`);
    check('ALWAYS DELETE/TRUNCATE guards fire in replica mode', `BEGIN; ${seed} SET LOCAL session_replication_role=replica;
${expect23514("DELETE FROM public.bookings WHERE status='completed'")}
${expect23514('TRUNCATE public.bookings')} ${assertOriginal} ROLLBACK;`);
    check('ordinary DELETE and TRUNCATE remain permission-denied', `BEGIN; ${seed} SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN DELETE FROM public.bookings; RAISE EXCEPTION 'DELETE should be denied'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN TRUNCATE public.bookings; RAISE EXCEPTION 'TRUNCATE should be denied'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$; ${assertOriginal} ROLLBACK;`);
    check('service-role non-completed cleanup and account cascade remain allowed', `BEGIN; ${seed} SET LOCAL ROLE service_role;
DELETE FROM auth.users WHERE id='00000000-0000-0000-0000-000000000002';
DELETE FROM public.bookings WHERE status<>'completed'; RESET ROLE;
SELECT test.assert((SELECT count(*)=1 FROM public.bookings),'safe cleanup did not retain exactly completed history');
SELECT test.assert((SELECT count(*)=1 FROM auth.users),'safe account deletion failed'); ROLLBACK;`);
    check('empty and non-completed-only TRUNCATE remains allowed to existing trusted role', `BEGIN; ${seed}
-- Roll back the completed fixture insert before testing a separate eligible dataset.
ROLLBACK;
BEGIN;
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000002');
INSERT INTO public.profiles(id) SELECT id FROM auth.users;
INSERT INTO public.caterers(id,user_id) SELECT id,id FROM auth.users;
INSERT INTO public.bookings VALUES ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','pending');
SET LOCAL ROLE service_role; TRUNCATE public.bookings; TRUNCATE public.bookings; RESET ROLE;
SELECT test.assert((SELECT count(*)=0 FROM public.bookings),'safe truncate failed'); ROLLBACK;`);

    // All test rows above were rolled back; zero-bookings preflight remains real.
    rejects('monthly installation refuses nonempty fixture and rolls back schema creation', `BEGIN; ${seed}\n${monthly}`, 'Empty-bookings deployment required');
    check('failed monthly installation leaves no partial schema', `SELECT test.assert(to_regnamespace('cc_monthly1_private') IS NULL,'partial monthly schema survived');
SELECT test.assert((SELECT count(*)=0 FROM public.bookings),'test transaction leaked rows');`);
    check('unchanged monthly execution SQL installs after dependency and retention', monthly);
    check('monthly completion, history immutability and retention integrate', `BEGIN; ${seed}
SELECT test.assert((SELECT quota_month=date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Manila')::date FROM public.bookings WHERE status='completed'),'missing assigned month');
${expect23514("UPDATE public.bookings SET status='pending' WHERE status='completed'")}
DO $$ BEGIN
 BEGIN UPDATE public.bookings SET quota_month=quota_month-interval '1 month' WHERE status='completed'; RAISE EXCEPTION 'month rewrite accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.bookings SET caterer_id='00000000-0000-0000-0000-000000000002' WHERE status='completed'; RAISE EXCEPTION 'reassignment accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
${expect23514("DELETE FROM public.bookings WHERE status='completed'")}
SELECT public.activate_paid_subscription('00000000-0000-0000-0000-000000000001','basic');
SELECT test.assert((SELECT monthly_booking_count=5 AND subscription_plan='basic' AND subscription_expires_at>clock_timestamp() FROM public.caterers WHERE id='00000000-0000-0000-0000-000000000001'),'activation erased usage or plan/expiry');
SELECT public.staff_correct_subscription_plan('00000000-0000-0000-0000-000000000001','standard');
SELECT test.assert((SELECT monthly_booking_count=5 AND subscription_plan='standard' FROM public.caterers WHERE id='00000000-0000-0000-0000-000000000001'),'staff correction incompatible');
UPDATE public.bookings SET status='cancelled' WHERE status='confirmed';
SELECT test.assert((SELECT monthly_booking_count=4 FROM public.caterers WHERE id='00000000-0000-0000-0000-000000000001'),'cancellation did not release slot');
ROLLBACK;`);
    assert.deepEqual(fs.readFileSync(path.join(proposals, 'monthly_booking_quota_EXECUTE.sql')), monthlyBytes);
    console.log(`RESULT: ${passed}/${passed} local PostgreSQL checks passed; monthly execution bytes unchanged.`);
    console.log('Disposable cluster directory (stopped, synthetic data only): ' + scratch);
  } finally {
    if (started && fs.existsSync(path.join(data, 'postmaster.pid'))) {
      run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' });
    }
  }
})().catch(error => {
  console.error(error.stderr ? String(error.stderr) : error.stack);
  console.error('Disposable diagnostic directory: ' + scratch);
  process.exitCode = 1;
});
