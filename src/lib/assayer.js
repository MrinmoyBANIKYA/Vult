/**
 * The Assayer: deterministic checks on extracted figures and the model built from them.
 * Every result here is computed by code. A model's say-so is never counted as a pass.
 */
import { STATEMENT_KEYS } from '../../supabase/functions/_shared/statements.js';
import { normalizeText } from './pdf-text.js';
import { factIndex, reconcileShares } from './model.js';
import { parseCell, splitRow } from './filing.js';

const fmt = value =>
  Number.isFinite(value) ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value) : 'n/a';
// Printed totals can differ from their parts by a rounding unit ("figures may not sum due to rounding").
const close = (a, b, tolerance = Math.max(1, Math.abs(b) * 1e-4)) =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;

// Each entry is [statement, key, alternative keys that together stand in for it, hint when missing].
const REQUIRED = [
  ['income', 'revenue'],
  ['income', 'operating_income'],
  ['income', 'pretax_income'],
  ['income', 'income_tax'],
  ['income', 'net_income'],
  ['balance', 'cash_and_equivalents'],
  ['balance', 'current_assets'],
  ['balance', 'total_assets', ['current_assets', 'noncurrent_assets']],
  ['balance', 'current_liabilities'],
  ['balance', 'total_equity'],
  [
    'cashflow',
    'depreciation_amortization',
    null,
    'UK cash flow statements often start from cash generated from operations, with depreciation in a note; map it from the note page.'
  ],
  ['cashflow', 'operating_cash_flow'],
  ['cashflow', 'capital_expenditure']
];

// Banks and insurers do not split current and non-current items and are valued on equity, so they need less.
const REQUIRED_FINANCIAL = [
  ['income', 'revenue'],
  ['income', 'pretax_income'],
  ['income', 'income_tax'],
  ['income', 'net_income'],
  ['balance', 'cash_and_equivalents'],
  ['balance', 'total_assets'],
  ['balance', 'total_equity'],
  ['cashflow', 'operating_cash_flow']
];
const FINANCIAL_SECTORS = new Set(['bank', 'insurer', 'financial']);

/** Whether a number is printed anywhere on a page, in any sign or bracket convention. */
export function valueOnPage(text, value) {
  if (!Number.isFinite(value)) return false;
  const tokens = String(text ?? '').match(/\(?-?[$£€]?\d[\d,]*(?:\.\d+)?\)?/g) ?? [];
  return tokens.some(token => {
    const parsed = parseCell(token);
    return parsed !== null && Math.abs(Math.abs(parsed) - Math.abs(value)) < 1e-9;
  });
}

/**
 * @param facts    resolved facts (see filing.resolveFacts)
 * @param issues   rows a model mapped that could not be aligned to year columns
 * @param pageTexts full text of every PDF page, by page number
 * @param unit     { scale }
 * @param sector   'corporate', 'bank' or 'insurer' (see financials.detectSector)
 */
export function assay({
  facts = [],
  issues = [],
  pageTexts = {},
  unit = { scale: 1 },
  sector = 'corporate',
  reference = null,
  ocrPages = []
}) {
  const checks = [];
  const add = (group, title, passed, detail, extra = {}) =>
    checks.push({ key: `${group}:${checks.length}`, group, title, passed, detail, ...extra });
  const index = factIndex(facts);
  const periods = [...new Set(facts.map(f => f.period))].sort();
  const g = (statement, key, period) => index.get(statement, key, period);

  // 1. Every figure is re-read from its cited page and column. A figure an analyst typed in must at least
  // appear on the page they cited.
  for (const fact of facts) {
    const page = pageTexts[fact.page] ?? '';
    if (fact.source === 'analyst') {
      const passed = valueOnPage(page, fact.value);
      add(
        'source',
        'Analyst figure appears on its page',
        passed,
        passed
          ? `${fact.name} FY${fact.period}: ${fmt(fact.value)} (${fact.label.toLowerCase()}) is printed on PDF page ${fact.page}.`
          : `${fact.name} FY${fact.period}: ${fmt(fact.value)} (${fact.label.toLowerCase()}) is not printed on PDF page ${fact.page}. Check the page or the figure.`,
        { period: fact.period, page: fact.page, factKey: `${fact.statement}:${fact.key}:${fact.period}` }
      );
      continue;
    }
    const onPage = normalizeText(page).includes(normalizeText(fact.quote));
    const lastLine = String(fact.quote).split('\n').at(-1);
    const reread = parseCell(splitRow(lastLine).cells[fact.column] ?? '');
    const passed = onPage && reread === fact.value;
    add(
      'source',
      'Figure matches the filing',
      passed,
      passed
        ? `${fact.name} FY${fact.period}: ${fact.printed} on PDF page ${fact.page}, row "${fact.label}".`
        : !onPage
          ? `${fact.name} FY${fact.period}: the printed row was not found on PDF page ${fact.page}.`
          : `${fact.name} FY${fact.period}: page ${fact.page} reads ${fmt(reread)}, not ${fmt(fact.value)}.`,
      { period: fact.period, page: fact.page, factKey: `${fact.statement}:${fact.key}:${fact.period}` }
    );
  }

  // Pages read by OCR: a misread digit can still pass the re-read above, so an analyst compares them.
  const scannedUsed = [...new Set(facts.filter(f => ocrPages.includes(Number(f.page))).map(f => f.page))].sort(
    (a, b) => a - b
  );
  for (const page of scannedUsed)
    add(
      'source',
      'Scanned page read by OCR',
      false,
      `PDF page ${page} has no text layer and was read by OCR. Compare its figures with the page image; the accounting checks catch most misreads, not all.`,
      { page }
    );

  // 2. The row a model picked must plausibly be that line item.
  const picked = new Map();
  for (const fact of facts)
    if (fact.source !== 'analyst') picked.set(`${fact.statement}:${fact.key}:${fact.rowId}`, fact);
  for (const fact of picked.values()) {
    const pattern = STATEMENT_KEYS[fact.statement]?.[fact.key]?.[2];
    const passed = !pattern || pattern.test(fact.label);
    add(
      'label',
      'Row label fits the line item',
      passed,
      passed
        ? `${fact.name}: "${fact.label}" (PDF page ${fact.page}).`
        : `${fact.name} was matched to "${fact.label}" on PDF page ${fact.page}. Confirm this is the right row.`,
      { page: fact.page }
    );
  }

  // 3. Lines the model needs.
  const latest = periods.at(-1);
  const found = (statement, key) => facts.some(f => f.statement === statement && f.key === key);
  for (const [statement, key, alternatives, hint] of FINANCIAL_SECTORS.has(sector) ? REQUIRED_FINANCIAL : REQUIRED) {
    const present = found(statement, key);
    const standIn = !present && alternatives?.every(other => found(statement, other));
    const name = STATEMENT_KEYS[statement][key][0];
    add(
      'coverage',
      'Required line found',
      present || standIn,
      present
        ? `${name} found.`
        : standIn
          ? `${name} is not printed; it is the sum of ${alternatives.map(k => STATEMENT_KEYS[statement][k][0].toLowerCase()).join(' and ')}.`
          : `${name} was not found in the ${statement} statement. Add it before relying on the model.${hint ? ` ${hint}` : ''}`
    );
  }
  for (const issue of issues) add('coverage', 'Row aligned to year columns', false, issue.detail, { page: issue.page });

  // 4. Accounting identities on the reported figures.
  for (const period of periods) {
    const revenue = g('income', 'revenue', period);
    const cogs = g('income', 'cost_of_revenue', period);
    const gross = g('income', 'gross_profit', period);
    if ([revenue, cogs, gross].every(Number.isFinite)) {
      const passed = close(revenue - Math.abs(cogs), gross);
      add(
        'accounts',
        'Revenue less cost of revenue equals gross profit',
        passed,
        passed ? `Ties for FY${period}.` : `Differs by ${fmt(revenue - Math.abs(cogs) - gross)} for FY${period}.`,
        { period }
      );
    }
    const pretax = g('income', 'pretax_income', period);
    const tax = g('income', 'income_tax', period);
    const ni = g('income', 'net_income', period);
    if ([pretax, tax, ni].every(Number.isFinite)) {
      const passed = close(pretax - tax, ni) || close(pretax + tax, ni);
      add(
        'accounts',
        'Pre-tax income less tax equals net income',
        passed,
        passed
          ? `Ties for FY${period}.`
          : `Differs by ${fmt(pretax - tax - ni)} for FY${period}; check for minority interests or discontinued operations.`,
        { period }
      );
    }
    const cfNi = g('cashflow', 'net_income', period);
    if (Number.isFinite(ni) && Number.isFinite(cfNi)) {
      const passed = close(ni, cfNi);
      add(
        'accounts',
        'Net income agrees between income statement and cash flow',
        passed,
        passed ? `${fmt(ni)} in both for FY${period}.` : `${fmt(ni)} against ${fmt(cfNi)} for FY${period}.`,
        { period }
      );
    }

    const tcaForTotal = g('balance', 'current_assets', period);
    const nca = g('balance', 'noncurrent_assets', period);
    const taPrinted = g('balance', 'total_assets', period);
    const ta = taPrinted ?? (Number.isFinite(tcaForTotal) && Number.isFinite(nca) ? tcaForTotal + nca : null);
    const tcl = g('balance', 'current_liabilities', period);
    const ncl = g('balance', 'noncurrent_liabilities', period);
    const tlPrinted = g('balance', 'total_liabilities', period);
    const tl = tlPrinted ?? (Number.isFinite(tcl) && Number.isFinite(ncl) ? tcl + ncl : null);
    if ([taPrinted, tcaForTotal, nca].every(Number.isFinite)) {
      const passed = close(tcaForTotal + nca, taPrinted);
      add(
        'accounts',
        'Current and non-current assets sum to total assets',
        passed,
        passed ? `Ties for FY${period}.` : `Differs by ${fmt(tcaForTotal + nca - taPrinted)} for FY${period}.`,
        { period }
      );
    }
    if ([tlPrinted, tcl, ncl].every(Number.isFinite)) {
      const passed = close(tcl + ncl, tlPrinted);
      add(
        'accounts',
        'Current and non-current liabilities sum to total liabilities',
        passed,
        passed ? `Ties for FY${period}.` : `Differs by ${fmt(tcl + ncl - tlPrinted)} for FY${period}.`,
        { period }
      );
    }
    const netAssets = g('balance', 'net_assets', period);
    const equityForNet = g('balance', 'total_equity', period);
    if (Number.isFinite(netAssets) && Number.isFinite(equityForNet)) {
      const passed = close(netAssets, equityForNet);
      add(
        'accounts',
        'Net assets equal total equity',
        passed,
        passed
          ? `${fmt(netAssets)} for FY${period}.`
          : `Net assets of ${fmt(netAssets)} against total equity of ${fmt(equityForNet)} for FY${period}.`,
        { period }
      );
    }
    if (Number.isFinite(netAssets) && Number.isFinite(ta) && Number.isFinite(tl)) {
      const passed = close(ta - tl, netAssets);
      add(
        'accounts',
        'Total assets less total liabilities equal net assets',
        passed,
        passed ? `Ties for FY${period}.` : `Differs by ${fmt(ta - tl - netAssets)} for FY${period}.`,
        { period }
      );
    }
    const te = g('balance', 'total_equity', period);
    const tle = g('balance', 'total_liabilities_and_equity', period);
    if (Number.isFinite(ta) && Number.isFinite(te) && (Number.isFinite(tl) || Number.isFinite(tle))) {
      const right = Number.isFinite(tl) ? tl + te : tle;
      const passed = close(ta, right);
      add(
        'accounts',
        'Balance sheet balances',
        passed,
        passed
          ? `Assets of ${fmt(ta)} equal liabilities and equity for FY${period}.`
          : `Assets differ from liabilities and equity by ${fmt(ta - right)} for FY${period}. Check whether equity includes non-controlling interests.`,
        { period }
      );
    }
    const tca = g('balance', 'current_assets', period);
    if (Number.isFinite(tca) && Number.isFinite(ta)) {
      const passed = tca <= ta;
      add(
        'accounts',
        'Current assets do not exceed total assets',
        passed,
        passed ? `Holds for FY${period}.` : `Current assets exceed total assets for FY${period}.`,
        { period }
      );
    }

    const cfo = g('cashflow', 'operating_cash_flow', period);
    const cfi = g('cashflow', 'investing_cash_flow', period);
    const cff = g('cashflow', 'financing_cash_flow', period);
    const fx = g('cashflow', 'fx_effect', period) ?? 0;
    const change = g('cashflow', 'cash_change', period);
    if ([cfo, cfi, cff, change].every(Number.isFinite)) {
      const passed = close(cfo + cfi + cff + fx, change);
      add(
        'accounts',
        'Operating, investing and financing flows sum to the change in cash',
        passed,
        passed
          ? `Ties for FY${period}.`
          : `Flows sum to ${fmt(cfo + cfi + cff + fx)} against a reported change of ${fmt(change)} for FY${period}.`,
        { period }
      );
    }
    const begin = g('cashflow', 'cash_beginning', period);
    const end = g('cashflow', 'cash_ending', period);
    if ([begin, change, end].every(Number.isFinite)) {
      const passed = close(begin + change, end);
      add(
        'accounts',
        'Opening cash plus the change equals closing cash',
        passed,
        passed ? `Ties for FY${period}.` : `Differs by ${fmt(begin + change - end)} for FY${period}.`,
        { period }
      );
    }
    const bsCash = g('balance', 'cash_and_equivalents', period);
    if (Number.isFinite(end) && Number.isFinite(bsCash)) {
      const passed = close(end, bsCash);
      add(
        'accounts',
        'Closing cash agrees with the balance sheet',
        passed,
        passed
          ? `${fmt(end)} in both for FY${period}.`
          : `Cash flow closes at ${fmt(end)}, balance sheet shows ${fmt(bsCash)} for FY${period}, a gap of ${fmt(end - bsCash)}. Usually restricted cash; confirm in the cash note.`,
        { period }
      );
    }
  }

  // 6. Against the company's own structured filing (SEC XBRL or ESEF), where the analyst fetched it.
  if (reference?.annual) {
    if (reference.currency && reference.currency !== unit.currency) {
      add(
        'reference',
        'Structured filing in the same currency',
        false,
        `${reference.source} reports in ${reference.currency}; the PDF statements are in ${unit.currency}, so figures were not compared.`
      );
    } else {
      for (const [ref, byYear] of Object.entries(reference.annual)) {
        const [statement, key] = ref.split(':');
        if (!STATEMENT_KEYS[statement]?.[key] || key === 'eps_diluted' || key === 'shares_diluted') continue;
        for (const period of periods) {
          const expected = byYear[period];
          const printed = g(statement, key, period);
          if (!Number.isFinite(expected) || !Number.isFinite(printed)) continue;
          const ours = Math.abs(printed * unit.scale);
          // Rounding to the printed unit allows half a unit; or 0.05%, whichever is larger.
          const passed = Math.abs(ours - Math.abs(expected)) <= Math.max(unit.scale / 2, Math.abs(expected) * 5e-4);
          const name = STATEMENT_KEYS[statement][key][0];
          add(
            'reference',
            `Figure agrees with the ${reference.short ?? 'structured filing'}`,
            passed,
            passed
              ? `${name} FY${period}: ${fmt(printed)} agrees with ${reference.source}.`
              : `${name} FY${period}: the PDF gives ${fmt(printed)} (${unit.label}), ${reference.source} gives ${fmt(Math.abs(expected) / unit.scale)}. Check the row and the period.`,
            { period, factKey: `${statement}:${key}:${period}` }
          );
        }
      }
    }
  }

  // 5. Share count scale, confirmed against reported EPS.
  if (latest) {
    const reconciled = reconcileShares({
      netIncome: g('income', 'net_income', latest),
      shares: g('income', 'shares_diluted', latest),
      eps: g('income', 'eps_diluted', latest),
      unitScale: unit.scale
    });
    const scale = reconciled?.scale;
    add(
      'accounts',
      'Net income per diluted share matches reported EPS',
      Boolean(scale),
      scale
        ? `Agrees for FY${latest} with shares counted in ${scale === 1 ? 'units' : scale === 1e3 ? 'thousands' : scale === 1e6 ? 'millions' : 'billions'}${reconciled.epsFactor === 0.01 ? ' and EPS printed in pence or cents' : ''}.`
        : `Could not reconcile net income, diluted shares and EPS for FY${latest}; per-share values are left blank.`,
      { period: latest }
    );
  }

  return summarise(checks);
}

/** Adds the workbook recalculation results to an assay. */
export function withRecalc(result, recalc, checkCells) {
  const checks = result.checks.filter(check => check.group !== 'workbook');
  if (recalc?.error) {
    checks.push({
      key: 'workbook:skipped',
      group: 'workbook',
      title: 'Workbook recalculated independently',
      passed: false,
      detail: recalc.error
    });
    return summarise(checks);
  }
  for (const cell of checkCells) {
    const actual = recalc.values[cell.ref];
    const tolerance = Math.max(0.01, Math.abs(cell.expected) * 1e-6);
    const passed = Number.isFinite(actual) && Math.abs(actual - cell.expected) <= tolerance;
    checks.push({
      key: `workbook:${cell.ref}`,
      group: 'workbook',
      title: 'Workbook formula recalculates to the engine value',
      passed,
      detail: passed
        ? `${cell.what}: ${fmt(actual)} in LibreOffice (${cell.ref}).`
        : `${cell.what}: LibreOffice gives ${typeof actual === 'object' && actual ? JSON.stringify(actual) : fmt(actual)}, the engine ${fmt(cell.expected)} (${cell.ref}).`
    });
  }
  return summarise(checks);
}

function summarise(checks) {
  const passed = checks.filter(check => check.passed).length;
  return { checks, passed, flagged: checks.length - passed, total: checks.length };
}
