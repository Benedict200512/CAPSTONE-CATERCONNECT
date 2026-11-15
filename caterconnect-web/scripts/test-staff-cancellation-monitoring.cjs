const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function compile(file, mocks = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(js, { exports, require(name) {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency ${name}`);
  }, Date, Intl, Number, String, Math, Map });
  return exports;
}
const dates = compile('src/lib/emergencyCancellation.ts');
const calls = [];
let response = { data: [], error: null };
const query = {};
for (const method of ['select', 'eq', 'order']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
query.range = async (...args) => { calls.push(['range', ...args]); return response; };
const api = compile('src/lib/staffCatererCancellations.ts', {
  './supabase': { supabase: { from(table) { calls.push(['from', table]); return query; } } },
  './emergencyCancellation': dates,
});
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
const row = {
  id: 'booking-example', customer_id: 'customer-reference', caterer_id: 'caterer-reference',
  status: 'cancelled', cancelled_by: 'caterer', event_date: '2020-01-10',
  cancelled_at: '2020-01-03T00:00:00Z', cancellation_reason: 'Example emergency',
  refund_amount: '1234.50', refund_status: 'awaiting_customer_confirmation', refund_due_at: null,
  caterers: { business_name: 'Example caterer' },
};
for (const days of [0, 1, 3, 7, 8, 30, -1]) check(`historical cancellation ${days} days before event`, () => {
  const cancelled_at = new Date(Date.UTC(2020, 0, 10 - days)).toISOString();
  assert.equal(api.daysBeforeEventAtCancellation({ ...row, cancelled_at }), days);
  assert.equal(api.cancellationTiming({ ...row, cancelled_at }), days >= 0 && days <= 7 ? 'urgent' : 'other');
});
check('Philippine midnight, not UTC date, determines exactly seven days', () => {
  assert.equal(api.cancellationTiming({ ...row, cancelled_at: '2020-01-02T15:59:59Z' }), 'other');
  assert.equal(api.cancellationTiming({ ...row, cancelled_at: '2020-01-02T16:00:00Z' }), 'urgent');
  assert.equal(api.daysBeforeEventAtCancellation({ ...row, cancelled_at: '2020-01-03T00:00:00+08:00' }), 7);
});
check('missing, invalid or timezone-free dates are unknown, never replaced with now', () => {
  for (const cancelled_at of [null, '', 'invalid', '2020-01-03', '2020-01-03T00:00:00']) {
    assert.equal(api.cancellationTiming({ ...row, cancelled_at }), 'unknown');
  }
  assert.equal(api.cancellationTiming({ ...row, event_date: '2020-02-30' }), 'unknown');
});
check('only caterer-initiated cancelled bookings enter the section', () => {
  const rows = [row, { ...row, cancelled_by: 'customer' }, { ...row, cancelled_by: 'system' }, { ...row, status: 'paid' }];
  assert.equal(api.filterCatererCancellations(rows, 'all').length, 1);
  assert.equal(api.filterCatererCancellations(rows, 'urgent').length, 1);
});
check('other filter excludes unknown timing; All retains unknown records', () => {
  const rows = [row, { ...row, cancelled_at: null }, { ...row, cancelled_at: '2019-12-01T00:00:00Z' }];
  assert.equal(api.filterCatererCancellations(rows, 'all').length, 3);
  assert.equal(api.filterCatererCancellations(rows, 'other').length, 1);
});
check('refund displays preserve recorded amount/status and missing data', () => {
  assert.match(api.recordedRefundAmount(row.refund_amount), /1,234\.50/);
  assert.match(api.recordedRefundAmount(0), /0\.00/);
  assert.equal(api.recordedRefundAmount(null), 'Not recorded');
  assert.equal(api.recordedRefundAmount(''), 'Not recorded');
  assert.equal(api.recordedRefundStatus(row.refund_status), 'Awaiting Customer confirmation');
  assert.equal(api.recordedRefundStatus(null), 'Not recorded');
  assert.equal(api.recordedCancellationDate(null), 'Not recorded / invalid timestamp');
});
check('new source contains no mutations, RPCs or privileged credentials', () => {
  for (const file of ['src/lib/staffCatererCancellations.ts', 'src/pages/staff/CatererCancellationMonitoring.tsx']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        assert.ok(!['insert', 'update', 'upsert', 'delete', 'rpc', 'invoke'].includes(node.expression.name.text));
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
    assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE|booking_emergency_reviews|staff_review_emergency_cancellation/);
  }
});
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const component = compile('src/pages/staff/CatererCancellationMonitoring.tsx', {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
  'react-router-dom': require('react-router-dom'), 'lucide-react': require('lucide-react'),
  '../../lib/staffCatererCancellations': api, './CatererCancellationMonitoring.css': {},
});
check('records render references, historical urgency, stored refunds and unavailable deadlines', () => {
  const html = renderToStaticMarkup(React.createElement(component.CancellationRecords, { bookings: [row] }));
  for (const text of ['booking-example', 'customer-reference', 'Example caterer', 'Example emergency', '2020-01-10', 'Urgent', 'Last-Minute Cancellation', '1,234.50', 'Awaiting Customer confirmation', 'Not recorded']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Review Approved|Review Rejected|Unjustified Cancellation|Genuine Emergency/);
});
check('section is embedded only in Account Monitoring without new route or navigation', () => {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const account = read('src/pages/staff/AccountMonitoring.tsx');
  assert.equal((account.match(/<CatererCancellationMonitoring\s*\/>/g) || []).length, 1);
  assert.ok(account.indexOf('<CatererCancellationMonitoring />') < account.indexOf('{/* ACCOUNT ACTION MODAL */}'));
  assert.ok(!read('src/pages/staff/BookingMonitor.tsx').includes('CatererCancellationMonitoring'));
  for (const file of ['src/App.tsx', 'src/components/Sidebar.tsx']) {
    assert.ok(!read(file).includes('CatererCancellationMonitoring'));
  }
  const section = read('src/pages/staff/CatererCancellationMonitoring.tsx');
  assert.ok(section.includes('Emergency Caterer Cancellations'));
  assert.ok(!section.includes('<Link') && !section.includes('Open existing Account Monitoring'));
  assert.ok(!section.includes('booking-tab-btn'));
});
(async () => {
  const result = await api.loadCatererCancellationPage(50);
  assert.equal(result.length, 0);
  assert.ok(calls.some(call => call[0] === 'from' && call[1] === 'bookings'));
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'status' && call[2] === 'cancelled'));
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'cancelled_by' && call[2] === 'caterer'));
  assert.ok(calls.some(call => call[0] === 'range' && call[1] === 50 && call[2] === 99));
  checks++; console.log('PASS existing-data query filters and pagination');
  response = { data: null, error: { code: '42501' } };
  await assert.rejects(api.loadCatererCancellationPage(0), /current permissions/);
  checks++; console.log('PASS permission errors are surfaced, not converted into empty success');
  console.log(`${checks} Staff monitoring checks passed. Mocked reads only; live RLS unverified.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
