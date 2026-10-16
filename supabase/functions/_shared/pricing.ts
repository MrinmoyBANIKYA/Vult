// Server-side pricing and planning. Mirrors planFor() in src/lib/engine.js; the server's numbers are the ones billed.

export type Region = 'uk' | 'us';

export const DELIVERABLES = [
  { key: '3s', name: 'Three-statement model', track: 'model', minutes: 25, gbp: 1700, usd: 2150 },
  { key: 'dcf', name: 'DCF valuation', track: 'model', minutes: 10, gbp: 700, usd: 850 },
  { key: 'lbo', name: 'LBO model', track: 'model', minutes: 15, gbp: 1800, usd: 2300 },
  { key: 'comps', name: 'Trading comps', track: 'analysis', minutes: 20, gbp: 950, usd: 1200 },
  { key: 'compet', name: 'Competitor matrix', track: 'analysis', minutes: 30, gbp: 1600, usd: 2000 },
  { key: 'industry', name: 'Market sizing', track: 'analysis', minutes: 35, gbp: 1900, usd: 2400 },
  { key: 'memo', name: 'IC memo', track: 'write', minutes: 22, gbp: 900, usd: 1150 },
  { key: 'pitch', name: 'Pitch book pages', track: 'write', minutes: 8, gbp: 800, usd: 1000 }
] as const;

export const DELIVERABLE_KEYS: string[] = DELIVERABLES.map(d => d.key);

/** Five or more deliverables are capped at the full-pack price. */
const FULL_PACK: Record<Region, number> = { uk: 6500, us: 8200 };

export interface Stage {
  key: string;
  name: string;
  start: number;
  end: number;
  skipped?: boolean;
}

export interface RunPlan {
  total: number;
  stages: Stage[];
  price: number;
  packed: boolean;
  priority: boolean;
}

export function planRun(selected: Set<string>, region: Region, priority: boolean): RunPlan {
  const chosen = DELIVERABLES.filter(d => selected.has(d.key));
  const sum = (track: string) => chosen.filter(d => d.track === track).reduce((a, d) => a + d.minutes, 0);
  const f = priority ? 0.7 : 1;
  const model = Math.round(sum('model') * f);
  const analysis = Math.round(sum('analysis') * 0.6 * f); // analysts work in parallel
  const write = Math.round(Math.max(6, sum('write')) * f);
  const assay = 12 + chosen.length;
  const review = 10;
  const writeStart = 50 + Math.max(model, analysis);

  const stages: Stage[] = [
    { key: 'scope', name: 'Scope', start: 0, end: 6 },
    { key: 'ingest', name: 'Ingest', start: 6, end: 28 },
    { key: 'extract', name: 'Extract', start: 28, end: 50 },
    { key: 'model', name: 'Model', start: 50, end: 50 + model, skipped: !model },
    { key: 'analysis', name: 'Analysis', start: 50, end: 50 + analysis, skipped: !analysis },
    { key: 'write', name: 'Write', start: writeStart, end: writeStart + write },
    { key: 'assay', name: 'Assay', start: writeStart + write, end: writeStart + write + assay },
    { key: 'review', name: 'Sign-off', start: writeStart + write + assay, end: writeStart + write + assay + review }
  ];

  let price = chosen.reduce((a, d) => a + (region === 'uk' ? d.gbp : d.usd), 0);
  let packed = false;
  if (chosen.length >= 5 && price > FULL_PACK[region]) {
    price = FULL_PACK[region];
    packed = true;
  }
  if (priority) price = Math.round((price * 1.3) / 50) * 50;

  return { total: writeStart + write + assay + review, stages, price, packed, priority };
}
