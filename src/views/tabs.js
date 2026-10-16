import {
  Network,
  Building2,
  Sheet,
  ChartScatter,
  LayoutGrid,
  Globe,
  FileText,
  Presentation,
  BookOpen,
  ShieldCheck
} from 'lucide-react';
export const TAB_ICON = {
  run: Network,
  company: Building2,
  model: Sheet,
  comps: ChartScatter,
  compet: LayoutGrid,
  market: Globe,
  memo: FileText,
  deck: Presentation,
  sources: BookOpen,
  delivery: ShieldCheck
};
export const TAB_KEY = {
  run: 'R',
  company: 'C',
  model: 'M',
  comps: 'V',
  compet: 'X',
  market: 'K',
  memo: 'D',
  deck: 'S',
  sources: 'L',
  delivery: 'Y'
};
export const KEY_TAB = Object.fromEntries(Object.entries(TAB_KEY).map(([k, v]) => [v.toLowerCase(), k]));
