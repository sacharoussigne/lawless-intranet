'use server';

import { z } from 'zod/v3';
import { actionErrorParser } from '@/lib/action';
import { searchPaletteEntityHits } from '@/lib/palette/entities';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';

const paletteSearchSchema = z.object({ query: z.string().trim().min(2).max(80) });

/**
 * « @… » search of the command palette: orders, patients, letters and contacts, items. Each kind
 * of entity checks its own module and rights (lib/palette/entities.ts); a read, so not logged.
 */
export async function searchPaletteEntities(businessSlug: string, input: { query: string }) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug);
    if (!ctx.ok) return ctx.response;
    const { query } = paletteSearchSchema.parse(input);
    return { status: 200, data: await searchPaletteEntityHits(ctx.tenant, query, businessSlug) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la recherche');
  }
}
