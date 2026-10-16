// The standard line items Vult extracts from a filing, and the prompts that ask a model to find them.
// Shared by the Node engine (server/), the extract-10k edge function and the browser (src/lib).
//
// The model only classifies rows: it says which printed row is "revenue" or "total assets". Every number
// is read from the PDF text by code, so a model cannot invent or mistype a figure.

/** key: [label, description for the model, pattern a sensible printed label matches, multi-row allowed] */
export const STATEMENT_KEYS = {
  income: {
    revenue: ['Revenue', 'Total revenue, turnover or total net sales for the whole company (the top-line total, not a segment). For a bank, total operating income; for an insurer, total revenue or insurance revenue.', /revenue|sales|turnover|total (operating )?income/i],
    cost_of_revenue: ['Cost of revenue', 'Total cost of revenue or cost of sales (the total line).', /cost/i],
    gross_profit: ['Gross profit', 'Gross profit or gross margin, as an amount.', /gross/i],
    operating_expenses: ['Operating expenses', 'Total operating expenses.', /operating expenses|costs and expenses|total expenses|administrative/i],
    exceptional_items: ['Exceptional items', 'Each exceptional, adjusting, special, restructuring or impairment line printed on its own above operating profit. Not totals.', /exceptional|adjusting|special|restructuring|impairment|non-?recurring|acquisition/i, true],
    operating_income: ['Operating income', 'Operating income, income from operations or operating profit (statutory, after any exceptional items).', /operat/i],
    interest_expense: ['Interest expense', 'Interest expense or finance costs, only if printed as its own line.', /interest|finance (costs?|expense)/i],
    pretax_income: ['Pre-tax income', 'Income before income taxes, or profit before tax(ation).', /before|pre-?tax/i],
    income_tax: ['Income tax', 'Provision for (or benefit from) income taxes, taxation or income tax expense.', /tax/i],
    net_income: ['Net income', 'Net income or profit for the year; if both are shown, the amount attributable to the company or to owners of the parent.', /net (income|earnings|loss)|profit|attributable/i],
    net_income_nci: ['Profit to minority interests', 'Profit or net income attributable to non-controlling (minority) interests, if printed.', /non-?controlling|minority/i],
    eps_diluted: ['Diluted EPS', 'Diluted earnings per share (in currency units, pence or cents).', /diluted/i],
    shares_diluted: ['Diluted shares', 'Weighted-average diluted shares used for EPS, if printed on the statement.', /diluted|shares/i]
  },
  balance: {
    cash_and_equivalents: ['Cash and equivalents', 'Cash and cash equivalents (current assets).', /cash/i],
    short_term_investments: ['Short-term investments', 'Current marketable securities or short-term investments.', /securities|investments/i],
    current_assets: ['Total current assets', 'Total current assets.', /current assets/i],
    ppe_net: ['PP&E, net', 'Property, plant and equipment, net.', /property|equipment|pp&e/i],
    noncurrent_assets: ['Total non-current assets', 'Total non-current assets, if printed.', /non-?current assets/i],
    total_assets: ['Total assets', 'Total assets.', /total assets/i],
    debt_current: ['Current debt', 'Each current debt line: short-term borrowings, commercial paper, bank loans and overdrafts, current portion of long-term debt or term debt under current liabilities. Not leases.', /debt|borrowings|commercial paper|notes|loans|overdraft/i, true],
    current_liabilities: ['Total current liabilities', 'Total current liabilities.', /current liabilities/i],
    debt_noncurrent: ['Long-term debt', 'Each non-current debt line: long-term debt, borrowings or term debt under non-current liabilities. Not leases.', /debt|borrowings|notes|loans/i, true],
    lease_liabilities: ['Lease liabilities', 'Each lease liability line, current and non-current (IFRS 16, operating or finance lease liabilities).', /lease/i, true],
    noncurrent_liabilities: ['Total non-current liabilities', 'Total non-current liabilities, if printed.', /non-?current liabilities/i],
    total_liabilities: ['Total liabilities', 'Total liabilities (not including equity).', /total liabilities/i],
    net_assets: ['Net assets', 'Net assets (total assets less total liabilities), if printed.', /net assets/i],
    nci_equity: ['Minority interests', 'Non-controlling (minority) interests within equity, if printed.', /non-?controlling|minority/i],
    total_equity: ['Total equity', "Total equity including non-controlling interests if printed; otherwise total shareholders' equity.", /equity/i],
    total_liabilities_and_equity: ['Total liabilities and equity', "Total liabilities and shareholders' equity, or total equity and liabilities.", /liabilities and|equity and liabilities/i]
  },
  cashflow: {
    net_income: ['Net income', 'Net income or profit for the year at the top of operating activities.', /net (income|earnings|loss)|profit/i],
    depreciation_amortization: ['D&A', 'Depreciation and amortisation (the combined line, or depreciation if that is the only line).', /depreciation|amorti/i],
    share_based_comp: ['Share-based pay', 'Share-based payment or stock-based compensation expense added back.', /share-?based|stock-?based|equity-?settled/i],
    operating_cash_flow: ['Operating cash flow', 'Net cash provided by (used in) operating activities, or net cash from operating activities after tax.', /operating/i],
    capital_expenditure: ['Capital expenditure', 'Purchases of property, plant and equipment (capital expenditure).', /property|equipment|capital expenditure|pp&e|tangible/i],
    investing_cash_flow: ['Investing cash flow', 'Net cash provided by (used in) investing activities.', /investing/i],
    dividends_paid: ['Dividends paid', 'Dividends paid to shareholders of the company.', /dividend/i],
    share_repurchases: ['Share repurchases', 'Repurchases or buybacks of own shares.', /repurchase|buyback|buy-back|treasury|own shares/i],
    financing_cash_flow: ['Financing cash flow', 'Net cash provided by (used in) financing activities.', /financing/i],
    fx_effect: ['FX effect on cash', 'Effect of exchange rate changes on cash, if printed.', /exchange|currency|translation/i],
    cash_change: ['Change in cash', 'Net increase (decrease) in cash and equivalents for the year.', /increase|decrease|change|movement/i],
    cash_beginning: ['Cash at beginning', 'Cash (and equivalents, and restricted cash or overdrafts if combined) at the beginning of the year.', /begin|start|opening|at \d{1,2} [a-z]+|brought forward/i],
    cash_ending: ['Cash at end', 'Cash (and equivalents, and restricted cash or overdrafts if combined) at the end of the year.', /end|closing|at \d{1,2} [a-z]+|carried forward/i]
  }
};

export const STATEMENT_NAMES = { income: 'income statement', balance: 'balance sheet', cashflow: 'cash flow statement' };

/** JSON schema for the row-mapping reply: each key maps to a list of row ids (empty when absent). */
export function mappingSchema(statement) {
  const keys = Object.keys(STATEMENT_KEYS[statement]);
  return {
    type: 'object',
    properties: {
      mapping: {
        type: 'object',
        properties: Object.fromEntries(keys.map(key => [key, { type: 'array', items: { type: 'integer' } }])),
        required: keys
      }
    },
    required: ['mapping']
  };
}

/** Prompt that asks a model to classify numbered statement rows. Rows are { id, section, label, values }. */
export function mappingPrompt(statement, rows) {
  const keys = STATEMENT_KEYS[statement];
  const system = [
    `You classify rows from a company's ${STATEMENT_NAMES[statement]} into standard line items.`,
    'Each row has a numeric id, the section heading it sits under in [brackets], its printed label and its printed values.',
    'For each key, return the id of the row that is that line item, as a one-item list. Return an empty list if no row is that item.',
    'Only keys marked "multiple" may list more than one row. Never guess: a wrong row is worse than an empty list.',
    'Prefer total lines over components. Do not use rows from notes or other statements.',
    'Totals of different things are never interchangeable: total assets is not total liabilities and equity, and cash generated from operations is not net income. If the statement does not print a line, return an empty list for it.',
    'Reply with JSON only: {"mapping": {"key": [ids]}} including every key.',
    '',
    'Keys:',
    ...Object.entries(keys).map(([key, [, description, , multi]]) => `- ${key}: ${description}${multi ? ' (multiple)' : ''}`)
  ].join('\n');
  const user = rows
    .map(row => `${row.id} | ${row.section ? `[${row.section}] ` : ''}${row.label} | ${row.values.join(' | ')}`)
    .join('\n');
  return { system, user: `Rows:\n${user}` };
}

/** Keeps only valid ids for known keys, and at most one row for single-row keys. */
export function cleanMapping(statement, mapping, rowIds) {
  const valid = new Set(rowIds);
  const out = {};
  for (const [key, spec] of Object.entries(STATEMENT_KEYS[statement])) {
    const raw = mapping?.[key];
    const ids = (Array.isArray(raw) ? raw : raw == null ? [] : [raw])
      .map(Number)
      .filter(id => Number.isInteger(id) && valid.has(id));
    out[key] = [...new Set(ids)].slice(0, spec[3] ? 6 : 1);
  }
  return out;
}

/** Prompt for the qualitative memo sections. Figures are deliberately excluded: every number in the memo comes from code. */
export function narrativePrompt({ company, business, risks }) {
  const system = [
    'You write the qualitative sections of an investment memo for a deal team, in British English, plain and specific.',
    'Use only the filing text provided. Do not include any numbers, percentages, amounts or years: figures are added separately from checked data.',
    'Reply with JSON only: {"business": "...", "risks": ["...", "..."]}.',
    'business: 3 to 5 sentences on what the company sells, to whom, and how it makes money.',
    'risks: the 4 to 6 most material risks, one sentence each, specific to this company rather than generic.'
  ].join('\n');
  const user = [
    `Company: ${company || 'unknown'}`,
    '',
    'Business section of the filing:',
    business || '(not found)',
    '',
    'Risk factors section of the filing:',
    risks || '(not found)'
  ].join('\n');
  const schema = {
    type: 'object',
    properties: { business: { type: 'string' }, risks: { type: 'array', items: { type: 'string' } } },
    required: ['business', 'risks']
  };
  return { system, user, schema };
}

/** Removes any sentence that carries a figure, so unchecked numbers never reach the memo. */
export function stripFigures(text) {
  return String(text ?? '')
    .split(/(?<=[.!?])\s+/)
    .filter(sentence => sentence && !/\d/.test(sentence))
    .join(' ')
    .trim();
}
