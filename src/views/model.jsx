import * as React from 'react';
import { motion } from 'framer-motion';
import { SlidersHorizontal, ExternalLink, Check, FileText, Sigma } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Badge, Popover, PopoverTrigger, PopoverContent, Segmented, Slider, Tip } from '../components/ui.jsx';
import { Av, Num, PxNum, DocPage, Empty, FileIcon, Panel } from '../components/shared.jsx';
import { DebtBars } from '../components/charts.jsx';
import {
  sheetCells,
  calc,
  lbo,
  defaultEntry,
  perShareFromEV,
  getEvidence,
  SCEN,
  COLS,
  fp,
  fpS,
  fx,
  fm,
  sharePx,
  nf0
} from '../lib/engine.js';
import { cn } from '../lib/utils.js';
import { useA } from '../lib/context.js';
import { F } from '../lib/format.js';

const CHECKS = [
  ['Balance sheet balances in every period', 'BS', 164],
  ['Cash flow ties to balance-sheet cash', 'CF', 12],
  ['Retained earnings roll forward', 'BS', 7],
  ['Debt schedule ties to borrowings', 'Debt', 14],
  ['No hard-coded numbers in calculation rows', 'All', 2912],
  ['Historicals match filings within rounding', 'Hist', 138],
  ['Units and scale are consistent', 'All', 1],
  ['Peer year-ends are calendarised', 'Comps', 6],
  ['Lease accounting aligned across peers', 'Comps', 6],
  ['Diluted shares by the treasury method', 'Cap table', 1],
  ['Circularity switch converges', 'Debt', 2],
  ['Every memo number matches the model', 'Memo', 72]
];

function Delta({ v, b }) {
  const dv = v / b - 1;
  return Math.abs(dv) < 0.0005 ? null : (
    <small className={cn('ml-1.5 text-xs font-medium', dv > 0 ? 'text-pos' : 'text-neg')}>{fpS(dv)}</small>
  );
}

function Sec({ t, children }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line/60 px-5 py-3 last:border-b-0">
      <h4 className="text-xs font-medium text-fg3">{t}</h4>
      {children}
    </div>
  );
}

export function ModelView() {
  const { d, m, setM, openEv, run } = useA();
  const { C, o } = React.useMemo(() => sheetCells(d, m), [d, m]);
  const base = React.useMemo(() => calc(d, 'base', d.wacc, d.tgr), [d]);
  const a = m.cell,
    c = C[a],
    sheet = m.sheet || 'DCF',
    chg = new Set(m.changed || []);
  const setCell = v => setM(x => ({ ...x, cell: v }));
  const setW = v =>
    setM(x => {
      const w = v / 100;
      return { ...x, wacc: w, tgr: Math.min(x.tgr, w - 0.02) };
    });
  const setG = v =>
    setM(x => {
      const g = v / 100;
      return { ...x, tgr: g, wacc: Math.max(x.wacc, g + 0.02) };
    });
  const rows = [];
  for (let r = 1; r <= 36; r++) {
    const tds = [];
    for (let ci = 0; ci < 8; ci++) {
      const ad = COLS[ci] + r,
        cell = C[ad];
      if (cell && cell.span) {
        tds.push(
          <td key={ad} colSpan={cell.span} className={cn(cell.c, ci === 0 && 'colA')}>
            {cell.v}
          </td>
        );
        ci += cell.span - 1;
        continue;
      }
      const isPeer = ad === d.peer.cell;
      tds.push(
        <td
          key={ad}
          tabIndex={cell ? 0 : -1}
          title={cell && cell.ev ? 'Double-click to see the source' : undefined}
          className={cn(cell && cell.c, ci === 0 && 'colA', chg.has(ad) && 'chg', isPeer && 'peer', ad === a && 'sel')}
          onClick={() => setCell(ad)}
          onDoubleClick={() => cell && cell.ev && openEv(cell.ev)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setCell(ad);
              if (cell && cell.ev && e.key === 'Enter') openEv(cell.ev);
            }
          }}
        >
          {isPeer && (
            <span className="pointer-events-none absolute top-[-17px] left-[-2px] z-4 whitespace-nowrap rounded-[4px] rounded-bl-none bg-presence px-1.5 py-[3px] font-sans text-[10.5px] font-semibold leading-none text-white">
              {d.peer.n.split(' ')[0]}
            </span>
          )}
          {cell ? cell.v : ''}
        </td>
      );
    }
    rows.push(
      <tr key={r}>
        <th className="rn">{r}</th>
        {tds}
      </tr>
    );
  }
  const lboOn = run.plan.sel.has('lbo');
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="mr-auto flex min-w-0 flex-wrap items-center gap-2.5 text-[13px]">
          <FileIcon kind="xlsx" />
          <b className="font-medium">{d.short}_Model_v1.xlsx</b>
          <Badge>Version {m.v}</Badge>
          <span className="text-xs text-fg3">{m.v > 3 ? 'Changed by Vult just now' : 'Reviewed on 10 October'}</span>
          <span className="flex items-center gap-1.5 text-xs text-fg3">
            <Av n={d.peer.n} size={18} live ring={false} />
            {d.peer.n.split(' ')[0]} is in this sheet
          </span>
        </div>
        <Segmented
          id="scen"
          label="Scenario"
          value={m.scen}
          onChange={v => setM(x => ({ ...x, scen: v }))}
          options={Object.keys(SCEN).map(k => ({ v: k, l: SCEN[k].l }))}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm">
              <SlidersHorizontal size={13} />
              WACC {fp(m.wacc)}, growth {fp(m.tgr)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[290px] p-3.5">
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-2 flex justify-between text-[12.5px] text-fg2">
                  <span>WACC</span>
                  <b className="font-semibold text-info">{fp(m.wacc, 2)}</b>
                </div>
                <Slider label="WACC" value={m.wacc * 100} min={6} max={13} step={0.25} onValueChange={setW} />
              </div>
              <div>
                <div className="mb-2 flex justify-between text-[12.5px] text-fg2">
                  <span>Terminal growth</span>
                  <b className="font-semibold text-info">{fp(m.tgr, 2)}</b>
                </div>
                <Slider label="Terminal growth" value={m.tgr * 100} min={1} max={4} step={0.25} onValueChange={setG} />
              </div>
              <Button size="sm" onClick={() => setM(x => ({ ...x, wacc: d.wacc, tgr: d.tgr }))}>
                Reset to the signed-off model
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Button
          size="sm"
          onClick={() =>
            toast('Opened in Excel', {
              description: `${d.short}_Model_v1.xlsx with live formulas and the house colour code`
            })
          }
        >
          <ExternalLink size={13} />
          Open in Excel
        </Button>
      </div>
      <dl className="mb-4 grid grid-cols-5 overflow-hidden card max-lg:grid-cols-2">
        {[
          [
            'Enterprise value',
            <>
              <Num value={o.ev} fmt={F.m1} prefix={d.cur} suffix="m" />
              <Delta v={o.ev} b={base.ev} />
            </>
          ],
          [
            'Equity value',
            <>
              <Num value={o.eq} fmt={F.m1} prefix={d.cur} suffix="m" />
              <Delta v={o.eq} b={base.eq} />
            </>
          ],
          [
            'Value per share',
            <>
              <PxNum d={d} v={o.vps} />
              <Delta v={o.vps} b={base.vps} />
            </>
          ],
          [
            `Against ${sharePx(d, d.price)} today`,
            <span className={o.up >= 0 ? 'text-pos' : 'text-neg'}>
              <Num value={o.up} fmt={F.pctS} />
            </span>
          ],
          ['EV / NTM EBITDA', <Num value={o.evE} fmt={F.m1} suffix="x" />]
        ].map(([l, v], i) => (
          <div key={l} className={cn('min-w-0 border-line px-4 py-3', i < 4 && 'border-r', 'max-lg:border-b')}>
            <dt className="text-xs text-fg3">{l}</dt>
            <dd className="mt-1 text-[21px] font-semibold tracking-tight">{v}</dd>
          </div>
        ))}
      </dl>
      <div
        className={cn(
          sheet === 'DCF' &&
            'grid grid-cols-[minmax(0,1fr)_304px] items-start gap-4 max-[1280px]:grid-cols-1 in-[.dock]:grid-cols-1'
        )}
      >
        <div className="min-w-0 overflow-hidden card bg-surface!">
          {sheet === 'DCF' && (
            <>
              <div className="flex min-w-0 items-stretch border-b border-line bg-raised text-[12.5px]">
                <span className="min-w-[58px] border-r border-line px-2.5 py-2 text-center font-semibold">{a}</span>
                <span className="border-r border-line px-2.5 py-2 italic text-fg3">fx</span>
                <span className="min-w-0 flex-1 break-all px-2.5 py-2 font-mono">{c ? c.f : ''}</span>
              </div>
              <div className="max-h-[640px] overflow-auto">
                <table
                  className="xl w-full min-w-[880px] border-separate border-spacing-0 text-[12.5px] tnum"
                  aria-label="DCF sheet"
                >
                  <thead>
                    <tr>
                      <th className="rn" />
                      {[...COLS].map(cl => (
                        <th key={cl}>{cl}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>{rows}</tbody>
                </table>
              </div>
            </>
          )}
          {sheet === 'LBO' &&
            (lboOn ? (
              <LboView />
            ) : (
              <div className="p-4">
                <Empty
                  icon={Sigma}
                  title="The LBO is not in this brief"
                  body="Add the LBO model to the brief and run it again."
                />
              </div>
            ))}
          {sheet === 'Checks' && (
            <div className="overflow-auto">
              <table className="w-full border-separate border-spacing-0 text-[13px]">
                <thead>
                  <tr className="text-left text-xs text-fg3">
                    {['Check', 'Sheet', 'Cells tested', 'Difference', 'Result'].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          'h-9 border-b border-line bg-raised px-4 font-medium',
                          (i === 2 || i === 3) && 'text-right'
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CHECKS.map(([n, s, k]) => (
                    <tr key={n} className="hover:bg-fg/3">
                      <td className="h-10 border-b border-line/60 px-5">{n}</td>
                      <td className="border-b border-line/60 px-5 text-fg2">{s}</td>
                      <td className="border-b border-line/60 px-5 text-right">{nf0.format(k)}</td>
                      <td className="border-b border-line/60 px-5 text-right">0.000</td>
                      <td className="border-b border-line/60 px-5">
                        <Badge tone="pos" dot>
                          Pass
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center gap-1 overflow-x-auto border-t border-line bg-raised px-2 py-1.5">
            {['DCF', 'LBO', 'Checks'].map(s => (
              <button
                key={s}
                onClick={() => setM(x => ({ ...x, sheet: s }))}
                className={cn(
                  'relative inline-flex h-[26px] items-center gap-1.5 rounded-md px-2.5 text-[12.5px]',
                  sheet === s ? 'text-fg' : 'text-fg2 hover:text-fg'
                )}
              >
                {sheet === s && (
                  <motion.span
                    layoutId="sheet-tab"
                    className="absolute inset-0 rounded-md bg-surface shadow-[0_0_0_1px_hsl(var(--line2))]"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.3 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  {s === 'Checks' && <span className="h-1.5 w-1.5 rounded-full bg-pos" />}
                  {s}
                </span>
              </button>
            ))}
            <span className="ml-auto flex shrink-0 gap-3 pl-3 text-xs text-fg2">
              <span className="flex items-center gap-1.5">
                <b className="font-semibold text-info">0.0</b>Input
              </span>
              <span className="flex items-center gap-1.5">
                <b className="font-semibold">0.0</b>Formula
              </span>
              <span className="flex items-center gap-1.5">
                <b className="font-semibold text-pos">0.0</b>Linked
              </span>
            </span>
          </div>
        </div>
        {sheet === 'DCF' && <Inspector C={C} a={a} setCell={setCell} />}
      </div>
    </div>
  );
}

function Inspector({ C, a, setCell }) {
  const { d, m, openEv } = useA();
  const c = C[a];
  const refs =
    c && c.f
      ? [...new Set((c.f.match(/\$?[A-H]\$?\d+/g) || []).map(x => x.replace(/\$/g, '')))].filter(r => r !== a)
      : [];
  const E = c && c.ev ? getEvidence(d, c.ev, m) : null;
  const kind = !c ? 'empty' : c.k;
  const lab = {
    in: ['Input', 'info'],
    lk: ['Linked to source', 'pos'],
    calc: ['Formula', 'neutral'],
    label: ['Label', 'neutral'],
    empty: ['Empty cell', 'neutral']
  }[kind];
  return (
    <aside className="sticky top-14 min-w-0 card" aria-label="Cell lineage">
      <Sec
        t={
          <span className="flex items-center justify-between">
            Cell {a}
            <Badge tone={lab[1]}>{lab[0]}</Badge>
          </span>
        }
      >
        <div
          className={cn(
            'text-[26px] font-semibold tracking-[-.03em]',
            kind === 'in' ? 'text-info' : kind === 'lk' ? 'text-pos' : 'text-fg'
          )}
        >
          {c ? c.v || '—' : '—'}
        </div>
        {c && c.f && kind !== 'label' && (
          <code className="block break-all rounded-md border border-line bg-inset px-2.5 py-2 font-mono text-xs">
            {c.f}
          </code>
        )}
      </Sec>
      {refs.length > 0 && (
        <Sec t="Depends on">
          <div className="flex flex-wrap gap-1.5">
            {refs.map(r => (
              <button
                key={r}
                onClick={() => setCell(r)}
                className="h-[22px] rounded-[5px] border border-line2 bg-surface px-2 font-mono text-[11.5px] hover:border-pos hover:text-pos"
              >
                {r}
              </button>
            ))}
          </div>
        </Sec>
      )}
      {E && (
        <Sec t="Source">
          <button onClick={() => openEv(c.ev)} className="text-left">
            <DocPage doc={E.doc} pg={E.pg} hl={E.hl} />
          </button>
          <Button size="sm" variant="goldsoft" onClick={() => openEv(c.ev)}>
            <FileText size={13} />
            Open the full source trail
          </Button>
        </Sec>
      )}
      {!E && c && c.note && kind !== 'label' && (
        <Sec t={kind === 'in' ? 'Why this input' : 'Note'}>
          <p className="text-[13px] text-fg2">{c.note}</p>
        </Sec>
      )}
      {kind !== 'empty' && kind !== 'label' && (
        <Sec t="Checks">
          <ul className="flex flex-col gap-1.5 text-[12.5px] text-fg2">
            {(kind === 'lk' && E
              ? ['Matches the source document', d.ev[c.ev] ? d.ev[c.ev].rec : 'Reconciled']
              : kind === 'in'
                ? ['Within the peer range', 'Flagged to the reviewer as a judgement']
                : ['Recalculated by the Assayer', `${refs.length} input${refs.length === 1 ? '' : 's'} traced`]
            )
              .concat([`Reviewed by ${d.reviewer}`])
              .map(x => (
                <li key={x} className="flex gap-2">
                  <Check size={13} className="mt-0.5 shrink-0 text-pos" />
                  {x}
                </li>
              ))}
          </ul>
        </Sec>
      )}
      {(kind === 'empty' || kind === 'label') && (
        <Sec t="Lineage">
          <p className="text-[12.5px] text-fg2">
            Select a number to see its formula, the cells it depends on and the page it came from. Double-click a green
            number to open its source.
          </p>
        </Sec>
      )}
    </aside>
  );
}

function LboView() {
  const { d, m, setM, openEv } = useA();
  const o = calc(d, m.scen, m.wacc, m.tgr),
    L = lbo(d, o, m.entry, m.exit, m.lev),
    E0 = defaultEntry(d);
  const entries = [-1, -0.5, 0, 0.5, 1].map(x => E0 + x),
    exits = [-2, -1, 0, 1, 2].map(x => E0 + x);
  const heat = irr =>
    irr >= 0.15
      ? `hsl(var(--pos) / ${Math.min(0.42, 0.08 + ((irr - 0.15) / 0.15) * 0.34)})`
      : `hsl(var(--neg) / ${Math.min(0.4, 0.08 + ((0.15 - irr) / 0.15) * 0.32)})`;
  const debtRows = [
    { y: 'Close', debt: L.debt0, lev: m.lev },
    ...L.sched.map(s => ({ y: s.y, debt: s.debt, lev: s.lev }))
  ];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 p-4 max-xl:grid-cols-1">
      <div className="flex min-w-0 flex-col gap-4">
        <dl className="grid grid-cols-2 overflow-hidden rounded-panel border border-line">
          {[
            [
              'IRR over a five-year hold',
              <span className={L.irr >= 0.2 ? 'text-pos' : L.irr < 0.15 ? 'text-neg' : ''}>
                <Num value={L.irr} fmt={F.pct} />
              </span>
            ],
            ['Money multiple', <Num value={L.moic} fmt={F.m2} suffix="x" />],
            [
              'Offer per share',
              <>
                <PxNum d={d} v={L.offer} />
                <small className="ml-1.5 text-xs font-medium text-pos">{fpS(L.prem)} premium</small>
              </>
            ],
            ['Sponsor equity', <Num value={L.eq0} fmt={F.m1} prefix={d.cur} suffix="m" />]
          ].map(([l, v], i) => (
            <div key={l} className={cn('border-line px-4 py-3', i % 2 === 0 && 'border-r', i < 2 && 'border-b')}>
              <dt className="text-xs text-fg3">{l}</dt>
              <dd className="mt-1 text-[21px] font-semibold tracking-tight">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <div className="mb-2 flex justify-between text-[12.5px] text-fg2">
            <span>Senior leverage, times LTM EBITDA</span>
            <b className="font-semibold text-info">{fx(m.lev)}</b>
          </div>
          <Slider
            label="Senior leverage"
            value={m.lev}
            min={3}
            max={6.5}
            step={0.25}
            onValueChange={v => setM(x => ({ ...x, lev: v }))}
          />
        </div>
        <div className="overflow-hidden rounded-panel border border-line">
          <div className="flex items-center justify-between border-b border-line/60 px-5 py-2.5">
            <h3 className="text-[13px] font-semibold">Sources and uses</h3>
            <span className="text-xs text-fg3">{d.unit}</span>
          </div>
          <table className="w-full text-[13px] tnum">
            <tbody>
              <tr>
                <td colSpan={2} className="px-4 pb-1 pt-2.5 text-xs text-fg3">
                  Uses
                </td>
              </tr>
              {[
                [`Buy the equity at ${sharePx(d, L.offer)}`, L.ev0 - d.netDebt],
                [
                  <button
                    key="nd"
                    onClick={() => openEv('nd')}
                    className="underline decoration-gold/50 underline-offset-[3px] hover:text-gold"
                  >
                    Refinance net debt
                  </button>,
                  d.netDebt
                ],
                ['Fees and expenses at 2.5%', L.fees]
              ].map(([l, v], i) => (
                <tr key={i}>
                  <td className="px-4 py-1.5">{l}</td>
                  <td className="px-4 py-1.5 text-right">{fm(v)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="border-t border-line2 px-4 py-2">Total uses</td>
                <td className="border-t border-line2 px-4 py-2 text-right">{fm(L.ev0 + L.fees)}</td>
              </tr>
              <tr>
                <td colSpan={2} className="px-4 pb-1 pt-2.5 text-xs text-fg3">
                  Sources
                </td>
              </tr>
              {[
                [`Senior debt at ${fx(m.lev)}, ${fp(d.rate)} interest`, L.debt0],
                ['Sponsor equity', L.eq0]
              ].map(([l, v]) => (
                <tr key={l}>
                  <td className="px-4 py-1.5">{l}</td>
                  <td className="px-4 py-1.5 text-right">{fm(v)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="border-t border-line2 px-4 py-2">Total sources</td>
                <td className="border-t border-line2 px-4 py-2 text-right">{fm(L.debt0 + L.eq0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="overflow-hidden rounded-panel border border-line">
          <div className="flex items-center justify-between border-b border-line/60 px-5 py-2.5">
            <h3 className="text-[13px] font-semibold">IRR by entry and exit multiple</h3>
            <span className="text-xs text-fg3">Select a cell to use it</span>
          </div>
          <div className="overflow-x-auto p-3">
            <table className="w-full border-separate border-spacing-[3px] text-[12.5px] tnum">
              <thead>
                <tr>
                  <th className="pr-2 text-right text-xs font-medium text-fg3">Entry, exit</th>
                  {exits.map(x => (
                    <th key={x} className="text-xs font-medium text-fg3">
                      {fx(x)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(en => (
                  <tr key={en}>
                    <th className="whitespace-nowrap pr-2 text-right text-xs font-medium text-fg2">
                      {fx(en)} <span className="text-fg3">{sharePx(d, perShareFromEV(d, en * o.eb[d.nAct - 1]))}</span>
                    </th>
                    {exits.map(ex => {
                      const r2 = lbo(d, o, en, ex, m.lev),
                        on = Math.abs(en - m.entry) < 0.01 && Math.abs(ex - m.exit) < 0.01;
                      return (
                        <td
                          key={ex}
                          onClick={() => setM(x => ({ ...x, entry: en, exit: ex }))}
                          title={`Money multiple ${r2.moic.toFixed(2)}x`}
                          className={cn(
                            'h-10 cursor-pointer rounded-md text-center font-medium transition-transform hover:scale-[1.04]',
                            on && 'ring-2 ring-fg'
                          )}
                          style={{ background: heat(r2.irr) }}
                        >
                          {fp(r2.irr)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="overflow-hidden rounded-panel border border-line">
          <div className="flex items-center justify-between border-b border-line/60 px-5 py-2.5">
            <h3 className="text-[13px] font-semibold">Debt paydown</h3>
            <span className="text-xs text-fg3">Full cash sweep; leverage above each bar</span>
          </div>
          <div className="px-3 pb-2 pt-1">
            <DebtBars rows={debtRows} />
          </div>
        </div>
      </div>
    </div>
  );
}
