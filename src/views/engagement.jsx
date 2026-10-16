import * as React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, ChevronDown, Check, Users, Lock, Pause, Play } from 'lucide-react';
import {
  Button,
  Tip,
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  Popover,
  PopoverTrigger,
  PopoverContent
} from '../components/ui.jsx';
import { CoLogo, Status, Building, Empty, Av, Avs, Num, PxNum } from '../components/shared.jsx';
import { cn } from '../lib/utils.js';
import { useA } from '../lib/context.js';
import { F } from '../lib/format.js';
import { calc, initials } from '../lib/engine.js';
import { TabBar } from './shell.jsx';
import { RunView } from './run.jsx';
import { CompanyView } from './company.jsx';
import { ModelView } from './model.jsx';
import { CompsView, MatrixView, MarketView } from './analysis.jsx';
import { MemoView } from './memo.jsx';
import { DeckView } from './deck.jsx';
import { SourcesView, DeliveryView } from './library.jsx';

const TAB_VIEWS = {
  run: RunView,
  company: CompanyView,
  model: ModelView,
  comps: CompsView,
  compet: MatrixView,
  market: MarketView,
  memo: MemoView,
  deck: DeckView,
  sources: SourcesView,
  delivery: DeliveryView
};

/** The flagship engagement: header with live valuation, run controls, tab bar and the active tab. */
export function EngagementView() {
  const { d, run, route, go, m, pause, resume, startNew } = useA();
  const p = run.plan,
    tab = route.tab;
  const at = p.outs[tab],
    st = tab === 'run' ? 'ready' : at == null ? 'off' : run.status !== 'done' && run.t < at ? 'wait' : 'ready';
  const V = TAB_VIEWS[tab];
  const o = React.useMemo(() => calc(d, m.scen, m.wacc, m.tgr), [d, m.scen, m.wacc, m.tgr]);
  const running = run.status === 'running';
  let body;
  if (st === 'off')
    body = (
      <Empty
        title="Not in this brief"
        body="Add it to the brief and run the engagement again to build it."
        action={
          <button
            className="mt-2 text-[13px] font-medium text-gold underline underline-offset-4"
            onClick={() => go('home')}
          >
            Edit the brief
          </button>
        }
      />
    );
  else if (st === 'wait' && tab !== 'compet' && tab !== 'delivery') body = <Building at={at} />;
  else body = <V />;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4 px-7 pb-3 pt-2 max-lg:px-4">
        <CoLogo text={d.mono} tg size={48} className="text-[15px] max-sm:hidden" />
        <div className="min-w-0">
          <Dropdown>
            <DropdownTrigger asChild>
              <button className="group flex items-center gap-2 rounded-xl text-left">
                <h1 className="text-[26px] font-bold leading-tight tracking-[-.035em] sm:text-[30px]">{d.project}</h1>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-fg/6 text-fg2 transition-colors group-hover:bg-fg/10">
                  <ChevronDown size={15} />
                </span>
              </button>
            </DropdownTrigger>
            <DropdownContent className="w-[300px]" onCloseAutoFocus={e => e.preventDefault()}>
              <DropdownLabel>Engagements</DropdownLabel>
              {[{ n: d.project, t: d.target }, ...d.engagements.slice(1, 5)].map((e, i) => (
                <DropdownItem key={e.n} onSelect={() => (i ? go('engagements') : go('engagement', 'run'))}>
                  <CoLogo text={i ? initials(e.t) : d.mono} tg={!i} size={28} />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <b className="font-semibold">{e.n}</b>
                    <span className="truncate text-xs text-fg3">{e.t}</span>
                  </span>
                  {!i && <Check size={15} className="text-gold" />}
                </DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg3">
            <span className="font-medium text-fg2">
              {d.target}, {d.ticker}
            </span>
            <span>{d.type}</span>
            <span>
              {d.gaap}, {d.fy}
            </span>
          </div>
        </div>
        <div className="flex items-end gap-6 max-sm:w-full max-sm:justify-between lg:ml-6">
          <div>
            <div className="text-xs font-medium text-fg3">
              Implied value, {o.vps ? (m.scen === 'base' ? 'base case' : m.scen + ' case') : ''}
            </div>
            <div className="flex items-baseline gap-2">
              <PxNum d={d} v={o.vps} className="text-[24px] font-bold tracking-[-.03em]" />
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[12px] font-bold',
                  o.up >= 0 ? 'bg-pos/[.14] text-pos' : 'bg-neg/[.14] text-neg'
                )}
              >
                <Num value={o.up} fmt={F.pctS} />
              </span>
            </div>
          </div>
          <div className="max-md:hidden">
            <div className="text-xs font-medium text-fg3">Last close</div>
            <PxNum d={d} v={d.price} className="text-[17px] font-semibold tracking-[-.02em] text-fg2" />
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 max-sm:ml-0">
          <Status
            s={run.status === 'done' ? 'ok' : run.status === 'paused' ? 'paused' : 'run'}
            p={(run.t / p.total) * 100}
          />
          <Tip label="Online now">
            <span className="mx-1 max-md:hidden">
              <Avs list={[d.me.n, ...d.team.slice(0, 2)]} live size={30} />
            </span>
          </Tip>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 rounded-full px-4">
                <Users size={15} />
                Share
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[330px]">
              <div className="px-2 pb-1 pt-1.5 text-xs font-medium text-fg3">People with access to {d.project}</div>
              {[d.me.n, ...d.team, d.reviewer].map((n, i, a) => (
                <div key={n} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
                  <Av n={n} size={30} ring={false} />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <b className="text-[13px] font-semibold">{n}</b>
                    <span className="text-xs text-fg3">
                      {i === 0 ? 'Owner' : i === a.length - 1 ? 'Reviewer' : 'Deal team'}
                    </span>
                  </span>
                  <span className="text-xs text-fg3">
                    {i === 0 ? 'Owner' : i === a.length - 1 ? 'Can review' : 'Can edit'}
                  </span>
                </div>
              ))}
              <div className="my-1 h-px bg-line" />
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                <Lock size={15} className="text-fg3" />
                <span className="flex flex-col leading-tight">
                  <b className="text-[13px] font-semibold">Information barrier is on</b>
                  <span className="text-xs text-fg3">Only this deal team and its reviewer can open it</span>
                </span>
              </div>
            </PopoverContent>
          </Popover>
          {running ? (
            <Button variant="outline" className="h-10 rounded-full px-4" onClick={pause}>
              <Pause size={15} />
              Pause
            </Button>
          ) : run.status === 'paused' ? (
            <Button variant="primary" className="h-10 rounded-full px-4" onClick={resume}>
              <Play size={15} />
              Resume
            </Button>
          ) : (
            <Button variant="primary" className="h-10 rounded-full px-4" onClick={startNew}>
              <RotateCcw size={15} />
              Run again
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-7 pb-2 text-[12.5px] text-fg3 max-lg:px-4">
        <span>
          Owner <b className="font-semibold text-fg2">{d.me.n}</b>
        </span>
        <span>
          Reviewer <b className="font-semibold text-fg2">{d.reviewer}</b>
        </span>
        <span>
          Format <b className="font-semibold text-fg2">{d.style}</b>
        </span>
      </div>
      <div className="mx-7 mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-info/25 bg-info/6 px-4 py-2.5 text-[12.5px] text-fg2 max-lg:mx-4">
        <span>
          <b className="font-semibold text-fg">Scripted demo.</b> This engagement, its run, checks and files are
          illustrative. The Filing desk runs the real engine on a filing you upload.
        </span>
        <button className="font-semibold text-gold underline-offset-4 hover:underline" onClick={() => go('desk')}>
          Open the Filing desk
        </button>
      </div>
      <TabBar />
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="px-7 pb-14 pt-3 max-lg:px-4"
      >
        {body}
      </motion.div>
    </div>
  );
}
