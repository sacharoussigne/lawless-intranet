'use server';

import { PAYROLL_EMPLOYEE_ROLES } from '@/lib/businessDiscordProfile/constants';
import { Prisma } from '@prisma/client';
import { z } from 'zod/v3';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { withLoggedAction } from '@/lib/logs/writer';
import { can } from '@lawless-intranet/auth-permissions';
import {
  canEditAllWeeklyActivity,
  canEditWeeklyActivity,
  canViewWeeklyActivity,
  isWeeklyActivityOwner,
  weeklyActivityWhereForViewer,
} from '@/lib/businessWeeklyActivity/access';
import {
  genericDoctorFallbackName,
  getDiscordAccountIdForUser,
  getDiscordAccountIdsForUsers,
  getLatestDiscordDisplayNames,
  mergeResolvedDisplayNames,
} from '@/lib/businessWeeklyActivity/resolveDisplayName';
import { fetchUserProfiles } from '@/lib/authUsers';
import { listSerializedWeeklyActivities } from '@/lib/businessWeeklyActivity/listSerialized';
import { attachViewerSalaryEstimates } from '@/lib/payroll/botSalaryEstimate';
import {
  businessWeeklyActivityCreateSchema,
  businessWeeklyActivityMetricsSchema,
  businessWeeklyActivityUpdateSchema,
} from '@/lib/businessWeeklyActivity/schemas';
import {
  createBusinessWeeklyActivityWithHistory,
  deleteBusinessWeeklyActivityWithHistory,
  findOrCreateBusinessActivityForParisDay,
  findWeeklyActivityByDoctorAndPeriod,
  botMarkChestForParisToday,
  botMarkPresenceForParisRelativeDay,
  updateBusinessWeeklyActivityWithHistory,
  WEEKLY_ACTIVITY_DUPLICATE_MESSAGE,
} from '@/lib/businessWeeklyActivity/service';
import { loadSerializedWeeklyActivityByIdForBusiness } from '@/lib/businessWeeklyActivity/loadSerializedRow';
import { attachDiscordProfilesToActivities } from '@/lib/businessDiscordProfile/attachProfiles';
import {
  DiscordProfileConflictError,
  DiscordProfileNotFoundError,
  loadDiscordProfilesByIds,
  updateDiscordProfileFields,
  personInBusiness,
} from '@/lib/businessDiscordProfile/service';
import { pickProfileDisplayName } from '@/lib/people/displayName';
import { applyBusinessNamesToUsers, resolveDiscordPersonName } from '@/lib/people/resolveNames';
import { accountIdOfDiscord } from '@/lib/people/accountLinks';
import { discordUserIdSchema } from '@/lib/people/discordId';
import {
  applyVisibilityToCreateInput,
  applyVisibilityToUpdateInput,
  isWeeklyCounterVisible,
  botWeekdayFieldVisibilityError,
  weeklyActivityFieldVisibilityFromSettings,
} from '@/lib/businessWeeklyActivity/fieldVisibility';
import { getAppSettings } from '@/lib/appSettings';
import {
  parseWeeklyCounters,
  weeklyCounterDefinitions,
  weeklyCounterValue,
} from '@/lib/businessWeeklyActivity/counters';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { isWeekLocked, PAST_WEEK_LOCKED_MESSAGE } from '@/lib/businessWeeklyActivity/weekLock';
import { tenantWhere } from '@/lib/business/tenantWhere';
import {
  assertIntranetWeekdayFlagsEditAllowed,
  BotDayEditError,
} from '@/lib/businessWeeklyActivity/botDayEdit';
import { parseWeekdayFlagsJson } from '@/lib/businessWeeklyActivity/weekdayFlags';
import { buildWeekHoursRecapBundle } from '@/lib/businessWeeklyActivity/weekHoursRecap';
import { getBankWeekBounds } from '@/lib/bankWeek';
import type { WeeklyActivityMutationMeta } from '@/lib/businessWeeklyActivity/realtime/types';

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

async function requireWeeklyActivityView(businessSlug: string) {
  const ctx = await requireTenantServerActionContext(businessSlug, {
    feature: 'weeklyActivity',
  });
  if (!ctx.ok) {
    return { ok: false as const, response: ctx.response };
  }
  if (!canViewWeeklyActivity(ctx.tenant.effectivePermissions)) {
    return { ok: false as const, response: { status: 403 as const, error: 'Permission refusée' } };
  }
  return { ok: true as const, session: ctx.session, tenant: ctx.tenant };
}

async function requireWeeklyActivityEdit(businessSlug: string) {
  const ctx = await requireTenantServerActionContext(businessSlug, {
    feature: 'weeklyActivity',
  });
  if (!ctx.ok) {
    return { ok: false as const, response: ctx.response };
  }
  const perms = ctx.tenant.effectivePermissions;
  const allowed =
    can(perms, 'weekly_activity', 'edit_all') ||
    can(perms, 'weekly_activity', 'edit_own');
  if (!allowed) {
    return { ok: false as const, response: { status: 403 as const, error: 'Permission refusée' } };
  }
  return { ok: true as const, session: ctx.session, tenant: ctx.tenant };
}

/** Caisse button: `mark_chest_own` (préparateur de caisses) or any edit right. */
async function requireWeeklyChestMark(businessSlug: string) {
  const ctx = await requireTenantServerActionContext(businessSlug, {
    feature: 'weeklyActivity',
  });
  if (!ctx.ok) {
    return { ok: false as const, response: ctx.response };
  }
  const perms = ctx.tenant.effectivePermissions;
  const allowed =
    can(perms, 'weekly_activity', 'mark_chest_own') ||
    can(perms, 'weekly_activity', 'edit_all') ||
    can(perms, 'weekly_activity', 'edit_own');
  if (!allowed) {
    return { ok: false as const, response: { status: 403 as const, error: 'Permission refusée' } };
  }
  return { ok: true as const, session: ctx.session, tenant: ctx.tenant };
}

export async function listBusinessWeeklyActivities(
  businessSlug: string,
  options?: { periodStart: Date; periodEnd: Date },
) {
  try {
    const gate = await requireWeeklyActivityView(businessSlug);
    if (!gate.ok) {
      return gate.response;
    }
    const { session, tenant } = gate;
    const { businessId } = tenant;

    const where = await weeklyActivityWhereForViewer(
      businessId,
      session.user.id,
      tenant.effectivePermissions,
      options ? { periodStart: { lte: options.periodEnd }, periodEnd: { gte: options.periodStart } } : {},
    );

    const rows = await listSerializedWeeklyActivities(where, businessId);
    const data = await attachViewerSalaryEstimates(businessId, tenant.business.type, rows, {
      sessionUserId: session.user.id,
      discordUserId: await getDiscordAccountIdForUser(prisma, session.user.id),
      // The home team list (edit_all) shows everyone's estimate, like the bot's recap for the Direction.
      all: can(tenant.effectivePermissions, 'weekly_activity', 'edit_all'),
    });

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

export async function getBusinessWeeklyHoursRecap(
  businessSlug: string,
  input: z.infer<typeof hoursRecapInputSchema>,
) {
  try {
    const gate = await requireWeeklyActivityView(businessSlug);
    if (!gate.ok) {
      return gate.response;
    }

    const parsed = hoursRecapInputSchema.safeParse(input);
    if (!parsed.success) {
      return { status: 400 as const, error: 'Paramètres invalides' };
    }

    const { businessId } = gate.tenant;
    const { start: periodStart, end: periodEnd } = getBankWeekBounds(parsed.data.periodStart);
    const discordUserId = parsed.data.discordUserId ?? null;

    const where = await weeklyActivityWhereForViewer(
      businessId,
      gate.session.user.id,
      gate.tenant.effectivePermissions,
      {
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
        ...(discordUserId ? { discordUserId } : {}),
      },
    );

    const activities = await prisma.businessWeeklyActivity.findMany({ where });

    if (activities.length === 0) {
      return {
        status: 200 as const,
        data: buildWeekHoursRecapBundle({
          periodStart,
          activities: [],
          history: [],
          signalCounterKeys: [],
        }),
      };
    }

    // Same names as the table (fixed name first), sorted on the shown name.
    const withNames = (
      await attachDiscordProfilesToActivities(
        prisma,
        await mergeResolvedDisplayNames(prisma, businessId, activities),
      )
    ).sort((a, b) => a.resolvedDisplayName.localeCompare(b.resolvedDisplayName, 'fr'));
    const activityIds = withNames.map((a) => a.id);

    const history = await prisma.businessWeeklyActivityHistory.findMany({
      where: {
        activityId: { in: activityIds },
        action: { in: ['INCREMENT_COUNTER', 'UPDATE_PRESENCE_DAYS', 'UPDATE'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    const data = buildWeekHoursRecapBundle({
      periodStart,
      signalCounterKeys: weeklyCounterDefinitions(gate.tenant.business.type)
        .filter((c) => c.hoursSignal)
        .map((c) => c.key),
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
          counterKey: h.counterKey,
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

export async function getBusinessWeeklyActivityHistory(
  businessSlug: string,
  input: z.infer<typeof idSchema>,
) {
  try {
    const gate = await requireWeeklyActivityView(businessSlug);
    if (!gate.ok) {
      return gate.response;
    }
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) {
      return { status: 400 as const, error: parsed.error.issues[0]?.message ?? 'ID invalide' };
    }

    const { businessId } = gate.tenant;

    const activity = await prisma.businessWeeklyActivity.findFirst({
      where: { id: parsed.data.id, ...tenantWhere(businessId) },
    });
    if (!activity) {
      return { status: 404 as const, error: 'Activité introuvable' };
    }

    const perms = gate.tenant.effectivePermissions;
    const isAll = canEditAllWeeklyActivity(perms);
    const own = await isWeeklyActivityOwner(prisma, gate.session.user.id, activity);
    if (!isAll && !own) {
      return { status: 403 as const, error: 'Permission refusée' };
    }

    const history = await prisma.businessWeeklyActivityHistory.findMany({
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
    const actorProfiles = await applyBusinessNamesToUsers(prisma, businessId, ssoActorProfiles);

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
      getLatestDiscordDisplayNames(prisma, businessId, [...actorDiscordIds]),
      loadDiscordProfilesByIds(prisma, businessId, [...actorDiscordIds]),
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
          counterKey: h.counterKey,
          previousValues: h.previousValues,
          nextValues: h.nextValues,
        };
      }),
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement de l’historique');
  }
}

const createIntranetSchema = businessWeeklyActivityMetricsSchema
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
async function loadWeeklyActivityTargets(businessId: string): Promise<WeeklyActivityTarget[]> {
  const [profiles, members] = await Promise.all([
    prisma.person.findMany({
      where: personInBusiness(businessId),
      select: { discordUserId: true, userId: true, fixedDisplayName: true, lastDisplayName: true },
    }),
    prisma.businessMember.findMany({ where: { businessId }, select: { userId: true } }),
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

/**
 * Same rule as `loadWeeklyActivityTargets`, for one person: a profile of the
 * dispensary, or a member whose account holds this Discord id.
 */
async function isWeeklyActivityTarget(businessId: string, discordUserId: string): Promise<boolean> {
  const profile = await prisma.person.findFirst({
    where: { discordUserId, ...personInBusiness(businessId) },
    select: { discordUserId: true },
  });
  if (profile) return true;
  const userId = await accountIdOfDiscord(discordUserId);
  if (!userId) return false;
  const member = await prisma.businessMember.findFirst({
    where: { businessId, userId },
    select: { userId: true },
  });
  return member !== null;
}

export async function listBusinessWeeklyActivityTargets(businessSlug: string) {
  try {
    const gate = await requireWeeklyActivityEdit(businessSlug);
    if (!gate.ok) {
      return gate.response;
    }
    if (!canEditAllWeeklyActivity(gate.tenant.effectivePermissions)) {
      return { status: 403 as const, error: 'Permission refusée' };
    }

    const users = await loadWeeklyActivityTargets(gate.tenant.businessId);
    return { status: 200 as const, data: { users } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des personnes');
  }
}

async function createBusinessWeeklyActivityUnlogged(
  businessSlug: string,
  input: z.infer<typeof createIntranetSchema>,
  meta?: WeeklyActivityMutationMeta,
) {
  try {
    const gate = await requireWeeklyActivityEdit(businessSlug);
    if (!gate.ok) {
      return gate.response;
    }
    const parsed = createIntranetSchema.safeParse(input);
    if (!parsed.success) {
      return { status: 400 as const, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
    }
    const mutationMeta = parseMutationMeta(meta);
    if (isWeekLocked(parsed.data.periodStart, gate.tenant.effectiveRole)) {
      return { status: 403 as const, error: PAST_WEEK_LOCKED_MESSAGE };
    }

    const { session, tenant } = gate;
    const { businessId } = tenant;
    const perms = tenant.effectivePermissions;
    const editAll = canEditAllWeeklyActivity(perms);

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
      if (!(await isWeeklyActivityTarget(businessId, parsed.data.targetDiscordUserId))) {
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
        businessId,
        discordUserId,
        genericDoctorFallbackName(discordUserId),
      ));

    const validated = businessWeeklyActivityCreateSchema.safeParse({
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      displayName,
      discordUserId,
      chestDays: parsed.data.chestDays,
      presenceDays: parsed.data.presenceDays,
      counters: parsed.data.counters,
    });
    if (!validated.success) {
      return { status: 400 as const, error: validated.error.issues[0]?.message ?? 'Données invalides' };
    }

    const settings = await getAppSettings(businessId);
    const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
    const createInput = applyVisibilityToCreateInput(validated.data, visibility);

    const existing = await findWeeklyActivityByDoctorAndPeriod(
      prisma,
      businessId,
      discordUserId,
      parsed.data.periodStart,
    );
    if (existing) {
      return { status: 409 as const, error: WEEKLY_ACTIVITY_DUPLICATE_MESSAGE };
    }

    const created = await createBusinessWeeklyActivityWithHistory(createInput, {
      source: 'INTRANET',
      actorUserId: session.user.id,
      actorImpersonatedById: session.session?.impersonatedBy ?? null,
      actorDiscordUserId: actorDiscordUserId ?? null,
      businessId,
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

async function updateBusinessWeeklyActivityUnlogged(
  businessSlug: string,
  input: z.infer<typeof idSchema> & z.infer<typeof businessWeeklyActivityUpdateSchema>,
  meta?: WeeklyActivityMutationMeta,
) {
  try {
    const gate = await requireWeeklyActivityEdit(businessSlug);
    if (!gate.ok) {
      return gate.response;
    }

    const parsedId = idSchema.safeParse({ id: input.id });
    if (!parsedId.success) {
      return { status: 400 as const, error: 'ID invalide' };
    }

    const body = { ...input };
    delete (body as { id?: string }).id;
    const parsedBody = businessWeeklyActivityUpdateSchema.safeParse(body);
    if (!parsedBody.success) {
      return { status: 400 as const, error: parsedBody.error.issues[0]?.message ?? 'Données invalides' };
    }
    const mutationMeta = parseMutationMeta(meta);

    const { businessId } = gate.tenant;

    const existing = await prisma.businessWeeklyActivity.findFirst({
      where: { id: parsedId.data.id, ...tenantWhere(businessId) },
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
    if (isWeekLocked(existing.periodStart, gate.tenant.effectiveRole)) {
      return { status: 403 as const, error: PAST_WEEK_LOCKED_MESSAGE };
    }

    if (
      parsedBody.data.periodStart &&
      isWeekLocked(parsedBody.data.periodStart, gate.tenant.effectiveRole)
    ) {
      return { status: 403 as const, error: PAST_WEEK_LOCKED_MESSAGE };
    }

    const settings = await getAppSettings(businessId);
    const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
    const updateInput = applyVisibilityToUpdateInput(parsedBody.data, visibility);
    const canEditAll = canEditAllWeeklyActivity(gate.tenant.effectivePermissions);
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

    await updateBusinessWeeklyActivityWithHistory(parsedId.data.id, updateInput, {
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

async function deleteBusinessWeeklyActivityUnlogged(
  businessSlug: string,
  input: z.infer<typeof idSchema>,
  meta?: WeeklyActivityMutationMeta,
) {
  try {
    const gate = await requireWeeklyActivityEdit(businessSlug);
    if (!gate.ok) {
      return gate.response;
    }

    const parsed = idSchema.safeParse(input);
    if (!parsed.success) {
      return { status: 400 as const, error: 'ID invalide' };
    }
    const mutationMeta = parseMutationMeta(meta);

    const { businessId } = gate.tenant;

    const existing = await prisma.businessWeeklyActivity.findFirst({
      where: { id: parsed.data.id, ...tenantWhere(businessId) },
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
    if (isWeekLocked(existing.periodStart, gate.tenant.effectiveRole)) {
      return { status: 403 as const, error: PAST_WEEK_LOCKED_MESSAGE };
    }

    const actorDiscordUserId = await getDiscordAccountIdForUser(prisma, gate.session.user.id);

    await deleteBusinessWeeklyActivityWithHistory(parsed.data.id, {
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

/** Key of a counter of the business type (checked against its visible counters). */
const weeklyCounterKeySchema = z.string().trim().min(1).max(40);

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

async function serializeQuickActionRow(businessId: string, activityId: string) {
  const row = await loadSerializedWeeklyActivityByIdForBusiness(activityId, businessId);
  if (!row) {
    throw new Error('Activité introuvable après mise à jour');
  }
  return row;
}

async function markOwnWeeklyChestTodayUnlogged(
  businessSlug: string,
  meta?: WeeklyActivityMutationMeta,
) {
  try {
    const gate = await requireWeeklyChestMark(businessSlug);
    if (!gate.ok) {
      return gate.response;
    }

    const discordGate = await requireOwnDiscordUserId(gate.session.user.id);
    if (!discordGate.ok) {
      return discordGate.response;
    }

    const { businessId } = gate.tenant;
    const settings = await getAppSettings(businessId);
    const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
    const visibilityError = botWeekdayFieldVisibilityError('chest', visibility);
    if (visibilityError) {
      return { status: 403 as const, error: visibilityError };
    }

    const mutationMeta = parseMutationMeta(meta);
    const result = await botMarkChestForParisToday(businessId, discordGate.discordUserId, {
      meta: mutationMeta,
      initiator: {
        source: 'INTRANET',
        actorUserId: gate.session.user.id,
        actorImpersonatedById: gate.session.session?.impersonatedBy ?? null,
      },
    });

    const row = await serializeQuickActionRow(businessId, result.activity.id);
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
  businessSlug: string,
  meta?: WeeklyActivityMutationMeta,
) {
  try {
    const gate = await requireWeeklyActivityEdit(businessSlug);
    if (!gate.ok) {
      return gate.response;
    }

    const discordGate = await requireOwnDiscordUserId(gate.session.user.id);
    if (!discordGate.ok) {
      return discordGate.response;
    }

    const { businessId } = gate.tenant;
    const settings = await getAppSettings(businessId);
    const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
    const visibilityError = botWeekdayFieldVisibilityError('presence', visibility);
    if (visibilityError) {
      return { status: 403 as const, error: visibilityError };
    }

    const mutationMeta = parseMutationMeta(meta);
    const result = await botMarkPresenceForParisRelativeDay(
      businessId,
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

    const row = await serializeQuickActionRow(businessId, result.activity.id);
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
  businessSlug: string,
  input: { counterKey: string },
  meta?: WeeklyActivityMutationMeta,
) {
  try {
    const gate = await requireWeeklyActivityEdit(businessSlug);
    if (!gate.ok) {
      return gate.response;
    }

    const parsed = weeklyCounterKeySchema.safeParse(input.counterKey);
    if (!parsed.success) {
      return { status: 400 as const, error: 'Compteur invalide' };
    }

    const discordGate = await requireOwnDiscordUserId(gate.session.user.id);
    if (!discordGate.ok) {
      return discordGate.response;
    }

    const { businessId } = gate.tenant;
    const settings = await getAppSettings(businessId);
    const visibility = weeklyActivityFieldVisibilityFromSettings(settings);
    if (!isWeeklyCounterVisible(visibility, parsed.data)) {
      return { status: 403 as const, error: 'Ce compteur est masqué pour ce dispensaire.' };
    }

    const mutationMeta = parseMutationMeta(meta);
    const existing = await findOrCreateBusinessActivityForParisDay(
      prisma,
      businessId,
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

    const currentValue = weeklyCounterValue(parseWeeklyCounters(existing.counters), parsed.data);
    const actorDiscordUserId = discordGate.discordUserId;

    await updateBusinessWeeklyActivityWithHistory(
      existing.id,
      { counters: { [parsed.data]: currentValue + 1 } },
      {
        source: 'INTRANET',
        actorUserId: gate.session.user.id,
        actorImpersonatedById: gate.session.session?.impersonatedBy ?? null,
        actorDiscordUserId,
        meta: mutationMeta,
      },
    );

    const row = await serializeQuickActionRow(businessId, existing.id);
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
async function updateBusinessDiscordProfileUnlogged(
  businessSlug: string,
  input: z.infer<typeof updateDiscordProfileSchema>,
) {
  try {
    const gate = await requireWeeklyActivityEdit(businessSlug);
    if (!gate.ok) {
      return gate.response;
    }
    if (!canEditAllWeeklyActivity(gate.tenant.effectivePermissions)) {
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
      businessId: gate.tenant.businessId,
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
const WEEKLY_ACTIVITY_LOG = 'weeklyActivity' as const;

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

export async function createBusinessWeeklyActivity(
  businessSlug: string,
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
    () => createBusinessWeeklyActivityUnlogged(businessSlug, input, meta),
  );
}

export async function updateBusinessWeeklyActivity(
  businessSlug: string,
  input: z.infer<typeof idSchema> & z.infer<typeof businessWeeklyActivityUpdateSchema>,
  meta?: WeeklyActivityMutationMeta,
) {
  return withLoggedAction(
    {
      feature: WEEKLY_ACTIVITY_LOG,
      event: 'weeklyActivity.update',
      label: 'Modification d’une activité hebdo',
      context: input,
    },
    () => updateBusinessWeeklyActivityUnlogged(businessSlug, input, meta),
  );
}

export async function deleteBusinessWeeklyActivity(
  businessSlug: string,
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
    () => deleteBusinessWeeklyActivityUnlogged(businessSlug, input, meta),
  );
}

export async function markOwnWeeklyChestToday(
  businessSlug: string,
  meta?: WeeklyActivityMutationMeta,
) {
  return withLoggedAction(
    {
      feature: WEEKLY_ACTIVITY_LOG,
      event: 'weeklyActivity.chest.mark',
      label: 'Caisse du jour (intranet)',
    },
    () => markOwnWeeklyChestTodayUnlogged(businessSlug, meta),
    describeQuickAction,
  );
}

export async function markOwnWeeklyPresenceToday(
  businessSlug: string,
  meta?: WeeklyActivityMutationMeta,
) {
  return withLoggedAction(
    {
      feature: WEEKLY_ACTIVITY_LOG,
      event: 'weeklyActivity.presence.mark',
      label: 'Présence du jour (intranet)',
    },
    () => markOwnWeeklyPresenceTodayUnlogged(businessSlug, meta),
    describeQuickAction,
  );
}

export async function incrementOwnWeeklyCounter(
  businessSlug: string,
  input: { counterKey: string },
  meta?: WeeklyActivityMutationMeta,
) {
  return withLoggedAction(
    {
      feature: WEEKLY_ACTIVITY_LOG,
      event: 'weeklyActivity.counter.increment',
      label: 'Compteur hebdo +1 (intranet)',
      context: input,
    },
    () => incrementOwnWeeklyCounterUnlogged(businessSlug, input, meta),
    (result) => ('data' in result ? { targetId: result.data.row.id } : undefined),
  );
}

export async function updateBusinessDiscordProfile(
  businessSlug: string,
  input: z.infer<typeof updateDiscordProfileSchema>,
) {
  return withLoggedAction(
    {
      feature: WEEKLY_ACTIVITY_LOG,
      event: 'weeklyActivity.discordProfile.update',
      label: 'Modification d’un profil Discord',
      context: input,
    },
    () => updateBusinessDiscordProfileUnlogged(businessSlug, input),
  );
}
