import * as React from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { Panel as RPanel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Toaster, toast } from 'sonner';
import {
  Home as HomeI,
  Radar,
  Briefcase,
  Activity,
  MessageSquare,
  RotateCcw,
  Plus,
  Globe,
  Sun,
  Moon,
  Keyboard,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { TooltipProvider, Sheet } from './components/ui.jsx';
import { cn } from './lib/utils.js';
import { Ctx, useMedia } from './lib/context.js';
import { KMOD } from './lib/keys.js';
import { R, ALL, TABS, planFor, defaultEntry, copilot, filesFor, hm, initials } from './lib/engine.js';
import { AUTO } from './lib/autopilot.js';
import * as api from './lib/api.js';
import { useSession } from './auth/session.js';
import { useLiveWorkspace } from './hooks/useLiveWorkspace.js';
import { Rail, Header, MobileNav, Palette, KeysDialog } from './views/shell.jsx';
import { Home, Autopilot } from './views/home.jsx';
import { EngagementView } from './views/engagement.jsx';
import { EngagementsView, PlatformView } from './views/library.jsx';
import { EvidencePanel, CellPanel, AskPanel } from './views/panels.jsx';
// The Filing desk carries ExcelJS, docx and pdf.js, so it loads only when opened.
const DeskView = React.lazy(() => import('./views/desk.jsx').then(m => ({ default: m.DeskView })));
import { TAB_ICON, TAB_KEY, KEY_TAB } from './views/tabs.js';
import { DemoBanner, FirmEngagements, FirmHome } from './views/firm.jsx';

/* ------------------------------------------------------------------ routing */
const VIEWS = ['home', 'desk', 'autopilot', 'engagements', 'platform'];
const GO = { h: 'home', f: 'desk', a: 'autopilot', e: 'engagements', p: 'platform' };

function parseHash() {
  const h = (window.location.hash || '').slice(1);
  if (VIEWS.includes(h)) return { v: h, tab: 'run' };
  if (TABS.some(t => t[0] === h)) return { v: 'engagement', tab: h };
  return { v: 'home', tab: 'run' };
}

/* ------------------------------------------------------------------ state factories */
const mkRun = (ws, sel, priority, done, no) => {
  const plan = planFor(sel, ws, priority);
  return {
    status: done ? 'done' : 'running',
    t: done ? plan.total : 0,
    plan,
    speed: 600,
    last: performance.now(),
    deliveredAt: new Date(Date.now() - 23 * 60000),
    no
  };
};
const mkModel = d => {
  const e = defaultEntry(d);
  return {
    scen: 'base',
    wacc: d.wacc,
    tgr: d.tgr,
    cell: 'D4',
    sheet: 'DCF',
    lev: 5,
    entry: e,
    exit: e,
    v: 3,
    changed: []
  };
};

function readTheme() {
  try {
    return localStorage.getItem('vult-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark'; // storage can be blocked (private windows); dark is the brand default
  }
}

const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const sessionInfo = useSession();
  const [ws, setWsRaw] = React.useState(() => sessionInfo.homeRegion || 'uk');
  const live = useLiveWorkspace(ws, sessionInfo.live);
  const liveData = live.data;

  /* ---------------------------------------------------------------- data: demo, overlaid with Supabase rows when connected */
  const profile = sessionInfo.profile;
  // A client's own firm: only the Filing desk, which works on real filings, is shown.
  const firm = sessionInfo.firm ?? null;
  const d = React.useMemo(() => {
    const base = R[ws];
    // A real firm's user is never shown the demo analyst's name, even before their profile exists.
    const name = (profile && profile.full_name) || (firm && sessionInfo.email ? sessionInfo.email.split('@')[0] : '');
    if (!liveData && !name && !firm) return base;
    return {
      ...base,
      ...(liveData ? { engagements: liveData.engagements } : null),
      ...(firm ? { org: firm.name, orgMono: initials(firm.name), orgDesc: '' } : null),
      ...(name ? { me: { ...base.me, n: name, r: profile?.title || (firm ? 'Analyst' : base.me.r) } } : null)
    };
  }, [ws, liveData, profile, firm, sessionInfo.email]);

  const [dismissed, setDismissed] = React.useState([]);
  const [decided, setDecided] = React.useState([]);
  const [monitorOverrides, setMonitorOverrides] = React.useState({});
  const auto = React.useMemo(() => {
    const base = AUTO[ws];
    return liveData ? { ...base, brief: liveData.brief } : base;
  }, [ws, liveData]);
  const approvals = React.useMemo(
    () => (liveData ? liveData.approvals : AUTO[ws].approvals).filter(a => !decided.includes(a.id)),
    [ws, liveData, decided]
  );
  const monitors = React.useMemo(
    () =>
      (liveData ? liveData.monitors : AUTO[ws].monitors).map(m =>
        m.id in monitorOverrides ? { ...m, on: monitorOverrides[m.id] } : m
      ),
    [ws, liveData, monitorOverrides]
  );

  /* ---------------------------------------------------------------- UI state */
  const [route, setRoute] = React.useState(parseHash);
  const [sel, setSel] = React.useState(() => new Set(ALL));
  const [priority, setPriority] = React.useState(false);
  const [prompt, setPrompt] = React.useState(R.uk.prompt);
  const [run, setRun] = React.useState(() => mkRun('uk', new Set(ALL), false, true, R.uk.runNo));
  const [m, setM] = React.useState(() => mkModel(R.uk));
  const [pal, setPal] = React.useState(false);
  const [keys, setKeys] = React.useState(false);
  const [sbOpen, setSbOpen] = React.useState(false);
  const [strike, setStrike] = React.useState(false);
  const [dock, setDock] = React.useState(null);
  const [msgs, setMsgs] = React.useState([]);
  const [sugg, setSugg] = React.useState('pending');
  const [memoExtra, setMemoExtra] = React.useState(false);
  const [srcSel, setSrcSel] = React.useState(null);
  const [deckI, setDeckI] = React.useState(0);
  const [theme, setTheme] = React.useState(readTheme);
  const wideSb = useMedia('(min-width: 1024px)'),
    wideDock = useMedia('(min-width: 1180px)');

  const viewRef = React.useRef(null),
    composerRef = React.useRef(null),
    gRef = React.useRef(0),
    mid = React.useRef(0),
    overlay = React.useRef(false),
    runRef = React.useRef(run),
    msgsRef = React.useRef(msgs),
    latest = React.useRef({});

  // Mirror state that timers and global listeners read after render.
  React.useEffect(() => {
    overlay.current = pal || keys;
  }, [pal, keys]);
  React.useEffect(() => {
    runRef.current = run;
  }, [run]);
  React.useEffect(() => {
    msgsRef.current = msgs;
  }, [msgs]);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('vult-theme', theme);
    } catch {
      // storage unavailable; the theme still applies for this visit
    }
  }, [theme]);

  /* ---------------------------------------------------------------- navigation */
  const go = React.useCallback((v, tab) => {
    setRoute(r => ({ v, tab: tab || r.tab || 'run' }));
    setSbOpen(false);
    window.history.replaceState(null, '', '#' + (v === 'engagement' ? tab || 'run' : v));
    if (viewRef.current) viewRef.current.scrollTop = 0;
  }, []);
  const focusComposer = React.useCallback(() => {
    go('home');
    setTimeout(() => {
      const el = composerRef.current;
      if (el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 120);
  }, [go]);

  const setWs = k => {
    setWsRaw(k);
    setPrompt(R[k].prompt);
    setM(mkModel(R[k]));
    setRun(mkRun(k, sel, priority, true, R[k].runNo));
    setStrike(false);
    setDock(null);
    setMsgs([]);
    setSugg('pending');
    setMemoExtra(false);
    setSrcSel(null);
    setDeckI(0);
    setDismissed([]);
    setDecided([]);
    setMonitorOverrides({});
    toast(`Switched to ${R[k].org}`, { description: `${R[k].project}, ${R[k].target}` });
  };

  /* ---------------------------------------------------------------- runs */
  const reportError = (title, err) => {
    console.error('[vult]', title, err);
    toast.error(title, { description: (err && err.message) || 'Please try again.' });
  };
  const startNew = () => {
    const n = run.no + 1;
    setRun(r => ({ ...mkRun(ws, sel, priority, false, r.no + 1), speed: r.speed }));
    setStrike(false);
    go('engagement', 'run');
    toast(`Run ${d.code}-0${n} started`, {
      description: `${sel.size} deliverables, about ${hm(planFor(sel, ws, priority).total)} end to end`
    });
    if (liveData && liveData.flagshipId)
      api
        .startRun({ engagementId: liveData.flagshipId, deliverables: [...sel], priority })
        .catch(err => reportError('The run could not be saved', err));
  };
  const pause = () => setRun(r => ({ ...r, status: 'paused' }));
  const resume = () => setRun(r => ({ ...r, status: 'running', last: performance.now() }));
  const setSpeed = v => setRun(r => ({ ...r, speed: v }));
  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  React.useEffect(() => {
    latest.current = { d, go };
  });
  // The run clock: simulated minutes advance at `speed`× real time until the plan completes.
  React.useEffect(() => {
    if (run.status !== 'running') return undefined;
    const id = setInterval(() => {
      const r = runRef.current;
      if (r.status !== 'running') return;
      const now = performance.now(),
        t = r.t + (((now - r.last) / 1000) * r.speed) / 60;
      if (t < r.plan.total) {
        runRef.current = { ...r, t, last: now };
        setRun(runRef.current);
        return;
      }
      runRef.current = { ...r, status: 'done', t: r.plan.total, deliveredAt: new Date() };
      setRun(runRef.current);
      setStrike(true);
      const { d: dd, go: nav } = latest.current;
      toast.success(`${dd.project} delivered`, {
        description: `Hallmark 999, ${filesFor(r.plan, dd).length} files in ${dd.folder}`,
        action: { label: 'View', onClick: () => nav('engagement', 'delivery') }
      });
    }, 80);
    return () => clearInterval(id);
  }, [run.status]);

  /* ---------------------------------------------------------------- dock and co-pilot */
  const openEv = React.useCallback(key => setDock({ k: 'ev', key }), []);
  const openCell = React.useCallback(rc => setDock({ k: 'cell', rc }), []);
  const closeDock = React.useCallback(() => setDock(null), []);
  const toggleAsk = React.useCallback(() => setDock(x => (x && x.k === 'ask' ? null : { k: 'ask' })), []);

  const ask = text => {
    setDock({ k: 'ask' });
    const r = copilot(text, { d, m });
    const u = ++mid.current,
      a = ++mid.current;
    // Built-in analyses answer instantly. Anything else goes to the ask-vult edge function when connected.
    const remote = Boolean(r.generic && liveData && liveData.flagshipId);
    setMsgs(ms => [
      ...ms,
      { id: u, role: 'user', text },
      { id: a, role: 'ai', r, st: 'think', ti: 0, shown: 0, pending: remote }
    ]);
    if (!remote) return;
    api
      .askVult({ engagementId: liveData.flagshipId, question: text })
      .then(res =>
        res && res.text
          ? { ...r, generic: false, text: res.text, think: res.think || r.think, cites: res.cites || [] }
          : null
      )
      .catch(err => {
        console.warn('[vult] ask-vult unavailable, using the built-in answer', err);
        return null;
      })
      .then(next => setMsgs(ms => ms.map(x => (x.id === a ? { ...x, r: next || x.r, pending: false } : x))));
  };

  const undoAct = React.useCallback(id => {
    const msg = msgsRef.current.find(x => x.id === id);
    if (!msg) return;
    if (msg.r.action.kind === 'memo') setMemoExtra(false);
    else setM(x => ({ ...x, ...msg.prev, v: x.v + 1, changed: msg.r.action.cells || [] }));
    setMsgs(ms => ms.map(x => (x.id === id ? { ...x, applied: false } : x)));
    toast('Change undone', { description: msg.r.action.title });
  }, []);
  const applyAct = id => {
    const msg = msgs.find(x => x.id === id);
    if (!msg || !msg.r.action) return;
    const act = msg.r.action;
    if (act.kind === 'memo') {
      setMemoExtra(true);
      setMsgs(ms => ms.map(x => (x.id === id ? { ...x, applied: true } : x)));
      go('engagement', 'memo');
      toast.success('Added to the IC memo', { description: 'A tracked change in the valuation section' });
      return;
    }
    const prev = {};
    Object.keys(act.patch).forEach(k => {
      prev[k] = m[k];
    });
    const ver = m.v + 1;
    setM(x => ({
      ...x,
      ...act.patch,
      v: x.v + 1,
      changed: act.cells || [],
      cell: act.cells && act.cells.length ? act.cells[0] : x.cell
    }));
    setMsgs(ms => ms.map(x => (x.id === id ? { ...x, applied: true, prev, ver } : x)));
    go('engagement', 'model');
    toast.success(`Model updated to version ${ver}`, {
      description: act.title,
      action: { label: 'Undo', onClick: () => undoAct(id) }
    });
  };
  const dismissAct = id => setMsgs(ms => ms.map(x => (x.id === id ? { ...x, dismissed: true } : x)));

  // Streams the co-pilot's answer: thinking steps first, then the text a few characters at a time.
  React.useEffect(() => {
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== 'ai' || last.st === 'done') return undefined;
    const rm = prefersReducedMotion();
    if (last.st === 'think') {
      const atLastStep = last.ti >= last.r.think.length - 1;
      if (atLastStep && last.pending) return undefined; // wait for the edge function
      const id = setTimeout(
        () =>
          setMsgs(ms =>
            ms.map(x =>
              x.id !== last.id
                ? x
                : x.ti < x.r.think.length - 1
                  ? { ...x, ti: x.ti + 1 }
                  : { ...x, st: 'stream', shown: 0 }
            )
          ),
        rm ? 40 : 460
      );
      return () => clearTimeout(id);
    }
    const id = setTimeout(
      () =>
        setMsgs(ms =>
          ms.map(x => {
            if (x.id !== last.id) return x;
            const n = x.shown + (rm ? 1e5 : 7);
            return n >= x.r.text.length ? { ...x, shown: x.r.text.length, st: 'done' } : { ...x, shown: n };
          })
        ),
      16
    );
    return () => clearTimeout(id);
  }, [msgs]);

  React.useEffect(() => {
    if (!m.changed || !m.changed.length) return undefined;
    const id = setTimeout(() => setM(x => ({ ...x, changed: [] })), 4000);
    return () => clearTimeout(id);
  }, [m.changed]);

  /* ---------------------------------------------------------------- autopilot actions */
  const decide = (a, yes) => {
    setDecided(l => [...l, a.id]);
    if (liveData) api.decideApproval(a.id, yes).catch(err => reportError('The decision was not saved', err));
    if (!yes) {
      toast('Declined', { description: 'The agent will not act on it.' });
      return;
    }
    if (a.kind === 'model_update') {
      setM(x => ({ ...x, v: x.v + 1 }));
      toast.success('Approved: downside case updated', { description: `${d.short} model saved as a new version` });
    } else if (a.kind === 'add_peer')
      toast.success('Approved: peer added', { description: 'Comps refreshed with seven peers' });
    else
      toast.success('Approved: earnings flash sent', { description: a.diff[0][2] + ' on the deal team received it' });
  };
  const toggleMonitor = (mon, on) => {
    setMonitorOverrides(o => ({ ...o, [mon.id]: on }));
    if (liveData) api.setMonitorEnabled(mon.id, on).catch(err => reportError('The agent setting was not saved', err));
  };
  const dismissBrief = id => {
    setDismissed(x => [...x, id]);
    if (liveData) api.dismissBrief(id).catch(err => reportError('Could not dismiss that item', err));
  };

  /* ---------------------------------------------------------------- keyboard and hash routing */
  React.useEffect(() => {
    const onKey = e => {
      const tag = (e.target.tagName || '').toLowerCase(),
        typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPal(p => !p);
        return;
      }
      if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleAsk();
        return;
      }
      if (e.key === 'Escape') {
        if (!overlay.current) setDock(null);
        return;
      }
      if (typing || mod || e.altKey) return;
      if (e.key === '?') {
        setKeys(x => !x);
        return;
      }
      const key = e.key.toLowerCase();
      if (gRef.current && Date.now() - gRef.current < 900) {
        gRef.current = 0;
        if (GO[key]) {
          e.preventDefault();
          go(GO[key]);
        } else if (KEY_TAB[key]) {
          e.preventDefault();
          go('engagement', KEY_TAB[key]);
        }
        return;
      }
      if (key === 'g') gRef.current = Date.now();
    };
    const onHash = () => setRoute(parseHash());
    window.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
    };
  }, [go, toggleAsk]);

  /* ---------------------------------------------------------------- command palette */
  const other = ws === 'uk' ? 'us' : 'uk';
  const cmds = [
    { g: 'Go to', l: 'Home', i: HomeI, k: 'G H', run: () => go('home') },
    {
      g: 'Go to',
      l: 'Filing desk',
      i: FileSpreadsheet,
      s: 'Build a checked model from a 10-K',
      k: 'G F',
      run: () => go('desk')
    },
    {
      g: 'Go to',
      l: 'Autopilot',
      i: Radar,
      s: `${approvals.length} waiting for a decision`,
      k: 'G A',
      run: () => go('autopilot')
    },
    { g: 'Go to', l: 'Engagements', i: Briefcase, k: 'G E', run: () => go('engagements') },
    { g: 'Go to', l: 'Platform', i: Activity, k: 'G P', run: () => go('platform') },
    ...TABS.map(([k, l]) => ({
      g: d.project,
      l,
      i: TAB_ICON[k],
      s: d.target,
      k: 'G ' + TAB_KEY[k],
      run: () => go('engagement', k)
    })),
    { g: 'Actions', l: 'Ask Vult', i: MessageSquare, k: `${KMOD} J`, run: () => setDock({ k: 'ask' }) },
    { g: 'Actions', l: `Run ${d.project} again`, i: RotateCcw, run: startNew },
    { g: 'Actions', l: 'Start a new engagement', i: Plus, run: focusComposer },
    { g: 'Actions', l: `Switch to ${R[other].org}`, i: Globe, s: R[other].orgDesc, run: () => setWs(other) },
    {
      g: 'Actions',
      l: theme === 'light' ? 'Use the dark theme' : 'Use the light theme',
      i: theme === 'light' ? Moon : Sun,
      run: toggleTheme
    },
    { g: 'Actions', l: 'Show keyboard shortcuts', i: Keyboard, k: '?', run: () => setKeys(true) },
    ...Object.keys(d.ev).map(k => ({
      g: 'Source trails',
      l: d.ev[k].l,
      i: FileText,
      s: d.ev[k].v,
      run: () => openEv(k)
    })),
    ...d.engagements.slice(1).map(e => ({
      g: 'Engagements',
      l: e.n,
      i: Briefcase,
      s: `${e.t}, ${e.ty.toLowerCase()}`,
      run: () => go('engagements')
    }))
  ];

  const ctx = {
    d,
    ws,
    setWs,
    auto,
    route,
    go,
    focusComposer,
    run,
    sel,
    setSel,
    priority,
    setPriority,
    prompt,
    setPrompt,
    startNew,
    pause,
    resume,
    setSpeed,
    composerRef,
    m,
    setM,
    strike,
    theme,
    toggleTheme,
    sbOpen,
    setSbOpen,
    dock,
    openEv,
    openCell,
    closeDock,
    toggleAsk,
    msgs,
    ask,
    applyAct,
    undoAct,
    dismissAct,
    sugg,
    setSugg,
    memoExtra,
    srcSel,
    setSrcSel,
    deckI,
    setDeckI,
    dismissed,
    dismissBrief,
    approvals,
    decide,
    monitors,
    toggleMonitor,
    pal,
    setPal,
    keys,
    setKeys,
    cmds,
    live: {
      status: live.status,
      connected: sessionInfo.live,
      real: Boolean(firm),
      orgId: liveData?.orgId ?? null,
      email: sessionInfo.email,
      signOut: sessionInfo.signOut
    }
  };

  // A client firm's Home and Engagements are its own reports; the other areas are a labelled demo preview.
  const scripted =
    route.v === 'home' ? (
      <Home />
    ) : route.v === 'autopilot' ? (
      <Autopilot />
    ) : route.v === 'engagements' ? (
      <EngagementsView />
    ) : route.v === 'platform' ? (
      <PlatformView />
    ) : (
      <EngagementView />
    );
  const view =
    route.v === 'desk' ? (
      <React.Suspense fallback={<div className="px-7 pt-6 text-[13px] text-fg3">Loading the Filing desk</div>}>
        <DeskView />
      </React.Suspense>
    ) : firm && route.v === 'home' ? (
      <FirmHome />
    ) : firm && route.v === 'engagements' ? (
      <FirmEngagements />
    ) : firm ? (
      <>
        {route.v !== 'engagement' && <DemoBanner />}
        {scripted}
      </>
    ) : (
      scripted
    );
  const dockEl = dock ? (
    dock.k === 'ev' ? (
      <EvidencePanel k={dock.key} key={dock.key} />
    ) : dock.k === 'cell' ? (
      <CellPanel rc={dock.rc} />
    ) : (
      <AskPanel />
    )
  ) : null;

  return (
    <Ctx.Provider value={ctx}>
      <TooltipProvider delayDuration={300} skipDelayDuration={150}>
        <MotionConfig reducedMotion="user">
          <div className={cn('flex h-full flex-col', dockEl && wideDock && 'dock')}>
            <Header wide={wideSb} />
            <div className="flex min-h-0 flex-1">
              {wideSb ? (
                <Rail />
              ) : (
                <Sheet open={sbOpen} onOpenChange={setSbOpen} side="left" label="Navigation">
                  <MobileNav />
                </Sheet>
              )}
              <main className="min-w-0 flex-1">
                <PanelGroup direction="horizontal" className="h-full">
                  <RPanel id="main" order={1} minSize={45}>
                    <div
                      ref={viewRef}
                      className={cn(
                        'h-full overflow-y-auto',
                        wideSb &&
                          'rounded-tl-[26px] border-l border-t border-line/70 bg-surface/60 shadow-[inset_0_1px_0_hsl(0_0%_100%/.03)]'
                      )}
                    >
                      <motion.div
                        key={route.v}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        className="pt-4"
                      >
                        {view}
                      </motion.div>
                    </div>
                  </RPanel>
                  {dockEl && wideDock && (
                    <>
                      <PanelResizeHandle className="group relative w-3 outline-hidden">
                        <span className="absolute inset-y-[45%] left-1/2 w-1 -translate-x-1/2 rounded-full bg-line2 transition-colors group-hover:bg-fg3 group-data-[resize-handle-state=drag]:bg-gold" />
                      </PanelResizeHandle>
                      <RPanel id="dock" order={2} defaultSize={31} minSize={24} maxSize={48}>
                        <motion.div
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                          className="card mb-3 mr-3 h-[calc(100%-12px)] overflow-hidden rounded-frame!"
                        >
                          {dockEl}
                        </motion.div>
                      </RPanel>
                    </>
                  )}
                </PanelGroup>
              </main>
            </div>
            {dockEl && !wideDock && (
              <Sheet
                open
                onOpenChange={o => {
                  if (!o) closeDock();
                }}
                label="Panel"
              >
                {dockEl}
              </Sheet>
            )}
            <Palette />
            <KeysDialog />
            <Toaster
              position={dockEl && wideDock ? 'bottom-center' : 'bottom-right'}
              theme={theme}
              gap={10}
              offset={20}
              toastOptions={{
                style: {
                  background: 'hsl(var(--overlay) / .92)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid hsl(var(--line2))',
                  color: 'hsl(var(--fg))',
                  borderRadius: '18px',
                  padding: '14px 16px',
                  fontFamily: 'inherit',
                  boxShadow: '0 24px 64px -16px hsl(var(--shadow) / .7), inset 0 1px 0 hsl(0 0% 100% / .05)'
                },
                classNames: {
                  title: 'font-semibold!',
                  description: 'text-fg2!',
                  actionButton: 'rounded-full! bg-btn! text-btnfg! font-semibold! px-3!'
                }
              }}
            />
          </div>
        </MotionConfig>
      </TooltipProvider>
    </Ctx.Provider>
  );
}
