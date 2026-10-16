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
  [
    'income',
    'operating_income',
    ['revenue', 'operating_expenses'],
    null,
    'is not printed; the model derives it as revenue less cost of revenue, operating expenses and exceptional items.'
  ],
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
  // The label of a balance sheet row that prints `value`, read from the page text.
  const balancePages = [...new Set(facts.filter(f => f.statement === 'balance').map(f => f.page))];
  // What fills a gap between assets and liabilities plus equity: non-controlling interests the equity line
  // left out, a printed line such as redeemable interests, or both. Null when nothing printed explains it.
  const explainEquityGap = (gap, period) => {
    const nci = Math.abs(g('balance', 'nci_equity', period) ?? 0);
    if (nci && close(gap, nci)) return `non-controlling interests of ${fmt(nci)}`;
    const row = printedBalanceRow(gap);
    if (row) return `"${row}" of ${fmt(gap)}`;
    const rest = nci && gap > nci ? printedBalanceRow(gap - nci) : null;
    return rest ? `non-controlling interests of ${fmt(nci)} and "${rest}" of ${fmt(gap - nci)}` : null;
  };
  const printedBalanceRow = value => {
    for (const page of balancePages)
      for (const line of String(pageTexts[page] ?? '').split('\n')) {
        const { label, cells } = splitRow(line);
        if (label && cells.some(cell => close(parseCell(cell), value))) return label;
      }
    return null;
  };

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
    // The heading a row sits under is part of what it means ("Earnings per share, diluted" over "Net income").
    const passed = !pattern || pattern.test(`${fact.section ?? ''} ${fact.label}`);
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
  for (const [statement, key, alternatives, hint, derived] of FINANCIAL_SECTORS.has(sector)
    ? REQUIRED_FINANCIAL
    : REQUIRED) {
    const present = found(statement, key);
    const standIn = !present && alternatives?.every(other => found(statement, other));
    const name = STATEMENT_KEYS[statement][key][0];
    add(
      'coverage',
      'Required line found',
      present || standIn,
      present
        ? `${name} found.`
        : standIn && derived
          ? `${name} ${derived}`
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
    const opex = g('income', 'operating_expenses', period);
    const ebit = g('income', 'operating_income', period);
    if ([gross, opex, ebit].every(Number.isFinite)) {
      const exceptional = Math.abs(g('income', 'exceptional_items', period) ?? 0);
      const passed = close(gross - Math.abs(opex), ebit) || close(gross - Math.abs(opex) - exceptional, ebit);
      add(
        'accounts',
        'Gross profit less operating expenses equals operating income',
        passed,
        passed
          ? `Ties for FY${period}.`
          : `Differs by ${fmt(gross - Math.abs(opex) - ebit)} for FY${period}; check for an operating expense line that was missed or counted twice, or other operating income.`,
        { period }
      );
    }
    const pretax = g('income', 'pretax_income', period);
    const tax = g('income', 'income_tax', period);
    const ni = g('income', 'net_income', period);
    // Net income attributable to the company excludes the minority interests' share, where one is printed.
    const nci = Math.abs(g('income', 'net_income_nci', period) ?? 0);
    if ([pretax, tax, ni].every(Number.isFinite)) {
      const passed = [0, nci].some(
        minority => close(pretax - tax - minority, ni) || close(pretax + tax - minority, ni)
      );
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
      // The cash flow often starts from net income including minority interests.
      const withMinority = !passed && nci > 0 && close(ni + nci, cfNi);
      add(
        'accounts',
        'Net income agrees between income statement and cash flow',
        passed || withMinority,
        passed
          ? `${fmt(ni)} in both for FY${period}.`
          : withMinority
            ? `${fmt(cfNi)} on the cash flow is ${fmt(ni)} plus ${fmt(nci)} to minority interests for FY${period}.`
            : `${fmt(ni)} against ${fmt(cfNi)} for FY${period}.`,
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
      // US filings print redeemable interests ("mezzanine" equity) between liabilities and equity; the
      // grand total still equals assets and the gap is a printed line of its own.
      const mezzanine =
        !passed && Number.isFinite(tl) && close(ta, tle) && ta > right ? explainEquityGap(ta - right, period) : null;
      add(
        'accounts',
        'Balance sheet balances',
        passed || Boolean(mezzanine),
        passed
          ? `Assets of ${fmt(ta)} equal liabilities and equity for FY${period}.`
          : mezzanine
            ? `Assets of ${fmt(ta)} equal liabilities, equity and ${mezzanine} for FY${period}.`
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
      // The cash flow's own label says it adds restricted cash, and its total is the larger one.
      const restricted =
        !passed &&
        end > bsCash &&
        facts.some(
          f =>
            f.statement === 'cashflow' && f.key === 'cash_ending' && f.period === period && /restricted/i.test(f.label)
        );
      // Banks define cash for the cash flow as two balance sheet lines ("cash and due from banks" plus
      // "deposits with banks"): the gap is then printed on the balance sheet as a line of its own.
      const partner = !passed && !restricted && end > bsCash ? printedBalanceRow(end - bsCash) : null;
      add(
        'accounts',
        'Closing cash agrees with the balance sheet',
        passed || restricted || Boolean(partner),
        passed
          ? `${fmt(end)} in both for FY${period}.`
          : partner
            ? `Cash flow closes at ${fmt(end)}: balance sheet cash of ${fmt(bsCash)} plus "${partner}" of ${fmt(end - bsCash)} for FY${period}.`
            : restricted
              ? `Cash flow closes at ${fmt(end)} including restricted cash, which its label states; the balance sheet shows ${fmt(bsCash)} of cash for FY${period}, so restricted cash is ${fmt(end - bsCash)}.`
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
