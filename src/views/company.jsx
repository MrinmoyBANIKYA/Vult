import * as React from 'react';
import { ArrowUpRight, TriangleAlert, FileText } from 'lucide-react';
import { Button, Badge, Tip } from '../components/ui.jsx';
import { Av, CoLogo, Panel } from '../components/shared.jsx';
import { Spark, SegmentBars, Waterfall, Donut } from '../components/charts.jsx';
import { sharePx, fpS, nf0, rng } from '../lib/engine.js';
import { cn } from '../lib/utils.js';
import { useA } from '../lib/context.js';

export function CompanyView() {
  const { d, openEv } = useA();
  const C = d.company,
    mcap = (d.price * d.shares) / (d.pence ? 100 : 1);
  const r = rng(d.key === 'uk' ? 21 : 23),
    [lo, hi] = d.wk52,
    start = lo + (hi - lo) * 0.35;
  const px = Array.from({ length: 52 }, (_, i) => {
    const b = start + (d.price - start) * (i / 51);
    return Math.max(lo, Math.min(hi, b + Math.sin(i / 4.2) * (hi - lo) * 0.16 + (r() - 0.5) * (hi - lo) * 0.08));
  });
  px[51] = d.price;
  const chg = d.price / px[0] - 1;
  const oc = [
    'hsl(var(--gold))',
    'hsl(var(--info))',
    'hsl(var(--presence))',
    'hsl(var(--pos))',
    'hsl(var(--fg3) / .6)'
  ];
  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden card">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 p-5 max-lg:grid-cols-1">
          <div className="flex items-start gap-4">
            <CoLogo text={d.mono} tg size={44} className="rounded-[11px]" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[19px] font-semibold tracking-[-.02em]">{d.target}</h2>
                <Badge tone="outline">{d.ticker}</Badge>
                <Badge tone="outline">{d.sector}</Badge>
              </div>
              <p className="mt-1.5 max-w-[78ch] text-[13.5px] leading-relaxed text-fg2">{C.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-5 max-lg:justify-start">
            <Spark data={px} w={170} h={52} tone="gold" />
            <div className="text-right">
              <div className="text-xs text-fg3">Close, 9 Oct 2026</div>
              <div className="text-[28px] font-semibold leading-tight tracking-[-.03em]">{sharePx(d, d.price)}</div>
              <div className={cn('text-[12.5px] font-medium', chg >= 0 ? 'text-pos' : 'text-neg')}>
                {fpS(chg)} over 12 months
              </div>
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-6 border-t border-line max-lg:grid-cols-3">
          {[
            ['Headquarters', C.hq],
            ['Founded', C.founded],
            ['Employees', C.staff],
            ['Listed', C.listed],
            ['Customers', C.base],
            ['Market cap', `${d.cur}${nf0.format(mcap)}m`]
          ].map(([a, b], i) => (
            <div key={a} className={cn('min-w-0 border-line px-5 py-3', i < 5 && 'border-r', 'max-lg:border-b')}>
              <dt className="text-xs text-fg3">{a}</dt>
              <dd className="mt-0.5 truncate text-[13px] font-medium">{b}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid grid-cols-6 gap-2.5 max-xl:grid-cols-3 max-md:grid-cols-2">
        {C.kpis.map(([l, v, dl, k, tone]) => {
          const body = (
            <>
              <span className="flex items-center justify-between gap-2 text-xs text-fg3">
                {l}
                {k && <ArrowUpRight size={13} className="opacity-0 transition-opacity group-hover:opacity-100" />}
              </span>
              <span className="mt-1 text-[22px] font-semibold tracking-[-.03em]">{v}</span>
              <span
                className={cn(
                  'text-[11.5px] font-medium',
                  tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : 'text-fg3'
                )}
              >
                {dl}
              </span>
            </>
          );
          return k ? (
            <Tip key={l} label="Show the source">
              <button
                onClick={() => openEv(k)}
                className="group flex min-w-0 flex-col card px-3.5 py-3 text-left transition-colors hover:border-gold/50"
              >
                {body}
              </button>
            </Tip>
          ) : (
            <div key={l} className="flex min-w-0 flex-col card px-3.5 py-3">
              {body}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        <Panel
          title="Revenue by segment"
          sub={d.unit}
          right={
            <span className="flex gap-3 text-xs text-fg2">
              <span className="flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-[3px] bg-fg2/70" />
                {C.seg.names[0]}
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-[3px] bg-gold" />
                {C.seg.names[1]}
              </span>
            </span>
          }
        >
          <SegmentBars seg={C.seg} cur={d.cur} />
        </Panel>
        <Panel
          title={`Revenue bridge, ${C.bridge.from[0]} to ${C.bridge.to[0]}`}
          sub={`${d.unit}, axis starts at ${d.cur}${C.bridge.base}m`}
        >
          <Waterfall B={C.bridge} cur={d.cur} />
        </Panel>
      </div>

      <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
        <Panel title="Ownership">
          <div className="flex items-center gap-5">
            <Donut parts={C.own.map(o => o[1])} colors={oc} label={C.own[0][1] + '%'} sub="largest holder" />
            <ul className="min-w-0 flex-1 text-[13px]">
              {C.own.map((o, i) => (
                <li
                  key={o[0]}
                  className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2 border-b border-line py-1.5 last:border-b-0"
                >
                  <i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: oc[i] }} />
                  <span className="truncate">{o[0]}</span>
                  <b className="font-medium">{o[1].toFixed(1)}%</b>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel title="Management" pad={false}>
          {C.mgmt.map(([n, role, yr, note]) => (
            <div
              key={n}
              className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3 border-b border-line/60 px-5 py-3 last:border-b-0"
            >
              <Av n={n} size={28} ring={false} />
              <div className="min-w-0">
                <b className="font-semibold">{n}</b>
                <div className="text-xs text-fg3">{role}</div>
                <p className="mt-1 text-[12.5px] text-fg2">{note}</p>
              </div>
              <Badge>Since {yr}</Badge>
            </div>
          ))}
        </Panel>
        <Panel title="Recent events" pad={false}>
          <ol className="px-4 py-1.5">
            {C.events.map(([dt, x, s]) => (
              <li
                key={dt}
                className="grid grid-cols-[84px_12px_minmax(0,1fr)] items-start gap-2.5 border-b border-line py-2.5 text-[13px] last:border-b-0"
              >
                <time className="pt-px text-xs text-fg3">{dt}</time>
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 rounded-full',
                    s === 'pos' ? 'bg-pos' : s === 'neg' ? 'bg-neg' : 'bg-fg3'
                  )}
                />
                <span>{x}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel title="Red flags" sub="Raised by the Assayer’s red team" pad={false}>
        {C.flags.map(([t, x, sev, k]) => (
          <div
            key={t}
            className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3 border-b border-line/60 px-5 py-3 last:border-b-0"
          >
            <span
              className={cn(
                'grid h-7 w-7 place-items-center rounded-lg',
                sev === 'High' ? 'bg-neg/12 text-neg' : sev === 'Medium' ? 'bg-warn/13 text-warn' : 'bg-fg/6 text-fg3'
              )}
            >
              <TriangleAlert size={14} />
            </span>
            <div>
              <b className="font-semibold">{t}</b>
              <p className="mt-0.5 text-[13px] text-fg2">{x}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={sev === 'High' ? 'neg' : sev === 'Medium' ? 'warn' : 'neutral'} dot>
                {sev}
              </Badge>
              {k && (
                <Button size="xs" onClick={() => openEv(k)}>
                  <FileText size={12} />
                  Source
                </Button>
              )}
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}
