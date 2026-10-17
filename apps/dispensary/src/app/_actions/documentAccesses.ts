'use server';

import { applyDispensaryNamesToUsers } from '@/lib/people/resolveNames';
import { fetchDispensaryUserProfiles } from '@/lib/people/userProfiles';
import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import { z } from 'zod/v3';
import {
  grantDocumentAccess,
  grantTemplateAccess,
  listDocumentAccesses,
  listTemplateAccesses,
  revokeDocumentAccess,
  revokeTemplateAccess,
} from '@lawless-intranet/documents-client/server';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { getServerCookieHeader } from '@/lib/documents/mailDocuments';
import { attachUserProfiles, searchAuthUsers } from '@/lib/authUsers';
import prisma from '@/lib/prisma';

const grantAccessSchema = z.object({
  resourceId: z.string().uuid('ID invalide'),
  userId: z.string().min(1),
  accessType: z.enum(['READ', 'WRITE']),
});

const revokeAccessSchema = z.object({
  resourceId: z.string().uuid('ID invalide'),
  userId: z.string().min(1),
});


async function enrichAccessesWithUsers<T extends { userId: string }>(
  dispensaryId: string,
  accesses: T[],
) {
  const usersById = await fetchDispensaryUserProfiles(
    dispensaryId,
    accesses.map((access) => access.userId),
  );
  return attachUserProfiles(accesses, usersById);
}

export async function listTemplateAccessesAction(
  dispensarySlug: string,
  data: { templateId: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;

    const cookieHeader = await getServerCookieHeader();
    const accesses = await listTemplateAccesses(data.templateId, { cookieHeader });

    return {
      status: 200,
      data: await enrichAccessesWithUsers(ctx.tenant.dispensaryId, accesses),
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des accès');
  }
}

async function grantTemplateAccessActionUnlogged(
  dispensarySlug: string,
  data: {
    templateId: string;
    userId: string;
    accessType: 'READ' | 'WRITE';
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;

    const validated = grantAccessSchema.parse({
      resourceId: data.templateId,
      userId: data.userId,
      accessType: data.accessType,
    });

    const cookieHeader = await getServerCookieHeader();
    const access = await grantTemplateAccess(
      validated.resourceId,
      validated.userId,
      validated.accessType,
      { cookieHeader },
    );

    return {
      status: 201,
      data: access,
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de l\'ajout de l\'accès');
  }
}

async function revokeTemplateAccessActionUnlogged(
  dispensarySlug: string,
  data: { templateId: string; userId: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;

    const validated = revokeAccessSchema.parse({
      resourceId: data.templateId,
      userId: data.userId,
    });

    const cookieHeader = await getServerCookieHeader();
    await revokeTemplateAccess(validated.resourceId, validated.userId, {
      cookieHeader,
    });

    return {
      status: 200,
      data: { success: true },
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la suppression de l\'accès');
  }
}

export async function listDocumentAccessesAction(
  dispensarySlug: string,
  data: { documentId: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;

    const cookieHeader = await getServerCookieHeader();
    const accesses = await listDocumentAccesses(data.documentId, { cookieHeader });

    return {
      status: 200,
      data: await enrichAccessesWithUsers(ctx.tenant.dispensaryId, accesses),
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des accès');
  }
}

async function grantDocumentAccessActionUnlogged(
  dispensarySlug: string,
  data: {
    documentId: string;
    userId: string;
    accessType: 'READ' | 'WRITE';
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;

    const validated = grantAccessSchema.parse({
      resourceId: data.documentId,
      userId: data.userId,
      accessType: data.accessType,
    });

    const cookieHeader = await getServerCookieHeader();
    const access = await grantDocumentAccess(
      validated.resourceId,
      validated.userId,
      validated.accessType,
      { cookieHeader },
    );

    return {
      status: 201,
      data: access,
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de l\'ajout de l\'accès');
  }
}

async function revokeDocumentAccessActionUnlogged(
  dispensarySlug: string,
  data: { documentId: string; userId: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;

    const validated = revokeAccessSchema.parse({
      resourceId: data.documentId,
      userId: data.userId,
    });

    const cookieHeader = await getServerCookieHeader();
    await revokeDocumentAccess(validated.resourceId, validated.userId, {
      cookieHeader,
    });

    return {
      status: 200,
      data: { success: true },
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la suppression de l\'accès');
  }
}

export async function searchUsersForDocumentAccess(dispensarySlug: string, query: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;

    const q = query.trim();
    if (q.length < 2) {
      return { status: 200, data: [] };
    }

    const users = await applyDispensaryNamesToUsers(
      prisma,
      ctx.tenant.dispensaryId,
      new Map((await searchAuthUsers(q)).map((user) => [user.id, user])),
    );

    return {
      status: 200,
      data: [...users.values()].map((user) => ({ id: user.id, name: user.name })),
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la recherche des utilisateurs');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function grantTemplateAccessAction(
  ...args: Parameters<typeof grantTemplateAccessActionUnlogged>
) {
  return loggedAction(
    {
      feature: 'mails',
      event: 'documentAccesses.grantTemplateAccessAction',
      target: ([, data]) => data.templateId,
    },
    args,
    () => grantTemplateAccessActionUnlogged(...args),
  );
}

export async function revokeTemplateAccessAction(
  ...args: Parameters<typeof revokeTemplateAccessActionUnlogged>
) {
  return loggedAction(
    {
      feature: 'mails',
      event: 'documentAccesses.revokeTemplateAccessAction',
      target: ([, data]) => data.templateId,
    },
    args,
    () => revokeTemplateAccessActionUnlogged(...args),
  );
}

export async function grantDocumentAccessAction(
  ...args: Parameters<typeof grantDocumentAccessActionUnlogged>
) {
  return loggedAction(
    {
      feature: 'mails',
      event: 'documentAccesses.grantDocumentAccessAction',
      target: ([, data]) => data.documentId,
    },
    args,
    () => grantDocumentAccessActionUnlogged(...args),
  );
}

export async function revokeDocumentAccessAction(
  ...args: Parameters<typeof revokeDocumentAccessActionUnlogged>
) {
  return loggedAction(
    {
      feature: 'mails',
      event: 'documentAccesses.revokeDocumentAccessAction',
      target: ([, data]) => data.documentId,
    },
    args,
    () => revokeDocumentAccessActionUnlogged(...args),
  );
}
