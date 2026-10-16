// A fictional annual report, laid out the way pdf-text.js rebuilds real statement pages (column gaps are
// three spaces). Figures are internally consistent: the balance sheet balances and cash ties.

export const PAGE_TEXTS = {
  1: [
    'UNITED STATES SECURITIES AND EXCHANGE COMMISSION',
    'FORM 10-K',
    'For the fiscal year ended December 31, 2025',
    'Halden Instruments plc',
    '(Exact name of registrant as specified in its charter)'
  ].join('\n'),
  2: [
    'Item 8. Financial Statements and Supplementary Data',
    'Index to Consolidated Financial Statements   Page',
    'Consolidated Statements of Operations   3',
    'Consolidated Balance Sheets   4',
    'Consolidated Statements of Cash Flows   5'
  ].join('\n'),
  3: [
    'CONSOLIDATED STATEMENTS OF OPERATIONS',
    '(In millions, except per share amounts)',
    'Years ended December 31,',
    '2025   2024   2023',
    'Revenue   $   1,250   $   1,100   $   980',
    'Cost of sales   700   640   590',
    'Gross profit   550   460   390',
    'Total operating expenses   300   260   230',
    'Operating income   250   200   160',
    'Interest expense   (20)   (22)   (25)',
    'Income before income taxes   230   178   135',
    'Provision for income taxes   55   43   32',
    'Net income   $   175   $   135   $   103',
    'Earnings per share:',
    'Diluted   $   1.75   $   1.35   $   1.03',
    'Weighted-average shares outstanding:',
    'Diluted   100   100   100'
  ].join('\n'),
  4: [
    'CONSOLIDATED BALANCE SHEETS',
    '(In millions)',
    'December 31,',
    '2025   2024',
    'Current assets:',
    'Cash and cash equivalents   $   300   $   220',
    'Accounts receivable, net   200   180',
    'Inventories   150   140',
    'Total current assets   650   540',
    'Property, plant and equipment, net   500   480',
    'Goodwill   250   250',
    'Total assets   $   1,400   $   1,270',
    'Current liabilities:',
    'Accounts payable   160   150',
    'Current portion of long-term debt   50   50',
    'Total current liabilities   210   200',
    'Long-term debt   350   400',
    'Other non-current liabilities   90   95',
    'Total liabilities   650   695',
    "Total shareholders' equity   750   575",
    "Total liabilities and shareholders' equity   $   1,400   $   1,270"
  ].join('\n'),
  5: [
    'CONSOLIDATED STATEMENTS OF CASH FLOWS',
    '(In millions)',
    '2025   2024   2023',
    'Operating activities:',
    'Net income   $   175   $   135   $   103',
    'Depreciation and amortization   60   55   50',
    'Changes in operating assets and',
    'liabilities   (25)   (10)   (5)',
    'Net cash provided by operating activities   210   180   148',
    'Investing activities:',
    'Purchases of property and equipment   (80)   (70)   (60)',
    'Net cash used in investing activities   (80)   (70)   (60)',
    'Financing activities:',
    'Repayments of long-term debt   (50)   (40)   (30)',
    'Proceeds from issuance of shares   —   —   —',
    'Net cash used in financing activities   (50)   (40)   (30)',
    'Net increase in cash and cash equivalents   80   70   58',
    'Cash and cash equivalents at beginning of year   220   150   92',
    'Cash and cash equivalents at end of year   $   300   $   220   $   150'
  ].join('\n'),
  6: [
    'Item 1. Business',
    'Halden Instruments designs and sells precision measurement instruments to industrial customers.',
    'It earns revenue from instrument sales and from calibration service contracts.'
  ].join('\n'),
  7: [
    'Item 1A. Risk Factors',
    'Demand for instruments depends on industrial capital spending.',
    'The company relies on a small number of component suppliers.'
  ].join('\n')
};

/** Which printed label each standard key should map to, used by the fake model in tests. */
const LABELS = {
  income: {
    revenue: 'Revenue',
    cost_of_revenue: 'Cost of sales',
    gross_profit: 'Gross profit',
    operating_expenses: 'Total operating expenses',
    operating_income: 'Operating income',
    interest_expense: 'Interest expense',
    pretax_income: 'Income before income taxes',
    income_tax: 'Provision for income taxes',
    net_income: 'Net income',
    eps_diluted: ['Diluted', 'Earnings per share'],
    shares_diluted: ['Diluted', 'Weighted-average shares outstanding']
  },
  balance: {
    cash_and_equivalents: 'Cash and cash equivalents',
    current_assets: 'Total current assets',
    ppe_net: 'Property, plant and equipment, net',
    total_assets: 'Total assets',
    debt_current: 'Current portion of long-term debt',
    current_liabilities: 'Total current liabilities',
    debt_noncurrent: 'Long-term debt',
    total_liabilities: 'Total liabilities',
    total_equity: "Total shareholders' equity",
    total_liabilities_and_equity: "Total liabilities and shareholders' equity"
  },
  cashflow: {
    net_income: 'Net income',
    depreciation_amortization: 'Depreciation and amortization',
    operating_cash_flow: 'Net cash provided by operating activities',
    capital_expenditure: 'Purchases of property and equipment',
    investing_cash_flow: 'Net cash used in investing activities',
    financing_cash_flow: 'Net cash used in financing activities',
    cash_change: 'Net increase in cash and cash equivalents',
    cash_beginning: 'Cash and cash equivalents at beginning of year',
    cash_ending: 'Cash and cash equivalents at end of year'
  }
};

/** A stand-in for the engine: classifies rows by exact label, reads nothing else. */
export function fakeLlm({ recalc } = {}) {
  return {
    async mapRows(statement, rows) {
      const mapping = {};
      for (const [key, wanted] of Object.entries(LABELS[statement])) {
        const [label, section] = Array.isArray(wanted) ? wanted : [wanted];
        const row = rows.find(r => r.label === label && (!section || r.section === section));
        mapping[key] = row ? [row.id] : [];
      }
      return { mapping, provider: 'test', label: 'Test model', model: 'fixture', local: true };
    },
    async narrative() {
      return {
        business:
          'Halden Instruments sells precision instruments. It grew revenue by 13% last year. It also sells calibration services.',
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
