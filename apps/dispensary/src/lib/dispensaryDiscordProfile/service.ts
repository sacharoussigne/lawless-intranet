import type { PrismaClient } from '@prisma/client';
import { findLinkedUserIdByDiscordAccount } from '@/lib/dispensaryWeeklyActivity/resolveDisplayName';
import { pickProfileDisplayName } from '@/lib/people/displayName';

type ProfileDb = Pick<PrismaClient, 'dispensaryDiscordProfile'>;

export type DiscordProfileSnapshot = {
  discordUserId: string;
  lastDisplayName: string;
  fixedDisplayName: string | null;
  role: string | null;
  accountNumber: number | null;
  userId: string | null;
};

const snapshotSelect = {
  discordUserId: true,
  lastDisplayName: true,
  fixedDisplayName: true,
  role: true,
  accountNumber: true,
  userId: true,
} as const;

export const DISCORD_PROFILE_DUPLICATE_MESSAGE = 'Une personne avec ce Discord ID existe déjà.';

/** Thrown when a business rule refuses the change; the action maps it to a 409. */
export class DiscordProfileConflictError extends Error {}

function trimDisplayName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimDisplayName(trimmed) : null;
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

  // `fixedDisplayName` is never touched here: a name set by hand wins over the bot.
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
    select: snapshotSelect,
  });

  return new Map(rows.map((row) => [row.discordUserId, row]));
}

/** Fixed name of a profile, for a new activity row (the bot's nickname otherwise). */
export async function findFixedDisplayName(
  client: ProfileDb,
  dispensaryId: string,
  discordUserId: string,
): Promise<string | null> {
  const profile = await client.dispensaryDiscordProfile.findUnique({
    where: { dispensaryId_discordUserId: { dispensaryId, discordUserId } },
    select: { fixedDisplayName: true },
  });
  return normalizeOptionalText(profile?.fixedDisplayName);
}

async function assertAccountNumberAvailable(
  client: ProfileDb,
  dispensaryId: string,
  accountNumber: number | null | undefined,
  discordUserId: string,
) {
  if (accountNumber == null) return;
  const other = await client.dispensaryDiscordProfile.findFirst({
    where: { dispensaryId, accountNumber, NOT: { discordUserId } },
    select: { lastDisplayName: true, fixedDisplayName: true },
  });
  if (other) {
    throw new DiscordProfileConflictError(
      `Le n° de compte ${accountNumber} est déjà attribué à ${pickProfileDisplayName(other, 'une autre personne')}.`,
    );
  }
}

export async function createDiscordProfile(
  client: ProfileDb,
  input: {
    dispensaryId: string;
    discordUserId: string;
    displayName: string;
    role?: string | null;
    accountNumber?: number | null;
    userId: string | null;
    createdById: string;
  },
): Promise<DiscordProfileSnapshot> {
  const existing = await client.dispensaryDiscordProfile.findUnique({
    where: {
      dispensaryId_discordUserId: {
        dispensaryId: input.dispensaryId,
        discordUserId: input.discordUserId,
      },
    },
    select: { id: true },
  });
  if (existing) {
    throw new DiscordProfileConflictError(DISCORD_PROFILE_DUPLICATE_MESSAGE);
  }
  await assertAccountNumberAvailable(
    client,
    input.dispensaryId,
    input.accountNumber,
    input.discordUserId,
  );

  const name = trimDisplayName(input.displayName);
  return client.dispensaryDiscordProfile.create({
    data: {
      dispensaryId: input.dispensaryId,
      discordUserId: input.discordUserId,
      lastDisplayName: name,
      fixedDisplayName: name,
      role: normalizeOptionalText(input.role),
      accountNumber: input.accountNumber ?? null,
      userId: input.userId,
      createdById: input.createdById,
    },
    select: snapshotSelect,
  });
}

export async function updateDiscordProfileFields(
  client: ProfileDb,
  input: {
    dispensaryId: string;
    discordUserId: string;
    /** `null` removes the fixed name (the bot's name is shown again). */
    fixedDisplayName?: string | null;
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

  const data: {
    fixedDisplayName?: string | null;
    role?: string | null;
    accountNumber?: number | null;
  } = {};
  if (input.fixedDisplayName !== undefined) {
    data.fixedDisplayName = normalizeOptionalText(input.fixedDisplayName);
  }
  if (input.role !== undefined) {
    data.role = normalizeOptionalText(input.role);
  }
  if (input.accountNumber !== undefined) {
    await assertAccountNumberAvailable(
      client,
      input.dispensaryId,
      input.accountNumber,
      input.discordUserId,
    );
    data.accountNumber = input.accountNumber;
  }

  return client.dispensaryDiscordProfile.update({
    where: { id: existing.id },
    data,
    select: snapshotSelect,
  });
}
