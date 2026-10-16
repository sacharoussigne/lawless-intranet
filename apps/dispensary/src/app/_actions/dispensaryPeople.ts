'use server';

import { z } from 'zod/v3';
import { findUserIdByDiscordId } from '@lawless-intranet/auth-client/internal';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { loggedAction } from '@/lib/logs/writer';
import { fetchDiscordLinkedUsers, fetchUserProfiles } from '@/lib/authUsers';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import {
  createDiscordProfile,
  DiscordProfileConflictError,
  updateDiscordProfileFields,
  type DiscordProfileSnapshot,
} from '@/lib/dispensaryDiscordProfile/service';
import { pickProfileDisplayName } from '@/lib/people/displayName';
import { linkUnlinkedProfiles } from '@/lib/people/resolveNames';
import type { DispensaryPerson, DispensaryPeopleList } from '@/lib/people/types';

const peopleGuard = {
  feature: 'weeklyDispensaryActivity' as const,
  permission: {
    resource: 'weekly_dispensary_activity' as const,
    action: 'edit_all',
    message: 'Permission refusée : la gestion des personnes demande de pouvoir modifier toute l’activité',
  },
};

const discordUserIdSchema = z
  .string()
  .trim()
  .regex(/^\d{17,20}$/, 'Discord ID invalide (17 à 20 chiffres)');

const displayNameSchema = z.string().trim().min(1, 'Le nom est requis').max(200);
const roleSchema = z.string().trim().max(100).nullable().optional();
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
): DispensaryPerson {
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

async function loadPerson(dispensaryId: string, discordUserId: string): Promise<DispensaryPerson> {
  const profile = await prisma.dispensaryDiscordProfile.findUniqueOrThrow({
    where: { dispensaryId_discordUserId: { dispensaryId, discordUserId } },
    select: profileSelect,
  });
  const account = profile.userId
    ? (await fetchUserProfiles([profile.userId])).get(profile.userId)
    : undefined;
  return toPerson(profile, account?.name ?? null);
}

export async function listDispensaryPeople(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, peopleGuard);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    // People added before they had an account: link them to the account now holding their Discord ID.
    try {
      await linkUnlinkedProfiles(prisma, dispensaryId);
    } catch {
      // The auth service did not answer: the list still loads, links are retried next time.
    }

    const [profiles, members, discordUsers] = await Promise.all([
      prisma.dispensaryDiscordProfile.findMany({
        where: { dispensaryId },
        select: profileSelect,
      }),
      prisma.dispensaryMember.findMany({ where: { dispensaryId }, select: { userId: true } }),
      fetchDiscordLinkedUsers(),
    ]);

    const accountIds = profiles.map((p) => p.userId).filter((id): id is string => Boolean(id));
    const accounts = await fetchUserProfiles(accountIds);

    const people = profiles
      .map((profile) => toPerson(profile, profile.userId ? accounts.get(profile.userId)?.name ?? null : null))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'));

    // Members with Discord but no profile yet: offered in the « Ajouter » modal.
    const memberIds = new Set(members.map((m) => m.userId));
    const profileDiscordIds = new Set(profiles.map((p) => p.discordUserId));
    const membersWithoutProfile = discordUsers
      .filter((user) => user.discordId && memberIds.has(user.id) && !profileDiscordIds.has(user.discordId))
      .map((user) => ({ userId: user.id, name: user.name, discordUserId: user.discordId as string }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    const data: DispensaryPeopleList = { people, membersWithoutProfile };
    return { status: 200 as const, data };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des personnes');
  }
}

async function createDispensaryPersonUnlogged(dispensarySlug: string, input: unknown) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, peopleGuard);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;
    const data = createPersonSchema.parse(input);

    let userId: string | null = null;
    try {
      userId = await findUserIdByDiscordId(data.discordUserId);
    } catch {
      // No answer from the auth service: the account is linked later, on the next list.
    }

    await createDiscordProfile(prisma, {
      dispensaryId,
      discordUserId: data.discordUserId,
      displayName: data.displayName,
      role: data.role,
      accountNumber: data.accountNumber,
      userId,
      createdById: ctx.session.user.id,
    });

    return { status: 200 as const, data: await loadPerson(dispensaryId, data.discordUserId) };
  } catch (error) {
    if (error instanceof DiscordProfileConflictError) {
      return { status: 409 as const, error: error.message };
    }
    return actionErrorParser(error, 'Erreur lors de l’ajout de la personne');
  }
}

async function updateDispensaryPersonUnlogged(dispensarySlug: string, input: unknown) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, peopleGuard);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;
    const data = updatePersonSchema.parse(input);

    await updateDiscordProfileFields(prisma, {
      dispensaryId,
      discordUserId: data.discordUserId,
      fixedDisplayName: data.fixedDisplayName,
      role: data.role,
      accountNumber: data.accountNumber,
    });

    return { status: 200 as const, data: await loadPerson(dispensaryId, data.discordUserId) };
  } catch (error) {
    if (error instanceof DiscordProfileConflictError) {
      return { status: 409 as const, error: error.message };
    }
    return actionErrorParser(error, 'Erreur lors de la modification de la personne');
  }
}

export async function createDispensaryPerson(...args: Parameters<typeof createDispensaryPersonUnlogged>) {
  return loggedAction(
    {
      feature: 'weeklyDispensaryActivity',
      event: 'people.createPerson',
      target: ([, input]) => (input as { discordUserId?: string } | undefined)?.discordUserId,
    },
    args,
    () => createDispensaryPersonUnlogged(...args),
  );
}

export async function updateDispensaryPerson(...args: Parameters<typeof updateDispensaryPersonUnlogged>) {
  return loggedAction(
    {
      feature: 'weeklyDispensaryActivity',
      event: 'people.updatePerson',
      target: ([, input]) => (input as { discordUserId?: string } | undefined)?.discordUserId,
    },
    args,
    () => updateDispensaryPersonUnlogged(...args),
  );
}
