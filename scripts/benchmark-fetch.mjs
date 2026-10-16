#!/usr/bin/env node
// Builds a benchmark corpus of real filings without committing any: for each ticker, downloads the latest
// 10-K from SEC EDGAR, prints it to PDF with a local Chromium browser (Edge or Chrome), and writes the
// answer key from the company's own XBRL figures. Everything goes to .vult/benchmark (git-ignored).
//
//   node scripts/benchmark-fetch.mjs AAPL MSFT KO JPM          # or set VULT_BENCHMARK_DIR
//
// SEC asks for a User-Agent with a name and email: set VULT_SEC_USER_AGENT in .env.local.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { secFundamentals } from '../server/market.js';
import { findBrowser, printToPdf } from '../server/filings.js';

const ROOT = path.resolve(import.meta.dirname, '..');
for (const file of ['.env.local', '.env'])
  if (fs.existsSync(path.join(ROOT, file))) process.loadEnvFile(path.join(ROOT, file));
const DIR = process.env.VULT_BENCHMARK_DIR || path.join(ROOT, '.vult', 'benchmark');
const AGENT = process.env.VULT_SEC_USER_AGENT || 'Vult research desk benchmark (set VULT_SEC_USER_AGENT)';

const browser = findBrowser();

async function sec(url) {
  const response = await fetch(url, { headers: { 'user-agent': AGENT }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response;
}

async function fetchOne(ticker) {
  const facts = await secFundamentals(ticker);
  const submissions = await (await sec(`https://data.sec.gov/submissions/CIK${facts.cik}.json`)).json();
  const recent = submissions.filings.recent;
  const i = recent.form.findIndex(form => form === '10-K');
  if (i < 0) throw new Error('no 10-K in recent filings');
  const accession = recent.accessionNumber[i].replace(/-/g, '');
  const url = `https://www.sec.gov/Archives/edgar/data/${Number(facts.cik)}/${accession}/${recent.primaryDocument[i]}`;
  const name = `${ticker.toLowerCase()}-10k-${recent.reportDate[i] || recent.filingDate[i]}`;
  const html = path.join(DIR, `${name}.html`);
  const pdf = path.join(DIR, `${name}.pdf`);
  fs.writeFileSync(html, await (await sec(url)).text());
  await printToPdf(browser, html, pdf);
  fs.rmSync(html, { force: true });
  // The answer key: every line item SEC reports for the filing's fiscal years, in units.
  const year = (recent.reportDate[i] || recent.filingDate[i]).slice(0, 4);
  const years = new Set([year, String(Number(year) - 1), String(Number(year) - 2)]);
  const truth = {};
  for (const [key, byYear] of Object.entries(facts.annual))
    for (const [y, value] of Object.entries(byYear)) if (years.has(y)) (truth[key] ??= {})[y] = value;
  fs.writeFileSync(
    path.join(DIR, `${name}.truth.json`),
    JSON.stringify(
      { ticker, company: facts.name, source: url, truthSource: facts.source, currency: 'USD', facts: truth },
      null,
      1
    )
  );
  return { name, url };
}

if (!browser) {
  console.error('No Edge or Chrome found to print filings to PDF; set VULT_BROWSER.');
  process.exit(1);
}
fs.mkdirSync(DIR, { recursive: true });
const tickers = process.argv.slice(2);
if (!tickers.length) {
  console.error('Give tickers: node scripts/benchmark-fetch.mjs AAPL MSFT');
  process.exit(1);
}
for (const ticker of tickers) {
  try {
    const { name, url } = await fetchOne(ticker.toUpperCase());
    console.log(`${ticker}: ${name}.pdf from ${url}`);
  } catch (error) {
    console.log(`${ticker}: failed, ${error.message}`);
  }
}
