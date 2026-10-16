#!/usr/bin/env node
// Measures extraction accuracy on a corpus of filings, with the model the engine is set to (a local one by
// default). For each filing in .vult/benchmark with a `<name>.truth.json` answer key, it runs the real
// pipeline and scores every line item: correct, wrong (a value that differs from the key) or missing.
//
//   npm run engine                         # in another terminal
//   node scripts/benchmark-fetch.mjs AAPL MSFT KO   # builds a corpus from SEC filings (optional)
//   npm run benchmark                      # scores every filing in .vult/benchmark
//   npm run benchmark -- --fixtures        # scores the model on Vult's fictional US, UK and bank layouts
//
// Reports go to .vult/benchmark/reports as JSON and Markdown. Nothing here is committed.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { linesToText, pageLines } from '../src/lib/pdf-text.js';
import { readSpreadsheetBytes } from '../src/lib/spreadsheet-input.js';
import { runPipeline } from '../src/lib/pipeline.js';
import { engineClient } from '../src/lib/engine-client.js';
import { factIndex } from '../src/lib/model.js';
import { STATEMENT_KEYS } from '../supabase/functions/_shared/statements.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = process.env.VULT_BENCHMARK_DIR || path.join(ROOT, '.vult', 'benchmark');
const ENGINE = `http://127.0.0.1:${process.env.VULT_ENGINE_PORT || 8787}/engine`;
const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const option = name => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];

pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(ROOT, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
).href;

async function readPdf(file) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true }).promise;
  const pageTexts = {};
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    pageTexts[n] = linesToText(pageLines((await page.getTextContent()).items));
    page.cleanup();
  }
  await doc.destroy();
  return pageTexts;
}

/** Scores extracted facts against an answer key in units: { 'income:revenue': { 2025: 1.2e9 } }. */
export function score(facts, unit, truth) {
  const index = factIndex(facts);
  const rows = [];
  for (const [ref, byYear] of Object.entries(truth)) {
    const [statement, key] = ref.split(':');
    if (!STATEMENT_KEYS[statement]?.[key] || key === 'eps_diluted' || key === 'shares_diluted') continue;
    for (const [year, expected] of Object.entries(byYear)) {
      if (!Number.isFinite(expected)) continue;
      const got = index.get(statement, key, year);
      // Compare sizes: filings and XBRL sign costs and outflows differently.
      const status = !Number.isFinite(got)
        ? 'missing'
        : Math.abs(Math.abs(got * unit.scale) - Math.abs(expected)) <=
            Math.max(unit.scale / 2, Math.abs(expected) * 5e-4)
          ? 'correct'
          : 'wrong';
      rows.push({ key: ref, year, expected, got: Number.isFinite(got) ? got * unit.scale : null, status });
    }
  }
  return rows;
}

async function fixtureCases() {
  const cases = [];
  for (const [file, pagesName, fakeName, label] of [
    ['annual-report.js', 'PAGE_TEXTS', 'fakeLlm', 'Fictional US 10-K'],
    ['uk-annual-report.js', 'UK_PAGE_TEXTS', 'fakeUkLlm', 'Fictional UK annual report'],
    ['bank-annual-report.js', 'BANK_PAGE_TEXTS', 'fakeBankLlm', 'Fictional UK bank']
  ]) {
    const mod = await import(pathToFileURL(path.join(ROOT, 'src', 'lib', 'fixtures', file)).href);
    // The answer key is what the exact-label stand-in model extracts.
    const keyRun = await runPipeline({ pageTexts: mod[pagesName], fileName: file, llm: mod[fakeName]() });
    const truth = {};
    const index = factIndex(keyRun.extraction.facts);
    for (const f of keyRun.extraction.facts)
      (truth[`${f.statement}:${f.key}`] ??= {})[f.period] =
        index.get(f.statement, f.key, f.period) * keyRun.model.unit.scale;
    cases.push({ name: label, pageTexts: mod[pagesName], truth });
  }
  return cases;
}

function corpusCases() {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter(name => name.endsWith('.truth.json'))
    .map(name => {
      const base = name.replace(/\.truth\.json$/, '');
      const source = ['.pdf', '.xlsx', '.csv'].map(ext => path.join(DIR, base + ext)).find(f => fs.existsSync(f));
      return source
        ? { name: base, file: source, truth: JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8')).facts }
        : null;
    })
    .filter(Boolean);
}

const llm = engineClient(ENGINE);
try {
  await llm.health();
} catch {
  console.error(`The engine is not answering at ${ENGINE}. Start it with npm run engine.`);
  process.exit(1);
}
const settings = await llm.health();
let cases = flag('fixtures') ? await fixtureCases() : corpusCases();
if (option('only')) cases = cases.filter(c => c.name.includes(option('only')));
if (!cases.length) {
  console.error(`No filings with answer keys in ${DIR}. Run scripts/benchmark-fetch.mjs first, or use --fixtures.`);
  process.exit(1);
}

const results = [];
for (const c of cases) {
  const started = Date.now();
  try {
    const pageTexts =
      c.pageTexts ??
      (/\.pdf$/i.test(c.file)
        ? await readPdf(c.file)
        : (await readSpreadsheetBytes(new Uint8Array(fs.readFileSync(c.file)), c.file)).pageTexts);
    const out = await runPipeline({ pageTexts, fileName: c.name, llm });
    const rows = score(out.extraction.facts, out.model.unit, c.truth);
    const count = status => rows.filter(r => r.status === status).length;
    results.push({
      name: c.name,
      seconds: Math.round((Date.now() - started) / 1000),
      unit: out.model.unit.label,
      sector: out.sector,
      checks: { passed: out.assay.passed, flagged: out.assay.flagged },
      correct: count('correct'),
      wrong: count('wrong'),
      missing: count('missing'),
      rows
    });
    console.log(
      `${c.name}: ${count('correct')} correct, ${count('wrong')} wrong, ${count('missing')} missing (${Math.round((Date.now() - started) / 1000)}s)`
    );
  } catch (error) {
    results.push({ name: c.name, error: error.message, seconds: Math.round((Date.now() - started) / 1000) });
    console.log(`${c.name}: failed, ${error.message}`);
  }
}

// Per line item: accuracy (correct of all expected) and precision (correct of all extracted).
const byKey = {};
for (const r of results.flatMap(x => x.rows ?? [])) {
  const k = (byKey[r.key] ??= { correct: 0, wrong: 0, missing: 0 });
  k[r.status] += 1;
}
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a');
const total = Object.values(byKey).reduce(
  (t, k) => ({ correct: t.correct + k.correct, wrong: t.wrong + k.wrong, missing: t.missing + k.missing }),
  { correct: 0, wrong: 0, missing: 0 }
);
const lines = [
  `# Vult extraction benchmark`,
  '',
  `Model: ${settings.llm.label} ${settings.llm.model}${settings.llm.local ? ' (local)' : ''}. ${results.length} filings, ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
  '',
  `Overall: accuracy ${pct(total.correct, total.correct + total.wrong + total.missing)}, precision ${pct(total.correct, total.correct + total.wrong)} (${total.correct} correct, ${total.wrong} wrong, ${total.missing} missing).`,
  '',
  '| Line item | Accuracy | Precision | Correct | Wrong | Missing |',
  '| --- | --- | --- | --- | --- | --- |',
  ...Object.entries(byKey)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, k]) =>
        `| ${key} | ${pct(k.correct, k.correct + k.wrong + k.missing)} | ${pct(k.correct, k.correct + k.wrong)} | ${k.correct} | ${k.wrong} | ${k.missing} |`
    ),
  '',
  '| Filing | Seconds | Unit | Checks passed / flagged | Correct | Wrong | Missing |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...results.map(r =>
    r.error
      ? `| ${r.name} | ${r.seconds} | failed: ${r.error} | | | | |`
      : `| ${r.name} | ${r.seconds} | ${r.unit} | ${r.checks.passed} / ${r.checks.flagged} | ${r.correct} | ${r.wrong} | ${r.missing} |`
  )
];
const reports = path.join(DIR, 'reports');
fs.mkdirSync(reports, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
fs.writeFileSync(
  path.join(reports, `benchmark-${stamp}.json`),
  JSON.stringify({ model: settings.llm, results }, null, 1)
);
fs.writeFileSync(path.join(reports, `benchmark-${stamp}.md`), lines.join('\n') + '\n');
console.log('\n' + lines.join('\n'));
