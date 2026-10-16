import assert from 'node:assert/strict';
import test from 'node:test';
import { assay, withRecalc } from './assayer.js';
import { detectUnit, resolveFacts, selectStatementPages, statementRows } from './filing.js';
import { PAGE_TEXTS, fakeLlm } from './fixtures/annual-report.js';

async function extract() {
  const pages = selectStatementPages(PAGE_TEXTS);
  const unit = detectUnit(PAGE_TEXTS[3]);
  const llm = fakeLlm();
  const facts = [];
  let id = 1;
  for (const statement of ['income', 'balance', 'cashflow']) {
    const rows = statementRows(
      pages.filter(p => p.statement === statement),
      id
    );
    id += rows.length;
    const { mapping } = await llm.mapRows(statement, rows);
    facts.push(...resolveFacts(statement, rows, mapping, unit).facts);
  }
  return { facts, unit };
}

test('passes every check on a consistent filing', async () => {
  const { facts, unit } = await extract();
  const result = assay({ facts, pageTexts: PAGE_TEXTS, unit });
  assert.deepEqual(
    result.checks.filter(c => !c.passed).map(c => c.detail),
    []
  );
  assert.ok(result.passed > 80);
});

test('flags a figure that does not match its page, and the identities it breaks', async () => {
  const { facts, unit } = await extract();
  const tampered = facts.map(f => (f.key === 'total_equity' && f.period === '2025' ? { ...f, value: 740 } : f));
  const result = assay({ facts: tampered, pageTexts: PAGE_TEXTS, unit });
  const flags = result.checks.filter(c => !c.passed).map(c => c.title);
  assert.ok(flags.includes('Figure matches the filing'));
  assert.ok(flags.includes('Balance sheet balances'));
});

test('flags a row whose label does not fit the line item a model chose', async () => {
  const { facts, unit } = await extract();
  const wrong = facts.map(f => (f.key === 'total_liabilities_and_equity' ? { ...f, label: 'Total assets' } : f));
  const result = assay({ facts: wrong, pageTexts: PAGE_TEXTS, unit });
  assert.ok(result.checks.some(c => c.group === 'label' && !c.passed));
});

test('adds workbook recalculation results, or a flag when it could not run', () => {
  const base = { checks: [], passed: 0, flagged: 0, total: 0 };
  const cells = [{ ref: "'DCF'!C35", expected: 100, what: 'Enterprise value' }];
  assert.equal(withRecalc(base, { values: { "'DCF'!C35": 100.000001 } }, cells).passed, 1);
  assert.equal(withRecalc(base, { values: { "'DCF'!C35": 101 } }, cells).flagged, 1);
  assert.equal(withRecalc(base, { error: 'Not run' }, cells).flagged, 1);
});

test('compares figures with the company’s structured filing, and refuses a currency mismatch', async () => {
  const { facts, unit } = await extract();
  const reference = {
    source: 'SEC EDGAR XBRL company facts',
    short: 'XBRL filing',
    currency: 'USD',
    annual: {
      'income:revenue': { 2025: 1250e6, 2024: 1100e6 },
      'income:net_income': { 2025: 175e6, 2024: 136e6 },
      'balance:total_assets': { 2025: 1400.4e6 }
    }
  };
  const result = assay({ facts, pageTexts: PAGE_TEXTS, unit, reference });
  const refs = result.checks.filter(c => c.group === 'reference');
  assert.equal(refs.length, 5);
  assert.deepEqual(
    refs.filter(c => !c.passed).map(c => c.detail),
    [
      'Net income FY2024: the PDF gives 135 (USD millions), SEC EDGAR XBRL company facts gives 136. Check the row and the period.'
    ]
  );
  const euro = assay({ facts, pageTexts: PAGE_TEXTS, unit, reference: { ...reference, currency: 'EUR' } });
  assert.match(euro.checks.find(c => c.group === 'reference').detail, /reports in EUR/);
});
