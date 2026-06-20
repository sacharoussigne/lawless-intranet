const DEV_CALLBACK_HOSTS = new Set(['dispensary.localhost', 'localhost']);

function getParentDomain(hostname: string): string | null {
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  return parts.slice(-2).join('.');
}

function getConfiguredDispensaryHostname(): string | null {
  const dispensaryUrl =
    process.env.NEXT_PUBLIC_DISPENSARY_URL ?? process.env.DISPENSARY_URL;
  if (!dispensaryUrl) {
    return null;
  }

  try {
    return new URL(dispensaryUrl).hostname;
  } catch {
    return null;
  }
}

export function isAllowedSsoHostname(hostname: string): boolean {
  if (DEV_CALLBACK_HOSTS.has(hostname)) {
    return true;
  }

  const virtualHost = process.env.DISPENSARY_VIRTUAL_HOST?.trim();
  if (virtualHost && hostname === virtualHost) {
    return true;
  }

  const configuredHost = getConfiguredDispensaryHostname();
  if (configuredHost && hostname === configuredHost) {
    return true;
  }

  const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;
  if (cookieDomain?.startsWith('.')) {
    const parent = cookieDomain.slice(1);
    if (hostname === parent || hostname.endsWith(`.${parent}`)) {
      return true;
    }
  }

  const configuredParent = configuredHost ? getParentDomain(configuredHost) : null;
  const hostParent = getParentDomain(hostname);
  return configuredParent !== null && configuredParent === hostParent;
}

export function originFromHostname(hostname: string): string[] {
  return [`https://${hostname}`, `http://${hostname}`];
}
