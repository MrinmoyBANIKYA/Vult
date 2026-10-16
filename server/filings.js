// Real filings from SEC EDGAR: finds a company's latest annual report (10-K, or 20-F / 40-F for foreign
// issuers), prints the filing to PDF with a local Chromium browser (Edge or Chrome) so the Filing desk reads
// it exactly as it reads an uploaded PDF, and caches the PDF in .vult/cache/filings.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { secCompany } from './market.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, '.vult', 'cache', 'filings');
const ANNUAL_FORMS = ['10-K', '20-F', '40-F'];

const agent = () =>
  process.env.VULT_SEC_USER_AGENT || 'Vult research desk (set VULT_SEC_USER_AGENT to your name and email)';

export class FilingError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function findBrowser() {
  return [
    process.env.VULT_BROWSER,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ]
    .filter(Boolean)
    .find(file => fs.existsSync(file));
}

/** Prints a local HTML file to PDF with a headless browser. */
export function printToPdf(browser, html, pdf) {
  return new Promise((resolve, reject) =>
    execFile(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-pdf-header-footer',
        `--user-data-dir=${path.join(DIR, '.browser')}`,
        `--print-to-pdf=${pdf}`,
        `file:///${html.replace(/\\/g, '/')}`
      ],
      { timeout: 180000, windowsHide: true },
      error => (error && !fs.existsSync(pdf) ? reject(error) : resolve())
    )
  );
}

async function sec(url) {
  const response = await fetch(url, { headers: { 'user-agent': agent() }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new FilingError(502, `SEC EDGAR answered ${response.status} for ${url}`);
  return response;
}

/** The latest annual filing for a US-listed ticker: where it is on EDGAR and what it covers. */
export async function latestAnnualFiling(rawTicker) {
  const ticker = String(rawTicker ?? '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) throw new FilingError(400, 'Enter a US ticker such as MSFT');
  const company = await secCompany(ticker);
  const cik = String(company.cik).padStart(10, '0');
  const { filings } = await (await sec(`https://data.sec.gov/submissions/CIK${cik}.json`)).json();
  const recent = filings.recent;
  const i = recent.form.findIndex(form => ANNUAL_FORMS.includes(form));
  if (i < 0) throw new FilingError(404, `${ticker} has no 10-K, 20-F or 40-F in its recent filings`);
  const accession = recent.accessionNumber[i].replace(/-/g, '');
  const folder = `https://www.sec.gov/Archives/edgar/data/${Number(company.cik)}/${accession}/`;
  return {
    ticker,
    company: company.name,
    form: recent.form[i],
    period: recent.reportDate[i] || '',
    filed: recent.filingDate[i] || '',
    url: `${folder}${recent.primaryDocument[i]}`,
    folder,
    name: `${ticker.toLowerCase()}-${recent.form[i].toLowerCase()}-${recent.reportDate[i] || recent.filingDate[i]}`
  };
}

/** The latest annual filing as PDF bytes, with what it is. Printed once, then served from the cache. */
export async function annualFilingPdf(ticker) {
  const filing = await latestAnnualFiling(ticker);
  fs.mkdirSync(DIR, { recursive: true });
  const pdf = path.join(DIR, `${filing.name}.pdf`);
  if (!fs.existsSync(pdf)) {
    const browser = findBrowser();
    if (!browser) throw new FilingError(501, 'Install Edge or Chrome (or set VULT_BROWSER) to print filings to PDF');
    const html = path.join(DIR, `${filing.name}.html`);
    // Images and styles in the filing are relative to its EDGAR folder.
    const page = (await (await sec(filing.url)).text()).replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${filing.folder}">`
    );
    fs.writeFileSync(html, page);
    try {
      await printToPdf(browser, html, pdf);
    } finally {
      fs.rmSync(html, { force: true });
    }
    if (!fs.existsSync(pdf)) throw new FilingError(500, 'The filing could not be printed to PDF');
  }
  return { filing, bytes: fs.readFileSync(pdf) };
}
