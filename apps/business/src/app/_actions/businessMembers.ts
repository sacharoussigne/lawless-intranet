'use server';

import { applyBusinessNamesToUsers } from '@/lib/people/resolveNames';
import { fetchBusinessUserProfiles } from '@/lib/people/userProfiles';
import { loggedAction } from '@/lib/logs/writer';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { actionErrorParser } from '@/lib/action';
import { requireBusinessAdminContext } from '@/lib/business/serverActionContext';
import { tenantWhere } from '@/lib/business/tenantWhere';
import { BUSINESS_MEMBER_ROLES, serializeRoleList } from '@/types/enum/roles';
import { isMemberRoleAllowedForType } from '@/lib/businessTypes';
import { employmentOfAccounts, syncEmployeeMembers, syncMemberRoles } from '@/lib/staff/access';
import { gradeMemberRoles } from '@/lib/staff/roles';
import {
  attachUserProfiles,
  fetchUserProfile,
  searchAuthUsers,
} from '@/lib/authUsers';

const businessRoleEnum = z.enum(BUSINESS_MEMBER_ROLES);

class MemberWithoutRoleError extends Error {
  constructor() {
    super('Au moins un rôle est requis (cette personne n’est pas employée : aucun rôle ne vient de son grade).');
  }
}

const upsertMemberSchema = z.object({
  userId: z.string().min(1),
  /** Manual roles, on top of those of the grade (may be empty for an employee). */
  roles: z.array(businessRoleEnum),
  description: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .transform((value) => {
      if (value === undefined || value === null) return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
});

export async function listBusinessMembers(businessSlug: string) {
  const auth = await requireBusinessAdminContext(businessSlug);
  if (!auth.ok) {
    return { status: auth.status, error: auth.error };
  }

  const { businessId, business } = auth.ctx;
  // Employees whose account is not a member yet show up right away.
  await syncEmployeeMembers(businessId);
  const members = await prisma.businessMember.findMany({
    where: { businessId },
    orderBy: { createdAt: 'asc' },
  });

  const userIds = members.map((member) => member.userId);
  const [usersById, employments] = await Promise.all([
    fetchBusinessUserProfiles(businessId, userIds),
    employmentOfAccounts(businessId, userIds),
  ]);
  const withGrades = members.map((member) => {
    const employment = employments.get(member.userId);
    return {
      ...member,
      grade: employment?.employed ? employment.grade : null,
      gradeRoles: [...gradeMemberRoles(business.type, employment?.employed ?? false, employment?.grade)],
    };
  });
  const enriched = attachUserProfiles(withGrades, usersById).sort((a, b) =>
    (a.user?.name ?? a.userId).localeCompare(b.user?.name ?? b.userId, 'fr'),
  );

  return { status: 200, data: enriched };
}

async function upsertBusinessMemberUnlogged(
  businessSlug: string,
  data: {
    userId: string;
    roles: z.infer<typeof businessRoleEnum>[];
    description?: string | null;
  },
) {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = upsertMemberSchema.parse(data);
    const { type } = auth.ctx.business;
    if (validated.roles.some((r) => !isMemberRoleAllowedForType(type, r))) {
      return { status: 400, error: 'Rôle invalide pour ce type d’entreprise' };
    }
    const user = await fetchUserProfile(validated.userId);
    if (!user) {
      return { status: 404, error: 'Utilisateur introuvable' };
    }

    const { businessId } = auth.ctx;
    const manualRoles = serializeRoleList(validated.roles);
    const descriptionProvided = validated.description !== undefined;

    const member = await prisma.$transaction(async (tx) => {
      // `role` is recomputed right after (grade roles + these manual roles).
      await tx.businessMember.upsert({
        where: { businessId_userId: { businessId, userId: validated.userId } },
        create: {
          businessId,
          userId: validated.userId,
          role: manualRoles,
          manualRoles,
          description: validated.description ?? null,
        },
        update: {
          manualRoles,
          ...(descriptionProvided ? { description: validated.description ?? null } : {}),
        },
      });
      const role = await syncMemberRoles(tx, businessId, validated.userId);
      if (!role) {
        throw new MemberWithoutRoleError();
      }
      return tx.businessMember.findUniqueOrThrow({
        where: { businessId_userId: { businessId, userId: validated.userId } },
      });
    });

    return { status: 200, data: member };
  } catch (error) {
    if (error instanceof MemberWithoutRoleError) {
      return { status: 422, error: error.message };
    }
    return actionErrorParser(error, 'Erreur lors de la mise à jour du membre');
  }
}

async function removeBusinessMemberUnlogged(businessSlug: string, userId: string) {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    await prisma.businessMember.updateMany({
      where: { userId, ...tenantWhere(auth.ctx.businessId) },
      data: { manualRoles: '' },
    });
    // Still employed: keeps the roles of the grade (leaving goes through the register).
    const role = await syncMemberRoles(prisma, auth.ctx.businessId, userId);

    return { status: 200, data: { keptByGrade: role !== '' } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du membre');
  }
}

export async function searchUsersForBusinessInvite(businessSlug: string, query: string) {
  const auth = await requireBusinessAdminContext(businessSlug);
  if (!auth.ok) {
    return { status: auth.status, error: auth.error };
  }

  const q = query.trim();
  if (q.length < 2) {
    return { status: 200, data: [] };
  }

  const users = await applyBusinessNamesToUsers(
    prisma,
    auth.ctx.businessId,
    new Map((await searchAuthUsers(q)).map((user) => [user.id, user])),
  );

  return {
    status: 200,
    data: [...users.values()].map((user) => ({ id: user.id, name: user.name })),
  };
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function upsertBusinessMember(
  ...args: Parameters<typeof upsertBusinessMemberUnlogged>
) {
  return loggedAction(
    {
      feature: 'settings',
      event: 'dispensaryMembers.upsertDispensaryMember',
      target: ([, data]) => data.userId,
    },
    args,
    () => upsertBusinessMemberUnlogged(...args),
  );
}

export async function removeBusinessMember(
  ...args: Parameters<typeof removeBusinessMemberUnlogged>
) {
  return loggedAction(
    { feature: 'settings', event: 'dispensaryMembers.removeDispensaryMember' },
    args,
    () => removeBusinessMemberUnlogged(...args),
  );
}
