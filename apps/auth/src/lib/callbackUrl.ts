import { isAllowedSsoHostname } from '@/lib/ssoHosts';

export function getSafeCallbackUrl(raw: string | null): string {
  const fallback =
    process.env.NEXT_PUBLIC_DISPENSARY_URL ?? 'http://localhost:3000';

  if (!raw) {
    return fallback;
  }

  try {
    const url = new URL(raw);
    if (isAllowedSsoHostname(url.hostname)) {
      return url.toString();
    }
  } catch {
    return fallback;
  }

  return fallback;
}
