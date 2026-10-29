import prisma from '@/lib/prisma';
import { isCashPreparerGrade, type BusinessType } from '@/lib/businessTypes';
import { loadDiscordProfilesByIds } from '@/lib/businessDiscordProfile/queries';
import type { WeeklyCounters } from '@/lib/businessWeeklyActivity/counters';

/**
 * Cash preparers (by their grade in the business, like their pay) only do caisses:
 * the bot shows them the caisse alone and its routes refuse presence and counters.
 */
export const CASH_PREPARER_ONLY_CHEST_MESSAGE =
  'Réservé aux employés : en tant que préparateur de caisse, seule la caisse est disponible.';

/** Discord ids among `discordUserIds` whose grade in the business is cash preparer. */
export async function cashPreparerIds(
  businessId: string,
  businessType: BusinessType,
  discordUserIds: string[],
): Promise<Set<string>> {
  const profiles = await loadDiscordProfilesByIds(prisma, businessId, discordUserIds);
  return new Set(
    [...profiles.values()].filter((p) => isCashPreparerGrade(businessType, p.role)).map((p) => p.discordUserId),
  );
}

export async function isCashPreparer(
  businessId: string,
  businessType: BusinessType,
  discordUserId: string,
): Promise<boolean> {
  return (await cashPreparerIds(businessId, businessType, [discordUserId])).has(discordUserId);
}

/** True when `next` raises a counter above `previous` (lowering one stays allowed, e.g. an undo). */
export function raisesWeeklyCounter(previous: WeeklyCounters, next: WeeklyCounters | undefined): boolean {
  if (!next) return false;
  return Object.entries(next).some(([key, value]) => value > (previous[key] ?? 0));
}
