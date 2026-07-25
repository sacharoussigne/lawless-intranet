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

function addHostOrigins(origins: Set<string>, hostname?: string | null) {
  if (!hostname?.trim()) {
    return;
  }

  for (const origin of originFromHostname(hostname.trim())) {
    origins.add(origin);
  }
}

export function getTrustedOrigins(): string[] {
  const origins = new Set<string>([
    process.env.BETTER_AUTH_URL,
    process.env.DISPENSARY_URL,
    'http://localhost:3001',
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://auth.localhost:3001',
    'http://dispensary.localhost:3000',
    'http://documents.localhost:3002',
    'http://agenda.localhost:3003',
  ].filter(Boolean) as string[]);

  addOrigin(origins, process.env.BETTER_AUTH_URL);
  addOrigin(origins, process.env.DISPENSARY_URL);
  addHostOrigins(origins, process.env.AUTH_VIRTUAL_HOST);
  addHostOrigins(origins, process.env.DISPENSARY_VIRTUAL_HOST);
  addHostOrigins(origins, process.env.DOCUMENTS_VIRTUAL_HOST);
  addHostOrigins(origins, process.env.AGENDA_VIRTUAL_HOST);

  for (const extra of process.env.EXTRA_TRUSTED_ORIGINS?.split(',') ?? []) {
    addOrigin(origins, extra.trim());
  }

  const dispensaryUrl = process.env.DISPENSARY_URL ?? process.env.NEXT_PUBLIC_DISPENSARY_URL;
  if (dispensaryUrl) {
    try {
      const configuredHost = new URL(dispensaryUrl).hostname;
      if (process.env.DISPENSARY_VIRTUAL_HOST) {
        const virtualHost = process.env.DISPENSARY_VIRTUAL_HOST.trim();
        if (
          virtualHost !== configuredHost &&
          isAllowedSsoHostname(virtualHost)
        ) {
          addHostOrigins(origins, virtualHost);
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
