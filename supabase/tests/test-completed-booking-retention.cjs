// Offline SQL/source contracts only. Does not execute SQL or access Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { test } = require('node:test');
const directory = path.resolve(__dirname, '../proposals');
const read = file => fs.readFileSync(path.join(directory, file), 'utf8').replace(/\r\n/g, '\n');
const retention = read('completed_booking_retention_proposal.sql');
const monthly = read('monthly_booking_quota_EXECUTE.sql');
const source = read('monthly_booking_quota_proposal.sql');
const dependency = read('phase2_security_dependencies_proposal.sql');
const body = (sql, name) => sql.split(`CREATE FUNCTION public.${name}()`)[1].split('AS $$')[1].split('$$;')[0];
const guards = [
  ['cc_phase2_dependency1_guard_status', dependency, 17, false, 'O'],
  ['cc_completed_retention1_guard_delete', retention, 11, true, 'A'],
  ['cc_completed_retention1_guard_truncate', retention, 34, true, 'A'],
];

test('completed DELETE guard has no role, parent-presence or cascade bypass', () => {
  assert.equal(body(retention, 'cc_completed_retention1_guard_delete'), `
BEGIN
  IF OLD.status::text='completed' THEN
    RAISE EXCEPTION 'Completed booking history cannot be deleted, including by account cascades' USING ERRCODE='23514';
  END IF;
  RETURN OLD;
END;
`);
  assert.ok(retention.includes('BEFORE DELETE ON public.bookings\n  FOR EACH ROW'));
  assert.ok(retention.includes('ENABLE ALWAYS TRIGGER cc_completed_retention1_guard_delete'));
});

test('TRUNCATE independently checks completed history with definer visibility', () => {
  const truncate = body(retention, 'cc_completed_retention1_guard_truncate');
  assert.ok(truncate.includes("IF EXISTS(SELECT 1 FROM public.bookings WHERE status::text='completed') THEN"));
  assert.ok(truncate.includes("RAISE EXCEPTION 'TRUNCATE would erase completed booking history'"));
  assert.ok(truncate.includes('RETURN NULL;'));
  assert.ok(!truncate.includes('auth.uid') && !truncate.includes('current_user') && !truncate.includes('RETURN OLD'));
  assert.ok(retention.includes('BEFORE TRUNCATE ON public.bookings\n  FOR EACH STATEMENT'));
  assert.ok(retention.includes('ENABLE ALWAYS TRIGGER cc_completed_retention1_guard_truncate'));
  for (const name of guards.slice(1).map(g => g[0])) {
    assert.ok(retention.includes(`CREATE FUNCTION public.${name}() RETURNS trigger\nLANGUAGE plpgsql SECURITY DEFINER SET search_path=''`));
    assert.ok(retention.includes(`ALTER FUNCTION public.${name}() OWNER TO postgres`));
  }
  assert.ok(retention.includes('FROM PUBLIC,anon,authenticated,service_role;'));
});

test('retention remains guarded, leaves FKs/ACL/RLS/statuses alone and snapshots drift', () => {
  assert.ok(retention.includes("RAISE EXCEPTION 'PROPOSAL ONLY:"));
  assert.ok(!/\b(?:DELETE FROM|TRUNCATE TABLE|DISABLE TRIGGER|DISABLE ROW LEVEL SECURITY)\b/i.test(retention));
  assert.ok(!/\b(?:CREATE|ALTER|DROP)\s+POLICY\b/i.test(retention));
  assert.ok(!/\b(?:ADD|DROP)\s+CONSTRAINT\b|\bUPDATE\s+public\.|\bGRANT\s+/i.test(retention));
  assert.ok(!/REVOKE\s+(?:DELETE|TRUNCATE|INSERT|UPDATE)\b/i.test(retention));
  for (const key of ['table', 'columns', 'policies', 'foreign_keys', 'triggers']) {
    assert.equal(retention.split(`'${key}',`).length - 1, 2, `${key} snapshotted and compared`);
  }
  assert.ok(retention.includes("RAISE EXCEPTION 'Existing booking FK, ACL, RLS or trigger state changed'"));
  assert.ok(retention.includes("inhparent='public.bookings'::regclass"));
  assert.ok(retention.includes('completed history fails atomically'));
});

test('both installations require exact guard bodies, events, owners, ACLs and trigger modes', () => {
  for (const [name, sql, bits, definer, enabled] of guards) {
    const hash = crypto.createHash('md5').update(body(sql, name)).digest('hex');
    for (const file of [retention, monthly]) {
      assert.ok(file.includes(`('${name}',${bits},${definer},'${enabled}','${hash}')`), name);
    }
  }
  for (const file of [retention, monthly]) {
    for (const fragment of ['t.tgqual IS NULL', "t.tgattr::text=''", 't.tgconstraint=0',
      "p.proconfig=ARRAY['search_path=\"\"']", "pg_get_userbyid(p.proowner)='postgres'",
      "md5(replace(p.prosrc,chr(13)||chr(10),chr(10)))=guard.body_hash",
      "has_function_privilege('authenticated'", 'IS DISTINCT FROM s.definition',
      'IS DISTINCT FROM s.acl', 'IS DISTINCT FROM s.config']) assert.ok(file.includes(fragment), fragment);
  }
});

test('monthly execution changes only deliberate stops, header and concrete locked dependencies', () => {
  const approval = "DO $$ BEGIN\n  RAISE EXCEPTION 'PROPOSAL ONLY: monthly quota needs explicit execution approval';\nEND $$;\n";
  const blocker = "-- A SECOND deliberate gate: execution approval alone cannot resolve these\n-- missing facts. Replace only with a separately reviewed, concrete resolution.\nDO $$ BEGIN\n  RAISE EXCEPTION 'DEPENDENCY BLOCK: verify trusted plan/expiry writers and staff/admin authorization, reset compatibility and booking retention/reassignment before execution';\nEND $$;\n";
  const expected = source.replace(approval, '').replace(blocker, '');
  assert.notEqual(expected, source);
  const stripped = monthly.slice(monthly.indexOf('-- CaterConnect MONTHLY QUOTA'))
    .replace(/DO \$dependencies\$[\s\S]*?\$dependencies\$;\n/, '');
  assert.equal(stripped, expected);
  assert.ok(monthly.indexOf('LOCK TABLE') < monthly.indexOf('DO $dependencies$'));
  assert.ok(monthly.indexOf('$dependencies$;') < monthly.indexOf('CREATE SCHEMA cc_monthly1_private'));
});

test('monthly history, reset compatibility and empty-state/concurrency safeguards remain', () => {
  for (const fragment of ['Booking identity/quota month cannot be rewritten',
    'Previously counted booking reassignment requires review', 'Empty-bookings deployment required',
    'Original counter trigger/function differs from reviewed baseline',
    'Installation callbacks wrote bookings', 'FOR NO KEY UPDATE', 'SET CONSTRAINTS ALL IMMEDIATE;',
    "clock_timestamp() AT TIME ZONE 'Asia/Manila'", "WHEN 'basic' THEN 20 WHEN 'standard' THEN 50 ELSE NULL",
    'NEW.monthly_booking_count', 'DROP TRIGGER on_booking_created_increment_count ON public.bookings RESTRICT;']) {
    assert.ok(monthly.includes(fragment), fragment);
  }
  assert.ok(!/\bDELETE\s+FROM\s+public\.|\bTRUNCATE\s+(?:TABLE\s+)?public\./i.test(monthly));
  assert.ok(!/\bSET\s+subscription_(?:plan|expires_at)\s*=/i.test(monthly));
});

test('SQL strings/comments/dollar blocks close and each package remains one transaction', () => {
  // Lexical balance only, not a PostgreSQL parser or SQL runtime test.
  for (const sql of [retention, monthly]) {
    let i = 0;
    let plain = '';
    while (i < sql.length) {
      if (sql.startsWith('--', i)) {
        const end = sql.indexOf('\n', i); i = end < 0 ? sql.length : end + 1;
      } else if (sql.startsWith('/*', i)) {
        let depth = 1; i += 2;
        while (i < sql.length && depth) {
          if (sql.startsWith('/*', i)) { depth++; i += 2; }
          else if (sql.startsWith('*/', i)) { depth--; i += 2; }
          else i++;
        }
        assert.equal(depth, 0);
      } else if (sql[i] === "'" || sql[i] === '"') {
        const quote = sql[i++]; let closed = false;
        while (i < sql.length) {
          if (sql[i++] === quote) {
            if (sql[i] === quote) i++;
            else { closed = true; break; }
          }
        }
        assert.ok(closed);
      } else {
        const tag = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0];
        if (tag) {
          const end = sql.indexOf(tag, i + tag.length);
          assert.ok(end >= 0, tag); i = end + tag.length;
        } else plain += sql[i++];
      }
    }
    assert.equal((plain.match(/\bBEGIN\s*;/g) || []).length, 1);
    assert.equal((plain.match(/\bCOMMIT\s*;/g) || []).length, 1);
  }
});
