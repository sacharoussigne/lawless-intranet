import { tenantRoutes } from '@/types/routes';

/**
 * First path segments the app uses itself: a business cannot take them as slug
 * (its pages live at `/<slug>/…`). Legacy unscoped paths stay reserved so their
 * redirects keep working.
 */
export const RESERVED_BUSINESS_SLUGS: ReadonlySet<string> = new Set([
  'api',
  'auth',
  'platform',
  'settings',
  'admin',
  'partage',
  'd',
  'test',
  '_next',
  // Legacy unscoped paths (redirected to the default business, see types/routes.ts).
  'stock',
  'orders',
  'search-items',
  'bank',
  'weekly-activity',
  'agenda',
  'cabinet',
  'employee',
  'management',
  'inventory',
]);

export function isReservedBusinessSlug(slug: string): boolean {
  return RESERVED_BUSINESS_SLUGS.has(slug.trim().toLowerCase());
}

/** Message of the slug validation (creation and settings). */
export const RESERVED_BUSINESS_SLUG_MESSAGE = 'Ce slug est réservé par l’application, choisissez-en un autre';

export function slugifyBusinessName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length === 0) return 'entreprise';
  return isReservedBusinessSlug(base) ? `${base}-1` : base;
}

/** Same page in another business (`/<slug>/…`), or its home outside a business page. */
export function rewritePathWithBusinessSlug(pathname: string, newSlug: string): string {
  const current = parseBusinessSlugFromPathname(pathname);
  if (current !== null) {
    return `/${encodeURIComponent(newSlug)}${pathname.replace(/^\/[^/]+/, '')}`;
  }
  return tenantRoutes(newSlug).employee.index;
}

/** Business slug of a page path (`/<slug>/…`), null for the app's own paths. */
export function parseBusinessSlugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/([^/?#]+)/);
  if (!match?.[1]) {
    return null;
  }
  let segment = match[1];
  try {
    segment = decodeURIComponent(segment);
  } catch {
    // keep the raw segment
  }
  if (isReservedBusinessSlug(segment) || segment.includes('.')) return null;
  return segment;
}
