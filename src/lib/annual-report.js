import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { linesToText, normalizeText, pageLines } from './pdf-text.js';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Opens a PDF from its bytes for the source viewer. pdf.js takes ownership of what it is given, so it gets a copy. */
export const openPdf = bytes => pdfjs.getDocument({ data: bytes.slice() }).promise;

// A page with fewer characters than this in its text layer is treated as scanned and read by OCR.
const SCANNED = 40;

/**
 * Reads every page of a PDF in the browser. Pages without a text layer (scans) are read by OCR on this
 * machine. The document stays open so the source viewer can render pages, and the bytes are returned so the
 * run can be saved. `onProgress(page, total, phase)` reports 'text' then 'ocr'.
 */
export async function readAnnualReport(file, onProgress = () => {}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await openPdf(bytes);
  const pageTexts = {};
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    pageTexts[pageNumber] = linesToText(pageLines((await page.getTextContent()).items));
    page.cleanup();
    onProgress(pageNumber, pdf.numPages, 'text');
  }
  const scanned = Object.keys(pageTexts)
    .map(Number)
    .filter(page => pageTexts[page].replace(/\s/g, '').length < SCANNED);
  const ocr = {};
  if (scanned.length) {
    const { ocrPage } = await import('./ocr.js');
    for (const [i, pageNumber] of scanned.entries()) {
      onProgress(i + 1, scanned.length, 'ocr');
      const page = await pdf.getPage(pageNumber);
      const read = await ocrPage(page);
      page.cleanup();
      if (read.text.replace(/\s/g, '').length >= SCANNED) {
        pageTexts[pageNumber] = read.text;
        ocr[pageNumber] = { lines: read.lines, scale: read.scale };
      }
    }
  }
  const characters = Object.values(pageTexts).reduce((sum, text) => sum + text.length, 0);
  if (characters < pdf.numPages * SCANNED)
    throw new Error('Too little text could be read from this PDF, even with OCR. Check it is not blank or protected.');
  return { pdf, pageTexts, pageCount: pdf.numPages, bytes, ocr };
}

/**
 * Renders one page onto `canvas` and returns highlight boxes, in CSS pixels, for the printed row
 * (`quote`) and the printed value within it.
 */
export async function renderSourcePage(pdf, pageNumber, canvas, { width, quote, column, columns, ocr }) {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = width / base.width;
  const viewport = page.getViewport({ scale });
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * ratio);
  canvas.height = Math.floor(viewport.height * ratio);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  await page.render({ canvas, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null }).promise;

  const boxes = [];
  const isValue = text => /^\(?-?[\d,.]+[pc]?\)?$|^[—–-]$/.test(text.replace(/[\s$£€]/g, ''));
  if (quote && ocr) {
    // A scanned page: boxes come from the OCR word positions, rendered at a different scale.
    const { ocrLinesToText } = await import('./ocr.js');
    const wanted = String(quote).split('\n').map(normalizeText).filter(Boolean);
    const factor = scale / ocr.scale;
    const box = words => {
      const left = Math.min(...words.map(w => w.bbox.x0)) * factor;
      const top = Math.min(...words.map(w => w.bbox.y0)) * factor;
      return {
        left,
        top,
        width: Math.max(...words.map(w => w.bbox.x1)) * factor - left,
        height: Math.max(...words.map(w => w.bbox.y1)) * factor - top
      };
    };
    for (const line of ocr.lines ?? []) {
      const text = normalizeText(ocrLinesToText([line]));
      const words = [...(line.words ?? [])].sort((a, b) => a.bbox.x0 - b.bbox.x0);
      if (!words.length || !wanted.includes(text)) continue;
      boxes.push({ kind: 'row', ...box(words) });
      if (Number.isInteger(column) && columns && text === wanted.at(-1)) {
        const numeric = words.filter(w => isValue(String(w.text)));
        const target = numeric[numeric.length - columns + column];
        if (target) boxes.push({ kind: 'value', ...box([target]) });
      }
    }
  } else if (quote) {
    const { items } = await page.getTextContent();
    const lines = pageLines(items);
    const wanted = String(quote).split('\n').map(normalizeText).filter(Boolean);
    const box = spans => {
      const rects = spans.map(span => {
        const item = items[span.index];
        const [, , , d, x, y] = item.transform;
        const h = Math.abs(d) || item.height || 10;
        const [x1, y1] = viewport.convertToViewportPoint(x, y - h * 0.25);
        const [x2, y2] = viewport.convertToViewportPoint(x + item.width, y + h * 0.95);
        return { left: Math.min(x1, x2), top: Math.min(y1, y2), right: Math.max(x1, x2), bottom: Math.max(y1, y2) };
      });
      const left = Math.min(...rects.map(r => r.left));
      const top = Math.min(...rects.map(r => r.top));
      return {
        left,
        top,
        width: Math.max(...rects.map(r => r.right)) - left,
        height: Math.max(...rects.map(r => r.bottom)) - top
      };
    };
    for (const line of lines) {
      if (!wanted.includes(normalizeText(line.text)) || !line.spans.length) continue;
      boxes.push({ kind: 'row', ...box(line.spans) });
      if (Number.isInteger(column) && columns && normalizeText(line.text) === wanted.at(-1)) {
        // Value cells are the last `columns` numeric spans on the row; pick the one for this year.
        const numeric = line.spans.filter(span => isValue(line.text.slice(span.start, span.end)));
        const target = numeric[numeric.length - columns + column];
        if (target) boxes.push({ kind: 'value', ...box([target]) });
      }
    }
  }
  page.cleanup();
  return { boxes, height: viewport.height };
}
