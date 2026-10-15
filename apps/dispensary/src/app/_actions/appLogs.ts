'use server';

import { z } from 'zod/v3';
import type { Prisma } from '@/generated/prisma/client';
import { actionErrorParser } from '@/lib/action';
import { requirePlatformAdminContext } from '@/lib/dispensary/serverActionContext';
import prisma from '@/lib/prisma';

const listAppLogsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(50),
  dispensaryId: z.string().max(100).optional(),
  feature: z.string().max(50).optional(),
  level: z.enum(['INFO', 'WARN', 'ERROR']).optional(),
  kind: z.enum(['ACTION', 'ERROR', 'BOT_REQUEST']).optional(),
  source: z.enum(['INTRANET', 'DISCORD_BOT', 'SYSTEM']).optional(),
  outcome: z.enum(['success', 'noop', 'denied', 'invalid', 'failure']).optional(),
  /** Message, event or path (contains, case-insensitive). */
  search: z.string().trim().max(200).optional(),
  /** User id or Discord id (exact). */
  actor: z.string().trim().max(100).optional(),
  from: z.date().optional(),
  to: z.date().optional(),
});

export type ListAppLogsInput = z.input<typeof listAppLogsSchema>;

export type AppLogRow = {
  id: string;
  createdAt: Date;
  level: 'INFO' | 'WARN' | 'ERROR';
  kind: 'ACTION' | 'ERROR' | 'BOT_REQUEST';
  feature: string;
  event: string;
  outcome: string | null;
  message: string;
  source: 'INTRANET' | 'DISCORD_BOT' | 'SYSTEM';
  dispensaryId: string | null;
  userId: string | null;
  discordUserId: string | null;
  httpStatus: number | null;
  durationMs: number | null;
  path: string | null;
  context: unknown;
  error: unknown;
};

/** App log page (`/platform/logs`): newest first, server-side pagination and filters. Platform admins only. */
export async function listAppLogs(input: ListAppLogsInput) {
  try {
    const auth = await requirePlatformAdminContext();
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }
    const filters = listAppLogsSchema.parse(input ?? {});

    const where: Prisma.AppLogWhereInput = {
      ...(filters.dispensaryId ? { dispensaryId: filters.dispensaryId } : {}),
      ...(filters.feature ? { feature: filters.feature } : {}),
      ...(filters.level ? { level: filters.level } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.outcome ? { outcome: filters.outcome } : {}),
      ...(filters.actor
        ? { OR: [{ userId: filters.actor }, { discordUserId: filters.actor }] }
        : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            AND: [
              {
                OR: [
                  { message: { contains: filters.search, mode: 'insensitive' } },
                  { event: { contains: filters.search, mode: 'insensitive' } },
                  { path: { contains: filters.search, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.appLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.appLog.count({ where }),
    ]);

    return { status: 200, data: { rows: rows as AppLogRow[], total } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des logs');
  }
}
