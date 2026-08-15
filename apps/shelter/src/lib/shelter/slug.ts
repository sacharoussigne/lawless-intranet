import { tenantRoutes } from '@/types/routes';
import { SHELTER_SLUG_PATH_PREFIX } from '@/lib/shelter/constants';

export function slugifyShelterName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'shelter';
}

export function rewritePathWithShelterSlug(pathname: string, newSlug: string): string {
  if (/^\/s\/[^/]+/.test(pathname)) {
    return pathname.replace(/^\/s\/[^/]+/, `/s/${encodeURIComponent(newSlug)}`);
  }
  return tenantRoutes(newSlug).employee.index;
}

export function parseShelterSlugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/s\/([^/]+)/);
  if (!match?.[1]) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export { SHELTER_SLUG_PATH_PREFIX };
