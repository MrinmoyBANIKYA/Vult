import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectCover,
  detectUnit,
  mappingProblems,
  parseCell,
  resolveFacts,
  sectionText,
  selectStatementPages,
  splitRow,
  statementRows
} from './filing.js';
import { PAGE_TEXTS } from './fixtures/annual-report.js';

test('selects the statement pages, not the index that names them', () => {
  const selected = selectStatementPages(PAGE_TEXTS);
  assert.deepEqual(
    selected.map(page => [page.page, page.statement]),
    [
      [3, 'income'],
      [4, 'balance'],
      [5, 'cashflow']
    ]
  );
});

test('rejects reports where a financial statement is not identifiable', () => {
  assert.throws(() => selectStatementPages({ 1: 'Revenue 100 Net income 10' }), /Could not identify all three/);
});

test('parses printed cells, brackets and dashes', () => {
  assert.equal(parseCell('(1,234)'), -1234);
  assert.equal(parseCell('$ 93,736'), 93736);
  assert.equal(parseCell('—'), 0);
  assert.deepEqual(splitRow('Net income   $   175   $   135'), { label: 'Net income', cells: ['175', '135'] });
  assert.deepEqual(splitRow('Total assets   $   411,976 $   364,840'), {
    label: 'Total assets',
    cells: ['411,976', '364,840']
  });
  assert.deepEqual(splitRow('Net sales . . . . . . . . . . $   237,710 $   222,730'), {
    label: 'Net sales',
    cells: ['237,710', '222,730']
  });
  assert.deepEqual(splitRow('Total net sales 391,035 383,285'), {
    label: 'Total net sales',
    cells: ['391,035', '383,285']
  });
});

test('aligns rows to year columns and joins wrapped labels', () => {
  const rows = statementRows([{ page: 5, text: PAGE_TEXTS[5] }]);
  const wc = rows.find(row => row.label.startsWith('Changes in operating'));
  assert.equal(wc.label, 'Changes in operating assets and liabilities');
  assert.deepEqual(wc.periods, ['2025', '2024', '2023']);
  assert.deepEqual(wc.values, [-25, -10, -5]);
  assert.equal(wc.quote, 'Changes in operating assets and\nliabilities   (25)   (10)   (5)');
  const shares = rows.find(row => row.label.startsWith('Proceeds'));
  assert.deepEqual(shares.values, [0, 0, 0]);
});

test('finds mislabelled rows and totals that do not tie in a mapping', () => {
  const text = [
    'Year ended   2023   2022',
    'Net sales   1,000   900',
    'Merchandise costs   800   700',
    'Selling, general and administrative   150   140',
    'Operating income   50   60'
  ].join('\n');
  const rows = statementRows([{ page: 3, text }]);
  const unit = { scale: 1e6 };
  const right = { revenue: [1], cost_of_revenue: [2], operating_expenses: [3], operating_income: [4] };
  assert.deepEqual(mappingProblems('income', rows, right, unit), []);
  const wrong = {
    revenue: [1],
    cost_of_revenue: [1],
    gross_profit: [4],
    operating_expenses: [2],
    operating_income: [4]
  };
  const problems = mappingProblems('income', rows, wrong, unit);
  assert.ok(problems.some(p => p.startsWith('cost_of_revenue: row 1 "Net sales"')));
  assert.ok(problems.some(p => p.startsWith('gross_profit: row 4')));
  assert.ok(problems.some(p => p.includes('do not reconcile to gross_profit')));
});

test('joins wrapped capitals labels and labels that end in a figure', () => {
  const text = [
    'Year ended   2023   2022',
    'OPERATING ACTIVITIES',
    'Net income . . . . . .   500   400',
    'EFFECT OF EXCHANGE RATE CHANGES ON CASH AND CASH',
    'EQUIVALENTS . . . . . . . .   (15)   10',
    'Common stock – shares outstanding 7,432',
    'and 7,464   93,718   86,939',
    'Payments related to repurchases of common stock',
    '(40,086)   (33,706)',
    '45'
  ].join('\n');
  const rows = statementRows([{ page: 9, text }]);
  assert.deepEqual(
    rows.map(row => [row.label, row.values]),
    [
      ['Net income', [500, 400]],
      ['EFFECT OF EXCHANGE RATE CHANGES ON CASH AND CASH EQUIVALENTS', [-15, 10]],
      ['Common stock – shares outstanding 7,432 and 7,464', [93718, 86939]],
      ['Payments related to repurchases of common stock', [-40086, -33706]]
    ]
  );
  assert.equal(rows[0].section, 'OPERATING ACTIVITIES');
});

test('reads unit, cover and narrative sections', () => {
  assert.deepEqual(detectUnit(PAGE_TEXTS[3]), { label: 'USD millions', currency: 'USD', scale: 1e6 });
  assert.deepEqual(detectCover(PAGE_TEXTS), { company: 'Halden Instruments plc', yearEnd: 'December 31, 2025' });
  assert.deepEqual(sectionText(PAGE_TEXTS, /^item\s*1a\.?\s*risk factors/i, 500).pages, [7]);
});

test('turns a row mapping into one fact per year, and reports rows that cannot be aligned', () => {
  const rows = statementRows([{ page: 3, text: PAGE_TEXTS[3] }]);
  const revenue = rows.find(row => row.label === 'Revenue');
  const broken = { ...rows[1], id: 999, periods: null };
  const { facts, issues } = resolveFacts(
    'income',
    [...rows, broken],
    { revenue: [revenue.id], net_income: [999] },
    detectUnit(PAGE_TEXTS[3])
  );
  assert.deepEqual(
    facts.map(f => [f.period, f.value, f.page]),
    [
      ['2025', 1250, 3],
      ['2024', 1100, 3],
      ['2023', 980, 3]
    ]
  );
  assert.equal(issues.length, 1);
});
