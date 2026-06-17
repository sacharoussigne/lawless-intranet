import { headers } from 'next/headers';
import { getSession as fetchAuthSession } from '@lawless-intranet/auth-client/server';
import type { AuthSession } from '@lawless-intranet/types';

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

export function getAuthLoginRedirectUrl(callbackUrl: string): string {
  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:3001';
  return `${authUrl}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
