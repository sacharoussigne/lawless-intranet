'use client';

import { createAuthClient } from 'better-auth/client';
import { adminClient } from 'better-auth/client/plugins';
import {
  ac,
  admin,
  user,
  employee,
  inventory_manager,
  inventory_viewer,
  private_practitioner,
  direction,
} from '@lawless-intranet/auth-permissions';

function getPublicAuthUrl(): string {
  return process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:3001';
}

export const authClient = createAuthClient({
  baseURL: getPublicAuthUrl(),
  plugins: [
    adminClient({
      ac,
      roles: {
        admin,
        user,
        employee,
        inventory_manager,
        inventory_viewer,
        private_practitioner,
        direction,
      },
    }),
  ],
});

export async function signInWithDiscord(callbackURL?: string) {
  await authClient.signIn.social({
    provider: 'discord',
    callbackURL,
  });
}

export async function signOut() {
  await authClient.signOut();
}

export function getLoginUrl(callbackUrl: string): string {
  const authUrl = getPublicAuthUrl();
  return `${authUrl}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function getSignupUrl(callbackUrl: string): string {
  const authUrl = getPublicAuthUrl();
  return `${authUrl}/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
