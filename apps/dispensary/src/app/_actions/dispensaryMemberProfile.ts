'use server';

import prisma from '@/lib/prisma';
import { z } from 'zod';
import { actionErrorParser } from '@/lib/action';
import { requireSession } from '@/lib/serverActionAuth';
import { requireDispensaryFromSlug, userCanAccessDispensary } from '@/lib/dispensary/context';

const updateGradeSchema = z.object({
  description: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .transform((value) => {
      if (value === undefined || value === null) return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
});

export async function listMyDispensaryGrades() {
  const ctx = await requireSession();
  if (!ctx.ok) {
    return ctx.response;
  }

  const userId = ctx.session.user.id;
  const members = await prisma.dispensaryMember.findMany({
    where: { userId },
    select: {
      description: true,
      dispensary: {
        select: { id: true, slug: true, name: true },
      },
    },
    orderBy: { dispensary: { name: 'asc' } },
  });

  return {
    status: 200,
    data: members.map((member) => ({
      dispensaryId: member.dispensary.id,
      dispensarySlug: member.dispensary.slug,
      dispensaryName: member.dispensary.name,
      description: member.description,
    })),
  };
}

export async function updateMyDispensaryGrade(
  dispensarySlug: string,
  data: { description?: string | null },
) {
  try {
    const ctx = await requireSession();
    if (!ctx.ok) {
      return ctx.response;
    }

    const dispensary = await requireDispensaryFromSlug(dispensarySlug);
    const canAccess = await userCanAccessDispensary(ctx.session, dispensary.id);
    if (!canAccess) {
      return { status: 403, error: 'Accès refusé' };
    }

    const validated = updateGradeSchema.parse(data);
    const userId = ctx.session.user.id;

    const member = await prisma.dispensaryMember.update({
      where: {
        dispensaryId_userId: {
          dispensaryId: dispensary.id,
          userId,
        },
      },
      data: { description: validated.description },
      select: { description: true },
    });

    return { status: 200, data: member };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour du grade');
  }
}
