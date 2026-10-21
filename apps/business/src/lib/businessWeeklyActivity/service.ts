import { Prisma } from '@prisma/client';
import type {
  BusinessWeeklyActivity,
  BusinessWeeklyActivityHistoryAction,
  BusinessWeeklyActivityHistorySource,
  PrismaClient,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { upsertDiscordProfileFromActivity } from '@/lib/businessDiscordProfile/service';
import { accountIdOfDiscord, syncRowAccountLinks } from '@/lib/people/accountLinks';
import { resolveBotWeeklyActivityDisplayName } from '@/lib/businessWeeklyActivity/resolveDisplayName';
import { activityToSnapshot } from '@/lib/businessWeeklyActivity/snapshot';
import {
  parseWeeklyCounters,
  storedWeeklyCounters,
  weeklyCounterValue,
  type WeeklyCounters,
} from '@/lib/businessWeeklyActivity/counters';
import { getBankWeekBounds } from '@/lib/bankWeek';
import { tenantWhere } from '@/lib/business/tenantWhere';
import type { BusinessWeeklyActivityCreateInput, BusinessWeeklyActivityUpdateInput } from '@/lib/businessWeeklyActivity/schemas';
import {
  assertActivityInCurrentParisWeek,
  assertBotEditableParisDay,
  buildBotDayFieldHistoryPayload,
  weekdayKeyForParisAnchor,
} from '@/lib/businessWeeklyActivity/botDayEdit';
import {
  emptyWeekdayFlags,
  parisCalendarDayRangeUtc,
  parisTodayStartUtc,
  parisYesterdayStartUtc,
  parseWeekdayFlagsJson,
} from '@/lib/businessWeeklyActivity/weekdayFlags';
import {
  activityToWeeklyActivityRealtimePayload,
  emitWeeklyActivityChange,
} from '@/lib/businessWeeklyActivity/realtime/broadcast';
import type { WeeklyActivityMutationMeta } from '@/lib/businessWeeklyActivity/realtime/types';

export function getNormalizedWeeklyActivityPeriod(anchor: Date): {
  periodStart: Date;
  periodEnd: Date;
} {
  const { start, end } = getBankWeekBounds(anchor);
  return { periodStart: start, periodEnd: end };
}

function normalizeParisWeekBounds(anchor: Date): { periodStart: Date; periodEnd: Date } {
  return getNormalizedWeeklyActivityPeriod(anchor);
}

export async function findWeeklyActivityByDoctorAndPeriod(
  client: WeeklyActivityDb,
  businessId: string,
  discordUserId: string,
  anchor: Date,
): Promise<BusinessWeeklyActivity | null> {
  if (!businessId.trim()) {
    throw new Error('Dispensaire requis pour la recherche d’activité');
  }
  const { periodStart, periodEnd } = getNormalizedWeeklyActivityPeriod(anchor);
  return client.businessWeeklyActivity.findFirst({
    where: {
      ...tenantWhere(businessId),
      discordUserId,
      periodStart,
      periodEnd,
    },
  });
}

export const WEEKLY_ACTIVITY_DUPLICATE_MESSAGE =
  'Une activité existe déjà pour ce médecin sur cette semaine dans ce dispensaire. Modifiez l’entrée existante dans le tableau.';

type WeeklyActivityDb = Pick<PrismaClient, 'businessWeeklyActivity'>;

/**
 * Applies the current account of the row's Discord id, resolved by the caller
 * before any transaction (`accountIdOfDiscord`): `undefined` (auth did not
 * answer) keeps the stored link, `null` unlinks.
 */
export async function applyActivityAccountLink(
  client: WeeklyActivityDb,
  activity: BusinessWeeklyActivity,
  linkedUserId: string | null | undefined,
): Promise<BusinessWeeklyActivity> {
  if (linkedUserId === undefined || linkedUserId === activity.userId) return activity;
  return client.businessWeeklyActivity.update({
    where: { id: activity.id },
    data: { userId: linkedUserId },
  });
}

/** Brings `userId` up to date on these rows (and their profiles), best effort. */
export async function reconcileActivityUserIds<T extends BusinessWeeklyActivity>(
  rows: T[],
): Promise<T[]> {
  return syncRowAccountLinks(prisma, rows);
}

export async function findBusinessActivityOverlappingParisDay(
  client: WeeklyActivityDb,
  businessId: string,
  discordUserId: string,
  dayAnchor: Date,
): Promise<BusinessWeeklyActivity | null> {
  const { start, end } = parisCalendarDayRangeUtc(dayAnchor);
  return client.businessWeeklyActivity.findFirst({
    where: {
      businessId,
      discordUserId,
      periodStart: { lte: end },
      periodEnd: { gte: start },
    },
  });
}

type ActorContext = {
  source: BusinessWeeklyActivityHistorySource;
  actorUserId: string | null;
  actorDiscordUserId: string | null;
  /** Platform admin acting as `actorUserId` (impersonation). */
  actorImpersonatedById?: string | null;
  businessId?: string;
  meta?: WeeklyActivityMutationMeta;
};

/** One history action per counter the bot changed: key and direction. */
function counterChanges(
  before: WeeklyCounters,
  after: WeeklyCounters,
): { counterKey: string; action: BusinessWeeklyActivityHistoryAction }[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: { counterKey: string; action: BusinessWeeklyActivityHistoryAction }[] = [];
  for (const counterKey of keys) {
    const from = weeklyCounterValue(before, counterKey);
    const to = weeklyCounterValue(after, counterKey);
    if (from === to) continue;
    changes.push({ counterKey, action: to > from ? 'INCREMENT_COUNTER' : 'DECREMENT_COUNTER' });
  }
  return changes;
}

function botMetaChanged(
  before: BusinessWeeklyActivity,
  after: BusinessWeeklyActivity,
): boolean {
  return (
    before.periodStart.getTime() !== after.periodStart.getTime() ||
    before.periodEnd.getTime() !== after.periodEnd.getTime() ||
    before.displayName !== after.displayName
  );
}

function snapshotsEqual(a: ReturnType<typeof activityToSnapshot>, b: ReturnType<typeof activityToSnapshot>) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function createBusinessWeeklyActivityWithHistory(
  input: BusinessWeeklyActivityCreateInput,
  actor: ActorContext,
): Promise<BusinessWeeklyActivity> {
  const businessId = actor.businessId;
  if (!businessId) {
    throw new Error('Dispensaire requis');
  }

  // Resolved before the transaction: no HTTP call while it holds a connection.
  const currentLink = await accountIdOfDiscord(input.discordUserId);
  const linkedUserId = currentLink !== undefined ? currentLink : (input.userId ?? null);

  const { periodStart, periodEnd } = normalizeParisWeekBounds(input.periodStart);

  const duplicate = await findWeeklyActivityByDoctorAndPeriod(
    prisma,
    businessId,
    input.discordUserId,
    input.periodStart,
  );
  if (duplicate) {
    throw new Error(WEEKLY_ACTIVITY_DUPLICATE_MESSAGE);
  }

  const chestDays = input.chestDays ?? emptyWeekdayFlags();
  const presenceDays = input.presenceDays ?? emptyWeekdayFlags();

  const synced = await prisma.$transaction(async (tx) => {
    const created = await tx.businessWeeklyActivity.create({
      data: {
        businessId,
        periodStart,
        periodEnd,
        displayName: input.displayName,
        discordUserId: input.discordUserId,
        userId: linkedUserId ?? undefined,
        chestDays: chestDays as Prisma.InputJsonValue,
        presenceDays: presenceDays as Prisma.InputJsonValue,
        counters: storedWeeklyCounters(input.counters ?? {}) as Prisma.InputJsonValue,
      },
    });

    const row = created;

    await upsertDiscordProfileFromActivity(tx, {
      businessId,
      discordUserId: row.discordUserId,
      displayName: row.displayName,
      userId: currentLink,
    });

    await tx.businessWeeklyActivityHistory.create({
      data: {
        activityId: row.id,
        action: 'CREATE',
        source: actor.source,
        actorUserId: actor.actorUserId,
        actorDiscordUserId: actor.actorDiscordUserId,
        actorImpersonatedById: actor.actorImpersonatedById ?? null,
        previousValues: Prisma.JsonNull,
        nextValues: activityToSnapshot(row) as Prisma.InputJsonValue,
      },
    });

    return row;
  });

  emitWeeklyActivityChange(
    businessId,
    activityToWeeklyActivityRealtimePayload(synced),
    actor.meta,
  );

  return synced;
}

export async function updateBusinessWeeklyActivityWithHistory(
  id: string,
  input: BusinessWeeklyActivityUpdateInput,
  actor: ActorContext,
): Promise<BusinessWeeklyActivity> {
  const target = await prisma.businessWeeklyActivity.findUnique({
    where: { id },
    select: { discordUserId: true },
  });
  // Resolved before the transaction: no HTTP call while it holds a connection.
  const currentLink = target ? await accountIdOfDiscord(target.discordUserId) : undefined;

  const finalRow = await prisma.$transaction(async (tx) => {
    const existing = await tx.businessWeeklyActivity.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Activité introuvable');
    }

    const data: Prisma.BusinessWeeklyActivityUpdateInput = {};
    if (input.periodStart !== undefined || input.periodEnd !== undefined) {
      const anchor = input.periodStart ?? input.periodEnd;
      if (!anchor) {
        throw new Error('periodStart or periodEnd is required');
      }
      const normalized = normalizeParisWeekBounds(anchor);
      data.periodStart = normalized.periodStart;
      data.periodEnd = normalized.periodEnd;
    }
    if (input.displayName !== undefined) data.displayName = input.displayName;
    if (input.chestDays !== undefined) data.chestDays = input.chestDays as Prisma.InputJsonValue;
    if (input.presenceDays !== undefined) data.presenceDays = input.presenceDays as Prisma.InputJsonValue;
    if (input.counters !== undefined) {
      // The given counters replace their value; the others keep theirs.
      data.counters = storedWeeklyCounters({
        ...parseWeeklyCounters(existing.counters),
        ...input.counters,
      }) as Prisma.InputJsonValue;
    }

    const updated = await tx.businessWeeklyActivity.update({
      where: { id },
      data,
    });

    const row = await applyActivityAccountLink(tx, updated, currentLink);

    await upsertDiscordProfileFromActivity(tx, {
      businessId: row.businessId,
      discordUserId: row.discordUserId,
      displayName: row.displayName,
      userId: currentLink,
    });

    const prevSnap = activityToSnapshot(existing);
    const nextSnap = activityToSnapshot(row);
    const changed = !snapshotsEqual(prevSnap, nextSnap);

    if (actor.source === 'INTRANET') {
      if (changed) {
        await tx.businessWeeklyActivityHistory.create({
          data: {
            activityId: id,
            action: 'UPDATE',
            source: actor.source,
            actorUserId: actor.actorUserId,
            actorDiscordUserId: actor.actorDiscordUserId,
            actorImpersonatedById: actor.actorImpersonatedById ?? null,
            previousValues: prevSnap as Prisma.InputJsonValue,
            nextValues: nextSnap as Prisma.InputJsonValue,
          },
        });
      }
    } else {
      for (const change of counterChanges(prevSnap.counters, nextSnap.counters)) {
        await tx.businessWeeklyActivityHistory.create({
          data: {
            activityId: id,
            action: change.action,
            counterKey: change.counterKey,
            source: actor.source,
            actorUserId: actor.actorUserId,
            actorDiscordUserId: actor.actorDiscordUserId,
            actorImpersonatedById: actor.actorImpersonatedById ?? null,
            previousValues: prevSnap as Prisma.InputJsonValue,
            nextValues: nextSnap as Prisma.InputJsonValue,
          },
        });
      }
      if (botMetaChanged(existing, row)) {
        await tx.businessWeeklyActivityHistory.create({
          data: {
            activityId: id,
            action: 'UPDATE',
            source: actor.source,
            actorUserId: actor.actorUserId,
            actorDiscordUserId: actor.actorDiscordUserId,
            actorImpersonatedById: actor.actorImpersonatedById ?? null,
            previousValues: prevSnap as Prisma.InputJsonValue,
            nextValues: nextSnap as Prisma.InputJsonValue,
          },
        });
      }
    }

    return { row, changed };
  });

  if (finalRow.changed) {
    emitWeeklyActivityChange(
      finalRow.row.businessId,
      activityToWeeklyActivityRealtimePayload(finalRow.row),
      actor.meta,
    );
  }

  return finalRow.row;
}

export async function deleteBusinessWeeklyActivityWithHistory(
  id: string,
  actor: ActorContext,
): Promise<void> {
  const existing = await prisma.$transaction(async (tx) => {
    const row = await tx.businessWeeklyActivity.findUnique({ where: { id } });
    if (!row) {
      throw new Error('Activité introuvable');
    }

    await tx.businessWeeklyActivityHistory.create({
      data: {
        activityId: id,
        action: 'DELETE',
        source: actor.source,
        actorUserId: actor.actorUserId,
        actorDiscordUserId: actor.actorDiscordUserId,
        actorImpersonatedById: actor.actorImpersonatedById ?? null,
        previousValues: activityToSnapshot(row) as Prisma.InputJsonValue,
        nextValues: Prisma.JsonNull,
      },
    });

    await tx.businessWeeklyActivity.delete({ where: { id } });
    return row;
  });

  emitWeeklyActivityChange(
    existing.businessId,
    activityToWeeklyActivityRealtimePayload(existing),
    actor.meta,
  );
}

export async function findOrCreateBusinessActivityForParisDay(
  client: WeeklyActivityDb,
  businessId: string,
  discordUserId: string,
  dayAnchor: Date,
  preferredDisplayName?: string,
  initiator: WeeklyActivityInitiator = DISCORD_BOT_INITIATOR,
): Promise<BusinessWeeklyActivity> {
  // The row keeps the bot's nickname; a fixed name (Gestion › Personnes) wins at display time.
  const preferred =
    preferredDisplayName !== undefined && preferredDisplayName.trim().length > 0
      ? preferredDisplayName.trim().slice(0, 200)
      : undefined;

  const actor: ActorContext = {
    source: initiator.source,
    actorUserId: initiator.actorUserId,
    actorDiscordUserId: discordUserId,
    actorImpersonatedById: initiator.actorImpersonatedById ?? null,
    businessId,
  };

  const found = await findBusinessActivityOverlappingParisDay(
    client,
    businessId,
    discordUserId,
    dayAnchor,
  );
  if (found) {
    if (preferred && preferred !== found.displayName) {
      return updateBusinessWeeklyActivityWithHistory(found.id, { displayName: preferred }, actor);
    }
    return found;
  }

  const { start, end } = getBankWeekBounds(dayAnchor);
  const displayName =
    preferred ?? (await resolveBotWeeklyActivityDisplayName(client, businessId, discordUserId));

  try {
    // The account of the Discord id is resolved by the create itself.
    return await createBusinessWeeklyActivityWithHistory(
      {
        periodStart: start,
        periodEnd: end,
        displayName,
        discordUserId,
      },
      actor,
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const raced = await findBusinessActivityOverlappingParisDay(
        client,
        businessId,
        discordUserId,
        dayAnchor,
      );
      if (raced) {
        if (preferred && preferred !== raced.displayName) {
          return updateBusinessWeeklyActivityWithHistory(
            raced.id,
            { displayName: preferred },
            actor,
          );
        }
        return raced;
      }
    }
    throw e;
  }
}

export type BotWeekdayFlagMarkResult =
  | { outcome: 'already_done'; message: string; activity: BusinessWeeklyActivity }
  | { outcome: 'ok'; activity: BusinessWeeklyActivity };

/** Who triggered a quick action: the Discord bot, or a signed-in user on the intranet. */
export type WeeklyActivityInitiator = {
  source: BusinessWeeklyActivityHistorySource;
  actorUserId: string | null;
  /** Platform admin acting as `actorUserId` (impersonation). */
  actorImpersonatedById?: string | null;
};

const DISCORD_BOT_INITIATOR: WeeklyActivityInitiator = { source: 'DISCORD_BOT', actorUserId: null };

export type BotWeeklyActivityRequestOptions = {
  /** History source and actor; the Discord bot when omitted. */
  initiator?: WeeklyActivityInitiator;
  /** RP / Discord display name; updates stored `displayName` when different (trim, 1–200 chars). */
  displayName?: string;
  /** When false, allows editing days outside the current Paris week (legacy presence yesterday). */
  requireCurrentParisWeek?: boolean;
  meta?: WeeklyActivityMutationMeta;
};

function alreadyDoneMessage(field: 'chest' | 'presence', value: boolean): string {
  if (field === 'chest') {
    return value
      ? 'La caisse de ce jour est déjà enregistrée.'
      : 'La caisse de ce jour est déjà désactivée.';
  }
  return value
    ? 'La présence de ce jour est déjà enregistrée.'
    : 'La présence de ce jour est déjà désactivée.';
}

export async function botSetWeekdayFlag(
  businessId: string,
  discordUserId: string,
  field: 'chest' | 'presence',
  dayAnchor: Date,
  value: boolean,
  options?: BotWeeklyActivityRequestOptions,
): Promise<BotWeekdayFlagMarkResult> {
  const requireCurrentWeek = options?.requireCurrentParisWeek !== false;
  assertBotEditableParisDay(dayAnchor, { requireCurrentParisWeek: requireCurrentWeek });

  const createAnchor = requireCurrentWeek
    ? getBankWeekBounds(new Date()).start
    : dayAnchor;

  const existing = await findOrCreateBusinessActivityForParisDay(
    prisma,
    businessId,
    discordUserId,
    createAnchor,
    options?.displayName,
    options?.initiator,
  );

  if (requireCurrentWeek) {
    assertActivityInCurrentParisWeek(existing.periodStart, existing.periodEnd);
  }

  const key = weekdayKeyForParisAnchor(dayAnchor);
  const flagsField = field === 'chest' ? 'chestDays' : 'presenceDays';
  const currentFlags = parseWeekdayFlagsJson(existing[flagsField]);

  if (currentFlags[key] === value) {
    return {
      outcome: 'already_done',
      message: alreadyDoneMessage(field, value),
      activity: existing,
    };
  }

  const historyAction =
    field === 'chest' ? ('UPDATE_CHEST_DAYS' as const) : ('UPDATE_PRESENCE_DAYS' as const);

  const currentLink = await accountIdOfDiscord(existing.discordUserId);

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.businessWeeklyActivity.findUnique({ where: { id: existing.id } });
    if (!row) {
      throw new Error('Activité introuvable');
    }

    if (requireCurrentWeek) {
      assertActivityInCurrentParisWeek(row.periodStart, row.periodEnd);
    }

    const current = parseWeekdayFlagsJson(row[flagsField]);
    if (current[key] === value) {
      return {
        outcome: 'already_done' as const,
        message: alreadyDoneMessage(field, value),
        activity: row,
      };
    }

    const nextFlags = { ...current, [key]: value };
    const updated = await tx.businessWeeklyActivity.update({
      where: { id: row.id },
      data: { [flagsField]: nextFlags as Prisma.InputJsonValue },
    });
    const synced = await applyActivityAccountLink(tx, updated, currentLink);

    const previousValues = buildBotDayFieldHistoryPayload(dayAnchor, field, current[key]);
    const nextValues = buildBotDayFieldHistoryPayload(dayAnchor, field, value);

    await tx.businessWeeklyActivityHistory.create({
      data: {
        activityId: synced.id,
        action: historyAction,
        source: options?.initiator?.source ?? DISCORD_BOT_INITIATOR.source,
        actorUserId: options?.initiator?.actorUserId ?? null,
        actorDiscordUserId: discordUserId,
        actorImpersonatedById: options?.initiator?.actorImpersonatedById ?? null,
        previousValues: previousValues as Prisma.InputJsonValue,
        nextValues: nextValues as Prisma.InputJsonValue,
      },
    });

    return { outcome: 'ok' as const, activity: synced };
  });

  if (result.outcome === 'ok') {
    emitWeeklyActivityChange(
      businessId,
      activityToWeeklyActivityRealtimePayload(result.activity),
      options?.meta,
    );
  }

  return result;
}

export async function botMarkChestForParisToday(
  businessId: string,
  discordUserId: string,
  options?: BotWeeklyActivityRequestOptions,
): Promise<BotWeekdayFlagMarkResult> {
  return botSetWeekdayFlag(businessId, discordUserId, 'chest', new Date(), true, options);
}

export async function botMarkPresenceForParisRelativeDay(
  businessId: string,
  discordUserId: string,
  relative: 'today' | 'yesterday',
  options?: BotWeeklyActivityRequestOptions,
): Promise<BotWeekdayFlagMarkResult> {
  const dayAnchor = relative === 'today' ? parisTodayStartUtc() : parisYesterdayStartUtc();
  return botSetWeekdayFlag(businessId, discordUserId, 'presence', dayAnchor, true, {
    ...options,
    requireCurrentParisWeek: relative === 'today',
  });
}
