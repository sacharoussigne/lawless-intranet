import { parseBusinessSlugFromPathname } from '@/lib/business/slug';
import type { LogFeature } from './types';

/** Page segment (after /<slug>/<area>/) → feature. */
const SEGMENT_FEATURES: Record<string, LogFeature> = {
  stock: 'stock',
  'stock-movements': 'stock',
  'stock-statistics': 'stock',
  'overwrite-stock': 'stock',
  'search-items': 'search',
  orders: 'orders',
  mails: 'mails',
  payroll: 'payroll',
  'weekly-activity': 'weeklyActivity',
  people: 'weeklyActivity',
  sales: 'sales',
  agenda: 'agenda',
  agendas: 'agenda',
  bank: 'bank',
  cabinet: 'cabinet',
  cabinets: 'cabinet',
  media: 'media',
  compte: 'account',
  settings: 'settings',
  members: 'settings',
};

/** Business slug of an app path (`/<slug>/…`, `/api/d/<slug>/…`), if any. */
export function businessSlugFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const api = pathname.match(/^\/api\/d\/([^/?#]+)/);
  if (api) return decodeURIComponent(api[1]);
  return parseBusinessSlugFromPathname(pathname);
}

/** Feature of the page an action was called from, best effort. */
export function featureFromPath(pathname: string | null | undefined): LogFeature {
  if (!pathname) return 'unknown';
  if (pathname.startsWith('/platform') || pathname.startsWith('/admin')) return 'platform';
  if (pathname.startsWith('/settings')) return 'account';
  if (!businessSlugFromPath(pathname)) return 'unknown';
  const segments = pathname.split(/[/?#]/).filter(Boolean);
  // `/<slug>/<area>/<page>` or `/api/d/<slug>/<area>/<page>`.
  const [area, page] = segments.slice(segments[0] === 'api' ? 3 : 1);
  if (page && SEGMENT_FEATURES[page]) return SEGMENT_FEATURES[page];
  if (area === 'management') return 'management';
  return 'unknown';
}
