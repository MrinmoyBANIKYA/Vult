import * as React from 'react';
import { CornerDownLeft, FileText } from 'lucide-react';
import { Badge, HoverCard, HoverCardTrigger, HoverCardContent } from '../components/ui.jsx';
import { Av, Hallmark } from '../components/shared.jsx';
import { compsData, calc, getEvidence, SCEN, fp, fpS, fx, sharePx } from '../lib/engine.js';
import { cn } from '../lib/utils.js';
import { useA } from '../lib/context.js';

function Cite({ n }) {
  const { d, m, openEv } = useA();
  const M = d.memo;
  const key = M.cites[n - 1],
    E = getEvidence(d, key, m);
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            openEv(key);
          }}
          aria-label={'Source ' + n}
          className="relative top-[-0.45em] mx-0.5 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-[4px] bg-[hsl(224_76%_48%/.1)] px-1 align-baseline font-sans text-[10.5px] font-semibold leading-none text-[hsl(224_76%_45%)] hover:bg-[hsl(224_76%_48%/.2)]"
        >
          {n}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-[300px]">
        <div className="flex items-start gap-2.5">
          <FileText size={15} className="mt-0.5 text-fg3" />
          <div className="min-w-0">
            <b className="block text-[13px] font-semibold">{E.doc.who}</b>
            <span className="text-xs text-fg3">
              {E.doc.t}, {typeof E.pg.p === 'number' ? 'page ' + E.pg.p : E.pg.p}
            </span>
          </div>
        </div>
        <div className="mt-2.5 rounded-md bg-gold/10 px-2.5 py-2 text-[12.5px]">
          <span className="text-fg2">{E.l}</span> <b className="font-semibold">{E.v}</b>
        </div>
        <div className="mt-2 text-xs text-gold">Select to open the page</div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function MemoView() {
  const { d, m, sugg, setSugg, memoExtra } = useA();
  const [hl, setHl] = React.useState(null);
  const M = d.memo,
    X = React.useMemo(() => compsData(d, m, 'all', true), [d, m]),
    o = X.o,
    L = d.periods.length - 1;
  const down = calc(d, 'downside', m.wacc, m.tgr).vps;
  const bind = (text, cite, tail) => {
    const t = String(text),
      k = t.lastIndexOf(' '),
      m0 = /^[.,;:]/.exec(tail || ''),
      p = m0 ? m0[0] : '',
      rest = (tail || '').slice(p.length);
    return (
      <>
        {t.slice(0, k + 1)}
        <span className="whitespace-nowrap">
          {t.slice(k + 1)}
          {cite}
          {p}
        </span>
        {rest}
      </>
    );
  };
  const fill = s =>
    s
      .replace('{m0}', fp(o.m[d.nAct - 1]))
      .replace('{mN}', fp(o.m[L]))
      .replace('{tev}', fx(X.tgt.eve))
      .replace('{pmed}', fx(X.med.eve))
      .replace('{down}', sharePx(d, down));
  const item = ([txt, n, tail, anc], i, withSugg) => {
    const s =
      withSugg && sugg !== 'rejected' ? (
        sugg === 'pending' ? (
          <>
            <span className="rounded-xs bg-[hsl(153_72%_28%/.12)] px-0.5 text-[hsl(153_72%_24%)]">{fill(M.sugg)}</span>
            <span className="ml-1.5 inline-flex -translate-y-px gap-1 align-middle font-sans">
              <button
                onClick={e => {
                  e.stopPropagation();
                  setSugg('accepted');
                }}
                className="h-5 rounded-[5px] bg-[hsl(153_72%_28%)] px-2 text-[11px] font-semibold text-white"
              >
                Accept
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setSugg('rejected');
                }}
                className="h-5 rounded-[5px] border border-pagefg/15 bg-white px-2 text-[11px] font-semibold text-pagefg"
              >
                Reject
              </button>
            </span>
          </>
        ) : (
          fill(M.sugg)
        )
      ) : null;
    const inner = n ? (
      <>
        {bind(fill(txt), <Cite n={n} />, tail)}
        {s}
      </>
    ) : (
      <>
        {fill(txt)}
        {tail}
        {s}
      </>
    );
    return (
      <li key={i}>
        {anc ? (
          <span
            onClick={() => setHl(anc)}
            className={cn(
              'cursor-pointer rounded-xs shadow-[inset_0_-1.5px_0_hsl(36_80%_45%/.55)] transition-colors hover:bg-[hsl(36_80%_55%/.16)]',
              hl === anc && 'bg-[hsl(36_80%_55%/.2)]'
            )}
          >
            {inner}
          </span>
        ) : (
          inner
        )}
      </li>
    );
  };
  const rec =
    o.up > 0.1
      ? 'Proceed to phase 2 confirmatory diligence.'
      : o.up > 0
        ? 'Proceed with caution; the upside is thin at this price.'
        : 'Do not proceed at the current price.';
  const secs = ['Recommendation', 'Investment thesis', 'Valuation', 'Key risks', 'Phase 2 plan'];
  return (
    <div className="grid grid-cols-[160px_minmax(0,1fr)_300px] items-start gap-6 max-[1360px]:grid-cols-[minmax(0,1fr)_290px] max-lg:grid-cols-1 in-[.dock]:grid-cols-1">
      <nav
        aria-label="Memo outline-solid"
        className="sticky top-16 flex flex-col gap-0.5 text-[12.5px] max-[1360px]:hidden in-[.dock]:hidden"
      >
        <span className="px-2 pb-1.5 text-xs font-medium text-fg3">Outline</span>
        {secs.map((s, i) => (
          <a
            key={s}
            href={'#ms' + i}
            onClick={e => {
              e.preventDefault();
              const el = document.getElementById('ms' + i);
              el && el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="rounded-md px-2 py-1.5 text-fg2 hover:bg-fg/5 hover:text-fg"
          >
            {s}
          </a>
        ))}
      </nav>
      <article className="on-paper min-w-0 rounded-ctl bg-page px-[clamp(20px,4.5vw,60px)] py-[clamp(22px,4vw,52px)] font-serif text-[16px] leading-[1.7] text-pagefg shadow-[0_0_0_1px_hsl(var(--pagefg)/.08),0_30px_70px_-40px_hsl(var(--shadow)/.7)]">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-pagefg/10 pb-5 font-sans">
          <div>
            <div className="text-[12px] font-semibold text-[hsl(4_62%_44%)]">Strictly private and confidential</div>
            <h1 className="mt-1.5 font-serif text-[28px] font-semibold leading-tight tracking-[-.015em]">
              {d.project}: investment committee pre-read
            </h1>
          </div>
          <Hallmark d={d} />
        </div>
        <dl className="mb-6 grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-1 font-sans text-[12.5px] text-pagefg/70">
          <dt className="text-pagefg/50">To</dt>
          <dd>{M.to}</dd>
          <dt className="text-pagefg/50">From</dt>
          <dd>Vult, reviewed by {d.reviewer}</dd>
          <dt className="text-pagefg/50">Date</dt>
          <dd>10 October 2026, version {sugg === 'accepted' || memoExtra ? 4 : 3}</dd>
          <dt className="text-pagefg/50">Target</dt>
          <dd>
            {d.target} ({d.ticker})
          </dd>
        </dl>
        <h2 id="ms0" className="mb-2 mt-7 scroll-mt-16 font-sans text-[13px] font-semibold">
          Recommendation
        </h2>
        <p className="rounded-[10px] bg-[hsl(214_90%_50%/.08)] px-4 py-3.5 font-sans text-[14px] leading-relaxed shadow-[inset_3px_0_0_hsl(214_85%_45%)]">
          <b className="font-semibold">{rec}</b> Indicative value {sharePx(d, o.vps)} per share (DCF,{' '}
          {SCEN[m.scen].l.toLowerCase()} case), {fpS(o.up)} against today's {sharePx(d, d.price)}.
        </p>
        <h2 id="ms1" className="mb-2 mt-7 scroll-mt-16 font-sans text-[13px] font-semibold">
          1. Investment thesis
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5">{M.thesis.map((x, i) => item(x, i))}</ol>
        <h2 id="ms2" className="mb-2 mt-7 scroll-mt-16 font-sans text-[13px] font-semibold">
          2. Valuation
        </h2>
        <p>
          The DCF gives {sharePx(d, o.vps)} per share at a {fp(m.wacc)} WACC and {fp(m.tgr)} terminal growth. Trading
          comps imply {sharePx(d, X.comp25)} to {sharePx(d, X.comp75)} on peer EV / EBITDA, and the growth-adjusted
          regression {bind(`about ${sharePx(d, X.impVps)}`, <Cite n={3} />, '.')} The downside case gives{' '}
          {sharePx(d, down)}.
        </p>
        {memoExtra && (
          <p className="mt-3">
            <span className="rounded-xs bg-[hsl(153_72%_28%/.12)] px-0.5 text-[hsl(153_72%_24%)]">
              The discount to peers ({fx(X.tgt.eve)} against {fx(X.med.eve)}) reflects size and liquidity,{' '}
              {d.key === 'uk'
                ? 'customer concentration and the loss-making US arm'
                : 'rate sensitivity and down-market competition'}
              . At the peer median the shares would be worth about {sharePx(d, X.medVps)}.
            </span>
          </p>
        )}
        <h2 id="ms3" className="mb-2 mt-7 scroll-mt-16 font-sans text-[13px] font-semibold">
          3. Key risks
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5">{M.risks.map((x, i) => item(x, i, i === 0))}</ol>
        <h2 id="ms4" className="mb-2 mt-7 scroll-mt-16 font-sans text-[13px] font-semibold">
          4. Phase 2 diligence plan
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {M.plan.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ol>
      </article>
      <aside aria-label="Comments" className="sticky top-16 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <b className="text-[13px] font-semibold">Comments</b>
          <span className="text-xs text-fg3">{d.comments.length} open</span>
        </div>
        {d.comments.map(cm => (
          <div
            key={cm.id}
            role="button"
            tabIndex={0}
            onClick={() => setHl(cm.id)}
            onKeyDown={e => {
              if (e.key === 'Enter') setHl(cm.id);
            }}
            className={cn(
              'flex cursor-pointer flex-col gap-2.5 card p-3 transition-colors',
              hl === cm.id ? 'border-warn' : 'border-line hover:border-line2'
            )}
          >
            <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5">
              <Av n={cm.who} ring={false} />
              <div>
                <b className="text-[12.5px] font-semibold">{cm.who}</b>
                <span className="ml-1.5 text-xs text-fg3">
                  {cm.role}, {cm.ago} ago
                </span>
                <p className="mt-0.5 text-[13px] text-fg2">{cm.text}</p>
              </div>
            </div>
            <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5 border-t border-line pt-2.5">
              <Av bot size={22} n="Vult" />
              <div>
                <b className="text-[12.5px] font-semibold">Vult</b>
                <span className="ml-1.5 text-xs text-fg3">replied</span>
                <p className="mt-0.5 text-[13px] text-fg2">{fill(cm.reply)}</p>
                {cm.id === 'c1' && sugg !== 'pending' && (
                  <Badge tone={sugg === 'accepted' ? 'pos' : 'neutral'} className="mt-1.5">
                    {sugg === 'accepted' ? 'Suggestion accepted, memo version 4' : 'Suggestion rejected'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))}
        <label className="flex h-9 items-center gap-2 rounded-ctl border border-line2 bg-inset px-3 text-fg3 focus-within:border-info">
          <input
            aria-label="Comment"
            placeholder="Reply, or ask Vult to change the memo"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-hidden placeholder:text-fg3"
          />
          <CornerDownLeft size={14} />
        </label>
      </aside>
    </div>
  );
}
