import * as React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  ScatterChart,
  Scatter,
  ZAxis,
  LabelList,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  ReferenceArea
} from 'recharts';
import { calc, sharePx, fx, fp, nf0 } from '../lib/engine.js';

const C = {
  fg: 'hsl(var(--fg))',
  fg2: 'hsl(var(--fg2))',
  fg3: 'hsl(var(--fg3))',
  line: 'hsl(var(--line))',
  line2: 'hsl(var(--line2))',
  gold: 'hsl(var(--gold))',
  pos: 'hsl(var(--pos))',
  neg: 'hsl(var(--neg))',
  info: 'hsl(var(--info))',
  presence: 'hsl(var(--presence))',
  raised: 'hsl(var(--raised))',
  surface: 'hsl(var(--surface))'
};
const tick = { fill: C.fg3, fontSize: 11 };
function nice(maxV, n = 4) {
  const raw = maxV / n,
    p = Math.pow(10, Math.floor(Math.log10(raw))),
    f = raw / p,
    st = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p,
    top = Math.ceil(maxV / st) * st,
    t = [];
  for (let v = 0; v <= top + st * 1e-6; v += st) t.push(+v.toFixed(6));
  return { top, t };
}
const axisProps = { tickLine: false, axisLine: false, tick };

export function Glass({ title, rows }) {
  return (
    <div className="glass min-w-[150px] rounded-xl border border-line2/70 px-3.5 py-2.5 text-xs shadow-pop">
      {title && <div className="mb-1.5 font-semibold text-fg">{title}</div>}
      {rows.map(([k, v, c], i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-fg2">
          {c && <span className="mr-1 h-2 w-2 rounded-xs" style={{ background: c }} />}
          <span className="flex-1">{k}</span>
          <b className="font-semibold text-fg tnum">{v}</b>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- spark */
export function Spark({ data, w = 120, h = 28, tone = 'fg3' }) {
  const id = React.useId().replace(/:/g, '');
  const col = C[tone] || C.fg3;
  return (
    <AreaChart
      width={w}
      height={h}
      data={data.map((y, x) => ({ x, y }))}
      margin={{ top: 3, bottom: 2, left: 0, right: 3 }}
    >
      <defs>
        <linearGradient id={'sp' + id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={col} stopOpacity=".28" />
          <stop offset="1" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      <YAxis hide domain={['dataMin', 'dataMax']} />
      <Area
        type="monotone"
        dataKey="y"
        stroke={col}
        strokeWidth={1.75}
        fill={`url(#sp${id})`}
        isAnimationActive={false}
        dot={false}
        activeDot={false}
        className={tone === 'gold' ? 'glow-line' : undefined}
      />
    </AreaChart>
  );
}

/* ---------------------------------------------------------------- area trend */
export function AreaTrend({
  data,
  labels,
  split,
  fmt,
  height = 230,
  tone = 'gold',
  unitLabel,
  hideY,
  delta,
  zeroBase = true,
  endMark
}) {
  const id = React.useId().replace(/:/g, '');
  const col = C[tone];
  const sp = split == null ? data.length - 1 : split;
  const rows = data.map((y, i) => ({
    x: labels[i],
    y,
    a: i <= sp ? y : null,
    f: i >= sp ? y : null,
    fc: i > sp,
    d: i ? y / data[i - 1] - 1 : null
  }));
  let yT = nice(Math.max(...data) * 1.04);
  if (!zeroBase) {
    const lo = Math.min(...data),
      hi = Math.max(...data),
      st = nice(Math.max(1, (hi - lo) * 1.2), 4).t[1] || 1,
      b = Math.max(0, Math.floor((lo - (hi - lo) * 0.25) / st) * st),
      t = [b];
    while (t[t.length - 1] < hi * 1.07) t.push(+(t[t.length - 1] + st).toFixed(6));
    yT = { top: t[t.length - 1], t, bot: b };
  }
  const L = data.length - 1;
  const dot = { r: 6, fill: C.raised, stroke: col, strokeWidth: 3, className: 'glow-line' };
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 12, right: hideY ? 4 : 12, left: hideY ? 4 : 0, bottom: 0 }}>
          <defs>
            <linearGradient id={'ar' + id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={col} stopOpacity=".42" />
              <stop offset=".55" stopColor={col} stopOpacity=".1" />
              <stop offset="1" stopColor={col} stopOpacity="0" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={C.line} strokeDasharray="4 6" />
          <XAxis dataKey="x" {...axisProps} minTickGap={24} dy={8} />
          <YAxis
            {...axisProps}
            hide={hideY}
            width={46}
            domain={[yT.bot || 0, yT.top]}
            ticks={yT.t}
            tickFormatter={v => fmt(v, true)}
          />
          <Tooltip
            cursor={{ stroke: col, strokeOpacity: 0.5, strokeDasharray: '4 4' }}
            content={({ active, payload }) => {
              if (!(active && payload && payload.length)) return null;
              const r = payload[0].payload;
              const out = [[unitLabel || 'Value', fmt(r.y)]];
              if (delta && r.d != null)
                out.push(['Change', (r.d >= 0 ? '+' : '−') + Math.abs(r.d * 100).toFixed(1) + '%']);
              return <Glass title={r.x + (r.fc ? ', forecast' : '')} rows={out} />;
            }}
          />
          <Area
            type="monotone"
            dataKey="y"
            stroke="none"
            fill={`url(#ar${id})`}
            isAnimationActive={false}
            activeDot={false}
          />
          <Line
            type="monotone"
            dataKey="a"
            stroke={col}
            strokeWidth={2.5}
            dot={false}
            activeDot={dot}
            connectNulls={false}
            className="glow-line"
            isAnimationActive={false}
          />
          {sp < data.length - 1 && (
            <Line
              type="monotone"
              dataKey="f"
              stroke={col}
              strokeWidth={2.5}
              strokeDasharray="6 5"
              dot={false}
              activeDot={dot}
              isAnimationActive={false}
            />
          )}
          {sp < data.length - 1 && (
            <ReferenceLine
              x={labels[sp]}
              stroke={C.fg3}
              strokeDasharray="3 3"
              label={{ value: 'Forecast', position: 'insideTopRight', fill: C.fg3, fontSize: 11 }}
            />
          )}
          {endMark && <ReferenceLine y={data[L]} stroke={col} strokeOpacity={0.35} strokeDasharray="2 5" />}
          {endMark && (
            <ReferenceDot
              x={labels[L]}
              y={data[L]}
              r={6}
              ifOverflow="visible"
              shape={pp => {
                const w = Math.max(44, endMark.length * 7 + 18);
                return (
                  <g>
                    <circle cx={pp.cx} cy={pp.cy} r={14} fill={col} opacity={0.16}>
                      <animate attributeName="r" values="9;16;9" dur="2.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values=".28;.06;.28" dur="2.4s" repeatCount="indefinite" />
                    </circle>
                    <circle
                      cx={pp.cx}
                      cy={pp.cy}
                      r={5.5}
                      fill={C.raised}
                      stroke={col}
                      strokeWidth={3}
                      className="glow-line"
                    />
                    <rect x={pp.cx - w - 14} y={pp.cy - 13} width={w} height={24} rx={12} fill={col} />
                    <text
                      x={pp.cx - 14 - w / 2}
                      y={pp.cy + 3.5}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize={11.5}
                      fontWeight={700}
                    >
                      {endMark}
                    </text>
                  </g>
                );
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------------------------------------- peer scatter */
export function PeerScatter({ X, d, onPeer, height = 300 }) {
  const peers = X.peers.map(p => ({ ...p, x: p.g * 100, y: p.evr }));
  const tgt = [{ ...X.tgt, x: X.tgt.g * 100, y: X.tgt.evr }];
  const imp = [{ x: X.tgt.g * 100, y: X.impMult }];
  const yMax = Math.ceil(Math.max(...peers.map(p => p.y), X.tgt.evr, X.impMult) + 0.6);
  const lab = props => {
    const { x, y, value, index } = props;
    const p = peers[index];
    if (!p) return null;
    return (
      <text x={p.lp ? x - 9 : x + 9} y={y + 4} textAnchor={p.lp ? 'end' : 'start'} fill={C.fg2} fontSize={11.5}>
        {value}
      </text>
    );
  };
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 20, left: 0, bottom: 18 }}>
          <CartesianGrid stroke={C.line} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 25]}
            ticks={[0, 5, 10, 15, 20, 25]}
            tickFormatter={v => v + '%'}
            {...axisProps}
            label={{ value: 'NTM revenue growth', position: 'insideBottom', offset: -12, fill: C.fg3, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, yMax]}
            allowDecimals={false}
            tickFormatter={v => v + 'x'}
            {...axisProps}
            width={36}
          />
          <ReferenceLine
            segment={[
              { x: 3, y: X.a0 + X.b * 3 },
              { x: 23, y: X.a0 + X.b * 23 }
            ]}
            stroke={C.fg3}
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{ value: 'Peer regression', position: 'insideTopRight', fill: C.fg3, fontSize: 11 }}
          />
          <ReferenceLine
            segment={[
              { x: X.tgt.g * 100, y: X.tgt.evr },
              { x: X.tgt.g * 100, y: X.impMult }
            ]}
            stroke={C.gold}
            strokeDasharray="2 3"
            strokeWidth={1.5}
          />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const p = payload[0].payload;
              if (p.n == null)
                return (
                  <Glass
                    title="Implied by the regression"
                    rows={[
                      ['EV / NTM revenue', fx(X.impMult)],
                      ['Per share', sharePx(d, X.impVps)]
                    ]}
                  />
                );
              return (
                <Glass
                  title={p.n}
                  rows={[
                    ['EV / NTM revenue', fx(p.evr)],
                    ['NTM growth', fp(p.g)],
                    ['EV / NTM EBITDA', fx(p.eve)]
                  ]}
                />
              );
            }}
          />
          <Scatter
            data={peers}
            fill={C.fg2}
            shape={pp => <circle cx={pp.cx} cy={pp.cy} r={5.5} fill={C.fg2} stroke={C.raised} strokeWidth={2} />}
            onClick={p => onPeer && onPeer(p.i)}
            style={{ cursor: 'pointer' }}
          >
            <LabelList dataKey="s" content={lab} />
          </Scatter>
          <Scatter
            data={imp}
            shape={pp => <circle cx={pp.cx} cy={pp.cy} r={5} fill="none" stroke={C.gold} strokeWidth={1.75} />}
          />
          <Scatter
            data={tgt}
            shape={pp => (
              <g>
                <circle cx={pp.cx} cy={pp.cy} r={11} fill={C.gold} fillOpacity={0.16} />
                <circle cx={pp.cx} cy={pp.cy} r={6.5} fill={C.gold} stroke={C.raised} strokeWidth={2} />
                <text x={pp.cx + 12} y={pp.cy + 16} fill={C.fg} fontSize={11.5} fontWeight={600}>
                  {d.short} {fx(X.tgt.evr)}
                </text>
              </g>
            )}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------------------------------------- football field */
export function Football({ d, X, LR, height }) {
  const dcf = [];
  [-0.005, 0, 0.005].forEach(a =>
    [-0.005, 0, 0.005].forEach(b => dcf.push(calc(d, 'base', d.wacc + a, d.tgr + b).vps))
  );
  const rows = [
    { n: '52-week trading range', s: '52-week range', r: [d.wk52[0], d.wk52[1]] },
    { n: 'Trading comps, EV / EBITDA 25th to 75th percentile', s: 'Trading comps', r: [X.comp25, X.comp75] },
    { n: 'Peer regression on EV / revenue', s: 'Peer regression', r: [X.reg[0], X.reg[1]] },
    { n: 'DCF, WACC and growth ±0.5pp', s: 'DCF', r: [Math.min(...dcf), Math.max(...dcf)], k: 'gold' }
  ];
  if (LR) rows.push({ n: 'LBO at 20–25% IRR', s: 'LBO', r: LR, k: 'info' });
  rows.forEach(r => {
    r.s = r.s || r.n;
  });
  const lo = Math.min(...rows.map(r => r.r[0]), d.price) * 0.88,
    hi = Math.max(...rows.map(r => r.r[1]), d.price) * 1.08;
  const step = d.pence ? 100 : 5,
    a0 = Math.floor(lo / step) * step,
    a1 = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = a0; v <= a1 + 1e-9; v += step) ticks.push(v);
  const lbl = p => {
    const { x, y, width, height: h, index } = p;
    const r = rows[index];
    return (
      <g>
        <text x={x - 6} y={y + h / 2 + 4} textAnchor="end" fill={C.fg2} fontSize={11}>
          {sharePx(d, r.r[0])}
        </text>
        <text x={x + width + 6} y={y + h / 2 + 4} fill={C.fg2} fontSize={11}>
          {sharePx(d, r.r[1])}
        </text>
      </g>
    );
  };
  return (
    <div style={{ height: height || rows.length * 46 + 58 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 24, right: 58, left: 4, bottom: 4 }} barCategoryGap={12}>
          <CartesianGrid horizontal={false} stroke={C.line} />
          <XAxis type="number" domain={[a0, a1]} ticks={ticks} tickFormatter={v => sharePx(d, v)} {...axisProps} />
          <YAxis type="category" dataKey="s" width={112} {...axisProps} tick={{ fill: C.fg2, fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--fg) / .04)' }}
            content={({ active, payload }) =>
              active && payload && payload.length ? (
                <Glass
                  title={payload[0].payload.n}
                  rows={[
                    ['Low', sharePx(d, payload[0].payload.r[0])],
                    ['High', sharePx(d, payload[0].payload.r[1])],
                    ['Current', sharePx(d, d.price)]
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="r" radius={4} minPointSize={3}>
            {rows.map(r => (
              <Cell
                key={r.n}
                fill={
                  r.k === 'gold'
                    ? 'hsl(var(--gold) / .3)'
                    : r.k === 'info'
                      ? 'hsl(var(--info) / .22)'
                      : 'hsl(var(--fg) / .12)'
                }
                stroke={r.k === 'gold' ? C.gold : r.k === 'info' ? C.info : C.line2}
              />
            ))}
            <LabelList content={lbl} />
          </Bar>
          <ReferenceLine
            x={d.price}
            stroke={C.fg2}
            strokeDasharray="4 3"
            label={{ value: `Today ${sharePx(d, d.price)}`, position: 'top', fill: C.fg2, fontSize: 11 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------------------------------------- stacked segments */
export function SegmentBars({ seg, cur, height = 220 }) {
  const rows = seg.years.map((y, i) => ({ y, a: seg.a[i], b: seg.b[i], t: seg.a[i] + seg.b[i] }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={C.line} />
          <XAxis dataKey="y" {...axisProps} dy={4} />
          <YAxis {...axisProps} width={40} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--fg) / .04)' }}
            content={({ active, payload }) =>
              active && payload && payload.length ? (
                <Glass
                  title={payload[0].payload.y}
                  rows={[
                    [seg.names[0], cur + payload[0].payload.a.toFixed(1) + 'm', C.fg2],
                    [seg.names[1], cur + payload[0].payload.b.toFixed(1) + 'm', C.gold],
                    ['Total', cur + payload[0].payload.t.toFixed(1) + 'm']
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="a" stackId="s" fill="hsl(var(--fg2) / .7)" />
          <Bar dataKey="b" stackId="s" fill={C.gold} radius={[4, 4, 0, 0]} />
          {/* Totals ride on an invisible line so they still show when the top segment is zero. */}
          <Line dataKey="t" stroke="none" dot={false} activeDot={false} isAnimationActive={false} legendType="none">
            <LabelList dataKey="t" position="top" offset={8} formatter={v => v.toFixed(1)} fill={C.fg2} fontSize={11} />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------------------------------------- waterfall */
export function Waterfall({ B, cur, height = 220 }) {
  const rows = [{ n: B.from[0], r: [B.base, B.from[1]], v: B.from[1], k: 't' }];
  let c = B.from[1];
  for (const [n, v] of B.steps) {
    const a = c,
      b = c + v;
    c = b;
    rows.push({ n, r: [Math.min(a, b), Math.max(a, b)], v, k: v >= 0 ? 'u' : 'd' });
  }
  rows.push({ n: B.to[0], r: [B.base, B.to[1]], v: B.to[1], k: 't' });
  const top = Math.ceil((Math.max(...rows.map(r => r.r[1])) * 1.04) / 10) * 10;
  const lbl = p => {
    const { x, y, width, index } = p;
    const r = rows[index];
    return (
      <text x={x + width / 2} y={y - 6} textAnchor="middle" fill={C.fg2} fontSize={11}>
        {r.k === 't' ? r.v.toFixed(1) : (r.v > 0 ? '+' : '−') + Math.abs(r.v).toFixed(1)}
      </text>
    );
  };
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={C.line} />
          <XAxis dataKey="n" {...axisProps} interval={0} dy={4} />
          <YAxis {...axisProps} width={40} domain={[B.base, top]} allowDataOverflow />
          <Tooltip
            cursor={{ fill: 'hsl(var(--fg) / .04)' }}
            content={({ active, payload }) =>
              active && payload && payload.length ? (
                <Glass
                  title={payload[0].payload.n}
                  rows={[
                    [
                      payload[0].payload.k === 't' ? 'Revenue' : 'Change',
                      (payload[0].payload.k === 'd' ? '−' : payload[0].payload.k === 'u' ? '+' : '') +
                        cur +
                        Math.abs(payload[0].payload.v).toFixed(1) +
                        'm'
                    ]
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="r" radius={3}>
            {rows.map(r => (
              <Cell key={r.n} fill={r.k === 't' ? 'hsl(var(--fg2) / .7)' : r.k === 'u' ? C.pos : C.neg} />
            ))}
            <LabelList content={lbl} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------------------------------------- donut */
export function Donut({ parts, colors, size = 132, label, sub }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={parts.map((v, i) => ({ v, i }))}
          dataKey="v"
          innerRadius={size / 2 - 16}
          outerRadius={size / 2 - 2}
          paddingAngle={2}
          cornerRadius={3}
          stroke="none"
          startAngle={90}
          endAngle={-270}
          isAnimationActive={false}
        >
          {parts.map((_, i) => (
            <Cell key={i} fill={colors[i]} />
          ))}
        </Pie>
      </PieChart>
      <div className="absolute inset-0 grid place-items-center text-center leading-tight">
        <div>
          <b className="block text-[20px] font-semibold tracking-tight">{label}</b>
          <span className="text-[11px] text-fg3">{sub}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- debt paydown */
export function DebtBars({ rows, height = 170 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 22, right: 6, left: 6, bottom: 0 }} barCategoryGap="30%">
          <XAxis dataKey="y" {...axisProps} dy={4} />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: 'hsl(var(--fg) / .04)' }}
            content={({ active, payload }) =>
              active && payload && payload.length ? (
                <Glass
                  title={payload[0].payload.y}
                  rows={[
                    ['Net debt', payload[0].payload.debt.toFixed(1) + 'm'],
                    ['Net debt / EBITDA', fx(payload[0].payload.lev)]
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="debt" radius={[4, 4, 0, 0]}>
            {rows.map((r, i) => (
              <Cell key={i} fill={i === 0 ? 'hsl(var(--fg2) / .75)' : 'hsl(var(--info) / .55)'} />
            ))}
            <LabelList dataKey="lev" position="top" formatter={v => fx(v)} fill={C.fg2} fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------------------------------------- positioning bubble */
export function Bubble({ rows, cur, height = 360, compact }) {
  const data = rows.map(r => ({ ...r, z: r.sz }));
  const lab = p => {
    const { x, y, index } = p;
    const r = data[index];
    if (!r) return null;
    const rad = 7 + Math.sqrt(r.sz) * (compact ? 0.3 : 0.42);
    return (
      <text
        x={r.left ? x - rad - 6 : x + rad + 6}
        y={y + 4}
        textAnchor={r.left ? 'end' : 'start'}
        fill={r.tg ? C.fg : C.fg2}
        fontWeight={r.tg ? 600 : 400}
        fontSize={compact ? 10 : 11.5}
      >
        {r.n}
      </text>
    );
  };
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart
          margin={{
            top: compact ? 8 : 14,
            right: compact ? 10 : 18,
            left: compact ? -14 : -6,
            bottom: compact ? 2 : 16
          }}
        >
          <ReferenceArea x1={0} x2={10} y1={0} y2={10} fill="none" stroke={C.line2} />
          <ReferenceLine x={5} stroke={C.line2} />
          <ReferenceLine y={5} stroke={C.line2} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 10]}
            hide={compact}
            ticks={[]}
            {...axisProps}
            label={
              compact
                ? undefined
                : { value: 'Breadth of platform', position: 'insideBottom', offset: -6, fill: C.fg3, fontSize: 11 }
            }
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 10]}
            ticks={[]}
            {...axisProps}
            width={compact ? 10 : 22}
            label={
              compact
                ? undefined
                : {
                    value: 'Mid-market focus',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 14,
                    fill: C.fg3,
                    fontSize: 11
                  }
            }
          />
          <ZAxis type="number" dataKey="z" range={compact ? [120, 1400] : [220, 2600]} />
          {!compact && (
            <Tooltip
              cursor={false}
              content={({ active, payload }) =>
                active && payload && payload.length ? (
                  <Glass
                    title={payload[0].payload.n}
                    rows={[['Revenue, approx.', cur + nf0.format(payload[0].payload.sz) + 'm']]}
                  />
                ) : null
              }
            />
          )}
          <Scatter
            data={data}
            shape={pp => {
              const r = pp.payload;
              return (
                <circle
                  cx={pp.cx}
                  cy={pp.cy}
                  r={Math.sqrt(pp.size / Math.PI)}
                  fill={r.tg ? 'hsl(var(--gold) / .28)' : 'hsl(var(--fg) / .08)'}
                  stroke={r.tg ? C.gold : C.fg3}
                  strokeWidth={1.2}
                />
              );
            }}
          >
            <LabelList dataKey="n" content={lab} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
