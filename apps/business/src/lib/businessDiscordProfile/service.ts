import { Prisma } from '@prisma/client';
import { pickProfileDisplayName } from '@/lib/people/displayName';
import {
  findBusinessProfile,
  personSelect,
  salaryTypeOf,
  salaryTypeSelect,
  snapshotOf,
  type DiscordProfileSnapshot,
  type ProfileDb,
  type ProfileSalaryType,
} from '@/lib/businessDiscordProfile/queries';

export {
  findBusinessProfile,
  findBusinessProfiles,
  loadDiscordProfilesByIds,
  personInBusiness,
  type DiscordProfileSnapshot,
  type ProfileDb,
} from '@/lib/businessDiscordProfile/queries';

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

/** Salary type of this business, or null to use the default; refuses another business's type. */
async function salaryTypeOfBusiness(
  client: ProfileDb,
  businessId: string,
  salaryTypeId: string | null,
): Promise<ProfileSalaryType | null> {
  if (!salaryTypeId) return null;
  const row = await client.payrollSalaryType.findFirst({
    where: { id: salaryTypeId, businessId },
    select: salaryTypeSelect,
  });
  if (!row) throw new DiscordProfileNotFoundError('Type de salaire introuvable');
  return salaryTypeOf(row);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimDisplayName(trimmed) : null;
}

/** Links a person to a business (no-op when already linked). */
async function ensureBusinessLink(
  client: ProfileDb,
  businessId: string,
  personId: string,
): Promise<void> {
  await client.businessPerson.upsert({
    where: { businessId_personId: { businessId, personId } },
    create: { businessId, personId },
    update: {},
  });
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
  const existing = await client.person.findUnique({
    where: { discordUserId: input.discordUserId },
    select: { fixedDisplayName: true },
  });
  const keepLastName = existing?.fixedDisplayName === lastDisplayName;

  // `fixedDisplayName` is never touched here: a name set by hand wins over the bot.
  const person = await client.person.upsert({
    where: { discordUserId: input.discordUserId },
    create: {
      discordUserId: input.discordUserId,
      lastDisplayName,
      userId: linkedUserId ?? null,
    },
    update: {
      ...(keepLastName ? {} : { lastDisplayName }),
      ...(linkedUserId !== undefined ? { userId: linkedUserId } : {}),
    },
    select: { id: true },
  });
  await ensureBusinessLink(client, input.businessId, person.id);
}

/** Fixed name of a profile, for a new activity row (the bot's nickname otherwise). */
export async function findFixedDisplayName(
  client: ProfileDb,
  businessId: string,
  discordUserId: string,
): Promise<string | null> {
  const profile = await findBusinessProfile(client, businessId, discordUserId);
  return normalizeOptionalText(profile?.fixedDisplayName);
}

/** An account number is personal: one person per number, across every business. */
async function assertAccountNumberAvailable(
  client: ProfileDb,
  accountNumber: number | null | undefined,
  discordUserId: string,
) {
  if (accountNumber == null) return;
  const other = await client.person.findFirst({
    where: { accountNumber, NOT: { discordUserId } },
    select: { lastDisplayName: true, fixedDisplayName: true },
  });
  if (other) {
    throw new DiscordProfileConflictError(
      `Le n° de compte ${accountNumber} est déjà attribué à ${pickProfileDisplayName(other, 'une autre personne')}.`,
    );
  }
}

/**
 * Adds a person to a business (Gestion › Personnes). A person already known
 * elsewhere is linked: the name and account number given here update it.
 */
export async function createDiscordProfile(
  client: ProfileDb,
  input: {
    businessId: string;
    discordUserId: string;
    displayName: string;
    role?: string | null;
    accountNumber?: number | null;
    /** `null` or absent: the business default salary type. */
    salaryTypeId?: string | null;
    userId: string | null;
    createdById: string;
    /** Latest name sent by the bot for this Discord id, if any. */
    lastKnownName?: string | null;
  },
): Promise<DiscordProfileSnapshot> {
  if (await findBusinessProfile(client, input.businessId, input.discordUserId)) {
    throw new DiscordProfileConflictError(DISCORD_PROFILE_DUPLICATE_MESSAGE);
  }
  await assertAccountNumberAvailable(client, input.accountNumber, input.discordUserId);

  const name = trimDisplayName(input.displayName);
  const role = normalizeOptionalText(input.role);
  const salaryType = await salaryTypeOfBusiness(client, input.businessId, input.salaryTypeId ?? null);
  try {
    const person = await client.person.upsert({
      where: { discordUserId: input.discordUserId },
      create: {
        discordUserId: input.discordUserId,
        // The bot's name: unknown until it sends one (the fixed name is kept apart).
        lastDisplayName: input.lastKnownName ?? '',
        fixedDisplayName: name,
        accountNumber: input.accountNumber ?? null,
        userId: input.userId,
        createdById: input.createdById,
      },
      update: {
        fixedDisplayName: name,
        ...(input.accountNumber != null ? { accountNumber: input.accountNumber } : {}),
        ...(input.userId ? { userId: input.userId } : {}),
      },
      select: personSelect,
    });
    await client.businessPerson.create({
      data: {
        businessId: input.businessId,
        personId: person.id,
        role,
        salaryTypeId: salaryType?.id ?? null,
        createdById: input.createdById,
      },
    });
    return snapshotOf(person, role, undefined, salaryType);
  } catch (error) {
    throw toConflict(error);
  }
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
    /** `null` goes back to the business default salary type. */
    salaryTypeId?: string | null;
  },
): Promise<DiscordProfileSnapshot> {
  const link = await client.businessPerson.findFirst({
    where: { businessId: input.businessId, person: { discordUserId: input.discordUserId } },
    select: { id: true, personId: true, role: true, salaryType: { select: salaryTypeSelect } },
  });
  if (!link) {
    throw new DiscordProfileNotFoundError('Profil introuvable pour cette personne');
  }

  // The name and the account number belong to the person, the grade and the salary to this business.
  const personData: { fixedDisplayName?: string | null; accountNumber?: number | null } = {};
  if (input.fixedDisplayName !== undefined) {
    personData.fixedDisplayName = normalizeOptionalText(input.fixedDisplayName);
  }
  if (input.accountNumber !== undefined) {
    await assertAccountNumberAvailable(client, input.accountNumber, input.discordUserId);
    personData.accountNumber = input.accountNumber;
  }

  let salaryType = salaryTypeOf(link.salaryType);
  if (input.salaryTypeId !== undefined) {
    salaryType = await salaryTypeOfBusiness(client, input.businessId, input.salaryTypeId);
  }

  try {
    let role = link.role;
    if (input.role !== undefined) {
      role = normalizeOptionalText(input.role);
    }
    if (input.role !== undefined || input.salaryTypeId !== undefined) {
      await client.businessPerson.update({
        where: { id: link.id },
        data: { role, salaryTypeId: salaryType?.id ?? null },
      });
    }
    const person = await client.person.update({
      where: { id: link.personId },
      data: personData,
      select: personSelect,
    });
    return snapshotOf(person, role, undefined, salaryType);
  } catch (error) {
    throw toConflict(error);
  }
}
