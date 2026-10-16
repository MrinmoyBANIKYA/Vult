import * as React from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Cpu,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  FolderOpen,
  Globe,
  History,
  LoaderCircle,
  Lock,
  MinusCircle,
  Plus,
  RefreshCw,
  Trash2,
  Wrench,
  X
} from 'lucide-react';
import { Badge, Button, Sheet, Segmented } from '../components/ui.jsx';
import { PageHead, SecHead } from '../components/shared.jsx';
import { cn } from '../lib/utils.js';
import { useA } from '../lib/context.js';
import { CorrectionLog, CorrectionPanel } from './desk-corrections.jsx';
import { MarketPanel } from './desk-market.jsx';
import { engine } from '../lib/engine-client.js';
import { openPdf, readAnnualReport, renderSourcePage } from '../lib/annual-report.js';
import {
  addVersion,
  changeNote,
  fromRecord,
  newRunId,
  runStore,
  takeOpenRunRequest,
  toRecord
} from '../lib/run-store.js';
import { STEPS, buildOutputs, runPipeline } from '../lib/pipeline.js';
import { money, pct, perShareText } from '../lib/memo.js';
import { STATEMENT_KEYS } from '../../supabase/functions/_shared/statements.js';

const MAX_FILE_SIZE = 80 * 1024 * 1024;
const TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};
const LOCAL_FIRST = ['ollama', 'lmstudio'];
const HOSTED = ['groq', 'gemini', 'openrouter', 'openai', 'anthropic', 'custom'];

const slug = value =>
  String(value || 'company')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

function download(buffer, name, type) {
  const url = URL.createObjectURL(new Blob([buffer], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const fileSize = bytes =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const printedNumber = (value, digits = 0) =>
  Number.isFinite(value)
    ? (value < 0 ? '(' : '') +
      new Intl.NumberFormat('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
        Math.abs(value)
      ) +
      (value < 0 ? ')' : '')
    : '–';

/* ------------------------------------------------------------------ engine and model settings */
function ModelSettings({ health, onSaved }) {
  const [settings, setSettings] = React.useState(null);
  const [provider, setProvider] = React.useState('');
  const [draft, setDraft] = React.useState({ model: '', baseUrl: '', apiKey: '' });
  const [models, setModels] = React.useState({ list: [], error: '' });
  const [busy, setBusy] = React.useState('');
  const [message, setMessage] = React.useState(null);
  const online = health.state === 'online';

  React.useEffect(() => {
    if (!online) return;
    let cancelled = false;
    engine.settings().then(data => {
      if (cancelled) return;
      setSettings(data);
      setProvider(data.provider);
      const current = data.providers[data.provider];
      setDraft({ model: current.model, baseUrl: current.baseUrl, apiKey: '' });
    });
    return () => {
      cancelled = true;
    };
  }, [online]);

  React.useEffect(() => {
    if (!online || !provider) return;
    let cancelled = false;
    engine
      .models(provider)
      .then(data => !cancelled && setModels({ list: data.models ?? [], error: data.error ?? '' }))
      .catch(error => !cancelled && setModels({ list: [], error: error.message }));
    return () => {
      cancelled = true;
    };
  }, [online, provider, settings]);

  if (!online)
    return (
      <div className="flex gap-3 rounded-xl border border-warn/30 bg-warn/6 p-4 text-[13px] leading-relaxed text-fg2">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-warn" />
        <div>
          <div className="font-semibold text-fg">
            {health.state === 'checking' ? 'Looking for the Vult engine' : 'The Vult engine is not running'}
          </div>
          <p className="mt-1">
            Every model call runs through a small local server, so API keys stay on this machine and local models work.
            Start it in a second terminal with{' '}
            <code className="rounded bg-fg/8 px-1.5 py-0.5 font-mono text-[12px] text-fg">npm run engine</code>.
          </p>
        </div>
      </div>
    );
  if (!settings) return <div className="h-40 animate-pulse rounded-xl bg-fg/4" />;

  const preset = settings.providers[provider];
  const choose = id => {
    setProvider(id);
    setDraft({ model: settings.providers[id].model, baseUrl: settings.providers[id].baseUrl, apiKey: '' });
    setModels({ list: [], error: '' });
    setMessage(null);
  };
  const save = async () => {
    setBusy('save');
    setMessage(null);
    try {
      const data = await engine.saveSettings({
        provider,
        model: draft.model,
        baseUrl: draft.baseUrl,
        apiKey: draft.apiKey
      });
      setSettings(data);
      setDraft(current => ({ ...current, apiKey: '' }));
      onSaved();
      setMessage({ ok: true, text: 'Saved. New runs use this model.' });
    } catch (error) {
      setMessage({ ok: false, text: error.message });
    } finally {
      setBusy('');
    }
  };
  const test = async () => {
    setBusy('test');
    setMessage(null);
    try {
      await engine.saveSettings({ provider, model: draft.model, baseUrl: draft.baseUrl, apiKey: draft.apiKey });
      const result = await engine.test();
      onSaved();
      setMessage({
        ok: result.ok,
        text: result.ok
          ? `${result.label} ${result.model} answered in ${(result.ms / 1000).toFixed(1)}s.`
          : 'The model replied, but not with the expected JSON.'
      });
    } catch (error) {
      setMessage({ ok: false, text: error.message });
    } finally {
      setBusy('');
    }
  };
  const chip = id => {
    const p = settings.providers[id];
    const on = id === provider;
    return (
      <button
        key={id}
        type="button"
        onClick={() => choose(id)}
        aria-pressed={on}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
          on ? 'border-gold/70 bg-gold/10 text-fg' : 'border-line2 text-fg2 hover:border-fg3 hover:text-fg'
        )}
      >
        {p.label.replace(' (OpenAI-compatible)', '')}
        {settings.provider === id && <span className="h-1.5 w-1.5 rounded-full bg-pos" aria-label="active" />}
      </button>
    );
  };
  const isCloudOllama = provider === 'ollama' && /[-:]cloud$/i.test(draft.model);
  const local = preset.local && !isCloudOllama;
  const field =
    'h-9 w-full rounded-ctl border border-line2 bg-raised px-3 text-[13px] outline-hidden focus:border-gold/70';

  return (
    <div>
      <div className="text-[11.5px] font-semibold text-fg3">On this machine</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{LOCAL_FIRST.map(chip)}</div>
      <div className="mt-3 text-[11.5px] font-semibold text-fg3">Hosted</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{HOSTED.map(chip)}</div>

      <p className="mt-3 text-[12px] leading-relaxed text-fg3">{preset.note}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-[12px] text-fg2">
          Model
          <input
            list="vult-models"
            value={draft.model}
            onChange={event => setDraft({ ...draft, model: event.target.value })}
            placeholder={models.list[0]?.id || 'model name'}
            className={cn(field, 'mt-1')}
          />
          <datalist id="vult-models">
            {models.list.map(m => (
              <option key={m.id} value={m.id} />
            ))}
          </datalist>
        </label>
        {(LOCAL_FIRST.includes(provider) || provider === 'custom') && (
          <label className="block text-[12px] text-fg2">
            Server URL
            <input
              value={draft.baseUrl}
              onChange={event => setDraft({ ...draft, baseUrl: event.target.value })}
              className={cn(field, 'mt-1')}
            />
          </label>
        )}
        {(preset.needsKey || provider === 'custom') && (
          <label className="block text-[12px] text-fg2">
            API key {preset.hasKey && <span className="text-fg3">(saved {preset.keyHint})</span>}
            <input
              type="password"
              autoComplete="off"
              value={draft.apiKey}
              onChange={event => setDraft({ ...draft, apiKey: event.target.value })}
              placeholder={preset.hasKey ? 'Leave blank to keep the saved key' : 'Paste a key'}
              className={cn(field, 'mt-1')}
            />
          </label>
        )}
      </div>
      {models.error && <p className="mt-2 text-[12px] text-fg3">Could not list models: {models.error}</p>}
      {!models.error && models.list.length > 0 && (
        <p className="mt-2 text-[12px] text-fg3">
          {models.list.length} model{models.list.length === 1 ? '' : 's'} available
          {provider === 'ollama'
            ? `: ${models.list
                .map(m => m.id)
                .slice(0, 6)
                .join(', ')}`
            : ''}
          .
        </p>
      )}

      <div
        className={cn(
          'mt-3 flex items-start gap-2 rounded-lg p-3 text-[12px] leading-relaxed',
          local ? 'bg-pos/8 text-fg2' : 'bg-info/8 text-fg2'
        )}
      >
        {local ? (
          <Lock size={14} className="mt-0.5 shrink-0 text-pos" />
        ) : (
          <Globe size={14} className="mt-0.5 shrink-0 text-info" />
        )}
        <span>
          {local
            ? 'Runs on this machine. No filing text leaves it.'
            : `Statement row labels and the business and risk sections are sent to ${preset.label}. The PDF itself is not uploaded.`}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={save} disabled={Boolean(busy) || !draft.model}>
          {busy === 'save' ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
          Use this model
        </Button>
        <Button size="sm" onClick={test} disabled={Boolean(busy) || !draft.model}>
          {busy === 'test' ? <LoaderCircle size={14} className="animate-spin" /> : <Cpu size={14} />}
          Test
        </Button>
        {message && (
          <span role="status" className={cn('text-[12px]', message.ok ? 'text-pos' : 'text-neg')}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pipeline steps */
const STEP_ICON = {
  running: <LoaderCircle size={15} className="animate-spin text-gold" />,
  done: <Check size={15} className="text-pos" />,
  flagged: <AlertTriangle size={15} className="text-warn" />,
  skipped: <MinusCircle size={15} className="text-fg3" />,
  failed: <X size={15} className="text-neg" />
};

function Steps({ steps }) {
  return (
    <ol className="space-y-2.5">
      {STEPS.map(([id, text]) => {
        const step = steps[id];
        return (
          <li key={id} className="flex items-start gap-2.5 text-[13px]">
            <span className="mt-0.5">
              {step ? STEP_ICON[step.status] : <CircleDashed size={15} className="text-fg3/60" />}
            </span>
            <span className="min-w-0">
              <span className={cn(step ? 'text-fg' : 'text-fg3')}>{text}</span>
              {step?.note && <span className="block truncate text-[12px] text-fg3">{step.note}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ source viewer */
function SourceViewer({ pdf, source, onClose, fileName, ocr }) {
  const canvasRef = React.useRef(null);
  const frameRef = React.useRef(null);
  const [page, setPage] = React.useState(source?.page ?? 1);
  const [view, setView] = React.useState({ boxes: [], loading: true, error: '' });
  const total = pdf?.numPages ?? 1;

  // pdf.js refuses two renders on one canvas at once, so renders queue and a superseded one never starts.
  const queueRef = React.useRef(Promise.resolve());
  React.useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    const canvas = canvasRef.current;
    const width = Math.min(680, (frameRef.current?.clientWidth || 600) - 2);
    const onPage = page === source?.page;
    queueRef.current = queueRef.current.then(async () => {
      if (cancelled) return;
      try {
        const result = await renderSourcePage(pdf, page, canvas, {
          width,
          quote: onPage ? source?.quote : null,
          column: source?.column,
          columns: source?.columns,
          ocr: ocr?.[page]
        });
        if (!cancelled) setView({ boxes: result.boxes, loading: false, error: '' });
      } catch (error) {
        if (!cancelled) setView({ boxes: [], loading: false, error: error.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [page, source, pdf, ocr]);

  React.useEffect(() => {
    const value = view.boxes.find(box => box.kind === 'value') ?? view.boxes[0];
    if (value && frameRef.current) frameRef.current.scrollTo({ top: Math.max(0, value.top - 160), behavior: 'smooth' });
  }, [view.boxes]);

  const goto = next => {
    setView(current => ({ ...current, loading: true }));
    setPage(Math.min(total, Math.max(1, next)));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="text-[12px] text-fg3">{fileName}</div>
          <div className="mt-0.5 truncate text-[15px] font-semibold">
            {source?.name ? `${source.name}, FY${source.period}` : `PDF page ${page}`}
          </div>
          {source?.printed !== undefined && (
            <div className="mt-1 text-[12.5px] text-fg2">
              Printed as <span className="font-mono text-fg">{source.printed}</span> on PDF page {source.page}, row “
              {source.label}”
            </div>
          )}
        </div>
        <Button variant="ghost" size="iconsm" onClick={onClose} aria-label="Close source">
          <X size={16} />
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-2 text-[12px] text-fg2">
        <Button variant="ghost" size="xs" onClick={() => goto(page - 1)} disabled={page <= 1}>
          <ChevronLeft size={14} /> Previous
        </Button>
        <span>
          Page {page} of {total}
        </span>
        <Button variant="ghost" size="xs" onClick={() => goto(page + 1)} disabled={page >= total}>
          Next <ChevronRight size={14} />
        </Button>
      </div>
      <div ref={frameRef} className="min-h-0 flex-1 overflow-auto bg-inset p-3">
        <div className="relative mx-auto w-fit bg-white shadow-sm">
          <canvas ref={canvasRef} className="block" />
          {view.boxes.map((box, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                'pointer-events-none absolute rounded-[3px]',
                box.kind === 'value'
                  ? 'bg-[hsl(48_100%_55%/.45)] ring-2 ring-[hsl(210_96%_46%)]'
                  : 'bg-[hsl(210_96%_46%/.13)]'
              )}
              style={{ left: box.left - 3, top: box.top - 2, width: box.width + 6, height: box.height + 4 }}
            />
          ))}
          {view.loading && (
            <div className="absolute inset-0 grid place-items-center bg-white/60 text-[12px] text-[hsl(228_30%_10%)]">
              Rendering page
            </div>
          )}
        </div>
        {view.error && <p className="mt-3 text-center text-[12px] text-neg">{view.error}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ results */
const RESULT_TABS = [
  ['figures', 'Figures'],
  ['valuation', 'Valuation'],
  ['market', 'Market and peers'],
  ['checks', 'Checks'],
  ['narrative', 'Business and risks'],
  ['history', 'History']
];

/** The report's sections as tabs, so an analyst moves between figures, valuation and checks without scrolling. */
function ResultTabs({ value, onChange, flagged }) {
  return (
    <div
      role="tablist"
      aria-label="Report sections"
      className="-mx-1 mt-5 flex gap-1 overflow-x-auto border-t border-line pt-4"
    >
      {RESULT_TABS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn(
            'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors',
            value === id ? 'bg-fg/10 text-fg' : 'text-fg3 hover:bg-fg/5 hover:text-fg'
          )}
        >
          {label}
          {id === 'checks' && flagged > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-warn/20 px-1.5 text-[11px] font-semibold text-warn">
              {flagged}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-fg/2 px-4 py-3">
      <div className="text-[12px] text-fg3">{label}</div>
      <div className={cn('mt-1 truncate text-[20px] font-bold tabular-nums tracking-[-.02em]', tone)}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11.5px] text-fg3">{sub}</div>}
    </div>
  );
}

function StatementTable({ facts, periods, statement, onOpen, onFix }) {
  const rows = [];
  const seen = new Map();
  for (const key of Object.keys(STATEMENT_KEYS[statement])) {
    for (const fact of facts.filter(f => f.statement === statement && f.key === key)) {
      const id = `${key}:${fact.rowId}`;
      if (!seen.has(id)) {
        const row = { id, key, name: fact.name, label: fact.label, cells: {}, corrected: Boolean(fact.correction) };
        seen.set(id, row);
        rows.push(row);
      }
      seen.get(id).cells[fact.period] = fact;
    }
  }
  const missing = Object.keys(STATEMENT_KEYS[statement]).filter(key => !rows.some(row => row.key === key));
  return (
    <div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-150 text-[13px]">
            <thead className="text-[12px] text-fg3">
              <tr className="border-b border-line">
                <th className="px-5 py-2.5 text-left font-medium">Line item</th>
                {periods.map(p => (
                  <th key={p} className="px-3 py-2.5 text-right font-medium">
                    FY{p}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-medium">Page</th>
                <th className="px-3 py-2.5">
                  <span className="sr-only">Correct</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-2">
                    <div className="flex items-center gap-1.5 font-medium text-fg">
                      {row.name}
                      {row.corrected && <Badge tone="info">Corrected</Badge>}
                    </div>
                    <div className="max-w-80 truncate text-[11.5px] text-fg3">{row.label}</div>
                  </td>
                  {periods.map(p => {
                    const fact = row.cells[p];
                    return (
                      <td key={p} className="px-1.5 py-1 text-right">
                        {fact ? (
                          <button
                            type="button"
                            onClick={() => onOpen(fact)}
                            className="rounded-md px-1.5 py-1 font-mono text-[12.5px] tabular-nums text-fg underline decoration-gold/40 decoration-dotted underline-offset-4 transition-colors hover:bg-gold/10 hover:decoration-gold"
                            aria-label={`${row.name} FY${p}: ${fact.printed}. Open PDF page ${fact.page}`}
                          >
                            {fact.printed}
                          </button>
                        ) : (
                          <span className="px-1.5 text-fg3">–</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right text-[12px] text-fg3">{Object.values(row.cells)[0]?.page}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="xs" variant="ghost" onClick={() => onFix({ statement, key: row.key })}>
                      <Wrench size={13} /> Fix
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-6 text-[13px] text-fg3">No figures were extracted for this statement.</p>
      )}
      {missing.length > 0 && (
        <div className="border-t border-line px-5 py-3">
          <div className="text-[12px] text-fg3">
            Not found in this statement. Add one from any page, a note included:
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missing.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => onFix({ statement, key })}
                className="flex h-7 items-center gap-1 rounded-full border border-line2 px-2.5 text-[12px] text-fg2 transition-colors hover:border-gold/60 hover:text-fg"
              >
                <Plus size={12} /> {STATEMENT_KEYS[statement][key][0]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const OVERRIDE_FIELDS = [
  ['sharePrice', 'Share price', 'price'],
  ['riskFree', 'Risk-free rate', '%'],
  ['erp', 'Equity risk premium', '%'],
  ['beta', 'Levered beta', 'x'],
  ['costOfDebt', 'Pre-tax cost of debt', '%'],
  ['terminalGrowth', 'Terminal growth', '%'],
  ['taxRate', 'Tax rate', '%']
];
const FINANCIAL_FIELDS = [
  ['sharePrice', 'Share price', 'price'],
  ['riskFree', 'Risk-free rate', '%'],
  ['erp', 'Equity risk premium', '%'],
  ['beta', 'Levered beta', 'x'],
  ['roe', 'Sustainable ROE', '%'],
  ['growth', 'Long-run growth', '%']
];

const toForm = (fields, assumptions) =>
  Object.fromEntries(
    fields.map(([key, , kind]) => {
      const value = assumptions[key];
      if (value == null || value === '') return [key, ''];
      return [key, kind === '%' ? String(+(value * 100).toFixed(3)) : String(value)];
    })
  );

const fromForm = (fields, form) =>
  Object.fromEntries(
    fields.map(([key, , kind]) => {
      const raw = String(form[key] ?? '').trim();
      if (!raw) return [key, key === 'sharePrice' ? null : undefined];
      const value = Number(raw);
      return [key, Number.isFinite(value) ? (kind === '%' ? value / 100 : value) : undefined];
    })
  );

function InputsForm({ fields, assumptions, onApply, busy, note }) {
  const [form, setForm] = React.useState(() => toForm(fields, assumptions));
  return (
    <form
      className="h-fit rounded-xl border border-line p-4"
      onSubmit={event => {
        event.preventDefault();
        onApply(fromForm(fields, form));
      }}
    >
      <div className="text-[13px] font-semibold">Valuation inputs</div>
      <p className="mt-1 text-[12px] leading-relaxed text-fg3">{note}</p>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
        {fields.map(([key, text, kind]) => (
          <label key={key} className="block text-[12px] text-fg2">
            {text}
            <span className="relative mt-1 block">
              <input
                inputMode="decimal"
                value={form[key]}
                onChange={event => setForm({ ...form, [key]: event.target.value })}
                placeholder={key === 'sharePrice' ? 'e.g. 227.79' : ''}
                className="h-8 w-full rounded-lg border border-line2 bg-raised px-2.5 pr-7 text-[13px] tabular-nums outline-hidden focus:border-gold/70"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-fg3">
                {kind === '%' ? '%' : ''}
              </span>
            </span>
          </label>
        ))}
      </div>
      <Button type="submit" variant="primary" size="sm" className="mt-4 w-full" disabled={busy}>
        {busy ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        Recalculate model and documents
      </Button>
    </form>
  );
}

/** A bank or insurer, valued on justified price to book. */
function FinancialValuation({ result, onApply, busy }) {
  const { model } = result;
  const v = model.valuation;
  const unit = model.unit;
  const s = v.sensitivity;
  const show = x => (x == null ? '' : s.perShare ? perShareText(x, unit) : money(x, unit));
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
      <div className="min-w-0 space-y-5">
        <p className="rounded-lg bg-info/8 p-3 text-[12.5px] leading-relaxed text-fg2">
          This is{' '}
          {model.sector === 'insurer' ? 'an insurer' : model.sector === 'bank' ? 'a bank' : 'a financial institution'},
          so a corporate DCF does not apply. Value is book equity times the justified price to book, (ROE - g) / (cost
          of equity - g). Regulatory capital and credit quality are not extracted yet.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Justified price to book"
            value={v.pb != null ? `${v.pb.toFixed(2)}x` : 'n/a'}
            sub={`Cost of equity ${pct(v.costOfEquity)}`}
          />
          <Stat label="Equity value" value={money(v.equityValue, unit)} sub={`Book ${money(v.bookValue, unit)}`} />
          <Stat
            label="Value per share"
            value={v.perShare != null ? perShareText(v.perShare, unit) : 'n/a'}
            sub={v.perShare != null ? 'Base case' : 'Shares not reconciled'}
          />
          <Stat
            label="Against share price"
            value={v.upside != null ? `${v.upside >= 0 ? '+' : ''}${pct(v.upside)}` : 'n/a'}
            sub={model.assumptions.sharePrice > 0 ? perShareText(model.assumptions.sharePrice, unit) : 'Enter a price'}
            tone={v.upside == null ? '' : v.upside >= 0 ? 'text-pos' : 'text-neg'}
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-110 text-[12.5px] tabular-nums">
            <thead className="text-[12px] text-fg3">
              <tr className="border-b border-line">
                <th className="px-4 py-2 text-left font-medium">{unit.label}</th>
                {model.hist.map(h => (
                  <th key={h.period} className="px-3 py-2 text-right font-medium">
                    FY{h.period}A
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Total income', h => printedNumber(h.revenue)],
                ['Net income', h => printedNumber(h.netIncome)],
                ['Total equity', h => printedNumber(h.equity)],
                ['Return on equity', h => pct(h.roe)]
              ].map(([name, fn]) => (
                <tr key={name} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 font-medium">{name}</td>
                  {model.hist.map(h => (
                    <td key={h.period} className="px-3 py-2 text-right text-fg2">
                      {fn(h)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="mb-2 text-[12.5px] font-semibold">
            {s.perShare ? 'Value per share' : `Equity value (${unit.label})`} by ROE and cost of equity
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-110 text-[12.5px] tabular-nums">
              <thead>
                <tr className="border-b border-line text-fg3">
                  <th className="px-3 py-2 text-left font-medium">ROE / CoE</th>
                  {s.coe.map(c => (
                    <th key={c} className="px-3 py-2 text-right font-medium">
                      {pct(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.roe.map((roe, r) => (
                  <tr key={roe} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2 text-fg3">{pct(roe)}</td>
                    {s.values[r].map((x, i) => (
                      <td
                        key={i}
                        className={cn('px-3 py-2 text-right', r === 2 && i === 2 && 'bg-gold/12 font-semibold text-fg')}
                      >
                        {show(x)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <InputsForm
        fields={FINANCIAL_FIELDS}
        assumptions={model.assumptions}
        onApply={onApply}
        busy={busy}
        note="The share price is not in a filing. Risk-free rate, premium and beta start as Vult defaults; sustainable ROE starts as the reported average."
      />
    </div>
  );
}

function Valuation({ result, onApply, busy }) {
  const { model } = result;
  const d = model.dcf;
  const unit = model.unit;
  const show = v => (v == null ? '' : d.sensitivity.perShare ? perShareText(v, unit) : money(v, unit));
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
      <div className="min-w-0 space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Enterprise value" value={money(d.ev, unit)} sub={`WACC ${pct(d.wacc)}`} />
          <Stat label="Equity value" value={money(d.equityValue, unit)} sub={`TV ${pct(d.tvShare, 0)} of EV`} />
          <Stat
            label="Value per share"
            value={d.perShare != null ? perShareText(d.perShare, unit) : 'n/a'}
            sub={d.perShare != null ? 'Base case' : 'Shares not reconciled'}
          />
          <Stat
            label="Against share price"
            value={d.upside != null ? `${d.upside >= 0 ? '+' : ''}${pct(d.upside)}` : 'n/a'}
            sub={model.assumptions.sharePrice > 0 ? perShareText(model.assumptions.sharePrice, unit) : 'Enter a price'}
            tone={d.upside == null ? '' : d.upside >= 0 ? 'text-pos' : 'text-neg'}
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-150 text-[12.5px] tabular-nums">
            <thead className="text-[12px] text-fg3">
              <tr className="border-b border-line">
                <th className="px-4 py-2 text-left font-medium">{unit.label}</th>
                {model.hist.map(h => (
                  <th key={h.period} className="px-3 py-2 text-right font-medium">
                    FY{h.period}A
                  </th>
                ))}
                {model.forecast.map(y => (
                  <th key={y.period} className="bg-gold/5 px-3 py-2 text-right font-medium text-gold">
                    FY{y.period}E
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Revenue', h => h.revenue, y => y.revenue],
                ['EBIT', h => h.ebit, y => y.ebit],
                ['Net income', h => h.netIncome, y => y.netIncome],
                ['Unlevered FCF', () => null, (y, t) => d.ufcf[t]],
                ['Balance check', h => (h.hasBalance ? h.ta - h.tle : null), y => y.balanceCheck]
              ].map(([name, hv, fv]) => (
                <tr key={name} className="border-b border-line/60 last:border-0">
                  <td className={cn('px-4 py-2', name === 'Balance check' ? 'text-fg3' : 'font-medium')}>{name}</td>
                  {model.hist.map(h => (
                    <td key={h.period} className="px-3 py-2 text-right text-fg2">
                      {printedNumber(hv(h))}
                    </td>
                  ))}
                  {model.forecast.map((y, t) => (
                    <td key={y.period} className="bg-gold/3 px-3 py-2 text-right">
                      {name === 'Balance check'
                        ? printedNumber(Math.abs(fv(y, t)) < 1e-6 ? 0 : fv(y, t), 1)
                        : printedNumber(fv(y, t))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="mb-2 text-[12.5px] font-semibold">
            {d.sensitivity.perShare ? 'Value per share' : `Equity value (${unit.label})`} by WACC and terminal growth
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-110 text-[12.5px] tabular-nums">
              <thead>
                <tr className="border-b border-line text-fg3">
                  <th className="px-3 py-2 text-left font-medium">g / WACC</th>
                  {d.sensitivity.wacc.map(w => (
                    <th key={w} className="px-3 py-2 text-right font-medium">
                      {pct(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.sensitivity.growth.map((g, r) => (
                  <tr key={g} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2 text-fg3">{pct(g, 2)}</td>
                    {d.sensitivity.values[r].map((v, i) => (
                      <td
                        key={i}
                        className={cn('px-3 py-2 text-right', r === 2 && i === 2 && 'bg-gold/12 font-semibold text-fg')}
                      >
                        {show(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <InputsForm
        fields={OVERRIDE_FIELDS}
        assumptions={model.assumptions}
        onApply={onApply}
        busy={busy}
        note="The share price is not in a filing. Risk-free rate, premium and beta start as Vult defaults; replace them with your house view."
      />
    </div>
  );
}

const GROUP_TITLE = {
  workbook: 'Workbook recalculation',
  accounts: 'Accounting checks',
  coverage: 'Coverage',
  label: 'Row labels',
  source: 'Figures against the filing',
  reference: 'Against the structured filing'
};

function Assayer({ assay, onOpenPage }) {
  const flagged = assay.checks.filter(check => !check.passed);
  const groups = Object.keys(GROUP_TITLE)
    .map(group => ({ group, checks: assay.checks.filter(check => check.group === group) }))
    .filter(entry => entry.checks.length);
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:max-w-100">
        <Stat label="Passed" value={assay.passed} tone="text-pos" />
        <Stat label="Flagged for review" value={assay.flagged} tone={assay.flagged ? 'text-warn' : ''} />
      </div>
      {flagged.length > 0 && (
        <ul className="mt-4 space-y-2">
          {flagged.map(check => (
            <li
              key={check.key}
              className="flex items-start gap-2.5 rounded-lg border border-warn/25 bg-warn/5 p-3 text-[12.5px] leading-relaxed"
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{check.title}.</span> <span className="text-fg2">{check.detail}</span>
              </span>
              {check.page && (
                <Button size="xs" variant="ghost" onClick={() => onOpenPage(check.page)}>
                  Page {check.page}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 divide-y divide-line rounded-xl border border-line">
        {groups.map(({ group, checks }) => {
          const passed = checks.filter(check => check.passed).length;
          return (
            <details key={group} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px]">
                <span className="font-medium">{GROUP_TITLE[group]}</span>
                <span className="flex items-center gap-2 text-[12px] text-fg3">
                  {passed} of {checks.length} passed
                  <ChevronRight size={14} className="transition-transform group-open:rotate-90" />
                </span>
              </summary>
              <ul className="mt-2 max-h-72 space-y-1.5 overflow-auto pr-1">
                {checks.map(check => (
                  <li key={check.key} className="flex items-start gap-2 text-[12px] leading-relaxed text-fg2">
                    {check.passed ? (
                      <Check size={13} className="mt-0.5 shrink-0 text-pos" />
                    ) : (
                      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warn" />
                    )}
                    <span>{check.detail}</span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-fg3">
        Every check is computed by code. A pass means a figure matches the filing or an identity ties; it is not a
        judgement on the model. Flags need an analyst.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ saved runs */
const when = iso =>
  iso
    ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

const headline = summary =>
  !summary
    ? ''
    : [
        summary.perShare != null ? `${Number(summary.perShare).toFixed(2)} a share` : null,
        summary.pb != null ? `${Number(summary.pb).toFixed(2)}x book` : null,
        `${summary.passed} checks passed, ${summary.flagged} flagged`
      ]
        .filter(Boolean)
        .join(', ');

function SavedRuns({ store, onOpen, refreshKey, busy }) {
  const [state, setState] = React.useState({ runs: null, error: '' });
  React.useEffect(() => {
    let cancelled = false;
    store
      .list()
      .then(runs => !cancelled && setState({ runs, error: '' }))
      .catch(error => !cancelled && setState({ runs: [], error: error.message }));
    return () => {
      cancelled = true;
    };
  }, [store, refreshKey]);
  if (!state.runs?.length) return null;
  return (
    <section className="card mt-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Saved runs</h2>
        <span className="text-[12px] text-fg3">
          {store.kind === 'supabase' ? 'Shared with your organisation' : 'Kept on this machine by the engine'}
        </span>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {state.runs.map(run => (
          <li key={run.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[13px]">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-fg">{run.company}</div>
              <div className="truncate text-[12px] text-fg3">
                {[
                  run.fileName,
                  `updated ${when(run.updatedAt)}`,
                  run.createdBy,
                  `${run.versions} version${run.versions === 1 ? '' : 's'}`
                ]
                  .filter(Boolean)
                  .join(', ')}
              </div>
              {run.summary && <div className="truncate text-[12px] text-fg2">{headline(run.summary)}</div>}
            </div>
            <Button size="sm" onClick={() => onOpen(run.id)} disabled={busy}>
              <FolderOpen size={14} /> Open
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function VersionHistory({ saved, saveError }) {
  if (!saved) return null;
  const versions = [...(saved.versions ?? [])].reverse();
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <History size={15} /> Versions
      </h2>
      {saveError ? (
        <p role="alert" className="mt-2 text-[12.5px] text-warn">
          {saveError}
        </p>
      ) : (
        <p className="mt-1 text-[12px] text-fg3">Every build, correction and change of assumption is kept.</p>
      )}
      <ol className="mt-3 space-y-2.5">
        {versions.map(v => (
          <li key={v.n} className="text-[12.5px] leading-relaxed">
            <div className="font-medium text-fg">
              Version {v.n}, {when(v.at)}, {v.by}
            </div>
            <div className="text-fg2">{v.note}</div>
            <div className="text-fg3">{headline(v.summary)}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ the view */
export function DeskView() {
  const [pdf, setPdf] = React.useState(null);
  const inputRef = React.useRef(null);
  const [health, setHealth] = React.useState({ state: 'checking', data: null });
  const [file, setFile] = React.useState(null);
  const [reading, setReading] = React.useState(null);
  const [pageTexts, setPageTexts] = React.useState(null);
  const [ocr, setOcr] = React.useState({});
  const [steps, setSteps] = React.useState({});
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState(null);
  const [statement, setStatement] = React.useState('income');
  const [source, setSource] = React.useState(null);
  const [recomputing, setRecomputing] = React.useState(false);
  const [overrides, setOverrides] = React.useState({});
  const [peers, setPeers] = React.useState([]);
  const [ticker, setTicker] = React.useState('');
  const [tab, setTab] = React.useState('figures');
  const [correcting, setCorrecting] = React.useState(null);
  const { d, live } = useA() ?? {};
  const store = React.useMemo(
    () => runStore({ live: live?.connected, orgId: live?.orgId }),
    [live?.connected, live?.orgId]
  );
  const bytesRef = React.useRef(null);
  const [saved, setSaved] = React.useState(null);
  const [saveError, setSaveError] = React.useState('');
  const [listKey, setListKey] = React.useState(0);
  const analyst = d?.me?.n || 'Analyst';

  const checkHealth = React.useCallback(() => {
    engine
      .health()
      .then(data => setHealth({ state: 'online', data }))
      .catch(() => setHealth({ state: 'offline', data: null }));
  }, []);
  React.useEffect(() => {
    checkHealth();
    const timer = window.setInterval(checkHealth, 15000);
    return () => window.clearInterval(timer);
  }, [checkHealth]);

  const onStep = React.useCallback(
    (id, status, note) => setSteps(current => ({ ...current, [id]: { status, note } })),
    []
  );

  const reset = () => {
    pdf?.destroy?.();
    setPdf(null);
    setFile(null);
    setPageTexts(null);
    setOcr({});
    setSteps({});
    setResult(null);
    setOverrides({});
    setPeers([]);
    setTicker('');
    setTab('figures');
    setSaved(null);
    setSaveError('');
    bytesRef.current = null;
    setError('');
    setReading(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  // Saves the run and appends a version. The first save also stores the PDF and its page text.
  const persist = async (next, nextOverrides, note, meta = saved, extra = {}) => {
    if (!meta) return;
    const versions = addVersion(meta.versions, {
      note,
      by: analyst,
      overrides: nextOverrides,
      corrections: next.extraction.corrections ?? [],
      result: next
    });
    const record = toRecord({
      id: meta.id,
      result: next,
      overrides: nextOverrides,
      peers: extra.peers ?? peers,
      ticker: extra.ticker ?? ticker,
      createdAt: meta.createdAt,
      createdBy: meta.createdBy,
      versions
    });
    setSaved({ ...meta, versions });
    try {
      await store.save({
        record,
        ...(meta.versions.length ? {} : { pageTexts: next.extraction.pageTexts, pdf: bytesRef.current })
      });
      setSaveError('');
      setListKey(k => k + 1);
    } catch (cause) {
      setSaveError(`Not saved: ${cause.message}`);
    }
  };

  const run = async (texts, name, scans = ocr, symbol = ticker) => {
    setRunning(true);
    setError('');
    setSteps({});
    setResult(null);
    try {
      const output = await runPipeline({
        pageTexts: texts,
        fileName: name,
        llm: engine,
        onStep,
        ocrPages: Object.keys(scans ?? {}).map(Number)
      });
      setResult(output);
      await persist(
        output,
        {},
        'Built from the filing',
        { id: newRunId(), createdAt: new Date().toISOString(), createdBy: analyst, versions: [] },
        { ticker: symbol }
      );
    } catch (cause) {
      setError(cause.offline ? cause.message : `${cause.message}`);
      setSteps(current => {
        const active = Object.entries(current).find(([, step]) => step.status === 'running');
        return active ? { ...current, [active[0]]: { status: 'failed', note: cause.message } } : current;
      });
    } finally {
      setRunning(false);
    }
  };

  const choose = async (candidate, symbol = '') => {
    if (!candidate) return;
    reset();
    if (symbol) setTicker(symbol);
    if (!/\.pdf$/i.test(candidate.name)) return setError('Choose a PDF annual report or 10-K.');
    if (candidate.size > MAX_FILE_SIZE) return setError('Vult reads PDFs up to 80 MB.');
    setFile(candidate);
    setReading({ page: 0, total: 0 });
    try {
      const parsed = await readAnnualReport(candidate, (page, total, phase) => setReading({ page, total, phase }));
      setPdf(parsed.pdf);
      bytesRef.current = parsed.bytes;
      setOcr(parsed.ocr);
      setPageTexts(parsed.pageTexts);
      setReading(null);
      if (health.state === 'online') await run(parsed.pageTexts, candidate.name, parsed.ocr, symbol);
    } catch (cause) {
      setReading(null);
      setError(cause.message || 'The PDF could not be read.');
    }
  };

  // Pulls a company's latest annual filing from SEC EDGAR through the engine, then reads it like an upload.
  const [lookup, setLookup] = React.useState({ ticker: '', busy: false, filing: null });
  const [matches, setMatches] = React.useState([]);
  // Suggests SEC-registered companies by name or ticker as the analyst types.
  React.useEffect(() => {
    const query = lookup.ticker.trim();
    // Only while the analyst is typing: a picked company does not reopen the list.
    if (query.length < 2 || lookup.busy || !lookup.typing) return undefined;
    let alive = true;
    const timer = window.setTimeout(() => {
      engine
        .searchCompanies(query)
        .then(data => alive && setMatches(data.results ?? []))
        .catch(() => alive && setMatches([]));
    }, 200);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [lookup.ticker, lookup.busy, lookup.typing]);
  const fetchFiling = async (event, picked) => {
    event?.preventDefault();
    const typed = lookup.ticker.trim();
    // A typed name resolves to its best match; a typed ticker is used as it is.
    const exact = matches.find(m => m.ticker.toLowerCase() === typed.toLowerCase());
    const symbol = (picked ?? exact ?? (/\s/.test(typed) || typed.length > 5 ? matches[0] : null))?.ticker ?? typed;
    if (!symbol) return;
    setMatches([]);
    setLookup(current => ({ ...current, ticker: symbol.toUpperCase(), busy: true, typing: false, filing: null }));
    setError('');
    try {
      const { filing, bytes } = await engine.annualFiling(symbol.toUpperCase());
      setLookup(current => ({ ...current, busy: false, filing }));
      await choose(new File([bytes], `${filing.name}.pdf`, { type: 'application/pdf' }), filing.ticker);
    } catch (cause) {
      setLookup(current => ({ ...current, busy: false }));
      setError(cause.message);
    }
  };

  // Rebuilds the model and documents from the same extraction with new assumptions or corrections.
  const recompute = async ({
    nextOverrides = overrides,
    corrections = result.extraction.corrections ?? [],
    nextPeers = peers,
    nextReference = result.extraction.reference ?? null,
    nextTicker = ticker,
    note = ''
  } = {}) => {
    if (!result) return false;
    setRecomputing(true);
    setError('');
    try {
      const outputs = await buildOutputs({
        extraction: { ...result.extraction, corrections, reference: nextReference },
        overrides: nextOverrides,
        peers: nextPeers,
        narrative: result.narrative,
        llm: engine,
        onStep
      });
      const next = { ...result, ...outputs };
      setOverrides(nextOverrides);
      setPeers(nextPeers);
      setTicker(nextTicker);
      setResult(next);
      const changes = changeNote({
        before: { overrides, corrections: result.extraction.corrections ?? [] },
        after: { overrides: nextOverrides, corrections }
      });
      const peerNote = nextPeers !== peers ? `Peers: ${nextPeers.map(p => p.name).join(', ') || 'none'}` : '';
      await persist(
        next,
        nextOverrides,
        [note, peerNote, changes === 'Recalculated' && (note || peerNote) ? '' : changes].filter(Boolean).join('; '),
        saved,
        { peers: nextPeers, ticker: nextTicker }
      );
      return true;
    } catch (cause) {
      setError(cause.message);
      return false;
    } finally {
      setRecomputing(false);
    }
  };
  // A fetched value keeps its source only while the analyst leaves it unchanged.
  const applyOverrides = next => {
    const basis = Object.fromEntries(
      Object.entries(overrides.basis ?? {}).filter(([key]) => next[key] === overrides[key])
    );
    return recompute({ nextOverrides: { ...next, basis } });
  };
  const applyMarket = ({ ticker: symbol, values, basis, reference }) =>
    recompute({
      nextOverrides: { ...overrides, ...values, basis: { ...(overrides.basis ?? {}), ...basis } },
      nextReference: reference,
      nextTicker: symbol,
      note: `Market data from ${symbol}`
    });
  const applyPeers = list => recompute({ nextPeers: list });

  const openRun = async id => {
    reset();
    setReading({ page: 0, total: 0 });
    try {
      const { record, pageTexts: texts } = await store.load(id);
      const bytes = await store.pdf(id);
      // Extraction ran when the run was built; reopening only rebuilds the outputs.
      const fromSaved = 'From the saved run';
      setSteps({
        locate: { status: 'done', note: `${fromSaved}, PDF pages ${record.pages.map(pg => pg.page).join(', ')}` },
        classify: {
          status: 'done',
          note: record.llmInfo ? `${record.llmInfo.label} ${record.llmInfo.model}` : fromSaved
        },
        read: { status: 'done', note: fromSaved },
        assay: { status: 'done', note: 'Run again on open' },
        narrative: record.narrative ? { status: 'done', note: fromSaved } : { status: 'skipped', note: 'None saved' }
      });
      const doc = await openPdf(bytes);
      bytesRef.current = bytes;
      setPdf(doc);
      setPageTexts(texts);
      setFile({ name: record.fileName, size: bytes.length });
      const outputs = await buildOutputs({
        extraction: fromRecord(record, texts),
        overrides: record.overrides ?? {},
        peers: record.peers ?? [],
        narrative: record.narrative,
        llm: engine,
        onStep
      });
      setOverrides(record.overrides ?? {});
      setPeers(record.peers ?? []);
      setTicker(record.ticker ?? '');
      setResult({ ...outputs, narrative: record.narrative });
      setSaved({
        id: record.id,
        createdAt: record.createdAt,
        createdBy: record.createdBy,
        versions: record.versions ?? []
      });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setReading(null);
    }
  };
  // Engagements and Home open a saved report here.
  const openRunRef = React.useRef(openRun);
  openRunRef.current = openRun;
  React.useEffect(() => {
    const id = takeOpenRunRequest();
    if (id) void openRunRef.current(id);
  }, []);
  const saveCorrection = async correction => {
    const ok = await recompute({ corrections: [...(result.extraction.corrections ?? []), correction] });
    if (ok) setCorrecting(null);
  };
  const undoCorrection = id =>
    recompute({ corrections: (result.extraction.corrections ?? []).filter(c => c.id !== id) });

  const company = result?.extraction.company;
  const base = slug(company);
  const llm = health.data?.llm;

  return (
    <div className="px-7 pb-16 pt-4 max-lg:px-4">
      <div className="mx-auto max-w-360">
        <PageHead
          title="Filing desk"
          sub="Upload a 10-K or annual report. Vult reads the statements, builds a checked model, memo and tear sheet, and every figure opens the page it came from."
          right={
            file && (
              <Button onClick={reset} disabled={running}>
                <Trash2 size={15} /> Start again
              </Button>
            )
          }
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <section className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">Filing</h2>
              {llm && (
                <Badge tone={llm.local ? 'pos' : 'info'}>
                  {llm.local ? <Lock size={12} /> : <Globe size={12} />}
                  {llm.label} {llm.model}
                </Badge>
              )}
            </div>
            <label
              htmlFor="desk-pdf"
              onDragOver={event => event.preventDefault()}
              onDrop={event => {
                event.preventDefault();
                void choose(event.dataTransfer.files[0]);
              }}
              className={cn(
                'mt-4 flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line2 bg-fg/2 px-4 py-6 text-center transition-colors hover:border-gold/60 hover:bg-gold/4',
                (running || reading) && 'pointer-events-none opacity-70'
              )}
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/12 text-gold">
                {reading ? <LoaderCircle size={20} className="animate-spin" /> : <FileUp size={20} />}
              </span>
              <span className="max-w-full truncate text-[14px] font-semibold">
                {file?.name || 'Choose a 10-K or annual report PDF'}
              </span>
              <span className="text-[12px] text-fg3">
                {reading
                  ? reading.phase === 'ocr'
                    ? `Scanned pages: reading ${reading.page} of ${reading.total} by OCR on this machine`
                    : `Reading page ${reading.page} of ${reading.total || '…'}`
                  : file
                    ? `${fileSize(file.size)}, ${pageTexts ? Object.keys(pageTexts).length : '…'} pages, read in this browser`
                    : 'Drop it here or select a file. Text-based PDFs up to 80 MB.'}
              </span>
              <input
                ref={inputRef}
                id="desk-pdf"
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={event => void choose(event.target.files?.[0])}
              />
            </label>

            <form onSubmit={fetchFiling} className="relative mt-3 flex flex-wrap items-end gap-2">
              <label htmlFor="desk-ticker" className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold text-fg2">
                  Or search a US-listed company and fetch its latest annual report from SEC EDGAR
                </span>
                <input
                  id="desk-ticker"
                  value={lookup.ticker}
                  onChange={event => {
                    const value = event.target.value;
                    setLookup(current => ({ ...current, ticker: value, typing: true }));
                    if (value.trim().length < 2) setMatches([]);
                  }}
                  onKeyDown={event => event.key === 'Escape' && setMatches([])}
                  onBlur={() => window.setTimeout(() => setMatches([]), 150)}
                  placeholder="Company or ticker, such as Nvidia or KO"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={60}
                  role="combobox"
                  aria-expanded={matches.length > 0}
                  aria-controls="desk-ticker-list"
                  disabled={lookup.busy || running || Boolean(reading)}
                  className="h-9 rounded-ctl border border-line2 bg-inset px-3 text-[13px] text-fg outline-hidden placeholder:text-fg3 focus:border-gold/60"
                />
              </label>
              {matches.length > 0 && (
                <ul
                  id="desk-ticker-list"
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line2 bg-overlay p-1 shadow-lg"
                >
                  {matches.map(match => (
                    <li key={match.ticker} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onClick={event => void fetchFiling(event, match)}
                        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-fg/6"
                      >
                        <span className="w-16 shrink-0 font-mono text-[12px] text-gold">{match.ticker}</span>
                        <span className="min-w-0 flex-1 truncate">{match.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="submit"
                disabled={
                  !lookup.ticker.trim() || lookup.busy || running || Boolean(reading) || health.state !== 'online'
                }
              >
                {lookup.busy ? <LoaderCircle size={15} className="animate-spin" /> : <Globe size={15} />}
                Fetch filing
              </Button>
            </form>
            {lookup.busy && (
              <p role="status" className="mt-2 text-[12px] text-fg3">
                Downloading from SEC EDGAR and printing to PDF. The first time takes about a minute.
              </p>
            )}
            {lookup.filing && !lookup.busy && (
              <p className="mt-2 text-[12px] text-fg3">
                {lookup.filing.company}, {lookup.filing.form} for the period to {lookup.filing.period}, filed{' '}
                {lookup.filing.filed}.{' '}
                <a href={lookup.filing.url} target="_blank" rel="noreferrer" className="text-gold hover:underline">
                  Open on EDGAR
                </a>
              </p>
            )}

            {pageTexts && !running && !result && health.state === 'online' && (
              <Button variant="primary" className="mt-4" onClick={() => run(pageTexts, file.name)}>
                <FileSpreadsheet size={15} /> Build the model
              </Button>
            )}
            {pageTexts && health.state !== 'online' && (
              <p className="mt-3 text-[12.5px] text-warn">The filing is read. Start the engine to build the model.</p>
            )}
            {error && (
              <div
                role="alert"
                className="mt-4 flex gap-2.5 rounded-lg border border-neg/25 bg-neg/6 p-3 text-[12.5px] leading-relaxed text-fg2"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-neg" />
                <span>{error}</span>
              </div>
            )}

            {(running || Object.keys(steps).length > 0) && (
              <div className="mt-5 border-t border-line pt-4">
                <Steps steps={steps} />
              </div>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="mb-3 text-[15px] font-semibold">Model</h2>
            <ModelSettings health={health} onSaved={checkHealth} />
          </section>
        </div>

        {!file && <SavedRuns store={store} onOpen={openRun} refreshKey={listKey} busy={Boolean(reading) || running} />}

        {result && (
          <>
            <section className="card mt-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[12px] text-fg3">
                    {result.model.unit.label}
                    {result.extraction.cover.yearEnd ? `, year ended ${result.extraction.cover.yearEnd}` : ''}
                  </div>
                  <h2 className="mt-0.5 text-[24px] font-bold tracking-[-.02em]">{company}</h2>
                  <div className="mt-1 text-[12.5px] text-fg2">
                    {result.extraction.facts.length} figures read from PDF pages{' '}
                    {result.extraction.pages.map(p => p.page).join(', ')}. {result.assay.passed} checks passed,{' '}
                    {result.assay.flagged} flagged.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => download(result.workbook, `${base}-model.xlsx`, TYPES.xlsx)}>
                    <FileSpreadsheet size={15} /> Model .xlsx
                  </Button>
                  <Button onClick={() => download(result.memo, `${base}-memo.docx`, TYPES.docx)}>
                    <FileText size={15} /> Memo .docx
                  </Button>
                  <Button onClick={() => download(result.tearSheet, `${base}-tear-sheet.docx`, TYPES.docx)}>
                    <Download size={15} /> Tear sheet
                  </Button>
                </div>
              </div>
              <ResultTabs value={tab} onChange={setTab} flagged={result.assay.flagged} />
            </section>

            {tab === 'figures' && (
              <SecHead
                title="Reported figures"
                right={
                  <Segmented
                    size="sm"
                    value={statement}
                    onChange={setStatement}
                    label="Statement"
                    options={[
                      { v: 'income', l: 'Income' },
                      { v: 'balance', l: 'Balance sheet' },
                      { v: 'cashflow', l: 'Cash flow' }
                    ].map(o => ({ ...o, l: o.l }))}
                  />
                }
              />
            )}
            {tab === 'figures' && (
              <section className="card overflow-hidden">
                <p className="border-b border-line px-5 py-3 text-[12.5px] text-fg2">
                  Click any figure to open the PDF page with the row highlighted.
                </p>
                <StatementTable
                  facts={result.extraction.facts}
                  periods={[
                    ...new Set(result.extraction.facts.filter(f => f.statement === statement).map(f => f.period))
                  ].sort()}
                  statement={statement}
                  onOpen={setSource}
                  onFix={setCorrecting}
                />
              </section>
            )}
            {tab === 'figures' && (
              <CorrectionLog corrections={result.extraction.corrections} onUndo={undoCorrection} busy={recomputing} />
            )}

            {tab === 'market' && <SecHead title="Market data and peers" />}
            {tab === 'market' && (
              <section className="card p-5 sm:p-6">
                <MarketPanel
                  key={saved?.id ?? 'new'}
                  result={result}
                  ticker={ticker}
                  peers={peers}
                  busy={recomputing}
                  onApplyMarket={applyMarket}
                  onApplyPeers={applyPeers}
                />
              </section>
            )}

            {tab === 'valuation' && <SecHead title="Model and valuation" />}
            {tab === 'valuation' && (
              <section className="card p-5 sm:p-6">
                {result.model.kind === 'financial' ? (
                  <FinancialValuation
                    key={JSON.stringify(result.model.assumptions)}
                    result={result}
                    onApply={applyOverrides}
                    busy={recomputing}
                  />
                ) : (
                  <Valuation
                    key={JSON.stringify(result.model.assumptions)}
                    result={result}
                    onApply={applyOverrides}
                    busy={recomputing}
                  />
                )}
              </section>
            )}

            {tab === 'checks' && (
              <section className="card mt-5 p-5 sm:p-6">
                <h2 className="mb-3 text-[15px] font-semibold">Assayer</h2>
                <Assayer assay={result.assay} onOpenPage={page => setSource({ page })} />
              </section>
            )}
            {tab === 'narrative' && (
              <section className="card mt-5 p-5 sm:p-6">
                <h2 className="text-[15px] font-semibold">Business and risks</h2>
                {result.narrative ? (
                  <>
                    <p className="mt-1 text-[12px] text-fg3">
                      Drafted by {result.narrative.label} {result.narrative.model} from{' '}
                      {[result.narrative.businessSection, result.narrative.riskSection].filter(Boolean).join(' and ') ||
                        'Item 1 and Item 1A'}
                      . Sentences with figures are removed; figures come only from checked data.
                    </p>
                    <p className="mt-3 font-serif text-[14.5px] leading-relaxed text-fg">{result.narrative.business}</p>
                    <ul className="mt-3 space-y-2">
                      {result.narrative.risks.map(risk => (
                        <li key={risk} className="flex gap-2 font-serif text-[14px] leading-relaxed text-fg2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fg3" />
                          {risk}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                      {result.narrative.businessPages?.[0] && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setSource({ page: result.narrative.businessPages[0] })}
                        >
                          {result.narrative.businessSection || 'Item 1'}, page {result.narrative.businessPages[0]}
                        </Button>
                      )}
                      {result.narrative.riskPages?.[0] && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setSource({ page: result.narrative.riskPages[0] })}
                        >
                          {result.narrative.riskSection || 'Item 1A'}, page {result.narrative.riskPages[0]}
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-[13px] text-fg3">No narrative was drafted for this filing.</p>
                )}
              </section>
            )}
            {tab === 'history' && (
              <div className="mt-5">
                <VersionHistory saved={saved} saveError={saveError} />
              </div>
            )}
          </>
        )}

        <p className="mt-10 text-[11.5px] leading-relaxed text-fg3">
          The PDF is read in your browser. Saved runs keep it{' '}
          {store.kind === 'supabase' ? 'in your organisation’s private storage' : 'on this machine'}. Numbers are read
          from the page text by code; a language model only classifies statement rows and drafts the qualitative
          sections. Outputs are drafts for an analyst to review.
        </p>
      </div>

      <Sheet
        open={Boolean(correcting && result)}
        onOpenChange={open => !open && setCorrecting(null)}
        label="Correct a line item"
        className="w-[min(560px,100vw)]"
      >
        {correcting && result && (
          <CorrectionPanel
            key={`${correcting.statement}:${correcting.key}`}
            target={correcting}
            extraction={result.extraction}
            by={analyst}
            busy={recomputing}
            onSave={saveCorrection}
            onClose={() => setCorrecting(null)}
          />
        )}
      </Sheet>
      <Sheet
        open={Boolean(source)}
        onOpenChange={open => !open && setSource(null)}
        label="Source page"
        className="w-[min(760px,100vw)]"
      >
        {source && (
          <SourceViewer
            key={`${source.page}:${source.quote ?? ''}:${source.period ?? ''}`}
            pdf={pdf}
            source={source}
            onClose={() => setSource(null)}
            fileName={file?.name}
            ocr={ocr}
          />
        )}
      </Sheet>
    </div>
  );
}
