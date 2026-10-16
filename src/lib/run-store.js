/**
 * Saved Filing desk runs. In live mode they go to Supabase (desk_runs, desk_run_versions and the private
 * `sources` bucket) under the organisation's row-level security; without Supabase the local engine keeps
 * them in .vult/runs on this machine.
 *
 * A record holds what is needed to rebuild every output: the statement rows, the model's row mapping, the
 * analyst's corrections and assumptions, and the narrative. Outputs are rebuilt on open, not stored.
 */
import { engine } from './engine-client.js';
import { deleteDeskRun, getDeskRun, getDeskRunPdf, listDeskRuns, saveDeskRun } from './api.js';
import { describeCorrection } from './corrections.js';

export function runStore({ live, orgId }) {
  if (live && orgId)
    return {
      kind: 'supabase',
      list: () => listDeskRuns(orgId),
      load: id => getDeskRun(id),
      pdf: id => getDeskRunPdf(id),
      save: body => saveDeskRun(orgId, body),
      remove: id => deleteDeskRun(id)
    };
  return {
    kind: 'engine',
    list: async () => (await engine.listRuns()).runs,
    load: id => engine.getRun(id),
    pdf: id => engine.getRunPdf(id),
    async save({ record, pageTexts, pdf }) {
      if (pdf) await engine.saveRunPdf(record.id, pdf);
      return engine.saveRun(record.id, { record, ...(pageTexts ? { pageTexts } : {}) });
    },
    remove: id => engine.deleteRun(id)
  };
}

export const newRunId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** The headline numbers of a result, kept with each version. */
export function summarise(result) {
  const { model, assay } = result;
  const base = {
    kind: model.kind ?? 'corporate',
    unit: model.unit.label,
    passed: assay.passed,
    flagged: assay.flagged
  };
  if (model.kind === 'financial') {
    const v = model.valuation;
    return { ...base, pb: v.pb, equityValue: v.equityValue, perShare: v.perShare, costOfEquity: v.costOfEquity };
  }
  const d = model.dcf;
  return { ...base, ev: d.ev, equityValue: d.equityValue, perShare: d.perShare, wacc: d.wacc };
}

/** Plain-English note for what changed between two states. */
export function changeNote({ before, after }) {
  const notes = [];
  const prior = new Map((before.corrections ?? []).map(c => [c.id, c]));
  const now = new Map((after.corrections ?? []).map(c => [c.id, c]));
  for (const [id, c] of now) if (!prior.has(id)) notes.push(`Correction: ${describeCorrection(c)}`);
  for (const [id, c] of prior) if (!now.has(id)) notes.push(`Correction undone: ${describeCorrection(c)}`);
  const keys = new Set([...Object.keys(before.overrides ?? {}), ...Object.keys(after.overrides ?? {})]);
  for (const key of keys) {
    const a = before.overrides?.[key];
    const b = after.overrides?.[key];
    if (a !== b && !(a == null && b == null)) notes.push(`${key} ${a ?? 'default'} to ${b ?? 'default'}`);
  }
  return notes.join('; ') || 'Recalculated';
}

export function addVersion(versions, { note, by, overrides, corrections, result }) {
  return [
    ...(versions ?? []),
    {
      n: (versions?.length ?? 0) + 1,
      at: new Date().toISOString(),
      by,
      note,
      overrides: overrides ?? {},
      corrections: corrections ?? [],
      summary: summarise(result)
    }
  ];
}

/** The record saved for a result. Page text and the PDF are saved separately, once. */
export function toRecord({ id, result, overrides, peers = [], ticker = '', createdAt, createdBy, versions }) {
  const x = result.extraction;
  return {
    schema: 1,
    id,
    company: x.company,
    fileName: x.fileName,
    createdAt,
    updatedAt: new Date().toISOString(),
    createdBy,
    sector: result.sector ?? x.sector ?? 'corporate',
    unit: x.unit,
    cover: x.cover,
    llmInfo: x.llmInfo,
    pages: x.pages.map(({ page, statement }) => ({ page, statement })),
    statements: x.statements,
    narrative: result.narrative ?? null,
    corrections: x.corrections ?? [],
    overrides: overrides ?? {},
    peers,
    ticker,
    reference: x.reference ?? null,
    ocrPages: x.ocrPages ?? [],
    versions
  };
}

/** Turns a saved record and its page text back into an extraction that buildOutputs accepts. */
export function fromRecord(record, pageTexts) {
  return {
    facts: [],
    issues: [],
    statements: record.statements,
    pageTexts,
    unit: record.unit,
    company: record.company,
    fileName: record.fileName,
    cover: record.cover ?? {},
    llmInfo: record.llmInfo,
    pages: record.pages.map(p => ({ ...p, text: String(pageTexts?.[p.page] ?? '').slice(0, 16000) })),
    sector: record.sector,
    corrections: record.corrections ?? [],
    reference: record.reference ?? null,
    ocrPages: record.ocrPages ?? []
  };
}
