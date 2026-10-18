import { Prisma, type PrismaClient } from '@prisma/client';
import { pickProfileDisplayName } from '@/lib/people/displayName';

type ProfileDb = Pick<PrismaClient, 'businessDiscordProfile'>;

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

/** No profile for this Discord id in the dispensary; the action maps it to a 404. */
export class DiscordProfileNotFoundError extends Error {}

/** A concurrent save took the same Discord id or account number (unique constraints). */
function toConflict(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = JSON.stringify(error.meta?.target ?? '');
    return new DiscordProfileConflictError(
      target.includes('accountNumber')
        ? 'Ce n° de compte est déjà attribué à une autre personne.'
        : DISCORD_PROFILE_DUPLICATE_MESSAGE,
    );
  }
  return error;
}

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
    businessId: string;
    discordUserId: string;
    displayName: string;
    /**
     * Current account of the Discord id, resolved before the transaction:
     * `null` unlinks, `undefined` (auth did not answer) keeps the stored link.
     */
    userId: string | null | undefined;
  },
): Promise<void> {
  const lastDisplayName = trimDisplayName(input.displayName);
  const linkedUserId = input.userId;

  // Intranet rows carry the fixed name: never copy it back into the bot's name
  // (same rule as migration 20261016150000).
  const existing = await client.businessDiscordProfile.findUnique({
    where: {
      businessId_discordUserId: {
        businessId: input.businessId,
        discordUserId: input.discordUserId,
      },
    },
    select: { fixedDisplayName: true },
  });
  const keepLastName = existing?.fixedDisplayName === lastDisplayName;

  // `fixedDisplayName` is never touched here: a name set by hand wins over the bot.
  await client.businessDiscordProfile.upsert({
    where: {
      businessId_discordUserId: {
        businessId: input.businessId,
        discordUserId: input.discordUserId,
      },
    },
    create: {
      businessId: input.businessId,
      discordUserId: input.discordUserId,
      lastDisplayName,
      userId: linkedUserId ?? null,
    },
    update: {
      ...(keepLastName ? {} : { lastDisplayName }),
      ...(linkedUserId !== undefined ? { userId: linkedUserId } : {}),
    },
  });
}

export async function loadDiscordProfilesByIds(
  client: ProfileDb,
  businessId: string,
  discordUserIds: string[],
): Promise<Map<string, DiscordProfileSnapshot>> {
  const unique = [...new Set(discordUserIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const rows = await client.businessDiscordProfile.findMany({
    where: {
      businessId,
      discordUserId: { in: unique },
    },
    select: snapshotSelect,
  });

  return new Map(rows.map((row) => [row.discordUserId, row]));
}

/** Fixed name of a profile, for a new activity row (the bot's nickname otherwise). */
export async function findFixedDisplayName(
  client: ProfileDb,
  businessId: string,
  discordUserId: string,
): Promise<string | null> {
  const profile = await client.businessDiscordProfile.findUnique({
    where: { businessId_discordUserId: { businessId, discordUserId } },
    select: { fixedDisplayName: true },
  });
  return normalizeOptionalText(profile?.fixedDisplayName);
}

async function assertAccountNumberAvailable(
  client: ProfileDb,
  businessId: string,
  accountNumber: number | null | undefined,
  discordUserId: string,
) {
  if (accountNumber == null) return;
  const other = await client.businessDiscordProfile.findFirst({
    where: { businessId, accountNumber, NOT: { discordUserId } },
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
    businessId: string;
    discordUserId: string;
    displayName: string;
    role?: string | null;
    accountNumber?: number | null;
    userId: string | null;
    createdById: string;
    /** Latest name sent by the bot for this Discord id, if any. */
    lastKnownName?: string | null;
  },
): Promise<DiscordProfileSnapshot> {
  const existing = await client.businessDiscordProfile.findUnique({
    where: {
      businessId_discordUserId: {
        businessId: input.businessId,
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
    input.businessId,
    input.accountNumber,
    input.discordUserId,
  );

  const name = trimDisplayName(input.displayName);
  return client.businessDiscordProfile
    .create({
      data: {
        businessId: input.businessId,
        discordUserId: input.discordUserId,
        // The bot's name: unknown until it sends one (the fixed name is kept apart).
        lastDisplayName: input.lastKnownName ?? '',
        fixedDisplayName: name,
        role: normalizeOptionalText(input.role),
        accountNumber: input.accountNumber ?? null,
        userId: input.userId,
        createdById: input.createdById,
      },
      select: snapshotSelect,
    })
    .catch((error: unknown) => {
      throw toConflict(error);
    });
}

export async function updateDiscordProfileFields(
  client: ProfileDb,
  input: {
    businessId: string;
    discordUserId: string;
    /** `null` removes the fixed name (the bot's name is shown again). */
    fixedDisplayName?: string | null;
    role?: string | null;
    accountNumber?: number | null;
  },
): Promise<DiscordProfileSnapshot> {
  const existing = await client.businessDiscordProfile.findUnique({
    where: {
      businessId_discordUserId: {
        businessId: input.businessId,
        discordUserId: input.discordUserId,
      },
    },
  });
  if (!existing) {
    throw new DiscordProfileNotFoundError('Profil introuvable pour cette personne');
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
      input.businessId,
      input.accountNumber,
      input.discordUserId,
    );
    data.accountNumber = input.accountNumber;
  }

  return client.businessDiscordProfile
    .update({ where: { id: existing.id }, data, select: snapshotSelect })
    .catch((error: unknown) => {
      throw toConflict(error);
    });
}
