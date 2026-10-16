#!/usr/bin/env node
// Runs the Filing desk pipeline on one annual report or 10-K from the command line, with the model the engine
// is set to, and writes the model .xlsx, memo .docx and tear sheet .docx next to the PDF (or into --out).
//
//   npm run engine                                  # in another terminal
//   npm run report -- path/to/annual-report.pdf [--out=folder]
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { linesToText, pageLines } from '../src/lib/pdf-text.js';
import { STEPS, runPipeline } from '../src/lib/pipeline.js';
import { engineClient } from '../src/lib/engine-client.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENGINE = `http://127.0.0.1:${process.env.VULT_ENGINE_PORT || 8787}/engine`;
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const out = args.find(a => a.startsWith('--out='))?.slice(6);

pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(ROOT, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
).href;

async function readPdf(pdfFile) {
  const task = pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdfFile)), useSystemFonts: true });
  const doc = await task.promise;
  const pageTexts = {};
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    pageTexts[n] = linesToText(pageLines((await page.getTextContent()).items));
    page.cleanup();
  }
  await task.destroy();
  return pageTexts;
}

if (!file || !fs.existsSync(file)) {
  console.error('Usage: npm run report -- path/to/annual-report.pdf [--out=folder]');
  process.exit(1);
}

const llm = engineClient(ENGINE);
try {
  const health = await llm.health();
  console.log(
    `Engine: ${health.llm.label} ${health.llm.model}, LibreOffice ${health.libreoffice ? 'found' : 'missing'}`
  );
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const started = Date.now();
const titles = Object.fromEntries(STEPS);
const pageTexts = await readPdf(file);
console.log(`Read ${Object.keys(pageTexts).length} pages`);
const result = await runPipeline({
  pageTexts,
  fileName: path.basename(file),
  llm,
  onStep: (step, status, note) =>
    status !== 'running' && console.log(`  ${status.padEnd(7)} ${titles[step] ?? step}${note ? `: ${note}` : ''}`)
});

const dir = out || path.dirname(file);
fs.mkdirSync(dir, { recursive: true });
const base = path.basename(file, path.extname(file));
const written = [
  [`${base}-model.xlsx`, result.workbook],
  [`${base}-memo.docx`, result.memo],
  [`${base}-tear-sheet.docx`, result.tearSheet]
].map(([name, data]) => {
  fs.writeFileSync(path.join(dir, name), Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data));
  return path.join(dir, name);
});
const { passed, flagged } = result.assay;
console.log(`\n${result.extraction.company}: Assayer ${passed} passed, ${flagged} flagged`);
console.log(`Done in ${Math.round((Date.now() - started) / 1000)} s`);
for (const name of written) console.log(`  ${name}`);
