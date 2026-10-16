/**
 * OCR for scanned filings, in the browser with Tesseract (no data leaves the machine; no language model).
 * The engine files are self-hosted under /ocr (see vite.config.js), so nothing is fetched from a CDN.
 *
 * OCR reads digits less reliably than a text layer, so every page read this way is flagged by the Assayer
 * for an analyst to compare with the page image.
 */
import { createWorker } from 'tesseract.js';

const RENDER_SCALE = 3; // about 216 dpi; Tesseract reads small statement type best at 200-300 dpi

let workerPromise = null;
function worker() {
  workerPromise ??= createWorker('eng', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/core',
    langPath: '/ocr/lang',
    gzip: true
  });
  return workerPromise;
}

/**
 * Joins OCR words into lines of text the statement parser understands: words close together get a space,
 * a gap wider than about two characters becomes a column break (three spaces), as in pdf-text.js.
 * `lines` is [{ words: [{ text, bbox: { x0, y0, x1, y1 } }] }].
 */
export function ocrLinesToText(lines) {
  const out = [];
  for (const line of lines ?? []) {
    const words = [...(line.words ?? [])].filter(w => String(w.text).trim()).sort((a, b) => a.bbox.x0 - b.bbox.x0);
    if (!words.length) continue;
    const height = words.reduce((sum, w) => sum + (w.bbox.y1 - w.bbox.y0), 0) / words.length || 10;
    let text = '';
    let end = null;
    for (const w of words) {
      if (end !== null) text += w.bbox.x0 - end > height * 1.2 ? '   ' : ' ';
      text += String(w.text).trim();
      end = w.bbox.x1;
    }
    out.push(text);
  }
  return out.join('\n');
}

/** Renders a pdf.js page and reads it. Returns { text, lines, width, height } in rendered pixels. */
export async function ocrPage(pdfPage) {
  const viewport = pdfPage.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await pdfPage.render({ canvas, viewport }).promise;
  const result = await (await worker()).recognize(canvas, {}, { blocks: true, text: false });
  const lines = (result.data.blocks ?? []).flatMap(block =>
    (block.paragraphs ?? []).flatMap(paragraph =>
      (paragraph.lines ?? []).map(line => ({
        words: (line.words ?? []).map(w => ({ text: w.text, bbox: w.bbox }))
      }))
    )
  );
  canvas.width = 0;
  canvas.height = 0;
  return { text: ocrLinesToText(lines), lines, width: viewport.width, height: viewport.height, scale: RENDER_SCALE };
}
