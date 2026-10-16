/**
 * Banks and insurers. Their balance sheets are not split into current and non-current, and debt is their raw
 * material rather than financing, so a corporate DCF does not apply. They are valued on equity instead:
 * justified price to book, (ROE - g) / (cost of equity - g), applied to reported book equity.
 *
 * As in model.js, every formula written to the workbook has a twin here, and `checkCells` lists the cells
 * the engine recalculates in LibreOffice and compares.
 */
import ExcelJS from 'exceljs';
import { factIndex, reconcileShares } from './model.js';
import { XL, addAssayerSheet, addCorrectionsSheet, addExtractedData, colLetter } from './workbook.js';

const BANK = [
  /net interest income/i,
  /interest (and similar )?income/i,
  /loans and advances to (customers|banks)/i,
  /deposits (from|by) (customers|banks)|customer deposits|due to customers/i,
  /(allowance|provision|impairment)s? for (expected )?(loan|credit) losses|expected credit loss/i
];
const INSURER = [
  /insurance (revenue|service result|contract liabilities)/i,
  /(gross )?premiums? (earned|written)/i,
  /claims (incurred|paid)/i,
  /policyholder/i,
  /reinsurance/i
];

/** 'bank', 'insurer' or 'corporate', from the wording of the statement pages. */
export function detectSector(pages) {
  const text = (pages ?? []).map(page => page?.text ?? page).join('\n');
  const hits = patterns => patterns.filter(pattern => pattern.test(text)).length;
  if (hits(BANK) >= 2) return 'bank';
  if (hits(INSURER) >= 2) return 'insurer';
  return 'corporate';
}

export const isFinancial = sector => sector === 'bank' || sector === 'insurer' || sector === 'financial';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const COE_STEPS = [-0.01, -0.005, 0, 0.005, 0.01];
const ROE_STEPS = [-0.02, -0.01, 0, 0.01, 0.02];

/** Justified price to book; null when the cost of equity does not exceed growth. */
const justifiedPb = (roe, coe, g) => (coe > g ? (roe - g) / (coe - g) : null);

export function buildFinancialModel({ facts, unit, overrides = {}, sector = 'financial' }) {
  const index = factIndex(facts);
  const g = (statement, key, period) => index.get(statement, key, period);
  const periods = [...new Set(facts.filter(f => f.statement === 'income').map(f => f.period))].sort().slice(-3);
  if (!periods.length) throw new Error('No income statement periods were extracted.');
  const hist = periods.map((period, i) => {
    const equity = g('balance', 'total_equity', period);
    const prior = i > 0 ? g('balance', 'total_equity', periods[i - 1]) : null;
    const netIncome = g('income', 'net_income', period);
    // Return on average equity where the prior year is reported, otherwise on closing equity.
    const roe =
      Number.isFinite(netIncome) && Number.isFinite(equity) && equity !== 0
        ? Number.isFinite(prior)
          ? netIncome / ((prior + equity) / 2)
          : netIncome / equity
        : null;
    return {
      period,
      revenue: g('income', 'revenue', period),
      pretax: g('income', 'pretax_income', period),
      netIncome,
      equity,
      ta: g('balance', 'total_assets', period),
      roe,
      roeOnAverage: Number.isFinite(prior),
      eps: g('income', 'eps_diluted', period),
      shares: g('income', 'shares_diluted', period)
    };
  });
  const base = hist.at(-1);
  if (![base.netIncome, base.equity].every(Number.isFinite))
    throw new Error(`Net income and total equity are needed for ${base.period}.`);

  const roes = hist.map(h => h.roe).filter(Number.isFinite);
  const reconciled = reconcileShares({
    netIncome: base.netIncome,
    shares: base.shares,
    eps: base.eps,
    unitScale: unit.scale
  });
  const defaults = {
    riskFree: 0.0425,
    erp: 0.05,
    beta: 1,
    roe: roes.length ? clamp(roes.reduce((a, b) => a + b, 0) / roes.length, -0.2, 0.4) : 0.1,
    growth: 0.025,
    sharePrice: null,
    unitScale: unit.scale,
    shareScale: reconciled?.scale ?? null,
    epsFactor: reconciled?.epsFactor ?? 1,
    basis: {
      riskFree: 'Vult default; check against the current 10-year government yield',
      erp: 'Vult default; check against house view',
      beta: 'Vult default of 1.0; replace with an observed or peer beta',
      roe: roes.length
        ? `Average return on equity over ${roes.length} reported year${roes.length === 1 ? '' : 's'}`
        : 'Placeholder 10%; no return on equity could be computed',
      growth: 'Vult default long-run growth of book value',
      sharePrice: 'Not in the filing; enter the current price for upside',
      unitScale: 'Read from the statement headers',
      shareScale: reconciled
        ? 'Chosen so net income / shares matches reported diluted EPS'
        : 'Could not be confirmed against EPS'
    }
  };
  const a = {
    ...defaults,
    ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined && v !== '')),
    // An override can say where it came from (for example a fetched share price and its date).
    basis: { ...defaults.basis, ...(overrides.basis ?? {}) }
  };

  const costOfEquity = a.riskFree + a.beta * a.erp;
  const perShareOf = equityValue =>
    a.shareScale && base.shares > 0 && Number.isFinite(equityValue)
      ? (equityValue * a.unitScale) / (base.shares * a.shareScale)
      : null;
  const pb = justifiedPb(a.roe, costOfEquity, a.growth);
  const equityValue = pb != null ? pb * base.equity : null;
  const perShare = perShareOf(equityValue);
  const upside = perShare != null && a.sharePrice > 0 ? perShare / a.sharePrice - 1 : null;
  const coeSteps = COE_STEPS.map(step => costOfEquity + step);
  const roeSteps = ROE_STEPS.map(step => a.roe + step);
  const showPerShare = perShare != null;
  const values = roeSteps.map(roe =>
    coeSteps.map(coe => {
      const p = justifiedPb(roe, coe, a.growth);
      if (p == null) return null;
      return showPerShare ? perShareOf(p * base.equity) : p * base.equity;
    })
  );

  return {
    kind: 'financial',
    sector,
    unit,
    periods,
    years: [],
    hist,
    base,
    assumptions: a,
    defaults,
    valuation: {
      costOfEquity,
      pb,
      bookValue: base.equity,
      equityValue,
      perShare,
      upside,
      impliedPe: equityValue != null && base.netIncome ? equityValue / base.netIncome : null,
      sensitivity: { coe: coeSteps, roe: roeSteps, values, perShare: showPerShare }
    }
  };
}

const SHEETS = { cover: 'Cover', inputs: 'Inputs', fin: 'Financials', val: 'Valuation' };
const IN = { riskFree: 5, erp: 6, beta: 7, roe: 8, growth: 9, sharePrice: 10, unitScale: 11, shareScale: 12 };
const FIN = { revenue: 5, ni: 6, equity: 7, ta: 8, roe: 9, eps: 10, shares: 11 };

/** The workbook for a bank or insurer. Returns { buffer, checkCells }. */
export async function buildFinancialWorkbook({ company, fileName, facts, assay, model, meta = {}, cache = true }) {
  const {
    font,
    title,
    header,
    label,
    q,
    AMOUNT,
    PCT,
    MULT,
    PER_SHARE,
    INPUT_BLUE,
    INPUT_FILL,
    LINE,
    MUTED,
    LINK_GREEN
  } = XL;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vult';
  wb.title = `${company || 'Company'} valuation`;
  wb.calcProperties.fullCalcOnLoad = true;
  const checkCells = [];
  const a = model.assumptions;
  const v = model.valuation;
  const unitLabel = model.unit.label;
  const sectorName =
    model.sector === 'insurer' ? 'insurer' : model.sector === 'bank' ? 'bank' : 'financial institution';

  const put = (sheet, address, formula, result, { fmt, color, bold } = {}) => {
    const cell = sheet.getCell(address);
    cell.value =
      cache && result !== undefined && result !== null && !(typeof result === 'number' && !Number.isFinite(result))
        ? { formula, result }
        : { formula };
    if (fmt) cell.numFmt = fmt;
    cell.font = font({ bold, color: { argb: color || XL.INK } });
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
  const expect = (sheet, address, expected, what) =>
    Number.isFinite(expected) && checkCells.push({ ref: `${q(sheet)}!${address}`, expected, what });

  const cover = wb.addWorksheet(SHEETS.cover);
  title(
    cover,
    `${company || 'Company'}: valuation`,
    `Built by Vult from ${fileName || 'the annual report'}. Figures in ${unitLabel}.`,
    4
  );
  [
    ['Source filing', fileName || ''],
    ['Fiscal year end', meta.yearEnd || ''],
    ['Reported unit', unitLabel],
    ['Historical years', model.periods.join(', ')],
    ['Valuation basis', `Justified price to book, because this is a ${sectorName}`],
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
      'A corporate DCF does not apply to a bank or insurer. Value is book equity times (ROE - g) / (cost of equity - g).'
    ],
    ['', 'Every historical figure links to Extracted Data, which gives the PDF page and printed row it was read from.'],
    ['', 'Blue cells on Inputs are assumptions. Change them and the valuation recalculates.'],
    ['', 'Regulatory capital, credit quality and solvency ratios are not extracted yet; check them in the filing.']
  ].forEach((values, i) => {
    const row = cover.getRow(4 + i);
    row.values = values;
    row.getCell(1).font = font({ bold: true });
    row.getCell(2).font = font();
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  });
  cover.getColumn(1).width = 24;
  cover.getColumn(2).width = 96;

  const { ref, note } = addExtractedData(wb, facts);

  const inp = wb.addWorksheet(SHEETS.inputs, { views: [{ state: 'frozen', ySplit: 4 }] });
  title(inp, 'Inputs', 'Blue cells are assumptions; the basis column says where each default comes from.', 3);
  header(inp, 4, ['Valuation input', 'Basis', 'Value']);
  [
    ['riskFree', 'Risk-free rate', PCT],
    ['erp', 'Equity risk premium', PCT],
    ['beta', 'Levered beta', '0.00'],
    ['roe', 'Sustainable return on equity', PCT],
    ['growth', 'Long-run growth', PCT],
    ['sharePrice', 'Current share price', PER_SHARE],
    ['unitScale', 'Reported unit scale', '#,##0'],
    ['shareScale', 'Share count scale', '#,##0']
  ].forEach(([key, text, fmt]) => {
    label(inp, IN[key], text);
    inp.getCell(IN[key], 2).value = a.basis?.[key] ?? '';
    inp.getCell(IN[key], 2).font = font({ size: 9, color: { argb: MUTED } });
    input(inp, `C${IN[key]}`, a[key], fmt);
  });
  inp.getColumn(1).width = 34;
  inp.getColumn(2).width = 64;
  inp.getColumn(3).width = 14;
  const IN_ABS = key => `${q(SHEETS.inputs)}!$C$${IN[key]}`;

  const fin = wb.addWorksheet(SHEETS.fin, { views: [{ state: 'frozen', ySplit: 4, xSplit: 1 }] });
  title(fin, 'Financials', 'Reported figures, each linked to Extracted Data.', 1 + model.periods.length);
  header(fin, 4, [unitLabel, ...model.periods.map(p => `FY${p}A`)]);
  [
    ['revenue', 'Total income or revenue', { bold: true }],
    ['ni', 'Net income', { bold: true }],
    ['equity', 'Total equity'],
    ['ta', 'Total assets'],
    ['roe', 'Return on equity', { italic: true }],
    ['eps', `Diluted EPS (as reported${a.epsFactor === 0.01 ? ', pence or cents' : ''})`],
    ['shares', 'Diluted shares (as reported)']
  ].forEach(([key, text, opts]) => label(fin, FIN[key], text, opts));
  const link = (address, found, result, fmt = AMOUNT) => {
    if (!found) return;
    const cell = put(fin, address, found.formula, result, { fmt, color: LINK_GREEN });
    note(cell, found.facts);
  };
  model.hist.forEach((h, i) => {
    const c = colLetter(2 + i);
    const p = h.period;
    link(`${c}${FIN.revenue}`, ref('income', 'revenue', p), h.revenue);
    link(`${c}${FIN.ni}`, ref('income', 'net_income', p), h.netIncome);
    link(`${c}${FIN.equity}`, ref('balance', 'total_equity', p), h.equity);
    link(`${c}${FIN.ta}`, ref('balance', 'total_assets', p), h.ta);
    if (Number.isFinite(h.roe)) {
      const formula = h.roeOnAverage
        ? `${c}${FIN.ni}/AVERAGE(${colLetter(1 + i)}${FIN.equity},${c}${FIN.equity})`
        : `${c}${FIN.ni}/${c}${FIN.equity}`;
      put(fin, `${c}${FIN.roe}`, formula, h.roe, { fmt: PCT });
      expect(SHEETS.fin, `${c}${FIN.roe}`, h.roe, `Return on equity FY${p}`);
    }
    link(`${c}${FIN.eps}`, ref('income', 'eps_diluted', p), h.eps, PER_SHARE);
    link(`${c}${FIN.shares}`, ref('income', 'shares_diluted', p), h.shares, '#,##0');
  });
  fin.getColumn(1).width = 40;
  for (let c = 2; c <= 1 + model.periods.length; c += 1) fin.getColumn(c).width = 14;
  const baseCol = colLetter(1 + model.periods.length);
  const finRef = row => `${q(SHEETS.fin)}!${baseCol}${row}`;

  const val = wb.addWorksheet(SHEETS.val, { views: [{ state: 'frozen', ySplit: 4 }] });
  title(val, 'Valuation', `Justified price to book. ${unitLabel} unless stated.`, 7);
  header(val, 4, ['Justified price to book', '', 'Value']);
  const perShareOk = v.perShare != null;
  const rows = [
    [5, 'Risk-free rate', IN_ABS('riskFree'), a.riskFree, PCT, LINK_GREEN],
    [6, 'Equity risk premium', IN_ABS('erp'), a.erp, PCT, LINK_GREEN],
    [7, 'Levered beta', IN_ABS('beta'), a.beta, '0.00', LINK_GREEN],
    [8, 'Cost of equity', 'C5+C7*C6', v.costOfEquity, PCT],
    [9, 'Sustainable return on equity', IN_ABS('roe'), a.roe, PCT, LINK_GREEN],
    [10, 'Long-run growth', IN_ABS('growth'), a.growth, PCT, LINK_GREEN],
    [11, 'Justified price to book', 'IF(C8>C10,(C9-C10)/(C8-C10),"")', v.pb ?? '', MULT],
    [12, `Book equity (${unitLabel})`, finRef(FIN.equity), v.bookValue, AMOUNT, LINK_GREEN],
    [13, `Equity value (${unitLabel})`, 'IFERROR(C11*C12,"")', v.equityValue ?? '', AMOUNT],
    [14, 'Diluted shares (as reported)', finRef(FIN.shares), model.base.shares ?? '', '#,##0', LINK_GREEN],
    [
      15,
      'Value per share',
      `IF(AND(N(${IN_ABS('shareScale')})>0,N(C14)>0,N(C13)<>0),C13*${IN_ABS('unitScale')}/(C14*${IN_ABS('shareScale')}),"")`,
      v.perShare ?? '',
      PER_SHARE
    ],
    [
      16,
      'Current share price',
      `IF(N(${IN_ABS('sharePrice')})>0,${IN_ABS('sharePrice')},"")`,
      a.sharePrice ?? '',
      PER_SHARE,
      LINK_GREEN
    ],
    [17, 'Upside / (downside)', 'IF(AND(N(C15)<>0,N(C16)>0),C15/C16-1,"")', v.upside ?? '', PCT],
    [18, 'Implied price to earnings', `IFERROR(C13/${finRef(FIN.ni)},"")`, v.impliedPe ?? '', MULT]
  ];
  for (const [row, text, formula, result, fmt, color] of rows) {
    const strong = row === 11 || row === 13 || row === 15;
    label(val, row, text, { bold: strong });
    put(val, `C${row}`, formula, result, { fmt, color, bold: strong });
  }
  expect(SHEETS.val, 'C8', v.costOfEquity, 'Cost of equity');
  expect(SHEETS.val, 'C11', v.pb, 'Justified price to book');
  expect(SHEETS.val, 'C13', v.equityValue, 'Equity value');
  if (perShareOk) expect(SHEETS.val, 'C15', v.perShare, 'Value per share');

  val.mergeCells('A20:G20');
  val.getCell('A20').value =
    `Sensitivity: ${perShareOk ? 'value per share' : 'equity value'} by cost of equity (across) and ROE (down)`;
  val.getCell('A20').font = font({ bold: true, color: { argb: 'FFFFFFFF' } });
  val.getCell('A20').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.ACCENT } };
  label(val, 21, 'ROE / cost of equity', { italic: true });
  const s = v.sensitivity;
  COE_STEPS.forEach((step, i) =>
    put(val, `${colLetter(3 + i)}21`, `$C$8${step < 0 ? '' : '+'}${step}`, s.coe[i], { fmt: PCT, bold: true })
  );
  const tail = perShareOk ? `*${IN_ABS('unitScale')}/($C$14*${IN_ABS('shareScale')})` : '';
  ROE_STEPS.forEach((step, r) => {
    const row = 22 + r;
    put(val, `B${row}`, `$C$9${step < 0 ? '' : '+'}${step}`, s.roe[r], { fmt: PCT, bold: true });
    COE_STEPS.forEach((_, i) => {
      const coe = `${colLetter(3 + i)}$21`;
      put(
        val,
        `${colLetter(3 + i)}${row}`,
        `IF(${coe}<=$C$10,"",($B${row}-$C$10)/(${coe}-$C$10)*$C$12${tail})`,
        s.values[r][i] ?? '',
        {
          fmt: perShareOk ? PER_SHARE : AMOUNT
        }
      );
    });
  });
  expect(SHEETS.val, 'E24', s.values[2][2], 'Sensitivity centre equals the base case');
  expect(SHEETS.val, 'C22', s.values[0][0], 'Sensitivity corner');
  val.getColumn(1).width = 38;
  val.getColumn(2).width = 12;
  for (let c = 3; c <= 7; c += 1) val.getColumn(c).width = 14;

  addAssayerSheet(wb, assay);
  addCorrectionsSheet(wb, meta.corrections);
  ['Cover', SHEETS.inputs, SHEETS.fin, SHEETS.val, 'Assayer', 'Corrections', 'Extracted Data']
    .filter(name => wb.getWorksheet(name))
    .forEach((name, i) => (wb.getWorksheet(name).orderNo = i));
  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, checkCells };
}
