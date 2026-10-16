import * as React from 'react';
import { AlertTriangle, Check, LoaderCircle, Undo2, X } from 'lucide-react';
import { Button, Segmented } from '../components/ui.jsx';
import { cn } from '../lib/utils.js';
import { describeCorrection, makeCorrection, rowsOnPage } from '../lib/corrections.js';
import { STATEMENT_KEYS } from '../../supabase/functions/_shared/statements.js';

const field =
  'h-8 w-full rounded-lg border border-line2 bg-raised px-2.5 text-[13px] tabular-nums outline-hidden focus:border-gold/70';

/**
 * Lets an analyst correct one line item: point it at other printed rows (on a statement or a note page),
 * clear a wrong match, or enter a figure with the page it is printed on. Every change needs a reason.
 */
export function CorrectionPanel({ target, extraction, by, busy, onSave, onClose }) {
  const { statement, key } = target;
  const spec = STATEMENT_KEYS[statement][key];
  const multi = Boolean(spec[3]);
  const statementPages = extraction.pages.filter(p => p.statement.split(', ').includes(statement)).map(p => p.page);
  const current = extraction.facts.filter(f => f.statement === statement && f.key === key);
  const periods = [...new Set(extraction.facts.filter(f => f.statement === statement).map(f => f.period))].sort();
  const pageCount = Object.keys(extraction.pageTexts ?? {}).length;

  const [mode, setMode] = React.useState('remap');
  const [page, setPage] = React.useState(current[0]?.page ?? statementPages[0] ?? 1);
  const [picked, setPicked] = React.useState([]);
  const [values, setValues] = React.useState({});
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState('');
  const rows = React.useMemo(() => rowsOnPage(extraction.pageTexts, page), [extraction.pageTexts, page]);

  const toggle = row =>
    setPicked(list =>
      list.some(r => r.id === row.id) ? list.filter(r => r.id !== row.id) : multi ? [...list, row] : [row]
    );

  const save = () => {
    setError('');
    try {
      onSave(
        makeCorrection({
          statement,
          key,
          action: mode,
          rows: picked,
          values: Object.fromEntries(Object.entries(values).filter(([, v]) => String(v).trim() !== '')),
          page,
          reason,
          by
        })
      );
    } catch (cause) {
      setError(cause.message);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="text-[12px] text-fg3">Correct a line item</div>
          <div className="mt-0.5 truncate text-[15px] font-semibold">{spec[0]}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-fg3">{spec[1]}</p>
        </div>
        <Button variant="ghost" size="iconsm" onClick={onClose} aria-label="Close">
          <X size={16} />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4 text-[13px]">
        <div>
          <div className="text-[12px] font-semibold text-fg3">Now</div>
          {current.length ? (
            <ul className="mt-1 space-y-1">
              {[...new Map(current.map(f => [f.rowId, f])).values()].map(f => (
                <li key={f.rowId} className="text-fg2">
                  “{f.label}”, PDF page {f.page}
                  {f.source === 'analyst' ? ' (entered by an analyst)' : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-fg3">Not found in the filing.</p>
          )}
        </div>

        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          label="Correction"
          options={[
            { v: 'remap', l: 'Pick a row' },
            { v: 'manual', l: 'Enter a figure' },
            { v: 'clear', l: 'Clear' }
          ]}
        />

        {mode !== 'clear' && (
          <label className="block text-[12px] text-fg2">
            PDF page
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              {statementPages.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPage(p);
                    setPicked([]);
                  }}
                  className={cn(
                    'h-7 rounded-full border px-2.5 text-[12px]',
                    p === page ? 'border-gold/70 bg-gold/10 text-fg' : 'border-line2 text-fg2'
                  )}
                >
                  {p}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={pageCount}
                value={page}
                onChange={event => {
                  setPage(Math.max(1, Math.min(pageCount, Number(event.target.value) || 1)));
                  setPicked([]);
                }}
                aria-label="Any PDF page"
                className={cn(field, 'w-20')}
              />
              <span className="text-[11.5px] text-fg3">Note pages work too.</span>
            </span>
          </label>
        )}

        {mode === 'remap' && (
          <div>
            <div className="text-[12px] text-fg3">
              {multi ? 'Choose every row that makes up this line.' : 'Choose the row.'} Values are read from the page by
              code.
            </div>
            <ul className="mt-2 max-h-80 divide-y divide-line overflow-auto rounded-lg border border-line">
              {rows.length ? (
                rows.map(row => {
                  const on = picked.some(r => r.id === row.id);
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => toggle(row)}
                        aria-pressed={on}
                        className={cn(
                          'flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-fg/4',
                          on && 'bg-gold/10'
                        )}
                      >
                        <span className="mt-0.5 w-4 shrink-0">{on && <Check size={14} className="text-gold" />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-fg">{row.label}</span>
                          {row.section && <span className="block truncate text-[11px] text-fg3">{row.section}</span>}
                        </span>
                        <span className="shrink-0 text-right font-mono text-[12px] text-fg2">
                          {row.printed.join('   ')}
                          {!row.periods && <span className="block text-[10.5px] text-warn">years not matched</span>}
                        </span>
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="px-3 py-3 text-fg3">No rows with figures on this page.</li>
              )}
            </ul>
          </div>
        )}

        {mode === 'manual' && (
          <div>
            <div className="text-[12px] text-fg3">
              Use this only when the figure is not printed as a row. The Assayer checks that each value is printed on
              the page you give.
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {periods.map(period => (
                <label key={period} className="block text-[12px] text-fg2">
                  FY{period}
                  <input
                    inputMode="decimal"
                    value={values[period] ?? ''}
                    onChange={event => setValues({ ...values, [period]: event.target.value })}
                    className={cn(field, 'mt-1')}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <label className="block text-[12px] text-fg2">
          Reason (kept in the log, the workbook and the memo)
          <textarea
            value={reason}
            onChange={event => setReason(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-line2 bg-raised px-2.5 py-2 text-[13px] outline-hidden focus:border-gold/70"
          />
        </label>
        {error && (
          <p role="alert" className="flex items-start gap-2 text-[12.5px] text-neg">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
        <span className="text-[12px] text-fg3">As {by}</span>
        <Button variant="primary" size="sm" onClick={save} disabled={busy}>
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
          Save and recalculate
        </Button>
      </div>
    </div>
  );
}

/** The corrections made so far, with the option to undo one. */
export function CorrectionLog({ corrections, onUndo, busy }) {
  if (!corrections?.length) return null;
  return (
    <div className="mt-4 rounded-xl border border-line">
      <div className="border-b border-line px-4 py-2.5 text-[13px] font-semibold">
        Corrections ({corrections.length})
      </div>
      <ul className="divide-y divide-line">
        {corrections.map(c => (
          <li key={c.id} className="flex items-start gap-3 px-4 py-2.5 text-[12.5px] leading-relaxed text-fg2">
            <span className="min-w-0 flex-1">{describeCorrection(c)}</span>
            <Button size="xs" variant="ghost" onClick={() => onUndo(c.id)} disabled={busy}>
              <Undo2 size={13} /> Undo
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
