'use server';

import { z } from 'zod/v3';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { loggedAction } from '@/lib/logs/writer';
import { fetchUserProfiles } from '@/lib/authUsers';
import { accountIdOfDiscord, reconcileAccountLinks } from '@/lib/people/accountLinks';
import {
  getDiscordAccountIdsForUsers,
  getLatestDiscordDisplayName,
} from '@/lib/businessWeeklyActivity/resolveDisplayName';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import {
  createDiscordProfile,
  DiscordProfileConflictError,
  DiscordProfileNotFoundError,
  updateDiscordProfileFields,
  type DiscordProfileSnapshot,
} from '@/lib/businessDiscordProfile/service';
import { pickProfileDisplayName } from '@/lib/people/displayName';
import { discordUserIdSchema } from '@/lib/people/discordId';
import { PAYROLL_EMPLOYEE_ROLES } from '@/lib/businessDiscordProfile/constants';
import type { BusinessPerson, BusinessPeopleList } from '@/lib/people/types';

const peopleGuard = {
  feature: 'weeklyActivity' as const,
  permission: {
    resource: 'weekly_activity' as const,
    action: 'edit_all',
    message: 'Permission refusée : la gestion des personnes demande de pouvoir modifier toute l’activité',
  },
};


const displayNameSchema = z.string().trim().min(1, 'Le nom est requis').max(200);
const roleSchema = z.enum(PAYROLL_EMPLOYEE_ROLES).nullable().optional();
const accountNumberSchema = z
  .number()
  .int('N° de compte invalide')
  .min(1, 'N° de compte invalide')
  .max(999999, 'N° de compte invalide')
  .nullable()
  .optional();

const createPersonSchema = z.object({
  discordUserId: discordUserIdSchema,
  displayName: displayNameSchema,
  accountNumber: accountNumberSchema,
  role: roleSchema,
});

const updatePersonSchema = z.object({
  discordUserId: discordUserIdSchema,
  /** `null` removes the fixed name: the name sent by the bot is shown again. */
  fixedDisplayName: displayNameSchema.nullable().optional(),
  accountNumber: accountNumberSchema,
  role: roleSchema,
});

function toPerson(
  profile: DiscordProfileSnapshot & { updatedAt: Date },
  accountName: string | null,
): BusinessPerson {
  return {
    discordUserId: profile.discordUserId,
    displayName: pickProfileDisplayName(profile, accountName ?? profile.discordUserId),
    fixedDisplayName: profile.fixedDisplayName?.trim() || null,
    lastDisplayName: profile.lastDisplayName,
    role: profile.role,
    accountNumber: profile.accountNumber,
    account: profile.userId ? { id: profile.userId, name: accountName ?? 'Compte intranet' } : null,
    updatedAt: profile.updatedAt,
  };
}

const profileSelect = {
  discordUserId: true,
  lastDisplayName: true,
  fixedDisplayName: true,
  role: true,
  accountNumber: true,
  userId: true,
  updatedAt: true,
} as const;

async function loadPerson(businessId: string, discordUserId: string): Promise<BusinessPerson> {
  const profile = await prisma.businessDiscordProfile.findUniqueOrThrow({
    where: { businessId_discordUserId: { businessId, discordUserId } },
    select: profileSelect,
  });
  const account = profile.userId
    ? (await fetchUserProfiles([profile.userId])).get(profile.userId)
    : undefined;
  return toPerson(profile, account?.name ?? null);
}

export async function listBusinessPeople(businessSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, peopleGuard);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const [initialProfiles, members] = await Promise.all([
      prisma.businessDiscordProfile.findMany({ where: { businessId }, select: profileSelect }),
      prisma.businessMember.findMany({ where: { businessId }, select: { userId: true } }),
    ]);

    // Accounts created (or unlinked) since the people were added; best effort, cached.
    const links = await reconcileAccountLinks(
      prisma,
      businessId,
      initialProfiles.map((p) => p.discordUserId),
    );
    const profiles = initialProfiles.map((profile) => {
      const userId = links?.get(profile.discordUserId);
      return userId === undefined ? profile : { ...profile, userId };
    });

    const memberIds = members.map((m) => m.userId);
    const accountIds = profiles.map((p) => p.userId).filter((id): id is string => Boolean(id));
    const [accounts, memberDiscordIds] = await Promise.all([
      fetchUserProfiles([...new Set([...accountIds, ...memberIds])]),
      getDiscordAccountIdsForUsers(memberIds),
    ]);

    const people = profiles
      .map((profile) => toPerson(profile, profile.userId ? accounts.get(profile.userId)?.name ?? null : null))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'));

    // Members with Discord but no profile yet: offered in the « Ajouter » modal.
    const profileDiscordIds = new Set(profiles.map((p) => p.discordUserId));
    const membersWithoutProfile = [...memberDiscordIds]
      .filter(([, discordUserId]) => !profileDiscordIds.has(discordUserId))
      .map(([userId, discordUserId]) => ({
        userId,
        name: accounts.get(userId)?.name ?? 'Utilisateur',
        discordUserId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    const data: BusinessPeopleList = { people, membersWithoutProfile };
    return { status: 200 as const, data };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des personnes');
  }
}

async function createBusinessPersonUnlogged(businessSlug: string, input: unknown) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, peopleGuard);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;
    const data = createPersonSchema.parse(input);

    // No answer from the auth service: the account is linked later, on the next list.
    const userId = (await accountIdOfDiscord(data.discordUserId)) ?? null;

    await createDiscordProfile(prisma, {
      lastKnownName: await getLatestDiscordDisplayName(prisma, businessId, data.discordUserId),
      businessId,
      discordUserId: data.discordUserId,
      displayName: data.displayName,
      role: data.role,
      accountNumber: data.accountNumber,
      userId,
      createdById: ctx.session.user.id,
    });

    return { status: 200 as const, data: await loadPerson(businessId, data.discordUserId) };
  } catch (error) {
    if (error instanceof DiscordProfileConflictError) {
      return { status: 409 as const, error: error.message };
    }
    return actionErrorParser(error, 'Erreur lors de l’ajout de la personne');
  }
}

async function updateBusinessPersonUnlogged(businessSlug: string, input: unknown) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, peopleGuard);
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;
    const data = updatePersonSchema.parse(input);

    await updateDiscordProfileFields(prisma, {
      businessId,
      discordUserId: data.discordUserId,
      fixedDisplayName: data.fixedDisplayName,
      role: data.role,
      accountNumber: data.accountNumber,
    });

    return { status: 200 as const, data: await loadPerson(businessId, data.discordUserId) };
  } catch (error) {
    if (error instanceof DiscordProfileNotFoundError) {
      return { status: 404 as const, error: error.message };
    }
    if (error instanceof DiscordProfileConflictError) {
      return { status: 409 as const, error: error.message };
    }
    return actionErrorParser(error, 'Erreur lors de la modification de la personne');
  }
}

export async function createBusinessPerson(...args: Parameters<typeof createBusinessPersonUnlogged>) {
  return loggedAction(
    {
      feature: 'weeklyActivity',
      event: 'people.createPerson',
      target: ([, input]) => (input as { discordUserId?: string } | undefined)?.discordUserId,
    },
    args,
    () => createBusinessPersonUnlogged(...args),
  );
}

export async function updateBusinessPerson(...args: Parameters<typeof updateBusinessPersonUnlogged>) {
  return loggedAction(
    {
      feature: 'weeklyActivity',
      event: 'people.updatePerson',
      target: ([, input]) => (input as { discordUserId?: string } | undefined)?.discordUserId,
    },
    args,
    () => updateBusinessPersonUnlogged(...args),
  );
}
