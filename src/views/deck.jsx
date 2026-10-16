import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Badge, Tip } from '../components/ui.jsx';
import { Hallmark, FileIcon } from '../components/shared.jsx';
import { Football, Bubble, AreaTrend } from '../components/charts.jsx';
import { compsData, calc, lbo, SCEN, fp, fpS, fx, sharePx, nf0, rng } from '../lib/engine.js';
import { cn } from '../lib/utils.js';
import { useA } from '../lib/context.js';

const W = 960,
  H = 540;
function useBoxWidth() {
  const ref = React.useRef(null),
    [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = () => setW(el.getBoundingClientRect().width);
    f();
    if (!window.ResizeObserver) return;
    const ro = new ResizeObserver(f);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
function Scaled({ children, className }) {
  const [ref, w] = useBoxWidth();
  const s = w ? w / W : 0;
  return (
    <div ref={ref} className={cn('relative w-full overflow-hidden', className)} style={{ aspectRatio: '16 / 9' }}>
      {s > 0 && (
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: W, height: H, transform: `scale(${s})` }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
function Frame({ d, n, total, title, kicker, children, dark }) {
  return (
    <div
      className={cn(
        'light-scope relative flex h-full w-full flex-col overflow-hidden font-sans',
        dark ? 'bg-[hsl(223_47%_9%)] text-white' : 'bg-white text-[hsl(222_47%_11%)]'
      )}
    >
      {!dark && (
        <div className="flex items-end justify-between px-12 pt-9">
          <div>
            <div className="text-[13px] font-medium text-[hsl(218_88%_48%)]">{kicker}</div>
            <h2 className="mt-1 text-[27px] font-semibold leading-tight tracking-[-.02em]">{title}</h2>
          </div>
          <span className="text-[12px] text-[hsl(216_10%_54%)]">{d.project}</span>
        </div>
      )}
      <div className={cn('flex-1', !dark && 'px-12 pb-4 pt-5')}>{children}</div>
      {!dark && (
        <div className="flex items-center justify-between border-t border-[hsl(216_22%_90%)] px-12 py-3 text-[11px] text-[hsl(216_10%_54%)]">
          <span>Strictly private and confidential. Prepared by Vult for {d.org}.</span>
          <span className="flex items-center gap-3">
            <Hallmark d={d} size={0.5} captions={false} className="gap-1" />
            <span>
              {n} of {total}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function slides(d, m) {
  const X = compsData(d, m, 'all', true),
    o = X.o,
    down = calc(d, 'downside', m.wacc, m.tgr).vps,
    L = d.periods.length - 1;
  const I = d.industry,
    years = [];
  for (let y = I.base - 5; y <= I.base + 5; y++) years.push(String(y));
  const r = rng(d.key === 'uk' ? 3 : 5),
    series = years.map(y => I.sam[0] * Math.pow(1 + I.cagr, +y - I.base) * (+y < I.base ? 1 + (r() - 0.5) * 0.03 : 1));
  const rec = o.up > 0.1 ? 'Proceed to phase 2' : o.up > 0 ? 'Proceed with caution' : 'Do not proceed';
  const total = 7;
  const S = [];
  S.push({
    t: 'Cover',
    el: n => (
      <Frame d={d} n={n} total={total} dark>
        <div className="flex h-full flex-col justify-between p-14">
          <div className="flex items-center justify-between text-[13px] text-white/60">
            <span>{d.org}</span>
            <span>10 October 2026</span>
          </div>
          <div>
            <div className="text-[15px] font-medium text-[hsl(205_100%_70%)]">Investment committee pre-read</div>
            <h1 className="mt-2 text-[64px] font-semibold leading-none tracking-[-.035em]">{d.project}</h1>
            <p className="mt-4 max-w-[560px] text-[18px] leading-snug text-white/70">
              A {d.type.toLowerCase()} of {d.target} ({d.ticker}), {d.sector.toLowerCase()}.
            </p>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-[12px] text-white/50">
              Strictly private and confidential. Prepared by Vult, reviewed by {d.reviewer}.
            </span>
            <Hallmark d={d} captions={false} />
          </div>
        </div>
      </Frame>
    )
  });
  S.push({
    t: 'Executive summary',
    el: n => (
      <Frame
        d={d}
        n={n}
        total={total}
        kicker="Executive summary"
        title={`${rec}: ${sharePx(d, o.vps)} per share, ${fpS(o.up)} on today's price`}
      >
        <div className="grid h-full grid-cols-[1fr_1.35fr] gap-8">
          <div className="flex flex-col gap-3">
            {[
              ['DCF value per share', sharePx(d, o.vps), `${SCEN[m.scen].l} case, WACC ${fp(m.wacc)}`],
              ['EV / NTM EBITDA today', fx(X.tgt.eve), `Peer median ${fx(X.med.eve)}`],
              ['Downside value', sharePx(d, down), 'Growth −2.5pp, margin −2pp']
            ].map(([l, v, s]) => (
              <div key={l} className="rounded-xl border border-[hsl(216_22%_90%)] px-5 py-3.5">
                <div className="text-[12px] text-[hsl(216_10%_54%)]">{l}</div>
                <div className="text-[30px] font-semibold leading-tight tracking-[-.03em]">{v}</div>
                <div className="text-[12px] text-[hsl(218_14%_36%)]">{s}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-2 text-[13px] font-semibold">Why we like it</div>
            <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-[15px] leading-snug">
              {d.memo.thesis.map(([t], i) => (
                <li key={i}>
                  {t
                    .replace('{m0}', fp(o.m[d.nAct - 1]))
                    .replace('{mN}', fp(o.m[L]))
                    .replace('{tev}', fx(X.tgt.eve))
                    .replace('{pmed}', fx(X.med.eve))}
                  .
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Frame>
    )
  });
  const LR = (() => {
    const at = tg => {
      let b = null;
      for (let e = 8; e <= 30; e += 0.1) {
        const q = lbo(d, o, e, e, m.lev);
        if (q.irr >= tg) b = q.offer;
        else break;
      }
      return b;
    };
    const a = at(0.25),
      b = at(0.2);
    return a && b ? [a, b] : null;
  })();
  S.push({
    t: 'Valuation summary',
    el: (n, thumb) => (
      <Frame
        d={d}
        n={n}
        total={total}
        kicker="Valuation summary"
        title={`Methods converge on ${sharePx(d, X.comp25)} to ${sharePx(d, Math.max(...[X.comp75, o.vps]))} per share`}
      >
        {!thumb && <Football d={d} X={X} LR={LR} height={300} />}
        {thumb && (
          <div className="flex h-[300px] flex-col justify-center gap-5 px-6">
            {[0.5, 0.62, 0.44, 0.7, 0.38].map((w, i) => (
              <div
                key={i}
                className="h-5 rounded-sm"
                style={{
                  width: `${w * 100}%`,
                  marginLeft: `${15 + i * 3}%`,
                  background: i === 3 ? 'hsl(218 88% 48% / .3)' : 'hsl(222 47% 11% / .1)'
                }}
              />
            ))}
          </div>
        )}
      </Frame>
    )
  });
  S.push({
    t: 'Trading comps',
    el: n => (
      <Frame
        d={d}
        n={n}
        total={total}
        kicker="Trading comps"
        title={`${d.short} trades at a ${Math.round((1 - X.tgt.eve / X.med.eve) * 100)}% discount to its peers`}
      >
        <table className="w-full text-[13.5px] tnum">
          <thead>
            <tr className="text-[12px] text-[hsl(216_10%_54%)]">
              <th className="border-b-2 border-[hsl(222_47%_11%)] pb-2 text-left font-medium">Company</th>
              {['EV, ' + d.unit, 'EV / revenue', 'EV / EBITDA', 'Growth', 'Margin'].map(h => (
                <th key={h} className="border-b-2 border-[hsl(222_47%_11%)] pb-2 text-right font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...X.all]
              .sort((a, b) => b.eve - a.eve)
              .map(p => (
                <tr key={p.n}>
                  <td className="border-b border-[hsl(216_22%_90%)] py-[7px]">{p.n}</td>
                  <td className="border-b border-[hsl(216_22%_90%)] text-right">{nf0.format(p.ev)}</td>
                  <td className="border-b border-[hsl(216_22%_90%)] text-right">{fx(p.evr)}</td>
                  <td className="border-b border-[hsl(216_22%_90%)] text-right">{fx(p.eve)}</td>
                  <td className="border-b border-[hsl(216_22%_90%)] text-right">{fp(p.g)}</td>
                  <td className="border-b border-[hsl(216_22%_90%)] text-right">{fp(p.m)}</td>
                </tr>
              ))}
            <tr className="font-semibold">
              <td className="py-[7px]">Peer median</td>
              <td className="text-right">{nf0.format(X.med.ev)}</td>
              <td className="text-right">{fx(X.med.evr)}</td>
              <td className="text-right">{fx(X.med.eve)}</td>
              <td className="text-right">{fp(X.med.g)}</td>
              <td className="text-right">{fp(X.med.m)}</td>
            </tr>
            <tr className="bg-[hsl(218_88%_48%/.1)] font-semibold">
              <td className="py-[7px] pl-2">{d.target}</td>
              <td className="text-right">{nf0.format(X.tgt.ev)}</td>
              <td className="text-right">{fx(X.tgt.evr)}</td>
              <td className="text-right">{fx(X.tgt.eve)}</td>
              <td className="text-right">{fp(X.tgt.g)}</td>
              <td className="pr-2 text-right">{fp(X.tgt.m)}</td>
            </tr>
          </tbody>
        </table>
      </Frame>
    )
  });
  S.push({
    t: 'Market',
    el: (n, thumb) => (
      <Frame
        d={d}
        n={n}
        total={total}
        kicker="Market"
        title={`A ${d.cur}${I.sam[0]}bn serviceable market growing ${fp(I.cagr)} a year`}
      >
        <div className="grid h-full grid-cols-[1.4fr_1fr] gap-8">
          {thumb ? (
            <div className="rounded-lg bg-[hsl(218_88%_48%/.08)]" />
          ) : (
            <AreaTrend
              data={series}
              labels={years}
              split={5}
              height={300}
              unitLabel="Serviceable market"
              fmt={(v, ax) => (ax ? d.cur + Math.round(v * 10) / 10 : d.cur + v.toFixed(2) + 'bn')}
            />
          )}
          <div className="flex flex-col justify-center gap-5">
            {[
              ['Total', I.tam],
              ['Serviceable', I.sam],
              ['Obtainable', I.som]
            ].map(([l, v], i) => (
              <div key={l}>
                <div className="flex justify-between text-[14px]">
                  <b className="font-semibold">{l}</b>
                  <b className="font-semibold">
                    {d.cur}
                    {v[0]}bn
                  </b>
                </div>
                <div className="mt-1.5 h-3 rounded-full bg-[hsl(216_25%_94%)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(1.5, (v[0] / I.tam[0]) * 100)}%`,
                      background: i === 2 ? 'hsl(218 88% 48%)' : 'hsl(218 14% 36% / .55)'
                    }}
                  />
                </div>
                <p className="mt-1 text-[12px] text-[hsl(216_10%_54%)]">{v[1]}</p>
              </div>
            ))}
          </div>
        </div>
      </Frame>
    )
  });
  S.push({
    t: 'Competitive position',
    el: (n, thumb) => (
      <Frame
        d={d}
        n={n}
        total={total}
        kicker="Competitive position"
        title={`${d.short} leads the mid-market; broad platforms are moving down`}
      >
        {thumb ? (
          <div className="h-[300px] rounded-lg bg-[hsl(216_25%_96%)]" />
        ) : (
          <Bubble rows={d.matrix.rows} cur={d.cur} height={310} compact />
        )}
      </Frame>
    )
  });
  S.push({
    t: 'Risks and next steps',
    el: n => (
      <Frame
        d={d}
        n={n}
        total={total}
        kicker="Risks and next steps"
        title="Three questions to answer before a binding offer"
      >
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="mb-2 text-[13px] font-semibold">Key risks</div>
            <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-[14.5px] leading-snug">
              {d.memo.risks.map(([t], i) => (
                <li key={i}>{t.split('. ')[0]}.</li>
              ))}
            </ol>
          </div>
          <div>
            <div className="mb-2 text-[13px] font-semibold">Phase 2 diligence</div>
            <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-[14.5px] leading-snug">
              {d.memo.plan.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>
        </div>
      </Frame>
    )
  });
  return S;
}

export function DeckView() {
  const { d, m, deckI, setDeckI } = useA();
  const S = React.useMemo(() => slides(d, m), [d, m]);
  const i = Math.min(deckI, S.length - 1),
    stage = React.useRef(null);
  const go = React.useCallback(k => setDeckI(Math.max(0, Math.min(S.length - 1, k))), [S.length, setDeckI]);
  React.useEffect(() => {
    const f = e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [i, go]);
  const present = () => {
    const el = stage.current;
    if (el && el.requestFullscreen)
      el.requestFullscreen().catch(() =>
        toast('Full screen is not available here', { description: 'Use the arrow keys to move between slides.' })
      );
    else toast('Full screen is not available here');
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="mr-auto flex items-center gap-2.5 text-[13px]">
          <FileIcon kind="pptx" />
          <b className="font-medium">{d.project.replace('Project ', '')}_IC_Deck.pptx</b>
          <Badge>{S.length} slides</Badge>
          <span className="text-xs text-fg3 max-lg:hidden">
            Built in {d.style}, numbers linked to model version {m.v}
          </span>
        </div>
        <Tip label="Previous slide" kbd="←">
          <Button size="iconsm" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous slide">
            <ChevronLeft size={15} />
          </Button>
        </Tip>
        <span className="w-14 text-center text-xs text-fg2">
          {i + 1} of {S.length}
        </span>
        <Tip label="Next slide" kbd="→">
          <Button size="iconsm" onClick={() => go(i + 1)} disabled={i === S.length - 1} aria-label="Next slide">
            <ChevronRight size={15} />
          </Button>
        </Tip>
        <Button size="sm" onClick={present}>
          <Maximize2 size={13} />
          Present
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() =>
            toast.success('Deck exported', {
              description: `${d.project.replace('Project ', '')}_IC_Deck.pptx, ${S.length} slides, saved to ${d.folder}`
            })
          }
        >
          <Download size={13} />
          Export to PowerPoint
        </Button>
      </div>
      <div className="grid grid-cols-[172px_minmax(0,1fr)] items-start gap-4 max-md:grid-cols-1">
        <ol
          className="flex flex-col gap-2.5 max-md:order-2 max-md:flex-row max-md:overflow-x-auto max-md:pb-2"
          aria-label="Slides"
        >
          {S.map((s, k) => (
            <li key={k} className="shrink-0 max-md:w-[150px]">
              <button
                onClick={() => go(k)}
                aria-current={k === i ? 'true' : undefined}
                className={cn(
                  'block w-full rounded-lg p-0.5 text-left transition-shadow',
                  k === i
                    ? 'shadow-[0_0_0_2px_hsl(var(--gold))]'
                    : 'shadow-[0_0_0_1px_hsl(var(--line2))] hover:shadow-[0_0_0_1px_hsl(var(--fg3))]'
                )}
              >
                <Scaled className="rounded-md">{s.el(k + 1, true)}</Scaled>
              </button>
              <span className="mt-1 block truncate text-xs text-fg3">
                {k + 1}. {s.t}
              </span>
            </li>
          ))}
        </ol>
        <div
          ref={stage}
          className="min-w-0 rounded-panel border border-line bg-inset p-[clamp(10px,2vw,24px)] [&:fullscreen]:flex [&:fullscreen]:items-center [&:fullscreen]:bg-black"
        >
          <div className="mx-auto w-full max-w-[1100px] overflow-hidden rounded-lg shadow-[0_30px_80px_-30px_hsl(var(--shadow)/.7),0_0_0_1px_hsl(var(--line))]">
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Scaled>{S[i].el(i + 1, false)}</Scaled>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
