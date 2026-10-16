import * as React from 'react';
import { AlertTriangle, Check, Download, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/ui.jsx';
import { cn } from '../lib/utils.js';
import { engine } from '../lib/engine-client.js';
import { MAX_PEERS, compsSummary, toTargetUnit } from '../lib/comps.js';
import { money, pct, perShareText } from '../lib/memo.js';

const field =
  'h-8 rounded-lg border border-line2 bg-raised px-2.5 text-[13px] outline-hidden focus:border-gold/70 uppercase placeholder:normal-case';
const multiple = v => (Number.isFinite(v) ? `${v.toFixed(1)}x` : '–');
const settle = async promise => {
  try {
    return { value: await promise };
  } catch (error) {
    return { error: error.message };
  }
};

/** The reference data the Assayer compares the PDF with, trimmed to the facts' periods. */
function referenceFrom(f, periods) {
  if (!f) return null;
  const keep = new Set(periods);
  const annual = Object.fromEntries(
    Object.entries(f.annual ?? {}).map(([key, byYear]) => [
      key,
      Object.fromEntries(Object.entries(byYear).filter(([year]) => keep.has(year)))
    ])
  );
  return {
    source: f.source,
    short: /SEC/.test(f.source) ? 'SEC XBRL filing' : 'ESEF filing',
    currency: f.currency,
    url: f.url,
    name: f.name,
    annual
  };
}

/**
 * Market data for the target and its peers, all from free public sources fetched by the engine. Every value
 * shows where it came from; nothing is applied until the analyst says so.
 */
export function MarketPanel({ result, ticker: savedTicker, peers, busy, onApplyMarket, onApplyPeers }) {
  const { model, extraction } = result;
  const unit = model.unit;
  const [ticker, setTicker] = React.useState(savedTicker ?? '');
  const [market, setMarket] = React.useState(null);
  const [fetching, setFetching] = React.useState('');
  const [peerInput, setPeerInput] = React.useState('');
  const [fetched, setFetched] = React.useState([]);
  const periods = [...new Set(extraction.facts.map(f => f.period))];

  const fetchMarket = async () => {
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) return;
    setFetching('market');
    const country = /\.L$/.test(symbol) ? 'UK' : 'US';
    const [quote, beta, riskFree, fundamentals] = await Promise.all([
      settle(engine.quote(symbol)),
      settle(engine.beta(symbol)),
      settle(engine.riskFree(country)),
      settle(engine.fundamentals(symbol))
    ]);
    setMarket({ symbol, quote, beta, riskFree, fundamentals });
    setFetching('');
  };

  const applyMarket = () => {
    const q = market.quote.value;
    const b = market.beta.value;
    const r = market.riskFree.value;
    const values = {};
    const basis = {};
    if (q && q.currency === unit.currency) {
      values.sharePrice = q.price;
      basis.sharePrice = `${q.symbol} ${q.currency} ${q.price}, ${q.asOf}, ${q.source}`;
    }
    if (b) {
      values.beta = Math.round(b.adjusted * 100) / 100;
      basis.beta = `${b.symbol} against the ${b.indexName}, ${b.weeks} weeks: raw ${b.raw.toFixed(2)}, adjusted ${b.adjusted.toFixed(2)}. ${b.source}`;
    }
    if (r) {
      values.riskFree = Math.round(r.rate * 10000) / 10000;
      basis.riskFree = `${r.series}, ${r.asOf}, ${r.source}`;
    }
    onApplyMarket({
      ticker: market.symbol,
      values,
      basis,
      reference: referenceFrom(market.fundamentals.value, periods)
    });
  };

  const fetchPeers = async () => {
    const symbols = peerInput
      .split(/[\s,;]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, MAX_PEERS);
    if (!symbols.length) return;
    setFetching('peers');
    const rows = await Promise.all(
      symbols.map(async symbol => {
        const got = await settle(engine.peer(symbol));
        if (got.error) return { symbol, error: got.error };
        const rate = await settle(engine.fx(got.value.currency, unit.currency));
        if (rate.error) return { symbol, error: `No ${got.value.currency} to ${unit.currency} rate: ${rate.error}` };
        return { symbol, peer: toTargetUnit(got.value, unit, rate.value.rate), raw: got.value };
      })
    );
    setFetched(rows);
    setFetching('');
  };

  const cs = model.kind === 'financial' ? null : compsSummary(peers ?? [], model);
  const mismatch = market?.quote.value && market.quote.value.currency !== unit.currency;

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[13px] font-semibold">Market data</div>
        <p className="mt-1 text-[12px] leading-relaxed text-fg3">
          Price and beta from Yahoo Finance (free, unofficial), the risk-free rate from the Bank of England or the CBOE
          10-year index, and the company’s own SEC or ESEF filing to cross-check the PDF. Use a licensed feed for client
          work.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={ticker}
            onChange={event => setTicker(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && fetchMarket()}
            placeholder="Ticker, e.g. AAPL or VOD.L"
            aria-label="Ticker"
            className={cn(field, 'w-52')}
          />
          <Button size="sm" onClick={fetchMarket} disabled={!ticker.trim() || Boolean(fetching) || busy}>
            {fetching === 'market' ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />}
            Fetch
          </Button>
        </div>
        {market && (
          <div className="mt-3 rounded-xl border border-line p-3 text-[12.5px] leading-relaxed">
            <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[150px_1fr]">
              <dt className="text-fg3">Share price</dt>
              <dd>
                {market.quote.value ? (
                  <>
                    {market.quote.value.currency} {market.quote.value.price}, {market.quote.value.asOf}
                    {mismatch && (
                      <span className="block text-warn">
                        Quoted in {market.quote.value.currency}; the statements are in {unit.currency}, so the price is
                        not applied.
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-neg">{market.quote.error}</span>
                )}
              </dd>
              <dt className="text-fg3">Beta</dt>
              <dd>
                {market.beta.value ? (
                  `${market.beta.value.adjusted.toFixed(2)} adjusted (raw ${market.beta.value.raw.toFixed(2)}, ${market.beta.value.weeks} weeks against the ${market.beta.value.indexName})`
                ) : (
                  <span className="text-neg">{market.beta.error}</span>
                )}
              </dd>
              <dt className="text-fg3">Risk-free rate</dt>
              <dd>
                {market.riskFree.value ? (
                  `${pct(market.riskFree.value.rate, 2)}, ${market.riskFree.value.series}, ${market.riskFree.value.asOf}`
                ) : (
                  <span className="text-neg">{market.riskFree.error}</span>
                )}
              </dd>
              <dt className="text-fg3">Cross-check</dt>
              <dd>
                {market.fundamentals.value ? (
                  `${market.fundamentals.value.name}, ${market.fundamentals.value.source}`
                ) : (
                  <span className="text-neg">{market.fundamentals.error}</span>
                )}
              </dd>
            </dl>
            <Button variant="primary" size="sm" className="mt-3" onClick={applyMarket} disabled={busy}>
              {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
              Use these and recalculate
            </Button>
          </div>
        )}
      </div>

      {cs && (
        <div>
          <div className="text-[13px] font-semibold">Peers</div>
          <p className="mt-1 text-[12px] leading-relaxed text-fg3">
            US peers from their SEC filings, UK and European peers from their ESEF filings, each priced today and
            converted into {unit.label}. Up to {MAX_PEERS}.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={peerInput}
              onChange={event => setPeerInput(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && fetchPeers()}
              placeholder="Tickers, e.g. MSFT, GOOGL or BT-A.L"
              aria-label="Peer tickers"
              className={cn(field, 'w-72')}
            />
            <Button size="sm" onClick={fetchPeers} disabled={!peerInput.trim() || Boolean(fetching) || busy}>
              {fetching === 'peers' ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
              Fetch peers
            </Button>
          </div>
          {fetched.length > 0 && (
            <div className="mt-3 rounded-xl border border-line p-3">
              <ul className="space-y-1.5 text-[12.5px]">
                {fetched.map(row => (
                  <li key={row.symbol} className="leading-relaxed">
                    {row.error ? (
                      <span className="flex items-start gap-1.5 text-neg">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {row.symbol}: {row.error}
                      </span>
                    ) : (
                      <>
                        <span className="font-medium text-fg">{row.peer.name}</span>{' '}
                        <span className="text-fg2">
                          market cap {money(row.peer.marketCap, unit)}, revenue {money(row.peer.revenue, unit)}
                        </span>
                        <span className="block text-[11.5px] text-fg3">{row.peer.sources}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <Button
                variant="primary"
                size="sm"
                className="mt-3"
                disabled={busy || !fetched.some(r => r.peer)}
                onClick={() =>
                  onApplyPeers([...(peers ?? []), ...fetched.filter(r => r.peer).map(r => r.peer)].slice(0, MAX_PEERS))
                }
              >
                <Check size={14} /> Add to comps and recalculate
              </Button>
            </div>
          )}
          {peers?.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-150 text-[12.5px] tabular-nums">
                <thead className="text-[12px] text-fg3">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2 text-left font-medium">Peer ({unit.label})</th>
                    <th className="px-3 py-2 text-right font-medium">Market cap</th>
                    <th className="px-3 py-2 text-right font-medium">EV / revenue</th>
                    <th className="px-3 py-2 text-right font-medium">EV / EBITDA</th>
                    <th className="px-3 py-2 text-right font-medium">P / E</th>
                    <th className="px-3 py-2">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cs.rows.map((row, i) => (
                    <tr key={`${row.ticker ?? row.name}-${i}`} className="border-b border-line/60">
                      <td className="max-w-60 truncate px-3 py-2" title={row.sources}>
                        {row.name}
                      </td>
                      <td className="px-3 py-2 text-right">{money(row.marketCap, unit)}</td>
                      <td className="px-3 py-2 text-right">{multiple(row.evRevenue)}</td>
                      <td className="px-3 py-2 text-right">{multiple(row.evEbitda)}</td>
                      <td className="px-3 py-2 text-right">{multiple(row.pe)}</td>
                      <td className="px-2 py-1 text-right">
                        <Button
                          size="iconsm"
                          variant="ghost"
                          aria-label={`Remove ${row.name}`}
                          disabled={busy}
                          onClick={() => onApplyPeers(peers.filter((_, k) => k !== i))}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="px-3 py-2">Median</td>
                    <td />
                    <td className="px-3 py-2 text-right">{multiple(cs.medians.evRevenue)}</td>
                    <td className="px-3 py-2 text-right">{multiple(cs.medians.evEbitda)}</td>
                    <td className="px-3 py-2 text-right">{multiple(cs.medians.pe)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
              <p className="border-t border-line px-3 py-2 text-[12.5px] text-fg2">
                {cs.impliedPerShare != null
                  ? `Median EV / EBITDA implies ${perShareText(cs.impliedPerShare, unit)} a share (${money(cs.impliedEv, unit)} enterprise value).`
                  : cs.impliedEv != null
                    ? `Median EV / EBITDA implies ${money(cs.impliedEv, unit)} enterprise value.`
                    : 'No implied value: the target needs EBITDA (D&A included) and peers need EV / EBITDA.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
