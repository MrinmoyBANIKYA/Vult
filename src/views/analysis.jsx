import * as React from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  Target,
  MessageSquare,
  LayoutGrid,
  ChartScatter,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Button, Badge, Segmented, Switch, Tip } from '../components/ui.jsx';
import { CoLogo, Panel } from '../components/shared.jsx';
import { PeerScatter, Football, AreaTrend, Bubble } from '../components/charts.jsx';
import { compsData, lbo, initials, fx, fp, nf0, sharePx, rng } from '../lib/engine.js';
import { cn } from '../lib/utils.js';
import { useA } from '../lib/context.js';

function lboRange(d, o, lev) {
  const at = target => {
    let best = null;
    for (let e = 8; e <= 30; e += 0.1) {
      const r = lbo(d, o, e, e, lev);
      if (r.irr >= target) best = r.offer;
      else break;
    }
    return best;
  };
  const a = at(0.25),
    b = at(0.2);
  return a && b ? [a, b] : null;
}

export function CompsView() {
  const { d, m, openEv } = useA();
  const [filt, setFilt] = React.useState('all'),
    [lease, setLease] = React.useState(true),
    [sorting, setSorting] = React.useState([{ id: 'eve', desc: true }]);
  const X = React.useMemo(() => compsData(d, m, filt, lease), [d, m, filt, lease]);
  const LR = React.useMemo(() => lboRange(d, X.o, m.lev), [d, X, m.lev]);
  const cols = React.useMemo(
    () => [
      {
        id: 'n',
        accessorKey: 'n',
        header: 'Company',
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <CoLogo text={initials(p.n)} />
              <span className="flex min-w-0 flex-col leading-tight">
                <button
                  onClick={() => openEv('peer:' + p.i)}
                  className="truncate text-left font-medium underline decoration-gold/0 underline-offset-[3px] transition-colors hover:text-gold hover:decoration-gold/60"
                >
                  {p.n}
                </button>
                <span className="text-xs text-fg3">
                  {p.c}, {p.std}
                </span>
              </span>
              {p.adj && lease && (
                <Tip label={d.adjNote}>
                  <span>
                    <Badge>Leases restated</Badge>
                  </span>
                </Tip>
              )}
            </div>
          );
        }
      },
      { id: 'ev', accessorKey: 'ev', header: `EV, ${d.unit}`, cell: i => nf0.format(i.getValue()), meta: 'r' },
      { id: 'evr', accessorKey: 'evr', header: 'EV / NTM revenue', cell: i => fx(i.getValue()), meta: 'r' },
      { id: 'eve', accessorKey: 'eve', header: 'EV / NTM EBITDA', cell: i => fx(i.getValue()), meta: 'r' },
      { id: 'g', accessorKey: 'g', header: 'NTM growth', cell: i => fp(i.getValue()), meta: 'r' },
      { id: 'm', accessorKey: 'm', header: 'EBITDA margin', cell: i => fp(i.getValue()), meta: 'r' }
    ],
    [d, lease, openEv]
  );
  const table = useReactTable({
    data: X.peers,
    columns: cols,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });
  const TR = ({ p, cls, first }) => (
    <tr className={cls}>
      <td className={cn('h-11 border-t border-line px-4', first)}>
        {first ? null : null}
        {p.content}
      </td>
    </tr>
  );
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented
          id="peers"
          label="Peer set"
          value={filt}
          onChange={setFilt}
          options={[
            { v: 'all', l: 'All peers' },
            { v: 'uk', l: 'UK' },
            { v: 'us', l: 'US' }
          ]}
        />
        <label className="flex items-center gap-2 text-[12.5px] text-fg2" htmlFor="lease">
          <Switch id="lease" checked={lease} onCheckedChange={setLease} label="Align lease accounting" />
          Align lease accounting
        </label>
        <span className="ml-auto text-xs text-fg3">
          Prices at the 9 Oct 2026 close, on a {d.fyEnd} year-end. Select a peer to see how its EV was built.
        </span>
      </div>
      <div className="overflow-x-auto card">
        <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[13px] tnum">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => {
                  const s = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      className={cn(
                        'h-9 border-b border-line/60 px-5 text-xs font-medium',
                        h.column.columnDef.meta === 'r' ? 'text-right' : 'text-left',
                        s ? 'text-fg' : 'text-fg3'
                      )}
                    >
                      <button
                        onClick={h.column.getToggleSortingHandler()}
                        className={cn(
                          'inline-flex items-center gap-1 hover:text-fg',
                          h.column.columnDef.meta === 'r' && 'flex-row-reverse'
                        )}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {s === 'desc' ? <ArrowDown size={11} /> : s === 'asc' ? <ArrowUp size={11} /> : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(r => (
              <tr key={r.id} className="transition-colors hover:bg-fg/3">
                {r.getVisibleCells().map(c => (
                  <td
                    key={c.id}
                    className={cn('h-11 border-b border-line/60 px-5', c.column.columnDef.meta === 'r' && 'text-right')}
                  >
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="h-11 border-b border-line/60 px-5">
                <button
                  onClick={() => openEv('comps')}
                  className="underline decoration-gold/40 underline-offset-[3px] hover:text-gold"
                >
                  Peer median
                </button>
              </td>
              <td className="border-b border-line/60 px-5 text-right">{nf0.format(X.med.ev)}</td>
              <td className="border-b border-line/60 px-5 text-right">{fx(X.med.evr)}</td>
              <td className="border-b border-line/60 px-5 text-right">{fx(X.med.eve)}</td>
              <td className="border-b border-line/60 px-5 text-right">{fp(X.med.g)}</td>
              <td className="border-b border-line/60 px-5 text-right">{fp(X.med.m)}</td>
            </tr>
            <tr className="bg-gold/8 font-medium">
              <td className="h-11 px-4 shadow-[inset_2px_0_0_hsl(var(--gold))]">
                <div className="flex items-center gap-2.5">
                  <CoLogo text={d.mono} tg />
                  <span className="flex flex-col leading-tight">
                    <b className="font-semibold">{d.target}</b>
                    <span className="text-xs font-normal text-fg3">Target, at today's price</span>
                  </span>
                </div>
              </td>
              <td className="px-4 text-right">{nf0.format(X.tgt.ev)}</td>
              <td className="px-4 text-right">{fx(X.tgt.evr)}</td>
              <td className="px-4 text-right">{fx(X.tgt.eve)}</td>
              <td className="px-4 text-right">{fp(X.tgt.g)}</td>
              <td className="px-4 text-right">{fp(X.tgt.m)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-start gap-4 max-xl:grid-cols-1">
        <Panel title="Valuation summary" sub="Value per share by method">
          <Football d={d} X={X} LR={LR} />
        </Panel>
        <Panel title="Growth against multiple" sub="Select a peer for its source">
          <PeerScatter X={X} d={d} onPeer={i => openEv('peer:' + i)} />
          <ul className="mt-3 flex flex-col gap-2 text-[13px] text-fg2">
            <li className="flex gap-2">
              <Target size={14} className="mt-0.5 shrink-0 text-gold" />
              {d.short} trades at {fx(X.tgt.eve)} NTM EBITDA against a peer median of {fx(X.med.eve)}.
            </li>
            <li className="flex gap-2">
              <Target size={14} className="mt-0.5 shrink-0 text-gold" />
              At its growth rate the regression implies {fx(X.impMult)} revenue, or about {sharePx(d, X.impVps)} per
              share.
            </li>
          </ul>
        </Panel>
      </div>
      <p className="mt-3 text-[12.5px] text-fg2">
        {lease ? d.adjNote : 'Lease accounting is not aligned, so multiples mix IFRS 16 and ASC 842 EBITDA.'} All
        companies are fictional.
      </p>
    </div>
  );
}

export function MatrixView() {
  const { d, run, dock, openCell } = useA();
  const [view, setView] = React.useState('matrix');
  const M = d.matrix,
    p = run.plan,
    nR = M.rows.length,
    nC = M.cols.length,
    live = run.status !== 'done';
  const fillAt = (r, c) => p.an.a + (p.an.b - p.an.a) * ((r * nC + c + 1) / (nR * nC));
  const filled = (r, c) => !live || run.t >= fillAt(r, c);
  const sel = dock && dock.k === 'cell' ? dock.rc : null;
  const tone = v => (v === 'High' ? 'neg' : v === 'Medium' ? 'warn' : v === 'Target' ? 'gold' : 'neutral');
  const done = M.rows.reduce((s, row, ri) => s + row.c.filter((_, ci) => filled(ri, ci)).length, 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented
          id="mxv"
          label="View"
          value={view}
          onChange={setView}
          options={[
            { v: 'matrix', l: 'Matrix', i: LayoutGrid },
            { v: 'map', l: 'Positioning', i: ChartScatter }
          ]}
        />
        <span className="text-[12.5px] text-fg3">
          {nR} companies, {nC} questions, {done} of {nR * nC} answers filled. Select an answer to see its sources.
        </span>
      </div>
      {view === 'matrix' ? (
        <div className="max-h-[640px] overflow-auto card">
          <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-[12.5px]">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-3 h-10 border-b border-r border-line bg-raised px-3 text-left text-xs font-medium text-fg3">
                  Company
                </th>
                {M.cols.map((q, i) => (
                  <th
                    key={q}
                    className="sticky top-0 z-2 border-b border-r border-line bg-raised px-3 text-left text-xs font-medium text-fg2 last:border-r-0"
                  >
                    <span className="flex items-center gap-1.5">
                      {i === nC - 1 ? (
                        <Target size={12} className="text-fg3" />
                      ) : (
                        <MessageSquare size={12} className="text-fg3" />
                      )}
                      {q}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {M.rows.map((row, ri) => (
                <tr key={row.n}>
                  <td
                    className={cn(
                      'sticky left-0 z-1 min-w-[180px] border-b border-r border-line bg-raised px-3 py-2.5',
                      row.tg && 'shadow-[inset_2px_0_0_hsl(var(--gold))]'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <CoLogo text={row.m} tg={row.tg} />
                      <span className="flex flex-col leading-tight">
                        <b className="font-medium">{row.n}</b>
                        <span className="text-xs text-fg3">{row.tg ? 'Target' : 'Competitor'}</span>
                      </span>
                    </div>
                  </td>
                  {row.c.map((v, ci) => {
                    const f = filled(ri, ci),
                      on = sel && sel[0] === ri && sel[1] === ci,
                      srcs = [row.doc, [5, 6, 7][ci % 3]].filter((x, i, a) => a.indexOf(x) === i);
                    return (
                      <td
                        key={ci}
                        tabIndex={f ? 0 : -1}
                        onClick={() => f && openCell([ri, ci])}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && f) openCell([ri, ci]);
                        }}
                        className={cn(
                          'h-[62px] min-w-[140px] max-w-[210px] cursor-pointer border-b border-r border-line px-3 py-2.5 align-top transition-colors last:border-r-0 hover:bg-fg/4',
                          on && 'bg-info/10 shadow-[inset_0_0_0_1.5px_hsl(var(--info))]'
                        )}
                      >
                        {!f ? (
                          <>
                            <div className="skel mt-1 h-3 w-4/5" />
                            <div className="skel mt-2 h-3 w-1/2" />
                          </>
                        ) : ci === nC - 1 ? (
                          <Badge tone={tone(v)} dot>
                            {v}
                          </Badge>
                        ) : (
                          <div className={cn(live && 'animate-in fade-in-0 duration-500')}>
                            <div className="line-clamp-2 leading-snug">{v}</div>
                            <div className="mt-1.5 flex gap-1">
                              {srcs.map(s => (
                                <span
                                  key={s}
                                  className="grid h-4 min-w-4 place-items-center rounded-[4px] border border-line bg-fg/4 px-1 text-[10px] text-fg3"
                                >
                                  {s + 1}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start gap-4 max-xl:grid-cols-1">
          <Panel title="Competitive positioning" sub="Bubble size shows revenue">
            <Bubble rows={M.rows} cur={d.cur} />
            <p className="mt-1 text-xs text-fg3">Scored from product documentation, pricing pages and expert calls.</p>
          </Panel>
          <Panel title="What it means">
            <ul className="flex flex-col gap-3 text-[13px] text-fg2">
              {M.rows
                .filter(r => !r.tg)
                .slice(0, 4)
                .map(r => (
                  <li key={r.n} className="flex gap-2.5">
                    <Badge tone={tone(r.c[nC - 1])} className="mt-0.5 shrink-0">
                      {r.c[nC - 1]}
                    </Badge>
                    <span>
                      <b className="font-medium text-fg">{r.n}.</b> {r.c[0]}; {r.c[2].toLowerCase()}.
                    </span>
                  </li>
                ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}

export function MarketView() {
  const { d } = useA();
  const I = d.industry,
    years = [];
  for (let y = I.base - 5; y <= I.base + 5; y++) years.push(String(y));
  const r = rng(d.key === 'uk' ? 3 : 5);
  const series = years.map(
    y => I.sam[0] * Math.pow(1 + I.cagr, +y - I.base) * (+y < I.base ? 1 + (r() - 0.5) * 0.03 : 1)
  );
  const max = I.tam[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start gap-4 max-xl:grid-cols-1">
        <Panel
          title={I.title}
          sub={`Serviceable market, ${d.cur}bn`}
          right={<Badge tone="gold">{fp(I.cagr)} a year</Badge>}
        >
          <AreaTrend
            data={series}
            labels={years}
            split={5}
            unitLabel="Serviceable market"
            fmt={(v, ax) => (ax ? d.cur + Math.round(v * 10) / 10 : d.cur + v.toFixed(2) + 'bn')}
          />
        </Panel>
        <Panel title="Market size">
          <div className="flex flex-col gap-4">
            {[
              ['tam', 'Total', I.tam],
              ['sam', 'Serviceable', I.sam],
              ['som', 'Obtainable', I.som]
            ].map(([k, l, v]) => (
              <div key={k}>
                <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
                  <b className="font-semibold">{l}</b>
                  <b className="font-semibold">
                    {d.cur}
                    {v[0]}bn
                  </b>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-fg/6">
                  <div
                    className={cn('h-full rounded-full', k === 'som' ? 'bg-gold' : 'bg-fg2/60')}
                    style={{ width: `${Math.max(1.2, (v[0] / max) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-fg3">{v[1]}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-line pt-3 text-[12.5px] text-fg2">{I.method}</p>
        </Panel>
      </div>
      <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        <Panel title="Drivers and headwinds" pad={false}>
          <ul>
            {I.drivers.map(([dir, x, imp]) => (
              <li
                key={x}
                className="grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line/60 px-5 py-2.5 text-[13px] last:border-b-0"
              >
                <span
                  className={cn(
                    'grid h-[26px] w-[26px] place-items-center rounded-md',
                    dir === 'up' ? 'bg-pos/12 text-pos' : 'bg-neg/12 text-neg'
                  )}
                >
                  {dir === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                </span>
                <span>{x}</span>
                <Badge tone={imp === 'High' ? 'gold' : 'neutral'}>{imp}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Five forces" sub="How hard each force pushes on margins">
          {I.forces.map(([n, v]) => (
            <div key={n} className="grid grid-cols-[minmax(0,1fr)_120px_52px] items-center gap-3 py-2 text-[13px]">
              <span>{n}</span>
              <span className="flex gap-1">
                {[1, 2, 3].map(i => (
                  <i key={i} className={cn('h-1.5 flex-1 rounded-full', i <= v ? 'bg-fg2' : 'bg-line2')} />
                ))}
              </span>
              <span className="text-xs text-fg3">{['', 'Low', 'Medium', 'High'][v]}</span>
            </div>
          ))}
        </Panel>
      </div>
      <p className="text-[12.5px] text-fg2">Market figures are illustrative outputs for a fictional company.</p>
    </div>
  );
}
