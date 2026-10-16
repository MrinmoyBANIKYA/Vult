import * as React from 'react';
import { ReactFlow, Handle, Position, BaseEdge, getBezierPath } from '@xyflow/react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import * as SliderP from '@radix-ui/react-slider';
import {
  Flag,
  Database,
  Sigma,
  ChartScatter,
  Globe,
  LayoutGrid,
  PenLine,
  ShieldCheck,
  UserRound,
  Send,
  RotateCcw,
  Pause,
  Play,
  Check
} from 'lucide-react';
import { Button, Badge, Segmented, Progress, Tip } from '../components/ui.jsx';
import { Av, Status, Num, Panel } from '../components/shared.jsx';
import { logLines, AG, clk, hm, tzTime, clamp01, nf0 } from '../lib/engine.js';
import { cn } from '../lib/utils.js';
import { useA, useMedia } from '../lib/context.js';
import { F } from '../lib/format.js';

const AG_ICON = {
  PLAN: Flag,
  INGEST: Database,
  EXTRACT: Database,
  NORM: Database,
  MODEL: Sigma,
  COMPS: ChartScatter,
  MARKET: Globe,
  COMPET: LayoutGrid,
  WRITE: PenLine,
  ASSAY: ShieldCheck,
  REVIEW: UserRound,
  DELIVER: Send
};
const NODES = [
  { k: 'plan', n: 'Planner', I: Flag, st: ['scope'], c: 0, r: 1.5, wait: 'Starting' },
  { k: 'ext', n: 'Extractor', I: Database, st: ['ingest', 'extract'], c: 1, r: 1.5, wait: 'Waiting for the plan' },
  {
    k: 'mod',
    n: 'Modeller',
    I: Sigma,
    st: ['model'],
    c: 2,
    r: 0,
    need: ['3s', 'dcf', 'lbo'],
    wait: 'Waiting for extraction'
  },
  { k: 'cmp', n: 'Comps', I: ChartScatter, st: ['an'], c: 2, r: 1, need: ['comps'], wait: 'Waiting for extraction' },
  { k: 'mkt', n: 'Market', I: Globe, st: ['an'], c: 2, r: 2, need: ['industry'], wait: 'Waiting for extraction' },
  {
    k: 'cpt',
    n: 'Competitors',
    I: LayoutGrid,
    st: ['an'],
    c: 2,
    r: 3,
    need: ['compet'],
    wait: 'Waiting for extraction'
  },
  { k: 'wri', n: 'Writer', I: PenLine, st: ['write'], c: 3, r: 1.5, wait: 'Waiting for the analysts' },
  { k: 'asy', n: 'Assayer', I: ShieldCheck, st: ['assay'], c: 4, r: 1.5, wait: 'Waiting for the Writer' },
  { k: 'rev', n: 'Sign-off', I: UserRound, st: ['review'], c: 5, r: 1.5, wait: 'Waiting for the Assayer', human: true }
];
const EDGES = [
  ['plan', 'ext'],
  ['ext', 'mod'],
  ['ext', 'cmp'],
  ['ext', 'mkt'],
  ['ext', 'cpt'],
  ['mod', 'wri'],
  ['cmp', 'wri'],
  ['mkt', 'wri'],
  ['cpt', 'wri'],
  ['wri', 'asy'],
  ['asy', 'rev']
];

function AgentNode({ data }) {
  const { n, I, st, pr, now, dur, human, reviewer } = data;
  return (
    <div
      className={cn(
        'relative h-[84px] w-[164px] rounded-[16px] border bg-raised px-3 pb-3 pt-2.5 shadow-[inset_0_1px_0_hsl(0_0%_100%/.04)] transition-[border-color,box-shadow,opacity] duration-300',
        st === 'run'
          ? 'border-gold/70 shadow-[0_0_0_4px_hsl(var(--gold)/.14),0_0_32px_-4px_hsl(var(--gold)/.45)]'
          : st === 'done'
            ? 'border-pos/35'
            : 'border-line2',
        st === 'idle' && 'opacity-60',
        st === 'skip' && 'border-dashed opacity-35'
      )}
    >
      <Handle type="target" position={Position.Left} className="h-1.5! w-1.5! min-w-0! border-0! bg-line2!" />
      <div className="flex items-center gap-2 whitespace-nowrap text-[13.5px] font-semibold">
        {human ? (
          <Av n={reviewer} size={18} ring={false} />
        ) : (
          <I size={14} className={st === 'run' ? 'text-gold' : st === 'done' ? 'text-pos' : 'text-fg3'} />
        )}
        {n}
        {st === 'done' && <Check size={12} className="ml-auto text-pos" strokeWidth={3} />}
      </div>
      <div className="mt-1 h-[17px] truncate text-[12.5px] text-fg2" title={now}>
        {now}
      </div>
      <div className="mt-0.5 flex items-center justify-between text-[11.5px] text-fg3">
        <span className={st === 'run' ? 'font-medium text-gold' : ''}>
          {st === 'skip'
            ? 'Not in this brief'
            : st === 'done'
              ? 'Done'
              : st === 'run'
                ? Math.round(pr * 100) + '%'
                : 'Queued'}
        </span>
        <span>{st === 'skip' ? '' : dur}</span>
      </div>
      {st !== 'skip' && (
        <div className="absolute inset-x-3 bottom-1.5">
          <Progress value={pr} tone={st === 'done' ? 'pos' : 'gold'} className="h-[3px]" />
        </div>
      )}
      <Handle type="source" position={Position.Right} className="h-1.5! w-1.5! min-w-0! border-0! bg-line2!" />
    </div>
  );
}
function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const s = data.s,
    rm = data.rm;
  const stroke = s === 'on' ? 'hsl(var(--gold))' : s === 'done' ? 'hsl(var(--pos) / .5)' : 'hsl(var(--line2))';
  const glow = s === 'on' ? 'drop-shadow(0 0 4px hsl(var(--gold) / .8))' : undefined;
  return (
    <g>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          filter: glow,
          strokeWidth: s === 'on' ? 2 : 1.4,
          strokeDasharray: s === 'skip' ? '2 4' : undefined,
          opacity: s === 'skip' ? 0.5 : 1
        }}
      />
      {s === 'on' &&
        !rm &&
        [0, 0.5].map(b => (
          <circle key={b} r={b ? 2 : 3} fill="hsl(var(--gold))" opacity={b ? 0.55 : 1}>
            <animateMotion dur="1.3s" begin={`-${b * 1.3}s`} repeatCount="indefinite" path={path} />
          </circle>
        ))}
    </g>
  );
}
const nodeTypes = { agent: AgentNode },
  edgeTypes = { flow: FlowEdge };

export function RunView() {
  const { d, run, setSpeed } = useA();
  const rm = useReducedMotion();
  const wide = useMedia('(min-width: 768px)');
  const [scrub, setScrub] = React.useState(null),
    [play, setPlay] = React.useState(false);
  const p = run.plan,
    live = run.status !== 'done';
  const t = scrub != null ? scrub : run.t;
  React.useEffect(() => {
    if (!play) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(),
        dt = (((now - last) / 1000) * run.speed) / 60;
      last = now;
      setScrub(s => {
        const n = (s == null ? 0 : s) + dt;
        if (n >= p.total) {
          setPlay(false);
          return null;
        }
        return n;
      });
    }, 60);
    return () => clearInterval(id);
  }, [play, run.speed, p.total]);
  const logs = React.useMemo(() => logLines(p, d), [p, d]);
  const win = n => {
    const ss = n.st.map(k => p.st.find(s => s.k === k));
    return { a: Math.min(...ss.map(s => s.a)), b: Math.max(...ss.map(s => s.b)) };
  };
  const ns = NODES.map(n => {
    const skip = !!(n.need && !n.need.some(k => p.sel.has(k))),
      w = win(n),
      pr = skip ? 0 : clamp01((t - w.a) / Math.max(0.001, w.b - w.a));
    const st = skip ? 'skip' : pr >= 1 ? 'done' : pr > 0 ? 'run' : 'idle';
    const last = logs.filter(l => l.t <= t && AG[l.tag].node === n.k).pop();
    return {
      ...n,
      skip,
      w,
      pr,
      st,
      now: skip ? 'Not in this brief' : last ? last.s : st === 'idle' ? n.wait : 'Starting'
    };
  });
  const byK = Object.fromEntries(ns.map(n => [n.k, n]));
  const nodes = ns.map(n => ({
    id: n.k,
    type: 'agent',
    position: { x: n.c * 196, y: n.r * 98 },
    data: {
      n: n.n,
      I: n.I,
      st: n.st,
      pr: n.pr,
      now: n.now,
      dur: hm(n.w.b - n.w.a),
      human: n.human,
      reviewer: d.reviewer
    },
    draggable: false,
    selectable: false
  }));
  const edges = EDGES.map(([a, b]) => {
    const A = byK[a],
      B = byK[b];
    const s =
      A.skip || B.skip
        ? 'skip'
        : A.st === 'done' && B.st === 'run'
          ? 'on'
          : A.st === 'done' && B.st === 'done'
            ? 'done'
            : '';
    return { id: a + b, source: a, target: b, type: 'flow', data: { s, rm } };
  });
  const shown = logs
    .filter(l => l.t <= t)
    .slice()
    .reverse();
  const lerp = (k, max) => {
    const s = p.st.find(q => q.k === k);
    if (!s || s.skip) return 0;
    return Math.round(clamp01((t - s.a) / Math.max(0.001, s.b - s.a)) * max);
  };
  const seg = k => {
    const s = p.st.find(q => q.k === k);
    return [s.a, s.b];
  };
  const segs = [
    ['Scope', 0, 6],
    ['Ingest', 6, 28],
    ['Extract', 28, 50],
    ['Model and analysis', 50, seg('write')[0]],
    ['Write', ...seg('write')],
    ['Assay', ...seg('assay')],
    ['Sign-off', ...seg('review')]
  ];
  const tape = Object.entries(d.ev)
    .map(([k, e], i) => ({ k, ...e, at: 28 + (i + 1) * (22 / (Object.keys(d.ev).length + 1)) }))
    .filter(e => e.at <= t);
  const delivered = t >= p.total - 0.01;
  return (
    <div>
      <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 max-md:grid-cols-1">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <span className="text-xs text-fg3">
              Run {d.code}-0{run.no}
            </span>
            <Status
              s={delivered ? 'ok' : run.status === 'paused' && scrub == null ? 'paused' : 'run'}
              p={(t / p.total) * 100}
            />
            {scrub != null && <Badge tone="info">Replay</Badge>}
            <span className="text-xs text-fg3">
              {p.n} deliverables in {d.gaap}, {d.fy}
            </span>
          </div>
          <div className="flex gap-1">
            {segs.map(([n, a, b]) => {
              const pr = clamp01((t - a) / Math.max(0.001, b - a));
              return (
                <div key={n} className="flex min-w-0 flex-col gap-1.5" style={{ flex: Math.max(14, b - a) }}>
                  <Progress value={pr} tone={pr >= 1 ? 'pos' : 'gold'} className="h-1.5" />
                  <span
                    className={cn(
                      'truncate text-[11.5px] max-md:hidden',
                      pr >= 1 ? 'text-fg2' : pr > 0 ? 'font-medium text-fg' : 'text-fg3'
                    )}
                  >
                    {n}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="text-right max-md:text-left">
          <div className="text-[36px] font-medium leading-none tracking-[-.03em] tnum">{clk(t)}</div>
          <div className="mt-1.5 text-xs text-fg3">
            {delivered && scrub == null
              ? `Delivered at ${tzTime(d, run.deliveredAt)} ${d.city}, ${hm(p.total)} end to end`
              : scrub != null
                ? `Replaying at ${run.speed}× speed`
                : `Simulated at ${run.speed}× speed, ${hm(p.total - t)} to go`}
          </div>
          <div className="mt-2.5 flex justify-end max-md:justify-start">
            <Segmented
              id="spd"
              size="sm"
              label="Playback speed"
              value={run.speed}
              onChange={setSpeed}
              options={[
                { v: 300, l: '300×' },
                { v: 600, l: '600×' },
                { v: 1200, l: '1200×' }
              ]}
            />
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <Tip label={play ? 'Pause replay' : 'Replay this run'}>
          <Button
            size="iconsm"
            onClick={() => {
              if (play) setPlay(false);
              else {
                if (scrub == null || scrub >= p.total - 0.5) setScrub(0);
                setPlay(true);
              }
            }}
            aria-label={play ? 'Pause replay' : 'Replay this run'}
          >
            {play ? <Pause size={13} /> : <RotateCcw size={13} />}
          </Button>
        </Tip>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-x-[8px] top-1/2 h-3 -translate-y-1/2">
            {logs.map((l, i) => (
              <i
                key={i}
                className={cn(
                  'absolute top-0 h-3 w-px',
                  l.tag === 'ASSAY' || l.tag === 'REVIEW' || l.tag === 'DELIVER' ? 'bg-gold' : 'bg-fg3/60'
                )}
                style={{ left: (l.t / p.total) * 100 + '%' }}
              />
            ))}
          </div>
          <SliderP.Root
            value={[t]}
            min={0}
            max={p.total}
            step={0.1}
            onValueChange={v => {
              setPlay(false);
              setScrub(v[0]);
            }}
            aria-label="Replay position"
            className="relative flex h-6 w-full touch-none select-none items-center"
          >
            <SliderP.Track className="relative h-[2px] grow rounded-full bg-line2">
              <SliderP.Range className="absolute h-full rounded-full bg-gold" />
            </SliderP.Track>
            <SliderP.Thumb className="block h-3.5 w-3.5 rounded-full bg-fg shadow-[0_0_0_4px_hsl(var(--gold)/.2)] focus-visible:outline-2" />
          </SliderP.Root>
        </div>
        {scrub != null ? (
          <Button
            size="sm"
            onClick={() => {
              setPlay(false);
              setScrub(null);
            }}
          >
            {live ? 'Back to live' : 'Jump to the end'}
          </Button>
        ) : (
          <span className="text-xs text-fg3 max-md:hidden">Drag to replay any moment</span>
        )}
      </div>

      <Panel
        title="Agent graph"
        sub="A planner splits the brief, specialists build in parallel, a separate Assayer checks, and your reviewer approves"
        pad={false}
      >
        {wide ? (
          <div className="overflow-x-auto">
            <div className="h-[400px] w-full min-w-[1100px]">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.03 }}
                minZoom={0.4}
                maxZoom={1.25}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag={false}
                zoomOnScroll={false}
                zoomOnPinch={false}
                zoomOnDoubleClick={false}
                preventScrolling={false}
                proOptions={{ hideAttribution: true }}
                style={{ background: 'transparent' }}
              />
            </div>
          </div>
        ) : (
          <ul>
            {ns.map(n => (
              <li
                key={n.k}
                className={cn(
                  'grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line/60 px-5 py-2.5 last:border-b-0',
                  n.st === 'skip' && 'opacity-40'
                )}
              >
                <span
                  className={cn(
                    'grid h-7 w-7 place-items-center rounded-lg',
                    n.st === 'run'
                      ? 'bg-gold/[.14] text-gold'
                      : n.st === 'done'
                        ? 'bg-pos/12 text-pos'
                        : 'bg-fg/6 text-fg3'
                  )}
                >
                  <n.I size={14} />
                </span>
                <div className="min-w-0">
                  <b className="text-[13px] font-semibold">{n.n}</b>
                  <div className="truncate text-xs text-fg2">{n.now}</div>
                  <Progress value={n.pr} tone={n.st === 'done' ? 'pos' : 'gold'} className="mt-1.5 h-[3px]" />
                </div>
                <span
                  className={cn(
                    'text-xs',
                    n.st === 'run' ? 'font-medium text-gold' : n.st === 'done' ? 'text-pos' : 'text-fg3'
                  )}
                >
                  {n.st === 'skip'
                    ? 'Skipped'
                    : n.st === 'done'
                      ? 'Done'
                      : n.st === 'run'
                        ? Math.round(n.pr * 100) + '%'
                        : 'Queued'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div
          className="relative overflow-hidden border-t border-line py-2.5 mask-[linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]"
          aria-label="Figures traced so far"
        >
          {tape.length === 0 ? (
            <div className="px-4 text-xs text-fg3">Traced figures appear here as the Extractor reads the filings.</div>
          ) : (
            <div
              className={cn(
                'flex w-max gap-6 whitespace-nowrap px-4 text-xs',
                tape.length > 5 && !rm && 'animate-tape'
              )}
            >
              {[...tape, ...(tape.length > 5 ? tape : [])].map((e, i) => (
                <span key={i} className="inline-flex items-center gap-1.5">
                  <Check size={12} className="text-pos" strokeWidth={3} />
                  <span className="text-fg2">{e.l}</span>
                  <b className="font-semibold">{e.v}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_310px] items-start gap-4 max-xl:grid-cols-1">
        <Panel title="Activity" sub={`${shown.length} of ${logs.length} events`} pad={false}>
          <div className="max-h-[430px] overflow-y-auto" aria-live="polite">
            {shown.length === 0 && <div className="px-4 py-6 text-fg3">Waiting for the Planner.</div>}
            <AnimatePresence initial={false}>
              {shown.map(l => {
                const a = AG[l.tag],
                  I = AG_ICON[l.tag];
                return (
                  <motion.div
                    layout
                    key={l.tag + l.t}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-[24px_minmax(0,1fr)_auto] gap-3 border-b border-line/60 px-5 py-2.5 last:border-b-0"
                  >
                    <span
                      className={cn(
                        'grid h-6 w-6 place-items-center rounded-md',
                        a.c === 'gold'
                          ? 'bg-gold/13 text-gold'
                          : a.c === 'green'
                            ? 'bg-pos/12 text-pos'
                            : 'bg-fg/[.07] text-fg2'
                      )}
                    >
                      <I size={13} />
                    </span>
                    <div className="min-w-0">
                      <b className="text-[12.5px] font-semibold">{l.tag === 'REVIEW' ? d.reviewer : a.n}</b>
                      <p className="text-[13px] text-fg2">{l.x}</p>
                    </div>
                    <time className="pt-0.5 text-xs text-fg3">{clk(l.t).slice(0, 5)}</time>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </Panel>
        <Panel title="Run telemetry" pad={false}>
          {[
            ['Documents read', Math.round(clamp01((t - 6) / 22) * 1243), 1243],
            ['Data points extracted', lerp('extract', 38406), 38406],
            ['Formulas written', lerp('model', 2912), 2912],
            [
              'Matrix cells filled',
              p.sel.has('compet') ? Math.round(clamp01((t - p.an.a) / Math.max(0.001, p.an.b - p.an.a)) * 36) : 0,
              36
            ],
            ['Integrity checks passed', lerp('assay', 412), 412],
            ['Figures traced to source', lerp('assay', 3184), 3187]
          ].map(([l, v, mx]) => (
            <div key={l} className="flex flex-col gap-2 border-b border-line/60 px-5 py-3 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3 text-[12.5px] text-fg2">
                <span>{l}</span>
                <span>
                  <b className="text-[15px] font-semibold text-fg">
                    <Num value={v} fmt={F.m0} />
                  </b>
                  <span className="text-xs text-fg3"> of {nf0.format(mx)}</span>
                </span>
              </div>
              <Progress value={v / mx} tone={v >= mx ? 'pos' : 'gold'} />
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
