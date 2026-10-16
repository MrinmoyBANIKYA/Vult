import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { runPipeline } from './pipeline.js';
import { buildModel, shareScale } from './model.js';
import { PAGE_TEXTS, fakeLlm } from './fixtures/annual-report.js';
import { stripFigures } from '../../supabase/functions/_shared/statements.js';

const run = (options = {}) =>
  runPipeline({
    pageTexts: PAGE_TEXTS,
    fileName: 'halden-10k.pdf',
    llm: fakeLlm(options),
    overrides: { sharePrice: 20 }
  });

test('the forecast balance sheet balances in every year and cash ties', async () => {
  const { model } = await run();
  for (const year of model.forecast) {
    assert.ok(Math.abs(year.balanceCheck) < 1e-6, `FY${year.period} out by ${year.balanceCheck}`);
    assert.ok(Math.abs(year.cashEnding - year.cashSti) < 1e-6);
  }
  assert.equal(model.dcf.sensitivity.values[2][2].toFixed(6), model.dcf.perShare.toFixed(6));
});

test('chooses the share scale that reconciles net income to reported EPS', () => {
  assert.equal(shareScale({ netIncome: 175, shares: 100, eps: 1.75, unitScale: 1e6 }), 1e6);
  assert.equal(shareScale({ netIncome: 93736, shares: 15408095, eps: 6.08, unitScale: 1e6 }), 1e3);
  assert.equal(shareScale({ netIncome: 175, shares: 100, eps: 9, unitScale: 1e6 }), null);
});

test('overrides change the valuation', async () => {
  const { extraction } = await run();
  const low = buildModel({ facts: extraction.facts, unit: extraction.unit, overrides: { beta: 0.8 } });
  const high = buildModel({ facts: extraction.facts, unit: extraction.unit, overrides: { beta: 1.4 } });
  assert.ok(low.dcf.ev > high.dcf.ev);
});

test('writes a formula workbook whose historical cells link to the extracted source data', async () => {
  const { workbook } = await run();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(workbook);
  assert.deepEqual(
    wb.worksheets.map(sheet => sheet.name),
    ['Cover', 'Inputs', 'Income Statement', 'Balance Sheet', 'Cash Flow', 'DCF', 'Comps', 'Assayer', 'Extracted Data']
  );
  const revenue = wb.getWorksheet('Income Statement').getCell('E5');
  assert.match(revenue.value.formula, /^'Extracted Data'!E\d+$/);
  assert.equal(revenue.value.result, 1250);
  assert.match(String(revenue.note?.texts?.[0]?.text ?? revenue.note), /PDF page 3/);
  const forecastCheck = wb.getWorksheet('Balance Sheet').getCell('F19');
  assert.equal(forecastCheck.value.formula, 'F10-F18');
  assert.ok(wb.getWorksheet('DCF').getCell('C47').value.formula.startsWith('IF(C$46<=$B47'));
});

test('recalculation results become Assayer checks', async () => {
  const values = {};
  const result = await runPipeline({
    pageTexts: PAGE_TEXTS,
    fileName: 'halden-10k.pdf',
    llm: fakeLlm({
      recalc: async (_xlsx, cells) => {
        for (const ref of cells) values[ref] = null;
        return { values };
      }
    })
  });
  const workbookChecks = result.assay.checks.filter(c => c.group === 'workbook');
  assert.ok(workbookChecks.length > 5);
  assert.ok(workbookChecks.every(c => !c.passed));
});

test('memo and tear sheet are Word documents', async () => {
  const { memo, tearSheet } = await run();
  for (const doc of [memo, tearSheet]) assert.equal(String.fromCharCode(...new Uint8Array(doc).slice(0, 2)), 'PK');
});

test('figures are removed from model-written narrative', () => {
  assert.equal(
    stripFigures('It sells instruments. It grew 13% last year. It also services them.'),
    'It sells instruments. It also services them.'
  );
});
