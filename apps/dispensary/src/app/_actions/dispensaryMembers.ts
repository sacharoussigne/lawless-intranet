'use server';

import prisma from '@/lib/prisma';
import { z } from 'zod';
import { actionErrorParser } from '@/lib/action';
import { requireDispensaryAdminContext } from '@/lib/dispensary/serverActionContext';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { DISPENSARY_MEMBER_ROLES, serializeRoleList } from '@/types/enum/roles';
import {
  attachUserProfiles,
  fetchUserProfile,
  fetchUserProfiles,
  searchAuthUsers,
} from '@/lib/authUsers';

const dispensaryRoleEnum = z.enum(DISPENSARY_MEMBER_ROLES);

const upsertMemberSchema = z.object({
  userId: z.string().min(1),
  roles: z.array(dispensaryRoleEnum).min(1, 'Au moins un rôle est requis'),
});

export async function listDispensaryMembers(dispensarySlug: string) {
  const auth = await requireDispensaryAdminContext(dispensarySlug);
  if (!auth.ok) {
    return { status: auth.status, error: auth.error };
  }

  const members = await prisma.dispensaryMember.findMany({
    where: { dispensaryId: auth.ctx.dispensaryId },
    orderBy: { createdAt: 'asc' },
  });

  const usersById = await fetchUserProfiles(members.map((member) => member.userId));
  const enriched = attachUserProfiles(members, usersById).sort((a, b) =>
    (a.user?.name ?? a.userId).localeCompare(b.user?.name ?? b.userId, 'fr'),
  );

  return { status: 200, data: enriched };
}

export async function upsertDispensaryMember(
  dispensarySlug: string,
  data: { userId: string; roles: z.infer<typeof dispensaryRoleEnum>[] },
) {
  try {
    const auth = await requireDispensaryAdminContext(dispensarySlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = upsertMemberSchema.parse(data);
    const user = await fetchUserProfile(validated.userId);
    if (!user) {
      return { status: 404, error: 'Utilisateur introuvable' };
    }

    const role = serializeRoleList(validated.roles);

    const member = await prisma.dispensaryMember.upsert({
      where: {
        dispensaryId_userId: {
          dispensaryId: auth.ctx.dispensaryId,
          userId: validated.userId,
        },
      },
      create: {
        dispensaryId: auth.ctx.dispensaryId,
        userId: validated.userId,
        role,
      },
      update: { role },
    });

    return { status: 200, data: member };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour du membre');
  }
}

export async function removeDispensaryMember(dispensarySlug: string, userId: string) {
  try {
    const auth = await requireDispensaryAdminContext(dispensarySlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    await prisma.dispensaryMember.deleteMany({
      where: {
        userId,
        ...tenantWhere(auth.ctx.dispensaryId),
      },
    });

    return { status: 200 };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du membre');
  }
}

export async function searchUsersForDispensaryInvite(dispensarySlug: string, query: string) {
  const auth = await requireDispensaryAdminContext(dispensarySlug);
  if (!auth.ok) {
    return { status: auth.status, error: auth.error };
  }

  const q = query.trim();
  if (q.length < 2) {
    return { status: 200, data: [] };
  }

  const users = await searchAuthUsers(q);

  return {
    status: 200,
    data: users.map((user) => ({ id: user.id, name: user.name })),
  };
}
