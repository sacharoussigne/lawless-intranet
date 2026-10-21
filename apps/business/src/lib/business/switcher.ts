import { getBusinessTypeDefinition } from '@/lib/businessTypes';
import { rewritePathWithBusinessSlug } from '@/lib/business/slug';
import type { AccessibleBusiness } from '@/types/permissions';

type SelectItem = { value: string; label: string };

/** Options of a business switcher: grouped by kind when the user has several kinds. */
export function businessSelectData(
  businesses: AccessibleBusiness[],
): SelectItem[] | { group: string; items: SelectItem[] }[] {
  const types = [...new Set(businesses.map((b) => b.type))];
  const item = (b: AccessibleBusiness) => ({ value: b.slug, label: b.name });
  if (types.length <= 1) return businesses.map(item);
  return types.map((type) => ({
    group: getBusinessTypeDefinition(type).labelPlural,
    items: businesses.filter((b) => b.type === type).map(item),
  }));
}

/**
 * Same page in another business; `external` when it is served on another host
 * (full page load there, not a client navigation).
 */
export function businessSwitchTarget(
  businesses: AccessibleBusiness[],
  pathname: string,
  slug: string,
): { href: string; external: boolean } {
  const origin = businesses.find((b) => b.slug === slug)?.origin ?? '';
  return { href: `${origin}${rewritePathWithBusinessSlug(pathname, slug)}`, external: origin !== '' };
}
