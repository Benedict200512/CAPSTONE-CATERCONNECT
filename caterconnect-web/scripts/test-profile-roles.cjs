// Offline contract tests only: no SQL, real signup, credentials or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
test('shared mobile customer/caterer profile edit payloads contain no protected role/id writes', () => {
  const filename = path.join(__dirname, '../../caterconnect-mobile/app/(tabs)/edit-profile.tsx');
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fields = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'update') {
      const argument = node.arguments[0];
      assert.ok(ts.isObjectLiteralExpression(argument));
      for (const property of argument.properties) fields.push(property.name.getText(ast));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const expected of ['avatar_url', 'full_name', 'phone_number', 'address']) assert.ok(fields.includes(expected));
  assert.ok(!fields.includes('role') && !fields.includes('id'));
});
test('SQL contract clamps forged signup roles and preserves existing conflict roles', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/proposals/profiles_role_protection_proposal.sql'), 'utf8');
  assert.ok(sql.includes("CASE WHEN NEW.raw_user_meta_data->>'role' = 'caterer' THEN 'caterer' ELSE 'customer' END"));
  assert.ok(sql.includes("'role = profiles.role'"));
  assert.ok(sql.includes("a.can_insert AND a.column_name<>'role'"));
  assert.ok(sql.includes("a.column_name NOT IN ('id','role')"));
  assert.ok(sql.includes("p.role::text='admin' AND p.status::text='active'"));
  assert.ok(sql.includes("p_role NOT IN ('staff','admin','customer')"));
  assert.ok(sql.includes("GRANT EXECUTE ON FUNCTION public.cc_profile_role1_assign_staff_role(uuid,text) TO authenticated"));
  assert.ok(!/^(CREATE|ALTER|DROP) POLICY/m.test(sql));
});
test('Platform Settings has a staff-only creation form and secure role controls', () => {
  const ui = fs.readFileSync(path.join(__dirname, '../src/pages/admin/PlatformSettings.tsx'), 'utf8');
  for (const text of ['Staff & Admin Accounts', 'Add Staff Account', '>Permissions</th>', '<option value="admin">System Administrator</option>', '<option value="staff">Platform Staff</option>', 'assignStaffRole(userId, newRole)', "profile?.role !== 'admin'", 'u.id === profile.id', 'role="alert"', 'role="dialog"', 'handleCreateStaff', 'staff-full-name', 'staff-email', 'createStaffAccount(fullName, email, staffPassword)']) assert.ok(ui.includes(text), text);
  assert.ok(!ui.includes('value="customer"'));
  const ast = ts.createSourceFile('PlatformSettings.tsx', ui, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let emailCell;
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) assert.ok(!['insert', 'update', 'upsert', 'delete', 'signUp', 'createUser'].includes(node.expression.name.text));
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'td' && node.getText(ast).includes('<Mail')) emailCell = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(emailCell);
  const cellStyle = emailCell.openingElement.getText(ast);
  assert.ok(cellStyle.includes("verticalAlign: 'middle'"));
  assert.ok(cellStyle.includes("whiteSpace: 'nowrap'"));
  assert.ok(!cellStyle.includes('display:') && !cellStyle.includes('height:'));
  assert.ok(emailCell.getText(ast).includes("alignItems: 'center'"));
});

test('secure role helper verifies persisted result and never uses direct table writes', async () => {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/profileRoles.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const calls = [];
  let response;
  const supabase = { rpc(name, args) { calls.push({ name, args }); return { single: async () => response }; }, from() { throw Error('Direct writes forbidden'); } };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: () => ({ supabase }) });
  const assign = module.exports.assignStaffRole;
  for (const role of ['admin', 'staff']) {
    response = { data: { id: 'target', role }, error: null };
    assert.equal((await assign('target', role)).role, role);
    assert.equal(calls.at(-1).name, 'cc_profile_role1_assign_staff_role');
    assert.equal(calls.at(-1).args.p_profile_id, 'target');
  }
  const beforeInvalid = calls.length;
  await assert.rejects(assign('target', 'customer'), /Choose staff or admin/);
  assert.equal(calls.length, beforeInvalid);
  const denied = { code: '42501', message: 'An active administrator is required' };
  response = { data: null, error: denied };
  await assert.rejects(assign('target', 'admin'), error => error === denied);
  response = { data: { id: 'wrong', role: 'admin' }, error: null };
  await assert.rejects(assign('target', 'admin'), /could not be confirmed/);
  response = { data: null, error: { code: 'PGRST202' } };
  await assert.rejects(assign('target', 'admin'), /not installed yet/);
});

test('signup rewrite requires normalized exact reviewed original and replacement', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/proposals/profiles_role_protection_proposal.sql'), 'utf8');
  assert.ok(sql.includes('SELECT * INTO STRICT approved FROM pg_temp.reviewed_signup_patch'));
  assert.ok(sql.includes('replace(f.prosrc,chr(13)||chr(10),chr(10)) IS DISTINCT FROM'));
  assert.ok(sql.includes('replace(generated_body,chr(13)||chr(10),chr(10)) IS DISTINCT FROM'));
  assert.ok(/^INSERT INTO pg_temp\.reviewed_signup_patch/m.test(sql));
});

test('verified live signup fixture and both SQL pins match exactly', () => {
  const crypto = require('node:crypto');
  const body = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/handle-new-user-live-body.json'), 'utf8'));
  assert.equal(body.length, 980);
  assert.equal(crypto.createHash('md5').update(body, 'utf8').digest('hex'), '58fc6dfe6f705f72a667618634665a44');
  assert.equal(Buffer.from(body).subarray(0, 7).toString('hex'), '0d0a424547494e');
  const normalize = text => text.replace(/\r\n/g, '\n');
  const initializer = /COALESCE\(\s*NEW\.raw_user_meta_data\s*->>\s*'role'\s*,\s*'customer'\s*\)/gi;
  const conflict = /\brole\s*=\s*EXCLUDED\.role\b/gi;
  assert.equal([...body.matchAll(initializer)].length, 1);
  assert.equal([...body.matchAll(conflict)].length, 1);
  const replacement = body.replace(initializer, () => "(CASE WHEN NEW.raw_user_meta_data->>'role' = 'caterer' THEN 'caterer' ELSE 'customer' END)")
    .replace(conflict, 'role = profiles.role');
  for (const filename of ['profiles_role_protection_proposal.sql', 'profiles_role_protection_EXECUTE.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, '../../supabase/proposals', filename), 'utf8');
    const originalPin = sql.split('$verified_original$')[1].split('$function$')[1];
    const replacementPin = sql.split('$verified_replacement$')[1].split('$function$')[1];
    assert.equal(originalPin, body);
    assert.equal(replacementPin, replacement);
    assert.equal(normalize(originalPin), normalize(body));
    assert.equal(normalize(replacementPin), normalize(replacement));
    for (const drift of [body.replace('BEGIN', 'BEGIN '), body.replace('RETURN NEW;', 'RETURN NULL;'), body + '\n']) {
      assert.notEqual(normalize(drift), normalize(originalPin));
    }
    assert.ok(sql.includes('proacl IS NOT DISTINCT FROM f.proacl'));
    assert.ok(sql.includes('proconfig IS NOT DISTINCT FROM f.proconfig'));
    assert.ok(sql.includes('EXECUTE revised;'));
    assert.equal(sql.includes("RAISE EXCEPTION 'DEPENDENCY BLOCK:"), filename.endsWith('_proposal.sql'));
  }
});
