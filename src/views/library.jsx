import * as React from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table';
import { Search, FileText, ShieldCheck, ArrowDown, ArrowUp, Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Badge, Segmented, Progress } from '../components/ui.jsx';
import {
  Av,
  CoLogo,
  Panel,
  PageHead,
  SecHead,
  DocPage,
  Empty,
  Hallmark,
  FileIcon,
  SrcIcon,
  Status,
  Num
} from '../components/shared.jsx';
import { AreaTrend, Spark } from '../components/charts.jsx';
import { filesFor, clk, hm, tzTime, initials, nf0, rng } from '../lib/engine.js';
import { cn } from '../lib/utils.js';
import { useA } from '../lib/context.js';
import { F } from '../lib/format.js';

export function SourcesView() {
  const { d, srcSel, setSrcSel, openEv } = useA();
  const [f, setF] = React.useState('all'),
    [q, setQ] = React.useState(''),
    [pageSel, setPageSel] = React.useState({ doc: null, i: 0 });
  const types = [
    ['all', 'All'],
    ['Filing', 'Filings'],
    ['Data room', 'Data room'],
    ['Expert call', 'Calls'],
    ['Web', 'Web'],
    ['Market data', 'Market']
  ];
  const docs = d.docs.filter(
    x =>
      (f === 'all' ||
        x.ty === f ||
        (f === 'Expert call' && x.ty === 'Transcript') ||
        (f === 'Filing' && x.ty === 'Presentation')) &&
      (x.t + x.who).toLowerCase().includes(q.toLowerCase())
  );
  const cur = d.docs.find(x => x.id === srcSel) || d.docs[0];
  const pgKeys = Object.keys(d.pages).filter(k => k.split('.')[0] === cur.id);
  // The page index belongs to one document; switching documents starts again at its first page.
  const pi = pageSel.doc === cur.id ? pageSel.i : 0;
  const setPi = i => setPageSel({ doc: cur.id, i });
  const pk = pgKeys[Math.min(pi, Math.max(0, pgKeys.length - 1))],
    pg = d.pages[pk];
  const exts = Object.entries(d.ev).filter(([, e]) => e.pg.split('.')[0] === cur.id);
  const pageHl = exts.filter(([, e]) => e.pg === pk).reduce((a, [, e]) => a.concat(e.hl), []);
  return (
    <div className="grid grid-cols-[minmax(0,370px)_minmax(0,1fr)] items-start gap-4 max-xl:grid-cols-1 in-[.dock]:grid-cols-1">
      <section className="min-w-0 overflow-hidden card">
        <div className="flex flex-col gap-2.5 border-b border-line p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">Library</h3>
            <span className="text-xs text-fg3">{d.docs.length} shown of 1,243 indexed</span>
          </div>
          <label className="flex h-8 items-center gap-2 rounded-ctl border border-line2 bg-inset px-2.5 text-fg3 focus-within:border-info">
            <Search size={14} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search documents"
              aria-label="Search documents"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-hidden placeholder:text-fg3"
            />
          </label>
          <div className="overflow-x-auto scrollbar-none">
            <Segmented
              id="srcf"
              size="sm"
              label="Document type"
              value={f}
              onChange={setF}
              options={types.map(([v, l]) => ({ v, l }))}
            />
          </div>
        </div>
        <ul>
          {docs.map(x => (
            <li key={x.id}>
              <button
                onClick={() => setSrcSel(x.id)}
                className={cn(
                  'grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-3 py-2.5 text-left transition-colors last:border-b-0',
                  x.id === cur.id ? 'bg-fg/[.07]' : 'hover:bg-fg/3'
                )}
              >
                <SrcIcon f={x.f} />
                <span className="min-w-0">
                  <b className="block truncate text-[13px] font-medium">{x.t}</b>
                  <span className="block truncate text-xs text-fg3">
                    {x.who}, {x.src}, {x.date}
                  </span>
                </span>
                <Badge>{x.cited} cited</Badge>
              </button>
            </li>
          ))}
        </ul>
        {docs.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-fg2">
            No documents match. Try another word or type.
          </div>
        )}
      </section>
      <section className="min-w-0 overflow-hidden card">
        <header className="flex flex-wrap items-center gap-3 border-b border-line/60 px-5 py-2.5">
          <SrcIcon f={cur.f} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13.5px] font-semibold">{cur.t}</h3>
            <span className="text-xs text-fg3">
              {cur.who}, {cur.src}, {cur.date}, {cur.pages}
            </span>
          </div>
          {pgKeys.length > 1 && (
            <Segmented
              id="pg"
              size="sm"
              label="Page"
              value={pi}
              onChange={setPi}
              options={pgKeys.map((k, i) => ({
                v: i,
                l: typeof d.pages[k].p === 'number' ? 'p.' + d.pages[k].p : d.pages[k].p
              }))}
            />
          )}
        </header>
        <div className="bg-inset p-[clamp(12px,3vw,28px)]">
          {pg ? (
            <DocPage doc={cur} pg={pg} hl={pageHl} lg />
          ) : (
            <Empty
              icon={FileText}
              title="No page preview"
              body="This source is indexed, but this concept has no page preview for it."
            />
          )}
        </div>
        <div className="border-t border-line p-4">
          <h4 className="mb-2.5 text-xs font-medium text-fg3">Figures taken from this source</h4>
          {exts.length ? (
            <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
              {exts.map(([k, e]) => (
                <button
                  key={k}
                  onClick={() => openEv(k)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-left text-[12.5px] transition-colors hover:border-gold/50"
                >
                  <span className="truncate text-fg2">{e.l}</span>
                  <b className="shrink-0 font-semibold">{e.v}</b>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-fg2">
              Used as qualitative evidence in the competitor matrix and the memo.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export function DeliveryView() {
  const { d, run, strike } = useA();
  const files = filesFor(run.plan, d),
    done = run.status === 'done';
  const audit = [
    ['00:00', `Run started by ${d.me.n}`, ''],
    ['00:06', 'Conflict check passed and information barrier opened', ''],
    [clk(run.plan.st.find(s => s.k === 'assay').b).slice(0, 5), 'Assayer passed 412 of 412 checks', 'gold'],
    [clk(run.plan.total - 2).slice(0, 5), `Reviewed by ${d.reviewer}`, 'pos'],
    [clk(run.plan.total).slice(0, 5), `Delivered to ${d.folder}`, 'pos']
  ];
  if (!done)
    return (
      <Empty
        icon={ShieldCheck}
        title="Not hallmarked yet"
        body={`The hallmark is struck after the Assay checks and the analyst sign-off, in about ${hm(run.plan.total - run.t)}.`}
      />
    );
  return (
    <div className="flex flex-col gap-4">
      <section className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-6 overflow-hidden rounded-ctl border border-gold/40 bg-linear-to-b from-gold/12 to-transparent p-6 max-lg:grid-cols-1">
        <div className="pointer-events-none absolute inset-0 animate-sheen bg-[linear-gradient(105deg,transparent_40%,hsl(var(--hi)/.07)_50%,transparent_60%)]" />
        <div className="relative grid h-[92px] w-[92px] place-items-center rounded-full border-[6px] border-gold/80 text-center">
          <div>
            <b className="block text-[22px] font-semibold leading-none tracking-[-.03em]">99.9%</b>
            <span className="text-[10.5px] text-fg3">traced</span>
          </div>
        </div>
        <div>
          <h2 className="text-[19px] font-semibold tracking-[-.02em]">Assayed and signed</h2>
          <p className="mt-1 max-w-[64ch] text-fg2">
            Delivered at {tzTime(d, run.deliveredAt)} {d.city} on 10 October 2026. Checked by a separate system and
            signed by {d.reviewer}. Three figures are labelled as analyst estimates.
          </p>
        </div>
        <Hallmark d={d} strike={strike} />
      </section>
      <dl className="grid grid-cols-4 overflow-hidden card max-md:grid-cols-2">
        {[
          ['Integrity checks passed', '412 of 412'],
          ['Figures traced to source', '3,184 of 3,187'],
          ['Claims challenged by the red team', '7, of which 2 rewritten'],
          ['Analyst review time', '18 minutes']
        ].map(([l, v], i) => (
          <div key={l} className={cn('border-line px-4 py-3', i < 3 && 'border-r', 'max-md:border-b')}>
            <dt className="text-xs text-fg3">{l}</dt>
            <dd className="mt-1 text-[18px] font-semibold tracking-[-.02em]">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start gap-4 max-xl:grid-cols-1">
        <Panel title="Files" sub={`In ${d.folder}`} pad={false}>
          {files.map(([e, n, meta, size]) => (
            <div key={n} className="flex items-center gap-3 border-b border-line/60 px-5 py-2.5 last:border-b-0">
              <FileIcon kind={e} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13px] font-medium">{n}</b>
                <span className="text-xs text-fg3">{meta}</span>
              </span>
              <span className="text-xs text-fg3 max-md:hidden">{size}</span>
              <Badge tone="pos" dot>
                In the data room
              </Badge>
            </div>
          ))}
        </Panel>
        <Panel title="Audit trail" pad={false}>
          <ol className="px-4 py-2">
            {audit.map(([t, x, k]) => (
              <li key={x} className="grid grid-cols-[52px_12px_minmax(0,1fr)] items-start gap-2.5 py-2 text-[13px]">
                <time className="pt-px text-xs text-fg3">{t}</time>
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 rounded-full',
                    k === 'gold' ? 'bg-gold' : k === 'pos' ? 'bg-pos' : 'bg-fg3'
                  )}
                />
                <span className="text-fg2">{x}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}

export function EngagementsView() {
  const { d, run, go } = useA();
  const runPct = Math.round((run.t / run.plan.total) * 100);
  const [f, setF] = React.useState('all'),
    [q, setQ] = React.useState(''),
    [sorting, setSorting] = React.useState([]);
  const all = React.useMemo(
    () =>
      d.engagements.map(e =>
        e.k === 'main'
          ? {
              main: true,
              n: d.project,
              t: d.target,
              ty: d.type,
              s: run.status === 'done' ? 'ok' : 'run',
              p: runPct,
              o: d.me.n,
              u: run.status === 'done' ? '23m ago' : 'Just now'
            }
          : { ...e, u: /m$/.test(e.u) ? e.u + ' ago' : e.u === 'just now' ? 'Just now' : e.u }
      ),
    [d, run.status, runPct]
  );
  const data = all
    .filter(e => f === 'all' || e.s === f)
    .filter(e => (e.n + e.t + e.ty).toLowerCase().includes(q.toLowerCase()));
  const cnt = s => all.filter(x => s === 'all' || x.s === s).length;
  const cols = React.useMemo(
    () => [
      {
        id: 'n',
        accessorKey: 'n',
        header: 'Engagement',
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <CoLogo text={initials(row.original.t)} tg={row.original.main} />
            <span className="flex min-w-0 flex-col leading-tight">
              <b className="truncate font-medium">{row.original.n}</b>
              <span className="truncate text-xs text-fg3">{row.original.t}</span>
            </span>
          </div>
        )
      },
      { id: 'ty', accessorKey: 'ty', header: 'Type', cell: i => <span className="text-fg2">{i.getValue()}</span> },
      { id: 's', accessorKey: 's', header: 'Status', cell: i => <Status s={i.getValue()} /> },
      {
        id: 'p',
        accessorKey: 'p',
        header: 'Progress',
        cell: ({ row }) =>
          row.original.s === 'run' ? (
            <div className="flex w-[150px] items-center gap-2">
              <Progress value={(row.original.p || 0) / 100} />
              <span className="w-8 text-xs text-fg3">{row.original.p}%</span>
            </div>
          ) : row.original.s === 'ok' ? (
            <Badge tone="gold">Hallmark 999</Badge>
          ) : (
            <span className="text-fg3">—</span>
          )
      },
      {
        id: 'o',
        accessorKey: 'o',
        header: 'Owner',
        cell: i => (
          <span className="flex items-center gap-2">
            <Av n={i.getValue()} ring={false} />
            <span className="text-fg2">{i.getValue()}</span>
          </span>
        )
      },
      {
        id: 'u',
        accessorKey: 'u',
        header: 'Updated',
        cell: i => <span className="text-fg3">{i.getValue()}</span>,
        enableSorting: false
      }
    ],
    []
  );
  const table = useReactTable({
    data,
    columns: cols,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });
  return (
    <div className="px-7 pb-14 pt-2 max-lg:px-4">
      <PageHead
        title="Engagements"
        sub={`${d.org} has ${all.length} engagements. All are fictional.`}
        right={
          <Button variant="primary" className="rounded-full lg:hidden" onClick={() => go('home')}>
            <Plus size={14} />
            New engagement
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented
          id="ef"
          label="Filter by status"
          value={f}
          onChange={setF}
          options={[
            { v: 'all', l: `All ${cnt('all')}` },
            { v: 'run', l: `Running ${cnt('run')}` },
            { v: 'rev', l: `In review ${cnt('rev')}` },
            { v: 'ok', l: `Delivered ${cnt('ok')}` }
          ]}
        />
        <label className="ml-auto flex h-8 w-[260px] max-w-full items-center gap-2 rounded-ctl border border-line2 bg-inset px-2.5 text-fg3 focus-within:border-info">
          <Search size={14} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Filter by name or company"
            aria-label="Filter engagements"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-hidden placeholder:text-fg3"
          />
        </label>
      </div>
      <div className="overflow-x-auto card">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[13px]">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => {
                  const s = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      className={cn(
                        'h-9 border-b border-line/60 px-5 text-left text-xs font-medium',
                        s ? 'text-fg' : 'text-fg3'
                      )}
                    >
                      {h.column.getCanSort() ? (
                        <button
                          onClick={h.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-fg"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {s === 'desc' ? <ArrowDown size={11} /> : s === 'asc' ? <ArrowUp size={11} /> : null}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(r => (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() =>
                  r.original.main
                    ? go('engagement', 'run')
                    : toast(`${r.original.n} opens in the full product`, {
                        description: `In this concept only ${d.project} is built out.`
                      })
                }
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.click();
                }}
                className="cursor-pointer transition-colors hover:bg-fg/3"
              >
                {r.getVisibleCells().map(c => (
                  <td key={c.id} className="h-12 whitespace-nowrap border-b border-line/60 px-5">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="px-4 py-10 text-center text-[13px] text-fg2">
            No engagements match. Clear the filter or try another name.
          </div>
        )}
      </div>
    </div>
  );
}

export function PlatformView() {
  const [range, setRange] = React.useState(52),
    [live, setLive] = React.useState(18342);
  React.useEffect(() => {
    const id = setInterval(() => setLive(v => v + 1 + Math.floor(Math.random() * 3)), 1200);
    return () => clearInterval(id);
  }, []);
  const r = rng(42);
  const weeks = Array.from({ length: 52 }, (_, i) => 58000 + i * 780 + Math.sin(i / 3) * 1800 + (r() - 0.5) * 2600);
  const wl = Array.from({ length: 52 }, (_, i) =>
    new Date(2025, 9, 13 + i * 7).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  );
  const cost = [312, 286, 259, 238, 215, 196, 179, 164],
    ql = ['Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26', 'Q2 26', 'Q3 26'];
  const sp = n => Array.from({ length: 16 }, (_, i) => n * (0.8 + i * 0.014) + (r() - 0.5) * n * 0.03);
  const K = [
    ['Revenue run-rate', 8.2, { minimumFractionDigits: 1 }, '$', 'bn', '+38% on last year', sp(100), 'gold'],
    ['Deliverables, last 30 days', 342, F.m0, '', 'k', '+41% on last year', sp(80)],
    ['Client teams', 11400, F.m0, '', '', '2,180 added this year', sp(60)],
    ['Gross margin', 0.814, F.pct, '', '', '+4.2pp on last year', sp(50), 'pos'],
    ['Net revenue retention', 1.43, { style: 'percent' }, '', '', 'Trailing 12 months', sp(40)],
    ['Median turnaround, minutes', 161, F.m0, '', '', '19 minutes faster', sp(30).reverse()]
  ];
  const mix = [
    ['Financial models', 31],
    ['Trading comps', 18],
    ['Company analysis', 16],
    ['Competitor matrices', 12],
    ['Memos and pitch pages', 12],
    ['Market sizing', 11]
  ];
  const desks = [
    ['London', 'Europe/London', 6840, '2h 38m', '99.95%', 412],
    ['New York', 'America/New_York', 9120, '2h 44m', '99.93%', 538],
    ['Bengaluru', 'Asia/Kolkata', 4310, '2h 36m', '99.94%', 306]
  ];
  return (
    <div className="px-7 pb-14 pt-2 max-lg:px-4">
      <PageHead
        title="Platform"
        sub="Vult across every client. Figures are illustrative for a concept company."
        right={
          <>
            <Badge tone="pos" dot pulse>
              <Num value={live} fmt={F.m0} /> deliverables today
            </Badge>
            <Segmented
              id="rng"
              label="Range"
              value={range}
              onChange={setRange}
              options={[
                { v: 13, l: 'Quarter' },
                { v: 26, l: 'Half year' },
                { v: 52, l: 'Year' }
              ]}
            />
          </>
        }
      />
      <dl className="grid grid-cols-6 gap-2.5 max-2xl:grid-cols-3 max-md:grid-cols-2">
        {K.map(([l, v, f, pre, suf, dl, s, t]) => (
          <div key={l} className="flex min-w-0 flex-col card px-3.5 pb-2 pt-3">
            <dt className="truncate text-xs text-fg3">{l}</dt>
            <dd className="mt-1 text-[22px] font-semibold tracking-[-.03em]">
              <Num value={v} fmt={f} prefix={pre} suffix={suf} />
            </dd>
            <span className="text-[11.5px] font-medium text-pos">{dl}</span>
            <div className="mt-1.5 -mx-1">
              <Spark data={s} w={170} h={28} tone={t || 'fg3'} />
            </div>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4 max-xl:grid-cols-1">
        <Panel title="Deliverables per week" sub="All desks">
          <AreaTrend
            data={weeks.slice(52 - range)}
            labels={wl.slice(52 - range)}
            unitLabel="Deliverables"
            fmt={(v, ax) => (ax ? (v ? Math.round(v / 1000) + 'k' : '0') : nf0.format(Math.round(v)))}
          />
        </Panel>
        <Panel title="Cost to serve one deliverable" right={<Badge tone="pos">47% lower in two years</Badge>}>
          <AreaTrend data={cost} labels={ql} tone="info" unitLabel="Cost" fmt={v => '$' + Math.round(v)} />
        </Panel>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        <Panel title="What clients ask for" sub="Share of deliverables">
          {mix.map(([n, v]) => (
            <div key={n} className="grid grid-cols-[170px_minmax(0,1fr)_40px] items-center gap-3 py-1.5 text-[13px]">
              <span>{n}</span>
              <span className="h-2 overflow-hidden rounded-full bg-fg/6">
                <i className="block h-full rounded-full bg-fg2/70" style={{ width: `${(v / 31) * 100}%` }} />
              </span>
              <span className="text-right text-xs text-fg2">{v}%</span>
            </div>
          ))}
        </Panel>
        <Panel title="Review desks" sub="Sign-off follows the sun" pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-separate border-spacing-0 text-[13px]">
              <thead>
                <tr className="text-xs text-fg3">
                  {['Desk', 'Local time', 'Runs today', 'Median', 'Traced', 'Reviewers'].map((h, i) => (
                    <th
                      key={h}
                      className={cn('h-9 border-b border-line/60 px-5 font-medium', i ? 'text-right' : 'text-left')}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {desks.map(([n, tz, runs, med, fine, rv]) => (
                  <tr key={n}>
                    <td className="h-11 border-b border-line/60 px-5">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-pos" />
                        <b className="font-medium">{n}</b>
                      </span>
                    </td>
                    <td className="border-b border-line/60 px-5 text-right text-fg2">{tzTime({ tz }, new Date())}</td>
                    <td className="border-b border-line/60 px-5 text-right">{nf0.format(runs)}</td>
                    <td className="border-b border-line/60 px-5 text-right">{med}</td>
                    <td className="border-b border-line/60 px-5 text-right">{fine}</td>
                    <td className="border-b border-line/60 px-5 text-right">{rv}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <SecHead title="Why the business compounds" right={<span className="text-xs text-fg3">Illustrative</span>} />
      <div className="grid grid-cols-4 overflow-hidden card max-xl:grid-cols-2 max-md:grid-cols-1">
        {[
          [
            '$720k',
            'It is paid from the analyst budget',
            'Average yearly spend per client team. Vult sells finished work, so it competes with headcount and outsourcing, not software seats.'
          ],
          [
            '9×',
            'Speed creates new demand',
            'Teams run nine times more analyses after six months. Most of that work would never have been commissioned at two weeks each.'
          ],
          [
            '−47%',
            'Each run makes the next cheaper',
            'Verified public data is reused across clients. Client data stays walled off and never trains shared models.'
          ],
          [
            '1.8%',
            'House style keeps clients',
            'Yearly logo churn. After a few months the output looks like the client\u2019s own team built it.'
          ]
        ].map(([b, h, p], i) => (
          <div
            key={h}
            className={cn(
              'flex flex-col gap-1.5 border-line p-4',
              i < 3 && 'border-r max-xl:nth-2:border-r-0',
              'max-xl:border-b'
            )}
          >
            <b className="text-[24px] font-semibold tracking-[-.03em]">{b}</b>
            <h4 className="text-[13px] font-semibold">{h}</h4>
            <p className="text-[12.5px] text-fg2">{p}</p>
          </div>
        ))}
      </div>
      <SecHead
        title="Unit economics of a full diligence pack"
        right={<span className="text-xs text-fg3">Illustrative estimates</span>}
      />
      <div className="overflow-x-auto card">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left text-xs text-fg3">
              <th className="h-9 border-b border-line/60 px-5 font-medium" />
              <th className="border-b border-line/60 px-5 font-medium">In-house team</th>
              <th className="border-b border-line/60 px-5 font-medium">Outsourced research</th>
              <th className="border-b border-line bg-gold/[.07] px-4 font-medium text-gold">Vult</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Elapsed time', '8 to 12 working days', '4 to 7 working days', 'Same day (target)'],
              ['People time', '120 to 160 hours', '60 to 100 hours plus review', 'Analyst review of flagged items'],
              ['Cost to the client', '$32k to $50k, loaded', '$10k to $19k', '$8,200'],
              ['Cost to serve', '—', '—', 'Not yet measured'],
              ['Source trail', 'Partial, in analysts\u2019 notes', 'Varies by vendor', 'Every figure, one click away']
            ].map(rw => (
              <tr key={rw[0]}>
                <td className="h-11 border-b border-line/60 px-5 font-medium">{rw[0]}</td>
                <td className="border-b border-line/60 px-5 text-fg2">{rw[1]}</td>
                <td className="border-b border-line/60 px-5 text-fg2">{rw[2]}</td>
                <td className="border-b border-line bg-gold/[.07] px-4 font-semibold">{rw[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
