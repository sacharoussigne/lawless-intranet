'use server';

import { getBusinessUserName } from '@/lib/people/userProfiles';
import { loggedAction } from '@/lib/logs/writer';
import { serviceActionError } from '@/lib/serviceAction';
import { z } from 'zod/v3';
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from '@lawless-intranet/documents-client/server';
import {
  getOrderById,
  getOrderMailAssignment,
} from '@lawless-intranet/inventory-client/server';
import { InventoryClientError } from '@lawless-intranet/inventory-client';
import type { OrderStatus, OrderType } from '@lawless-intranet/types';
import { requirePermission, requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { getMemberDescription } from '@/lib/business/memberDescription';
import { inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import { renderTemplate, buildUserTemplateRenderContext } from '@lawless-intranet/mail-template-engine';
import {
  buildOrderMailVariables,
  type OrderMailPreviewSource,
} from '@/lib/mailTemplate/buildOrderMailVariables';
import {
  buildMailTemplateMetadata,
  getDefaultMailName,
  getServerCookieHeader,
  MAIL_DOCUMENT_TYPE,
  ORDER_TEMPLATE_TYPE,
  resolveMailTemplateAccess,
  attachOwnerNames,
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


async function createMailTemplateUnlogged(
  businessSlug: string,
  data: {
    name: string;
    description?: string;
    content: string;
    defaultMailName?: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = createMailTemplateSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();

    const template = await createTemplate(
      {
        type: ORDER_TEMPLATE_TYPE,
        scopeId: businessId,
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
    return serviceActionError(error, 'Erreur lors de la création du modèle de courrier');
  }
}

export async function getMailTemplates(businessSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const cookieHeader = await getServerCookieHeader();
    const result = await listTemplates(
      {
        type: ORDER_TEMPLATE_TYPE,
        scopeId: businessId,
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
    return serviceActionError(error, 'Erreur lors de la récupération des modèles de courriers');
  }
}

export async function getManagementMailTemplateById(
  businessSlug: string,
  data: { id: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const { id } = getUserMailTemplateByIdSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();
    const template = await getTemplate(id, { cookieHeader });

    if (
      template.scopeId !== businessId ||
      template.ownerId !== null ||
      template.type !== ORDER_TEMPLATE_TYPE
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
    return serviceActionError(error, 'Erreur lors de la récupération du modèle de courrier');
  }
}

async function updateMailTemplateUnlogged(
  businessSlug: string,
  data: {
    id: string;
    name: string;
    description?: string;
    content: string;
    defaultMailName?: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = updateMailTemplateSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();
    const existingTemplate = await getTemplate(validatedData.id, { cookieHeader });

    if (existingTemplate.scopeId !== businessId) {
      return {
        status: 404,
        error: 'Template introuvable',
      };
    }

    if (
      existingTemplate.ownerId !== null ||
      existingTemplate.type !== ORDER_TEMPLATE_TYPE
    ) {
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
    return serviceActionError(error, 'Erreur lors de la modification du modèle de courrier');
  }
}

async function deleteMailTemplateUnlogged(businessSlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = deleteMailTemplateSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();
    const existingTemplate = await getTemplate(validatedData.id, { cookieHeader });

    if (existingTemplate.scopeId !== businessId) {
      return {
        status: 404,
        error: 'Template introuvable',
      };
    }

    if (
      existingTemplate.ownerId !== null ||
      existingTemplate.type !== ORDER_TEMPLATE_TYPE
    ) {
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
    return serviceActionError(error, 'Erreur lors de la suppression du modèle de courrier');
  }
}

export async function generateOrderMailPreview(
  businessSlug: string,
  data: {
    orderId?: string;
    order?: OrderMailPreviewSource;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    let order: OrderMailPreviewSource | null = data.order ?? null;

    if (!order) {
      if (!data.orderId) {
        return {
          status: 400,
          error: 'Commande requise pour générer l\'aperçu',
        };
      }

      try {
        const dbOrder = await getOrderById(
          { ...inventoryScope(businessId), id: data.orderId },
          await inventoryCookie(),
        );

        order = {
          type: dbOrder.type,
          status: dbOrder.status,
          price: dbOrder.price,
          company: dbOrder.company ? { name: dbOrder.company.name } : null,
          individualCustomer: dbOrder.individualCustomer
            ? { name: dbOrder.individualCustomer.name }
            : null,
          items: (dbOrder.items ?? []).map((orderItem) => ({
            quantity: orderItem.quantity,
            item: { name: orderItem.item?.name ?? '' },
          })),
        };
      } catch (error) {
        if (error instanceof InventoryClientError && error.status === 404) {
          return {
            status: 404,
            error: 'Commande introuvable',
          };
        }
        return serviceActionError(error, 'Erreur lors de la récupération de la commande');
      }
    }

    let assignment;
    try {
      assignment = await getOrderMailAssignment(
        {
          ...inventoryScope(businessId),
          orderType: order.type as OrderType,
          orderStatus: order.status as OrderStatus,
        },
        await inventoryCookie(),
      );
    } catch (error) {
      return serviceActionError(error, 'Erreur lors de la récupération de l\'assignation de courrier');
    }

    if (!assignment) {
      return {
        status: 404,
        error: `Aucun modèle de courrier assigné pour le type "${order.type}" et le statut "${order.status}"`,
      };
    }

    const cookieHeader = await getServerCookieHeader();
    const template = await getTemplate(assignment.templateId, { cookieHeader });
    const memberDescription =
      (await getMemberDescription(businessId, ctx.session.user.id)) ?? '';

    const preview = renderTemplate(
      template.content,
      buildUserTemplateRenderContext({
        inputs: {},
        username: await getBusinessUserName(
          ctx.tenant.businessId,
          ctx.session.user.id,
          ctx.session.user.name || 'Utilisateur',
        ),
        userDescription: memberDescription,
        userGender: ctx.session.user.gender ?? 'male',
        variables: buildOrderMailVariables(order),
      }),
    );

    return {
      status: 200,
      data: {
        preview,
        templateContent: template.content,
        templateName: template.name,
      },
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la génération de l\'aperçu du courrier');
  }
}

export async function getUserMailTemplatesPage(
  businessSlug: string,
  params: {
    page?: number;
    pageSize?: number;
    nameSearch?: string;
  } = {},
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const { page, pageSize, nameSearch } =
      getUserMailTemplatesPageSchema.parse(params);
    const cookieHeader = await getServerCookieHeader();

    const result = await listTemplates(
      {
        type: MAIL_DOCUMENT_TYPE,
        scopeId: businessId,
        ownerScope: 'accessible',
        page,
        pageSize,
        nameSearch,
      },
      { cookieHeader },
    );

    const mappedItems = result.items.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      defaultMailName: getDefaultMailName(template.metadata),
      createdAt: new Date(template.createdAt),
      updatedAt: new Date(template.updatedAt),
      userId: template.ownerId,
      ...resolveMailTemplateAccess(template, ctx.session.user.id),
    }));

    return {
      status: 200,
      data: {
        items: await attachOwnerNames(ctx.tenant.businessId, mappedItems),
        totalCount: result.totalCount,
        page: result.page,
        pageSize: result.pageSize,
      },
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des modèles de courriers');
  }
}

export async function getUserMailTemplateById(
  businessSlug: string,
  data: { id: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const { id } = getUserMailTemplateByIdSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();
    const template = await getTemplate(id, { cookieHeader });

    if (template.scopeId !== businessId || template.ownerId === null) {
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
    return serviceActionError(error, 'Erreur lors de la récupération du modèle de courrier');
  }
}

export async function getUserMailTemplateOptions(businessSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const cookieHeader = await getServerCookieHeader();
    const result = await listTemplates(
      {
        type: MAIL_DOCUMENT_TYPE,
        scopeId: businessId,
        ownerScope: 'accessible',
        pageSize: 50,
      },
      { cookieHeader },
    );

    return {
      status: 200,
      data: result.items.map((template) => {
        const access = resolveMailTemplateAccess(template, ctx.session.user.id);
        return {
          id: template.id,
          name: template.name,
          isSharedWithMe: access.isSharedWithMe,
        };
      }),
    };
  } catch (error) {
    return serviceActionError(error, 'Erreur lors de la récupération des modèles de courriers');
  }
}

async function createUserMailTemplateUnlogged(
  businessSlug: string,
  data: {
    name: string;
    description?: string;
    content: string;
    defaultMailName?: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId } = ctx.tenant;

    const validatedData = createMailTemplateSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();

    const template = await createTemplate(
      {
        type: MAIL_DOCUMENT_TYPE,
        scopeId: businessId,
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
    return serviceActionError(error, 'Erreur lors de la création du modèle de courrier');
  }
}

async function updateUserMailTemplateUnlogged(
  businessSlug: string,
  data: {
    id: string;
    name: string;
    description?: string;
    content: string;
    defaultMailName?: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId, effectiveRole } = ctx.tenant;

    const validatedData = updateMailTemplateSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();
    const existingTemplate = await getTemplate(validatedData.id, { cookieHeader });

    if (existingTemplate.scopeId !== businessId) {
      return {
        status: 404,
        error: 'Template introuvable',
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
    return serviceActionError(error, 'Erreur lors de la modification du modèle de courrier');
  }
}

async function deleteUserMailTemplateUnlogged(businessSlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { businessId, effectiveRole } = ctx.tenant;

    const validatedData = deleteMailTemplateSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();
    const existingTemplate = await getTemplate(validatedData.id, { cookieHeader });

    if (existingTemplate.scopeId !== businessId) {
      return {
        status: 404,
        error: 'Template introuvable',
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
    return serviceActionError(error, 'Erreur lors de la suppression du modèle de courrier');
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function createMailTemplate(...args: Parameters<typeof createMailTemplateUnlogged>) {
  return loggedAction({ feature: 'mails', event: 'mailTemplates.createMailTemplate' }, args, () =>
    createMailTemplateUnlogged(...args),
  );
}

export async function updateMailTemplate(...args: Parameters<typeof updateMailTemplateUnlogged>) {
  return loggedAction({ feature: 'mails', event: 'mailTemplates.updateMailTemplate' }, args, () =>
    updateMailTemplateUnlogged(...args),
  );
}

export async function deleteMailTemplate(...args: Parameters<typeof deleteMailTemplateUnlogged>) {
  return loggedAction({ feature: 'mails', event: 'mailTemplates.deleteMailTemplate' }, args, () =>
    deleteMailTemplateUnlogged(...args),
  );
}

export async function createUserMailTemplate(
  ...args: Parameters<typeof createUserMailTemplateUnlogged>
) {
  return loggedAction(
    { feature: 'mails', event: 'mailTemplates.createUserMailTemplate' },
    args,
    () => createUserMailTemplateUnlogged(...args),
  );
}

export async function updateUserMailTemplate(
  ...args: Parameters<typeof updateUserMailTemplateUnlogged>
) {
  return loggedAction(
    { feature: 'mails', event: 'mailTemplates.updateUserMailTemplate' },
    args,
    () => updateUserMailTemplateUnlogged(...args),
  );
}

export async function deleteUserMailTemplate(
  ...args: Parameters<typeof deleteUserMailTemplateUnlogged>
) {
  return loggedAction(
    { feature: 'mails', event: 'mailTemplates.deleteUserMailTemplate' },
    args,
    () => deleteUserMailTemplateUnlogged(...args),
  );
}
