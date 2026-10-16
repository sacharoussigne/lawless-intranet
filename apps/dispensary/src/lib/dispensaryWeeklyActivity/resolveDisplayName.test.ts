import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  genericDoctorFallbackName,
  getLatestDiscordDisplayNames,
  mergeResolvedDisplayNames,
  resolveBotWeeklyActivityDisplayName,
} from '@/lib/dispensaryWeeklyActivity/resolveDisplayName';

function mockPrisma(displayNamesByDiscordId: Record<string, string[]>) {
  const flatRows = Object.entries(displayNamesByDiscordId).flatMap(([discordUserId, names]) =>
    names.map((displayName, index) => ({
      dispensaryId: discordUserId.startsWith('other:') ? 'd2' : 'd1',
      discordUserId: discordUserId.replace(/^other:/, ''),
      displayName,
      updatedAt: new Date(Date.now() - index * 1000),
    })),
  );

  return {
    dispensaryWeeklyActivity: {
      findFirst: vi.fn(async ({ where }: { where: { discordUserId: string } }) => {
        const names = displayNamesByDiscordId[where.discordUserId] ?? [];
        const displayName = names[0];
        return displayName ? { displayName } : null;
      }),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { dispensaryId: string; discordUserId: { in: string[] } };
        }) => {
          const ids = new Set(where.discordUserId.in);
          return flatRows
            .filter((r) => r.dispensaryId === where.dispensaryId && ids.has(r.discordUserId))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        },
      ),
    },
  } as unknown as Pick<PrismaClient, 'dispensaryWeeklyActivity'>;
}

describe('getLatestDiscordDisplayNames', () => {
  it('returns the most recently updated display name per discord user in one batch', async () => {
    const discordUserId = '456';
    const prisma = mockPrisma({
      [discordUserId]: ['LatestDiscordName', 'OlderName'],
    });

    const map = await getLatestDiscordDisplayNames(prisma, 'd1', [discordUserId, discordUserId]);

    expect(map.get(discordUserId)).toBe('LatestDiscordName');
    expect(prisma.dispensaryWeeklyActivity.findMany).toHaveBeenCalledTimes(1);
  });

  it('never reads the names of another dispensary', async () => {
    const prisma = mockPrisma({ 'other:222': ['NameElsewhere'] });

    const map = await getLatestDiscordDisplayNames(prisma, 'd1', ['222']);

    expect(map.has('222')).toBe(false);
  });

  it('skips generic fallback display names', async () => {
    const discordUserId = '111';
    const prisma = mockPrisma({
      [discordUserId]: [genericDoctorFallbackName(discordUserId)],
    });

    const map = await getLatestDiscordDisplayNames(prisma, 'd1', [discordUserId]);

    expect(map.has(discordUserId)).toBe(false);
  });
});

describe('mergeResolvedDisplayNames', () => {
  it('uses stored displayName even when a linked intranet user name differs', async () => {
    const prisma = mockPrisma({});
    const rows = [
      {
        displayName: 'DrDiscord',
        discordUserId: '123',
        userId: 'user-1',
        user: { name: 'IntranetName' },
      },
    ];

    const out = await mergeResolvedDisplayNames(prisma, 'd1', rows);

    expect(out[0].resolvedDisplayName).toBe('DrDiscord');
  });

  it('falls back to the latest known discord display name for generic stored values', async () => {
    const discordUserId = '456';
    const prisma = mockPrisma({
      [discordUserId]: ['LatestDiscordName', 'OlderName'],
    });
    const rows = [
      {
        displayName: genericDoctorFallbackName(discordUserId),
        discordUserId,
        userId: null,
      },
    ];

    const out = await mergeResolvedDisplayNames(prisma, 'd1', rows);

    expect(out[0].resolvedDisplayName).toBe('LatestDiscordName');
  });
});

describe('resolveBotWeeklyActivityDisplayName', () => {
  it('returns the latest known discord display name', async () => {
    const discordUserId = '789';
    const prisma = mockPrisma({
      [discordUserId]: ['BotPseudo'],
    });

    await expect(resolveBotWeeklyActivityDisplayName(prisma, 'd1', discordUserId)).resolves.toBe(
      'BotPseudo',
    );
  });

  it('falls back to a generic doctor label when no discord name exists', async () => {
    const discordUserId = '999';
    const prisma = mockPrisma({});

    await expect(resolveBotWeeklyActivityDisplayName(prisma, 'd1', discordUserId)).resolves.toBe(
      genericDoctorFallbackName(discordUserId),
    );
  });
});
