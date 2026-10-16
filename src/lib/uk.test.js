import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUSINESS_HEADINGS,
  RISK_HEADINGS,
  detectCover,
  detectUnit,
  findSection,
  headerYears,
  selectStatementPages,
  statementRows
} from './filing.js';
import { runPipeline } from './pipeline.js';
import { UK_PAGE_TEXTS, fakeUkLlm } from './fixtures/uk-annual-report.js';

test('reads UK and IFRS column headers', () => {
  assert.deepEqual(headerYears('Notes   2025   2024'), ['2025', '2024']);
  assert.deepEqual(headerYears('2025 £m   2024 £m'), ['2025', '2024']);
  assert.deepEqual(headerYears('52 weeks ended 30 March 2025   53 weeks ended 31 March 2024'), ['2025', '2024']);
  assert.deepEqual(headerYears('2024/25   2023/24'), ['2025', '2024']);
  assert.equal(headerYears('Balance at 1 April 2024   1,000   2,000'), null);
  assert.equal(headerYears('Senior notes due 2030   500   500'), null);
});

test('reads £m and £000 units and the currency printed most often', () => {
  assert.deepEqual(detectUnit('Notes 2025 2024\n£m £m'), { label: 'GBP millions', currency: 'GBP', scale: 1e6 });
  assert.equal(detectUnit("2025 £'000   2024 £'000").scale, 1e3);
  assert.equal(detectUnit('US$m').scale, 1e6);
  assert.equal(detectUnit('(in millions, except per share) $ 1 $ 2 ... see £ note').currency, 'USD');
});

test('skips the contents page and the parent company balance sheet', () => {
  const pages = selectStatementPages(UK_PAGE_TEXTS);
  assert.deepEqual(
    pages.map(p => [p.page, p.statement]),
    [
      [5, 'income'],
      [6, 'balance'],
      [7, 'cashflow']
    ]
  );
});

test('separates a Notes column from the figures and keeps the printed column index', () => {
  const rows = statementRows([{ page: 5, text: UK_PAGE_TEXTS[5] }]);
  const revenue = rows.find(row => row.label === 'Revenue');
  assert.deepEqual(revenue.values, [820, 760]);
  assert.deepEqual(revenue.periods, ['2025', '2024']);
  assert.equal(revenue.note, '3');
  assert.equal(revenue.offset, 1);
  const eps = rows.find(row => row.label === 'Diluted');
  assert.deepEqual(eps.values, [25, 20.4]);
  assert.equal(eps.section, 'Earnings per share');
  const balance = statementRows([{ page: 6, text: UK_PAGE_TEXTS[6] }]);
  const borrowings = balance.filter(row => row.label === 'Borrowings').map(row => row.section);
  assert.deepEqual(borrowings, ['Current liabilities', 'Non-current liabilities']);
});

test('finds the company, the year end and the UK narrative sections', () => {
  const pages = selectStatementPages(UK_PAGE_TEXTS);
  assert.deepEqual(detectCover(UK_PAGE_TEXTS, pages), { company: 'Halden Group plc', yearEnd: '31 March 2025' });
  const business = findSection(UK_PAGE_TEXTS, BUSINESS_HEADINGS, 2000);
  assert.equal(business.name, 'Business model');
  assert.deepEqual(business.pages.slice(0, 1), [3]);
  const risks = findSection(UK_PAGE_TEXTS, RISK_HEADINGS, 2000);
  assert.equal(risks.name, 'Principal risks and uncertainties');
  assert.deepEqual(risks.pages.slice(0, 1), [4]);
});

test('builds a balanced, checked model from a UK annual report', async () => {
  const out = await runPipeline({ pageTexts: UK_PAGE_TEXTS, fileName: 'halden-ar-2025.pdf', llm: fakeUkLlm() });
  const { model, assay, extraction } = out;
  assert.equal(extraction.company, 'Halden Group plc');
  assert.equal(model.unit.label, 'GBP millions');
  assert.equal(model.base.revenue, 820);
  // Liabilities printed in brackets are used at their size.
  assert.equal(model.base.tcl, 150);
  assert.equal(model.base.tl, 370);
  assert.equal(model.base.ta - model.base.tle, 0);
  // EPS printed in pence reconciles with shares in millions.
  assert.equal(model.assumptions.shareScale, 1e6);
  assert.equal(model.assumptions.epsFactor, 0.01);
  assert.ok(model.dcf.perShare > 0);
  for (const f of model.forecast) assert.ok(Math.abs(f.balanceCheck) < 1e-6);

  const flagged = assay.checks.filter(c => !c.passed && c.group !== 'workbook').map(c => c.detail);
  // Depreciation sits in a note in UK cash flow statements, so it is the only line flagged as missing.
  assert.equal(flagged.length, 1, flagged.join('\n'));
  assert.match(flagged[0], /D&A was not found.*note/);
  assert.ok(assay.checks.some(c => c.title === 'Net assets equal total equity' && c.passed));
  assert.ok(assay.checks.some(c => c.title === 'Figure matches the filing' && c.passed && /page 5/.test(c.detail)));
  assert.equal(out.narrative.businessSection, 'Business model');
});
