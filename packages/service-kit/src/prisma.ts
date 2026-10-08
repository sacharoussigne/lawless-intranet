import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma?: unknown };

/**
 * Prisma client of a service, on `DATABASE_URL` through the pg adapter.
 * The generated client stays per app, hence the factory; in dev the instance
 * is reused across hot reloads.
 */
export function createPrismaClient<T>(create: (adapter: PrismaPg) => T): T {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma as T;
  }
  const prisma = create(new PrismaPg({ connectionString: process.env.DATABASE_URL }));
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
  }
  return prisma;
}
