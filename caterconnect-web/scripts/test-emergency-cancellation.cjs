// Pure date/navigation checks and component rendering. No Supabase or payment calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');
const root = path.resolve(__dirname, '../..');
for (const extension of ['.ts', '.tsx']) {
  Module._extensions[extension] = (module, filename) => {
    const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    });
    module._compile(result.outputText, filename);
  };
}
const web = require('../src/lib/emergencyCancellation.ts');
const mobile = require(path.join(root, 'caterconnect-mobile/lib/emergencyCancellation.ts'));
const now = Date.parse('2026-11-15T04:00:00Z');
const originalNow = Date.now;
Date.now = () => now;
let count = 0;
function check(name, fn) { fn(); count++; console.log(`PASS ${name}`); }
for (const api of [web, mobile]) {
  for (const days of [30, 8, 7, 3, 1, 0, -1]) {
    const event = new Date(Date.UTC(2026, 10, 15 + days)).toISOString().slice(0, 10);
    check(`event ${days} days away`, () => {
      assert.equal(api.daysUntilEvent(event, now), days);
      assert.equal(api.isUrgentEvent(event, now), days >= 0 && days <= 7);
    });
  }
  check('Philippine midnight changes seven-day boundary', () => {
    assert.equal(api.isUrgentEvent('2026-11-23', Date.parse('2026-11-15T15:59:59Z')), false);
    assert.equal(api.isUrgentEvent('2026-11-23', Date.parse('2026-11-15T16:00:00Z')), true);
  });
  check('invalid dates and timestamps are not urgent', () => {
    for (const date of [null, '', '2026-02-30', '2026-13-01', 'not-a-date']) {
      assert.equal(api.daysUntilEvent(date, now), null);
      assert.equal(api.isUrgentEvent(date, now), false);
    }
    assert.equal(api.daysUntilEvent('2026-11-15', NaN), null);
  });
  check('search preserves quotation and event context, without private payment fields', () => {
    const params = api.alternativeCatererParams({ event_date: '2026-11-18', event_type: 'Wedding', venue: 'Example venue', guest_count: 100, total_cost: 40000, downpayment_amount: 10000, refund_account_details: 'private' });
    assert.deepEqual(params, { alternative: '1', eventDate: '2026-11-18', eventType: 'Wedding', venue: 'Example venue', guests: '100', budget: '40000.00' });
    assert.equal(api.readAlternativeSearch(params).budget, '40000.00');
  });
  check('malformed route data cannot become invalid numeric filters', () => {
    assert.equal(api.readAlternativeSearch(null), null);
    assert.equal(api.readAlternativeSearch({}), null);
    const context = api.readAlternativeSearch({ alternative: '1', eventDate: 'bad', guests: '-1', budget: 'Infinity', eventType: ['Wedding'] });
    assert.equal(context.guests, ''); assert.equal(context.budget, '');
    assert.equal(context.eventDate, ''); assert.equal(context.eventType, 'All');
  });
}
check('Web/Mobile presentation helpers remain identical', () => {
  assert.equal(fs.readFileSync(path.join(root, 'caterconnect-web/src/lib/emergencyCancellation.ts'), 'utf8').replaceAll('\r', ''), fs.readFileSync(path.join(root, 'caterconnect-mobile/lib/emergencyCancellation.ts'), 'utf8').replaceAll('\r', ''));
});
const WebNotice = require('../src/components/CustomerEmergencyAssistance.tsx').default;
const booking = { status: 'cancelled', cancelled_by: 'caterer', event_date: '2026-11-18', event_type: 'Wedding', venue: 'Example venue', guest_count: 100, total_cost: 40000, refund_amount: 10000, refund_status: 'pending', refund_due_at: null };
const html = value => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(WebNotice, { booking: value })));
check('Web notice links to existing browse route only for caterer cancellation', () => {
  assert.match(html(booking), /href="\/customer"/);
  assert.match(html(booking), /Find Alternative Caterers/);
  assert.equal(html({ ...booking, cancelled_by: 'customer' }), '');
  assert.equal(html({ ...booking, status: 'paid' }), '');
});
check('Web urgent assistance includes exactly seven days but excludes thirty', () => {
  assert.match(html({ ...booking, event_date: '2026-11-22' }), /Urgent assistance/);
  assert.doesNotMatch(html({ ...booking, event_date: '2026-12-15' }), /Urgent assistance/);
});
const originalLoad = Module._load;
const NativeButton = props => React.createElement('button', null, props.children);
Module._load = function (name, ...args) {
  if (name === 'react-native') return {
    StyleSheet: { create: value => value },
    View: props => React.createElement('div', null, props.children),
    Text: props => React.createElement('span', null, props.children),
    TouchableOpacity: NativeButton,
  };
  return originalLoad.call(this, name, ...args);
};
const MobileNotice = require(path.join(root, 'caterconnect-mobile/components/CustomerEmergencyAssistance.tsx')).default;
check('Mobile notice shows actual refund data, not a completion claim or guessed deadline', () => {
  const output = renderToStaticMarkup(React.createElement(MobileNotice, { booking, onFind() {} }));
  assert.match(output, /10,000/); assert.match(output, /Pending transfer/); assert.match(output, /Not recorded/);
  assert.doesNotMatch(output, /refund (?:was|is) completed/i);
  assert.equal(MobileNotice({ booking: { ...booking, cancelled_by: 'customer' }, onFind() {} }), null);
});
check('Mobile assistance uses the same seven-day boundary', () => {
  const render = event_date => renderToStaticMarkup(React.createElement(MobileNotice, { booking: { ...booking, event_date }, onFind() {} }));
  assert.match(render('2026-11-22'), /Urgent assistance/);
  assert.doesNotMatch(render('2026-12-15'), /Urgent assistance/);
});
check('Mobile alternative button stops card propagation and invokes navigation callback', () => {
  let clicked = false, stopped = false;
  const tree = MobileNotice({ booking, onFind: () => { clicked = true; } });
  function find(node) {
    if (!node || typeof node !== 'object') return null;
    if (node.type === NativeButton) return node;
    for (const child of React.Children.toArray(node.props?.children)) { const result = find(child); if (result) return result; }
    return null;
  }
  const button = find(tree); assert.ok(button);
  button.props.onPress({ stopPropagation() { stopped = true; } });
  assert.equal(clicked, true); assert.equal(stopped, true);
});
console.log(`${count} emergency cancellation checks passed; no database operations.`);
Date.now = originalNow;
