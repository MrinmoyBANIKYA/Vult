import * as React from 'react';
import NumberFlow from '@number-flow/react';
import { motion, useReducedMotion } from 'framer-motion';
import { Layers, FileText } from 'lucide-react';
import { Badge } from './ui.jsx';
import { PEOPLE_H, initials, clk } from '../lib/engine.js';
import LOGO from '../assets/vult-mark.png';
import { cn } from '../lib/utils.js';
import { F } from '../lib/format.js';

/* ---------------------------------------------------------------- brand */
export function Mark({ size = 26, className, tile }) {
  const img = (
    <img
      src={LOGO}
      alt=""
      width={tile ? Math.round(size * 0.62) : size}
      height={tile ? Math.round(size * 0.62) : size}
      draggable="false"
      className={cn('block shrink-0 select-none', !tile && className)}
    />
  );
  if (!tile) return img;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-[30%] bg-[hsl(228_16%_8%)] ring-1 ring-inset ring-white/10',
        className
      )}
      style={{ width: size, height: size }}
    >
      {img}
    </span>
  );
}
export function Av({ n, size = 22, live, bot, ring = true }) {
  if (bot) return <Mark size={size} tile />;
  const h = PEOPLE_H[n] != null ? PEOPLE_H[n] : (n.length * 47) % 360;
  return (
    <span
      title={n}
      className={cn(
        'relative grid shrink-0 place-items-center rounded-full font-semibold text-white',
        ring && 'ring-[2.5px] ring-chrome'
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        letterSpacing: '-.01em',
        background: `linear-gradient(140deg, hsl(${h} 78% 62%), hsl(${(h + 36) % 360} 70% 44%))`
      }}
    >
      {initials(n)}
      {live && <i className="absolute -bottom-px -right-px h-2 w-2 rounded-full bg-pos ring-2 ring-chrome" />}
    </span>
  );
}
export function Avs({ list, live, size }) {
  return (
    <span className="flex -space-x-1">
      {list.map((n, i) => (
        <Av key={n} n={n} size={size} live={live && i < 2} />
      ))}
    </span>
  );
}
export function CoLogo({ text, tg, size = 24, className }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-[32%] font-bold tracking-wide',
        tg
          ? 'bg-gold/[.14] text-gold ring-1 ring-inset ring-gold/35'
          : 'bg-fg/[.07] text-fg ring-1 ring-inset ring-fg/6',
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38) }}
    >
      {text}
    </span>
  );
}

/* ---------------------------------------------------------------- numbers */
export function Num({ value, fmt, prefix, suffix, className }) {
  const rm = useReducedMotion();
  if (value == null || !isFinite(value)) return <span className={className}>—</span>;
  return (
    <NumberFlow
      className={className}
      value={value}
      locales="en-GB"
      format={fmt}
      prefix={prefix}
      suffix={suffix}
      animated={!rm}
      willChange
    />
  );
}
export function PxNum({ d, v, className }) {
  return d.pence ? (
    <Num className={className} value={Math.round(v)} fmt={F.m0} suffix="p" />
  ) : (
    <Num className={className} value={v} fmt={F.m2} prefix="$" />
  );
}

/* ---------------------------------------------------------------- status */
export function Status({ s, p }) {
  const map = {
    run: ['gold', p != null ? `Running ${Math.round(p)}%` : 'Running', true],
    ok: ['pos', 'Delivered'],
    rev: ['info', 'In review'],
    draft: ['neutral', 'Draft'],
    paused: ['warn', 'Paused']
  };
  const [t, l, pulse] = map[s] || ['neutral', s];
  return (
    <Badge tone={t} dot pulse={pulse}>
      {l}
    </Badge>
  );
}

/* ---------------------------------------------------------------- hallmark */
function punchPath(txt, shape) {
  const h = 34,
    w = Math.max(42, txt.length * 11.5 + 20);
  let o, i;
  if (shape === 'chamfer') {
    o = `M7 1H${w - 7}L${w - 1} 7V${h - 7}L${w - 7} ${h - 1}H7L1 ${h - 7}V7Z`;
    i = `M8.5 4H${w - 8.5}L${w - 4} 8.5V${h - 8.5}L${w - 8.5} ${h - 4}H8.5L4 ${h - 8.5}V8.5Z`;
  } else if (shape === 'oval') {
    o = `M${w / 2} 1C${w - 6} 1 ${w - 1} 9 ${w - 1} ${h / 2}S${w - 6} ${h - 1} ${w / 2} ${h - 1}S1 ${h - 9} 1 ${h / 2}S6 1 ${w / 2} 1Z`;
    i = `M${w / 2} 4C${w - 9} 4 ${w - 4} 10 ${w - 4} ${h / 2}S${w - 9} ${h - 4} ${w / 2} ${h - 4}S4 ${h - 10} 4 ${h / 2}S9 4 ${w / 2} 4Z`;
  } else if (shape === 'shield') {
    o = `M1 1H${w - 1}V${h * 0.5}Q${w - 1} ${h - 5} ${w / 2} ${h - 1}Q1 ${h - 5} 1 ${h * 0.5}Z`;
    i = `M4 4H${w - 4}V${h * 0.5}Q${w - 4} ${h - 8} ${w / 2} ${h - 4}Q4 ${h - 8} 4 ${h * 0.5}Z`;
  } else {
    o = `M1 1H${w / 2 - 5}L${w / 2} 6L${w / 2 + 5} 1H${w - 1}V${h - 1}H1Z`;
    i = `M4 4H${w / 2 - 6}L${w / 2} 9L${w / 2 + 6} 4H${w - 4}V${h - 4}H4Z`;
  }
  return { w, h, o, i, ty: shape === 'shield' ? h / 2 + 2 : shape === 'notch' ? h / 2 + 6 : h / 2 + 5 };
}
export function Hallmark({ d, strike, size = 1, captions = true, className }) {
  const rm = useReducedMotion();
  const marks = [
    ['VT', 'chamfer', 'Maker'],
    ['999', 'oval', 'Fineness'],
    [d.office, 'shield', 'Office'],
    [d.init, 'notch', 'Signed']
  ];
  return (
    <div
      className={cn('flex flex-wrap items-start gap-2.5', className)}
      aria-label={`Hallmark: maker Vult, fineness 999, office ${d.office}, signed ${d.reviewer}`}
    >
      {marks.map(([t, s, c], k) => {
        const P = punchPath(t, s);
        return (
          <motion.div
            key={c + (strike ? 's' : '')}
            className="flex flex-col items-center gap-1"
            initial={strike && !rm ? { scale: 1.45, rotate: -6, opacity: 0 } : false}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 22, delay: k * 0.13 }}
          >
            <svg
              className="punch block overflow-visible"
              width={P.w * size}
              height={P.h * size}
              viewBox={`0 0 ${P.w} ${P.h}`}
              aria-hidden="true"
            >
              <path className="po" d={P.o} />
              <path className="pi" d={P.i} />
              <text x={P.w / 2} y={P.ty} textAnchor="middle">
                {t}
              </text>
            </svg>
            {captions && <small className="text-[10.5px] font-medium text-fg3">{c}</small>}
          </motion.div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- document page */
export function DocPage({ doc, pg, hl, lg, className }) {
  const hls = new Set(hl || []);
  const para = (t, i) => {
    if (pg.mark && t.indexOf(pg.mark) >= 0) {
      const [a, b] = t.split(pg.mark);
      return (
        <p key={i} className="mb-2">
          {a}
          <mark className="rounded-xs bg-[hsl(39_70%_62%/.38)] px-px text-inherit">{pg.mark}</mark>
          {b}
        </p>
      );
    }
    return (
      <p key={i} className="mb-2">
        {t}
      </p>
    );
  };
  return (
    <div
      className={cn(
        'on-paper relative rounded-md bg-page font-serif text-pagefg shadow-[0_0_0_1px_hsl(var(--pagefg)/.1),0_14px_34px_-18px_hsl(var(--shadow)/.6)]',
        lg
          ? 'mx-auto max-w-[700px] px-9 pb-5 pt-8 text-[14px] leading-[1.6]'
          : 'px-4 pb-3 pt-4 text-[12px] leading-[1.55]',
        className
      )}
    >
      <div
        className={cn(
          'mb-3 flex justify-between gap-3 border-b border-pagefg/10 pb-2 font-sans text-pagefg/55',
          lg ? 'text-[11.5px]' : 'text-[10px]'
        )}
      >
        <span>{doc.who}</span>
        <span className="text-right">{doc.t}</span>
      </div>
      <div className={cn('font-sans text-pagefg/55', lg ? 'text-xs' : 'text-[10.5px]')}>{pg.h}</div>
      <div className={cn('mb-2 font-semibold', lg ? 'text-[18px]' : 'text-[14px]')}>{pg.sub}</div>
      {pg.paras && pg.paras.slice(0, 1).map(para)}
      {pg.cols && (
        <table className={cn('my-2 w-full border-collapse font-sans tnum', lg ? 'text-[12.5px]' : 'text-[11px]')}>
          <thead>
            <tr>
              {pg.cols.map((c, i) => (
                <th
                  key={i}
                  className={cn(
                    'whitespace-nowrap border-b border-pagefg px-1.5 py-1 font-semibold text-pagefg/60',
                    i ? 'text-right' : 'text-left'
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pg.rows.map((r, i) => (
              <tr key={i} className={cn(hls.has(i) && 'doc-hl', r[pg.cols.length] === 1 && 'font-semibold')}>
                {r.slice(0, pg.cols.length).map((c, j) => (
                  <td
                    key={j}
                    className={cn(
                      'border-b border-pagefg/10 px-1.5 py-1',
                      j ? 'whitespace-nowrap text-right' : 'text-left',
                      r[pg.cols.length] === 1 && 'border-t border-t-pagefg'
                    )}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pg.paras && pg.paras.slice(1).map((t, i) => para(t, 'b' + i))}
      <div
        className={cn(
          'mt-2 flex justify-between border-t border-pagefg/10 pt-1.5 font-sans text-pagefg/50',
          lg ? 'text-[11px]' : 'text-[9.5px]'
        )}
      >
        <span>{doc.src}</span>
        <span>{typeof pg.p === 'number' ? 'Page ' + pg.p : pg.p}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- layout atoms */
export function Panel({ title, sub, right, children, className, bodyClass, pad = true, icon: I }) {
  return (
    <section className={cn('card min-w-0', className)}>
      {(title || right) && (
        <header className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1 px-5 pb-1 pt-4">
          {I && (
            <span className="grid h-7 w-7 place-items-center rounded-full bg-fg/6 text-fg2">
              <I size={14} />
            </span>
          )}
          {title && <h3 className="text-[15px] font-semibold tracking-[-.01em]">{title}</h3>}
          {sub && <span className="text-xs text-fg3">{sub}</span>}
          {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={cn(pad && 'px-5 pb-5 pt-3', pad && !(title || right) && 'pt-5', bodyClass)}>{children}</div>
    </section>
  );
}
export function PageHead({ title, sub, right }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="text-[26px] font-bold tracking-[-.03em] sm:text-[30px]">{title}</h1>
        {sub && <p className="mt-1.5 text-fg2">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}
export function SecHead({ title, right, className }) {
  return (
    <div className={cn('mb-3 mt-8 flex min-h-[30px] items-center justify-between gap-3', className)}>
      <h2 className="text-[16px] font-semibold tracking-[-.01em]">{title}</h2>
      {right}
    </div>
  );
}
export function Empty({ icon: I = Layers, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-line2 bg-raised/40 px-5 py-16 text-center text-fg2">
      <I size={22} className="mb-1 text-fg3" />
      <b className="text-[14px] font-semibold text-fg">{title}</b>
      <span className="max-w-[46ch]">{body}</span>
      {action}
    </div>
  );
}
export function Building({ at, rows = 6 }) {
  return (
    <div className="flex flex-col gap-3.5" aria-live="polite">
      <div className="flex items-center gap-2.5 text-[13px] text-fg2">
        <span className="h-2 w-2 animate-pulse2 rounded-full bg-gold shadow-[0_0_10px_hsl(var(--gold))]" />
        Building now. Ready at about {clk(at).slice(0, 5)} on the run clock.
      </div>
      <div className="skel h-16" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel h-7" style={{ width: `${96 - i * 7}%` }} />
      ))}
    </div>
  );
}
export function FileIcon({ kind, className }) {
  const map = { xlsx: ['bg-[#1D7A45]', 'XLS'], pptx: ['bg-[#C2541F]', 'PPT'], docx: ['bg-[#2A5BD7]', 'DOC'] };
  const [c, l] = map[kind] || ['bg-fg3', 'FILE'];
  return (
    <span
      className={cn(
        'grid h-[30px] w-[26px] shrink-0 place-items-center rounded-[5px] text-[8.5px] font-bold tracking-wide text-white',
        c,
        className
      )}
    >
      {l}
    </span>
  );
}
export function SrcIcon({ f, className }) {
  const map = {
    pdf: ['text-neg', 'PDF'],
    xls: ['text-pos', 'XLS'],
    web: ['text-info', 'WEB'],
    call: ['text-presence', 'CALL'],
    mkt: ['text-gold', 'DATA']
  };
  const [c, l] = map[f] || ['text-fg3', 'DOC'];
  return (
    <span
      className={cn(
        'grid h-8 w-7 shrink-0 place-items-center rounded-[5px] border border-line2 bg-inset text-[8.5px] font-bold',
        c,
        className
      )}
    >
      {l}
    </span>
  );
}
export { FileText };
