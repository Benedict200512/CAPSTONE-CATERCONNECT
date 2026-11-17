// Offline cross-platform compatibility regressions: no SQL, accounts or network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(read(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText, { module, exports: module.exports });
  return module.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
for (const file of ['caterconnect-web/src/lib/buildYourOwn.ts', 'caterconnect-mobile/lib/buildYourOwn.ts']) {
  const api = load(file);
  const menu = [{ id: id(1), name: 'Garlic Rice', category: 'rice', caterer_id: id(10) },
    { id: id(2), name: 'Pork dish', category: 'pork_dishes', caterer_id: id(10) }];
  const config = { version: 1, groups: [{ id: 'rice', label: 'Rice', category: 'rice', required_count: 1, menu_item_ids: [id(1)] }] };
  test(`${file}: original categories and defaults remain valid`, () => {
    for (const key of ['main_course', 'appetizer', 'dessert', 'drink']) assert.equal(api.isMenuCategory(key), true);
    assert.equal(api.createBuffetConfig().groups[3].category, 'main_course');
  });
  test(`${file}: canonical normalization and separator/case duplicates`, () => {
    for (const input of ['Rice', ' rice ', 'RICE']) assert.equal(api.normalizeMenuCategory(input), 'rice');
    for (const input of ['Pork Dishes', 'Pork-Dishes', 'pork__dishes', 'Pork - Dishes']) assert.equal(api.normalizeMenuCategory(input), 'pork_dishes');
    assert.equal(api.normalizeMenuCategory('Main Course'), 'main_course');
  });
  test(`${file}: unsupported, oversized and noncanonical categories fail`, () => {
    for (const input of ['', ' ', 'Rice!', 'Café', 'rice\t', 'rice\n', 'rice\r\n', '🍚', '-rice', 'rice_', 'a'.repeat(51)]) assert.equal(api.normalizeMenuCategory(input), null);
    for (const input of [null, 12, 'Rice', ' rice', 'rice\n', 'rice\r\n', 'rice__dish', 'rice-dish', 'a'.repeat(51)]) assert.equal(api.isMenuCategory(input), false);
    assert.equal(api.isMenuCategory('a'.repeat(50)), true);
    assert.equal(api.normalizeMenuCategory('a'.repeat(50)), 'a'.repeat(50));
  });
  test(`${file}: display labels and dynamic catalog grouping`, () => {
    const source = ['pork_dishes', 'rice', 'dessert', 'main_course', 'rice', 'pasta', 'appetizer', 'drink', 'constructor'].map(category => ({ category }));
    assert.deepEqual(plain(api.menuCategoryKeys(source)), ['main_course', 'appetizer', 'dessert', 'drink', 'constructor', 'pasta', 'pork_dishes', 'rice']);
    assert.equal(api.menuCategoryLabel('pork_dishes'), 'Pork Dishes');
    assert.equal(api.menuCategoryLabel('rice'), 'Rice');
    assert.deepEqual(plain(api.menuCategoryKeys([])), []);
  });
  test(`${file}: catalogs remain independent`, () => {
    assert.deepEqual(plain(api.menuCategoryKeys([menu[0]])), ['rice']);
    assert.deepEqual(plain(api.menuCategoryKeys([menu[1]])), ['pork_dishes']);
    assert.equal(api.validateBuffetConfig(config, menu, id(11)).length > 0, true);
  });
  test(`${file}: Rice Choose 1 with exact immutable input payload`, () => {
    const before = JSON.stringify({ config, menu });
    assert.equal(api.validateBuffetConfig(config, menu, id(10)), '');
    assert.equal(api.validateBuffetSelections(config, {} ).length > 0, true);
    const selected = api.toggleBuffetDish(config, {}, 'rice', id(1));
    assert.equal(api.validateBuffetSelections(config, selected), '');
    assert.deepEqual(plain(api.buffetSelectionInput(config, selected)), { version: 1, groups: [{ id: 'rice', menu_item_ids: [id(1)] }] });
    assert.equal(api.buffetReviewGroups(config, selected, menu)[0].names[0], 'Garlic Rice');
    assert.equal(JSON.stringify({ config, menu }), before);
  });
  test(`${file}: no mixed categories or duplicate IDs`, () => {
    const mixed = plain(config); mixed.groups[0].menu_item_ids.push(id(2));
    assert.ok(api.validateBuffetConfig(mixed, menu, id(10)));
    const duplicate = plain(config); duplicate.groups.push({ ...duplicate.groups[0], id: 'other' });
    assert.ok(api.validateBuffetConfig(duplicate, menu, id(10)));
    assert.ok(api.validateBuffetSelections(config, { rice: [id(1), id(1)] }));
    assert.ok(api.validateBuffetSelections(config, { rice: [id(2)] }));
  });
  test(`${file}: standard package flow still needs no included selections`, () => {
    assert.equal(api.validateBuffetConfig(null), '');
    assert.equal(api.validateBuffetSelections(null, {}), '');
    assert.ok(api.validateBuffetSelections(null, { rice: [id(1)] }));
  });
  test(`${file}: custom-category add-ons retain guest pricing and downpayment`, () => {
    const pricing = load(file.replace('buildYourOwn.ts', 'packagePricing.ts'));
    const pkg = { price: 45000, guest_capacity: 100, min_guests: 50, max_guests: 200 };
    const base = pricing.calculatePackagePricing(pkg, 120, [], 25);
    const paid = pricing.calculatePackagePricing(pkg, 120, [{ ...menu[1], price_per_guest: 25, quantity: 2 }], 25);
    assert.equal(base.total, 54000);
    assert.equal(paid.addOnTotal, 6000);
    assert.equal(paid.total, 60000);
    assert.equal(paid.downpayment, 15000);
    assert.equal(api.validateBuffetSelections(config, { rice: [id(1)] }), '');
    assert.equal(pricing.calculatePackagePricing(pkg, 120, [], 25).total, base.total);
  });
}
test('Web and Mobile category contracts are byte-identical', () => {
  assert.equal(read('caterconnect-web/src/lib/buildYourOwn.ts'), read('caterconnect-mobile/lib/buildYourOwn.ts'));
});

// Execute the actual four screen grouping callbacks with an inert JSX runtime.
// This checks custom rows and fallback icons without hooks, accounts or network.
function renderGroups(file, selections = {}) {
  const source = read(file), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let grouping;
  const declarations = [];
  function visit(node) {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d =>
      ['categories', 'MENU_CATEGORIES', 'CATEGORY_CONFIG'].includes(d.name.getText(ast)))) declarations.push(node.getText(ast));
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'menuCategoryConfig') declarations.push(node.getText(ast));
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'map' &&
      ts.isCallExpression(node.expression.expression) && node.expression.expression.expression.getText(ast) === 'menuCategoryKeys') grouping = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(grouping, 'Screen must render categories from its loaded catalog');
  const menu = ['rice', 'pork_dishes', 'pasta', 'seafood', 'main_course', 'appetizer', 'dessert', 'drink', 'constructor'].map((category, i) => ({
    id: id(i + 1), category, name: i === 0 ? 'Garlic Rice' : `Dish ${category}`, price_per_guest: 25,
    description: 'Catalog description', image_url: 'https://fixture.invalid/photo.jpg', serving_size: 1, serving_unit: 'tray',
  }));
  const api = load(file.startsWith('caterconnect-web') ? 'caterconnect-web/src/lib/buildYourOwn.ts' : 'caterconnect-mobile/lib/buildYourOwn.ts');
  const calls = [];
  const ctx = { ...api, data: { menu }, details: { menu }, menuItems: menu, buffetSelections: selections,
    customItems: [{ id: id(1), quantity: 2 }], guests: 100, getQty: () => 2,
    peso: n => `PHP ${n}`, money: n => `PHP ${n}`, MAX_ITEM_QUANTITY: 999999999, MAX_ADD_ON_ITEMS: 100,
    adjustAddOn: (...args) => calls.push(args), addItem: item => calls.push([item]), removeItem: item => calls.push([item]),
    Colors: { orange: '#f97316', textSecondary: '#64748b', white: '#fff' },
    styles: new Proxy({}, { get: () => ({}) }), s: new Proxy({}, { get: () => ({}) }),
  };
  for (const name of ['UtensilsCrossed', 'Utensils', 'Soup', 'Cake', 'Wine', 'View', 'Text', 'Image', 'Scale', 'TouchableOpacity', 'Minus', 'Plus']) ctx[name] = name;
  const jsx = (type, props, key) => ({ type, props, key });
  const module = { exports: {} };
  const code = declarations.join('\n') + '\nmodule.exports = ' + grouping.getText(ast) + ';';
  const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(js, { ...ctx, module, exports: module.exports, require: name => {
    assert.equal(name, 'react/jsx-runtime'); return { jsx, jsxs: jsx };
  } });
  return { rows: plain(module.exports), menu, calls };
}
for (const file of [
  'caterconnect-web/src/pages/customer/customerCatererDetails.tsx',
  'caterconnect-web/src/pages/customer/CustomerBookNow.tsx',
  'caterconnect-mobile/app/(tabs)/caterer/[catererId].tsx',
  'caterconnect-mobile/app/(tabs)/book/[catererId].tsx',
]) {
  test(`${file}: actual grouping renders all original and custom catalog rows`, () => {
    const { rows, menu } = renderGroups(file);
    assert.equal(rows.filter(Boolean).length, 9);
    const rendered = JSON.stringify(rows);
    for (const item of menu) assert.ok(rendered.includes(item.name), item.name);
    for (const label of ['Rice', 'Pork Dishes', 'Pasta', 'Seafood', 'Constructor']) assert.ok(rendered.includes(label), label);
    assert.ok(rendered.includes('Catalog description'));
    assert.ok(rendered.includes('https://fixture.invalid/photo.jpg'));
  });
  if (file.includes('CustomerBookNow') || file.includes('/book/')) {
    test(`${file}: included custom dishes are excluded from paid add-on sections`, () => {
      const { rows } = renderGroups(file, { rice: [id(1)] });
      assert.ok(!JSON.stringify(rows).includes('Garlic Rice'));
      assert.ok(JSON.stringify(rows).includes('Dish pork_dishes'));
    });
  }
}
