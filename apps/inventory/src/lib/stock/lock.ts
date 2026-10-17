import prisma from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Transaction for anything that writes stock (crafts, sales, transfers, take /
 * deposit, orders, manual counts…): the stock writes of a tenant run one at a
 * time, so two operations never both spend or both restore the same stock.
 * Every read used for a check or a write must happen inside `run`.
 */
export function stockTransaction<T>(
  scopeType: string,
  scopeId: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      const lockKey = `stock:${scopeType}:${scopeId}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS locked`;
      return run(tx);
    },
    // Waiting for another stock write of the tenant counts in the transaction time.
    { maxWait: 10_000, timeout: 20_000 },
  );
}
