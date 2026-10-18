import type { LogFeature } from './types';

/** Page segment (after /d/<slug>/<area>/) → feature. */
const SEGMENT_FEATURES: Record<string, LogFeature> = {
  stock: 'stock',
  'stock-movements': 'stock',
  'stock-statistics': 'stock',
  'overwrite-stock': 'stock',
  'search-items': 'search',
  orders: 'orders',
  mails: 'mails',
  payroll: 'payroll',
  'weekly-activity': 'weeklyDispensaryActivity',
  people: 'weeklyDispensaryActivity',
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

/** Dispensary slug of an app path (`/d/<slug>/…`, `/api/d/<slug>/…`), if any. */
export function businessSlugFromPath(pathname: string | null | undefined): string | null {
  const match = pathname?.match(/^(?:\/api)?\/d\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Feature of the page an action was called from, best effort. */
export function featureFromPath(pathname: string | null | undefined): LogFeature {
  if (!pathname) return 'unknown';
  if (pathname.startsWith('/platform') || pathname.startsWith('/admin')) return 'platform';
  if (pathname.startsWith('/settings')) return 'account';
  const segments = pathname.split(/[/?#]/).filter(Boolean);
  const tenantIndex = segments[0] === 'api' ? 1 : 0;
  if (segments[tenantIndex] !== 'd') return 'unknown';
  const [area, page] = segments.slice(tenantIndex + 2);
  if (page && SEGMENT_FEATURES[page]) return SEGMENT_FEATURES[page];
  if (area === 'management') return 'management';
  return 'unknown';
}
