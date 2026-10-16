import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import process from 'node:process';
import path from 'node:path';
import test from 'node:test';
import { buildOutputs, runPipeline } from './pipeline.js';
import { makeCorrection } from './corrections.js';
import { addVersion, changeNote, fromRecord, summarise, toRecord } from './run-store.js';
import { UK_PAGE_TEXTS, fakeUkLlm } from './fixtures/uk-annual-report.js';

test('a saved run reopens to the same figures, corrections and history', async () => {
  const first = await runPipeline({ pageTexts: UK_PAGE_TEXTS, fileName: 'halden.pdf', llm: fakeUkLlm() });
  const correction = makeCorrection({
    statement: 'income',
    key: 'interest_expense',
    action: 'clear',
    reason: 'Modelled separately.',
    by: 'A. Analyst'
  });
  const overrides = { beta: 1.2, sharePrice: 3 };
  const corrected = {
    ...first,
    ...(await buildOutputs({
      extraction: { ...first.extraction, corrections: [correction] },
      overrides,
      peers: [],
      narrative: first.narrative,
      llm: fakeUkLlm()
    }))
  };
  let versions = addVersion([], { note: 'Built from the filing', by: 'A. Analyst', overrides: {}, result: first });
  const note = changeNote({
    before: { overrides: {}, corrections: [] },
    after: { overrides, corrections: [correction] }
  });
  assert.match(note, /^Correction: Interest expense cleared/);
  assert.match(note, /beta default to 1.2/);
  versions = addVersion(versions, { note, by: 'A. Analyst', overrides, corrections: [correction], result: corrected });
  const record = toRecord({
    id: 'run-123456',
    result: corrected,
    overrides,
    createdAt: '2026-10-15T10:00:00.000Z',
    createdBy: 'A. Analyst',
    versions
  });
  // The record is plain JSON and carries no page text.
  const stored = JSON.parse(JSON.stringify(record));
  assert.ok(!JSON.stringify(stored.pages).includes('Revenue'));

  const reopened = await buildOutputs({
    extraction: fromRecord(stored, UK_PAGE_TEXTS),
    overrides: stored.overrides,
    peers: [],
    narrative: stored.narrative,
    llm: fakeUkLlm()
  });
  assert.deepEqual(summarise(reopened), summarise(corrected));
  assert.deepEqual(summarise(reopened), stored.versions[1].summary);
  assert.ok(!reopened.extraction.facts.some(f => f.key === 'interest_expense'));
  assert.equal(stored.versions.length, 2);
});

test('the engine keeps runs on disk and refuses bad ids', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vult-runs-'));
  process.env.VULT_RUNS_DIR = dir;
  const runs = await import('../../server/runs.js');
  const record = { id: 'run-abcdef12', company: 'Halden Group plc', versions: [{ n: 1, summary: { passed: 1 } }] };
  runs.saveRun('run-abcdef12', { record, pageTexts: { 1: 'text' } });
  runs.savePdf('run-abcdef12', Buffer.from('%PDF-1.7 test').toString('base64'));
  assert.equal(runs.listRuns()[0].company, 'Halden Group plc');
  assert.deepEqual(runs.getRun('run-abcdef12').pageTexts, { 1: 'text' });
  assert.equal(runs.readPdf('run-abcdef12').toString('latin1').slice(0, 5), '%PDF-');
  assert.throws(() => runs.getRun('../../etc'), /Invalid run id/);
  assert.throws(() => runs.savePdf('run-abcdef12', Buffer.from('not a pdf').toString('base64')), /Not a PDF/);
  runs.deleteRun('run-abcdef12');
  assert.equal(runs.listRuns().length, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
