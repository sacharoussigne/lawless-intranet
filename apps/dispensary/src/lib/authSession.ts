import type { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { getSession as fetchAuthSession } from '@lawless-intranet/auth-client/server';
import { buildOriginFromHeaders } from '@lawless-intranet/auth-client/config';
import type { AuthSession } from '@lawless-intranet/types';
import { isAllowedCallbackHostname } from '@/lib/ssoHosts';

export type { AuthSession };

export async function getAuthSession(): Promise<AuthSession | null> {
  const cookieHeader = (await headers()).get('cookie');
  return fetchAuthSession(cookieHeader);
}

export async function getRequestAuthSession(
  request: Request,
): Promise<AuthSession | null> {
  const cookieHeader = request.headers.get('cookie');
  return fetchAuthSession(cookieHeader);
}

function getDefaultAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export function getCallbackUrlFromRequest(request: NextRequest): string {
  const { pathname, search } = request.nextUrl;
  const pathWithSearch = `${pathname}${search}`;

  const origin = buildOriginFromHeaders(request.headers);
  if (origin) {
    try {
      const url = new URL(origin);
      if (isAllowedCallbackHostname(url.hostname)) {
        return `${origin.replace(/\/$/, '')}${pathWithSearch}`;
      }
    } catch {
      // fall through to configured public URL
    }
  }

  return `${getDefaultAppOrigin()}${pathWithSearch}`;
}

export function getAuthLoginRedirectUrl(callbackUrl: string): string {
  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:3001';
  return `${authUrl}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
