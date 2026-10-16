// Saved Filing desk runs on the engine machine, for local use without Supabase. Each run is three files in
// .vult/runs (git-ignored): the record (extraction, corrections, assumptions and versions), the page text and
// the PDF. Nothing leaves the machine.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = process.env.VULT_RUNS_DIR || path.join(ROOT, '.vult', 'runs');
const ID = /^[a-z0-9-]{8,64}$/;

const file = (id, ext) => {
  if (!ID.test(String(id))) throw Object.assign(new Error('Invalid run id'), { status: 400 });
  return path.join(DIR, `${id}${ext}`);
};
const ensure = () => fs.mkdirSync(DIR, { recursive: true });

/** Summaries of every saved run, newest first. */
export function listRuns() {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter(name => name.endsWith('.json') && !name.endsWith('.texts.json'))
    .map(name => {
      try {
        const record = JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));
        return {
          id: record.id,
          company: record.company,
          fileName: record.fileName,
          sector: record.sector,
          createdBy: record.createdBy,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          versions: record.versions?.length ?? 0,
          summary: record.versions?.at(-1)?.summary ?? null
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function getRun(id) {
  const recordFile = file(id, '.json');
  if (!fs.existsSync(recordFile)) throw Object.assign(new Error('Run not found'), { status: 404 });
  const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
  const textsFile = file(id, '.texts.json');
  const pageTexts = fs.existsSync(textsFile) ? JSON.parse(fs.readFileSync(textsFile, 'utf8')) : null;
  return { record, pageTexts, hasPdf: fs.existsSync(file(id, '.pdf')) };
}

/** Saves the record, and the page text when it is sent (it does not change after the first save). */
export function saveRun(id, { record, pageTexts }) {
  if (!record || record.id !== id) throw Object.assign(new Error('Record id does not match'), { status: 400 });
  ensure();
  fs.writeFileSync(file(id, '.json'), JSON.stringify(record));
  if (pageTexts) fs.writeFileSync(file(id, '.texts.json'), JSON.stringify(pageTexts));
  return { id, saved: true };
}

export function savePdf(id, base64) {
  ensure();
  const bytes = Buffer.from(String(base64 ?? ''), 'base64');
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw Object.assign(new Error('Not a PDF'), { status: 400 });
  fs.writeFileSync(file(id, '.pdf'), bytes);
  return { id, bytes: bytes.length };
}

export function readPdf(id) {
  const pdf = file(id, '.pdf');
  if (!fs.existsSync(pdf)) throw Object.assign(new Error('PDF not found'), { status: 404 });
  return fs.readFileSync(pdf);
}

export function deleteRun(id) {
  for (const ext of ['.json', '.texts.json', '.pdf']) {
    const target = file(id, ext);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
  return { id, deleted: true };
}
