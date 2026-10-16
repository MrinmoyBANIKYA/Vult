// A fictional UK annual report in IFRS layout: a Notes column, £m headers, liabilities in brackets, EPS in
// pence, section headings without colons, a contents page and a parent company balance sheet that must not
// be taken for the group's. Figures are internally consistent.

export const UK_PAGE_TEXTS = {
  1: ['Halden Group plc', 'Annual Report and Accounts 2025'].join('\n'),
  2: [
    'Contents',
    'Strategic report   3',
    'Principal risks and uncertainties   4',
    'Consolidated income statement   5',
    'Consolidated balance sheet   6',
    'Consolidated cash flow statement   7',
    'Company balance sheet   8'
  ].join('\n'),
  3: [
    'Strategic report',
    'Our business model',
    'Halden Group designs and sells precision measurement instruments to industrial customers in the UK and Europe.',
    'It earns revenue from instrument sales and from multi-year calibration contracts.'
  ].join('\n'),
  4: [
    'Principal risks and uncertainties',
    'Demand for instruments depends on industrial capital spending.',
    'The group relies on a small number of component suppliers.'
  ].join('\n'),
  5: [
    'Consolidated income statement',
    'For the year ended 31 March 2025',
    'Notes   2025   2024',
    '£m   £m',
    'Revenue   3   820.0   760.0',
    'Cost of sales   (480.0)   (450.0)',
    'Gross profit   340.0   310.0',
    'Administrative expenses   (200.0)   (190.0)',
    'Operating profit   4   140.0   120.0',
    'Finance costs   6   (20.0)   (22.0)',
    'Profit before tax   120.0   98.0',
    'Taxation   7   (30.0)   (24.5)',
    'Profit for the year   90.0   73.5',
    'Earnings per share',
    'Diluted   8   25.0p   20.4p',
    'Weighted average diluted shares (millions)   360   360'
  ].join('\n'),
  6: [
    'Consolidated balance sheet',
    'At 31 March 2025',
    'Notes   2025   2024',
    '£m   £m',
    'Non-current assets',
    'Property, plant and equipment   9   300.0   280.0',
    'Intangible assets   10   150.0   150.0',
    'Right-of-use assets   50.0   55.0',
    'Total non-current assets   500.0   485.0',
    'Current assets',
    'Inventories   90.0   85.0',
    'Trade and other receivables   110.0   100.0',
    'Cash and cash equivalents   14   100.0   60.0',
    'Total current assets   300.0   245.0',
    'Total assets   800.0   730.0',
    'Current liabilities',
    'Trade and other payables   (120.0)   (110.0)',
    'Borrowings   15   (20.0)   (20.0)',
    'Lease liabilities   (10.0)   (10.0)',
    'Total current liabilities   (150.0)   (140.0)',
    'Non-current liabilities',
    'Borrowings   15   (150.0)   (170.0)',
    'Lease liabilities   (45.0)   (50.0)',
    'Deferred tax   (25.0)   (24.0)',
    'Total non-current liabilities   (220.0)   (244.0)',
    'Total liabilities   (370.0)   (384.0)',
    'Net assets   430.0   346.0',
    'Equity',
    'Share capital   36.0   36.0',
    'Retained earnings   394.0   310.0',
    'Total equity   430.0   346.0'
  ].join('\n'),
  7: [
    'Consolidated cash flow statement',
    'For the year ended 31 March 2025',
    'Notes   2025   2024',
    '£m   £m',
    'Cash flows from operating activities',
    'Cash generated from operations   20   190.0   170.0',
    'Income tax paid   (28.0)   (25.0)',
    'Net cash from operating activities   162.0   145.0',
    'Cash flows from investing activities',
    'Purchase of property, plant and equipment   (60.0)   (55.0)',
    'Net cash used in investing activities   (60.0)   (55.0)',
    'Cash flows from financing activities',
    'Repayment of borrowings   (20.0)   (20.0)',
    'Principal elements of lease payments   (10.0)   (9.0)',
    'Interest paid   (20.0)   (22.0)',
    'Dividends paid   (12.0)   (10.0)',
    'Net cash used in financing activities   (62.0)   (61.0)',
    'Net increase in cash and cash equivalents   40.0   29.0',
    'Cash and cash equivalents at 1 April   60.0   31.0',
    'Cash and cash equivalents at 31 March   100.0   60.0'
  ].join('\n'),
  8: [
    'Company balance sheet',
    'At 31 March 2025',
    'Notes   2025   2024',
    '£m   £m',
    'Non-current assets',
    'Investments in subsidiaries   25   400.0   400.0',
    'Total non-current assets   400.0   400.0',
    'Current assets',
    'Amounts owed by group undertakings   20.0   15.0',
    'Total current assets   20.0   15.0',
    'Total assets   420.0   415.0',
    'Current liabilities',
    'Amounts owed to group undertakings   (10.0)   (10.0)',
    'Total current liabilities   (10.0)   (10.0)',
    'Total liabilities   (10.0)   (10.0)',
    'Net assets   410.0   405.0',
    'Total equity   410.0   405.0'
  ].join('\n')
};

/** Which printed label (and section) each key should map to, used by the fake model in tests. */
const UK_LABELS = {
  income: {
    revenue: 'Revenue',
    cost_of_revenue: 'Cost of sales',
    gross_profit: 'Gross profit',
    operating_expenses: 'Administrative expenses',
    operating_income: 'Operating profit',
    interest_expense: 'Finance costs',
    pretax_income: 'Profit before tax',
    income_tax: 'Taxation',
    net_income: 'Profit for the year',
    eps_diluted: ['Diluted', 'Earnings per share'],
    shares_diluted: 'Weighted average diluted shares (millions)'
  },
  balance: {
    cash_and_equivalents: 'Cash and cash equivalents',
    current_assets: 'Total current assets',
    ppe_net: 'Property, plant and equipment',
    noncurrent_assets: 'Total non-current assets',
    total_assets: 'Total assets',
    debt_current: ['Borrowings', 'Current liabilities'],
    current_liabilities: 'Total current liabilities',
    debt_noncurrent: ['Borrowings', 'Non-current liabilities'],
    lease_liabilities: [
      ['Lease liabilities', 'Current liabilities'],
      ['Lease liabilities', 'Non-current liabilities']
    ],
    noncurrent_liabilities: 'Total non-current liabilities',
    total_liabilities: 'Total liabilities',
    net_assets: 'Net assets',
    total_equity: 'Total equity'
  },
  cashflow: {
    operating_cash_flow: 'Net cash from operating activities',
    capital_expenditure: 'Purchase of property, plant and equipment',
    investing_cash_flow: 'Net cash used in investing activities',
    dividends_paid: 'Dividends paid',
    financing_cash_flow: 'Net cash used in financing activities',
    cash_change: 'Net increase in cash and cash equivalents',
    cash_beginning: 'Cash and cash equivalents at 1 April',
    cash_ending: 'Cash and cash equivalents at 31 March'
  }
};

const find = (rows, [label, section]) => rows.find(r => r.label === label && (!section || r.section === section));

/** A stand-in for the engine on the UK fixture: classifies rows by exact label and section. */
export function fakeUkLlm({ recalc } = {}) {
  return {
    async mapRows(statement, rows) {
      const mapping = {};
      for (const [key, wanted] of Object.entries(UK_LABELS[statement])) {
        const specs =
          Array.isArray(wanted) && Array.isArray(wanted[0]) ? wanted : [Array.isArray(wanted) ? wanted : [wanted]];
        mapping[key] = specs.map(spec => find(rows, spec)?.id).filter(Boolean);
      }
      return { mapping, provider: 'test', label: 'Test model', model: 'fixture', local: true };
    },
    async narrative() {
      return {
        business: 'Halden Group sells precision instruments and calibration contracts.',
        risks: ['Demand depends on industrial capital spending.'],
        label: 'Test model',
        model: 'fixture',
        local: true
      };
    },
    recalc:
      recalc ??
      (async () => {
        throw Object.assign(new Error('LibreOffice is not installed on the engine machine'), { status: 501 });
      })
  };
}
