/**
 * Rebuilds readable lines from pdf.js text items. Pure, so it runs in the browser and in Node.
 *
 * pdf.js splits text at font and kerning changes ("28", ", 2024"), so joining items with spaces
 * breaks verbatim quotes and table rows. Items are grouped by baseline, ordered left to right, and
 * a space (or a wider gap for table columns) is inserted only where the page leaves visible space.
 */

const LINE_TOLERANCE = 2.5; // points; items on the same baseline within this distance share a line

export function pageLines(items) {
  const glyphs = (items ?? [])
    .map((item, index) => ({
      index,
      str: typeof item.str === 'string' ? item.str : '',
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
      w: item.width ?? 0,
      h: Math.abs(item.transform?.[3] ?? item.height ?? 10) || 10
    }))
    .filter(glyph => glyph.str.trim() !== '');

  // Top of page first (PDF y grows upwards), then left to right.
  glyphs.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines = [];
  for (const glyph of glyphs) {
    const line = lines.at(-1);
    if (line && Math.abs(line.y - glyph.y) <= LINE_TOLERANCE) line.glyphs.push(glyph);
    else lines.push({ y: glyph.y, glyphs: [glyph] });
  }

  return lines.map(line => {
    line.glyphs.sort((a, b) => a.x - b.x);
    let text = '';
    let end = null;
    const spans = [];
    for (const glyph of line.glyphs) {
      if (end !== null) {
        const gap = glyph.x - end;
        // A gap wider than about two characters is a column break in a statement table.
        if (gap > glyph.h * 1.2) text += '   ';
        else if (gap > glyph.h * 0.15 && !/\s$/.test(text) && !/^\s/.test(glyph.str)) text += ' ';
      }
      const start = text.length;
      text += glyph.str;
      spans.push({ index: glyph.index, start, end: text.length });
      end = glyph.x + glyph.w;
    }
    return { text: text.replace(/\s+$/, ''), y: line.y, spans };
  });
}

/** Page text as newline-separated lines, which keeps statement rows intact for extraction and quoting. */
export const linesToText = lines => lines.map(line => line.text).join('\n');

/** Collapses whitespace and unifies dashes so quotes compare reliably against page text. */
export const normalizeText = value =>
  String(value ?? '')
    .normalize('NFKC')
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
