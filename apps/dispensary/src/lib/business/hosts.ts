import { businessTypes, type BusinessType } from '@/lib/businessTypes';

/**
 * Host of each kind of business (docs/MULTI-BUSINESS.md): `BUSINESS_TYPE_HOSTS`,
 * e.g. `DISPENSARY=dispensaire.aerokusu.fr,GENERAL_STORE=gs.aerokusu.fr`
 * (locally `DISPENSARY=dispensary.localhost:3000`). On a type's host only the
 * businesses of that type are offered; any other host (the main one) shows all.
 * Unset: no host routing, every host behaves like the main one.
 */
type BusinessHostConfig = {
  typeByHost: Map<string, BusinessType>;
  hostByType: Map<BusinessType, string>;
};

let cached: { raw: string | undefined; config: BusinessHostConfig } | null = null;

function isBusinessType(value: string): value is BusinessType {
  return Object.hasOwn(businessTypes, value);
}

export function businessHostConfig(): BusinessHostConfig {
  const raw = process.env.BUSINESS_TYPE_HOSTS;
  if (cached && cached.raw === raw) return cached.config;
  const config: BusinessHostConfig = { typeByHost: new Map(), hostByType: new Map() };
  for (const entry of (raw ?? '').split(',')) {
    const [type, host] = entry.split('=').map((part) => part?.trim());
    if (!type || !host || !isBusinessType(type)) continue;
    const normalized = host.toLowerCase();
    config.typeByHost.set(normalized, type);
    if (!config.hostByType.has(type)) config.hostByType.set(type, normalized);
  }
  cached = { raw, config };
  return config;
}

/** Kind of business served on this host, null on the main host (or without host routing). */
export function businessTypeOfHost(host: string | null | undefined): BusinessType | null {
  if (!host) return null;
  return businessHostConfig().typeByHost.get(host.toLowerCase()) ?? null;
}

/**
 * Origin to open a business of this type from the current host: '' when it is
 * served here (relative links), else `proto://host` of its type.
 */
export function businessOrigin(
  type: BusinessType,
  current: { host: string | null; proto: string },
): string {
  const target = businessHostConfig().hostByType.get(type);
  if (!target || !current.host || target === current.host.toLowerCase()) return '';
  // The main host shows every type: stay on it.
  if (businessTypeOfHost(current.host) === null) return '';
  return `${current.proto}://${target}`;
}

/** Host of a business type, for a redirect from a host of another type. */
export function hostOfBusinessType(type: BusinessType): string | null {
  return businessHostConfig().hostByType.get(type) ?? null;
}

/** Host and protocol of a request, behind the proxy (x-forwarded-*) or not. */
export function requestHostOf(headers: Headers, fallbackProto = 'http'): { host: string | null; proto: string } {
  const host = headers.get('x-forwarded-host')?.split(',')[0]?.trim() || headers.get('host');
  const proto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || fallbackProto;
  return { host: host ?? null, proto };
}
