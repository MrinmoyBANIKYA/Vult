// A fictional UK bank's annual report. The balance sheet has no current/non-current split and the income
// statement leads with interest income, so it must be valued on equity rather than with a corporate DCF.

export const BANK_PAGE_TEXTS = {
  1: ['Halden Bank plc', 'Annual Report and Accounts 2025'].join('\n'),
  2: [
    'Consolidated income statement',
    'For the year ended 31 December 2025',
    'Notes   2025   2024',
    '£m   £m',
    'Interest income   1,200.0   1,050.0',
    'Interest expense   (500.0)   (420.0)',
    'Net interest income   3   700.0   630.0',
    'Fee and commission income   200.0   180.0',
    'Total operating income   900.0   810.0',
    'Operating expenses   (450.0)   (420.0)',
    'Expected credit losses   (50.0)   (60.0)',
    'Profit before tax   400.0   330.0',
    'Taxation   (100.0)   (82.5)',
    'Profit for the year   300.0   247.5',
    'Earnings per share',
    'Diluted   15.0p   12.4p',
    'Weighted average diluted shares (millions)   2,000   2,000'
  ].join('\n'),
  3: [
    'Consolidated balance sheet',
    'At 31 December 2025',
    'Notes   2025   2024',
    '£m   £m',
    'Assets',
    'Cash and balances at central banks   3,000.0   2,500.0',
    'Loans and advances to customers   12   20,000.0   18,500.0',
    'Investment securities   4,000.0   3,800.0',
    'Other assets   1,000.0   1,200.0',
    'Total assets   28,000.0   26,000.0',
    'Liabilities',
    'Deposits from customers   22,000.0   20,600.0',
    'Debt securities in issue   2,500.0   2,400.0',
    'Other liabilities   800.0   750.0',
    'Total liabilities   25,300.0   23,750.0',
    'Equity',
    'Share capital   200.0   200.0',
    'Retained earnings   2,500.0   2,050.0',
    'Total equity   2,700.0   2,250.0'
  ].join('\n'),
  4: [
    'Consolidated cash flow statement',
    'For the year ended 31 December 2025',
    '2025   2024',
    '£m   £m',
    'Net cash from operating activities   900.0   700.0',
    'Net cash used in investing activities   (300.0)   (250.0)',
    'Net cash used in financing activities   (100.0)   (80.0)',
    'Net increase in cash and cash equivalents   500.0   370.0',
    'Cash and cash equivalents at 1 January   2,500.0   2,130.0',
    'Cash and cash equivalents at 31 December   3,000.0   2,500.0'
  ].join('\n')
};

const BANK_LABELS = {
  income: {
    revenue: 'Total operating income',
    pretax_income: 'Profit before tax',
    income_tax: 'Taxation',
    net_income: 'Profit for the year',
    eps_diluted: 'Diluted',
    shares_diluted: 'Weighted average diluted shares (millions)'
  },
  balance: {
    cash_and_equivalents: 'Cash and balances at central banks',
    total_assets: 'Total assets',
    total_liabilities: 'Total liabilities',
    total_equity: 'Total equity'
  },
  cashflow: {
    operating_cash_flow: 'Net cash from operating activities',
    investing_cash_flow: 'Net cash used in investing activities',
    financing_cash_flow: 'Net cash used in financing activities',
    cash_change: 'Net increase in cash and cash equivalents',
    cash_beginning: 'Cash and cash equivalents at 1 January',
    cash_ending: 'Cash and cash equivalents at 31 December'
  }
};

/** A stand-in for the engine on the bank fixture: classifies rows by exact label. */
export function fakeBankLlm({ recalc } = {}) {
  return {
    async mapRows(statement, rows) {
      const mapping = {};
      for (const [key, label] of Object.entries(BANK_LABELS[statement])) {
        const row = rows.find(r => r.label === label);
        mapping[key] = row ? [row.id] : [];
      }
      return { mapping, provider: 'test', label: 'Test model', model: 'fixture', local: true };
    },
    async narrative() {
      return { business: '', risks: [], label: 'Test model', model: 'fixture', local: true };
    },
    recalc:
      recalc ??
      (async () => {
        throw Object.assign(new Error('LibreOffice is not installed on the engine machine'), { status: 501 });
      })
  };
}
