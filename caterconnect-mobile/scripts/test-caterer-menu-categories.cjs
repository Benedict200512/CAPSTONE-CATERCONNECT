// Offline Phase 3 tests. Actual save handlers and BYO editors; no network or SQL.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function evaluate(source, context = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(js, { ...context, module, exports: module.exports });
  return module.exports;
}
function contract(platform) {
  const base = platform === 'web' ? 'caterconnect-web/src' : 'caterconnect-mobile';
  const buffet = evaluate(read(`${base}/lib/buildYourOwn.ts`));
  const management = evaluate(read(`${base}/lib/menuCategoryManagement.ts`), { require: () => buffet });
  return { base, buffet, management };
}
const files = {
  web: 'caterconnect-web/src/pages/caterer/Menu.tsx',
  mobile: 'caterconnect-mobile/app/(caterer)/menu.tsx',
};
function actualHandler(platform, name, context) {
  const source = read(files[platform]), ast = ts.createSourceFile(files[platform], source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) initializer = node.initializer?.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(initializer, name);
  return evaluate(`module.exports = ${initializer}`, context);
}
function saveFixture(platform, { enabled = false, newName = 'Rice', key = 'main_course', editing = false, fail = false, noRows = false } = {}) {
  const { management } = contract(platform), calls = { writes: [], errors: [], closed: [], active: [], filters: [] };
  const noop = () => {};
  const result = () => ({ data: noRows ? [] : [{ id: id(1) }], error: fail ? { message: 'Published package protects this dish', code: '23514' } : null });
  const chain = {
    eq: (column, value) => { calls.filters.push([column, value]); return chain; },
    select: () => Promise.resolve(result()),
    then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
  };
  const context = {
    resolveMenuCategory: (name, existing) => management.resolveMenuCategory(name, existing, enabled),
    addingCategory: newName !== null, categoryName: newName ?? '', form: { name: 'Garlic Rice', category: key,
      description: 'Garlic and rice', price_per_guest: '30', serving_size: '1', serving_unit: 'tray', image_url: 'existing-photo' },
    catererId: id(10), userId: id(20), catererData: { id: id(10) }, editing: editing ? { id: id(1) } : null,
    uploadingImage: false, saving: false, selectedMenuPhoto: null, otherUnitSelected: false, customServingUnit: '', showCustomServingUnit: false,
    setError: value => { if (value) calls.errors.push(value); }, setCategoryError: value => { if (value) calls.errors.push(value); },
    getErrorMessage: error => error.message,
    Alert: { alert: (_title, text) => calls.errors.push(text) }, console: { error: noop },
    setSaving: noop, setSuccess: noop, setModalOpen: value => calls.closed.push(value), setShowForm: value => calls.closed.push(value),
    setEditing: noop, setSelectedMenuPhoto: noop, setMenuPhotoPreview: noop, setForm: noop, setAddingCategory: noop, setCategoryName: noop,
    setActiveCategory: value => calls.active.push(value), EMPTY_FORM: {}, loadItems: async () => {}, load: async () => {},
    supabase: { from: table => { assert.equal(table, 'menu_items'); return {
      insert: payload => { calls.writes.push(plain(payload)); return Promise.resolve(result()); },
      update: payload => { calls.writes.push(plain(payload)); return chain; },
    }; } },
  };
  return { calls, save: () => actualHandler(platform, platform === 'web' ? 'saveItem' : 'handleSave', context)({ preventDefault: noop }) };
}
const menu = [
  { id: id(1), name: 'Garlic Rice', category: 'rice', caterer_id: id(10) },
  { id: id(2), name: 'Plain Rice', category: 'rice', caterer_id: id(10) },
  { id: id(3), name: 'Pasta', category: 'pasta', caterer_id: id(10) },
];
for (const platform of ['web', 'mobile']) {
  const { management } = contract(platform);
  test(`${platform}: custom writes enabled; every original category still saves`, async () => {
    assert.equal(management.CUSTOM_MENU_CATEGORY_WRITES_ENABLED, true);
    for (const key of ['main_course', 'appetizer', 'dessert', 'drink']) {
      const f = saveFixture(platform, { newName: null, key }); await f.save();
      assert.equal(f.calls.writes[0].category, key);
    }
  });
  test(`${platform}: actual default flag permits normalized new and saved custom categories`, () => {
    assert.deepEqual(plain(management.resolveMenuCategory(' Rice ', 'main_course')), { key: 'rice', error: '' });
    assert.deepEqual(plain(management.resolveMenuCategory(null, 'rice')), { key: 'rice', error: '' });
    assert.equal(management.resolveMenuCategory('Rice!', 'main_course').key, null);
  });
  test(`${platform}: disabled new AND existing custom category saves make zero writes`, async () => {
    for (const options of [{}, { newName: null, key: 'rice', editing: true }]) {
      const f = saveFixture(platform, options); await f.save();
      assert.equal(f.calls.writes.length, 0); assert.equal(f.calls.closed.length, 0);
      assert.ok(f.calls.errors.some(error => error.includes('approved database migration')));
    }
  });
  test(`${platform}: mocked enabled Rice saves canonical payload, price, image and owner`, async () => {
    const f = saveFixture(platform, { enabled: true }); await f.save();
    assert.deepEqual(f.calls.writes[0], { caterer_id: id(10), name: 'Garlic Rice', category: 'rice', description: 'Garlic and rice',
      price_per_guest: 30, serving_size: 1, serving_unit: 'tray', image_url: 'existing-photo' });
    assert.equal(f.calls.active[0], 'rice'); assert.deepEqual(f.calls.closed, [false]);
  });
  test(`${platform}: multiple/equivalent Rice items reuse a single option`, async () => {
    for (const newName of ['Rice', ' RICE ', 'rice']) {
      const f = saveFixture(platform, { enabled: true, newName }); await f.save(); assert.equal(f.calls.writes[0].category, 'rice');
    }
    assert.equal(management.catererCategoryOptions(menu).filter(option => option.key === 'rice').length, 1);
    const existing = saveFixture(platform, { enabled: true, newName: null, key: 'rice' }); await existing.save();
    assert.equal(existing.calls.writes[0].category, 'rice');
  });
  test(`${platform}: invalid and oversized inputs never save`, async () => {
    for (const newName of ['Rice!', '', 'a'.repeat(51), 'rice\n', 'Café']) {
      const f = saveFixture(platform, { enabled: true, newName }); await f.save();
      assert.equal(f.calls.writes.length, 0); assert.equal(f.calls.closed.length, 0); assert.ok(f.calls.errors.length);
    }
  });
  test(`${platform}: options are catalog-local; defaults and missing current value retained`, () => {
    const own = management.catererCategoryOptions(menu), other = management.catererCategoryOptions([{ category: 'seafood' }]);
    assert.equal(own.length, 6); assert.ok(!other.some(option => option.key === 'rice'));
    assert.ok(own.some(option => option.label === 'Rice'));
    assert.ok(management.catererCategoryOptions([], 'rice').some(option => option.key === 'rice'));
    assert.equal(management.catererCategoryOptions([]).length, 4); // Cancelled preview creates nothing.
  });
  test(`${platform}: denied published-item update is reported, never closes or reports success`, async () => {
    const f = saveFixture(platform, { enabled: true, editing: true, fail: true }); await f.save();
    assert.equal(f.calls.closed.length, 0); assert.ok(f.calls.errors.length);
    assert.ok(f.calls.filters.some(([field, value]) => field === 'caterer_id' && value === id(10)));
  });
  test(`${platform}: legacy category alias stays usable with flag off`, async () => {
    const f = saveFixture(platform, { newName: 'Main Course' }); await f.save();
    assert.equal(f.calls.writes[0].category, 'main_course');
  });
  test(`${platform}: stale or RLS-filtered update cannot report success`, async () => {
    const f = saveFixture(platform, { enabled: true, editing: true, noRows: true }); await f.save();
    assert.equal(f.calls.closed.length, 0); assert.ok(f.calls.errors.length);
  });
}
test('Web and Mobile management helpers are identical', () => {
  assert.equal(read('caterconnect-web/src/lib/menuCategoryManagement.ts'), read('caterconnect-mobile/lib/menuCategoryManagement.ts'));
});

function editorFixture(platform, enabled) {
  const { base, buffet, management } = contract(platform), changes = [];
  const jsx = (type, props, key) => ({ type, props, key });
  let state = 0;
  const react = { useState: initial => [state++ === 0 ? menu : initial, () => {}], useEffect: () => {}, useId: () => 'test' };
  const native = { StyleSheet: { create: styles => styles }, Platform: { OS: 'android' } };
  const runtime = { jsx, jsxs: jsx };
  const icons = new Proxy({}, { get: (_object, key) => key });
  const component = evaluate(read(`${base}/components/BuffetChoices.tsx`), { require: name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return runtime;
    if (name === 'react-native') return native;
    if (name.includes('lucide')) return icons;
    if (name.endsWith('/buildYourOwn')) return buffet;
    if (name.endsWith('/menuCategoryManagement')) return { ...management, CUSTOM_MENU_CATEGORY_WRITES_ENABLED: enabled };
    if (name.endsWith('/colors')) return { Colors: {} };
    return {};
  } });
  const config = { version: 1, groups: [{ id: 'rice', label: 'Rice', category: 'rice', required_count: 1, menu_item_ids: [id(1), id(2)] }] };
  const tree = component.BuffetConfigEditor({ value: config, onChange: value => changes.push(plain(value)), catererId: id(10), published: false });
  const nodes = [];
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    nodes.push(node); walk(node.props?.children);
  }
  walk(tree); return { nodes, changes, config };
}
for (const platform of ['web', 'mobile']) {
  test(`${platform}: BYO custom Rice option exists but is disabled before migration`, () => {
    const f = editorFixture(platform, false);
    const option = f.nodes.find(node => platform === 'web' ? node.type === 'option' && node.props.value === 'rice' : node.props?.label === 'Rice');
    assert.ok(option); assert.equal(option.props.disabled, true);
    assert.ok(JSON.stringify(f.config).includes(id(1))); assert.equal(f.changes.length, 0);
  });
  test(`${platform}: mocked enabled BYO editor loads both eligible rice dishes without changing IDs`, () => {
    const f = editorFixture(platform, true);
    const option = f.nodes.find(node => platform === 'web' ? node.type === 'option' && node.props.value === 'rice' : node.props?.label === 'Rice');
    assert.equal(option.props.disabled, false);
    if (platform === 'web') {
      assert.ok(JSON.stringify(f.nodes).includes('Garlic Rice')); assert.ok(JSON.stringify(f.nodes).includes('Plain Rice'));
    } else {
      assert.ok(f.nodes.some(node => node.props?.label === 'Garlic Rice'));
      assert.ok(f.nodes.some(node => node.props?.label === 'Plain Rice'));
    }
    assert.deepEqual(f.config.groups[0].menu_item_ids, [id(1), id(2)]); assert.equal(f.changes.length, 0);
  });
}
