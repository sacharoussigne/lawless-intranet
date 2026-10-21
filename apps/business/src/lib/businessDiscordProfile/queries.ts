import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * A person is shared by every business (`Person`, keyed by its Discord ID); a
 * business knows it through `BusinessPerson`, which holds its grade there.
 * The "profile" of a Discord ID in a business is both, flattened.
 */
export type ProfileDb = Pick<PrismaClient, 'person' | 'businessPerson'>;

export type DiscordProfileSnapshot = {
  discordUserId: string;
  lastDisplayName: string;
  fixedDisplayName: string | null;
  role: string | null;
  accountNumber: number | null;
  userId: string | null;
  /** Last change of the person or of its grade here. */
  updatedAt: Date;
};

/** Persons known by this business (filter of `Person` queries). */
export function personInBusiness(businessId: string): Prisma.PersonWhereInput {
  return { businesses: { some: { businessId } } };
}

export const personSelect = {
  id: true,
  discordUserId: true,
  lastDisplayName: true,
  fixedDisplayName: true,
  accountNumber: true,
  userId: true,
  updatedAt: true,
} as const;

export function snapshotOf(
  person: Prisma.PersonGetPayload<{ select: typeof personSelect }>,
  role: string | null,
  linkUpdatedAt?: Date,
): DiscordProfileSnapshot {
  return {
    updatedAt:
      linkUpdatedAt && linkUpdatedAt > person.updatedAt ? linkUpdatedAt : person.updatedAt,
    discordUserId: person.discordUserId,
    lastDisplayName: person.lastDisplayName,
    fixedDisplayName: person.fixedDisplayName,
    role,
    accountNumber: person.accountNumber,
    userId: person.userId,
  };
}

/** Profiles of a business (person + grade there), optionally narrowed on the person. */
export async function findBusinessProfiles(
  client: ProfileDb,
  businessId: string,
  personWhere: Prisma.PersonWhereInput = {},
): Promise<DiscordProfileSnapshot[]> {
  const links = await client.businessPerson.findMany({
    where: { businessId, person: personWhere },
    select: { role: true, updatedAt: true, person: { select: personSelect } },
  });
  return links.map((link) => snapshotOf(link.person, link.role, link.updatedAt));
}

/** Profile of a Discord ID in a business, null when the business does not know it. */
export async function findBusinessProfile(
  client: ProfileDb,
  businessId: string,
  discordUserId: string,
): Promise<DiscordProfileSnapshot | null> {
  const [profile] = await findBusinessProfiles(client, businessId, { discordUserId });
  return profile ?? null;
}

export async function loadDiscordProfilesByIds(
  client: ProfileDb,
  businessId: string,
  discordUserIds: string[],
): Promise<Map<string, DiscordProfileSnapshot>> {
  const unique = [...new Set(discordUserIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const rows = await findBusinessProfiles(client, businessId, { discordUserId: { in: unique } });
  return new Map(rows.map((row) => [row.discordUserId, row]));
}
