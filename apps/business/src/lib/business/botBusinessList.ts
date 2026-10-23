import prisma from '@/lib/prisma';
import { getAppSettings, isAppFeatureEnabled } from '@/lib/appSettings';
import { type BotBusinessListItem, toBotBusinessListItem } from '@/lib/business/botBusinessListItem';

/**
 * Businesses a Discord server can be linked to: only those with the weekly activity on,
 * since every bot route needs it. Sorted by the displayed name.
 */
export async function listBusinessesForBot(): Promise<BotBusinessListItem[]> {
  const rows = await prisma.business.findMany({
    select: { id: true, slug: true, name: true, type: true, settings: { select: { businessName: true } } },
  });
  const enabled = await Promise.all(
    rows.map(async (row) => isAppFeatureEnabled(await getAppSettings(row.id), 'weeklyActivity')),
  );
  return rows
    .filter((_, i) => enabled[i])
    .map(toBotBusinessListItem)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
