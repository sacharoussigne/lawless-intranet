import type { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { getSession as fetchAuthSession } from '@lawless-intranet/auth-client/server';
import { buildOriginFromHeaders } from '@lawless-intranet/auth-client/config';
import type { AuthSession } from '@lawless-intranet/types';
import { isAllowedCallbackHostname } from '@/lib/ssoHosts';
import { cache } from 'react';
import { hasRole } from '@lawless-intranet/auth-permissions';
import prisma from '@/lib/prisma';
import { Role } from '@/types/enum/roles';
import { applyViewAs, type ViewAsSession } from '@/lib/business/viewAs';

export type { AuthSession };

/** Real role of a member (« Voir en tant que » is only honored for admins). */
const isRealBusinessAdmin = cache(async (userId: string, businessId: string): Promise<boolean> => {
  const member = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId } },
    select: { role: true },
  });
  return hasRole(member?.role, Role.ADMIN);
});

/** Session of the request, with the « Voir en tant que » view applied (lib/business/viewAs). */
export async function getAuthSession(): Promise<ViewAsSession | null> {
  const cookieHeader = (await headers()).get('cookie');
  return applyViewAs(await fetchAuthSession(cookieHeader), cookieHeader, isRealBusinessAdmin);
}

/** Session without the view: only to start or leave it. */
export async function getRealAuthSession(): Promise<AuthSession | null> {
  return fetchAuthSession((await headers()).get('cookie'));
}

export async function getRequestAuthSession(
  request: Request,
): Promise<ViewAsSession | null> {
  const cookieHeader = request.headers.get('cookie');
  return applyViewAs(await fetchAuthSession(cookieHeader), cookieHeader, isRealBusinessAdmin);
}

function getDefaultAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

/** Origin of the app on the host of this request when it is one of ours, else the configured URL. */
export function appOriginFromHeaders(requestHeaders: Headers): string {
  const origin = buildOriginFromHeaders(requestHeaders);
  if (origin) {
    try {
      if (isAllowedCallbackHostname(new URL(origin).hostname)) return origin.replace(/\/$/, '');
    } catch {
      // fall through to configured public URL
    }
  }
  return getDefaultAppOrigin();
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
