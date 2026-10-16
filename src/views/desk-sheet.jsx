import * as React from 'react';
import { X } from 'lucide-react';
import { Button, Segmented } from '../components/ui.jsx';
import { cn } from '../lib/utils.js';
import { rowsToText } from '../lib/spreadsheet-input.js';
import { normalizeText } from '../lib/pdf-text.js';

const show = value =>
  value === null || value === undefined
    ? ''
    : value instanceof Date
      ? value.toISOString().slice(0, 10)
      : typeof value === 'number'
        ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6 }).format(value)
        : String(value);

/** A spreadsheet source: the sheet a figure came from, with its row and cell highlighted. */
export function SheetViewer({ sheets, source, onClose, fileName }) {
  const [page, setPage] = React.useState(source?.page ?? sheets[0]?.page ?? 1);
  const sheet = sheets.find(s => s.page === page) ?? sheets[0];
  const rowRef = React.useRef(null);
  const wanted = normalizeText(
    String(source?.quote ?? '')
      .split('\n')
      .at(-1)
  );
  const hit =
    source?.page === sheet?.page ? sheet.rows.findIndex(row => normalizeText(rowsToText([row])) === wanted) : -1;
  // The value is the n-th number on the row, counted the same way the parser counted printed cells.
  const numericCells = hit >= 0 ? sheet.rows[hit].map((v, i) => [v, i]).filter(([v]) => typeof v === 'number') : [];
  const valueCell =
    hit >= 0 && Number.isInteger(source?.column) && source?.columns
      ? numericCells[numericCells.length - source.columns + source.column]?.[1]
      : null;
  React.useEffect(() => {
    rowRef.current?.scrollIntoView({ block: 'center' });
  }, [hit, page]);
  const width = Math.max(...(sheet?.rows ?? []).map(r => r.length), 1);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="text-[12px] text-fg3">{fileName}</div>
          <div className="mt-0.5 truncate text-[15px] font-semibold">
            {source?.name ? `${source.name}, FY${source.period}` : `Sheet “${sheet?.name}”`}
          </div>
          {source?.printed !== undefined && (
            <div className="mt-1 text-[12.5px] text-fg2">
              Reads <span className="font-mono text-fg">{source.printed}</span> on sheet “{sheet?.name}”, row “
              {source.label}”
            </div>
          )}
        </div>
        <Button variant="ghost" size="iconsm" onClick={onClose} aria-label="Close source">
          <X size={16} />
        </Button>
      </div>
      {sheets.length > 1 && (
        <div className="border-b border-line px-5 py-2">
          <Segmented
            size="sm"
            value={page}
            onChange={setPage}
            label="Sheet"
            options={sheets.map(s => ({ v: s.page, l: s.name }))}
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto bg-inset p-3">
        <table className="light-scope w-full border-collapse bg-white text-[12px] text-[hsl(228_30%_10%)]">
          <tbody>
            {(sheet?.rows ?? []).map((row, r) => (
              <tr
                key={r}
                ref={r === hit ? rowRef : null}
                className={cn('border-b border-[hsl(220_14%_90%)]', r === hit && 'bg-[hsl(210_96%_46%/.13)]')}
              >
                <td className="w-8 px-2 py-1 text-right text-[10.5px] text-[hsl(220_9%_46%)]">{r + 1}</td>
                {Array.from({ length: width }, (_, c) => (
                  <td
                    key={c}
                    className={cn(
                      'px-2 py-1',
                      typeof row[c] === 'number' ? 'text-right font-mono tabular-nums' : 'text-left',
                      r === hit && c === valueCell && 'bg-[hsl(48_100%_55%/.45)] ring-2 ring-[hsl(210_96%_46%)]'
                    )}
                  >
                    {show(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
