/**
 * Analyst corrections to a model's row classification. Every correction is kept as a log entry (who, when,
 * why) and replayed over the model's original mapping, so the figures are always rebuilt from source:
 *
 *   remap   point a line item at different printed rows, on a statement page or a note page. Values are
 *           still read from the page text by code.
 *   clear   the model matched a row that is not this line item; leave it empty.
 *   manual  a figure that is not printed as a row (for example in prose). The analyst gives the value and the
 *           page; the Assayer checks the value appears on that page and flags it when it does not.
 */
import { STATEMENT_KEYS } from '../../supabase/functions/_shared/statements.js';
import { resolveFacts, statementRows } from './filing.js';

let sequence = 0;
const nextId = () => `c${Date.now().toString(36)}${(sequence++).toString(36)}`;

/** Rows printed on one page, with ids that cannot clash with the pipeline's numeric ids. */
export function rowsOnPage(pageTexts, page) {
  const text = pageTexts?.[page];
  if (!text) return [];
  return statementRows([{ page: Number(page), text }], 1).map(row => ({ ...row, id: `p${page}r${row.id}` }));
}

/** A new log entry. `by` is the analyst's name. */
export function makeCorrection({ statement, key, action, rows = [], values = {}, page = null, reason, by }) {
  if (!STATEMENT_KEYS[statement]?.[key]) throw new Error('Unknown line item');
  if (!['remap', 'clear', 'manual'].includes(action)) throw new Error('Unknown correction');
  if (!String(reason ?? '').trim()) throw new Error('Give a reason for the correction');
  if (action === 'remap' && !rows.length) throw new Error('Choose at least one row');
  if (action === 'manual' && (!Number.isFinite(Number(page)) || !Object.keys(values).length))
    throw new Error('Give the page and at least one value');
  return {
    id: nextId(),
    statement,
    key,
    action,
    // Rows are stored whole, so a correction does not depend on ids from a particular run.
    rows: rows.map(({ id, page: p, section, label, printed, values: v, periods, quote, note, offset }) => ({
      id,
      page: p,
      section,
      label,
      printed,
      values: v,
      periods,
      quote,
      ...(note ? { note } : {}),
      ...(offset ? { offset } : {})
    })),
    values: Object.fromEntries(
      Object.entries(values)
        .map(([period, value]) => [String(period), Number(value)])
        .filter(([, value]) => Number.isFinite(value))
    ),
    page: action === 'manual' ? Number(page) : null,
    reason: String(reason).trim().slice(0, 500),
    by: String(by || 'Analyst').slice(0, 80),
    at: new Date().toISOString()
  };
}

/**
 * Rebuilds facts from each statement's rows and the model's mapping, with corrections replayed in order.
 * `statements` is { income: { rows, mapping }, ... } as kept by the pipeline.
 */
export function applyCorrections({ statements, unit, corrections = [] }) {
  const facts = [];
  const issues = [];
  for (const [statement, { rows, mapping }] of Object.entries(statements ?? {})) {
    const merged = { ...mapping };
    const extraRows = [];
    const manual = new Map();
    for (const c of corrections.filter(entry => entry.statement === statement)) {
      manual.delete(c.key);
      if (c.action === 'clear') merged[c.key] = [];
      if (c.action === 'remap') {
        merged[c.key] = c.rows.map(row => row.id);
        extraRows.push(...c.rows);
      }
      if (c.action === 'manual') {
        merged[c.key] = [];
        manual.set(c.key, c);
      }
    }
    const known = new Set(rows.map(row => row.id));
    const resolved = resolveFacts(statement, [...rows, ...extraRows.filter(row => !known.has(row.id))], merged, unit);
    const corrected = new Map(corrections.filter(c => c.statement === statement).map(c => [c.key, c]));
    facts.push(
      ...resolved.facts.map(fact => {
        const c = corrected.get(fact.key);
        return c?.action === 'remap' ? { ...fact, correction: c.id } : fact;
      })
    );
    issues.push(...resolved.issues);
    for (const [key, c] of manual) {
      const spec = STATEMENT_KEYS[statement][key];
      for (const [period, value] of Object.entries(c.values)) {
        facts.push({
          statement,
          key,
          part: 0,
          label: `Entered by ${c.by}`,
          name: spec[0],
          period,
          value,
          printed: String(value),
          column: null,
          columns: null,
          unit: unit.label,
          page: c.page,
          quote: c.reason,
          rowId: `manual:${key}`,
          source: 'analyst',
          correction: c.id
        });
      }
    }
  }
  return { facts, issues };
}

/** Plain-English description of a correction, for the log. */
export function describeCorrection(c) {
  const name = STATEMENT_KEYS[c.statement]?.[c.key]?.[0] ?? c.key;
  const when = new Date(c.at).toISOString().slice(0, 16).replace('T', ' ');
  const what =
    c.action === 'clear'
      ? `${name} cleared`
      : c.action === 'remap'
        ? `${name} set to ${c.rows.map(row => `"${row.label}" (PDF page ${row.page})`).join(' + ')}`
        : `${name} entered as ${Object.entries(c.values)
            .map(([period, value]) => `FY${period} ${value}`)
            .join(', ')} from PDF page ${c.page}`;
  return `${what}. ${c.by}, ${when} UTC: ${c.reason}`;
}
