import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { compsSummary, median, multiples, toTargetUnit } from './comps.js';
import { runPipeline } from './pipeline.js';
import { UK_PAGE_TEXTS, fakeUkLlm } from './fixtures/uk-annual-report.js';
import { findSoffice, recalcWorkbook } from '../../server/recalc.js';

// Fictional peers in GBP millions; the last has no market cap, so it gives no multiples.
const PEERS = [
  { name: 'Peer A', marketCap: 1500, netDebt: 200, revenue: 900, ebitda: 210, netIncome: 110 },
  { name: 'Peer B', marketCap: 2400, netDebt: -100, revenue: 1500, ebitda: 300, netIncome: 160 },
  { name: 'Peer C', marketCap: 900, netDebt: 50, revenue: 700, ebitda: 95, netIncome: -10 },
  { name: 'Peer D', marketCap: null, netDebt: 10, revenue: 400, ebitda: 60, netIncome: 30 }
];

test('multiples and medians follow the workbook rules', () => {
  assert.deepEqual(multiples(PEERS[3]), { ev: null, evRevenue: null, evEbitda: null, pe: null });
  assert.equal(median([3, null, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([null]), null);
  const converted = toTargetUnit(
    { marketCap: 2e9, netDebt: -1e8, revenue: 1e9, sources: 'x' },
    { currency: 'GBP', scale: 1e6 },
    0.8
  );
  assert.equal(converted.marketCap, 1600);
  assert.equal(converted.netDebt, -80);
  assert.match(converted.sources, /converted to GBP at 0.8000/);
});

test('peers value the target at the median EV / EBITDA', async () => {
  const { model } = await runPipeline({
    pageTexts: UK_PAGE_TEXTS,
    fileName: 'halden.pdf',
    llm: fakeUkLlm(),
    overrides: { sharePrice: 3, daPct: [0.05, 0.05, 0.05, 0.05, 0.05] }
  });
  const cs = compsSummary(PEERS, model);
  const evEbitda = [1700 / 210, 2300 / 300, 950 / 95].sort((a, b) => a - b)[1];
  assert.ok(Math.abs(cs.medians.evEbitda - evEbitda) < 1e-12);
  assert.ok(Math.abs(cs.medians.pe - [1500 / 110, 2400 / 160, 900 / -10].sort((a, b) => a - b)[1]) < 1e-12);
  // UK fixture prints no D&A on the cash flow, so EBITDA (and the comps value) needs it.
  assert.equal(model.base.ebitda, null);
  assert.equal(cs.impliedEv, null);
});

test('the engine values a corrected target from peers, and LibreOffice agrees', { skip: !findSoffice() }, async () => {
  const recalc = async (base64, cells) => recalcWorkbook(Buffer.from(base64, 'base64'), cells);
  // Give the fixture a D&A line so EBITDA exists.
  const pages = {
    ...UK_PAGE_TEXTS,
    7: UK_PAGE_TEXTS[7].replace('Income tax paid', 'Depreciation and amortisation   45.0   42.0\nIncome tax paid')
  };
  const llm = fakeUkLlm({ recalc });
  const base = llm.mapRows;
  llm.mapRows = async (statement, rows) => {
    const out = await base(statement, rows);
    if (statement === 'cashflow') {
      const da = rows.find(r => r.label === 'Depreciation and amortisation');
      out.mapping.depreciation_amortization = da ? [da.id] : [];
    }
    return out;
  };
  const { model, assay } = await runPipeline({
    pageTexts: pages,
    fileName: 'halden.pdf',
    llm,
    overrides: { sharePrice: 3 },
    peers: PEERS
  });
  const cs = compsSummary(PEERS, model);
  assert.ok(Number.isFinite(cs.impliedPerShare));
  const workbook = assay.checks.filter(c => c.group === 'workbook');
  assert.ok(
    workbook.some(c => /Implied value per share from peers/.test(c.detail) && c.passed),
    'implied value checked'
  );
  assert.deepEqual(
    workbook.filter(c => !c.passed).map(c => c.detail),
    []
  );
});
