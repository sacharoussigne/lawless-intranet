import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { admin as adminPlugin, openAPI } from 'better-auth/plugins';
import { headers } from 'next/headers';
import {
  ac,
  admin,
  user,
  employee,
  inventory_manager,
  inventory_viewer,
  direction,
} from '@lawless-intranet/auth-permissions';
import prisma from '@/lib/prisma';
import { getCookieDomain, getTrustedOrigins } from '@/lib/constants';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          const total = await prisma.user.count();
          if (total === 1) {
            await prisma.user.update({
              where: { id: createdUser.id },
              data: { role: 'admin' },
            });
            return;
          }
          const accessOnCreate =
            process.env.ACCESS_ON_CREATE === 'true' ||
            process.env.ACCESS_ON_CREATE === '1';
          if (accessOnCreate) {
            await prisma.user.update({
              where: { id: createdUser.id },
              data: { role: 'employee' },
            });
          }
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    nextCookies(),
    openAPI(),
    adminPlugin({
      ac,
      roles: {
        admin,
        user,
        employee,
        inventory_manager,
        inventory_viewer,
        direction,
      },
    }),
  ],
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
    },
  },
  trustedOrigins: getTrustedOrigins(),
  user: {
    additionalFields: {
      gender: {
        type: 'string',
        defaultValue: 'male',
        input: true,
      },
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: getCookieDomain(),
    },
  },
});

export async function getAuthSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}
