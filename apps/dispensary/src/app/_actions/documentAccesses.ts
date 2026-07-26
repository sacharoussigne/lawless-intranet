'use server';

import { z } from 'zod/v3';
import {
  grantDocumentAccess,
  grantTemplateAccess,
  listDocumentAccesses,
  listTemplateAccesses,
  revokeDocumentAccess,
  revokeTemplateAccess,
} from '@lawless-intranet/documents-client/server';
import { DocumentsClientError } from '@lawless-intranet/documents-client';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { getServerCookieHeader } from '@/lib/documents/mailDocuments';
import {
  attachUserProfiles,
  fetchUserProfiles,
  searchAuthUsers,
} from '@/lib/authUsers';

const grantAccessSchema = z.object({
  resourceId: z.string().uuid('ID invalide'),
  userId: z.string().min(1),
  accessType: z.enum(['READ', 'WRITE']),
});

const revokeAccessSchema = z.object({
  resourceId: z.string().uuid('ID invalide'),
  userId: z.string().min(1),
});

function documentsActionError(error: unknown, fallback: string) {
  if (error instanceof DocumentsClientError) {
    return {
      status: error.status,
      error: error.message,
    };
  }
  return actionErrorParser(error, fallback);
}

async function enrichAccessesWithUsers<T extends { userId: string }>(accesses: T[]) {
  const usersById = await fetchUserProfiles(accesses.map((access) => access.userId));
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
      data: await enrichAccessesWithUsers(accesses),
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la récupération des accès');
  }
}

export async function grantTemplateAccessAction(
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
    return documentsActionError(error, 'Erreur lors de l\'ajout de l\'accès');
  }
}

export async function revokeTemplateAccessAction(
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
    return documentsActionError(error, 'Erreur lors de la suppression de l\'accès');
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
      data: await enrichAccessesWithUsers(accesses),
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la récupération des accès');
  }
}

export async function grantDocumentAccessAction(
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
    return documentsActionError(error, 'Erreur lors de l\'ajout de l\'accès');
  }
}

export async function revokeDocumentAccessAction(
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
    return documentsActionError(error, 'Erreur lors de la suppression de l\'accès');
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

    const users = await searchAuthUsers(q);

    return {
      status: 200,
      data: users.map((user) => ({ id: user.id, name: user.name })),
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la recherche des utilisateurs');
  }
}
