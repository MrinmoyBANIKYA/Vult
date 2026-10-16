import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { fillTemplate, resolvePeriod } from './template.js';
import { runPipeline } from './pipeline.js';
import { UK_PAGE_TEXTS, fakeUkLlm } from './fixtures/uk-annual-report.js';

async function houseTemplate() {
  const wb = new ExcelJS.Workbook();
  const model = wb.addWorksheet('Model');
  model.getCell('A1').value = 'House model';
  model.getCell('C5').value = { formula: 'C3-C4' }; // the firm's own formula, which must survive
  model.getCell('A3').value = 'Revenue';
  wb.definedNames.add("'Model'!$C$3", 'vult.income.revenue.FY0');
  wb.definedNames.add("'Model'!$B$3", 'vult.income.revenue.FY-1');
  wb.definedNames.add("'Model'!$C$9", 'vult.cashflow.depreciation_amortization.FY0');
  const map = wb.addWorksheet('Vult map');
  map.addRow(['Line item', 'Year', 'Cell']);
  map.addRow(['balance:total_equity', 'FY0', 'Model!C7']);
  map.addRow(['balance:total_equity', '2024', 'Model!B7']);
  map.addRow(['income:nonsense', 'FY0', 'Model!C8']);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

test('resolves relative and absolute years', () => {
  const periods = ['2023', '2024', '2025'];
  assert.equal(resolvePeriod('FY0', periods), '2025');
  assert.equal(resolvePeriod('FY-2', periods), '2023');
  assert.equal(resolvePeriod('FY-3', periods), null);
  assert.equal(resolvePeriod('2024', periods), '2024');
});

test('fills a house template by defined names and a map sheet, with sources, and leaves the rest alone', async () => {
  const { extraction, model } = await runPipeline({
    pageTexts: UK_PAGE_TEXTS,
    fileName: 'halden.pdf',
    llm: fakeUkLlm()
  });
  const out = await fillTemplate(await houseTemplate(), {
    facts: extraction.facts,
    unit: model.unit,
    fileName: 'halden.pdf'
  });
  assert.equal(out.filled.length, 4);
  assert.deepEqual(
    out.missing.map(m => m.name),
    ['D&A']
  );
  assert.equal(out.problems.length, 1);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(out.buffer);
  const sheet = wb.getWorksheet('Model');
  assert.equal(sheet.getCell('C3').value, 820);
  assert.equal(sheet.getCell('B3').value, 760);
  assert.equal(sheet.getCell('C7').value, 430);
  assert.equal(sheet.getCell('B7').value, 346);
  assert.match(String(sheet.getCell('C3').note?.texts?.[0]?.text ?? sheet.getCell('C3').note), /page 5/);
  assert.equal(sheet.getCell('C5').value.formula, 'C3-C4');
});
