import { isAllowedSsoHostname, originFromHostname } from '@/lib/ssoHosts';

export const DISCORD_PROVIDER_ID = 'discord';

function addOrigin(origins: Set<string>, value?: string | null) {
  if (!value) {
    return;
  }

  try {
    origins.add(new URL(value).origin);
  } catch {
    // ignore invalid URL env values
  }
}

/** One host or a comma-separated list (the business app is served on several hosts). */
function addHostOrigins(origins: Set<string>, hostnames?: string | null) {
  for (const hostname of hostnames?.split(',') ?? []) {
    if (!hostname.trim()) continue;
    for (const origin of originFromHostname(hostname.trim())) {
      origins.add(origin);
    }
  }
}

/** Subdomain and port of each app in dev (docs/SSO-DEV.md). */
const DEV_APP_HOSTS: [label: string, port: number][] = [
  ['auth', 3001],
  ['dispensary', 3000],
  ['business', 3000],
  ['gs', 3000],
  ['shelter', 3006],
  ['documents', 3002],
  ['agenda', 3003],
  ['bank', 3004],
  ['inventory', 3005],
];

/**
 * Dev under a cookie domain such as `.lawless.localhost` (a bare `.localhost`
 * cookie is refused by browsers): trust every app on its subdomain.
 */
function addDevCookieDomainOrigins(origins: Set<string>) {
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  if (!domain?.endsWith('.localhost') || domain === '.localhost') return;
  const parent = domain.replace(/^\./, '');
  for (const [label, port] of DEV_APP_HOSTS) {
    origins.add(`http://${label}.${parent}:${port}`);
  }
}

export function getTrustedOrigins(): string[] {
  const origins = new Set<string>([
    process.env.BETTER_AUTH_URL,
    process.env.DISPENSARY_URL,
    process.env.SHELTER_URL,
    'http://localhost:3001',
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
    'http://localhost:3006',
    'http://auth.localhost:3001',
    'http://dispensary.localhost:3000',
    // Business app hosts in dev (docs/MULTI-BUSINESS.md, BUSINESS_TYPE_HOSTS).
    'http://business.localhost:3000',
    'http://gs.localhost:3000',
    'http://documents.localhost:3002',
    'http://agenda.localhost:3003',
    'http://bank.localhost:3004',
    'http://inventory.localhost:3005',
    'http://shelter.localhost:3006',
  ].filter(Boolean) as string[]);

  addOrigin(origins, process.env.BETTER_AUTH_URL);
  addOrigin(origins, process.env.DISPENSARY_URL);
  addOrigin(origins, process.env.SHELTER_URL);
  addHostOrigins(origins, process.env.AUTH_VIRTUAL_HOST);
  addHostOrigins(origins, process.env.DISPENSARY_VIRTUAL_HOST);
  addHostOrigins(origins, process.env.SHELTER_VIRTUAL_HOST);
  addHostOrigins(origins, process.env.DOCUMENTS_VIRTUAL_HOST);
  addHostOrigins(origins, process.env.AGENDA_VIRTUAL_HOST);
  addHostOrigins(origins, process.env.BANK_VIRTUAL_HOST);
  addHostOrigins(origins, process.env.INVENTORY_VIRTUAL_HOST);

  addDevCookieDomainOrigins(origins);

  for (const extra of process.env.EXTRA_TRUSTED_ORIGINS?.split(',') ?? []) {
    addOrigin(origins, extra.trim());
  }

  const dispensaryUrl = process.env.DISPENSARY_URL ?? process.env.NEXT_PUBLIC_DISPENSARY_URL;
  if (dispensaryUrl) {
    try {
      const configuredHost = new URL(dispensaryUrl).hostname;
      for (const virtualHost of process.env.DISPENSARY_VIRTUAL_HOST?.split(',') ?? []) {
        const host = virtualHost.trim();
        if (host && host !== configuredHost && isAllowedSsoHostname(host)) {
          addHostOrigins(origins, host);
        }
      }
    } catch {
      // ignore invalid dispensary URL
    }
  }

  return [...origins];
}

export function getCookieDomain(): string {
  return process.env.AUTH_COOKIE_DOMAIN ?? '.localhost';
}
