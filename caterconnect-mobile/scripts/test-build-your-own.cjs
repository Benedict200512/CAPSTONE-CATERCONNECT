// Offline regression tests. No network, SQL execution, accounts or payments.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function load(file, dependencies = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: name => dependencies[name] ?? (name === 'lucide-react' ? require(name) : undefined) });
  return module.exports;
}
const buffet = load('caterconnect-mobile/lib/buildYourOwn.ts');
const pricing = load('caterconnect-mobile/lib/packagePricing.ts');
const id = number => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const menu = [1, 2, 3].map(number => ({ id: id(number), name: `Catalog dish ${number}`, category: 'main_course', caterer_id: id(10) }));
const config = { version: 1, groups: [{ id: 'main', label: 'Main Dishes', category: 'main_course', required_count: 2, menu_item_ids: [id(1), id(2), id(3)] }] };
const copy = value => JSON.parse(JSON.stringify(value));

test('Web and Mobile use identical validation and backend contracts', () => {
  for (const file of ['buildYourOwn.ts', 'buildYourOwnBackend.ts']) {
    assert.equal(read(`caterconnect-mobile/lib/${file}`), read(`caterconnect-web/src/lib/${file}`));
  }
});
test('existing Standard packages require no buffet configuration or choices', () => {
  assert.equal(buffet.validateBuffetConfig(null), '');
  assert.equal(buffet.validateBuffetConfig(undefined), '');
  assert.equal(buffet.validateBuffetSelections(null, {}), '');
  assert.ok(buffet.validateBuffetSelections(null, { main: [id(1)] }));
});
test('configuration validates counts, duplicate groups and unique eligible dishes', () => {
  assert.equal(buffet.validateBuffetConfig(config, menu, id(10)), '');
  for (const count of [0, -1, 1.5, 4, 101, NaN]) {
    const invalid = copy(config); invalid.groups[0].required_count = count;
    assert.ok(buffet.validateBuffetConfig(invalid));
  }
  const duplicate = copy(config); duplicate.groups.push({ ...duplicate.groups[0], id: 'rice' });
  assert.ok(buffet.validateBuffetConfig(duplicate));
  duplicate.groups[1].menu_item_ids = [id(5), id(6)]; duplicate.groups[1].id = 'main';
  assert.ok(buffet.validateBuffetConfig(duplicate));
  for (const invalid of [{}, [], 'bad', { version: 2, groups: [] }, { version: 1, groups: [null] }])
    assert.ok(buffet.validateBuffetConfig(invalid));
});
test('wrong caterer, missing items and category mismatch fail validation', () => {
  assert.ok(buffet.validateBuffetConfig(config, menu, id(11)));
  assert.ok(buffet.validateBuffetConfig(config, menu.slice(1), id(10)));
  assert.ok(buffet.validateBuffetConfig(config, menu.map(item => ({ ...item, category: 'dessert' })), id(10)));
});
test('Rice group can use Main Course without changing menu categories', () => {
  const rice = copy(config); rice.groups[0].label = 'Rice';
  assert.equal(buffet.validateBuffetConfig(rice, menu, id(10)), '');
});
test('default group template has no fabricated dishes and permits an incomplete draft', () => {
  const draft = buffet.createBuffetConfig();
  assert.equal(draft.groups.map(group => group.required_count).join(','), '1,5,1,1');
  assert.ok(draft.groups.every(group => group.menu_item_ids.length === 0));
  assert.equal(buffet.validateBuffetConfig(draft, menu, id(10), false), '');
  assert.ok(buffet.validateBuffetConfig(draft, menu, id(10)));
  draft.groups[0].required_count = -1;
  assert.ok(buffet.validateBuffetConfig(draft, menu, id(10), false));
});
test('eligible dish UUIDs cannot be duplicated using letter case', () => {
  const duplicate = copy(config);
  duplicate.groups[0].menu_item_ids = ['aaaaaaaa-0000-0000-0000-000000000001', 'AAAAAAAA-0000-0000-0000-000000000001'];
  assert.ok(buffet.validateBuffetConfig(duplicate));
});
test('catalog validation loads every page and validates menu ownership before publication', async () => {
  const firstPage = Array.from({ length: 500 }, (_, index) => ({ id: id(index + 100), name: `Catalog ${index}`, category: 'main_course', caterer_id: id(10) }));
  let page = 0;
  const fake = { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ range: async () => ({ data: page++ % 2 === 0 ? firstPage : menu }) }) }) }) }),
    rpc: async () => ({ data: { version: 1, booking_enabled: false } }) };
  const backend = load('caterconnect-mobile/lib/buildYourOwnBackend.ts', { './supabase': { supabase: fake }, './buildYourOwn': buffet });
  assert.equal((await backend.loadBuffetMenu(id(10))).length, 503);
  await backend.validateBuffetCatalog(config, id(10));
  await assert.rejects(backend.validateBuffetCatalog(config, id(11)));
});
test('network exceptions cannot enable the feature or block legacy booking projections', async () => {
  const backend = load('caterconnect-mobile/lib/buildYourOwnBackend.ts', { './supabase': { supabase: { rpc: async () => { throw new Error('offline'); } } }, './buildYourOwn': buffet });
  assert.equal((await backend.getBuffetCapabilities()).booking_enabled, false);
  assert.equal(await backend.withPackageSnapshot('id'), 'id');
  await assert.rejects(backend.requireBuffetBackend(true));
});
test('toggle preserves previous state, enforces maximum and permits deselection', () => {
  const initial = {};
  let selected = buffet.toggleBuffetDish(config, initial, 'main', id(1));
  selected = buffet.toggleBuffetDish(config, selected, 'main', id(2));
  assert.deepEqual(initial, {});
  assert.equal(buffet.toggleBuffetDish(config, selected, 'main', id(3)), selected);
  assert.equal(buffet.validateBuffetSelections(config, selected), '');
  selected = buffet.toggleBuffetDish(config, selected, 'main', id(1));
  assert.equal(selected.main.length, 1);
  assert.ok(buffet.validateBuffetSelections(config, selected));
});
test('custom group IDs matching object properties have ordinary empty selection state', () => {
  const custom = copy(config);
  custom.groups[0].id = 'constructor';
  assert.ok(buffet.validateBuffetSelections(custom, {}));
  let selected = buffet.toggleBuffetDish(custom, {}, 'constructor', id(1));
  selected = buffet.toggleBuffetDish(custom, selected, 'constructor', id(2));
  assert.equal(buffet.validateBuffetSelections(custom, selected), '');
  assert.equal(buffet.buffetSelectionInput(custom, selected).groups[0].menu_item_ids.length, 2);
});
test('exact counts, invalid IDs, duplicate choices and unknown groups are rejected', () => {
  for (const selected of [{}, { main: [id(1)] }, { main: [id(1), id(1)] }, { main: [id(1), id(9)] },
    { main: [id(1), id(2), id(3)] }, { main: [id(1), id(2)], unknown: [] }])
    assert.ok(buffet.validateBuffetSelections(config, selected));
  assert.throws(() => buffet.buffetSelectionInput(config, {}));
  const input = buffet.buffetSelectionInput(config, { main: [id(1), id(2)] });
  assert.equal(input.groups[0].menu_item_ids.length, 2);
  assert.equal(JSON.stringify(input).includes('price'), false);
});
test('included choices have no effect on fixed price, extra guests, add-ons or deposit', () => {
  const pkg = { price: 45000, guest_capacity: 100, min_guests: 50, max_guests: 150 };
  const before = pricing.calculatePackagePricing(pkg, 110, [{ price_per_guest: 50, quantity: 2 }], 25);
  const after = pricing.calculatePackagePricing({ ...pkg, build_your_own_config: config,
    package_selection_snapshot: buffet.buffetSelectionInput(config, { main: [id(1), id(2)] }) }, 110, [{ price_per_guest: 50, quantity: 2 }], 25);
  assert.equal(after.total, 60500); assert.equal(after.downpayment, 15125);
  assert.equal(JSON.stringify(after), JSON.stringify(before));
});
test('backend capability errors and incomplete setup fail closed', async () => {
  for (const response of [{ error: { code: 'PGRST202' }, data: null }, { error: null, data: { version: 0, booking_enabled: true } }]) {
    const backend = load('caterconnect-mobile/lib/buildYourOwnBackend.ts', { './supabase': { supabase: { rpc: async () => response } } });
    await assert.rejects(backend.requireBuffetBackend(true));
    assert.equal(await backend.withPackageSnapshot('id,name'), 'id,name');
  }
  const backend = load('caterconnect-mobile/lib/buildYourOwnBackend.ts', { './supabase': { supabase: { rpc: async () => ({ data: { version: 1, booking_enabled: false } }) } } });
  await backend.requireBuffetBackend();
  await assert.rejects(backend.requireBuffetBackend(true));
  assert.equal(await backend.withPackageSnapshot('id'), 'id,package_selection_snapshot');
});
test('server draft keeps pricing and RLS intact, validates ownership, and freezes snapshots', () => {
  const sql = read('supabase/proposals/build_your_own.DRAFT.sql');
  assert.ok(sql.includes('DRAFT ONLY:'));
  for (const fragment of ['FOR SHARE', 'Duplicate included dish', 'Duplicate eligible dish',
    'm.caterer_id=NEW.caterer_id', "m.category=g->>'category'", 'Package selection snapshot is immutable',
    'Included dishes must be separate from paid add-ons', "NEW.customized_items,'[]'", 'booking_enabled boolean NOT NULL DEFAULT false'])
    assert.ok(sql.includes(fragment), fragment);
  assert.ok(!/CREATE OR REPLACE|CREATE POLICY|ALTER POLICY|UPDATE public.bookings|NEW\.total_cost\s*:=|NEW\.customized_items\s*:=/i.test(sql));
});
test('historical details render saved dish names and services independently of current catalog', () => {
  const react = require('react');
  const render = require('react-dom/server').renderToStaticMarkup;
  const components = load('caterconnect-web/src/components/BuffetChoices.tsx', {
    react, 'react/jsx-runtime': require('react/jsx-runtime'), '../lib/supabase': {},
    '../lib/buildYourOwn': buffet, '../lib/buildYourOwnBackend': {},
  });
  const snapshot = { version: 1, package_type: 'build_your_own', package_name: 'Saved Package', includes: ['Saved buffet setup'],
    groups: [{ id: 'main', label: 'Main Dishes', category: 'main_course', items: [{ menu_item_id: id(1), name: 'Original selected dish' }] }] };
  const html = render(react.createElement(components.PackageSnapshotDetails, { snapshot }));
  for (const text of ['Build Your Own Package', 'Saved Package', 'Saved buffet setup', 'Original selected dish']) assert.ok(html.includes(text));
  assert.ok(render(react.createElement(components.PackageSnapshotDetails, {})).includes('Standard Package'));
});
test('picker renders the exact counter, checked choices and disabled remaining choices', () => {
  const react = require('react');
  const render = require('react-dom/server').renderToStaticMarkup;
  const components = load('caterconnect-web/src/components/BuffetChoices.tsx', {
    react, 'react/jsx-runtime': require('react/jsx-runtime'), '../lib/buildYourOwn': buffet, '../lib/buildYourOwnBackend': {},
  });
  const html = render(react.createElement(components.BuffetDishPicker, {
    config, selections: { main: [id(1), id(2)] }, menu, onChange: () => {},
  }));
  assert.ok(html.includes('2/2 selected'));
  assert.equal((html.match(/checked=""/g) ?? []).length, 2);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 1);
});
