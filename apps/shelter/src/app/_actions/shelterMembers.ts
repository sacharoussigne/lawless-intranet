'use server';

import prisma from '@/lib/prisma';
import { z } from 'zod';
import { actionErrorParser } from '@/lib/action';
import { requireShelterAdminContext } from '@/lib/shelter/serverActionContext';
import { tenantWhere } from '@/lib/shelter/tenantWhere';
import { SHELTER_MEMBER_ROLES, serializeRoleList } from '@/types/enum/roles';
import {
  attachUserProfiles,
  fetchUserProfile,
  fetchUserProfiles,
  searchAuthUsers,
} from '@/lib/authUsers';

const shelterRoleEnum = z.enum(SHELTER_MEMBER_ROLES);

const upsertMemberSchema = z.object({
  userId: z.string().min(1),
  roles: z.array(shelterRoleEnum).min(1, 'Au moins un rôle est requis'),
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

export async function listShelterMembers(shelterSlug: string) {
  const auth = await requireShelterAdminContext(shelterSlug);
  if (!auth.ok) {
    return { status: auth.status, error: auth.error };
  }

  const members = await prisma.shelterMember.findMany({
    where: { shelterId: auth.ctx.shelterId },
    orderBy: { createdAt: 'asc' },
  });

  const usersById = await fetchUserProfiles(members.map((member) => member.userId));
  const enriched = attachUserProfiles(members, usersById).sort((a, b) =>
    (a.user?.name ?? a.userId).localeCompare(b.user?.name ?? b.userId, 'fr'),
  );

  return { status: 200, data: enriched };
}

export async function upsertShelterMember(
  shelterSlug: string,
  data: {
    userId: string;
    roles: z.infer<typeof shelterRoleEnum>[];
    description?: string | null;
  },
) {
  try {
    const auth = await requireShelterAdminContext(shelterSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = upsertMemberSchema.parse(data);
    const user = await fetchUserProfile(validated.userId);
    if (!user) {
      return { status: 404, error: 'Utilisateur introuvable' };
    }

    const role = serializeRoleList(validated.roles);
    const descriptionProvided = validated.description !== undefined;

    const member = await prisma.shelterMember.upsert({
      where: {
        shelterId_userId: {
          shelterId: auth.ctx.shelterId,
          userId: validated.userId,
        },
      },
      create: {
        shelterId: auth.ctx.shelterId,
        userId: validated.userId,
        role,
        description: validated.description ?? null,
      },
      update: {
        role,
        ...(descriptionProvided ? { description: validated.description ?? null } : {}),
      },
    });

    return { status: 200, data: member };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour du membre');
  }
}

export async function removeShelterMember(shelterSlug: string, userId: string) {
  try {
    const auth = await requireShelterAdminContext(shelterSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    await prisma.shelterMember.deleteMany({
      where: {
        userId,
        ...tenantWhere(auth.ctx.shelterId),
      },
    });

    return { status: 200 };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du membre');
  }
}

export async function searchUsersForShelterInvite(shelterSlug: string, query: string) {
  const auth = await requireShelterAdminContext(shelterSlug);
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
