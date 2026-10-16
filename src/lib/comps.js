/**
 * Trading comparables. The twin of the Comps sheet in workbook.js: every multiple, median and implied value
 * here matches a formula there, and the engine recalculates the workbook to confirm it.
 *
 * Peers arrive in the target's reported unit (for example GBP millions): see toTargetUnit.
 */

export const MAX_PEERS = 8;

const div = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? a / b : null);

/** Median of the finite values, or null; the same rule as MEDIAN over cells that may be blank. */
export function median(values) {
  const list = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
}

const mean = values => {
  const list = values.filter(Number.isFinite);
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
};

/** Enterprise value and multiples for one company, as the workbook computes them. */
export function multiples({ marketCap, netDebt, revenue, ebitda, netIncome }) {
  const ev = marketCap > 0 ? marketCap + (Number.isFinite(netDebt) ? netDebt : 0) : null;
  return {
    ev,
    evRevenue: div(ev, revenue),
    evEbitda: div(ev, ebitda),
    pe: marketCap > 0 ? div(marketCap, netIncome) : null
  };
}

/** Peer multiples, their medians and means, and the value implied for the target by the median EV / EBITDA. */
export function compsSummary(peers, model) {
  const rows = (peers ?? []).slice(0, MAX_PEERS).map(peer => ({ ...peer, ...multiples(peer) }));
  const stat = fn => ({
    evRevenue: fn(rows.map(r => r.evRevenue)),
    evEbitda: fn(rows.map(r => r.evEbitda)),
    pe: fn(rows.map(r => r.pe))
  });
  const medians = stat(median);
  const d = model.dcf;
  const impliedEv =
    Number.isFinite(medians.evEbitda) && Number.isFinite(model.base.ebitda)
      ? medians.evEbitda * model.base.ebitda
      : null;
  const impliedEquity = impliedEv != null ? impliedEv - d.debt + d.cash : null;
  const a = model.assumptions;
  const impliedPerShare =
    impliedEquity != null && d.perShare != null && a.shareScale && model.base.shares > 0
      ? (impliedEquity * a.unitScale) / (model.base.shares * a.shareScale)
      : null;
  return { rows, medians, means: stat(mean), impliedEv, impliedEquity, impliedPerShare };
}

/**
 * Converts a peer from units of its own currency into the target's reported unit. `rate` is how many target
 * currency units one peer currency unit buys.
 */
export function toTargetUnit(peer, unit, rate = 1) {
  const convert = value => (Number.isFinite(value) ? (value * rate) / unit.scale : null);
  return {
    name: peer.name,
    ticker: peer.ticker,
    marketCap: convert(peer.marketCap),
    netDebt: convert(peer.netDebt),
    revenue: convert(peer.revenue),
    ebitda: convert(peer.ebitda),
    netIncome: convert(peer.netIncome),
    fiscalYear: peer.fiscalYear,
    sources: rate === 1 ? peer.sources : `${peer.sources}; converted to ${unit.currency} at ${rate.toFixed(4)}`
  };
}
