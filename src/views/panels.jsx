import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  Search,
  SlidersHorizontal,
  Link2,
  ShieldCheck,
  UserRound,
  Flag,
  ArrowUpRight,
  BookOpen,
  Copy,
  Check,
  Undo2,
  ArrowUp,
  Clock,
  TrendingDown,
  Sigma,
  ChartScatter,
  TriangleAlert,
  Sheet,
  File
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, Badge, Tip, Kbd } from '../components/ui.jsx';
import { Mark, CoLogo, DocPage, SrcIcon } from '../components/shared.jsx';
import { getEvidence, fp } from '../lib/engine.js';
import { cn } from '../lib/utils.js';
import { useA } from '../lib/context.js';
import { rich } from '../lib/rich.jsx';

const STEP_ICON = {
  file: FileText,
  search: Search,
  sliders: SlidersHorizontal,
  link: Link2,
  shield: ShieldCheck,
  user: UserRound,
  flag: Flag
};
function Head({ icon, title, extra }) {
  const { closeDock } = useA();
  return (
    <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line pl-4 pr-2">
      {icon}
      <h3 className="text-[13.5px] font-semibold">{title}</h3>
      {extra}
      <span className="flex-1" />
      <Tip label="Close" kbd="Esc">
        <Button variant="ghost" size="iconsm" onClick={closeDock} aria-label="Close panel">
          <X size={15} />
        </Button>
      </Tip>
    </header>
  );
}

export function EvidencePanel({ k }) {
  const { d, m, go, setM, setSrcSel } = useA();
  const E = getEvidence(d, k, m);
  if (!E) return null;
  const loc = typeof E.pg.p === 'number' ? 'page ' + E.pg.p : E.pg.p;
  const copy = () => {
    const t = `${E.doc.who}, ${E.doc.t}, ${loc}`;
    const done = () => toast.success('Citation copied', { description: t });
    try {
      navigator.clipboard.writeText(t).then(done, () => toast('Citation', { description: t }));
    } catch (e) {
      toast('Citation', { description: t });
    }
  };
  return (
    <div className="flex h-full min-h-0 flex-col" role="complementary" aria-label="Source trail">
      <Head icon={<FileText size={15} className="text-fg3" />} title="Source trail" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1.5 border-b border-line/60 px-5 py-4">
          <span className="text-xs text-fg3">{E.l}</span>
          <span className="text-[32px] font-semibold leading-none tracking-[-.035em]">{E.v}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge>{E.doc.ty}</Badge>
            {E.flag ? (
              <Badge tone="warn">
                <Flag size={11} />
                Not audited
              </Badge>
            ) : (
              <Badge tone="pos">
                <ShieldCheck size={11} />
                Assayed
              </Badge>
            )}
            <Badge>{E.doc.src}</Badge>
          </div>
        </div>
        <div className="border-b border-line/60 px-5 py-4">
          <h4 className="mb-2.5 text-xs font-medium text-fg3">Where it appears, {loc}</h4>
          <DocPage doc={E.doc} pg={E.pg} hl={E.hl} />
        </div>
        <div className="border-b border-line/60 px-5 py-4">
          <h4 className="mb-3 text-xs font-medium text-fg3">How the number got here</h4>
          <ol className="flex flex-col">
            {E.steps.map(([ic, t, x, c], i) => {
              const I = STEP_ICON[ic] || FileText;
              return (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative grid grid-cols-[26px_minmax(0,1fr)] gap-3 pb-3.5 last:pb-0"
                >
                  {i < E.steps.length - 1 && (
                    <span className="absolute bottom-0 left-[12.5px] top-[26px] w-px bg-line2" />
                  )}
                  <span
                    className={cn(
                      'grid h-[26px] w-[26px] place-items-center rounded-full',
                      c === 'ok'
                        ? 'bg-pos/13 text-pos'
                        : c === 'gold'
                          ? 'bg-warn/[.14] text-warn'
                          : 'bg-fg/[.07] text-fg2'
                    )}
                  >
                    <I size={13} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <b className="block text-[12.5px] font-semibold">{t}</b>
                    <p className="text-[12.5px] text-fg2">{x}</p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
        <div className="px-4 py-4">
          <h4 className="mb-2.5 text-xs font-medium text-fg3">Used in</h4>
          <div className="flex flex-wrap gap-1.5">
            {E.used.map(([l, tab, cell]) => (
              <Button
                key={l}
                size="sm"
                onClick={() => {
                  if (cell) setM(x => ({ ...x, cell, sheet: 'DCF' }));
                  go('engagement', tab);
                }}
              >
                <ArrowUpRight size={12} />
                {l}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <footer className="flex gap-2 border-t border-line px-3 py-2.5">
        {E.doc.id !== 'comps' && E.doc.id !== 'peer' && (
          <Button
            size="sm"
            onClick={() => {
              setSrcSel(E.doc.id);
              go('engagement', 'sources');
            }}
          >
            <BookOpen size={13} />
            Open in Library
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={copy}>
          <Copy size={13} />
          Copy citation
        </Button>
      </footer>
    </div>
  );
}

export function CellPanel({ rc }) {
  const { d, openCell } = useA();
  const M = d.matrix,
    [sr, sc] = rc,
    row = M.rows[sr],
    v = row.c[sc],
    nC = M.cols.length;
  const srcs = [row.doc, [5, 6, 7][sc % 3]].filter((x, i, a) => a.indexOf(x) === i);
  const tone = x => (x === 'High' ? 'neg' : x === 'Medium' ? 'warn' : x === 'Target' ? 'gold' : 'neutral');
  return (
    <div className="flex h-full min-h-0 flex-col" role="complementary" aria-label="Answer detail">
      <Head icon={<CoLogo text={row.m} tg={row.tg} />} title={row.n} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-line/60 px-5 py-4">
          <h4 className="mb-1.5 text-xs font-medium text-fg3">{M.cols[sc]}</h4>
          <p className="text-[15px] leading-relaxed">
            {sc === nC - 1 ? (
              <Badge tone={tone(v)} dot>
                {v}
              </Badge>
            ) : (
              v
            )}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Badge>{srcs.includes(6) ? 'Medium confidence' : 'High confidence'}</Badge>
            <Badge>{srcs.length} sources</Badge>
            <Badge tone="pos">Checked by the Assayer</Badge>
          </div>
        </div>
        <div className="border-b border-line/60 px-5 py-4">
          <h4 className="mb-1 text-xs font-medium text-fg3">Sources</h4>
          {srcs.map(s => (
            <div
              key={s}
              className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b border-line py-2.5 last:border-b-0"
            >
              <SrcIcon f={s === 6 ? 'call' : s === 5 ? 'web' : 'pdf'} />
              <div>
                <b className="block text-[12.5px] font-medium">
                  [{s + 1}] {M.srcs[s]}
                </b>
                <span className="text-xs text-fg3">
                  {s === 6
                    ? 'Transcript from a licensed expert network'
                    : s === 5
                      ? 'Snapshot stored with the run'
                      : s === 7
                        ? 'Aggregated and de-duplicated'
                        : 'Primary document'}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-4">
          <h4 className="mb-1.5 text-xs font-medium text-fg3">Same question, other companies</h4>
          {M.rows.map(
            (rw, ri) =>
              ri !== sr && (
                <button
                  key={rw.n}
                  onClick={() => openCell([ri, sc])}
                  className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left hover:bg-fg/5"
                >
                  <CoLogo text={rw.m} tg={rw.tg} />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <b className="text-[13px] font-medium">{rw.n}</b>
                    <span className="truncate text-xs text-fg3">{rw.c[sc]}</span>
                  </span>
                </button>
              )
          )}
        </div>
      </div>
    </div>
  );
}

export function AskPanel() {
  const { d, m, msgs, ask, applyAct, undoAct, dismissAct, openEv } = useA();
  const [q, setQ] = React.useState(''),
    bodyRef = React.useRef(null),
    inRef = React.useRef(null);
  React.useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);
  React.useEffect(() => {
    const id = setTimeout(() => inRef.current && inRef.current.focus(), 80);
    return () => clearTimeout(id);
  }, []);
  const busy = msgs.length > 0 && msgs[msgs.length - 1].role === 'ai' && msgs[msgs.length - 1].st !== 'done';
  const send = text => {
    const t = (text || q).trim();
    if (!t || busy) return;
    setQ('');
    ask(t);
  };
  const SUG = [
    [SlidersHorizontal, `Re-run the DCF at a ${fp(d.wacc + 0.01)} WACC`],
    [
      TrendingDown,
      d.key === 'uk' ? 'Stress the downside: lose one FY28 renewal' : 'Stress the downside: 150bp of rate cuts'
    ],
    [Sigma, 'What IRR do we get at 5.5x leverage?'],
    [ChartScatter, 'Why is it cheap against peers?'],
    [TriangleAlert, 'Summarise the key risks for the IC']
  ];
  const label = k => {
    const E = getEvidence(d, k, m);
    return E ? (E.l.length > 32 ? E.l.slice(0, 30) + '…' : E.l) : k;
  };
  return (
    <div className="flex h-full min-h-0 flex-col" role="complementary" aria-label="Ask Vult">
      <Head icon={<Mark size={22} />} title="Ask Vult" extra={<Badge tone="gold">{d.project}</Badge>} />
      <div className="flex flex-wrap gap-1.5 border-b border-line/60 px-5 py-2.5 text-xs text-fg2">
        {[
          [BookOpen, '1,243 documents'],
          [Sheet, `Model, version ${m.v}`],
          [ChartScatter, 'Comps'],
          [File, 'IC memo']
        ].map(([I, t]) => (
          <span key={t} className="inline-flex h-6 items-center gap-1.5 rounded-md border border-line bg-fg/4 px-2">
            <I size={12} className="text-fg3" />
            {t}
          </span>
        ))}
      </div>
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto">
        {msgs.length === 0 ? (
          <div className="px-4 py-5">
            <b className="block text-[15px] font-semibold tracking-[-.01em]">Ask anything about {d.project}.</b>
            <p className="mt-1 text-[13px] text-fg2">
              Answers come only from this engagement's model and sources. When a change would help, Vult proposes it and
              you decide.
            </p>
            <div className="mt-4 flex flex-col gap-1.5">
              {SUG.map(([I, t]) => (
                <button
                  key={t}
                  onClick={() => send(t)}
                  className="flex items-center gap-2.5 card px-3 py-2.5 text-left text-[13px] text-fg2 transition-colors hover:border-line2 hover:text-fg"
                >
                  <I size={14} className="shrink-0 text-fg3" />
                  {t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 px-4 py-4">
            {msgs.map(mm =>
              mm.role === 'user' ? (
                <motion.div
                  key={mm.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div className="max-w-[88%] rounded-[14px] rounded-br-[4px] bg-fg/8 px-3 py-2 text-[13.5px]">
                    {mm.text}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={mm.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5"
                >
                  <Mark size={22} />
                  <div className="flex min-w-0 flex-col gap-2.5 text-[13.5px] leading-relaxed">
                    {mm.st === 'think' ? (
                      <ul className="flex flex-col gap-1.5 text-[12.5px] text-fg3">
                        {mm.r.think.map((x, i) => (
                          <li
                            key={i}
                            className={cn(
                              'flex items-center gap-2 transition-opacity',
                              i <= mm.ti ? 'opacity-100' : 'opacity-35'
                            )}
                          >
                            {i < mm.ti ? (
                              <Check size={12} className="text-pos" strokeWidth={3} />
                            ) : (
                              <Clock size={12} className={i === mm.ti ? 'animate-pulse2 text-gold' : ''} />
                            )}
                            {x}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <>
                        <div className="flex flex-col gap-2">
                          {rich(mm.r.text.slice(0, mm.shown))}
                          {mm.st === 'stream' && (
                            <span className="inline-block h-[15px] w-[7px] animate-pulse2 bg-gold align-[-2px]" />
                          )}
                        </div>
                        {mm.st === 'done' && mm.r.cites.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {mm.r.cites.map((k, i) => (
                              <button
                                key={k}
                                onClick={() => openEv(k)}
                                className="inline-flex h-6 items-center gap-1.5 rounded-md border border-line2 bg-surface px-2 text-[11.5px] text-fg2 transition-colors hover:border-gold/60 hover:text-fg"
                              >
                                <b className="font-semibold text-info">{i + 1}</b>
                                {label(k)}
                              </button>
                            ))}
                          </div>
                        )}
                        {mm.st === 'done' && mm.r.action && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn('overflow-hidden card', mm.applied ? 'border-pos/40' : 'border-gold/45')}
                          >
                            <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-[12.5px] font-semibold">
                              <SlidersHorizontal size={14} className="text-gold" />
                              {mm.r.action.title}
                              {mm.applied && (
                                <Badge tone="pos" className="ml-auto">
                                  Applied
                                </Badge>
                              )}
                              {mm.dismissed && <Badge className="ml-auto">Dismissed</Badge>}
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[12.5px] tnum">
                              {mm.r.action.rows.map(([l, a, b]) => (
                                <React.Fragment key={l}>
                                  <span className="text-fg2">{l}</span>
                                  <span className="text-fg3 line-through">{a}</span>
                                  <b className="font-semibold">{b}</b>
                                </React.Fragment>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 border-t border-line px-3 py-2">
                              {mm.applied ? (
                                <>
                                  <span className="text-xs text-fg3">
                                    {mm.r.action.kind === 'memo'
                                      ? 'Added to the memo as a tracked change'
                                      : `Model updated to version ${mm.ver}`}
                                  </span>
                                  <Button size="xs" className="ml-auto" onClick={() => undoAct(mm.id)}>
                                    <Undo2 size={12} />
                                    Undo
                                  </Button>
                                </>
                              ) : mm.dismissed ? (
                                <span className="text-xs text-fg3">No change was made</span>
                              ) : (
                                <>
                                  <Button size="sm" variant="gold" onClick={() => applyAct(mm.id)}>
                                    <Check size={13} />
                                    {mm.r.action.kind === 'memo' ? 'Add to the memo' : 'Apply to the model'}
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => dismissAct(mm.id)}>
                                    Dismiss
                                  </Button>
                                </>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )
            )}
            {!busy && (
              <div className="flex flex-col gap-1.5">
                {SUG.filter(s => !msgs.some(mm => mm.text === s[1]))
                  .slice(0, 2)
                  .map(([I, t]) => (
                    <button
                      key={t}
                      onClick={() => send(t)}
                      className="flex items-center gap-2.5 card px-3 py-2 text-left text-[12.5px] text-fg2 hover:border-line2 hover:text-fg"
                    >
                      <I size={13} className="shrink-0 text-fg3" />
                      {t}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-line px-3 pb-3 pt-2.5">
        <div className="flex items-end gap-2 rounded-ctl border border-line2 bg-raised py-2 pl-3 pr-2 focus-within:border-fg3/60">
          <textarea
            ref={inRef}
            rows={1}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask about the model, comps or sources"
            aria-label="Ask Vult"
            className="max-h-[120px] min-h-[22px] flex-1 resize-none bg-transparent py-0.5 text-[13.5px] leading-normal text-fg outline-hidden placeholder:text-fg3"
          />
          <Button size="iconsm" variant="gold" onClick={() => send()} disabled={!q.trim() || busy} aria-label="Send">
            <ArrowUp size={14} />
          </Button>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-fg3">
          <span className="truncate">Grounded in this engagement. Every figure is cited.</span>
          <span className="flex shrink-0 items-center gap-1">
            <Kbd>↵</Kbd> to send
          </span>
        </div>
      </div>
    </div>
  );
}
