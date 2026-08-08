'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { actionErrorParser } from '@/lib/action';
import { requirePlatformAdminContext } from '@/lib/dispensary/serverActionContext';
import { slugifyDispensaryName } from '@/lib/dispensary/slug';
import { APP_SETTINGS_DEFAULTS } from '@/lib/appSettingsShared';
import {
  agendaActionError,
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

const createDispensarySchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(80).optional(),
});

const deleteDispensarySchema = z.object({
  id: z.string().uuid(),
});

export async function listDispensariesForPlatform() {
  const auth = await requirePlatformAdminContext();
  if (!auth.ok) {
    return { status: auth.status, error: auth.error };
  }
  const rows = await prisma.dispensary.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { members: true } },
      settings: { select: { dispensaryName: true } },
    },
  });
  return { status: 200, data: rows };
}

export async function createDispensary(data: { name: string; slug?: string }) {
  try {
    const auth = await requirePlatformAdminContext();
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = createDispensarySchema.parse(data);
    const slug = validated.slug?.trim() || slugifyDispensaryName(validated.name);

    const existing = await prisma.dispensary.findUnique({ where: { slug } });
    if (existing) {
      return { status: 409, error: 'Ce slug est déjà utilisé' };
    }

    const dispensary = await prisma.dispensary.create({
      data: {
        name: validated.name.trim(),
        slug,
        createdById: auth.userId,
        settings: {
          create: {
            ...APP_SETTINGS_DEFAULTS,
            dispensaryName: validated.name.trim(),
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

    revalidatePath('/platform/dispensaries');
    return { status: 201, data: dispensary };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création du dispensaire');
  }
}

export async function deleteDispensary(data: { id: string }) {
  try {
    const auth = await requirePlatformAdminContext();
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = deleteDispensarySchema.parse(data);
    const dispensary = await prisma.dispensary.findUnique({
      where: { id: validated.id },
      select: { id: true, name: true, slug: true },
    });

    if (!dispensary) {
      return { status: 404, error: 'Dispensaire introuvable' };
    }

    try {
      await purgeDocumentsByScope(dispensary.id, {
        cookieHeader: await getServerCookieHeader(),
      });
    } catch (error) {
      if (error instanceof DocumentsClientError) {
        return { status: error.status, error: error.message };
      }
      throw error;
    }

    try {
      await purgeBankScope(bankScope(dispensary.id), { internal: true });
    } catch (error) {
      if (error instanceof BankClientError) {
        return { status: error.status, error: error.message };
      }
      console.error('Failed to purge bank scope', error);
    }

    try {
      await purgeInventoryScope(inventoryScope(dispensary.id), { internal: true });
    } catch (error) {
      if (error instanceof InventoryClientError) {
        return { status: error.status, error: error.message };
      }
      console.error('Failed to purge inventory scope', error);
    }

    try {
      const cookie = await agendaCookie();
      const agendas = await listAllAgendas(agendaScope(dispensary.id), cookie);
      for (const agenda of agendas) {
        await deleteAgendaApi(agenda.id, { scopeAdmin: true }, cookie);
      }
    } catch (error) {
      try {
        return agendaActionError(
          error,
          'Erreur lors de la suppression des agendas du dispensaire',
        );
      } catch (e) {
        return actionErrorParser(
          e,
          'Erreur lors de la suppression des agendas du dispensaire',
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.dispensaryWeeklyActivityHistory.deleteMany({
        where: { activity: { dispensaryId: dispensary.id } },
      });
      await tx.dispensary.delete({ where: { id: dispensary.id } });
    });

    revalidatePath('/platform/dispensaries');
    return { status: 200, data: { id: dispensary.id, name: dispensary.name } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du dispensaire');
  }
}
