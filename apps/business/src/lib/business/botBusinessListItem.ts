import type { BusinessType } from '@prisma/client';
import { getBusinessTypeDefinition } from '@/lib/businessTypes';

/** One business as listed to the Discord bot (`GET /api/dispensary/bot/businesses`). */
export type BotBusinessListItem = {
  id: string;
  slug: string;
  type: BusinessType;
  /** Label of the type, e.g. « Dispensaire » : the bot shows `[Dispensaire] Saint-Denis`. */
  typeLabel: string;
  name: string;
};

export function toBotBusinessListItem(row: {
  id: string;
  slug: string;
  name: string;
  type: BusinessType;
  settings: { businessName: string } | null;
}): BotBusinessListItem {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    typeLabel: getBusinessTypeDefinition(row.type).label,
    name: row.settings?.businessName?.trim() || row.name,
  };
}
