'use server';

import { PAYROLL_EMPLOYEE_ROLES } from '@/lib/dispensaryDiscordProfile/constants';
import { Prisma } from '@prisma/client';
import { z } from 'zod/v3';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { withLoggedAction } from '@/lib/logs/writer';
import { can } from '@lawless-intranet/auth-permissions';
import {
  canEditAllWeeklyDispensaryActivity,
  canEditWeeklyActivity,
  canViewWeeklyDispensaryActivity,
  isWeeklyActivityOwner,
  weeklyActivityWhereForViewer,
} from '@/lib/dispensaryWeeklyActivity/access';
import {
  genericDoctorFallbackName,
  getDiscordAccountIdForUser,
  getDiscordAccountIdsForUsers,
  getLatestDiscordDisplayNames,
  mergeResolvedDisplayNames,
} from '@/lib/dispensaryWeeklyActivity/resolveDisplayName';
import { fetchUserProfiles } from '@/lib/authUsers';
import { listSerializedWeeklyActivities } from '@/lib/dispensaryWeeklyActivity/listSerialized';
import {
  dispensaryWeeklyActivityCreateSchema,
  dispensaryWeeklyActivityMetricsSchema,
  dispensaryWeeklyActivityUpdateSchema,
} from '@/lib/dispensaryWeeklyActivity/schemas';
import {
  createDispensaryWeeklyActivityWithHistory,
  deleteDispensaryWeeklyActivityWithHistory,
  findOrCreateDispensaryActivityForParisDay,
  findWeeklyActivityByDoctorAndPeriod,
  botMarkChestForParisToday,
  botMarkPresenceForParisRelativeDay,
  updateDispensaryWeeklyActivityWithHistory,
  WEEKLY_ACTIVITY_DUPLICATE_MESSAGE,
} from '@/lib/dispensaryWeeklyActivity/service';
import { loadSerializedWeeklyActivityByIdForDispensary } from '@/lib/dispensaryWeeklyActivity/loadSerializedRow';
import { attachDiscordProfilesToActivities } from '@/lib/dispensaryDiscordProfile/attachProfiles';
import {
  DiscordProfileConflictError,
  DiscordProfileNotFoundError,
  loadDiscordProfilesByIds,
  updateDiscordProfileFields,
} from '@/lib/dispensaryDiscordProfile/service';
import { pickProfileDisplayName } from '@/lib/people/displayName';
import { applyDispensaryNamesToUsers, resolveDiscordPersonName } from '@/lib/people/resolveNames';
import { accountIdOfDiscord } from '@/lib/people/accountLinks';
import { discordUserIdSchema } from '@/lib/people/discordId';
import {
  applyVisibilityToCreateInput,
  applyVisibilityToUpdateInput,
  botPatchFieldVisibilityError,
  botWeekdayFieldVisibilityError,
  weeklyActivityFieldVisibilityFromSettings,
} from '@/lib/dispensaryWeeklyActivity/fieldVisibility';
import { getAppSettings } from '@/lib/appSettings';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import {
  assertIntranetWeekdayFlagsEditAllowed,
  BotDayEditError,
} from '@/lib/dispensaryWeeklyActivity/botDayEdit';
import { parseWeekdayFlagsJson } from '@/lib/dispensaryWeeklyActivity/weekdayFlags';
import { buildWeekHoursRecapBundle } from '@/lib/dispensaryWeeklyActivity/weekHoursRecap';
import { getBankWeekBounds } from '@/lib/bankWeek';
import type { WeeklyActivityMutationMeta } from '@/lib/dispensaryWeeklyActivity/realtime/types';

const weeklyActivityMutationMetaSchema = z
  .object({
    originClientId: z.string().min(1).max(128).optional(),
  })
  .optional();

function parseMutationMeta(meta: unknown): WeeklyActivityMutationMeta | undefined {
  const parsed = weeklyActivityMutationMetaSchema.safeParse(meta);
  if (!parsed.success || !parsed.data?.originClientId) {
    return undefined;
  }
  return { originClientId: parsed.data.originClientId };
}

async function requireWeeklyActivityView(dispensarySlug: string) {
  const ctx = await requireTenantServerActionContext(dispensarySlug, {
    feature: 'weeklyDispensaryActivity',
  });
  if (!ctx.ok) {
    return { ok: false as const, response: ctx.response };
  }
  if (!canViewWeeklyDispensaryActivity(ctx.tenant.effectivePermissions)) {
    return { ok: false as const, response: { status: 403 as const, error: 'Permission refusée' } };
  }
  return { ok: true as const, session: ctx.session, tenant: ctx.tenant };
}

async function requireWeeklyActivityEdit(dispensarySlug: string) {
  const ctx = await requireTenantServerActionContext(dispensarySlug, {
    feature: 'weeklyDispensaryActivity',
  });
  if (!ctx.ok) {
    return { ok: false as const, response: ctx.response };
  }
  const perms = ctx.tenant.effectivePermissions;
  const allowed =
    can(perms, 'weekly_dispensary_activity', 'edit_all') ||
    can(perms, 'weekly_dispensary_activity', 'edit_own');
  if (!allowed) {
    return { ok: false as const, response: { status: 403 as const, error: 'Permission refusée' } };
  }
  return { ok: true as const, session: ctx.session, tenant: ctx.tenant };
}

export async function listDispensaryWeeklyActivities(
  dispensarySlug: string,
  options?: { periodStart: Date; periodEnd: Date },
) {
  try {
    const gate = await requireWeeklyActivityView(dispensarySlug);
    if (!gate.ok) {
      return gate.response;
    }
    const { session, tenant } = gate;
    const { dispensaryId } = tenant;

    const where = await weeklyActivityWhereForViewer(
      dispensaryId,
      session.user.id,
      tenant.effectivePermissions,
      options ? { periodStart: { lte: options.periodEnd }, periodEnd: { gte: options.periodStart } } : {},
    );

    const data = await listSerializedWeeklyActivities(where, dispensaryId);

    return {
      status: 200 as const,
      data,
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des activités');
  }
}

const idSchema = z.object({ id: z.string().uuid('ID invalide') });

const hoursRecapInputSchema = z.object({
  periodStart: z.coerce.date(),
  discordUserId: discordUserIdSchema.nullable().optional(),
});

export async function getDispensaryWeeklyHoursRecap(
  dispensarySlug: string,
  input: z.infer<typeof hoursRecapInputSchema>,
) {
  try {
    const gate = await requireWeeklyActivityView(dispensarySlug);
    if (!gate.ok) {
      return gate.response;
    }

    const parsed = hoursRecapInputSchema.safeParse(input);
    if (!parsed.success) {
      return { status: 400 as const, error: 'Paramètres invalides' };
    }

    const { dispensaryId } = gate.tenant;
    const { start: periodStart, end: periodEnd } = getBankWeekBounds(parsed.data.periodStart);
    const discordUserId = parsed.data.discordUserId ?? null;

    const where = await weeklyActivityWhereForViewer(
      dispensaryId,
      gate.session.user.id,
      gate.tenant.effectivePermissions,
      {
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
        ...(discordUserId ? { discordUserId } : {}),
      },
    );

    const activities = await prisma.dispensaryWeeklyActivity.findMany({ where });

    if (activities.length === 0) {
      return {
        status: 200 as const,
        data: buildWeekHoursRecapBundle({ periodStart, activities: [], history: [] }),
      };
    }

    // Same names as the table (fixed name first), sorted on the shown name.
    const withNames = (
      await attachDiscordProfilesToActivities(
        prisma,
        await mergeResolvedDisplayNames(prisma, dispensaryId, activities),
      )
    ).sort((a, b) => a.resolvedDisplayName.localeCompare(b.resolvedDisplayName, 'fr'));
    const activityIds = withNames.map((a) => a.id);

    const history = await prisma.dispensaryWeeklyActivityHistory.findMany({
      where: {
        activityId: { in: activityIds },
        action: { in: ['INCREMENT_PATIENTS', 'UPDATE_PRESENCE_DAYS', 'UPDATE'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    const data = buildWeekHoursRecapBundle({
      periodStart,
      activities: withNames.map((a) => ({
        id: a.id,
        displayName: a.resolvedDisplayName,
        discordUserId: a.discordUserId,
        periodStart: a.periodStart,
      })),
      history: history
        .filter((h): h is typeof h & { activityId: string } => Boolean(h.activityId))
        .map((h) => ({
          id: h.id,
          activityId: h.activityId,
          action: h.action,
          createdAt: h.createdAt,
          previousValues: h.previousValues,
          nextValues: h.nextValues,
        })),
    });

    return { status: 200 as const, data };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement du récap horaires');
  }
}

export async function getDispensaryWeeklyActivityHistory(
  dispensarySlug: string,
  input: z.infer<typeof idSchema>,
) {
  try {
    const gate = await requireWeeklyActivityView(dispensarySlug);
    if (!gate.ok) {
      return gate.response;
    }
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) {
      return { status: 400 as const, error: parsed.error.issues[0]?.message ?? 'ID invalide' };
    }

    const { dispensaryId } = gate.tenant;

    const activity = await prisma.dispensaryWeeklyActivity.findFirst({
      where: { id: parsed.data.id, ...tenantWhere(dispensaryId) },
    });
    if (!activity) {
      return { status: 404 as const, error: 'Activité introuvable' };
    }

    const perms = gate.tenant.effectivePermissions;
    const isAll = canEditAllWeeklyDispensaryActivity(perms);
    const own = await isWeeklyActivityOwner(prisma, gate.session.user.id, activity);
    if (!isAll && !own) {
      return { status: 403 as const, error: 'Permission refusée' };
    }

    const history = await prisma.dispensaryWeeklyActivityHistory.findMany({
      where: { activityId: parsed.data.id },
      orderBy: { createdAt: 'desc' },
    });

    const actorUserIdsWithoutDiscord = [
      ...new Set(
        history
          .filter((h) => h.actorUserId && !h.actorDiscordUserId)
          .map((h) => h.actorUserId as string),
      ),
    ];

    const [userIdToDiscordId, ssoActorProfiles] = await Promise.all([
      getDiscordAccountIdsForUsers(actorUserIdsWithoutDiscord),
      fetchUserProfiles([
        ...new Set(
          history
            .flatMap((h) => [h.actorUserId, h.actorImpersonatedById])
            .filter(Boolean) as string[],
        ),
      ]),
    ]);
    const actorProfiles = await applyDispensaryNamesToUsers(prisma, dispensaryId, ssoActorProfiles);

    const actorDiscordIds = new Set<string>();
    for (const h of history) {
      if (h.actorDiscordUserId) {
        actorDiscordIds.add(h.actorDiscordUserId);
        continue;
      }
      if (h.actorUserId) {
        const discordId = userIdToDiscordId.get(h.actorUserId);
        if (discordId) {
          actorDiscordIds.add(discordId);
        }
      }
    }

    const [discordIdToName, actorDiscordProfiles] = await Promise.all([
      getLatestDiscordDisplayNames(prisma, dispensaryId, [...actorDiscordIds]),
      loadDiscordProfilesByIds(prisma, dispensaryId, [...actorDiscordIds]),
    ]);

    return {
      status: 200 as const,
      data: history.map((h) => {
        const actorDiscordUserId =
          h.actorDiscordUserId ??
          (h.actorUserId ? userIdToDiscordId.get(h.actorUserId) ?? null : null);
        const actorResolvedName = actorDiscordUserId
          ? pickProfileDisplayName(
              actorDiscordProfiles.get(actorDiscordUserId),
              discordIdToName.get(actorDiscordUserId) ??
                genericDoctorFallbackName(actorDiscordUserId),
            )
          : null;

        return {
          id: h.id,
          action: h.action,
          source: h.source,
          actorUserName: h.actorUserId
            ? actorProfiles.get(h.actorUserId)?.name ?? null
            : null,
          actorDiscordUserId,
          actorResolvedName,
          /** Platform admin who acted as this person (impersonation), if any. */
          actorImpersonatedByName: h.actorImpersonatedById
            ? ssoActorProfiles.get(h.actorImpersonatedById)?.name ?? h.actorImpersonatedById
            : null,
          createdAt: h.createdAt.toISOString(),
          previousValues: h.previousValues,
          nextValues: h.nextValues,
        };
      }),
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement de l’historique');
  }
}

const createIntranetSchema = dispensaryWeeklyActivityMetricsSchema
  .merge(
    z.object({
      periodStart: z.coerce.date(),
      periodEnd: z.coerce.date(),
      /** Person (Discord id) of the row, with or without an account: edit-all only. */
      targetDiscordUserId: discordUserIdSchema.optional(),
      displayName: z.string().trim().min(1).max(200).optional(),
    }),
  )
  .refine((d) => d.periodEnd.getTime() >= d.periodStart.getTime(), {
    message: 'La fin de période doit être après le début',
    path: ['periodEnd'],
  });

export type WeeklyActivityTarget = {
  /** Discord id: the person. */
  id: string;
  /** Intranet account name, if any. */
  name: string | null;
  /** Name shown in the dispensary (fixed name first). */
  discordDisplayName: string;
  hasAccount: boolean;
};

/**
 * People an edit-all doctor can create a row for: the dispensary's people
 * (Gestion › Personnes, with or without an account) and its members with
 * Discord who have no profile yet. Not every Discord account of the platform.
 */
async function loadWeeklyActivityTargets(dispensaryId: string): Promise<WeeklyActivityTarget[]> {
  const [profiles, members] = await Promise.all([
    prisma.dispensaryDiscordProfile.findMany({
      where: { dispensaryId },
      select: { discordUserId: true, userId: true, fixedDisplayName: true, lastDisplayName: true },
    }),
    prisma.dispensaryMember.findMany({ where: { dispensaryId }, select: { userId: true } }),
  ]);
  const memberIds = members.map((m) => m.userId);
  const [accounts, memberDiscordIds] = await Promise.all([
    fetchUserProfiles([
      ...new Set([...memberIds, ...profiles.map((p) => p.userId).filter((id): id is string => Boolean(id))]),
    ]),
    getDiscordAccountIdsForUsers(memberIds),
  ]);

  const targets = new Map<string, WeeklyActivityTarget>();
  for (const profile of profiles) {
    const account = profile.userId ? accounts.get(profile.userId) : undefined;
    targets.set(profile.discordUserId, {
      id: profile.discordUserId,
      name: account?.name ?? null,
      discordDisplayName: pickProfileDisplayName(
        profile,
        account?.name ?? genericDoctorFallbackName(profile.discordUserId),
      ),
      hasAccount: Boolean(profile.userId),
    });
  }
  for (const [userId, discordUserId] of memberDiscordIds) {
    if (targets.has(discordUserId)) continue;
    const name = accounts.get(userId)?.name ?? null;
    targets.set(discordUserId, {
      id: discordUserId,
      name,
      discordDisplayName: name ?? genericDoctorFallbackName(discordUserId),
      hasAccount: true,
    });
  }
  return [...targets.values()].sort((a, b) =>
    a.discordDisplayName.localeCompare(b.discordDisplayName, 'fr', { sensitivity: 'base' }),
  );
}

export async function listDispensaryWeeklyActivityTargets(dispensarySlug: string) {
  try {
    const gate = await requireWeeklyActivityEdit(dispensarySlug);
    if (!gate.ok) {
      return gate.response;
    }
    if (!canEditAllWeeklyDispensaryActivity(gate.tenant.effectivePermissions)) {
      return { status: 403 as const, error: 'Permission refusée' };
    }

    const users = await loadWeeklyActivityTargets(gate.tenant.dispensaryId);
    return { status: 200 as const, data: { users } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des personnes');
  }
}

async function createDispensaryWeeklyActivityUnlogged(
  dispensarySlug: string,
  input: z.infer<typeof createIntranetSchema>,
  meta?: WeeklyActivityMutationMeta,
) {
  try {
    const gate = await requireWeeklyActivityEdit(dispensarySlug);
    if (!gate.ok) {
      return gate.response;
    }
    const parsed = createIntranetSchema.safeParse(input);
    if (!parsed.success) {
      return { status: 400 as const, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
    }
    const mutationMeta = parseMutationMeta(meta);

    const { session, tenant } = gate;
    const { dispensaryId } = tenant;
    const perms = tenant.effectivePermissions;
    const editAll = canEditAllWeeklyDispensaryActivity(perms);

    let discordUserId: string;
    const actorDiscordUserId = await getDiscordAccountIdForUser(prisma, session.user.id);

    if (!editAll) {
      if (!actorDiscordUserId) {
        return {
          status: 400 as const,
          error: 'Compte Discord requis pour créer une activité (liez Discord dans les paramètres).',
        };
      }
      discordUserId = actorDiscordUserId;
    } else {
      if (!parsed.data.targetDiscordUserId) {
        return { status: 400 as const, error: 'Sélectionnez une personne' };
      }
      const targets = await loadWeeklyActivityTargets(dispensaryId);
      if (!targets.some((t) => t.id === parsed.data.targetDiscordUserId)) {
        return {
          status: 400 as const,
          error: 'Cette personne n’est pas dans le dispensaire (ajoutez-la dans Gestion › Personnes).',
        };
      }
      discordUserId = parsed.data.targetDiscordUserId;
    }

    // The name typed in the modal, else the person's name in this dispensary.
    const displayName =
      (editAll ? parsed.data.displayName?.trim() : undefined) ||
      (await resolveDiscordPersonName(
        prisma,
        dispensaryId,
        discordUserId,
        genericDoctorFallbackName(discordUserId),
      ));
    const userIdForRow = (await accountIdOfDiscord(discordUserId)) ?? null;

    const validated = dispensaryWeeklyActivityCreateSchema.safeParse({
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      displayName,
      discordUserId,
      userId: userIdForRow,
      chestDays: parsed.data.chestDays,
      presenceDays: parsed.data.presenceDays,
      sherifCount: parsed.data.sherifCount,
      patientsCount: parsed.data.patientsCount,
      infusionsCount: parsed.data.infusionsCount,
      poppyMilkCount: parsed.data.poppyMilkCount,
    });
    if (!validated.success) {
      return { status: 400 as const, error: validated.error.issues[0]?.message ?? 'Données invalides' };
    }

    const settings = await getAppSettings(dispensaryId);
    const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
    const createInput = applyVisibilityToCreateInput(validated.data, visibility);

    const existing = await findWeeklyActivityByDoctorAndPeriod(
      prisma,
      dispensaryId,
      discordUserId,
      parsed.data.periodStart,
    );
    if (existing) {
      return { status: 409 as const, error: WEEKLY_ACTIVITY_DUPLICATE_MESSAGE };
    }

    const created = await createDispensaryWeeklyActivityWithHistory(createInput, {
      source: 'INTRANET',
      actorUserId: session.user.id,
      actorImpersonatedById: session.session?.impersonatedBy ?? null,
      actorDiscordUserId: actorDiscordUserId ?? null,
      dispensaryId,
      meta: mutationMeta,
    });

    return { status: 200 as const, data: { id: created.id } };
  } catch (error) {
    if (error instanceof Error && error.message === WEEKLY_ACTIVITY_DUPLICATE_MESSAGE) {
      return { status: 409 as const, error: error.message };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { status: 409 as const, error: WEEKLY_ACTIVITY_DUPLICATE_MESSAGE };
    }
    return actionErrorParser(error, 'Erreur lors de la création');
  }
}

async function updateDispensaryWeeklyActivityUnlogged(
  dispensarySlug: string,
  input: z.infer<typeof idSchema> & z.infer<typeof dispensaryWeeklyActivityUpdateSchema>,
  meta?: WeeklyActivityMutationMeta,
) {
  try {
    const gate = await requireWeeklyActivityEdit(dispensarySlug);
    if (!gate.ok) {
      return gate.response;
    }

    const parsedId = idSchema.safeParse({ id: input.id });
    if (!parsedId.success) {
      return { status: 400 as const, error: 'ID invalide' };
    }

    const body = { ...input };
    delete (body as { id?: string }).id;
    const parsedBody = dispensaryWeeklyActivityUpdateSchema.safeParse(body);
    if (!parsedBody.success) {
      return { status: 400 as const, error: parsedBody.error.issues[0]?.message ?? 'Données invalides' };
    }
    const mutationMeta = parseMutationMeta(meta);

    const { dispensaryId } = gate.tenant;

    const existing = await prisma.dispensaryWeeklyActivity.findFirst({
      where: { id: parsedId.data.id, ...tenantWhere(dispensaryId) },
    });
    if (!existing) {
      return { status: 404 as const, error: 'Activité introuvable' };
    }

    const allowed = await canEditWeeklyActivity(
      prisma,
      gate.session.user.id,
      gate.tenant.effectivePermissions,
      existing,
    );
    if (!allowed) {
      return { status: 403 as const, error: 'Permission refusée' };
    }

    const settings = await getAppSettings(dispensaryId);
    const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
    const updateInput = applyVisibilityToUpdateInput(parsedBody.data, visibility);
    const canEditAll = canEditAllWeeklyDispensaryActivity(gate.tenant.effectivePermissions);
    const existingChest = parseWeekdayFlagsJson(existing.chestDays);
    const existingPresence = parseWeekdayFlagsJson(existing.presenceDays);

    if (updateInput.chestDays) {
      assertIntranetWeekdayFlagsEditAllowed(
        existing.periodStart,
        existingChest,
        updateInput.chestDays,
        canEditAll,
      );
    }
    if (updateInput.presenceDays) {
      assertIntranetWeekdayFlagsEditAllowed(
        existing.periodStart,
        existingPresence,
        updateInput.presenceDays,
        canEditAll,
      );
    }

    const actorDiscordUserId = await getDiscordAccountIdForUser(prisma, gate.session.user.id);

    await updateDispensaryWeeklyActivityWithHistory(parsedId.data.id, updateInput, {
      source: 'INTRANET',
      actorUserId: gate.session.user.id,
      actorImpersonatedById: gate.session.session?.impersonatedBy ?? null,
      actorDiscordUserId: actorDiscordUserId ?? null,
      meta: mutationMeta,
    });

    return { status: 200 as const, data: { ok: true } };
  } catch (error) {
    if (error instanceof BotDayEditError) {
      return { status: 400 as const, error: error.message };
    }
    return actionErrorParser(error, 'Erreur lors de la mise à jour');
  }
}

async function deleteDispensaryWeeklyActivityUnlogged(
  dispensarySlug: string,
  input: z.infer<typeof idSchema>,
  meta?: WeeklyActivityMutationMeta,
) {
  try {
    const gate = await requireWeeklyActivityEdit(dispensarySlug);
    if (!gate.ok) {
      return gate.response;
    }

    const parsed = idSchema.safeParse(input);
    if (!parsed.success) {
      return { status: 400 as const, error: 'ID invalide' };
    }
    const mutationMeta = parseMutationMeta(meta);

    const { dispensaryId } = gate.tenant;

    const existing = await prisma.dispensaryWeeklyActivity.findFirst({
      where: { id: parsed.data.id, ...tenantWhere(dispensaryId) },
    });
    if (!existing) {
      return { status: 404 as const, error: 'Activité introuvable' };
    }

    const allowed = await canEditWeeklyActivity(
      prisma,
      gate.session.user.id,
      gate.tenant.effectivePermissions,
      existing,
    );
    if (!allowed) {
      return { status: 403 as const, error: 'Permission refusée' };
    }

    const actorDiscordUserId = await getDiscordAccountIdForUser(prisma, gate.session.user.id);

    await deleteDispensaryWeeklyActivityWithHistory(parsed.data.id, {
      source: 'INTRANET',
      actorUserId: gate.session.user.id,
      actorImpersonatedById: gate.session.session?.impersonatedBy ?? null,
      actorDiscordUserId: actorDiscordUserId ?? null,
      meta: mutationMeta,
    });

    return { status: 200 as const, data: { ok: true } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression');
  }
}

const weeklyCounterFieldSchema = z.enum([
  'sherifCount',
  'patientsCount',
  'infusionsCount',
  'poppyMilkCount',
]);

async function requireOwnDiscordUserId(
  sessionUserId: string,
): Promise<{ ok: true; discordUserId: string } | { ok: false; response: { status: 400; error: string } }> {
  const discordUserId = await getDiscordAccountIdForUser(prisma, sessionUserId);
  if (!discordUserId) {
    return {
      ok: false,
      response: {
        status: 400 as const,
        error: 'Compte Discord requis (liez Discord dans les paramètres).',
      },
    };
  }
  return { ok: true, discordUserId };
}

async function serializeQuickActionRow(dispensaryId: string, activityId: string) {
  const row = await loadSerializedWeeklyActivityByIdForDispensary(activityId, dispensaryId);
  if (!row) {
    throw new Error('Activité introuvable après mise à jour');
  }
  return row;
}

async function markOwnWeeklyChestTodayUnlogged(
  dispensarySlug: string,
  meta?: WeeklyActivityMutationMeta,
) {
  try {
    const gate = await requireWeeklyActivityEdit(dispensarySlug);
    if (!gate.ok) {
      return gate.response;
    }

    const discordGate = await requireOwnDiscordUserId(gate.session.user.id);
    if (!discordGate.ok) {
      return discordGate.response;
    }

    const { dispensaryId } = gate.tenant;
    const settings = await getAppSettings(dispensaryId);
    const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
    const visibilityError = botWeekdayFieldVisibilityError('chest', visibility);
    if (visibilityError) {
      return { status: 403 as const, error: visibilityError };
    }

    const mutationMeta = parseMutationMeta(meta);
    const result = await botMarkChestForParisToday(dispensaryId, discordGate.discordUserId, {
      meta: mutationMeta,
      initiator: {
        source: 'INTRANET',
        actorUserId: gate.session.user.id,
        actorImpersonatedById: gate.session.session?.impersonatedBy ?? null,
      },
    });

    const row = await serializeQuickActionRow(dispensaryId, result.activity.id);
    if (result.outcome === 'already_done') {
      return {
        status: 200 as const,
        data: { row, alreadyDone: true as const, message: result.message },
      };
    }
    return { status: 200 as const, data: { row, alreadyDone: false as const } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de l’enregistrement de la caisse');
  }
}

async function markOwnWeeklyPresenceTodayUnlogged(
  dispensarySlug: string,
  meta?: WeeklyActivityMutationMeta,
) {
  try {
    const gate = await requireWeeklyActivityEdit(dispensarySlug);
    if (!gate.ok) {
      return gate.response;
    }

    const discordGate = await requireOwnDiscordUserId(gate.session.user.id);
    if (!discordGate.ok) {
      return discordGate.response;
    }

    const { dispensaryId } = gate.tenant;
    const settings = await getAppSettings(dispensaryId);
    const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
    const visibilityError = botWeekdayFieldVisibilityError('presence', visibility);
    if (visibilityError) {
      return { status: 403 as const, error: visibilityError };
    }

    const mutationMeta = parseMutationMeta(meta);
    const result = await botMarkPresenceForParisRelativeDay(
      dispensaryId,
      discordGate.discordUserId,
      'today',
      {
        meta: mutationMeta,
        initiator: {
        source: 'INTRANET',
        actorUserId: gate.session.user.id,
        actorImpersonatedById: gate.session.session?.impersonatedBy ?? null,
      },
      },
    );

    const row = await serializeQuickActionRow(dispensaryId, result.activity.id);
    if (result.outcome === 'already_done') {
      return {
        status: 200 as const,
        data: { row, alreadyDone: true as const, message: result.message },
      };
    }
    return { status: 200 as const, data: { row, alreadyDone: false as const } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de l’enregistrement de la présence');
  }
}

async function incrementOwnWeeklyCounterUnlogged(
  dispensarySlug: string,
  input: { field: z.infer<typeof weeklyCounterFieldSchema> },
  meta?: WeeklyActivityMutationMeta,
) {
  try {
    const gate = await requireWeeklyActivityEdit(dispensarySlug);
    if (!gate.ok) {
      return gate.response;
    }

    const parsed = weeklyCounterFieldSchema.safeParse(input.field);
    if (!parsed.success) {
      return { status: 400 as const, error: 'Compteur invalide' };
    }

    const discordGate = await requireOwnDiscordUserId(gate.session.user.id);
    if (!discordGate.ok) {
      return discordGate.response;
    }

    const { dispensaryId } = gate.tenant;
    const settings = await getAppSettings(dispensaryId);
    const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
    const visibilityError = botPatchFieldVisibilityError(
      { [parsed.data]: 0 },
      visibility,
    );
    if (visibilityError) {
      return { status: 403 as const, error: visibilityError };
    }

    const mutationMeta = parseMutationMeta(meta);
    const existing = await findOrCreateDispensaryActivityForParisDay(
      prisma,
      dispensaryId,
      discordGate.discordUserId,
      new Date(),
      // An existing row keeps its name; a new one takes the latest name known here.
      undefined,
      {
        source: 'INTRANET',
        actorUserId: gate.session.user.id,
        actorImpersonatedById: gate.session.session?.impersonatedBy ?? null,
      },
    );

    const currentValue = existing[parsed.data];
    const actorDiscordUserId = discordGate.discordUserId;

    await updateDispensaryWeeklyActivityWithHistory(
      existing.id,
      { [parsed.data]: currentValue + 1 },
      {
        source: 'INTRANET',
        actorUserId: gate.session.user.id,
        actorImpersonatedById: gate.session.session?.impersonatedBy ?? null,
        actorDiscordUserId,
        meta: mutationMeta,
      },
    );

    const row = await serializeQuickActionRow(dispensaryId, existing.id);
    return { status: 200 as const, data: { row } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de l’incrémentation');
  }
}

const updateDiscordProfileSchema = z.object({
  discordUserId: discordUserIdSchema,
  fixedDisplayName: z.string().max(200).nullable().optional(),
  role: z.enum(PAYROLL_EMPLOYEE_ROLES).nullable().optional(),
  accountNumber: z.number().int().min(1).max(999999).nullable().optional(),
});

/** Name, grade and account number feed the payroll: edit-all only. */
async function updateDispensaryDiscordProfileUnlogged(
  dispensarySlug: string,
  input: z.infer<typeof updateDiscordProfileSchema>,
) {
  try {
    const gate = await requireWeeklyActivityEdit(dispensarySlug);
    if (!gate.ok) {
      return gate.response;
    }
    if (!canEditAllWeeklyDispensaryActivity(gate.tenant.effectivePermissions)) {
      return {
        status: 403 as const,
        error: 'Permission refusée : le grade et le n° de compte sont modifiés par la direction',
      };
    }

    const parsed = updateDiscordProfileSchema.safeParse(input);
    if (!parsed.success) {
      return { status: 400 as const, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
    }

    const profile = await updateDiscordProfileFields(prisma, {
      dispensaryId: gate.tenant.dispensaryId,
      discordUserId: parsed.data.discordUserId,
      fixedDisplayName: parsed.data.fixedDisplayName,
      role: parsed.data.role,
      accountNumber: parsed.data.accountNumber,
    });

    return { status: 200 as const, data: profile };
  } catch (error) {
    if (error instanceof DiscordProfileNotFoundError) {
      return { status: 404 as const, error: error.message };
    }
    if (error instanceof DiscordProfileConflictError) {
      return { status: 409 as const, error: error.message };
    }
    return actionErrorParser(error, 'Erreur lors de la mise à jour du profil Discord');
  }
}

/*
 * Sensitive feature: every mutation is logged (success, refusal, failure), see docs/APP-LOGS.md.
 */
const WEEKLY_ACTIVITY_LOG = 'weeklyDispensaryActivity' as const;

type QuickActionResult = Awaited<ReturnType<typeof markOwnWeeklyChestTodayUnlogged>>;

/** Already ticked: logged as "nothing to do", with the message shown to the user. */
function describeQuickAction(result: QuickActionResult) {
  if (result.status !== 200 || !('data' in result) || !result.data) return undefined;
  const { alreadyDone, row } = result.data;
  return {
    outcome: alreadyDone ? ('noop' as const) : ('success' as const),
    context: { alreadyDone, activityId: row.id },
    targetId: row.id,
  };
}

export async function createDispensaryWeeklyActivity(
  dispensarySlug: string,
  input: z.infer<typeof createIntranetSchema>,
  meta?: WeeklyActivityMutationMeta,
) {
  return withLoggedAction(
    {
      feature: WEEKLY_ACTIVITY_LOG,
      event: 'weeklyActivity.create',
      label: 'Création d’une activité hebdo',
      context: input,
    },
    () => createDispensaryWeeklyActivityUnlogged(dispensarySlug, input, meta),
  );
}

export async function updateDispensaryWeeklyActivity(
  dispensarySlug: string,
  input: z.infer<typeof idSchema> & z.infer<typeof dispensaryWeeklyActivityUpdateSchema>,
  meta?: WeeklyActivityMutationMeta,
) {
  return withLoggedAction(
    {
      feature: WEEKLY_ACTIVITY_LOG,
      event: 'weeklyActivity.update',
      label: 'Modification d’une activité hebdo',
      context: input,
    },
    () => updateDispensaryWeeklyActivityUnlogged(dispensarySlug, input, meta),
  );
}

export async function deleteDispensaryWeeklyActivity(
  dispensarySlug: string,
  input: z.infer<typeof idSchema>,
  meta?: WeeklyActivityMutationMeta,
) {
  return withLoggedAction(
    {
      feature: WEEKLY_ACTIVITY_LOG,
      event: 'weeklyActivity.delete',
      label: 'Suppression d’une activité hebdo',
      context: input,
    },
    () => deleteDispensaryWeeklyActivityUnlogged(dispensarySlug, input, meta),
  );
}

export async function markOwnWeeklyChestToday(
  dispensarySlug: string,
  meta?: WeeklyActivityMutationMeta,
) {
  return withLoggedAction(
    {
      feature: WEEKLY_ACTIVITY_LOG,
      event: 'weeklyActivity.chest.mark',
      label: 'Caisse du jour (intranet)',
    },
    () => markOwnWeeklyChestTodayUnlogged(dispensarySlug, meta),
    describeQuickAction,
  );
}

export async function markOwnWeeklyPresenceToday(
  dispensarySlug: string,
  meta?: WeeklyActivityMutationMeta,
) {
  return withLoggedAction(
    {
      feature: WEEKLY_ACTIVITY_LOG,
      event: 'weeklyActivity.presence.mark',
      label: 'Présence du jour (intranet)',
    },
    () => markOwnWeeklyPresenceTodayUnlogged(dispensarySlug, meta),
    describeQuickAction,
  );
}

export async function incrementOwnWeeklyCounter(
  dispensarySlug: string,
  input: { field: z.infer<typeof weeklyCounterFieldSchema> },
  meta?: WeeklyActivityMutationMeta,
) {
  return withLoggedAction(
    {
      feature: WEEKLY_ACTIVITY_LOG,
      event: 'weeklyActivity.counter.increment',
      label: 'Compteur hebdo +1 (intranet)',
      context: input,
    },
    () => incrementOwnWeeklyCounterUnlogged(dispensarySlug, input, meta),
    (result) => ('data' in result ? { targetId: result.data.row.id } : undefined),
  );
}

export async function updateDispensaryDiscordProfile(
  dispensarySlug: string,
  input: z.infer<typeof updateDiscordProfileSchema>,
) {
  return withLoggedAction(
    {
      feature: WEEKLY_ACTIVITY_LOG,
      event: 'weeklyActivity.discordProfile.update',
      label: 'Modification d’un profil Discord',
      context: input,
    },
    () => updateDispensaryDiscordProfileUnlogged(dispensarySlug, input),
  );
}
