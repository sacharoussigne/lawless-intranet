'use server';

import { loggedAction } from '@/lib/logs/writer';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { actionErrorParser } from '@/lib/action';
import { requireSession } from '@/lib/serverActionAuth';
import { requireBusinessFromSlug, userCanAccessBusiness } from '@/lib/business/context';

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

export async function listMyBusinessGrades() {
  const ctx = await requireSession();
  if (!ctx.ok) {
    return ctx.response;
  }

  const userId = ctx.session.user.id;
  const members = await prisma.businessMember.findMany({
    where: { userId },
    select: {
      description: true,
      business: {
        select: { id: true, slug: true, name: true },
      },
    },
    orderBy: { business: { name: 'asc' } },
  });

  return {
    status: 200,
    data: members.map((member) => ({
      businessId: member.business.id,
      businessSlug: member.business.slug,
      businessName: member.business.name,
      description: member.description,
    })),
  };
}

async function updateMyBusinessGradeUnlogged(
  businessSlug: string,
  data: { description?: string | null },
) {
  try {
    const ctx = await requireSession();
    if (!ctx.ok) {
      return ctx.response;
    }

    const business = await requireBusinessFromSlug(businessSlug);
    const canAccess = await userCanAccessBusiness(ctx.session, business.id);
    if (!canAccess) {
      return { status: 403, error: 'Accès refusé' };
    }

    const validated = updateGradeSchema.parse(data);
    const userId = ctx.session.user.id;

    const member = await prisma.businessMember.update({
      where: {
        businessId_userId: {
          businessId: business.id,
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

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function updateMyBusinessGrade(
  ...args: Parameters<typeof updateMyBusinessGradeUnlogged>
) {
  return loggedAction(
    { feature: 'settings', event: 'dispensaryMemberProfile.updateMyDispensaryGrade' },
    args,
    () => updateMyBusinessGradeUnlogged(...args),
  );
}
