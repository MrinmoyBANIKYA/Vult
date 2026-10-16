/** Intl.NumberFormat presets used by <Num>. */
export const F = {
  m1: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
  m0: { maximumFractionDigits: 0 },
  m2: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  pct: { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 },
  pctS: { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'always' }
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
const sameDay = (a, b) => a.toDateString() === b.toDateString();

/** "just now", "14m", "2h", "Yesterday", "8 Oct" — the compact age used in lists. */
export function ago(iso, now = Date.now()) {
  if (!iso) return '';
  const t = new Date(iso),
    s = (now - t.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400 && sameDay(t, new Date(now))) return Math.floor(s / 3600) + 'h';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (sameDay(t, y)) return 'Yesterday';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return t.getDate() + ' ' + MONTHS[t.getMonth()];
}

/** "06:31" today, "Yesterday 18:42", "Tue 07:00" within a week either way, else "1 Oct". */
export function clockLabel(iso, now = Date.now()) {
  if (!iso) return '—';
  const t = new Date(iso),
    n = new Date(now);
  if (sameDay(t, n)) return hhmm(t);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (sameDay(t, y)) return 'Yesterday ' + hhmm(t);
  if (Math.abs(t - n) < 6 * 86400000) return DAYS[t.getDay()] + ' ' + hhmm(t);
  return t.getDate() + ' ' + MONTHS[t.getMonth()];
}
