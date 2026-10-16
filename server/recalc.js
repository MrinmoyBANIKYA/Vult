// Recalculates a workbook in LibreOffice and reads selected cells back, so the app can confirm that the
// formulas in the .xlsx produce the same numbers as the engine. LibreOffice is optional.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';

const CANDIDATES = [
  process.env.VULT_SOFFICE,
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  // A per-user copy, extracted with `msiexec /a` when there are no admin rights.
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'LibreOffice', 'program', 'soffice.exe'),
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  '/usr/bin/soffice',
  '/usr/local/bin/soffice',
  '/opt/libreoffice/program/soffice'
].filter(Boolean);

export function findSoffice() {
  return CANDIDATES.find(candidate => fs.existsSync(candidate)) ?? null;
}

// Forces LibreOffice to recalculate every formula when it opens an .xlsx, rather than trusting cached values.
const RECALC_PROFILE = `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="ODFRecalcMode" oor:op="fuse"><value>0</value></prop></item>
</oor:items>`;

const run = (file, args, timeout) =>
  new Promise((resolve, reject) => {
    execFile(file, args, { timeout, windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stderr }));
      else resolve(stdout);
    });
  });

function cellValue(cell) {
  const value = cell.value;
  if (value && typeof value === 'object') {
    if ('error' in value) return { error: value.error };
    if ('result' in value && value.result !== undefined) return value.result;
    // ExcelJS drops a cached result of 0 when it reads a file (`<v>0</v>`). LibreOffice always writes a value
    // or an error for a formula it calculated, so a formula with no result here is a zero.
    if ('formula' in value || 'sharedFormula' in value) return value.result?.error ? { error: value.result.error } : 0;
    if ('richText' in value) return value.richText.map(part => part.text).join('');
  }
  return value ?? null;
}

/** Recalculates `buffer` and returns the values of `cells` (["Sheet!B5", ...]). */
export async function recalcWorkbook(buffer, cells) {
  const soffice = findSoffice();
  if (!soffice) {
    const error = new Error('LibreOffice is not installed on the engine machine');
    error.status = 501;
    throw error;
  }
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vult-recalc-'));
  try {
    const profile = path.join(work, 'profile');
    fs.mkdirSync(path.join(profile, 'user'), { recursive: true });
    fs.writeFileSync(path.join(profile, 'user', 'registrymodifications.xcu'), RECALC_PROFILE);
    const input = path.join(work, 'model.xlsx');
    const outDir = path.join(work, 'out');
    fs.writeFileSync(input, buffer);
    await run(
      soffice,
      [
        `-env:UserInstallation=${pathToFileURL(profile).href}`,
        '--headless',
        '--norestore',
        '--nolockcheck',
        '--convert-to',
        'xlsx:Calc MS Excel 2007 XML',
        '--outdir',
        outDir,
        input
      ],
      120_000
    );
    const output = path.join(outDir, 'model.xlsx');
    if (!fs.existsSync(output)) throw new Error('LibreOffice did not produce a recalculated workbook');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(output);
    const values = {};
    for (const ref of cells) {
      const [, sheetName, address] = /^'?(.+?)'?!([A-Z]+\d+)$/.exec(ref) ?? [];
      const sheet = sheetName && workbook.getWorksheet(sheetName);
      values[ref] = sheet ? cellValue(sheet.getCell(address)) : null;
    }
    return { values, engine: path.basename(path.dirname(path.dirname(soffice))) };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
