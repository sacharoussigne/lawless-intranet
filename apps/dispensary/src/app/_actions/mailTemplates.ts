'use server';

import { z } from 'zod/v3';
import prisma from '@/lib/prisma';
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from '@lawless-intranet/documents-client/server';
import { DocumentsClientError } from '@lawless-intranet/documents-client';
import { actionErrorParser } from '@/lib/action';
import { requirePermission, requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { renderTemplate } from '@lawless-intranet/mail-template-engine';
import type { OrderStatus, OrderType } from '@prisma/client';
import {
  buildOrderMailVariables,
  type OrderMailPreviewSource,
} from '@/lib/mailTemplate/buildOrderMailVariables';
import {
  buildMailTemplateMetadata,
  getDefaultMailName,
  getServerCookieHeader,
  MAIL_DOCUMENT_TYPE,
  templateToMailTemplate,
} from '@/lib/documents/mailDocuments';

const optionalDefaultMailName = z
  .string()
  .max(255, 'Le nom du courrier par défaut est trop long')
  .optional()
  .transform((v) => {
    const t = v?.trim();
    return t ? t : undefined;
  });

const createMailTemplateSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  description: z.string().optional(),
  content: z.string().min(1, 'Le contenu est requis'),
  defaultMailName: optionalDefaultMailName,
});

const updateMailTemplateSchema = z.object({
  id: z.string().uuid('ID invalide'),
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  description: z.string().optional(),
  content: z.string().min(1, 'Le contenu est requis'),
  defaultMailName: optionalDefaultMailName,
});

const deleteMailTemplateSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

const getUserMailTemplatesPageSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
  nameSearch: z.string().max(255).optional(),
});

const getUserMailTemplateByIdSchema = z.object({
  id: z.string().uuid('ID invalide'),
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

export async function createMailTemplate(
  dispensarySlug: string,
  data: {
    name: string;
    description?: string;
    content: string;
    defaultMailName?: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = createMailTemplateSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();

    const template = await createTemplate(
      {
        type: MAIL_DOCUMENT_TYPE,
        scopeId: dispensaryId,
        ownerId: null,
        name: validatedData.name,
        description: validatedData.description,
        content: validatedData.content,
        metadata: buildMailTemplateMetadata(validatedData.defaultMailName),
      },
      { cookieHeader },
    );

    return {
      status: 201,
      data: templateToMailTemplate(template),
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la création du modèle de courrier');
  }
}

export async function getMailTemplates(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const cookieHeader = await getServerCookieHeader();
    const result = await listTemplates(
      {
        type: MAIL_DOCUMENT_TYPE,
        scopeId: dispensaryId,
        ownerScope: 'org',
        pageSize: 50,
      },
      { cookieHeader },
    );

    return {
      status: 200,
      data: result.items.map(templateToMailTemplate),
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la récupération des modèles de courriers');
  }
}

export async function getManagementMailTemplateById(
  dispensarySlug: string,
  data: { id: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const { id } = getUserMailTemplateByIdSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();
    const template = await getTemplate(id, { cookieHeader });

    if (template.scopeId !== dispensaryId || template.ownerId !== null) {
      return {
        status: 404,
        error: 'Template introuvable',
      };
    }

    return {
      status: 200,
      data: templateToMailTemplate(template),
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la récupération du modèle de courrier');
  }
}

export async function updateMailTemplate(
  dispensarySlug: string,
  data: {
    id: string;
    name: string;
    description?: string;
    content: string;
    defaultMailName?: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = updateMailTemplateSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();
    const existingTemplate = await getTemplate(validatedData.id, { cookieHeader });

    if (existingTemplate.scopeId !== dispensaryId) {
      return {
        status: 404,
        error: 'Template introuvable',
      };
    }

    if (existingTemplate.ownerId !== null) {
      return {
        status: 403,
        error: 'Ce template est un template personnel et ne peut pas être modifié depuis le panneau management',
      };
    }

    const template = await updateTemplate(
      validatedData.id,
      {
        name: validatedData.name,
        description: validatedData.description ?? null,
        content: validatedData.content,
        metadata: buildMailTemplateMetadata(validatedData.defaultMailName) ?? null,
      },
      { cookieHeader },
    );

    return {
      status: 200,
      data: templateToMailTemplate(template),
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la modification du modèle de courrier');
  }
}

export async function deleteMailTemplate(dispensarySlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = deleteMailTemplateSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();
    const existingTemplate = await getTemplate(validatedData.id, { cookieHeader });

    if (existingTemplate.scopeId !== dispensaryId) {
      return {
        status: 404,
        error: 'Template introuvable',
      };
    }

    if (existingTemplate.ownerId !== null) {
      return {
        status: 403,
        error: 'Ce template est un template personnel et ne peut pas être supprimé depuis le panneau management',
      };
    }

    await deleteTemplate(validatedData.id, { cookieHeader });

    return {
      status: 200,
      data: { success: true },
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la suppression du modèle de courrier');
  }
}

export async function generateOrderMailPreview(
  dispensarySlug: string,
  data: {
    orderId?: string;
    order?: OrderMailPreviewSource;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    let order: OrderMailPreviewSource | null = data.order ?? null;

    if (!order) {
      if (!data.orderId) {
        return {
          status: 400,
          error: 'Commande requise pour générer l\'aperçu',
        };
      }

      const dbOrder = await prisma.order.findFirst({
        where: { id: data.orderId, ...tenantWhere(dispensaryId) },
        include: {
          company: {
            select: {
              id: true,
              name: true,
            },
          },
          individualCustomer: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              item: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
            },
          },
        },
      });

      if (!dbOrder) {
        return {
          status: 404,
          error: 'Commande introuvable',
        };
      }

      order = dbOrder;
    }

    const assignment = await prisma.orderMailTemplateAssignment.findUnique({
      where: {
        dispensaryId_orderType_orderStatus: {
          dispensaryId,
          orderType: order.type as OrderType,
          orderStatus: order.status as OrderStatus,
        },
      },
    });

    if (!assignment) {
      return {
        status: 404,
        error: `Aucun modèle de courrier assigné pour le type "${order.type}" et le statut "${order.status}"`,
      };
    }

    const cookieHeader = await getServerCookieHeader();
    const template = await getTemplate(assignment.templateId, { cookieHeader });

    const preview = renderTemplate(template.content, {
      inputs: {},
      username: ctx.session.user.name || 'Utilisateur',
      variables: buildOrderMailVariables(order),
    });

    return {
      status: 200,
      data: {
        preview,
        templateName: template.name,
      },
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la génération de l\'aperçu du courrier');
  }
}

export async function getUserMailTemplatesPage(
  dispensarySlug: string,
  params: {
    page?: number;
    pageSize?: number;
    nameSearch?: string;
  } = {},
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const { page, pageSize, nameSearch } =
      getUserMailTemplatesPageSchema.parse(params);
    const cookieHeader = await getServerCookieHeader();

    const result = await listTemplates(
      {
        type: MAIL_DOCUMENT_TYPE,
        scopeId: dispensaryId,
        ownerScope: 'personal',
        page,
        pageSize,
        nameSearch,
      },
      { cookieHeader },
    );

    return {
      status: 200,
      data: {
        items: result.items.map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          defaultMailName: getDefaultMailName(template.metadata),
          createdAt: new Date(template.createdAt),
          updatedAt: new Date(template.updatedAt),
        })),
        totalCount: result.totalCount,
        page: result.page,
        pageSize: result.pageSize,
      },
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la récupération des modèles de courriers');
  }
}

export async function getUserMailTemplateById(
  dispensarySlug: string,
  data: { id: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const { id } = getUserMailTemplateByIdSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();
    const template = await getTemplate(id, { cookieHeader });

    if (
      template.scopeId !== dispensaryId ||
      template.ownerId !== ctx.session.user.id
    ) {
      return {
        status: 404,
        error: 'Template introuvable',
      };
    }

    return {
      status: 200,
      data: templateToMailTemplate(template),
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la récupération du modèle de courrier');
  }
}

export async function getUserMailTemplateOptions(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const cookieHeader = await getServerCookieHeader();
    const result = await listTemplates(
      {
        type: MAIL_DOCUMENT_TYPE,
        scopeId: dispensaryId,
        ownerScope: 'personal',
        pageSize: 50,
      },
      { cookieHeader },
    );

    return {
      status: 200,
      data: result.items.map((template) => ({
        id: template.id,
        name: template.name,
      })),
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la récupération des modèles de courriers');
  }
}

export async function createUserMailTemplate(
  dispensarySlug: string,
  data: {
    name: string;
    description?: string;
    content: string;
    defaultMailName?: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = createMailTemplateSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();

    const template = await createTemplate(
      {
        type: MAIL_DOCUMENT_TYPE,
        scopeId: dispensaryId,
        ownerId: ctx.session.user.id,
        name: validatedData.name,
        description: validatedData.description,
        content: validatedData.content,
        metadata: buildMailTemplateMetadata(validatedData.defaultMailName),
      },
      { cookieHeader },
    );

    return {
      status: 201,
      data: templateToMailTemplate(template),
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la création du modèle de courrier');
  }
}

export async function updateUserMailTemplate(
  dispensarySlug: string,
  data: {
    id: string;
    name: string;
    description?: string;
    content: string;
    defaultMailName?: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;

    const validatedData = updateMailTemplateSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();
    const existingTemplate = await getTemplate(validatedData.id, { cookieHeader });

    if (existingTemplate.scopeId !== dispensaryId) {
      return {
        status: 404,
        error: 'Template introuvable',
      };
    }

    if (
      existingTemplate.ownerId !== null &&
      existingTemplate.ownerId !== ctx.session.user.id
    ) {
      return {
        status: 403,
        error: 'Vous n\'êtes pas autorisé à modifier ce template',
      };
    }

    if (existingTemplate.ownerId === null) {
      const permResult = requirePermission(
        effectiveRole,
        'application',
        'management',
        'Vous n\'êtes pas autorisé à modifier un template global',
      );
      if (!permResult.ok) return permResult.response;
    }

    const template = await updateTemplate(
      validatedData.id,
      {
        name: validatedData.name,
        description: validatedData.description ?? null,
        content: validatedData.content,
        metadata: buildMailTemplateMetadata(validatedData.defaultMailName) ?? null,
      },
      { cookieHeader },
    );

    return {
      status: 200,
      data: templateToMailTemplate(template),
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la modification du modèle de courrier');
  }
}

export async function deleteUserMailTemplate(dispensarySlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId, effectiveRole } = ctx.tenant;

    const validatedData = deleteMailTemplateSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();
    const existingTemplate = await getTemplate(validatedData.id, { cookieHeader });

    if (existingTemplate.scopeId !== dispensaryId) {
      return {
        status: 404,
        error: 'Template introuvable',
      };
    }

    if (
      existingTemplate.ownerId !== null &&
      existingTemplate.ownerId !== ctx.session.user.id
    ) {
      return {
        status: 403,
        error: 'Vous n\'êtes pas autorisé à supprimer ce template',
      };
    }

    if (existingTemplate.ownerId === null) {
      const permResult = requirePermission(
        effectiveRole,
        'application',
        'management',
        'Vous n\'êtes pas autorisé à supprimer un template global',
      );
      if (!permResult.ok) return permResult.response;
    }

    await deleteTemplate(validatedData.id, { cookieHeader });

    return {
      status: 200,
      data: { success: true },
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la suppression du modèle de courrier');
  }
}
