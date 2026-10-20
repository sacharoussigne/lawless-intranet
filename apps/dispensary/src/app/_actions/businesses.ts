'use server';

import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { actionErrorParser } from '@/lib/action';
import { requirePlatformAdminContext } from '@/lib/business/serverActionContext';
import {
  isReservedBusinessSlug,
  RESERVED_BUSINESS_SLUG_MESSAGE,
  slugifyBusinessName,
} from '@/lib/business/slug';
import { APP_SETTINGS_DEFAULTS } from '@/lib/appSettingsShared';
import {
  agendaCookie,
  agendaScope,
} from '@/lib/agenda/client';
import { getServerCookieHeader } from '@/lib/documents/mailDocuments';
import {
  deleteAgenda as deleteAgendaApi,
  listAllAgendas,
} from '@lawless-intranet/agenda-client/server';
import { purgeDocumentsByScope } from '@lawless-intranet/documents-client/server';
import { DocumentsClientError } from '@lawless-intranet/documents-client';
import { purgeBankScope } from '@lawless-intranet/bank-client/server';
import { BankClientError } from '@lawless-intranet/bank-client';
import { bankScope } from '@/lib/bank/client';
import { purgeInventoryScope } from '@lawless-intranet/inventory-client/server';
import { InventoryClientError } from '@lawless-intranet/inventory-client';
import { inventoryScope } from '@/lib/inventory/client';
import { purgeMediaScope } from '@lawless-intranet/media-client/server';
import { mediaScope } from '@/lib/media/client';
import { ensureBusinessRolePermissions } from '@/lib/business/permissionsSeed';

const createBusinessSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide (lettres minuscules, chiffres et tirets)')
    .refine((slug) => !isReservedBusinessSlug(slug), RESERVED_BUSINESS_SLUG_MESSAGE)
    .optional()
    .or(z.literal('')),
});

const deleteBusinessSchema = z.object({
  id: z.string().uuid(),
});

export async function listBusinessesForPlatform() {
  const auth = await requirePlatformAdminContext();
  if (!auth.ok) {
    return { status: auth.status, error: auth.error };
  }
  const rows = await prisma.business.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { members: true } },
      settings: { select: { businessName: true } },
    },
  });
  return { status: 200, data: rows };
}

async function createBusinessUnlogged(data: { name: string; slug?: string }) {
  try {
    const auth = await requirePlatformAdminContext();
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = createBusinessSchema.parse(data);
    const slug = validated.slug?.trim() || slugifyBusinessName(validated.name);

    const existing = await prisma.business.findUnique({ where: { slug } });
    if (existing) {
      return { status: 409, error: 'Ce slug est déjà utilisé' };
    }

    // The type lives on the business, not in its settings row.
    const { businessType: _type, ...settingsDefaults } = APP_SETTINGS_DEFAULTS;
    const business = await prisma.business.create({
      data: {
        name: validated.name.trim(),
        slug,
        createdById: auth.userId,
        settings: {
          create: {
            ...settingsDefaults,
            businessName: validated.name.trim(),
          },
        },
        members: {
          create: {
            userId: auth.userId,
            role: 'admin',
          },
        },
      },
    });

    await ensureBusinessRolePermissions(business.id, prisma, business.type);

    revalidatePath('/platform/dispensaries');
    return { status: 201, data: business };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création du dispensaire');
  }
}

async function deleteBusinessUnlogged(data: { id: string }) {
  try {
    const auth = await requirePlatformAdminContext();
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = deleteBusinessSchema.parse(data);
    const business = await prisma.business.findUnique({
      where: { id: validated.id },
      select: { id: true, name: true, slug: true },
    });

    if (!business) {
      return { status: 404, error: 'Dispensaire introuvable' };
    }

    try {
      await purgeDocumentsByScope(business.id, {
        cookieHeader: await getServerCookieHeader(),
      });
    } catch (error) {
      if (error instanceof DocumentsClientError) {
        return { status: error.status, error: error.message };
      }
      throw error;
    }

    try {
      await purgeBankScope(bankScope(business.id), { internal: true });
    } catch (error) {
      if (error instanceof BankClientError) {
        return { status: error.status, error: error.message };
      }
      console.error('Failed to purge bank scope', error);
    }

    try {
      await purgeInventoryScope(inventoryScope(business.id), { internal: true });
    } catch (error) {
      if (error instanceof InventoryClientError) {
        return { status: error.status, error: error.message };
      }
      console.error('Failed to purge inventory scope', error);
    }

    try {
      await purgeMediaScope(mediaScope(business.id));
    } catch (error) {
      console.error('Failed to purge media scope', error);
    }

    try {
      const cookie = await agendaCookie();
      const agendas = await listAllAgendas(agendaScope(business.id), cookie);
      for (const agenda of agendas) {
        await deleteAgendaApi(agenda.id, { scopeAdmin: true }, cookie);
      }
    } catch (error) {
      return serviceActionError(error, 'Erreur lors de la suppression des agendas du dispensaire');
    }

    await prisma.$transaction(async (tx) => {
      await tx.businessWeeklyActivityHistory.deleteMany({
        where: { activity: { businessId: business.id } },
      });
      await tx.business.delete({ where: { id: business.id } });
    });

    revalidatePath('/platform/dispensaries');
    return { status: 200, data: { id: business.id, name: business.name } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du dispensaire');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createBusiness(...args: Parameters<typeof createBusinessUnlogged>) {
  return loggedAction({ feature: 'platform', event: 'dispensaries.createDispensary' }, args, () =>
    createBusinessUnlogged(...args),
  );
}

export async function deleteBusiness(...args: Parameters<typeof deleteBusinessUnlogged>) {
  return loggedAction({ feature: 'platform', event: 'dispensaries.deleteDispensary' }, args, () =>
    deleteBusinessUnlogged(...args),
  );
}
