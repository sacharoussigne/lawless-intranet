import type { PrismaClient } from '@prisma/client';
import { findLinkedUserIdByDiscordAccount } from '@/lib/dispensaryWeeklyActivity/resolveDisplayName';

type ProfileDb = Pick<PrismaClient, 'dispensaryDiscordProfile'>;

export type DiscordProfileSnapshot = {
  discordUserId: string;
  lastDisplayName: string;
  role: string | null;
  accountNumber: number | null;
};

function trimDisplayName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
}

export async function upsertDiscordProfileFromActivity(
  client: ProfileDb,
  input: {
    dispensaryId: string;
    discordUserId: string;
    displayName: string;
    userId?: string | null;
  },
): Promise<void> {
  const lastDisplayName = trimDisplayName(input.displayName);
  const linkedUserId =
    input.userId ?? (await findLinkedUserIdByDiscordAccount(client, input.discordUserId));

  await client.dispensaryDiscordProfile.upsert({
    where: {
      dispensaryId_discordUserId: {
        dispensaryId: input.dispensaryId,
        discordUserId: input.discordUserId,
      },
    },
    create: {
      dispensaryId: input.dispensaryId,
      discordUserId: input.discordUserId,
      lastDisplayName,
      userId: linkedUserId,
    },
    update: {
      lastDisplayName,
      ...(linkedUserId ? { userId: linkedUserId } : {}),
    },
  });
}

export async function loadDiscordProfilesByIds(
  client: ProfileDb,
  dispensaryId: string,
  discordUserIds: string[],
): Promise<Map<string, DiscordProfileSnapshot>> {
  const unique = [...new Set(discordUserIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const rows = await client.dispensaryDiscordProfile.findMany({
    where: {
      dispensaryId,
      discordUserId: { in: unique },
    },
    select: {
      discordUserId: true,
      lastDisplayName: true,
      role: true,
      accountNumber: true,
    },
  });

  return new Map(
    rows.map((row) => [
      row.discordUserId,
      {
        discordUserId: row.discordUserId,
        lastDisplayName: row.lastDisplayName,
        role: row.role,
        accountNumber: row.accountNumber,
      },
    ]),
  );
}

export async function updateDiscordProfileFields(
  client: ProfileDb,
  input: {
    dispensaryId: string;
    discordUserId: string;
    role?: string | null;
    accountNumber?: number | null;
  },
): Promise<DiscordProfileSnapshot> {
  const existing = await client.dispensaryDiscordProfile.findUnique({
    where: {
      dispensaryId_discordUserId: {
        dispensaryId: input.dispensaryId,
        discordUserId: input.discordUserId,
      },
    },
  });
  if (!existing) {
    throw new Error('Profil Discord introuvable pour ce médecin');
  }

  const data: { role?: string | null; accountNumber?: number | null } = {};
  if (input.role !== undefined) {
    data.role = input.role?.trim() ? input.role.trim() : null;
  }
  if (input.accountNumber !== undefined) {
    data.accountNumber = input.accountNumber;
  }

  const updated = await client.dispensaryDiscordProfile.update({
    where: { id: existing.id },
    data,
    select: {
      discordUserId: true,
      lastDisplayName: true,
      role: true,
      accountNumber: true,
    },
  });

  return updated;
}
