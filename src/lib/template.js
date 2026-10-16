/**
 * Fills a firm's own Excel model template with the figures Vult read from a filing, so analysts keep their
 * house model instead of adopting Vult's. Two ways to say where each figure goes:
 *
 *   Defined names   vult.<statement>.<key>.FY<offset>, e.g. vult.income.revenue.FY0 (latest year) or
 *                   vult.balance.total_equity.FY-1 (the year before). Name a single cell.
 *   A "Vult map"    sheet with columns: line item (income:revenue), year (FY0, FY-1, or 2025), target cell
 *                   (Model!D12). Rows that do not parse are reported, not guessed.
 *
 * Only figures read from the filing are written, each with a note giving its page and printed row; every
 * other cell, formula and format in the template is left as it was. Nothing is inferred.
 */
import ExcelJS from 'exceljs';
import { factIndex } from './model.js';
import { STATEMENT_KEYS } from '../../supabase/functions/_shared/statements.js';

const NAME = /^vult\.(income|balance|cashflow)\.([a-z_]+)\.(FY0|FY-\d|\d{4})$/i;

/** Resolves "FY0", "FY-1" or "2025" to a period among those extracted (sorted ascending). */
export function resolvePeriod(spec, periods) {
  const text = String(spec).trim().toUpperCase();
  if (/^\d{4}$/.test(text)) return periods.includes(text) ? text : null;
  const match = /^FY(0|-\d)$/.exec(text);
  if (!match) return null;
  const index = periods.length - 1 + Number(match[1]);
  return periods[index] ?? null;
}

function splitAddress(address, fallbackSheet) {
  const match = /^(?:'?([^'!]+)'?!)?\$?([A-Z]{1,3})\$?(\d+)$/i.exec(String(address).trim());
  if (!match) return null;
  return { sheet: match[1] ?? fallbackSheet, cell: `${match[2].toUpperCase()}${match[3]}` };
}

/** Collects the targets a template asks for: [{ statement, key, periodSpec, sheet, cell, from }]. */
function targets(wb) {
  const out = [];
  const problems = [];
  // Defined names.
  const model = wb.definedNames?.model ?? [];
  for (const entry of model) {
    const match = NAME.exec(entry.name ?? '');
    if (!match) continue;
    const ranges = entry.ranges ?? [];
    const address = splitAddress(ranges[0] ?? '', null);
    if (!address?.sheet) {
      problems.push(`Name ${entry.name} does not point at one cell`);
      continue;
    }
    out.push({
      statement: match[1].toLowerCase(),
      key: match[2].toLowerCase(),
      periodSpec: match[3],
      ...address,
      from: entry.name
    });
  }
  // A "Vult map" sheet.
  const map = wb.worksheets.find(ws => /^vult map$/i.test(ws.name.trim()));
  map?.eachRow((row, n) => {
    const [item, year, where] = [row.getCell(1).text, row.getCell(2).text, row.getCell(3).text].map(v =>
      String(v ?? '').trim()
    );
    if (!item || /line item/i.test(item)) return;
    const [statement, key] = item.toLowerCase().split(':');
    const address = splitAddress(where, null);
    if (!STATEMENT_KEYS[statement]?.[key] || !address?.sheet) {
      problems.push(`Vult map row ${n}: "${item}" to "${where}" was not understood`);
      return;
    }
    out.push({ statement, key, periodSpec: year, ...address, from: `Vult map row ${n}` });
  });
  return { targets: out, problems };
}

/**
 * Fills the template. Returns { buffer, filled: [...], missing: [...], problems: [...] }, where `missing`
 * lists targets the filing did not give a figure for.
 */
export async function fillTemplate(templateBytes, { facts, unit, fileName }) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBytes);
  const { targets: wanted, problems } = targets(wb);
  const index = factIndex(facts);
  const periods = [...new Set(facts.map(f => f.period))].sort();
  const filled = [];
  const missing = [];
  for (const t of wanted) {
    const period = resolvePeriod(t.periodSpec, periods);
    const sheet = wb.getWorksheet(t.sheet);
    if (!sheet) {
      problems.push(`${t.from}: there is no sheet called "${t.sheet}"`);
      continue;
    }
    const value = period ? index.get(t.statement, t.key, period) : null;
    const sources = period ? index.facts(t.statement, t.key, period) : [];
    if (!Number.isFinite(value)) {
      missing.push({ ...t, period, name: STATEMENT_KEYS[t.statement]?.[t.key]?.[0] ?? t.key });
      continue;
    }
    const cell = sheet.getCell(t.cell);
    cell.value = value;
    cell.note = [
      `Vult: ${STATEMENT_KEYS[t.statement][t.key][0]}, FY${period}, ${unit.label}.`,
      ...sources.map(f =>
        f.source === 'analyst'
          ? `Entered by an analyst from page ${f.page}: ${f.quote}`
          : `${fileName}, page ${f.page}: "${String(f.quote).replace(/\s+/g, ' ').slice(0, 140)}"`
      )
    ].join('\n');
    filled.push({ ...t, period, value });
  }
  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, filled, missing, problems };
}
