import { businessHostConfig } from '@/lib/business/hosts';

const BLOCKED_CALLBACK_HOSTS = new Set(['0.0.0.0', '127.0.0.1', 'localhost']);

function getParentDomain(hostname: string): string | null {
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  return parts.slice(-2).join('.');
}

function getConfiguredAppHostname(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return null;
  }

  try {
    return new URL(appUrl).hostname;
  } catch {
    return null;
  }
}

export function isAllowedCallbackHostname(hostname: string): boolean {
  if (BLOCKED_CALLBACK_HOSTS.has(hostname)) {
    return false;
  }

  const configuredHost = getConfiguredAppHostname();
  if (configuredHost && hostname === configuredHost) {
    return true;
  }

  // Hosts of the kinds of business (BUSINESS_TYPE_HOSTS), e.g. gs.localhost in dev.
  for (const host of businessHostConfig().typeByHost.keys()) {
    if (host.split(':')[0] === hostname) return true;
  }

  const configuredParent = configuredHost ? getParentDomain(configuredHost) : null;
  const hostParent = getParentDomain(hostname);
  return configuredParent !== null && configuredParent === hostParent;
}
