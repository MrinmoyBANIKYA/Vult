/**
 * Reads financial statements from a spreadsheet (data-room .xlsx or .csv) into the same "pages" of text the
 * PDF path produces: one page per sheet, one line per row, cells separated by three spaces. The statement
 * finder, the model's row classification, the Assayer and corrections then work unchanged, and every figure
 * cites its sheet and row.
 */
import ExcelJS from 'exceljs';

const YEAR = /^(19|20)\d{2}$/;
// Sheet names that say which statement a sheet holds, when the sheet itself has no heading.
const SHEET_HEADINGS = [
  [/p\s*&\s*l|profit|income|i\/s|\bis\b|earnings|operations/i, 'Income statement'],
  [/balance|b\/s|\bbs\b|financial position/i, 'Balance sheet'],
  [/cash/i, 'Cash flow statement']
];

const grouped = value => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6, useGrouping: true }).format(value);

/** The value a cell shows: a formula's cached result, a date's year, a rich text's plain text. */
function cellValue(cell) {
  let value = cell?.value ?? null;
  if (value && typeof value === 'object') {
    if ('result' in value) value = value.result;
    else if ('richText' in value) value = value.richText.map(part => part.text).join('');
    else if ('text' in value) value = value.text;
    else if (!(value instanceof Date)) value = null;
  }
  return value;
}

/**
 * Turns rows of cell values into page text. A row whose numbers are all years (or dates) is a column header
 * and keeps them as years; every other number is printed with thousands separators, so a figure of 2,024 is
 * never taken for a year.
 */
export function rowsToText(rows) {
  return rows
    .map(row => {
      const values = row.map(v => (v instanceof Date ? v.getUTCFullYear() : v));
      const numbers = values.filter(v => typeof v === 'number');
      const header = numbers.length > 0 && numbers.every(v => Number.isInteger(v) && YEAR.test(String(v)));
      return values
        .map(v => {
          if (v === null || v === undefined || v === '') return '';
          if (typeof v === 'number') return header ? String(v) : v < 0 ? `(${grouped(-v)})` : grouped(v);
          return String(v).replace(/\s+/g, ' ').trim();
        })
        .filter(Boolean)
        .join('   ');
    })
    .filter(line => line.trim())
    .join('\n');
}

/** Minimal CSV parsing: quoted fields, commas inside quotes, doubled quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  // Numbers come through as numbers so they print like spreadsheet values.
  return rows.map(r =>
    r.map(cell => {
      const trimmed = cell.trim();
      const plain = trimmed.replace(/,/g, '');
      if (/^\(?-?\d+(\.\d+)?\)?$/.test(plain)) {
        const n = Number(plain.replace(/[()]/g, ''));
        return /^\(.*\)$/.test(plain) || plain.startsWith('-') ? -Math.abs(n) : n;
      }
      return trimmed;
    })
  );
}

/** Builds pages from named sheets of rows. Returns { pageTexts, sheets: [{ page, name, rows }] }. */
export function sheetsToPages(sheets) {
  const pageTexts = {};
  const out = [];
  sheets.forEach(({ name, rows }, i) => {
    const page = i + 1;
    const heading = SHEET_HEADINGS.find(([pattern]) => pattern.test(name))?.[1];
    const text = rowsToText(rows);
    // The sheet name, and the statement it names, head the page so the statement finder recognises it.
    pageTexts[page] = [name, heading && !new RegExp(heading, 'i').test(text) ? heading : null, text]
      .filter(Boolean)
      .join('\n');
    out.push({ page, name, rows });
  });
  return { pageTexts, sheets: out };
}

/** Reads an .xlsx or .csv file. Returns { pageTexts, sheets, bytes, kind }. */
export async function readSpreadsheet(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return readSpreadsheetBytes(bytes, file.name);
}

export async function readSpreadsheetBytes(bytes, name) {
  if (/\.csv$/i.test(name)) {
    const rows = parseCsv(new TextDecoder().decode(bytes));
    return { ...sheetsToPages([{ name: name.replace(/\.csv$/i, ''), rows }]), bytes, kind: 'csv' };
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes);
  const sheets = [];
  wb.eachSheet(ws => {
    if (ws.state && ws.state !== 'visible') return;
    const rows = [];
    ws.eachRow({ includeEmpty: false }, row => {
      const values = [];
      for (let c = 1; c <= row.cellCount; c += 1) values.push(cellValue(row.getCell(c)));
      rows.push(values);
    });
    if (rows.length) sheets.push({ name: ws.name, rows });
  });
  if (!sheets.length) throw new Error('The workbook has no visible sheets with data.');
  return { ...sheetsToPages(sheets), bytes, kind: 'xlsx' };
}

/** Sources Vult can read. */
export const isSpreadsheet = name => /\.(xlsx|csv)$/i.test(String(name));
