import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { parseCsv, readSpreadsheetBytes, rowsToText } from './spreadsheet-input.js';
import { runPipeline } from './pipeline.js';
import { fakeUkLlm } from './fixtures/uk-annual-report.js';

// A data-room workbook: one sheet per statement, years as numbers, totals as formulas with cached results.
async function dataRoomWorkbook() {
  const wb = new ExcelJS.Workbook();
  const sheet = (name, rows) => {
    const ws = wb.addWorksheet(name);
    rows.forEach(r => ws.addRow(r));
    return ws;
  };
  sheet('P&L', [
    ['Halden Group plc', null, null],
    ['£m', 2025, 2024],
    ['Revenue', 820, 760],
    ['Cost of sales', -480, -450],
    ['Gross profit', { formula: 'B3+B4', result: 340 }, { formula: 'C3+C4', result: 310 }],
    ['Administrative expenses', -200, -190],
    ['Operating profit', 140, 120],
    ['Finance costs', -20, -22],
    ['Profit before tax', 120, 98],
    ['Taxation', -30, -24.5],
    ['Profit for the year', 90, 73.5]
  ]);
  sheet('Balance sheet', [
    ['£m', 2025, 2024],
    ['Non-current assets', null, null],
    ['Property, plant and equipment', 300, 280],
    ['Total non-current assets', 500, 485],
    ['Current assets', null, null],
    ['Cash and cash equivalents', 100, 60],
    ['Total current assets', 300, 245],
    ['Total assets', 800, 730],
    ['Current liabilities', null, null],
    ['Borrowings', -20, -20],
    ['Total current liabilities', -150, -140],
    ['Non-current liabilities', null, null],
    ['Borrowings', -150, -170],
    ['Total non-current liabilities', -220, -244],
    ['Total liabilities', -370, -384],
    ['Net assets', 430, 346],
    ['Total equity', 430, 346]
  ]);
  sheet('Cash flow', [
    ['£m', 2025, 2024],
    ['Cash flows from operating activities', null, null],
    ['Net cash from operating activities', 162, 145],
    ['Cash flows from investing activities', null, null],
    ['Purchase of property, plant and equipment', -60, -55],
    ['Net cash used in investing activities', -60, -55],
    ['Cash flows from financing activities', null, null],
    ['Dividends paid', -12, -10],
    ['Net cash used in financing activities', -62, -61],
    ['Net increase in cash and cash equivalents', 40, 29],
    ['Cash and cash equivalents at 1 April', 60, 31],
    ['Cash and cash equivalents at 31 March', 100, 60]
  ]);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

test('prints years as headers and every other number with separators', () => {
  assert.equal(rowsToText([['£m', 2025, 2024]]), '£m   2025   2024');
  assert.equal(rowsToText([['Revenue', 2024, 1100.5]]), 'Revenue   2,024   1,100.5');
  assert.equal(rowsToText([['Cost', -480, null, -450]]), 'Cost   (480)   (450)');
  assert.deepEqual(parseCsv('Line,2025,2024\n"Revenue, total","1,250",(30)\n'), [
    ['Line', 2025, 2024],
    ['Revenue, total', 1250, -30]
  ]);
});

test('a data-room workbook becomes a checked model, citing sheets', async () => {
  const input = await readSpreadsheetBytes(await dataRoomWorkbook(), 'halden-data-room.xlsx');
  assert.deepEqual(
    input.sheets.map(s => s.name),
    ['P&L', 'Balance sheet', 'Cash flow']
  );
  assert.match(input.pageTexts[1], /^P&L\nIncome statement\n/);
  assert.match(input.pageTexts[1], /Gross profit {3}340 {3}310/);
  const out = await runPipeline({ pageTexts: input.pageTexts, fileName: 'halden-data-room.xlsx', llm: fakeUkLlm() });
  assert.equal(out.model.base.revenue, 820);
  assert.equal(out.model.base.tl, 370);
  assert.equal(out.model.base.ta - out.model.base.tle, 0);
  const sourceFlags = out.assay.checks.filter(c => c.group === 'source' && !c.passed);
  assert.deepEqual(
    sourceFlags.map(c => c.detail),
    []
  );
  assert.deepEqual([...new Set(out.extraction.facts.map(f => f.page))].sort(), [1, 2, 3]);
});
