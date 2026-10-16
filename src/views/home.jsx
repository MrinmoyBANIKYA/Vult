import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Paperclip,
  Layers,
  Zap,
  Database,
  Globe,
  Briefcase,
  Presentation,
  ShieldCheck,
  LayoutGrid,
  Tag,
  FileText,
  CalendarClock,
  Check,
  X,
  Clock,
  ArrowUpRight,
  Bot,
  TrendingUp,
  TrendingDown,
  Play,
  Sparkles,
  Gauge,
  Bell,
  ChevronRight,
  Crown
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Badge,
  Kbd,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Checkbox,
  Segmented,
  Progress,
  Switch,
  Tip
} from '../components/ui.jsx';
import { Mark, CoLogo, Panel, PageHead, SecHead, Num } from '../components/shared.jsx';
import { Spark, AreaTrend } from '../components/charts.jsx';
import { DELIV, ALL, TEMPLATES, planFor, hm, money, tzTime, tzHour, initials, rng, nf0 } from '../lib/engine.js';
import { cn } from '../lib/utils.js';
import { useA, useNow } from '../lib/context.js';
import { F } from '../lib/format.js';
import { KMOD } from '../lib/keys.js';

const TPL_ICON = [Briefcase, Presentation, ShieldCheck, LayoutGrid];
const TPL_TONE = [
  'bg-gold/[.14] text-gold',
  'bg-presence/[.14] text-presence',
  'bg-pos/13 text-pos',
  'bg-warn/13 text-warn'
];
const BRIEF_ICON = { price: Tag, filing: FileText, earnings: CalendarClock };
const stageOf = p =>
  p >= 100
    ? 'Delivered'
    : p > 93
      ? 'Analyst sign-off'
      : p > 80
        ? 'Assay checks'
        : p > 62
          ? 'Writing'
          : p > 31
            ? 'Modelling'
            : p > 17
              ? 'Extracting'
              : 'Ingesting';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* hours returned to the deal team, by period, ending on the latest figure */
function useHours(ws) {
  return React.useMemo(() => {
    const r = rng(ws === 'uk' ? 21 : 33),
      k = ws === 'uk' ? 1 : 1.18,
      now = new Date(2026, 9, 11);
    const mk = (n, end, start, noise, lab) => {
      const v = Array.from({ length: n }, (_, i) => {
        const t = i / (n - 1);
        return start + (end - start) * Math.pow(t, 1.35) + (i < n - 1 ? (r() - 0.5) * noise : 0);
      });
      v[n - 1] = end;
      return { v: v.map(x => Math.round(x)), l: Array.from({ length: n }, (_, i) => lab(n - 1 - i)) };
    };
    const day = i => {
      const x = new Date(now);
      x.setDate(x.getDate() - i);
      return x.getDate() + ' ' + MON[x.getMonth()];
    };
    const week = i => {
      const x = new Date(now);
      x.setDate(x.getDate() - i * 7);
      return x.getDate() + ' ' + MON[x.getMonth()];
    };
    const month = i => {
      const x = new Date(2026, 9 - i, 1);
      return MON[x.getMonth()] + (x.getMonth() === 0 || i === 11 ? ' ' + String(x.getFullYear()).slice(2) : '');
    };
    const D = mk(14, Math.round(88 * k), 52 * k, 30, day),
      W = mk(12, Math.round(468 * k), 300 * k, 60, week),
      M = mk(12, Math.round(1940 * k), 760 * k, 150, month),
      Y = mk(5, Math.round(16820 * k), 1400 * k, 0, i => String(2026 - i));
    return {
      D: { ...D, cap: 'today', vs: 'yesterday' },
      W: { ...W, cap: 'this week', vs: 'last week' },
      M: { ...M, cap: 'in October', vs: 'September' },
      Y: { ...Y, cap: 'so far in 2026', vs: '2025' }
    };
  }, [ws]);
}

export function Home() {
  const {
    d,
    ws,
    sel,
    setSel,
    priority,
    setPriority,
    prompt,
    setPrompt,
    startNew,
    go,
    run,
    composerRef,
    auto,
    dismissed,
    dismissBrief,
    approvals
  } = useA();
  React.useEffect(() => {
    const el = composerRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, [prompt, composerRef]);
  const now = useNow(30000);
  const plan = React.useMemo(() => planFor(sel, ws, priority), [sel, ws, priority]);
  const h = tzHour(d),
    greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const ready = tzTime(d, new Date(now + plan.total * 60000));
  const runP = run.t / run.plan.total;
  const live = [
    {
      main: true,
      n: d.project,
      t: d.target,
      ty: d.type,
      s: run.status === 'done' ? 'ok' : 'run',
      p: runP * 100,
      o: d.me.n
    },
    ...d.engagements.filter(e => e.s === 'run')
  ];
  const brief = auto.brief.filter(b => !dismissed.includes(b.id));
  const H = useHours(ws);
  const [per, setPer] = React.useState('M');
  const S = H[per],
    last = S.v[S.v.length - 1],
    prev = S.v[S.v.length - 2],
    chg = last / prev - 1;
  const rate = ws === 'uk' ? 96 : 128;
  const focusBrief = () => {
    const el = composerRef.current;
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };
  return (
    <div className="px-7 pb-14 pt-2 max-lg:px-4">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className="text-[clamp(26px,2.6vw,34px)] font-bold leading-[1.1] tracking-[-.04em]">
              {greet}, {d.me.n}
            </h1>
            <p className="mt-1.5 text-[14px] text-fg2">
              {h < 12 ? 'Your agents worked through the night.' : 'Your agents kept working while you were away.'}{' '}
              {brief.length
                ? `${brief.length} ${brief.length === 1 ? 'thing has' : 'things have'} changed`
                : 'Nothing new has changed'}
              {approvals.length
                ? `, and ${approvals.length} ${approvals.length === 1 ? 'needs' : 'need'} your decision.`
                : '.'}
            </p>
          </div>
          {approvals.length > 0 && (
            <button
              onClick={() => go('autopilot')}
              className="group flex h-10 items-center gap-2.5 rounded-full border border-line/80 bg-raised/70 pl-1.5 pr-4 text-[13px] font-semibold transition-colors hover:border-gold/50"
            >
              <span className="grid h-7 min-w-7 place-items-center rounded-full bg-brand px-2 text-[12px] font-bold text-white">
                {approvals.length}
              </span>
              Waiting for your decision
              <ArrowUpRight
                size={15}
                className="text-fg3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-fg"
              />
            </button>
          )}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(320px,372px)] items-start gap-5 max-xl:grid-cols-1">
          <div className="flex min-w-0 flex-col gap-5">
            {/* hero chart */}
            <section className="card relative overflow-hidden rounded-[24px]!">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold/50 to-transparent" />
              <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-5">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/[.14] text-gold">
                      <Clock size={17} />
                    </span>
                    <span className="flex flex-col leading-tight">
                      <b className="text-[14px] font-semibold">Analyst hours returned</b>
                      <span className="text-xs text-fg3">{d.org}, all deal teams</span>
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[clamp(30px,3.4vw,42px)] font-bold leading-none tracking-[-.045em]">
                      <Num value={last} fmt={F.m0} />
                      <span className="ml-1.5 text-[17px] font-semibold tracking-normal text-fg3">hours</span>
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-bold',
                        chg >= 0 ? 'bg-lime/[.14] text-lime' : 'bg-neg/[.14] text-neg'
                      )}
                    >
                      {chg >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      <Num value={chg} fmt={F.pctS} />
                    </span>
                    <span className="text-[13px] text-fg3">
                      {S.cap}, against {S.vs}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[13px] text-fg2">
                    Worth about <b className="font-semibold text-fg">{money(d, last * rate)}</b> of analyst time at{' '}
                    {d.cur}
                    {rate} an hour
                  </div>
                </div>
                <Segmented
                  id="per"
                  label="Period"
                  value={per}
                  onChange={setPer}
                  options={[
                    { v: 'D', l: 'D' },
                    { v: 'W', l: 'W' },
                    { v: 'M', l: 'M' },
                    { v: 'Y', l: 'Y' }
                  ]}
                />
              </div>
              <div className="px-3 pb-3 pt-2">
                <AreaTrend
                  key={per + ws}
                  data={S.v}
                  labels={S.l}
                  height={260}
                  unitLabel="Hours returned"
                  delta
                  zeroBase={false}
                  endMark={nf0.format(last) + ' h'}
                  fmt={(v, ax) =>
                    ax
                      ? v >= 1000
                        ? Math.round(v / 100) / 10 + 'k'
                        : String(Math.round(v))
                      : nf0.format(Math.round(v)) + ' h'
                  }
                />
              </div>
            </section>

            {/* composer */}
            <form
              onSubmit={e => {
                e.preventDefault();
                if (plan.n) startNew();
              }}
              className="card relative overflow-hidden rounded-[24px]! transition-[border-color,box-shadow] focus-within:border-gold/45 focus-within:shadow-[0_0_0_4px_hsl(var(--gold)/.12)]"
            >
              <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-accent2/20 blur-3xl" />
              <div className="relative flex items-center gap-2.5 px-5 pt-4">
                <Mark size={26} tile />
                <b className="whitespace-nowrap text-[14px] font-semibold">New engagement</b>
                <span className="truncate text-xs text-fg3 max-sm:hidden">
                  Describe the work. Vult plans, builds and checks it.
                </span>
              </div>
              <label htmlFor="brief" className="sr-only">
                Brief
              </label>
              <textarea
                id="brief"
                ref={composerRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={3}
                placeholder="Describe the work. Name the company, the deliverables and the format."
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    if (plan.n) startNew();
                  }
                }}
                className="relative block max-h-[260px] min-h-[84px] w-full resize-none bg-transparent px-5 pb-2 pt-3 text-[15.5px] leading-relaxed text-fg outline-hidden placeholder:text-fg3"
              />
              <div className="relative flex flex-wrap gap-1.5 px-5 pb-3.5">
                <span className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-fg/4 pl-1 pr-3 text-[12.5px]">
                  <CoLogo text={d.mono} tg size={24} className="rounded-full" />
                  <b className="font-semibold">{d.target}</b>
                  <span className="text-fg3">{d.ticker}</span>
                </span>
                {[
                  [Database, d.vdr],
                  [Layers, d.style],
                  [Globe, `${d.gaap}, ${d.unit}`]
                ].map(([I, t]) => (
                  <span
                    key={t}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-fg/4 px-3 text-[12.5px] text-fg2"
                  >
                    <I size={13} className="text-fg3" />
                    {t}
                  </span>
                ))}
              </div>
              <div className="relative flex flex-wrap items-center gap-2 border-t border-line/70 bg-fg/1.5 px-3.5 py-3">
                <Tip label="Attach files">
                  <Button variant="ghost" size="icon" aria-label="Attach files">
                    <Paperclip size={16} />
                  </Button>
                </Tip>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="rounded-full">
                      <Layers size={14} />
                      {plan.n} deliverable{plan.n === 1 ? '' : 's'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" side="top" className="w-[320px]">
                    <div className="flex items-center justify-between px-2 pb-1 pt-1">
                      <span className="text-xs font-medium text-fg3">Deliverables</span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setSel(new Set(sel.size === ALL.length ? [] : ALL))}
                      >
                        {sel.size === ALL.length ? 'Clear all' : 'Select all'}
                      </Button>
                    </div>
                    {DELIV.map(x => (
                      <label
                        key={x.k}
                        htmlFor={'dl-' + x.k}
                        className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-[13px] hover:bg-fg/5"
                      >
                        <Checkbox
                          id={'dl-' + x.k}
                          checked={sel.has(x.k)}
                          onCheckedChange={v => {
                            const n = new Set(sel);
                            v ? n.add(x.k) : n.delete(x.k);
                            setSel(n);
                          }}
                        />
                        <span className="flex-1">{x.n}</span>
                        <span className="text-xs text-fg3">{money(d, x[ws === 'uk' ? 'gbp' : 'usd'])}</span>
                      </label>
                    ))}
                    {plan.packed && (
                      <div className="px-2 pb-1 pt-1.5 text-xs font-semibold text-pos">Full-pack price applied</div>
                    )}
                  </PopoverContent>
                </Popover>
                <Segmented
                  id="svc"
                  label="Service level"
                  value={priority ? 'p' : 's'}
                  onChange={v => setPriority(v === 'p')}
                  options={[
                    { v: 's', l: 'Standard' },
                    { v: 'p', l: 'Priority', i: Zap }
                  ]}
                />
                <div className="ml-auto flex items-center gap-3 whitespace-nowrap text-[12.5px] text-fg2">
                  <span className="max-md:hidden">
                    Ready by <b className="font-semibold text-fg">{ready}</b>
                  </span>
                  <b className="font-semibold text-fg">{plan.n ? money(d, plan.price) : '—'}</b>
                  <Button type="submit" variant="primary" size="lg" className="rounded-full px-5" disabled={!plan.n}>
                    Run<span className="ml-0.5 text-[11px] opacity-70">{KMOD}↵</span>
                  </Button>
                </div>
              </div>
            </form>
            <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
              {TEMPLATES.map((t, i) => {
                const I = TPL_ICON[i];
                return (
                  <button
                    key={t.n}
                    type="button"
                    onClick={() => {
                      setSel(new Set(t.sel));
                      setPrompt(t.p(d));
                      focusBrief();
                    }}
                    className="card group flex flex-col gap-0.5 rounded-[18px]! p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-line2"
                  >
                    <span className={cn('mb-2 grid h-9 w-9 place-items-center rounded-full', TPL_TONE[i])}>
                      <I size={16} />
                    </span>
                    <b className="text-[13px] font-semibold">{t.n}</b>
                    <span className="text-xs text-fg3">{t.d}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 items-start gap-5 max-2xl:grid-cols-1">
              <Panel
                title="While you were away"
                right={
                  <Button variant="ghost" size="sm" onClick={() => go('autopilot')}>
                    See all
                    <ArrowUpRight size={13} />
                  </Button>
                }
                pad={false}
              >
                <div className="px-2 pb-2">
                  <AnimatePresence initial={false}>
                    {brief.map(b => {
                      const I = BRIEF_ICON[b.kind];
                      return (
                        <motion.article
                          layout
                          key={b.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22 }}
                          className="group grid grid-cols-[42px_minmax(0,1fr)] gap-3 overflow-hidden rounded-[16px] px-3 py-3 transition-colors hover:bg-fg/[.035]"
                        >
                          <span
                            className={cn(
                              'grid h-[42px] w-[42px] place-items-center rounded-full',
                              b.tone === 'warn'
                                ? 'bg-warn/13 text-warn'
                                : b.tone === 'gold'
                                  ? 'bg-gold/[.14] text-gold'
                                  : 'bg-info/13 text-info'
                            )}
                          >
                            <I size={18} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="text-[13.5px] font-semibold leading-snug">{b.title}</h3>
                              <span className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-fg2">
                                {b.impact}
                              </span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg3">
                              <span className="font-medium text-fg2">{b.agent}</span>
                              <span>{b.when}</span>
                            </div>
                            <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg2">{b.body}</p>
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant="light"
                                className="rounded-full"
                                onClick={() => go(b.act[1], b.act[2])}
                              >
                                {b.act[0]}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-full"
                                onClick={() => dismissBrief(b.id)}
                              >
                                Dismiss
                              </Button>
                            </div>
                          </div>
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>
                  {brief.length === 0 && (
                    <div className="m-3 rounded-[16px] border border-dashed border-line2 px-4 py-6 text-center text-[13px] text-fg2">
                      You are up to date. New findings from your agents will appear here.
                    </div>
                  )}
                </div>
              </Panel>
              <Panel
                title="Running now"
                right={
                  <Button variant="ghost" size="sm" onClick={() => go('engagements')}>
                    All engagements
                    <ArrowUpRight size={13} />
                  </Button>
                }
                pad={false}
              >
                <div className="px-2 pb-2">
                  {live.map(e => {
                    const p = e.p || 0,
                      done = e.s === 'ok',
                      open = () => (e.main ? go('engagement', 'run') : go('engagements'));
                    return (
                      <div
                        key={e.n}
                        role="button"
                        tabIndex={0}
                        onClick={open}
                        onKeyDown={ev => {
                          if (ev.key === 'Enter') open();
                        }}
                        className="grid cursor-pointer grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] px-3 py-3 transition-colors hover:bg-fg/[.035]"
                      >
                        <CoLogo text={initials(e.t)} tg={e.main} size={42} className="rounded-full" />
                        <span className="flex min-w-0 flex-col gap-1.5">
                          <span className="flex min-w-0 items-baseline justify-between gap-2">
                            <b className="truncate text-[13.5px] font-semibold">{e.n}</b>
                            <span className="shrink-0 text-xs text-fg3">
                              {done ? 'Delivered and hallmarked' : stageOf(p)}
                            </span>
                          </span>
                          <Progress value={p / 100} tone={done ? 'pos' : 'gold'} />
                        </span>
                        <span className="w-[74px] text-right text-[12.5px] font-semibold">
                          {done ? (
                            <span className="text-pos">Delivered</span>
                          ) : (
                            <span className="text-fg2">{hm(((100 - p) / 100) * 161)} left</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>
          </div>

          {/* right column */}
          <aside className="flex min-w-0 flex-col gap-5">
            <section className="card relative overflow-hidden rounded-[24px]! p-5">
              <div className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-gold/15 blur-3xl" />
              <div className="relative flex items-center justify-between">
                <span className="text-[13px] font-semibold text-fg2">Analyst cost avoided</span>
                <Badge tone="outline">Year to date</Badge>
              </div>
              <div className="relative mt-3 flex items-baseline gap-2.5">
                <span className="text-[34px] font-bold leading-none tracking-[-.045em]">
                  {d.cur}
                  <Num value={ws === 'uk' ? 1.62 : 2.14} fmt={F.m2} />m
                </span>
                <span className="rounded-full bg-lime/[.14] px-2 py-0.5 text-[12px] font-bold text-lime">
                  +{ws === 'uk' ? '31.8' : '27.4'}%
                </span>
              </div>
              <div className="relative mt-1 text-xs text-fg3">Against the same period last year</div>
              <div className="relative mt-4 rounded-[18px] border border-line/80 bg-inset/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-fg3">Your next run</span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-fg2">
                    <CoLogo text={d.mono} tg size={20} className="rounded-full" />
                    {d.short}
                  </span>
                </div>
                <dl className="grid grid-cols-3 gap-3">
                  {[
                    ['Ready by', plan.n ? ready : '—'],
                    ['Turnaround', plan.n ? hm(plan.total) : '—'],
                    ['Fixed fee', plan.n ? money(d, plan.price) : '—']
                  ].map(([l, v]) => (
                    <div key={l} className="min-w-0">
                      <dt className="text-[11.5px] text-fg3">{l}</dt>
                      <dd className="mt-0.5 truncate text-[15px] font-bold tracking-[-.02em]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="relative mt-4 grid grid-cols-2 gap-2.5">
                <Button variant="primary" size="lg" className="rounded-full" disabled={!plan.n} onClick={startNew}>
                  <Play size={15} />
                  Run engagement
                </Button>
                <Button variant="outline" size="lg" className="rounded-full" onClick={focusBrief}>
                  Edit the brief
                </Button>
              </div>
              <div className="relative mt-5 flex flex-col gap-2 text-xs text-fg2">
                <div className="flex justify-between">
                  <span>Deal Team plan</span>
                  <b className="font-semibold text-fg">18 of 25 packs used</b>
                </div>
                <Progress value={0.72} />
                <span className="text-fg3">Renews on 1 November</span>
              </div>
            </section>

            <Panel title="This month" right={<span className="text-xs text-fg3">{d.org}</span>} pad={false}>
              <dl className="px-2 pb-2">
                {[
                  ['Deliverables', 146, F.m0, M_SP(1), 'gold', '+22'],
                  ['Median turnaround, minutes', 158, F.m0, M_SP(2), 'fg3', '−14'],
                  [
                    'Figures traced to source',
                    0.9994,
                    { style: 'percent', minimumFractionDigits: 2 },
                    M_SP(3),
                    'pos',
                    '+0.02pp'
                  ]
                ].map(([l, v, f, sp, t, dl]) => (
                  <div key={l} className="flex items-center justify-between gap-3 rounded-[14px] px-3 py-2.5">
                    <div>
                      <dt className="text-[12.5px] text-fg2">{l}</dt>
                      <dd className="mt-0.5 flex items-baseline gap-2">
                        <span className="text-[19px] font-bold tracking-tight">
                          <Num value={v} fmt={f} />
                        </span>
                        <span className="text-[11.5px] font-semibold text-lime">{dl}</span>
                      </dd>
                    </div>
                    <Spark data={sp} w={96} h={34} tone={t} />
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel title="Vult suggests" icon={Sparkles} pad={false}>
              <div className="flex flex-col px-2 pb-2">
                {[
                  [
                    Gauge,
                    'Switch Kestrel to priority',
                    `Your IC meets on Thursday. Priority cuts the run to about ${hm(planFor(sel, ws, true).total)}.`,
                    () => setPriority(true)
                  ],
                  [
                    Bell,
                    'Add a price watch on two peers',
                    'Two peers report next week. An agent can refresh comps the morning they do.',
                    () => go('autopilot')
                  ],
                  [
                    FileText,
                    'Reuse your house style',
                    `${d.style} is applied to every new pack automatically.`,
                    () => go('engagement', 'deck')
                  ]
                ].map(([I, t, b, fn]) => (
                  <button
                    key={t}
                    onClick={fn}
                    className="group flex items-start gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-fg/[.035]"
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fg/6 text-fg2 transition-colors group-hover:bg-gold/[.14] group-hover:text-gold">
                      <I size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-[13px] font-semibold">{t}</b>
                      <span className="block text-xs leading-relaxed text-fg3">{b}</span>
                    </span>
                    <ChevronRight
                      size={15}
                      className="mt-1.5 shrink-0 text-fg3 transition-transform group-hover:translate-x-0.5"
                    />
                  </button>
                ))}
              </div>
            </Panel>

            <section
              className="relative overflow-hidden rounded-[24px] p-5 text-white shadow-[0_24px_60px_-28px_hsl(250_90%_50%/.8)]"
              style={{
                background: 'linear-gradient(135deg, hsl(258 88% 62%) 0%, hsl(232 86% 56%) 48%, hsl(205 96% 54%) 100%)'
              }}
            >
              <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full border-18 border-white/10" />
              <div className="pointer-events-none absolute -bottom-16 right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur-sm">
                <Crown size={12} />
                Vult Enterprise
              </span>
              <h3 className="relative mt-3 text-[19px] font-bold leading-snug tracking-[-.02em]">
                Unlimited packs, your own model deployment, audit export
              </h3>
              <p className="relative mt-1.5 text-[12.5px] text-white/80">
                Single sign-on, regional data residency in London and Virginia, and a named review desk.
              </p>
              <button
                onClick={() =>
                  toast('Our team will be in touch', {
                    description: 'A Vult partner will email you within one working day.'
                  })
                }
                className="relative mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-bold text-[hsl(240_60%_30%)] shadow-[0_8px_20px_-8px_hsl(0_0%_0%/.4)] transition-transform hover:-translate-y-px"
              >
                Talk to us
                <ArrowUpRight size={15} />
              </button>
            </section>
            <p className="px-1 text-[11.5px] leading-snug text-fg3">
              Concept product. Every company, client and figure here is fictional.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
const M_SP = seed => {
  const r = rng(seed * 13);
  let v = 40;
  return Array.from({ length: 16 }, (_, i) => (v += (r() - 0.35) * 6 + (seed === 2 ? -0.6 : 0.4)));
};

export function Autopilot() {
  const { auto, approvals, decide, monitors, toggleMonitor } = useA();
  const S = auto.stats;
  return (
    <div className="px-7 pb-14 pt-2 max-lg:px-4">
      <PageHead
        title="Autopilot"
        sub="Agents that watch your coverage around the clock. You only step in to approve."
        right={
          <Badge tone="pos" dot pulse>
            {monitors.filter(m => m.on).length} of {monitors.length} always-on agents running
          </Badge>
        }
      />
      <dl className="mb-6 grid grid-cols-4 overflow-hidden card max-lg:grid-cols-2">
        {[
          ['Agent hours this week', <Num value={S.agentHours} fmt={F.m0} />],
          ['Your team’s time this week', `${Math.floor(S.humanMin / 60)}h ${S.humanMin % 60}m`],
          ['Waiting for a decision', <Num value={approvals.length} fmt={F.m0} />],
          ['Analyst cost avoided', S.saved]
        ].map(([l, v], i) => (
          <div
            key={l}
            className={cn(
              'border-line px-4 py-3.5',
              i < 3 && 'border-r max-lg:nth-2:border-r-0',
              i < 2 && 'max-lg:border-b'
            )}
          >
            <dt className="text-xs text-fg3">{l}</dt>
            <dd className="mt-1 text-[22px] font-semibold tracking-[-.03em]">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-start gap-5 max-xl:grid-cols-1">
        <div className="min-w-0">
          <SecHead
            className="mt-0"
            title="Needs your decision"
            right={<span className="text-xs text-fg3">Nothing is sent or changed until you approve</span>}
          />
          <div className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {approvals.map(a => (
                <motion.article
                  layout
                  key={a.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                  className="card"
                >
                  <div className="flex items-start gap-3 p-4 pb-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/[.14] text-gold">
                      <Bot size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-fg3">
                        <span className="font-medium text-fg2">{a.who}</span>
                        <span>{a.eng}</span>
                        <span>{a.age} ago</span>
                      </div>
                      <h3 className="mt-0.5 text-[14px] font-semibold leading-snug">{a.title}</h3>
                      <p className="mt-1 text-[13px] text-fg2">{a.why}</p>
                    </div>
                  </div>
                  <div className="mx-4 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 gap-y-1 rounded-[14px] bg-inset px-3.5 py-2.5 text-[12.5px]">
                    {a.diff.map(([l, x, y]) => (
                      <React.Fragment key={l}>
                        <span className="text-fg2">{l}</span>
                        <span className="text-fg3 line-through">{x}</span>
                        <span className="text-fg3">to</span>
                        <b className="font-semibold">{y}</b>
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 p-4 pt-3">
                    <Button variant="primary" className="rounded-full px-4" onClick={() => decide(a, true)}>
                      <Check size={14} />
                      Approve
                    </Button>
                    <Button variant="ghost" className="rounded-full" onClick={() => decide(a, false)}>
                      <X size={14} />
                      Decline
                    </Button>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
            {approvals.length === 0 && (
              <div className="flex flex-col items-center gap-1 rounded-panel border border-dashed border-line2 px-4 py-10 text-center">
                <Check size={20} className="mb-1 text-pos" />
                <b className="font-semibold">Nothing waiting</b>
                <span className="text-[13px] text-fg2">New decisions from your agents will appear here.</span>
              </div>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <SecHead className="mt-0 max-xl:mt-7" title="Overnight activity" />
          <ol className="relative card px-4 py-2">
            {auto.log.map(([t, a, x], i) => (
              <li key={i} className="grid grid-cols-[96px_14px_minmax(0,1fr)] items-start gap-2.5 py-2.5 text-[13px]">
                <time className="pt-px text-xs text-fg3">{t}</time>
                <span className="relative mt-1.5 h-2 w-2 rounded-full bg-gold/80 ring-4 ring-raised" />
                <span>
                  <b className="font-medium">{a}</b>
                  <span className="block text-fg2">{x}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <SecHead
        title="Agents on duty"
        right={<span className="text-xs text-fg3">Switch an agent off to pause it</span>}
      />
      <div className="overflow-x-auto card">
        <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left text-xs text-fg3">
              {['Agent', 'Watching', 'Runs when', 'Last run', 'Next', 'Runs to date', 'On'].map((h, i) => (
                <th key={h} className={cn('h-9 border-b border-line/60 px-5 font-medium', i === 5 && 'text-right')}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monitors.map(m => (
              <tr key={m.id} className={cn('transition-colors hover:bg-fg/3', !m.on && 'opacity-55')}>
                <td className="h-11 border-b border-line/60 px-5">
                  <span className="flex items-center gap-2.5">
                    <span className={cn('h-2 w-2 rounded-full', m.on ? 'bg-pos' : 'border-[1.5px] border-fg3')} />
                    <b className="font-medium">{m.n}</b>
                  </span>
                </td>
                <td className="border-b border-line/60 px-5 text-fg2">{m.scope}</td>
                <td className="border-b border-line/60 px-5 text-fg2">{m.trig}</td>
                <td className="border-b border-line/60 px-5 text-fg2">{m.last}</td>
                <td className="border-b border-line/60 px-5 text-fg2">{m.on ? m.next : 'Paused'}</td>
                <td className="border-b border-line/60 px-5 text-right">{m.runs.toLocaleString('en-GB')}</td>
                <td className="border-b border-line/60 px-5">
                  <Switch
                    label={'Turn ' + m.n + (m.on ? ' off' : ' on')}
                    checked={m.on}
                    onCheckedChange={v => toggleMonitor(m, v)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
