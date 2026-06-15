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

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL,
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
