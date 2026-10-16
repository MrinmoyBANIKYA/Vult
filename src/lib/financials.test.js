import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import ExcelJS from 'exceljs';
import { detectSector } from './financials.js';
import { runPipeline } from './pipeline.js';
import { BANK_PAGE_TEXTS, fakeBankLlm } from './fixtures/bank-annual-report.js';
import { PAGE_TEXTS } from './fixtures/annual-report.js';
import { UK_PAGE_TEXTS, fakeUkLlm } from './fixtures/uk-annual-report.js';
import { findSoffice, recalcWorkbook } from '../../server/recalc.js';

const run = (options = {}) =>
  runPipeline({
    pageTexts: BANK_PAGE_TEXTS,
    fileName: 'halden-bank-ar-2025.pdf',
    llm: fakeBankLlm(options),
    overrides: { sharePrice: 1.5 }
  });

test('tells a bank from an industrial company by its statement wording', () => {
  assert.equal(detectSector(Object.values(BANK_PAGE_TEXTS)), 'bank');
  assert.equal(detectSector(Object.values(PAGE_TEXTS)), 'corporate');
  assert.equal(detectSector(Object.values(UK_PAGE_TEXTS)), 'corporate');
});

test('values a bank on justified price to book, with no corporate requirements flagged', async () => {
  const { model, assay, sector, workbook, memo, tearSheet } = await run();
  assert.equal(sector, 'bank');
  assert.equal(model.kind, 'financial');
  const [first, second] = model.hist;
  assert.ok(Math.abs(first.roe - 247.5 / 2250) < 1e-9);
  assert.ok(Math.abs(second.roe - 300 / ((2250 + 2700) / 2)) < 1e-9);
  const v = model.valuation;
  const coe = 0.0425 + 0.05;
  const roe = (first.roe + second.roe) / 2;
  assert.ok(Math.abs(v.pb - (roe - 0.025) / (coe - 0.025)) < 1e-9);
  assert.ok(Math.abs(v.equityValue - v.pb * 2700) < 1e-6);
  // 2,000m shares and EPS in pence.
  assert.equal(model.assumptions.shareScale, 1e6);
  assert.ok(Math.abs(v.perShare - (v.equityValue * 1e6) / (2000 * 1e6)) < 1e-9);
  assert.ok(Math.abs(v.upside - (v.perShare / 1.5 - 1)) < 1e-9);
  assert.equal(v.sensitivity.values[2][2].toFixed(6), v.perShare.toFixed(6));

  const flagged = assay.checks.filter(c => !c.passed && c.group !== 'workbook');
  assert.deepEqual(
    flagged.map(c => c.detail),
    []
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(workbook);
  assert.deepEqual(
    wb.worksheets.map(s => s.name),
    ['Cover', 'Inputs', 'Financials', 'Valuation', 'Assayer', 'Extracted Data']
  );
  assert.ok(memo.byteLength > 1000 && tearSheet.byteLength > 1000);
});

test('LibreOffice recalculates the UK and bank workbooks to the engine values', { skip: !findSoffice() }, async () => {
  const recalc = async (base64, cells) => recalcWorkbook(Buffer.from(base64, 'base64'), cells);
  for (const [pageTexts, llm] of [
    [UK_PAGE_TEXTS, fakeUkLlm({ recalc })],
    [BANK_PAGE_TEXTS, fakeBankLlm({ recalc })]
  ]) {
    const { assay } = await runPipeline({ pageTexts, fileName: 'fixture.pdf', llm, overrides: { sharePrice: 2 } });
    const cells = assay.checks.filter(c => c.group === 'workbook');
    assert.ok(cells.length >= 5, 'recalculation ran');
    assert.deepEqual(
      cells.filter(c => !c.passed).map(c => c.detail),
      []
    );
  }
});
