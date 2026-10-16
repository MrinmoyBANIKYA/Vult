/**
 * Builds the three-statement model as a real .xlsx with live formulas.
 *
 * Historical cells link to the Extracted Data sheet, which carries the PDF page and printed row for
 * every figure. Forecast and valuation cells are formulas. Cached results come from model.js, and
 * `checkCells` lists cells whose recalculated values the engine compares with the model.
 * Colour convention: blue inputs, black formulas, green links to other sheets.
 */
import ExcelJS from 'exceljs';
import { FORECAST_YEARS, LIABILITY_KEYS } from './model.js';
import { MAX_PEERS, compsSummary, multiples as peerMultiples } from './comps.js';

const INK = 'FF14202B';
const NAVY = 'FF0F1E33';
const ACCENT = 'FF1F6FEB';
const MUTED = 'FF6B7785';
const LINE = 'FFD9DEE5';
const BAND = 'FFF5F7FA';
const INPUT_BLUE = 'FF0B44C4';
const INPUT_FILL = 'FFFFF8DC';
const LINK_GREEN = 'FF0B7A3B';
const FLAG = 'FFB42318';
const PASS = 'FF16794A';

const AMOUNT = '#,##0.0;(#,##0.0);"–"';
const PCT = '0.0%;(0.0%);"–"';
const MULT = '0.0"x";(0.0"x");"–"';
const PER_SHARE = '#,##0.00;(#,##0.00);"–"';

const SHEETS = {
  is: 'Income Statement',
  bs: 'Balance Sheet',
  cf: 'Cash Flow',
  dcf: 'DCF',
  comps: 'Comps',
  inputs: 'Inputs',
  assay: 'Assayer',
  corrections: 'Corrections',
  data: 'Extracted Data'
};
const IS = {
  revenue: 5,
  growth: 6,
  cogs: 7,
  gross: 8,
  opex: 9,
  ebit: 10,
  margin: 11,
  da: 12,
  ebitda: 13,
  other: 14,
  pretax: 15,
  tax: 16,
  ni: 17,
  niCheck: 18,
  eps: 19,
  shares: 20
};
const BS = {
  cash: 5,
  ncca: 6,
  tca: 7,
  ppe: 8,
  onca: 9,
  ta: 10,
  debtCur: 11,
  ndcl: 12,
  tcl: 13,
  debtNon: 14,
  oncl: 15,
  tl: 16,
  equity: 17,
  tle: 18,
  check: 19
};
const CF = {
  ni: 5,
  da: 6,
  dNcca: 7,
  dNdcl: 8,
  otherOp: 9,
  cfo: 10,
  capex: 11,
  otherInv: 12,
  cfi: 13,
  payout: 14,
  otherFin: 15,
  cff: 16,
  fx: 17,
  change: 18,
  begin: 19,
  end: 20,
  check: 21
};
const IN = {
  growth: 5,
  ebitMargin: 6,
  daPct: 7,
  capexPct: 8,
  nccaPct: 9,
  ndclPct: 10,
  payout: 11,
  otherIncome: 12,
  taxRate: 15,
  riskFree: 16,
  erp: 17,
  beta: 18,
  costOfDebt: 19,
  terminalGrowth: 20,
  sharePrice: 21,
  targetDebtWeight: 22,
  unitScale: 23,
  shareScale: 24
};

export function colLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
const q = name => `'${name}'`;
const font = (extra = {}) => ({ name: 'Calibri', size: 10, color: { argb: INK }, ...extra });

function title(sheet, text, subtitle, width) {
  sheet.mergeCells(1, 1, 1, width);
  const head = sheet.getCell(1, 1);
  head.value = text;
  head.font = font({ size: 15, bold: true, color: { argb: 'FFFFFFFF' } });
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  head.alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(1).height = 28;
  sheet.mergeCells(2, 1, 2, width);
  const sub = sheet.getCell(2, 1);
  sub.value = subtitle;
  sub.font = font({ size: 9, italic: true, color: { argb: MUTED } });
  sub.alignment = { indent: 1, wrapText: true, vertical: 'top' };
  sheet.getRow(2).height = 30;
}

function header(sheet, row, values) {
  const r = sheet.getRow(row);
  r.values = values;
  r.height = 20;
  r.eachCell(cell => {
    cell.font = font({ bold: true, color: { argb: 'FFFFFFFF' } });
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } };
    cell.alignment = { vertical: 'middle', horizontal: cell.col === 1 ? 'left' : 'right' };
  });
}

function label(sheet, row, text, { bold = false, indent = 0, italic = false } = {}) {
  const cell = sheet.getCell(row, 1);
  cell.value = text;
  cell.font = font({ bold, italic, color: { argb: italic ? MUTED : INK } });
  cell.alignment = { indent };
}

function rule(sheet, row, from, to, style = 'thin') {
  for (let c = from; c <= to; c += 1) {
    sheet.getCell(row, c).border = { top: { style, color: { argb: style === 'double' ? INK : LINE } } };
  }
}

/** Builds the workbook. Returns { buffer, checkCells }. With cache: false, formulas carry no stored results. */
export async function buildModelWorkbook({
  company,
  fileName,
  facts,
  assay,
  model,
  meta = {},
  peers = [],
  cache = true
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vult';
  wb.title = `${company || 'Company'} financial model`;
  wb.calcProperties.fullCalcOnLoad = true;
  const checkCells = [];
  const H = model.periods.length;
  const histCol = i => 3 + i;
  const fcstCol = t => 3 + H + t;
  const baseCol = colLetter(histCol(H - 1));
  const inCol = t => colLetter(3 + t);
  const unitLabel = model.unit.label;
  const a = model.assumptions;

  const put = (sheet, address, formula, result, { fmt, color, bold } = {}) => {
    const cell = sheet.getCell(address);
    cell.value =
      cache && result !== undefined && result !== null && !(typeof result === 'number' && !Number.isFinite(result))
        ? { formula, result }
        : { formula };
    if (fmt) cell.numFmt = fmt;
    cell.font = font({ bold, color: { argb: color || INK } });
    return cell;
  };
  const input = (sheet, address, value, fmt) => {
    const cell = sheet.getCell(address);
    cell.value = value ?? null;
    if (fmt) cell.numFmt = fmt;
    cell.font = font({ color: { argb: INPUT_BLUE } });
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
    cell.border = { bottom: { style: 'hair', color: { argb: LINE } } };
    return cell;
  };
  const expect = (sheet, address, expected, what) => checkCells.push({ ref: `${q(sheet)}!${address}`, expected, what });

  /* ---------------------------------------------------------------- cover */
  const cover = wb.addWorksheet('Cover');
  title(
    cover,
    `${company || 'Company'}: financial model`,
    `Built by Vult from ${fileName || 'the annual report'}. Figures in ${unitLabel}.`,
    4
  );
  const coverRows = [
    ['Source filing', fileName || ''],
    ['Fiscal year end', meta.yearEnd || ''],
    ['Reported unit', unitLabel],
    ['Historical years', model.periods.join(', ')],
    ['Forecast years', model.years.map(y => `${y}E`).join(', ')],
    [
      'Row classification',
      meta.llm ? `${meta.llm.label} ${meta.llm.model}${meta.llm.local ? ' (ran on this machine)' : ''}` : ''
    ],
    ['Checks', `${assay.passed} passed, ${assay.flagged} flagged (see Assayer)`],
    ['Generated', new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'],
    [],
    ['How to read this workbook', ''],
    [
      '',
      'Every historical figure links to Extracted Data, which gives the PDF page and the printed row it was read from. Hover a historical cell for its source.'
    ],
    [
      '',
      'Numbers are read from the PDF text by code. A language model only decides which printed row is which line item, and the Assayer checks the result.'
    ],
    ['', 'Blue cells on Inputs are assumptions. Change them and the statements, DCF and comps recalculate.'],
    ['', 'Black cells are formulas. Green cells link to another sheet.'],
    ['', 'Flagged checks need an analyst to look at them before the model is relied on.']
  ];
  coverRows.forEach((values, i) => {
    const row = cover.getRow(4 + i);
    row.values = values;
    row.getCell(1).font = font({ bold: true });
    row.getCell(1).alignment = { vertical: 'top' };
    row.getCell(2).font = font();
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  });
  cover.getColumn(1).width = 24;
  cover.getColumn(2).width = 96;

  /* ---------------------------------------------------------------- extracted data */
  const { ref, note } = addExtractedData(wb, facts);

  const linkHist = (sheet, address, found, result, fmt = AMOUNT, wrap = x => x) => {
    if (!found) return null;
    const cell = put(sheet, address, wrap(found.formula), result, { fmt, color: LINK_GREEN });
    note(cell, found.facts);
    return cell;
  };

  /* ---------------------------------------------------------------- inputs */
  const inp = wb.addWorksheet(SHEETS.inputs, { views: [{ state: 'frozen', ySplit: 4 }] });
  title(
    inp,
    'Inputs',
    'Blue cells are assumptions. Defaults come from the base year or from Vult house defaults; the basis column says which.',
    7
  );
  header(inp, 4, ['Forecast assumption', 'Basis', ...model.years.map(y => `${y}E`)]);
  const perYear = [
    ['growth', 'Revenue growth', PCT],
    ['ebitMargin', 'Operating (EBIT) margin', PCT],
    ['daPct', 'D&A, % of revenue', PCT],
    ['capexPct', 'Capex, % of revenue', PCT],
    ['nccaPct', 'Non-cash current assets, % of revenue', PCT],
    ['ndclPct', 'Non-debt current liabilities, % of revenue', PCT],
    ['payout', 'Dividends and buybacks, % of net income', PCT]
  ];
  for (const [key, text, fmt] of perYear) {
    label(inp, IN[key], text);
    inp.getCell(IN[key], 2).value = a.basis?.[key] ?? '';
    inp.getCell(IN[key], 2).font = font({ size: 9, color: { argb: MUTED } });
    for (let t = 0; t < FORECAST_YEARS; t += 1) input(inp, `${inCol(t)}${IN[key]}`, a[key][t], fmt);
  }
  label(inp, IN.otherIncome, `Net other income (${unitLabel}), held flat`);
  inp.getCell(IN.otherIncome, 2).value = a.basis?.otherIncome ?? '';
  inp.getCell(IN.otherIncome, 2).font = font({ size: 9, color: { argb: MUTED } });
  input(inp, `C${IN.otherIncome}`, a.otherIncome, AMOUNT);

  header(inp, 14, ['Valuation input', 'Basis', 'Value']);
  const singles = [
    ['taxRate', 'Tax rate', PCT],
    ['riskFree', 'Risk-free rate', PCT],
    ['erp', 'Equity risk premium', PCT],
    ['beta', 'Levered beta', '0.00'],
    ['costOfDebt', 'Pre-tax cost of debt', PCT],
    ['terminalGrowth', 'Terminal growth', PCT],
    ['sharePrice', 'Current share price', PER_SHARE],
    ['targetDebtWeight', 'Target debt weight', PCT],
    ['unitScale', 'Reported unit scale', '#,##0'],
    ['shareScale', 'Share count scale', '#,##0']
  ];
  for (const [key, text, fmt] of singles) {
    label(inp, IN[key], text);
    inp.getCell(IN[key], 2).value = a.basis?.[key] ?? '';
    inp.getCell(IN[key], 2).font = font({ size: 9, color: { argb: MUTED } });
    input(inp, `C${IN[key]}`, a[key], fmt);
  }
  inp.getColumn(1).width = 42;
  inp.getColumn(2).width = 64;
  for (let c = 3; c <= 7; c += 1) inp.getColumn(c).width = 12;
  const IN_ABS = key => `${q(SHEETS.inputs)}!$C$${IN[key]}`;
  const IN_YEAR = (key, t) => `${q(SHEETS.inputs)}!${inCol(t)}${IN[key]}`;

  /* ---------------------------------------------------------------- statements: shared layout */
  const statementSheet = (name, subtitle) => {
    const sheet = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 4, xSplit: 2 }] });
    title(sheet, name, subtitle, 2 + H + FORECAST_YEARS);
    header(sheet, 4, [unitLabel, 'Source', ...model.periods.map(p => `FY${p}A`), ...model.years.map(y => `FY${y}E`)]);
    sheet.getColumn(1).width = 44;
    sheet.getColumn(2).width = 9;
    for (let c = 3; c <= 2 + H + FORECAST_YEARS; c += 1) sheet.getColumn(c).width = 13;
    // A light band marks the forecast.
    for (let row = 5; row <= 21; row += 1)
      for (let t = 0; t < FORECAST_YEARS; t += 1)
        sheet.getCell(row, fcstCol(t)).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
    return sheet;
  };
  const sourceTag = (sheet, row, statement, key) => {
    const pages = [...new Set(facts.filter(f => f.statement === statement && f.key === key).map(f => f.page))];
    if (!pages.length) return;
    const cell = sheet.getCell(row, 2);
    cell.value = `p. ${pages.join(', ')}`;
    cell.font = font({ size: 9, color: { argb: MUTED } });
  };

  const isSheet = statementSheet(
    SHEETS.is,
    'Historical years link to Extracted Data. Forecast years are driven by Inputs.'
  );
  const bsSheet = statementSheet(
    SHEETS.bs,
    'Other lines are residuals of the reported totals, so the historical sheet ties exactly to the filing.'
  );
  const cfSheet = statementSheet(
    SHEETS.cf,
    'Forecast cash flows are derived from the income statement and balance sheet movements.'
  );
  const isRef = (row, col) => `${q(SHEETS.is)}!${col}${row}`;
  const bsRef = (row, col) => `${q(SHEETS.bs)}!${col}${row}`;
  const cfRef = (row, col) => `${q(SHEETS.cf)}!${col}${row}`;

  /* ---------------------------------------------------------------- income statement */
  [
    ['revenue', 'Revenue', { bold: true }],
    ['growth', 'Revenue growth', { italic: true, indent: 1 }],
    ['cogs', 'Cost of revenue'],
    ['gross', 'Gross profit', { bold: true }],
    ['opex', 'Operating expenses'],
    ['ebit', 'Operating income (EBIT)', { bold: true }],
    ['margin', 'EBIT margin', { italic: true, indent: 1 }],
    ['da', 'Depreciation and amortisation'],
    ['ebitda', 'EBITDA', { bold: true }],
    ['other', 'Net other income / (expense)'],
    ['pretax', 'Pre-tax income'],
    ['tax', 'Income tax'],
    ['ni', 'Net income', { bold: true }],
    ['niCheck', 'Check: pre-tax less tax less net income', { italic: true }],
    ['eps', `Diluted EPS (as reported${a.epsFactor === 0.01 ? ', pence or cents' : ''})`],
    ['shares', 'Diluted shares (as reported)']
  ].forEach(([key, text, opts]) => label(isSheet, IS[key], text, opts));
  sourceTag(isSheet, IS.revenue, 'income', 'revenue');
  sourceTag(isSheet, IS.cogs, 'income', 'cost_of_revenue');
  sourceTag(isSheet, IS.ebit, 'income', 'operating_income');
  sourceTag(isSheet, IS.pretax, 'income', 'pretax_income');
  sourceTag(isSheet, IS.tax, 'income', 'income_tax');
  sourceTag(isSheet, IS.ni, 'income', 'net_income');
  sourceTag(isSheet, IS.eps, 'income', 'eps_diluted');
  sourceTag(isSheet, IS.shares, 'income', 'shares_diluted');

  model.hist.forEach((h, i) => {
    const c = colLetter(histCol(i));
    const p = h.period;
    const prevC = i > 0 ? colLetter(histCol(i - 1)) : null;
    linkHist(isSheet, `${c}${IS.revenue}`, ref('income', 'revenue', p), h.revenue);
    if (prevC && Number.isFinite(model.hist[i - 1].revenue))
      put(
        isSheet,
        `${c}${IS.growth}`,
        `${c}${IS.revenue}/${prevC}${IS.revenue}-1`,
        h.revenue / model.hist[i - 1].revenue - 1,
        { fmt: PCT }
      );
    linkHist(isSheet, `${c}${IS.cogs}`, ref('income', 'cost_of_revenue', p), h.cogs, AMOUNT, f => `ABS(${f})`);
    const gp = ref('income', 'gross_profit', p);
    if (gp) linkHist(isSheet, `${c}${IS.gross}`, gp, h.grossProfit);
    else if (Number.isFinite(h.grossProfit))
      put(isSheet, `${c}${IS.gross}`, `${c}${IS.revenue}-${c}${IS.cogs}`, h.grossProfit, { fmt: AMOUNT });
    linkHist(isSheet, `${c}${IS.opex}`, ref('income', 'operating_expenses', p), h.opex, AMOUNT, f => `ABS(${f})`);
    linkHist(isSheet, `${c}${IS.ebit}`, ref('income', 'operating_income', p), h.ebit);
    if (Number.isFinite(h.ebit) && Number.isFinite(h.revenue))
      put(isSheet, `${c}${IS.margin}`, `${c}${IS.ebit}/${c}${IS.revenue}`, h.ebit / h.revenue, { fmt: PCT });
    if (Number.isFinite(h.da)) put(isSheet, `${c}${IS.da}`, cfRef(CF.da, c), h.da, { fmt: AMOUNT, color: LINK_GREEN });
    if (Number.isFinite(h.ebitda))
      put(isSheet, `${c}${IS.ebitda}`, `${c}${IS.ebit}+${c}${IS.da}`, h.ebitda, { fmt: AMOUNT, bold: true });
    if (Number.isFinite(h.otherIncome))
      put(isSheet, `${c}${IS.other}`, `${c}${IS.pretax}-${c}${IS.ebit}`, h.otherIncome, { fmt: AMOUNT });
    linkHist(isSheet, `${c}${IS.pretax}`, ref('income', 'pretax_income', p), h.pretax);
    const taxRef = ref('income', 'income_tax', p);
    const rawTax = taxRef ? taxRef.facts.reduce((s, f) => s + f.value, 0) : null;
    linkHist(isSheet, `${c}${IS.tax}`, taxRef, h.tax, AMOUNT, f =>
      rawTax !== null && rawTax !== h.tax ? `-(${f})` : f
    );
    linkHist(isSheet, `${c}${IS.ni}`, ref('income', 'net_income', p), h.netIncome);
    if ([h.pretax, h.tax, h.netIncome].every(Number.isFinite))
      put(isSheet, `${c}${IS.niCheck}`, `${c}${IS.pretax}-${c}${IS.tax}-${c}${IS.ni}`, h.pretax - h.tax - h.netIncome, {
        fmt: AMOUNT,
        color: MUTED
      });
    linkHist(isSheet, `${c}${IS.eps}`, ref('income', 'eps_diluted', p), h.eps, PER_SHARE);
    linkHist(isSheet, `${c}${IS.shares}`, ref('income', 'shares_diluted', p), h.shares, '#,##0');
  });

  model.forecast.forEach((y, t) => {
    const c = colLetter(fcstCol(t));
    const prevC = colLetter(fcstCol(t) - 1);
    put(isSheet, `${c}${IS.growth}`, IN_YEAR('growth', t), y.growth, { fmt: PCT, color: LINK_GREEN });
    put(isSheet, `${c}${IS.revenue}`, `${prevC}${IS.revenue}*(1+${c}${IS.growth})`, y.revenue, {
      fmt: AMOUNT,
      bold: true
    });
    put(isSheet, `${c}${IS.margin}`, IN_YEAR('ebitMargin', t), y.ebitMargin, { fmt: PCT, color: LINK_GREEN });
    put(isSheet, `${c}${IS.ebit}`, `${c}${IS.revenue}*${c}${IS.margin}`, y.ebit, { fmt: AMOUNT, bold: true });
    put(isSheet, `${c}${IS.da}`, `${c}${IS.revenue}*${IN_YEAR('daPct', t)}`, y.da, { fmt: AMOUNT });
    put(isSheet, `${c}${IS.ebitda}`, `${c}${IS.ebit}+${c}${IS.da}`, y.ebitda, { fmt: AMOUNT, bold: true });
    put(isSheet, `${c}${IS.other}`, IN_ABS('otherIncome'), y.otherIncome, { fmt: AMOUNT, color: LINK_GREEN });
    put(isSheet, `${c}${IS.pretax}`, `${c}${IS.ebit}+${c}${IS.other}`, y.pretax, { fmt: AMOUNT });
    put(isSheet, `${c}${IS.tax}`, `${c}${IS.pretax}*${IN_ABS('taxRate')}`, y.tax, { fmt: AMOUNT });
    put(isSheet, `${c}${IS.ni}`, `${c}${IS.pretax}-${c}${IS.tax}`, y.netIncome, { fmt: AMOUNT, bold: true });
    put(isSheet, `${c}${IS.niCheck}`, `${c}${IS.pretax}-${c}${IS.tax}-${c}${IS.ni}`, 0, { fmt: AMOUNT, color: MUTED });
  });
  rule(isSheet, IS.gross, 3, 2 + H + FORECAST_YEARS);
  rule(isSheet, IS.ebit, 3, 2 + H + FORECAST_YEARS);
  rule(isSheet, IS.ni, 3, 2 + H + FORECAST_YEARS, 'double');
  expect(
    SHEETS.is,
    `${colLetter(fcstCol(FORECAST_YEARS - 1))}${IS.revenue}`,
    model.forecast.at(-1).revenue,
    `Revenue FY${model.years.at(-1)}E`
  );
  expect(
    SHEETS.is,
    `${colLetter(fcstCol(FORECAST_YEARS - 1))}${IS.ni}`,
    model.forecast.at(-1).netIncome,
    `Net income FY${model.years.at(-1)}E`
  );

  /* ---------------------------------------------------------------- balance sheet */
  [
    ['cash', 'Cash and short-term investments'],
    ['ncca', 'Non-cash current assets'],
    ['tca', 'Total current assets', { bold: true }],
    ['ppe', 'Property, plant and equipment, net'],
    ['onca', 'Other non-current assets'],
    ['ta', 'Total assets', { bold: true }],
    ['debtCur', 'Current debt'],
    ['ndcl', 'Non-debt current liabilities'],
    ['tcl', 'Total current liabilities', { bold: true }],
    ['debtNon', 'Long-term debt'],
    ['oncl', 'Other non-current liabilities'],
    ['tl', 'Total liabilities', { bold: true }],
    ['equity', 'Total equity', { bold: true }],
    ['tle', 'Total liabilities and equity', { bold: true }],
    ['check', 'Balance check: assets less liabilities and equity', { italic: true }]
  ].forEach(([key, text, opts]) => label(bsSheet, BS[key], text, opts));
  sourceTag(bsSheet, BS.cash, 'balance', 'cash_and_equivalents');
  sourceTag(bsSheet, BS.tca, 'balance', 'current_assets');
  sourceTag(bsSheet, BS.ppe, 'balance', 'ppe_net');
  sourceTag(bsSheet, BS.ta, 'balance', 'total_assets');
  sourceTag(bsSheet, BS.debtCur, 'balance', 'debt_current');
  sourceTag(bsSheet, BS.tcl, 'balance', 'current_liabilities');
  sourceTag(bsSheet, BS.debtNon, 'balance', 'debt_noncurrent');
  sourceTag(bsSheet, BS.tl, 'balance', 'total_liabilities');
  sourceTag(bsSheet, BS.equity, 'balance', 'total_equity');

  const sumRefs = (...found) => {
    const present = found.filter(Boolean);
    if (!present.length) return null;
    return { formula: present.map(f => f.formula).join('+'), facts: present.flatMap(f => f.facts) };
  };
  model.hist.forEach((h, i) => {
    if (!h.hasBalance) return;
    const c = colLetter(histCol(i));
    const p = h.period;
    linkHist(
      bsSheet,
      `${c}${BS.cash}`,
      sumRefs(ref('balance', 'cash_and_equivalents', p), ref('balance', 'short_term_investments', p)),
      h.cashSti
    );
    linkHist(bsSheet, `${c}${BS.tca}`, ref('balance', 'current_assets', p), h.tca);
    put(bsSheet, `${c}${BS.ncca}`, `${c}${BS.tca}-${c}${BS.cash}`, h.ncca, { fmt: AMOUNT });
    const ppeRef = ref('balance', 'ppe_net', p);
    if (ppeRef) linkHist(bsSheet, `${c}${BS.ppe}`, ppeRef, h.ppe);
    else input(bsSheet, `${c}${BS.ppe}`, 0, AMOUNT);
    const taRef = ref('balance', 'total_assets', p);
    if (taRef) linkHist(bsSheet, `${c}${BS.ta}`, taRef, h.ta);
    else {
      const nca = ref('balance', 'noncurrent_assets', p);
      const cell = put(bsSheet, `${c}${BS.ta}`, `${c}${BS.tca}+${nca.formula}`, h.ta, {
        fmt: AMOUNT,
        color: LINK_GREEN
      });
      cell.note = 'Not printed in the filing: total current assets plus total non-current assets.';
    }
    put(bsSheet, `${c}${BS.onca}`, `${c}${BS.ta}-${c}${BS.tca}-${c}${BS.ppe}`, h.onca, { fmt: AMOUNT });
    const dc = ref('balance', 'debt_current', p);
    if (dc) linkHist(bsSheet, `${c}${BS.debtCur}`, dc, h.debtCurrent);
    else input(bsSheet, `${c}${BS.debtCur}`, 0, AMOUNT);
    linkHist(bsSheet, `${c}${BS.tcl}`, ref('balance', 'current_liabilities', p), h.tcl);
    put(bsSheet, `${c}${BS.ndcl}`, `${c}${BS.tcl}-${c}${BS.debtCur}`, h.ndcl, { fmt: AMOUNT });
    const dn = ref('balance', 'debt_noncurrent', p);
    if (dn) linkHist(bsSheet, `${c}${BS.debtNon}`, dn, h.debtNoncurrent);
    else input(bsSheet, `${c}${BS.debtNon}`, 0, AMOUNT);
    const tlRef = ref('balance', 'total_liabilities', p);
    if (tlRef) linkHist(bsSheet, `${c}${BS.tl}`, tlRef, h.tl);
    else if (h.tlSource === 'tle') {
      const tle = ref('balance', 'total_liabilities_and_equity', p);
      const eq = ref('balance', 'total_equity', p);
      const cell = put(bsSheet, `${c}${BS.tl}`, `${tle.formula}-(${eq.formula})`, h.tl, {
        fmt: AMOUNT,
        color: LINK_GREEN
      });
      cell.note = 'Not printed in the filing: total liabilities and equity less total equity.';
    } else {
      const ncl = ref('balance', 'noncurrent_liabilities', p);
      const cell = put(bsSheet, `${c}${BS.tl}`, `${c}${BS.tcl}+${ncl.formula}`, h.tl, {
        fmt: AMOUNT,
        color: LINK_GREEN
      });
      cell.note = 'Not printed in the filing: total current liabilities plus total non-current liabilities.';
    }
    put(bsSheet, `${c}${BS.oncl}`, `${c}${BS.tl}-${c}${BS.tcl}-${c}${BS.debtNon}`, h.oncl, { fmt: AMOUNT });
    linkHist(bsSheet, `${c}${BS.equity}`, ref('balance', 'total_equity', p), h.equity);
    put(bsSheet, `${c}${BS.tle}`, `${c}${BS.tl}+${c}${BS.equity}`, h.tle, { fmt: AMOUNT, bold: true });
    put(bsSheet, `${c}${BS.check}`, `${c}${BS.ta}-${c}${BS.tle}`, h.ta - h.tle, { fmt: AMOUNT, color: MUTED });
    expect(SHEETS.bs, `${c}${BS.check}`, h.ta - h.tle, `Balance check FY${p}A`);
  });
  model.forecast.forEach((y, t) => {
    const c = colLetter(fcstCol(t));
    const pc = colLetter(fcstCol(t) - 1);
    put(bsSheet, `${c}${BS.cash}`, `${pc}${BS.cash}+${cfRef(CF.change, c)}`, y.cashSti, { fmt: AMOUNT });
    put(bsSheet, `${c}${BS.ncca}`, `${isRef(IS.revenue, c)}*${IN_YEAR('nccaPct', t)}`, y.ncca, { fmt: AMOUNT });
    put(bsSheet, `${c}${BS.tca}`, `${c}${BS.cash}+${c}${BS.ncca}`, y.tca, { fmt: AMOUNT, bold: true });
    put(bsSheet, `${c}${BS.ppe}`, `${pc}${BS.ppe}-${cfRef(CF.capex, c)}-${isRef(IS.da, c)}`, y.ppe, { fmt: AMOUNT });
    put(bsSheet, `${c}${BS.onca}`, `${pc}${BS.onca}`, y.onca, { fmt: AMOUNT });
    put(bsSheet, `${c}${BS.ta}`, `${c}${BS.tca}+${c}${BS.ppe}+${c}${BS.onca}`, y.ta, { fmt: AMOUNT, bold: true });
    put(bsSheet, `${c}${BS.debtCur}`, `${pc}${BS.debtCur}`, y.debtCurrent, { fmt: AMOUNT });
    put(bsSheet, `${c}${BS.ndcl}`, `${isRef(IS.revenue, c)}*${IN_YEAR('ndclPct', t)}`, y.ndcl, { fmt: AMOUNT });
    put(bsSheet, `${c}${BS.tcl}`, `${c}${BS.debtCur}+${c}${BS.ndcl}`, y.tcl, { fmt: AMOUNT, bold: true });
    put(bsSheet, `${c}${BS.debtNon}`, `${pc}${BS.debtNon}`, y.debtNoncurrent, { fmt: AMOUNT });
    put(bsSheet, `${c}${BS.oncl}`, `${pc}${BS.oncl}`, y.oncl, { fmt: AMOUNT });
    put(bsSheet, `${c}${BS.tl}`, `${c}${BS.tcl}+${c}${BS.debtNon}+${c}${BS.oncl}`, y.tl, { fmt: AMOUNT, bold: true });
    put(bsSheet, `${c}${BS.equity}`, `${pc}${BS.equity}+${isRef(IS.ni, c)}+${cfRef(CF.payout, c)}`, y.equity, {
      fmt: AMOUNT,
      bold: true
    });
    put(bsSheet, `${c}${BS.tle}`, `${c}${BS.tl}+${c}${BS.equity}`, y.tle, { fmt: AMOUNT, bold: true });
    put(bsSheet, `${c}${BS.check}`, `${c}${BS.ta}-${c}${BS.tle}`, y.balanceCheck, { fmt: AMOUNT, color: MUTED });
    expect(SHEETS.bs, `${c}${BS.check}`, 0, `Balance check FY${y.period}E`);
  });
  rule(bsSheet, BS.ta, 3, 2 + H + FORECAST_YEARS, 'double');
  rule(bsSheet, BS.tle, 3, 2 + H + FORECAST_YEARS, 'double');

  /* ---------------------------------------------------------------- cash flow */
  [
    ['ni', 'Net income'],
    ['da', 'Depreciation and amortisation'],
    ['dNcca', '(Increase) / decrease in non-cash current assets'],
    ['dNdcl', 'Increase / (decrease) in non-debt current liabilities'],
    ['otherOp', 'Other operating items'],
    ['cfo', 'Cash from operating activities', { bold: true }],
    ['capex', 'Capital expenditure'],
    ['otherInv', 'Other investing'],
    ['cfi', 'Cash from investing activities', { bold: true }],
    ['payout', 'Dividends and share buybacks'],
    ['otherFin', 'Other financing'],
    ['cff', 'Cash from financing activities', { bold: true }],
    ['fx', 'Exchange rate effect'],
    ['change', 'Net change in cash', { bold: true }],
    ['begin', 'Cash at beginning of year'],
    ['end', 'Cash at end of year', { bold: true }],
    ['check', 'Check: flows less reported change in cash', { italic: true }]
  ].forEach(([key, text, opts]) => label(cfSheet, CF[key], text, opts));
  sourceTag(cfSheet, CF.ni, 'cashflow', 'net_income');
  sourceTag(cfSheet, CF.da, 'cashflow', 'depreciation_amortization');
  sourceTag(cfSheet, CF.cfo, 'cashflow', 'operating_cash_flow');
  sourceTag(cfSheet, CF.capex, 'cashflow', 'capital_expenditure');
  sourceTag(cfSheet, CF.cfi, 'cashflow', 'investing_cash_flow');
  sourceTag(cfSheet, CF.cff, 'cashflow', 'financing_cash_flow');
  sourceTag(cfSheet, CF.change, 'cashflow', 'cash_change');

  model.hist.forEach((h, i) => {
    const c = colLetter(histCol(i));
    const p = h.period;
    linkHist(cfSheet, `${c}${CF.ni}`, ref('cashflow', 'net_income', p), h.cfNetIncome);
    linkHist(cfSheet, `${c}${CF.da}`, ref('cashflow', 'depreciation_amortization', p), h.da);
    linkHist(cfSheet, `${c}${CF.cfo}`, ref('cashflow', 'operating_cash_flow', p), h.cfo);
    if ([h.cfo, h.cfNetIncome, h.da].every(Number.isFinite))
      put(cfSheet, `${c}${CF.otherOp}`, `${c}${CF.cfo}-${c}${CF.ni}-${c}${CF.da}`, h.cfo - h.cfNetIncome - h.da, {
        fmt: AMOUNT
      });
    linkHist(cfSheet, `${c}${CF.capex}`, ref('cashflow', 'capital_expenditure', p), h.capex, AMOUNT, f => `-ABS(${f})`);
    linkHist(cfSheet, `${c}${CF.cfi}`, ref('cashflow', 'investing_cash_flow', p), h.cfi);
    if (Number.isFinite(h.cfi) && Number.isFinite(h.capex))
      put(cfSheet, `${c}${CF.otherInv}`, `${c}${CF.cfi}-${c}${CF.capex}`, h.cfi - h.capex, { fmt: AMOUNT });
    const div = ref('cashflow', 'dividends_paid', p);
    const rep = ref('cashflow', 'share_repurchases', p);
    const payoutParts = [div, rep].filter(Boolean);
    if (payoutParts.length) {
      const cell = put(cfSheet, `${c}${CF.payout}`, payoutParts.map(r => `-ABS(${r.formula})`).join(''), h.payout, {
        fmt: AMOUNT,
        color: LINK_GREEN
      });
      note(
        cell,
        payoutParts.flatMap(r => r.facts)
      );
    }
    linkHist(cfSheet, `${c}${CF.cff}`, ref('cashflow', 'financing_cash_flow', p), h.cff);
    if (Number.isFinite(h.cff))
      put(cfSheet, `${c}${CF.otherFin}`, `${c}${CF.cff}-N(${c}${CF.payout})`, h.cff - h.payout, { fmt: AMOUNT });
    const fx = ref('cashflow', 'fx_effect', p);
    if (fx) linkHist(cfSheet, `${c}${CF.fx}`, fx, h.fx);
    linkHist(cfSheet, `${c}${CF.change}`, ref('cashflow', 'cash_change', p), h.cashChange);
    linkHist(cfSheet, `${c}${CF.begin}`, ref('cashflow', 'cash_beginning', p), h.cashBeginning);
    linkHist(cfSheet, `${c}${CF.end}`, ref('cashflow', 'cash_ending', p), h.cashEnding);
    if ([h.cfo, h.cfi, h.cff, h.cashChange].every(Number.isFinite))
      put(
        cfSheet,
        `${c}${CF.check}`,
        `${c}${CF.cfo}+${c}${CF.cfi}+${c}${CF.cff}+N(${c}${CF.fx})-${c}${CF.change}`,
        h.cfo + h.cfi + h.cff + h.fx - h.cashChange,
        { fmt: AMOUNT, color: MUTED }
      );
  });
  model.forecast.forEach((y, t) => {
    const c = colLetter(fcstCol(t));
    const pc = colLetter(fcstCol(t) - 1);
    put(cfSheet, `${c}${CF.ni}`, isRef(IS.ni, c), y.netIncome, { fmt: AMOUNT, color: LINK_GREEN });
    put(cfSheet, `${c}${CF.da}`, isRef(IS.da, c), y.da, { fmt: AMOUNT, color: LINK_GREEN });
    put(cfSheet, `${c}${CF.dNcca}`, `-(${bsRef(BS.ncca, c)}-${bsRef(BS.ncca, pc)})`, y.dNcca, { fmt: AMOUNT });
    put(cfSheet, `${c}${CF.dNdcl}`, `${bsRef(BS.ndcl, c)}-${bsRef(BS.ndcl, pc)}`, y.dNdcl, { fmt: AMOUNT });
    put(cfSheet, `${c}${CF.otherOp}`, '0', 0, { fmt: AMOUNT });
    put(cfSheet, `${c}${CF.cfo}`, `SUM(${c}${CF.ni}:${c}${CF.otherOp})`, y.cfo, { fmt: AMOUNT, bold: true });
    put(cfSheet, `${c}${CF.capex}`, `-${isRef(IS.revenue, c)}*${IN_YEAR('capexPct', t)}`, y.capex, { fmt: AMOUNT });
    put(cfSheet, `${c}${CF.otherInv}`, '0', 0, { fmt: AMOUNT });
    put(cfSheet, `${c}${CF.cfi}`, `${c}${CF.capex}+${c}${CF.otherInv}`, y.cfi, { fmt: AMOUNT, bold: true });
    put(cfSheet, `${c}${CF.payout}`, `-${isRef(IS.ni, c)}*${IN_YEAR('payout', t)}`, y.payout, { fmt: AMOUNT });
    put(cfSheet, `${c}${CF.otherFin}`, '0', 0, { fmt: AMOUNT });
    put(cfSheet, `${c}${CF.cff}`, `${c}${CF.payout}+${c}${CF.otherFin}`, y.cff, { fmt: AMOUNT, bold: true });
    put(cfSheet, `${c}${CF.fx}`, '0', 0, { fmt: AMOUNT });
    put(cfSheet, `${c}${CF.change}`, `${c}${CF.cfo}+${c}${CF.cfi}+${c}${CF.cff}+${c}${CF.fx}`, y.cashChange, {
      fmt: AMOUNT,
      bold: true
    });
    put(cfSheet, `${c}${CF.begin}`, bsRef(BS.cash, pc), y.cashBeginning, { fmt: AMOUNT, color: LINK_GREEN });
    put(cfSheet, `${c}${CF.end}`, `${c}${CF.begin}+${c}${CF.change}`, y.cashEnding, { fmt: AMOUNT, bold: true });
    put(cfSheet, `${c}${CF.check}`, `${c}${CF.end}-${bsRef(BS.cash, c)}`, 0, { fmt: AMOUNT, color: MUTED });
    expect(SHEETS.cf, `${c}${CF.check}`, 0, `Cash ties to balance sheet FY${y.period}E`);
  });
  rule(cfSheet, CF.cfo, 3, 2 + H + FORECAST_YEARS);
  rule(cfSheet, CF.change, 3, 2 + H + FORECAST_YEARS);

  /* ---------------------------------------------------------------- DCF */
  const d = model.dcf;
  const dcf = wb.addWorksheet(SHEETS.dcf, { views: [{ state: 'frozen', ySplit: 4 }] });
  title(
    dcf,
    'Discounted cash flow',
    `Unlevered free cash flow, end-of-year discounting, Gordon growth terminal value. ${unitLabel} unless stated.`,
    7
  );
  header(dcf, 4, ['Unlevered free cash flow', '', ...model.years.map(y => `FY${y}E`)]);
  [
    [5, 'EBIT'],
    [6, 'Tax on EBIT'],
    [7, 'NOPAT', true],
    [8, 'Add: D&A'],
    [9, 'Less: capex'],
    [10, 'Less: increase in working capital'],
    [11, 'Unlevered free cash flow', true],
    [12, 'Discount period (years)'],
    [13, 'Discount factor'],
    [14, 'Present value of UFCF', true]
  ].forEach(([row, text, bold]) => label(dcf, row, text, { bold }));
  model.forecast.forEach((y, t) => {
    const c = colLetter(3 + t);
    const sc = colLetter(fcstCol(t));
    put(dcf, `${c}5`, isRef(IS.ebit, sc), y.ebit, { fmt: AMOUNT, color: LINK_GREEN });
    put(dcf, `${c}6`, `-${c}5*${IN_ABS('taxRate')}`, -y.ebit * a.taxRate, { fmt: AMOUNT });
    put(dcf, `${c}7`, `${c}5+${c}6`, y.ebit * (1 - a.taxRate), { fmt: AMOUNT, bold: true });
    put(dcf, `${c}8`, isRef(IS.da, sc), y.da, { fmt: AMOUNT, color: LINK_GREEN });
    put(dcf, `${c}9`, cfRef(CF.capex, sc), y.capex, { fmt: AMOUNT, color: LINK_GREEN });
    put(dcf, `${c}10`, `${cfRef(CF.dNcca, sc)}+${cfRef(CF.dNdcl, sc)}`, y.dNcca + y.dNdcl, {
      fmt: AMOUNT,
      color: LINK_GREEN
    });
    put(dcf, `${c}11`, `${c}7+${c}8+${c}9+${c}10`, d.ufcf[t], { fmt: AMOUNT, bold: true });
    dcf.getCell(`${c}12`).value = t + 1;
    put(dcf, `${c}13`, `1/(1+$C$28)^${c}12`, d.discountFactors[t], { fmt: '0.000' });
    put(dcf, `${c}14`, `${c}11*${c}13`, d.pvUfcf[t], { fmt: AMOUNT, bold: true });
  });
  rule(dcf, 11, 3, 7);

  header(dcf, 16, ['Cost of capital', '', 'Value']);
  const shareRef = isRef(IS.shares, baseCol);
  const perShareOk = d.perShare != null;
  const rows = [
    [17, 'Risk-free rate', IN_ABS('riskFree'), a.riskFree, PCT, LINK_GREEN],
    [18, 'Equity risk premium', IN_ABS('erp'), a.erp, PCT, LINK_GREEN],
    [19, 'Levered beta', IN_ABS('beta'), a.beta, '0.00', LINK_GREEN],
    [20, 'Cost of equity', 'C17+C19*C18', d.costOfEquity, PCT],
    [21, 'Pre-tax cost of debt', IN_ABS('costOfDebt'), a.costOfDebt, PCT, LINK_GREEN],
    [22, 'Tax rate', IN_ABS('taxRate'), a.taxRate, PCT, LINK_GREEN],
    [23, 'After-tax cost of debt', 'C21*(1-C22)', d.afterTaxDebt, PCT],
    [
      24,
      `Market value of equity (${unitLabel})`,
      `IF(AND(N(${IN_ABS('sharePrice')})>0,N(${IN_ABS('shareScale')})>0),${IN_ABS('sharePrice')}*${shareRef}*${IN_ABS('shareScale')}/${IN_ABS('unitScale')},"")`,
      d.marketCap ?? '',
      AMOUNT
    ],
    [
      25,
      `Total debt (${unitLabel})`,
      `${bsRef(BS.debtCur, baseCol)}+${bsRef(BS.debtNon, baseCol)}`,
      d.debt,
      AMOUNT,
      LINK_GREEN
    ],
    [26, 'Equity weight', `IF(N(C24)>0,C24/(C24+C25),1-${IN_ABS('targetDebtWeight')})`, d.equityWeight, PCT],
    [27, 'Debt weight', '1-C26', 1 - d.equityWeight, PCT],
    [28, 'WACC', 'C26*C20+C27*C23', d.wacc, PCT]
  ];
  for (const [row, text, formula, result, fmt, color] of rows) {
    label(dcf, row, text, { bold: row === 28 });
    put(dcf, `C${row}`, formula, result, { fmt, color, bold: row === 28 });
  }
  expect(SHEETS.dcf, 'C28', d.wacc, 'WACC');

  header(dcf, 30, ['Valuation', '', 'Value']);
  const val = [
    [31, 'Sum of PV of UFCF', 'SUM(C14:G14)', d.sumPv, AMOUNT],
    [32, 'Terminal growth', IN_ABS('terminalGrowth'), a.terminalGrowth, PCT, LINK_GREEN],
    [33, 'Terminal value', 'G11*(1+C32)/(C28-C32)', d.terminalValue, AMOUNT],
    [34, 'PV of terminal value', 'C33*G13', d.pvTerminal, AMOUNT],
    [35, 'Enterprise value', 'C31+C34', d.ev, AMOUNT],
    [36, 'Less: debt', 'C25', d.debt, AMOUNT],
    [37, 'Add: cash and short-term investments', bsRef(BS.cash, baseCol), d.cash, AMOUNT, LINK_GREEN],
    [38, 'Equity value', 'C35-C36+C37', d.equityValue, AMOUNT],
    [39, 'Diluted shares (as reported)', shareRef, model.base.shares ?? '', '#,##0', LINK_GREEN],
    [
      40,
      'Value per share',
      `IF(AND(N(${IN_ABS('shareScale')})>0,N(C39)>0),C38*${IN_ABS('unitScale')}/(C39*${IN_ABS('shareScale')}),"")`,
      d.perShare ?? '',
      PER_SHARE
    ],
    [
      41,
      'Current share price',
      `IF(N(${IN_ABS('sharePrice')})>0,${IN_ABS('sharePrice')},"")`,
      a.sharePrice ?? '',
      PER_SHARE,
      LINK_GREEN
    ],
    [42, 'Upside / (downside)', 'IF(AND(N(C40)<>0,N(C41)>0),C40/C41-1,"")', d.upside ?? '', PCT],
    [43, 'Terminal value share of EV', 'C34/C35', d.tvShare, PCT]
  ];
  for (const [row, text, formula, result, fmt, color] of val) {
    label(dcf, row, text, { bold: row === 35 || row === 38 || row === 40 });
    put(dcf, `C${row}`, formula, result, { fmt, color, bold: row === 35 || row === 38 || row === 40 });
  }
  expect(SHEETS.dcf, 'C35', d.ev, 'Enterprise value');
  expect(SHEETS.dcf, 'C38', d.equityValue, 'Equity value');
  if (perShareOk) expect(SHEETS.dcf, 'C40', d.perShare, 'Value per share');

  const sensTitle = perShareOk ? 'Value per share' : `Equity value (${unitLabel})`;
  dcf.mergeCells('A45:G45');
  dcf.getCell('A45').value = `Sensitivity: ${sensTitle.toLowerCase()} by WACC (across) and terminal growth (down)`;
  dcf.getCell('A45').font = font({ bold: true, color: { argb: 'FFFFFFFF' } });
  dcf.getCell('A45').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } };
  label(dcf, 46, 'Terminal growth / WACC', { italic: true });
  const steps = [-0.01, -0.005, 0, 0.005, 0.01];
  const gSteps = [-0.005, -0.0025, 0, 0.0025, 0.005];
  steps.forEach((step, i) =>
    put(dcf, `${colLetter(3 + i)}46`, `$C$28${step < 0 ? '' : '+'}${step}`, d.sensitivity.wacc[i], {
      fmt: PCT,
      bold: true
    })
  );
  const scaleTail = perShareOk ? `*${IN_ABS('unitScale')}/($C$39*${IN_ABS('shareScale')})` : '';
  gSteps.forEach((step, r) => {
    const row = 47 + r;
    put(dcf, `B${row}`, `$C$32${step < 0 ? '' : '+'}${step}`, d.sensitivity.growth[r], { fmt: PCT, bold: true });
    steps.forEach((_, i) => {
      const wc = `${colLetter(3 + i)}$46`;
      const formula = `IF(${wc}<=$B${row},"",(SUMPRODUCT($C$11:$G$11,1/(1+${wc})^$C$12:$G$12)+$G$11*(1+$B${row})/(${wc}-$B${row})/(1+${wc})^$G$12-$C$36+$C$37)${scaleTail})`;
      const cell = put(dcf, `${colLetter(3 + i)}${row}`, formula, d.sensitivity.values[r][i] ?? '', {
        fmt: perShareOk ? PER_SHARE : AMOUNT
      });
      if (r === 2 && i === 2)
        cell.border = {
          top: { style: 'thin', color: { argb: ACCENT } },
          bottom: { style: 'thin', color: { argb: ACCENT } },
          left: { style: 'thin', color: { argb: ACCENT } },
          right: { style: 'thin', color: { argb: ACCENT } }
        };
    });
  });
  expect(SHEETS.dcf, 'E49', d.sensitivity.values[2][2], 'Sensitivity centre equals the base case');
  expect(SHEETS.dcf, 'C47', d.sensitivity.values[0][0], 'Sensitivity corner');
  dcf.getColumn(1).width = 40;
  dcf.getColumn(2).width = 12;
  for (let c = 3; c <= 7; c += 1) dcf.getColumn(c).width = 14;

  /* ---------------------------------------------------------------- comps */
  const comps = wb.addWorksheet(SHEETS.comps, { views: [{ state: 'frozen', ySplit: 4, xSplit: 1 }] });
  title(
    comps,
    'Trading comparables',
    `Peers in ${unitLabel}. Fetched peers come from their filings (SEC or ESEF) and a market price; column K gives each source. Overwrite any blue cell and the multiples and implied value update.`,
    10
  );
  header(comps, 4, [
    'Company',
    'Market cap',
    'Net debt',
    'Enterprise value',
    'Revenue',
    'EBITDA',
    'Net income',
    'EV / Revenue',
    'EV / EBITDA',
    'P / E'
  ]);
  // Each formula has a twin in comps.js. A blank market cap leaves every multiple blank.
  const cs = compsSummary(peers, model);
  const multiples = (row, m = {}) => {
    put(comps, `D${row}`, `IF(N(B${row})>0,B${row}+N(C${row}),"")`, m.ev ?? '', { fmt: AMOUNT });
    put(comps, `H${row}`, `IFERROR(D${row}/E${row},"")`, m.evRevenue ?? '', { fmt: MULT });
    put(comps, `I${row}`, `IFERROR(D${row}/F${row},"")`, m.evEbitda ?? '', { fmt: MULT });
    put(comps, `J${row}`, `IF(N(B${row})>0,IFERROR(B${row}/G${row},""),"")`, m.pe ?? '', { fmt: MULT });
  };
  comps.getCell('A5').value = `${company || 'Target'} (FY${model.base.period}A)`;
  comps.getCell('A5').font = font({ bold: true });
  put(comps, 'B5', `${q(SHEETS.dcf)}!C24`, d.marketCap ?? '', { fmt: AMOUNT, color: LINK_GREEN });
  put(comps, 'C5', `${q(SHEETS.dcf)}!C36-${q(SHEETS.dcf)}!C37`, d.debt - d.cash, { fmt: AMOUNT, color: LINK_GREEN });
  put(comps, 'E5', isRef(IS.revenue, baseCol), model.base.revenue, { fmt: AMOUNT, color: LINK_GREEN });
  put(comps, 'F5', isRef(IS.ebitda, baseCol), model.base.ebitda, { fmt: AMOUNT, color: LINK_GREEN });
  put(comps, 'G5', isRef(IS.ni, baseCol), model.base.netIncome, { fmt: AMOUNT, color: LINK_GREEN });
  multiples(
    5,
    peerMultiples({
      marketCap: d.marketCap,
      netDebt: d.debt - d.cash,
      revenue: model.base.revenue,
      ebitda: model.base.ebitda,
      netIncome: model.base.netIncome
    })
  );
  comps.getCell('A7').value = 'Peers';
  comps.getCell('A7').font = font({ bold: true, color: { argb: MUTED } });
  for (let i = 0; i < MAX_PEERS; i += 1) {
    const row = 8 + i;
    const peer = peers[i] ?? {};
    input(comps, `A${row}`, peer.name || `Peer ${i + 1}`);
    input(comps, `B${row}`, peer.marketCap ?? null, AMOUNT);
    input(comps, `C${row}`, peer.netDebt ?? null, AMOUNT);
    input(comps, `E${row}`, peer.revenue ?? null, AMOUNT);
    input(comps, `F${row}`, peer.ebitda ?? null, AMOUNT);
    input(comps, `G${row}`, peer.netIncome ?? null, AMOUNT);
    multiples(row, cs.rows[i]);
    if (peer.sources) {
      const source = comps.getCell(`K${row}`);
      source.value = peer.sources;
      source.font = font({ size: 9, color: { argb: MUTED } });
    }
  }
  label(comps, 17, 'Peer median', { bold: true });
  label(comps, 18, 'Peer mean');
  for (const [col, key] of [
    ['H', 'evRevenue'],
    ['I', 'evEbitda'],
    ['J', 'pe']
  ]) {
    put(comps, `${col}17`, `IFERROR(MEDIAN(${col}8:${col}15),"")`, cs.medians[key] ?? '', { fmt: MULT, bold: true });
    put(comps, `${col}18`, `IFERROR(AVERAGE(${col}8:${col}15),"")`, cs.means[key] ?? '', { fmt: MULT });
    if (Number.isFinite(cs.medians[key]))
      expect(
        SHEETS.comps,
        `${col}17`,
        cs.medians[key],
        `Peer median ${col === 'H' ? 'EV / revenue' : col === 'I' ? 'EV / EBITDA' : 'P / E'}`
      );
  }
  rule(comps, 17, 1, 10);
  label(comps, 20, 'Implied enterprise value at median EV / EBITDA', { bold: true });
  put(comps, 'B20', 'IFERROR(I17*F5,"")', cs.impliedEv ?? '', { fmt: AMOUNT, bold: true });
  if (Number.isFinite(cs.impliedEv)) expect(SHEETS.comps, 'B20', cs.impliedEv, 'Implied enterprise value from peers');
  label(comps, 21, 'Implied equity value');
  put(comps, 'B21', `IFERROR(B20-${q(SHEETS.dcf)}!C36+${q(SHEETS.dcf)}!C37,"")`, cs.impliedEquity ?? '', {
    fmt: AMOUNT
  });
  label(comps, 22, 'Implied value per share');
  if (perShareOk)
    put(
      comps,
      'B22',
      `IFERROR(B21*${IN_ABS('unitScale')}/(${q(SHEETS.dcf)}!C39*${IN_ABS('shareScale')}),"")`,
      cs.impliedPerShare ?? '',
      { fmt: PER_SHARE }
    );
  if (Number.isFinite(cs.impliedPerShare))
    expect(SHEETS.comps, 'B22', cs.impliedPerShare, 'Implied value per share from peers');
  comps.getColumn(11).width = 60;
  comps.getColumn(1).width = 34;
  for (let c = 2; c <= 10; c += 1) comps.getColumn(c).width = 14;

  /* ---------------------------------------------------------------- assayer */
  addAssayerSheet(wb, assay);
  addCorrectionsSheet(wb, meta.corrections);

  // Order tabs the way an analyst reads them.
  const order = [
    'Cover',
    SHEETS.inputs,
    SHEETS.is,
    SHEETS.bs,
    SHEETS.cf,
    SHEETS.dcf,
    SHEETS.comps,
    SHEETS.assay,
    SHEETS.corrections,
    SHEETS.data
  ];
  order.filter(name => wb.getWorksheet(name)).forEach((name, i) => (wb.getWorksheet(name).orderNo = i));

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, checkCells };
}

/** The analyst corrections log, when there is one. */
export function addCorrectionsSheet(wb, corrections) {
  if (!corrections?.length) return;
  const sheet = wb.addWorksheet(SHEETS.corrections, { views: [{ state: 'frozen', ySplit: 3 }] });
  title(sheet, 'Corrections', 'Changes analysts made to the row classification, in the order they were made.', 6);
  header(sheet, 3, ['When (UTC)', 'Who', 'Line item', 'Change', 'Reason', 'PDF page']);
  corrections.forEach((c, i) => {
    const row = sheet.getRow(4 + i);
    row.values = [
      new Date(c.at).toISOString().slice(0, 16).replace('T', ' '),
      c.by,
      `${c.statement}: ${c.key}`,
      c.action === 'clear'
        ? 'Cleared'
        : c.action === 'remap'
          ? `Row: ${c.rows.map(r => `"${r.label}"`).join(' + ')}`
          : `Entered: ${Object.entries(c.values)
              .map(([period, value]) => `FY${period} ${value}`)
              .join(', ')}`,
      c.reason,
      c.action === 'manual' ? c.page : [...new Set(c.rows.map(r => r.page))].join(', ')
    ];
    row.getCell(5).alignment = { wrapText: true, vertical: 'top' };
  });
  [18, 18, 30, 44, 60, 9].forEach((w, i) => (sheet.getColumn(i + 1).width = w));
}

/** Every extracted figure with its page and printed row. `ref` gives the formula to a figure, `note` a source comment. */
export function addExtractedData(wb, facts) {
  const data = wb.addWorksheet(SHEETS.data, { views: [{ state: 'frozen', ySplit: 3 }] });
  title(
    data,
    'Extracted data',
    'Each figure as printed in the filing, with the PDF page and printed row it was read from.',
    8
  );
  header(data, 3, ['Statement', 'Key', 'Printed label', 'Period', 'Value', 'Unit', 'PDF page', 'Printed row']);
  const refs = new Map();
  const ordered = [...facts].sort(
    (l, r) =>
      l.statement.localeCompare(r.statement) ||
      l.key.localeCompare(r.key) ||
      (l.part ?? 0) - (r.part ?? 0) ||
      l.period.localeCompare(r.period)
  );
  ordered.forEach((fact, i) => {
    const row = 4 + i;
    data.getRow(row).values = [
      fact.statement,
      fact.key,
      fact.label,
      fact.period,
      fact.value,
      fact.unit,
      fact.page,
      String(fact.quote).replace(/\s+/g, ' ')
    ];
    data.getCell(row, 5).numFmt = '#,##0.00;(#,##0.00);0';
    data.getCell(row, 5).font = font({ color: { argb: INPUT_BLUE } });
    data.getCell(row, 8).font = font({ size: 9, color: { argb: MUTED } });
    const id = `${fact.statement}:${fact.key}:${fact.period}`;
    const list = refs.get(id) ?? [];
    list.push({ ref: `${q(SHEETS.data)}!E${row}`, fact });
    refs.set(id, list);
  });
  [12, 26, 44, 8, 14, 13, 9, 90].forEach((w, i) => (data.getColumn(i + 1).width = w));

  const ref = (statement, key, period) => {
    const list = refs.get(`${statement}:${key}:${period}`);
    if (!list) return null;
    const parts = new Map(list.map(item => [item.fact.part ?? 0, item]));
    // Liabilities printed in brackets are taken at their size, as the model does.
    const size = statement === 'balance' && LIABILITY_KEYS.has(key) ? r => `ABS(${r})` : r => r;
    return {
      formula: [...parts.values()].map(item => size(item.ref)).join('+'),
      facts: [...parts.values()].map(item => item.fact)
    };
  };
  const note = (cell, sourceFacts) => {
    if (!sourceFacts?.length) return;
    cell.note = sourceFacts
      .map(f => `PDF page ${f.page}: "${String(f.quote).replace(/\s+/g, ' ').slice(0, 160)}"`)
      .join('\n');
  };
  return { ref, note };
}

/** The Assayer results, one row per check. */
export function addAssayerSheet(wb, assay) {
  const as = wb.addWorksheet(SHEETS.assay, { views: [{ state: 'frozen', ySplit: 4 }] });
  title(
    as,
    'Assayer',
    `${assay.passed} passed, ${assay.flagged} flagged. Deterministic checks run by code; a flag is something for an analyst to look at, and a pass is not a sign-off.`,
    5
  );
  header(as, 4, ['Check', 'Period', 'Result', 'Detail', 'PDF page']);
  assay.checks.forEach((check, i) => {
    const row = 5 + i;
    as.getRow(row).values = [
      check.title,
      check.period ?? '',
      check.passed ? 'Pass' : 'Flag',
      check.detail,
      check.page ?? ''
    ];
    as.getCell(row, 3).font = font({ bold: true, color: { argb: check.passed ? PASS : FLAG } });
    as.getCell(row, 4).alignment = { wrapText: true, vertical: 'top' };
  });
  [40, 10, 8, 100, 9].forEach((w, i) => (as.getColumn(i + 1).width = w));
}

/** Styling shared with the financial-institution workbook. */
export const XL = {
  font,
  title,
  header,
  label,
  rule,
  q,
  AMOUNT,
  PCT,
  MULT,
  PER_SHARE,
  INK,
  NAVY,
  ACCENT,
  MUTED,
  LINE,
  INPUT_BLUE,
  INPUT_FILL,
  LINK_GREEN,
  PASS,
  FLAG
};
