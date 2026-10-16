/**
 * Deterministic reading of an annual report's text: finds the statement pages, splits them into rows and
 * year columns, and turns a model's row classification into source-quoted facts. No model output is
 * trusted for a number; values are always read from the page text here.
 *
 * Handles US 10-K layouts and UK/IFRS annual reports: Notes columns, £m and £'000 units, 52-week and
 * "2024/25" periods, and group statements printed next to the parent company's own.
 */
import { STATEMENT_KEYS, STATEMENT_NAMES } from '../../supabase/functions/_shared/statements.js';

const STATEMENTS = [
  {
    key: 'income',
    heading:
      /statements? of (consolidated )?(comprehensive )?(operations|income|earnings)|income statements?|statements? of profit or loss|profit and loss account/i,
    indicators: [
      /revenue|net sales|turnover/i,
      /net income|loss|profit for the (financial )?(year|period)/i,
      /cost of (sales|revenue)|operating (profit|income)/i
    ],
    closing: /net (income|loss|earnings)|profit for the (financial )?(year|period)|earnings per share/i
  },
  {
    key: 'balance',
    heading: /balance sheets?|statements? of (consolidated )?financial position/i,
    indicators: [
      /total assets|non-?current assets/i,
      /total liabilities|current liabilities/i,
      /stockholders'? equity|shareholders['’]? equity|total equity|net assets/i
    ],
    closing: /total liabilities and|total equity and liabilities|total equity\b|net assets/i
  },
  {
    key: 'cashflow',
    heading: /statements? of (consolidated )?cash flows?|cash flows? statements?/i,
    indicators: [
      /operating activities|net cash (from|provided by|used in) operations/i,
      /investing activities|net cash (from|provided by|used in) investing/i,
      /financing activities|net cash (from|provided by|used in) financing/i
    ],
    closing: /end of (the )?(year|period)|ending balance|closing cash|cash equivalents at \d{1,2} [a-z]+/i
  }
];

// A parent-company-only statement (common in UK annual reports) is not the group's.
const PARENT_ONLY = /parent company|company (balance sheet|statement of (financial position|cash flows?|changes))/i;
const GROUP = /consolidated|\bgroup\b/i;

// Pence and cents per share may carry a unit: "23.4p", "(5.1)c".
const NUMBER_CELL = /^\(?-?[$£€]?\s?\d[\d,]*(?:\.\d+)?[pc]?\)?[pc]?$/;
const DASH_CELL = /^[—–-]$/;
const YEAR = /\b(?:19|20)\d{2}\b/g;
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
// Dates and period words that sit in column headers next to the year: "31 March", "December 31,", "52 weeks".
const DATE_NOISE = new RegExp(
  `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}|${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b,?|\\b5[23]\\s*weeks?\\b|\\b\\d{1,2},`,
  'gi'
);
const UNIT_TOKEN = /[£$€]\s?'?000|[£$€]\s?(?:m|bn|millions?|billions?)\b|\b(?:GBP|USD|EUR)\s?(?:m|bn|'?000)\b/gi;
// A line holding only column captions: "Notes   £m   £m", "Restated".
const CAPTION_LINE =
  /^(?:\s|notes?|restated|\*|\(|\)|[£$€]\s?'?000|[£$€]\s?(?:m|bn|millions?)|(?:GBP|USD|EUR)\s?(?:m|bn|'?000))+$/i;
// A note reference printed in a Notes column: "4", "12", "3.2", "5a".
const NOTE_REF = /^\d{1,2}(?:\.\d{1,2})?[a-z]?$/;
const TRAILING_NOTE = /\s+(\d{1,2}(?:\.\d{1,2})?[a-z]?(?:\s*[,&]\s*\d{1,2}(?:\.\d{1,2})?[a-z]?)*)$/;
// "2024/25" is the year that ends in 2025.
const joinSplitYears = line =>
  String(line).replace(/\b((?:19|20)\d{2})\s*[/-]\s*(\d{2})\b(?!\d)/g, (_, first, end) => `${first.slice(0, 2)}${end}`);

const linesOf = text => String(text ?? '').split('\n');
const topLines = (text, count = 6) => linesOf(text).slice(0, count).join('\n');

/** Parses a printed cell: "(1,234)" is negative, "—" is zero. */
export function parseCell(cell) {
  const raw = String(cell).replace(/\s/g, '');
  if (DASH_CELL.test(raw)) return 0;
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith('-');
  const value = Number(raw.replace(/[()$£€,pc-]/g, ''));
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

const isValueCell = cell => {
  const raw = String(cell).replace(/\s/g, '');
  // "31," is the end of a date and "$10,162)" the end of a wrapped label, not printed figures.
  if (raw.endsWith(',') || (raw.match(/\(/g) ?? []).length !== (raw.match(/\)/g) ?? []).length) return false;
  // Thousands come in groups of three ("2,161,735.8"); "6, 22, 34" is a list of note references.
  if (raw.includes(',') && !/^\(?-?[$£€]?\d{1,3}(,\d{3})+(\.\d+)?[pc]?\)?[pc]?$/.test(raw)) return false;
  return NUMBER_CELL.test(raw) || DASH_CELL.test(raw);
};
const isCurrency = cell => /^[$£€]$/.test(cell);

/** Splits a line into its label and printed value cells. */
export function splitRow(line) {
  let cells = line
    // Dot leaders ("Net sales . . . . .   237,710") are a column gap.
    .replace(/(?:\s*\.){3,}\s*/g, '   ')
    // A currency sign standing alone is a column marker, however tightly it is set ("64,699 $ 72,732 $   71,074").
    .replace(/(^|\s)[$£€](?=\s|$)/g, '   ')
    .split(/\s{3,}/)
    .map(cell => cell.trim())
    .filter(cell => cell && !isCurrency(cell))
    // Figures set one space apart ("$14,294.3 $13,835.0 $14,805.9") are separate columns.
    .flatMap(cell => {
      const tokens = cell.split(/\s+/);
      return tokens.length > 1 && tokens.every(isValueCell) ? tokens : [cell];
    });
  // Narrow layouts lose the column gaps; fall back to taking numeric tokens from the right.
  if (cells.length === 1) {
    const tokens = cells[0].split(/\s+/);
    const values = [];
    while (tokens.length > 1 && (isValueCell(tokens.at(-1)) || isCurrency(tokens.at(-1)))) {
      const token = tokens.pop();
      if (!isCurrency(token)) values.unshift(token);
    }
    cells = [tokens.join(' '), ...values];
  }
  const values = [];
  while (cells.length > 1 && isValueCell(cells.at(-1))) values.unshift(cells.pop());
  // A line of figures alone, its label wrapped onto the line above; a lone number (a page number) is not one.
  if (cells.length === 1 && values.length && isValueCell(cells[0])) values.unshift(cells.pop());
  const label = cells
    .join(' ')
    .replace(/\s*[$£€]\s*$/, '')
    .trim();
  return { label, cells: values };
}

/**
 * Years in a column header line such as "2024   2023   2022", "Notes   2025 £m   2024 £m",
 * "52 weeks ended 30 March 2025" or "2024/25   2023/24", or null when the line holds other figures.
 */
export function headerYears(line) {
  const text = joinSplitYears(line);
  const years = text.match(YEAR);
  if (!years) return null;
  const rest = text.replace(UNIT_TOKEN, ' ').replace(DATE_NOISE, ' ').replace(YEAR, ' ');
  if (/\d/.test(rest)) return null;
  const leftover = rest.replace(/[^a-z]/gi, '');
  // Allow words like "Fiscal", "December", "Years ended", "Notes", "restated" around the years, but not prose.
  if (leftover.length > 60) return null;
  if (years.length === 1 && leftover.length > 30) return null;
  return years;
}

function scorePage(text, statement) {
  const lines = linesOf(text);
  const numericRows = lines.filter(line => splitRow(line).cells.length >= 2).length;
  const top = topLines(text);
  const headingTop = statement.heading.test(top);
  const headingAnywhere = statement.heading.test(text);
  const indicators = statement.indicators.filter(pattern => pattern.test(text)).length;
  const otherHeadings = STATEMENTS.filter(other => other !== statement && other.heading.test(text)).length;
  // Many 10-Ks print a "Table of Contents" back-link on every page, so a real index also has few figures.
  const looksLikeIndex =
    numericRows < 8 &&
    (/index to (the )?(consolidated )?financial statements|table of contents/i.test(text) || otherHeadings >= 2);
  const parentOnly = PARENT_ONLY.test(top) && !GROUP.test(top);
  // The statement's own title on a line of its own ("Consolidated statements of income"), not a mention of it.
  const titled = linesOf(top).some(line =>
    new RegExp(`^\\s*((the )?(consolidated|group) )?(${statement.heading.source})\\s*(\\(.*\\))?\\s*$`, 'i').test(line)
  );
  // Five-year summaries and highlights repeat the headline lines, unaudited.
  const summary = /\b(unaudited|summary|highlights|selected (financial|income))\b/i.test(top);
  return (
    (headingTop ? 6 : headingAnywhere ? 2 : 0) +
    (titled ? 3 : 0) -
    (summary ? 5 : 0) +
    indicators +
    Math.min(numericRows / 5, 4) +
    (headingTop && GROUP.test(top) ? 1 : 0) -
    (looksLikeIndex ? 12 : 0) -
    (parentOnly ? 8 : 0)
  );
}

/** Finds each primary statement's page (and its continuation page when the statement runs over). */
export function selectStatementPages(pageTexts) {
  const pages = Object.entries(pageTexts ?? {}).map(([page, text]) => ({
    page: Number(page),
    text: String(text ?? '')
  }));
  const byPage = new Map(pages.map(item => [item.page, item]));
  const selected = new Map();
  const missing = [];

  for (const statement of STATEMENTS) {
    const ranked = pages
      .map(item => ({ ...item, score: scorePage(item.text, statement) }))
      .filter(item => item.score >= 3)
      .sort((left, right) => right.score - left.score || left.page - right.page);
    const best = ranked[0];
    if (!best) {
      missing.push(statement.key);
      continue;
    }
    const chosen = [best];
    const next = byPage.get(best.page + 1);
    const othersTop = item => STATEMENTS.some(other => other !== statement && other.heading.test(topLines(item.text)));
    // A statement that starts at the foot of its page ("… STATEMENTS OF PROFIT OR LOSS" below the balance
    // sheet's last lines) runs onto the next page.
    const startsLow = !statement.heading.test(topLines(best.text));
    if (
      next &&
      !othersTop(next) &&
      ((!statement.closing.test(best.text) && statement.closing.test(next.text)) || startsLow)
    )
      chosen.push(next);
    // A page headed as the statement can be its second half: the page before ends "(Continued)" or prints
    // the statement's title part-way down.
    for (let page = best.page - 1, steps = 0; steps < 2; page -= 1, steps += 1) {
      const prev = byPage.get(page);
      if (!prev || othersTop(prev) || chosen.some(item => item.page === page)) break;
      const continued = /\(continued\)/i.test(prev.text.split('\n').slice(-4).join(' '));
      // The title on a line of its own below the page's top, not a mention in an index or the auditor's report.
      const titled =
        !statement.heading.test(topLines(prev.text)) &&
        linesOf(prev.text).some(line =>
          new RegExp(`^\\s*((the )?(consolidated|group) )?(${statement.heading.source})[a-z ]*\\s*$`, 'i').test(line)
        );
      // Printed filings can repeat the title on every page of a long statement, so keep stepping back.
      if (!continued && !titled) break;
      chosen.unshift(prev);
    }
    for (const item of chosen) {
      const existing = selected.get(item.page);
      selected.set(item.page, {
        page: item.page,
        text: item.text.slice(0, 16000),
        statement: existing ? `${existing.statement}, ${statement.key}` : statement.key
      });
    }
  }

  if (missing.length) {
    throw new Error(
      `Could not identify all three financial statements in selectable PDF text (missing ${missing.join(', ')}). Scanned PDFs need OCR before extraction.`
    );
  }
  return [...selected.values()].sort((left, right) => left.page - right.page);
}

/**
 * Splits statement pages into numbered rows. Each row keeps its page, the section heading above it,
 * its verbatim quote, and its values aligned to the page's year columns where the counts match.
 * A note reference printed before the figures is kept as `note`; `offset` counts it so column indexes
 * still match every printed cell on the line.
 */
// A line of currency markers over the figure columns: "NT$   NT$   US$", "£m   £m", "RMB   RMB   US$".
const CURRENCY_HEADER =
  /^\s*(?:(?:NT|US|HK|A|C|S)?\$|£|€|¥|RMB|R\$)m?(?:\s{2,}(?:(?:NT|US|HK|A|C|S)?\$|£|€|¥|RMB|R\$)m?)+\s*$/;

// A capitals row continues the capitals line above it when it is one word, or the line above ends mid-phrase.
const wrapsCaps = (heading, label) =>
  Boolean(label) &&
  label === label.toUpperCase() &&
  /[A-Z]/.test(label) &&
  (!/\s/.test(label) || /\b(AND|OF|ON|FOR|THE|TO|IN|FROM|AT|BY|WITH|CASH|NET)$/.test(heading));

export function statementRows(pages, startId = 1) {
  const rows = [];
  let id = startId;
  // A continuation page can print a row before its header, so it starts with the previous page's years.
  let lastPeriods = null;
  // Foreign filers add a convenience translation column ("NT$   NT$   US$"); it is not another year.
  // Scanned up front: the marker line can sit on a later page than the first rows.
  const markers = line => (CURRENCY_HEADER.test(line) ? line.trim().split(/\s+/) : null);
  let convenience = pages.some(({ text }) =>
    linesOf(text).some(line => {
      const found = markers(line);
      return Boolean(found && found.length > 1 && found.at(-1) !== found[0]);
    })
  );
  const headers = [];
  for (const { page, text } of pages) {
    let periods = lastPeriods;
    let notes = false;
    let section = '';
    let carry = '';
    let carryQuote = '';
    // The last line read as a capitals heading, in case it was the first half of a wrapped capitals label.
    let caps = null;
    for (const line of linesOf(text)) {
      if (!line.trim()) continue;
      const lastCaps = caps;
      caps = null;
      const currencies = markers(line);
      if (currencies) {
        convenience = currencies.length > 1 && currencies.at(-1) !== currencies[0];
        continue;
      }
      // A header holds years and words ("Years ended", "2024   2023", "Notes 2025 £m") but no other figures.
      const years = headerYears(line);
      if (years) {
        // The page's own first header replaces years carried from the page before.
        if (!periods || periods === lastPeriods || years.length >= periods.length) periods = years;
        headers.push(years);
        if (/\bnotes?\b/i.test(line)) notes = true;
        continue;
      }
      if (CAPTION_LINE.test(line.trim())) {
        if (/\bnotes?\b/i.test(line)) notes = true;
        continue;
      }
      if (/\|\s*\d+\s*$|form 10-k\s*\||form (10-k|20-f)\s+\d{1,3}\s*$/i.test(line)) continue; // running page footer
      const split = splitRow(line);
      let { label, cells } = split;
      if (convenience && periods && cells.length > periods.length) cells = cells.slice(0, -1);
      let note = '';
      let offset = 0;
      if (periods && cells.length === periods.length + 1 && NOTE_REF.test(cells[0].replace(/\s/g, ''))) {
        note = cells[0];
        offset = 1;
        cells = cells.slice(1);
      } else if (notes && cells.length) {
        // References that are not plain numbers ("4, 5", "12a") stay at the end of the label.
        const ref = TRAILING_NOTE.exec(label);
        if (ref) {
          note = ref[1];
          label = label.slice(0, ref.index).trim();
        }
      }
      // A lone figure set tight against the label of a multi-year statement is part of a wrapped label
      // ("shares authorized 24,000; outstanding 7,432" then "and 7,464   93,718   86,939").
      if (periods?.length > 1 && cells.length === 1 && !/\s{3,}/.test(line.trim())) {
        carry = line.trim();
        carryQuote = line;
        continue;
      }
      if (!cells.length) {
        // A label without values is either a section heading or the first half of a wrapped label.
        if (/[a-z]/i.test(line)) {
          if (/:\s*$/.test(line) || line === line.toUpperCase()) {
            if (!/:\s*$/.test(line)) caps = { line, section };
            section = line.replace(/:\s*$/, '').trim().slice(0, 60);
            carry = '';
            carryQuote = '';
          } else {
            carry = line.trim();
            carryQuote = line;
          }
        }
        continue;
      }
      let fullLabel = label;
      let quote = line;
      if (!carry && lastCaps && wrapsCaps(lastCaps.line.trim(), label)) {
        // "EFFECT OF EXCHANGE RATE CHANGES ON CASH AND CASH" then "EQUIVALENTS . . .   (15)".
        fullLabel = `${lastCaps.line.trim()} ${label}`;
        quote = `${lastCaps.line}\n${line}`;
        section = lastCaps.section;
      } else if (
        carry &&
        // A line ending mid-phrase ("… Restricted Cash and") continues whatever case comes next; a comma does
        // not, since headers end in one ("Years ended December 31,").
        (!label || !/^[A-Z]/.test(label) || /\b(and|of|or|to|for|in|on|the|from|with|by|at)\s*$/i.test(carry))
      ) {
        // Anything but a capital continues the label above: "and", "(", "$10,162)".
        fullLabel = `${carry} ${label}`.trim();
        quote = `${carryQuote}\n${line}`;
      } else if (carry) {
        // UK statements print section headings without a colon ("Current liabilities"): a valueless line
        // followed by a new capitalised row was a heading, not the first half of a wrapped label.
        section = carry.slice(0, 60);
      }
      carry = '';
      carryQuote = '';
      if (!/[a-z]/i.test(fullLabel)) continue;
      const values = cells.map(parseCell);
      rows.push({
        id: id++,
        page,
        section,
        label: fullLabel.slice(0, 160),
        printed: cells,
        values,
        periods: periods && periods.length === values.length ? periods : null,
        quote,
        ...(note ? { note } : {}),
        ...(offset ? { offset } : {})
      });
    }
    lastPeriods = periods;
  }
  // Rows printed above their page's year header take the statement's year columns when the count fits.
  const sets = [...new Map(headers.filter(Boolean).map(set => [set.join(), set])).values()];
  for (const row of rows) {
    if (row.periods) continue;
    const fits = sets.filter(set => set.length === row.values.length);
    if (fits.length === 1) row.periods = fits[0];
  }
  return rows;
}

/** Reported unit and its scale, read from the statement headers ("in millions", "£m", "£'000", "$bn"). */
const NAMED_CURRENCIES = [
  [/new taiwan dollars/, 'TWD'],
  [/(japanese )?yen/, 'JPY'],
  [/renminbi/, 'CNY'],
  [/hong kong dollars/, 'HKD'],
  [/canadian dollars/, 'CAD'],
  [/australian dollars/, 'AUD'],
  [/(indian )?rupees/, 'INR'],
  [/(korean )?won/, 'KRW'],
  [/swiss francs/, 'CHF'],
  [/euros?/, 'EUR'],
  [/(pounds )?sterling|pounds/, 'GBP'],
  [/(u\.?s\.? )?dollars/, 'USD']
];

export function detectUnit(text) {
  const t = String(text ?? '');
  const scale = /in (billions)|\(\s*billions\b|[£$€]\s?bn\b|(?:GBP|USD|EUR)\s?bn\b|[£$€]\s?billions?\b/i.test(t)
    ? ['billions', 1e9]
    : /in (millions)|\(\s*millions\b|[£$€]\s?m\b|(?:GBP|USD|EUR)\s?m\b|[£$€]\s?millions?\b|millions of (pounds|dollars|euros)/i.test(
          t
        )
      ? ['millions', 1e6]
      : /in (thousands)|\(\s*thousands\b|[£$€]\s?'?000\b|(?:GBP|USD|EUR)\s?'?000\b|[£$€]\s?thousands?\b|thousands of (pounds|dollars|euros)/i.test(
            t
          )
        ? ['thousands', 1e3]
        : ['units', 1];
  // The currency printed most often on the statement pages wins, so a stray symbol in a footnote does not.
  const count = pattern => (t.match(pattern) ?? []).length;
  const tally = [
    ['GBP', count(/£|\bGBP\b|sterling|pence/gi)],
    ['EUR', count(/€|\bEUR\b|\beuros?\b/gi)],
    ['USD', count(/\$|\bUSD\b/gi)]
  ].sort((a, b) => b[1] - a[1]);
  // A header that names the currency ("in millions of New Taiwan Dollars") settles it before any count.
  const named = NAMED_CURRENCIES.find(([pattern]) =>
    new RegExp(`(millions|thousands|billions|amounts?|expressed) (of|in) ${pattern.source}`, 'i').test(t)
  );
  const currency = named ? named[1] : tally[0][1] > 0 ? tally[0][0] : 'USD';
  return { label: `${currency} ${scale[0]}`, currency, scale: scale[1] };
}

const COMPANY_SUFFIX =
  /\b(plc|p\.l\.c\.|limited|ltd|inc\.?|incorporated|corporation|corp\.?|holdings|group|n\.v\.|s\.a\.|ag|se|llc)\s*$/i;
const FULL_NAME =
  /\b[A-Z][A-Za-z&'-]+(?: [A-Z][A-Za-z&'-]+){0,3},? (?:Corporation|Incorporated|Inc\.|plc|PLC|Limited|N\.V\.|S\.A\.|SE|AG)(?![A-Za-z])/g;
const YEAR_END =
  /(?:fiscal\s+)?(?:year|period|5[23]\s*weeks?)\s+ended\s+(\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|[A-Z][a-z]+\s*\d{1,2}\s*,\s*\d{4})/i;

/**
 * Company name and fiscal year end. A 10-K names the registrant on its cover; a UK annual report puts the
 * name ("Halden Group plc") and the period ("for the year ended 31 March 2025") on its first pages or in
 * the statement headers (`extraPages`).
 */
export function detectCover(pageTexts, extraPages = []) {
  const first = linesOf(pageTexts?.[1] ?? '');
  // Annual reports often wrap the 10-K, so its cover page can sit a few pages in.
  let company = '';
  for (let page = 1; page <= 20 && !company; page += 1) {
    const lines = linesOf(pageTexts?.[page] ?? '');
    const exact = lines.findIndex(line => /exact name of (the )?registrant/i.test(line));
    if (exact > 0) company = lines[exact - 1].trim();
    // A 20-F names the registrant in its own script, then gives the English translation a few lines on.
    const english = lines.findIndex(line => /translation of registrant/i.test(line));
    if (company && !/[a-z]/i.test(company) && english > 0) company = lines[english - 1].split(/\s{3,}/)[0].trim();
  }
  if (!company || company.length > 80) company = '';
  let yearEnd =
    /fiscal year ended\s+([A-Z][a-z]+\s*\d{1,2}\s*,\s*\d{4})/i.exec(first.join(' '))?.[1]?.replace(/\s*,\s*/, ', ') ??
    '';
  const opening = [1, 2, 3].map(page => pageTexts?.[page] ?? '');
  if (!company) {
    const lines = opening.flatMap(linesOf).map(line => line.trim());
    company =
      lines.find(
        line =>
          line.length <= 60 &&
          /^[A-Z0-9]/.test(line) &&
          COMPANY_SUFFIX.test(line) &&
          !/annual report|accounts|contents|form 10-k/i.test(line)
      ) ?? '';
  }
  if (!company) {
    // Reports without a 10-K cover still name the company in full throughout ("Microsoft Corporation").
    const counts = new Map();
    for (const text of Object.values(pageTexts ?? {}))
      for (const [name] of String(text).matchAll(FULL_NAME)) counts.set(name, (counts.get(name) ?? 0) + 1);
    const [best] = [...counts].sort((a, b) => b[1] - a[1]);
    if (best?.[1] >= 3) company = best[0];
  }
  if (!yearEnd) {
    for (const text of [...opening, ...extraPages.map(page => page?.text ?? page)]) {
      const found = YEAR_END.exec(String(text ?? '').replace(/\s+/g, ' '));
      if (found) {
        yearEnd = found[1].replace(/\s*,\s*/, ', ');
        break;
      }
    }
  }
  // Registrants set in capitals ("COCA COLA CO") read as names in a memo ("Coca Cola Co").
  if (company && !/[a-z]/.test(company) && /[A-Z]{2}/.test(company))
    company = company.replace(/[A-Z][A-Z'’.-]*/g, word =>
      /^(AG|SE|SA|NV|N\.V\.|S\.A\.|LLC|LP|USA|UK|US)$/.test(word)
        ? word
        : word === 'PLC'
          ? 'plc'
          : word[0] + word.slice(1).toLowerCase()
    );
  // "SEPTEMBER 3, 2023" reads as "September 3, 2023".
  yearEnd = yearEnd.replace(/[A-Z]{3,}/g, word => word[0] + word.slice(1).toLowerCase());
  return { company, yearEnd };
}

/** Headings of the business and risk sections in a 10-K (Item 1, Item 1A) and in a UK annual report. */
export const BUSINESS_HEADINGS = [
  [/^item\s*1\s*[.:—–-]?\s*business\b/i, 'Item 1 (Business)'],
  [/^(our )?business model\b/i, 'Business model'],
  [/^(business|strategic) (overview|review)\b/i, 'Business overview'],
  [/^strategic report\b/i, 'Strategic report'],
  [/^(chief executive|ceo|chair|chairman)('|’)?s? (review|statement)\b/i, "Chief executive's review"],
  // Annual reports that reprint the 10-K without item numbers head it "BUSINESS".
  [/^business$/i, 'Business']
];
export const RISK_HEADINGS = [
  [/^item\s*1a\s*[.:—–-]?\s*risk\s*factors\b/i, 'Item 1A (Risk Factors)'],
  [/^principal risks( and uncertainties)?\b/i, 'Principal risks and uncertainties'],
  [/^risk factors\b/i, 'Risk factors']
];

/** Text of a narrative section (Item 1 or Item 1A), skipping the table of contents. */
export function sectionText(pageTexts, heading, maxChars) {
  const pages = Object.entries(pageTexts ?? {})
    .map(([page, text]) => ({ page: Number(page), text: String(text ?? '') }))
    .sort((a, b) => a.page - b.page);
  for (const [index, item] of pages.entries()) {
    const lines = linesOf(item.text);
    const itemLines = lines.filter(line => /^\s*item\s*\d+[a-z]?\b/i.test(line)).length;
    if (itemLines >= 4) continue; // a table of contents
    // A contents page lists headings with page numbers ("Strategic report   2").
    const numbered = lines.filter(line => /\S.*\s\d{1,3}$/.test(line.trim()) && line.trim().length < 80).length;
    if (/^\s*contents\s*$/im.test(topLines(item.text, 4)) || numbered >= 8) continue;
    const at = lines.findIndex(line => {
      const trimmed = line.trim();
      return trimmed.length <= 80 && heading.test(trimmed) && !/\s\d{1,3}$/.test(trimmed);
    });
    if (at < 0) continue;
    let text = lines.slice(at).join('\n');
    const used = [item.page];
    for (const next of pages.slice(index + 1)) {
      if (text.length >= maxChars) break;
      text += `\n${next.text}`;
      used.push(next.page);
    }
    return { text: text.slice(0, maxChars), pages: used };
  }
  return { text: '', pages: [] };
}

/** The first section found for a list of [heading, name], with its name. */
export function findSection(pageTexts, headings, maxChars) {
  for (const [heading, name] of headings) {
    const found = sectionText(pageTexts, heading, maxChars);
    if (found.text) return { ...found, name };
  }
  return { text: '', pages: [], name: '' };
}

// Printed titles of the lines the model cannot do without, for pointing out an empty choice.
const REQUIRED_TITLES = {
  income: [
    ['revenue', /^(total )?(net )?(revenues?|sales|turnover)$/i],
    ['net_income', /^net (income|earnings|profit)( for the (year|period))?$/i]
  ],
  balance: [
    ['total_assets', /^total assets$/i],
    ['current_assets', /^total current assets$/i],
    ['current_liabilities', /^total current liabilities$/i],
    ['total_equity', /^total (stockholders['’]? |shareholders['’]? )?equity$/i],
    ['cash_and_equivalents', /^cash and cash equivalents$/i]
  ],
  cashflow: [
    ['operating_cash_flow', /^net cash (provided by|generated (by|from)|from|used in) operating activities$/i],
    ['depreciation_amortization', /^depreciation and amorti[sz]ation$/i]
  ]
};

/**
 * Problems code can see in a model's row mapping: a row whose printed label does not fit its line item, and
 * reported totals that fail to tie. They go back to the model for one more attempt; nothing here trusts it.
 */
export function mappingProblems(statement, rows, mapping, unit) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const problems = [];
  for (const [key, ids] of Object.entries(mapping ?? {})) {
    const spec = STATEMENT_KEYS[statement]?.[key];
    for (const id of ids ?? []) {
      const row = byId.get(id);
      if (row && spec?.[2] && !spec[2].test(`${row.section ?? ''} ${row.label}`))
        problems.push(`${key}: row ${id} "${row.label}" does not read as ${spec[0].toLowerCase()}.`);
      if (row && !row.periods)
        problems.push(
          `${key}: row ${id} "${row.label}" has ${row.values.length} values that do not line up with the year columns; it is probably from another table. Choose the row in the ${STATEMENT_NAMES[statement]} itself.`
        );
    }
  }
  // A line the model needs, left empty although a row reads exactly like it.
  for (const [key, title] of REQUIRED_TITLES[statement] ?? []) {
    if (mapping?.[key]?.length) continue;
    const row = rows.find(r => r.periods && title.test(r.label.trim()));
    if (row) problems.push(`${key}: nothing was chosen, but row ${row.id} "${row.label}" looks like it.`);
  }
  const { facts } = resolveFacts(statement, rows, mapping, unit);
  const sum = (key, period) => {
    const parts = new Map(
      facts
        .filter(f => f.key === key && f.period === period)
        // Costs are printed either way round; cash flows keep their sign, outflows in brackets.
        .map(f => [f.part ?? 0, statement === 'cashflow' ? f.value : Math.abs(f.value)])
    );
    return parts.size ? [...parts.values()].reduce((a, b) => a + b, 0) : null;
  };
  const ties = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 1e-3);
  const periods = [...new Set(facts.map(f => f.period))];
  const identities =
    statement === 'income'
      ? [
          [['revenue', '-cost_of_revenue'], 'gross_profit'],
          [['gross_profit', '-operating_expenses'], 'operating_income', ['-exceptional_items']]
        ]
      : statement === 'balance'
        ? [[['total_assets'], 'total_liabilities_and_equity']]
        : [
            [['cash_beginning', 'cash_change'], 'cash_ending'],
            [['operating_cash_flow', 'investing_cash_flow', 'financing_cash_flow'], 'cash_change', ['fx_effect']]
          ];
  for (const [terms, total, optional = []] of identities) {
    const keyOf = term => term.replace(/^-/, '');
    const value = (list, period) =>
      list.reduce((acc, term) => acc + (term.startsWith('-') ? -1 : 1) * (sum(keyOf(term), period) ?? 0), 0);
    for (const period of periods) {
      const target = sum(total, period);
      if (target == null || terms.some(term => sum(keyOf(term), period) == null)) continue;
      if (ties(value(terms, period), target) || ties(value([...terms, ...optional], period), target)) continue;
      problems.push(
        `${terms.map(keyOf).join(' and ')} do not reconcile to ${total} for ${period}. Check those rows, and leave ${total === 'gross_profit' ? 'gross_profit' : 'a key'} empty if the statement does not print it.`
      );
      break;
    }
  }
  return problems;
}

/** Turns a cleaned row mapping into facts, one per row and period, plus issues for rows that could not be aligned. */
export function resolveFacts(statement, rows, mapping, unit) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const facts = [];
  const issues = [];
  for (const [key, ids] of Object.entries(mapping ?? {})) {
    const spec = STATEMENT_KEYS[statement][key];
    if (!spec) continue;
    // A total picked alongside its own parts would count them twice; the printed total wins.
    const totals = spec[3] && ids.length > 1 ? ids.filter(id => /^total\b/i.test(byId.get(id)?.label ?? '')) : [];
    // Of several rows for one line item, those whose heading and label contradict it are left out, as long
    // as one that fits remains ("Other (income)/deductions" is not an operating expense).
    const fits = id => !spec[2] || spec[2].test(`${byId.get(id)?.section ?? ''} ${byId.get(id)?.label ?? ''}`);
    const fitting = !totals.length && ids.length > 1 ? ids.filter(fits) : [];
    const picked = totals.length ? totals.slice(0, 1) : fitting.length ? fitting : ids;
    for (const [index, id] of picked.entries()) {
      const row = byId.get(id);
      if (!row) continue;
      if (!row.periods) {
        issues.push({
          statement,
          key,
          page: row.page,
          detail: `"${row.label}" on PDF page ${row.page} has ${row.values.length} values that could not be matched to the year columns.`
        });
        continue;
      }
      const offset = row.offset ?? 0;
      row.periods.forEach((period, column) => {
        facts.push({
          statement,
          key,
          part: spec[3] ? index : 0,
          label: row.label,
          section: row.section,
          name: spec[0],
          period,
          value: row.values[column],
          printed: row.printed[column],
          column: column + offset,
          columns: row.printed.length + offset,
          unit: unit.label,
          page: row.page,
          quote: row.quote,
          rowId: row.id
        });
      });
    }
  }
  return { facts, issues };
}
