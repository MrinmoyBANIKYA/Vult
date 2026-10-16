import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Home as HomeI,
  Radar,
  Briefcase,
  BookOpen,
  FileSpreadsheet,
  Activity,
  Keyboard,
  Search,
  ChevronDown,
  Check,
  Plus,
  Sun,
  Moon,
  Bell,
  Menu,
  Eye,
  MessageSquare,
  ShieldCheck,
  Globe,
  LogOut
} from 'lucide-react';
import {
  Button,
  Badge,
  Kbd,
  Tip,
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSep,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Progress,
  CommandDialog,
  CmdInput,
  CmdList,
  CmdGroup,
  CmdItem,
  CmdEmpty,
  Dialog,
  DialogContent
} from '../components/ui.jsx';
import { Mark, Av, CoLogo } from '../components/shared.jsx';
import { R, TABS, initials } from '../lib/engine.js';
import { TAB_ICON, TAB_KEY } from './tabs.js';
import { KMOD } from '../lib/keys.js';
import { cn } from '../lib/utils.js';
import { useA } from '../lib/context.js';

const NAV = [
  ['home', HomeI, 'Home'],
  ['desk', FileSpreadsheet, 'Filing desk'],
  ['autopilot', Radar, 'Autopilot'],
  ['engagements', Briefcase, 'Engagements'],
  ['library', BookOpen, 'Library'],
  ['platform', Activity, 'Platform']
];
const dotFor = s =>
  s === 'run'
    ? 'bg-gold shadow-[0_0_8px_hsl(var(--gold))] animate-pulse2'
    : s === 'ok'
      ? 'bg-pos'
      : s === 'rev'
        ? 'bg-info'
        : 'bg-fg3';
function useNav() {
  const { route, go, approvals, d } = useA();
  const eng = route.v === 'engagement';
  const on = k => (k === 'library' ? eng && route.tab === 'sources' : route.v === k);
  const open = k => (k === 'library' ? go('engagement', 'sources') : go(k));
  const meta = { autopilot: approvals.length || null, engagements: d.engagements.length, library: d.docs.length };
  return { on, open, meta };
}

/* ---------------------------------------------------------------- rail (desktop) */
function RailBtn({ on, label, kbd, onClick, children, badge }) {
  return (
    <Tip label={label} side="right" kbd={kbd}>
      <button
        onClick={onClick}
        aria-label={label}
        aria-current={on ? 'page' : undefined}
        className={cn(
          'group relative grid h-11 w-11 place-items-center rounded-2xl transition-all duration-200',
          on
            ? 'bg-linear-to-b from-fg/11 to-fg/5 text-fg shadow-[inset_0_1px_0_hsl(0_0%_100%/.08)]'
            : 'text-fg3 hover:bg-fg/5 hover:text-fg'
        )}
      >
        {children}
        {badge ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-chrome">
            {badge}
          </span>
        ) : null}
        {on && (
          <motion.span
            layoutId="rail-ind"
            className="absolute right-[-16px] top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-l-full bg-gold shadow-[0_0_14px_2px_hsl(var(--gold)/.7)]"
            transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }}
          />
        )}
      </button>
    </Tip>
  );
}
export function Rail() {
  const { d, route, go, run, setKeys, theme, toggleTheme } = useA();
  const { on, open, meta } = useNav();
  const eng = route.v === 'engagement';
  const pins = [
    {
      n: d.project,
      mono: d.mono,
      s: run.status === 'done' ? 'ok' : run.status === 'paused' ? 'draft' : 'run',
      main: true
    },
    ...d.engagements.slice(1, 3).map(e => ({ n: e.n, mono: initials(e.t), s: e.s }))
  ];
  return (
    <nav aria-label="Main" className="flex h-full w-[76px] shrink-0 flex-col items-center gap-1.5 pb-4 pt-2">
      {NAV.map(([k, I, l], i) => {
        const isOn = on(k);
        return (
          <RailBtn
            key={k}
            on={isOn}
            label={l}
            kbd={k === 'library' ? 'G L' : k === 'desk' ? 'G F' : 'G ' + l[0]}
            onClick={() => open(k)}
            badge={k === 'autopilot' ? meta.autopilot : null}
          >
            <I
              size={19}
              strokeWidth={isOn ? 2.1 : 1.8}
              className={cn(isOn && 'text-gold drop-shadow-[0_0_6px_hsl(var(--gold)/.6)]')}
            />
          </RailBtn>
        );
      })}
      <span className="my-2 h-px w-7 bg-line2" />
      {pins.map(p => {
        const isOn = p.main && eng && route.tab !== 'sources';
        return (
          <RailBtn
            key={p.n}
            on={isOn}
            label={p.n}
            onClick={() =>
              p.main ? go('engagement', eng && route.tab !== 'sources' ? route.tab : 'run') : go('engagements')
            }
          >
            <span className="relative">
              <CoLogo text={p.mono} tg={p.main} size={30} />
              <i
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-chrome',
                  dotFor(p.s)
                )}
              />
            </span>
          </RailBtn>
        );
      })}
      <div className="mt-auto flex flex-col items-center gap-1.5">
        <RailBtn label={theme === 'light' ? 'Dark theme' : 'Light theme'} onClick={toggleTheme}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </RailBtn>
        <RailBtn label="Keyboard shortcuts" kbd="?" onClick={() => setKeys(true)}>
          <Keyboard size={18} />
        </RailBtn>
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------------- mobile navigation */
export function MobileNav() {
  const { d, ws, setWs, go, run, setKeys } = useA();
  const { on, open, meta } = useNav();
  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2.5 px-1">
        <Mark size={30} />
        <b className="text-[19px] font-bold tracking-[-.03em]">Vult</b>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-fg/5 p-1">
        {['uk', 'us'].map(k => (
          <button
            key={k}
            onClick={() => setWs(k)}
            className={cn(
              'h-8 rounded-full text-[12.5px] font-semibold transition-colors',
              ws === k ? 'bg-overlay text-fg shadow-[inset_0_1px_0_hsl(0_0%_100%/.08)]' : 'text-fg3'
            )}
          >
            {R[k].orgMono}, {k === 'uk' ? 'London' : 'New York'}
          </button>
        ))}
      </div>
      {NAV.map(([k, I, l]) => {
        const isOn = on(k),
          m = meta[k];
        return (
          <button
            key={k}
            onClick={() => open(k)}
            aria-current={isOn ? 'page' : undefined}
            className={cn(
              'flex h-11 items-center gap-3 rounded-2xl px-3 text-left text-[14px] font-medium',
              isOn ? 'bg-fg/8 text-fg' : 'text-fg2'
            )}
          >
            <I size={18} className={isOn ? 'text-gold' : 'text-fg3'} />
            <span className="flex-1">{l}</span>
            {m ? (
              <span
                className={cn(
                  'text-xs',
                  k === 'autopilot'
                    ? 'grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 font-bold text-white'
                    : 'text-fg3'
                )}
              >
                {m}
              </span>
            ) : null}
          </button>
        );
      })}
      <div className="px-3 pb-1 pt-4 text-xs font-semibold text-fg3">Pinned</div>
      <button
        onClick={() => go('engagement', 'run')}
        className="flex h-11 items-center gap-3 rounded-2xl px-3 text-left text-[14px] font-medium text-fg2"
      >
        <CoLogo text={d.mono} tg size={26} />
        <span className="flex-1 truncate">{d.project}</span>
        <span className={cn('h-2 w-2 rounded-full', dotFor(run.status === 'done' ? 'ok' : 'run'))} />
      </button>
      {d.engagements.slice(1, 3).map(e => (
        <button
          key={e.n}
          onClick={() => go('engagements')}
          className="flex h-11 items-center gap-3 rounded-2xl px-3 text-left text-[14px] font-medium text-fg2"
        >
          <CoLogo text={initials(e.t)} size={26} />
          <span className="flex-1 truncate">{e.n}</span>
          <span className={cn('h-2 w-2 rounded-full', dotFor(e.s))} />
        </button>
      ))}
      <div className="mt-auto flex flex-col gap-3 pt-5">
        <button
          onClick={() => setKeys(true)}
          className="flex h-10 items-center gap-3 rounded-2xl px-3 text-left text-[13.5px] text-fg2"
        >
          <Keyboard size={17} className="text-fg3" />
          Keyboard shortcuts
        </button>
        <div className="flex items-center gap-2.5 rounded-2xl bg-fg/4 p-3">
          <Av n={d.me.n} size={34} ring={false} />
          <span className="flex min-w-0 flex-col leading-tight">
            <b className="text-[13.5px] font-semibold">{d.me.n}</b>
            <span className="truncate text-xs text-fg3">
              {d.me.r}, {d.org}
            </span>
          </span>
        </div>
        <p className="px-1 text-[11px] leading-snug text-fg3">
          Concept product. Every company, client and figure here is fictional.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- header */
export function Header({ wide }) {
  const { d, ws, setWs, go, setSbOpen, theme, toggleTheme, dock, toggleAsk, setPal, setKeys, focusComposer, live } =
    useA();
  const newEng = focusComposer;
  const askOn = dock && dock.k === 'ask';
  const notes = [
    [ShieldCheck, `${d.project} hallmarked`, `Fineness 999, signed by ${d.reviewer}`, '23m', 'delivery', 'pos'],
    [MessageSquare, `${d.team[0]} commented on the IC memo`, d.comments[0].text, '12m', 'memo', 'info'],
    [Eye, `${d.peer.n} is in the model`, `Looking at cell ${d.peer.cell}, scenario summary`, 'now', 'model', 'presence']
  ];
  const iconBtn =
    'relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line/80 bg-raised/70 text-fg2 transition-colors hover:border-line2 hover:text-fg';
  return (
    <header className="flex h-[68px] shrink-0 items-center gap-2 pr-3 sm:gap-3 sm:pr-5">
      {wide ? (
        <button onClick={() => go('home')} className="flex w-[76px] shrink-0 justify-center" aria-label="Vult home">
          <Mark size={34} />
        </button>
      ) : (
        <div className="flex items-center gap-1 pl-2">
          <button
            onClick={() => setSbOpen(true)}
            aria-label="Open navigation"
            className="grid h-10 w-10 place-items-center rounded-full text-fg2 hover:text-fg"
          >
            <Menu size={19} />
          </button>
          <button onClick={() => go('home')} aria-label="Vult home">
            <Mark size={28} />
          </button>
        </div>
      )}
      {wide && <b className="-ml-1.5 mr-1 text-[21px] font-bold tracking-[-.035em]">Vult</b>}
      {wide && (
        <Dropdown>
          <DropdownTrigger asChild>
            <button className="flex h-10 items-center gap-2 rounded-full border border-line/80 bg-raised/70 pl-1.5 pr-3 text-[13px] font-medium text-fg2 transition-colors hover:border-line2 hover:text-fg">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-fg/8 text-[10px] font-bold text-fg">
                {d.orgMono}
              </span>
              <span className="max-xl:hidden">{d.org}</span>
              <ChevronDown size={14} className="text-fg3" />
            </button>
          </DropdownTrigger>
          <DropdownContent className="w-[280px]" onCloseAutoFocus={e => e.preventDefault()}>
            <DropdownLabel>Workspaces</DropdownLabel>
            {['uk', 'us'].map(k => (
              <DropdownItem key={k} onSelect={() => setWs(k)}>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-fg/8 text-[10.5px] font-bold">
                  {R[k].orgMono}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <b className="font-semibold">{R[k].org}</b>
                  <span className="text-xs text-fg3">{R[k].orgDesc}</span>
                </span>
                {ws === k && <Check size={15} className="text-gold" />}
              </DropdownItem>
            ))}
            <DropdownSep />
            <DropdownItem onSelect={() => {}}>
              <Plus size={15} className="text-fg3" />
              Add a workspace
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      )}
      <div className="flex min-w-0 flex-1 justify-center">
        <button
          onClick={() => setPal(true)}
          className={cn(
            'group flex h-10 min-w-0 items-center gap-2.5 rounded-full border border-line/80 bg-raised/70 text-left text-[13px] text-fg3 transition-all hover:border-line2 hover:text-fg2',
            wide
              ? 'w-full max-w-[460px] px-4'
              : 'ml-auto w-10 justify-center sm:w-full sm:max-w-[360px] sm:justify-start sm:px-4'
          )}
          aria-label="Search or ask"
        >
          <Search size={16} className="shrink-0" />
          <span className="flex-1 truncate max-sm:hidden">Search engagements, figures and sources</span>
          <Kbd className="max-sm:hidden">{KMOD === '⌘' ? '⌘K' : 'Ctrl K'}</Kbd>
        </button>
      </div>
      <Popover>
        <Tip label="Notifications">
          <PopoverTrigger asChild>
            <button aria-label="Notifications" className={cn(iconBtn, 'max-sm:hidden')}>
              <Bell size={17} />
              <span className="absolute right-[10px] top-[9px] h-2 w-2 rounded-full bg-brand ring-2 ring-raised" />
            </button>
          </PopoverTrigger>
        </Tip>
        <PopoverContent className="w-[360px]">
          <div className="flex items-center justify-between px-2 pb-1.5 pt-1.5">
            <b className="text-[13px] font-semibold">Notifications</b>
            <span className="text-xs text-fg3">3 new</span>
          </div>
          {notes.map(([I, a, b, t, tab, tone]) => (
            <button
              key={a}
              onClick={() => go('engagement', tab)}
              className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-fg/5"
            >
              <span
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-full',
                  {
                    pos: 'bg-pos/12 text-pos',
                    info: 'bg-info/12 text-info',
                    presence: 'bg-presence/[.14] text-presence'
                  }[tone]
                )}
              >
                <I size={16} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-snug">
                <b className="text-[13px] font-semibold">{a}</b>
                <span className="truncate text-xs text-fg3">{b}</span>
              </span>
              <span className="text-[11px] text-fg3">{t}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
      <Tip label="Ask Vult" kbd={`${KMOD} J`}>
        <button
          onClick={toggleAsk}
          aria-pressed={askOn}
          aria-label="Ask Vult"
          className={cn(
            'inline-flex h-10 shrink-0 items-center gap-2 rounded-full pl-1.5 text-[13px] font-semibold transition-all',
            wide ? 'pr-4' : 'pr-1.5',
            askOn
              ? 'bg-fg text-chrome shadow-[0_0_0_4px_hsl(var(--gold)/.25)]'
              : 'border border-line/80 bg-raised/70 text-fg hover:border-gold/60'
          )}
        >
          <Mark size={28} tile />
          {wide && 'Ask Vult'}
        </button>
      </Tip>
      {wide && (
        <Button variant="primary" className="h-10 shrink-0 rounded-full px-4" onClick={newEng}>
          <Plus size={15} />
          New engagement
        </Button>
      )}
      <Dropdown>
        <DropdownTrigger asChild>
          <button
            aria-label="Account"
            className="flex h-10 shrink-0 items-center gap-2.5 rounded-full pl-0.5 pr-1 transition-colors hover:bg-fg/4 sm:pr-2"
          >
            <Av n={d.me.n} size={38} ring={false} />
            {wide && (
              <span className="flex flex-col text-left leading-tight max-2xl:hidden">
                <b className="text-[13px] font-semibold">{d.me.n}</b>
                <span className="text-[11.5px] text-fg3">{d.me.r}</span>
              </span>
            )}
            <ChevronDown size={14} className="text-fg3 max-sm:hidden" />
          </button>
        </DropdownTrigger>
        <DropdownContent align="end" className="w-[290px]" onCloseAutoFocus={e => e.preventDefault()}>
          <div className="flex items-center gap-3 px-2.5 pb-3 pt-2">
            <Av n={d.me.n} size={40} ring={false} />
            <span className="flex min-w-0 flex-col leading-tight">
              <b className="text-[14px] font-semibold">{d.me.n}</b>
              <span className="truncate text-xs text-fg3">
                {d.me.r}, {d.org}
              </span>
            </span>
          </div>
          <DropdownSep />
          <DropdownLabel>Workspace</DropdownLabel>
          {['uk', 'us'].map(k => (
            <DropdownItem key={k} onSelect={() => setWs(k)}>
              <Globe size={15} className="text-fg3" />
              <span className="flex-1">{R[k].org}</span>
              {ws === k && <Check size={15} className="text-gold" />}
            </DropdownItem>
          ))}
          <DropdownSep />
          <DropdownItem onSelect={toggleTheme}>
            {theme === 'light' ? <Moon size={15} className="text-fg3" /> : <Sun size={15} className="text-fg3" />}
            <span className="flex-1">{theme === 'light' ? 'Dark theme' : 'Light theme'}</span>
          </DropdownItem>
          <DropdownItem onSelect={() => setKeys(true)}>
            <Keyboard size={15} className="text-fg3" />
            <span className="flex-1">Keyboard shortcuts</span>
            <Kbd>?</Kbd>
          </DropdownItem>
          <DropdownSep />
          {live.connected ? (
            <>
              <div className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-fg3">
                <span className={cn('h-2 w-2 rounded-full', live.status === 'error' ? 'bg-neg' : 'bg-pos')} />
                <span className="min-w-0 flex-1 truncate">
                  {live.status === 'error' ? 'Supabase unreachable, showing demo data' : 'Synced with Supabase'}
                </span>
              </div>
              <DropdownItem onSelect={() => live.signOut()}>
                <LogOut size={15} className="text-fg3" />
                <span className="flex-1">Sign out</span>
                <span className="max-w-[120px] truncate text-xs text-fg3">{live.email}</span>
              </DropdownItem>
            </>
          ) : (
            <p className="px-2.5 pb-1.5 pt-1 text-[11.5px] leading-snug text-fg3">
              Demo mode. Every company, client and figure here is fictional. Add Supabase keys to .env.local to sign in
              and save your work.
            </p>
          )}
        </DropdownContent>
      </Dropdown>
    </header>
  );
}

export function Palette() {
  const { pal } = useA();
  // Remounting on open gives every session a fresh, empty query.
  return <PaletteDialog key={pal ? 'open' : 'closed'} />;
}

function PaletteDialog() {
  const { pal, setPal, cmds, ask } = useA();
  const [q, setQ] = React.useState('');
  const groups = [];
  cmds.forEach(c => {
    let g = groups.find(x => x.g === c.g);
    if (!g) {
      g = { g: c.g, items: [] };
      groups.push(g);
    }
    g.items.push(c);
  });
  const run = fn => {
    setPal(false);
    setTimeout(fn, 30);
  };
  return (
    <CommandDialog open={pal} onOpenChange={setPal}>
      <div className="flex items-center gap-2 pl-4">
        <Search size={16} className="text-fg3" />
        <CmdInput value={q} onValueChange={setQ} placeholder="Jump anywhere, run a command, or ask Vult a question" />
      </div>
      <CmdList>
        {q.trim() && (
          <CmdGroup heading="Ask">
            <CmdItem value={'ask vult ' + q} onSelect={() => run(() => ask(q.trim()))}>
              <Mark size={22} tile />
              <span className="flex-1">Ask Vult: “{q}”</span>
              <Kbd>↵</Kbd>
            </CmdItem>
          </CmdGroup>
        )}
        <CmdEmpty className="px-3 py-6 text-center text-[13px] text-fg3">
          No commands match. Press Enter to ask Vult.
        </CmdEmpty>
        {groups.map(g => (
          <CmdGroup key={g.g} heading={g.g}>
            {g.items.map(c => (
              <CmdItem key={g.g + c.l} value={`${c.l} ${c.s || ''} ${g.g}`} onSelect={() => run(c.run)}>
                <c.i size={15} />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate">{c.l}</span>
                  {c.s && <span className="truncate text-xs text-fg3">{c.s}</span>}
                </span>
                {c.k && (
                  <span className="flex gap-1">
                    {c.k.split(' ').map(k => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                )}
              </CmdItem>
            ))}
          </CmdGroup>
        ))}
      </CmdList>
      <div className="flex gap-4 border-t border-line px-4 py-2 text-xs text-fg3">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> to move
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> to open
        </span>
        <span className="flex items-center gap-1">
          <Kbd>esc</Kbd> to close
        </span>
      </div>
    </CommandDialog>
  );
}

export function KeysDialog() {
  const { keys, setKeys } = useA();
  const K = [
    ['Command palette', [KMOD, 'K']],
    ['Ask Vult', [KMOD, 'J']],
    ['Close panel', ['Esc']],
    ['Show shortcuts', ['?']],
    ['Home', ['G', 'H']],
    ['Autopilot', ['G', 'A']],
    ['Engagements', ['G', 'E']],
    ['Platform', ['G', 'P']],
    ...TABS.map(([k, l]) => [l, ['G', TAB_KEY[k]]])
  ];
  return (
    <Dialog open={keys} onOpenChange={setKeys}>
      <DialogContent label="Keyboard shortcuts">
        <div className="flex h-[52px] items-center gap-2.5 border-b border-line/60 px-5">
          <Keyboard size={16} className="text-fg3" />
          <b className="flex-1 font-semibold">Keyboard shortcuts</b>
        </div>
        <div className="grid grid-cols-1 gap-x-8 px-5 py-3 sm:grid-cols-2">
          {K.map(([l, ks]) => (
            <div
              key={l}
              className="flex items-center justify-between border-b border-line/60 py-2 text-[13px] text-fg2"
            >
              {l}
              <span className="flex gap-1">
                {ks.map(k => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TabBar() {
  const { route, go, run } = useA();
  const p = run.plan;
  const state = k => {
    if (k === 'run') return 'ready';
    const at = p.outs[k];
    if (at == null) return 'off';
    if (run.status !== 'done' && run.t < at) return 'wait';
    return 'ready';
  };
  return (
    <div className="sticky top-0 z-20 bg-linear-to-b from-chrome via-chrome/95 to-chrome/0 px-7 pb-3 pt-2 max-lg:px-4">
      <div
        role="tablist"
        aria-label="Engagement views"
        className="flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-full border border-line/80 bg-raised/80 p-1 shadow-[inset_0_1px_0_hsl(0_0%_100%/.03)] backdrop-blur-xl scrollbar-none"
      >
        {TABS.map(([k, l]) => {
          const s = state(k),
            on = route.tab === k,
            I = TAB_ICON[k];
          return (
            <button
              key={k}
              role="tab"
              aria-selected={on}
              onClick={() => go('engagement', k)}
              className={cn(
                'relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                on ? 'text-fg' : s === 'off' ? 'text-fg3/70' : 'text-fg3 hover:text-fg'
              )}
            >
              {on && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-full bg-linear-to-b from-fg/13 to-fg/6 shadow-[inset_0_1px_0_hsl(0_0%_100%/.09)]"
                  transition={{ type: 'spring', bounce: 0.16, duration: 0.42 }}
                />
              )}
              <I size={14} className={cn('relative', on ? 'text-gold' : '')} />
              <span className="relative">{l}</span>
              {s === 'wait' && (
                <span className="relative h-1.5 w-1.5 animate-pulse2 rounded-full bg-gold" aria-label="building" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
