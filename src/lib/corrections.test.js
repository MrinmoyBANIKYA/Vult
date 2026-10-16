import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { buildOutputs, runPipeline } from './pipeline.js';
import { makeCorrection, rowsOnPage } from './corrections.js';
import { UK_PAGE_TEXTS, fakeUkLlm } from './fixtures/uk-annual-report.js';

// The UK fixture plus a note page carrying depreciation, which the cash flow statement does not print.
const PAGES = {
  ...UK_PAGE_TEXTS,
  9: [
    '20. Cash generated from operations',
    'Notes   2025   2024',
    '£m   £m',
    'Profit before tax   120.0   98.0',
    'Depreciation and amortisation   45.0   42.0',
    'Increase in working capital   (5.0)   (3.0)',
    'Cash generated from operations   190.0   170.0',
    'The group spent 12.5 on restructuring during the year.'
  ].join('\n')
};

const first = () => runPipeline({ pageTexts: PAGES, fileName: 'halden-ar-2025.pdf', llm: fakeUkLlm() });
const rerun = (result, corrections) =>
  buildOutputs({
    extraction: { ...result.extraction, corrections },
    overrides: {},
    peers: [],
    narrative: result.narrative,
    llm: fakeUkLlm()
  });

test('maps a line item to a row on a note page; values are still read from the page', async () => {
  const result = await first();
  assert.ok(!result.extraction.facts.some(f => f.key === 'depreciation_amortization'));
  const row = rowsOnPage(PAGES, 9).find(r => r.label === 'Depreciation and amortisation');
  const fix = makeCorrection({
    statement: 'cashflow',
    key: 'depreciation_amortization',
    action: 'remap',
    rows: [row],
    reason: 'D&A is in note 20, not on the face of the cash flow statement.',
    by: 'A. Analyst'
  });
  const out = await rerun(result, [fix]);
  const da = out.extraction.facts.filter(f => f.key === 'depreciation_amortization');
  assert.deepEqual(
    da.map(f => [f.period, f.value, f.page, f.correction]),
    [
      ['2025', 45, 9, fix.id],
      ['2024', 42, 9, fix.id]
    ]
  );
  assert.equal(out.model.base.da, 45);
  // The D&A figures are re-read from the note page like any other.
  assert.ok(
    out.assay.checks.some(c => c.title === 'Figure matches the filing' && c.passed && /D&A FY2025/.test(c.detail))
  );
  assert.deepEqual(
    out.assay.checks.filter(c => !c.passed && c.group !== 'workbook').map(c => c.detail),
    []
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(out.workbook);
  const log = wb.getWorksheet('Corrections');
  assert.ok(log);
  assert.equal(log.getCell('B4').value, 'A. Analyst');
});

test('clearing a wrong match and entering a figure by hand are both checked', async () => {
  const result = await first();
  const cleared = makeCorrection({
    statement: 'income',
    key: 'interest_expense',
    action: 'clear',
    reason: 'Finance costs include lease interest; we model them separately.',
    by: 'A. Analyst'
  });
  const found = makeCorrection({
    statement: 'income',
    key: 'exceptional_items',
    action: 'manual',
    values: { 2025: -12.5 },
    page: 9,
    reason: 'Restructuring cost is described in the note text.',
    by: 'A. Analyst'
  });
  const missing = makeCorrection({
    statement: 'income',
    key: 'exceptional_items',
    action: 'manual',
    values: { 2025: -13 },
    page: 9,
    reason: 'Typed from memory.',
    by: 'A. Analyst'
  });
  const ok = await rerun(result, [cleared, found]);
  assert.ok(!ok.extraction.facts.some(f => f.key === 'interest_expense'));
  const check = ok.assay.checks.find(c => c.title === 'Analyst figure appears on its page');
  assert.equal(check.passed, true);
  // A later correction for the same line item replaces the earlier one.
  const bad = await rerun(result, [cleared, found, missing]);
  const flagged = bad.assay.checks.find(c => c.title === 'Analyst figure appears on its page');
  assert.equal(flagged.passed, false);
  assert.match(flagged.detail, /is not printed on PDF page 9/);
});

test('a correction needs a reason', () => {
  assert.throws(
    () => makeCorrection({ statement: 'income', key: 'revenue', action: 'clear', reason: ' ', by: 'A' }),
    /reason/
  );
});
