import prisma from '@/lib/prisma';
import {
  accountIdOfDiscord,
  lookupAccountsByDiscordIds,
  lookupDiscordIdOfUser,
  lookupDiscordIdsByUserIds,
} from '@/lib/people/accountLinks';
import { effectiveMemberRoles } from './roles';
import type { StaffDb } from './service';

/**
 * Intranet access follows the staff register: while employed, a person's
 * account is a member with the roles of their grade (lib/businessTypes
 * `gradeRoles`), plus the roles given by hand (`BusinessMember.manualRoles`).
 * `BusinessMember.role` stores the result so every reader stays a single query;
 * only this module writes it.
 *
 * The person is the Discord id: the account comes from auth. A Discord moved
 * to another account keeps its roles on the old one until the next sync of
 * that person (rare, fixed by any change in the register or the members).
 */

export type Employment = { employed: boolean; grade: string | null };

async function employmentOf(db: StaffDb, businessId: string, discordUserId: string | null): Promise<Employment> {
  if (!discordUserId) return { employed: false, grade: null };
  const link = await db.businessPerson.findFirst({
    where: { businessId, person: { discordUserId } },
    select: { role: true, employments: { where: { endedAt: null }, select: { id: true }, take: 1 } },
  });
  return { employed: (link?.employments.length ?? 0) > 0, grade: link?.role ?? null };
}

/** Discord id of an account; falls back on the stored link when auth does not answer. */
async function discordOfAccount(db: StaffDb, userId: string): Promise<string | null> {
  const found = await lookupDiscordIdOfUser(userId);
  if (found !== undefined) return found;
  const person = await db.person.findFirst({ where: { userId }, select: { discordUserId: true } });
  return person?.discordUserId ?? null;
}

/**
 * Recomputes the roles of an account in a business: creates the member when
 * the grade gives roles, removes it when nothing is left. Returns the roles
 * (comma list, empty when no longer a member).
 */
export async function syncMemberRoles(
  db: StaffDb,
  businessId: string,
  userId: string,
  discordUserId?: string | null,
): Promise<string> {
  const discord = discordUserId !== undefined ? discordUserId : await discordOfAccount(db, userId);
  // Sequential: `db` may be a transaction, which runs one query at a time.
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { type: true } });
  const member = await db.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId } },
    select: { role: true, manualRoles: true },
  });
  const employment = await employmentOf(db, businessId, discord);
  const role = effectiveMemberRoles({ type: business.type, ...employment, manualRoles: member?.manualRoles });

  if (!role) {
    if (member) await db.businessMember.deleteMany({ where: { businessId, userId } });
    return role;
  }
  if (member?.role !== role) {
    await db.businessMember.upsert({
      where: { businessId_userId: { businessId, userId } },
      create: { businessId, userId, role },
      update: { role },
    });
  }
  return role;
}

/** After a change in the register: syncs the account of this Discord id, if it has one. */
export async function syncPersonAccess(db: StaffDb, businessId: string, discordUserId: string): Promise<void> {
  let userId = await accountIdOfDiscord(discordUserId);
  if (userId === undefined) {
    const person = await db.person.findUnique({ where: { discordUserId }, select: { userId: true } });
    userId = person?.userId ?? null;
  }
  if (userId) await syncMemberRoles(db, businessId, userId, discordUserId);
}

/**
 * Account without a member row in this business: creates it when its Discord
 * id is employed there (account created after the hiring). Returns the roles,
 * or null when the account has no access.
 */
export async function ensureEmployeeMembership(businessId: string, userId: string): Promise<string | null> {
  const discord = await discordOfAccount(prisma, userId);
  if (!discord) return null;
  const { employed } = await employmentOf(prisma, businessId, discord);
  if (!employed) return null;
  return (await syncMemberRoles(prisma, businessId, userId, discord)) || null;
}

/** Same, for every business where this account's Discord id is employed (business picker). */
export async function ensureEmployeeMemberships(userId: string): Promise<void> {
  const discord = await discordOfAccount(prisma, userId);
  if (!discord) return;
  const links = await prisma.businessPerson.findMany({
    where: {
      person: { discordUserId: discord },
      employments: { some: { endedAt: null } },
      business: { members: { none: { userId } } },
    },
    select: { businessId: true },
  });
  for (const { businessId } of links) {
    await syncMemberRoles(prisma, businessId, userId, discord);
  }
}

/**
 * Employees of a business whose account is not a member yet (Réglages ›
 * Membres lists them right away). Best effort: nothing when auth does not answer.
 */
export async function syncEmployeeMembers(businessId: string): Promise<void> {
  const employed = await prisma.businessPerson.findMany({
    where: { businessId, employments: { some: { endedAt: null } } },
    select: { person: { select: { discordUserId: true } } },
  });
  const discordIds = employed.map((link) => link.person.discordUserId);
  const accounts = await lookupAccountsByDiscordIds(discordIds);
  if (!accounts) return;
  const userIds = discordIds.flatMap((id) => {
    const userId = accounts.get(id)?.userId;
    return userId ? [{ userId, discordId: id }] : [];
  });
  const members = await prisma.businessMember.findMany({
    where: { businessId, userId: { in: userIds.map((u) => u.userId) } },
    select: { userId: true },
  });
  const known = new Set(members.map((m) => m.userId));
  for (const { userId, discordId } of userIds) {
    if (!known.has(userId)) await syncMemberRoles(prisma, businessId, userId, discordId);
  }
}

/** Grade and employment of each account in a business (Réglages › Membres). */
export async function employmentOfAccounts(
  businessId: string,
  userIds: string[],
): Promise<Map<string, Employment>> {
  const discordByUser = (await lookupDiscordIdsByUserIds(userIds)) ?? new Map<string, string | null>();
  const discordIds = [...discordByUser.values()].filter((id): id is string => Boolean(id));
  const links = await prisma.businessPerson.findMany({
    where: { businessId, person: { discordUserId: { in: discordIds } } },
    select: {
      role: true,
      person: { select: { discordUserId: true } },
      employments: { where: { endedAt: null }, select: { id: true }, take: 1 },
    },
  });
  const byDiscord = new Map(
    links.map((link) => [link.person.discordUserId, { employed: link.employments.length > 0, grade: link.role }]),
  );
  const result = new Map<string, Employment>();
  for (const [userId, discordId] of discordByUser) {
    const employment = discordId ? byDiscord.get(discordId) : undefined;
    if (employment) result.set(userId, employment);
  }
  return result;
}
