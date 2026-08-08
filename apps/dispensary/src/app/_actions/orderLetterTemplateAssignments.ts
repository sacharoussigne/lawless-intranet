'use server';

import { z } from 'zod/v3';
import { getTemplate } from '@lawless-intranet/documents-client/server';
import { DocumentsClientError } from '@lawless-intranet/documents-client';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { inventoryActionError, inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import {
  createOrderMailAssignment,
  deleteOrderMailAssignment,
  getOrderMailAssignment,
  listOrderMailAssignments,
  updateOrderMailAssignment,
} from '@lawless-intranet/inventory-client/server';
import type { OrderType, OrderStatus } from '@lawless-intranet/inventory-client';
import { getServerCookieHeader, ORDER_TEMPLATE_TYPE } from '@/lib/documents/mailDocuments';

const createAssignmentSchema = z.object({
  orderType: z.enum(['INCOMING', 'OUTGOING']),
  orderStatus: z.enum(['DRAFT', 'LETTER_SENT', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED']),
  mailTemplateId: z.string().uuid('ID de template invalide'),
});

const updateAssignmentSchema = z.object({
  id: z.string().uuid('ID invalide'),
  mailTemplateId: z.string().uuid('ID de template invalide'),
});

const deleteAssignmentSchema = z.object({
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

async function validateOrgTemplate(
  templateId: string,
  dispensaryId: string,
  cookieHeader: string | null,
) {
  const template = await getTemplate(templateId, { cookieHeader });

  if (
    template.type !== ORDER_TEMPLATE_TYPE ||
    template.scopeId !== dispensaryId ||
    template.ownerId !== null
  ) {
    return null;
  }

  return template;
}

function withTemplateSummary<T extends { templateId: string }>(
  assignment: T,
  template: { id: string; name: string } | null,
) {
  return {
    ...assignment,
    mailTemplate: template,
  };
}

function assignmentActionError(error: unknown, fallback: string) {
  try {
    return inventoryActionError(error, fallback);
  } catch (e) {
    return documentsActionError(e, fallback);
  }
}

export async function createOrderLetterTemplateAssignment(
  dispensarySlug: string,
  data: {
    orderType: OrderType;
    orderStatus: OrderStatus;
    mailTemplateId: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = createAssignmentSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();

    const template = await validateOrgTemplate(
      validatedData.mailTemplateId,
      dispensaryId,
      cookieHeader,
    );

    if (!template) {
      return {
        status: 404,
        error: 'Modèle de courrier introuvable',
      };
    }

    const assignment = await createOrderMailAssignment(
      {
        ...inventoryScope(dispensaryId),
        orderType: validatedData.orderType,
        orderStatus: validatedData.orderStatus,
        templateId: validatedData.mailTemplateId,
      },
      await inventoryCookie(),
    );

    return {
      status: 201,
      data: withTemplateSummary(assignment, {
        id: template.id,
        name: template.name,
      }),
    };
  } catch (error) {
    return assignmentActionError(error, 'Erreur lors de la création de l\'assignation');
  }
}

export async function getOrderLetterTemplateAssignments(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const assignments = await listOrderMailAssignments(
      inventoryScope(dispensaryId),
      await inventoryCookie(),
    );

    const cookieHeader = await getServerCookieHeader();
    const templateIds = [...new Set(assignments.map((assignment) => assignment.templateId))];
    const templates = await Promise.all(
      templateIds.map(async (templateId) => {
        try {
          const template = await getTemplate(templateId, { cookieHeader });
          return { id: template.id, name: template.name };
        } catch {
          return null;
        }
      }),
    );
    const templateMap = new Map(
      templates.filter(Boolean).map((template) => [template!.id, template!]),
    );

    return {
      status: 200,
      data: assignments.map((assignment) =>
        withTemplateSummary(
          assignment,
          templateMap.get(assignment.templateId) ?? null,
        ),
      ),
    };
  } catch (error) {
    return assignmentActionError(error, 'Erreur lors de la récupération des assignations');
  }
}

export async function getOrderLetterTemplateAssignmentByTypeAndStatus(
  dispensarySlug: string,
  data: {
    orderType: OrderType;
    orderStatus: OrderStatus;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const assignment = await getOrderMailAssignment(
      {
        ...inventoryScope(dispensaryId),
        orderType: data.orderType,
        orderStatus: data.orderStatus,
      },
      await inventoryCookie(),
    );

    if (!assignment) {
      return {
        status: 200,
        data: null,
      };
    }

    const cookieHeader = await getServerCookieHeader();
    let template = null;
    try {
      template = await getTemplate(assignment.templateId, { cookieHeader });
    } catch {
      template = null;
    }

    return {
      status: 200,
      data: withTemplateSummary(
        assignment,
        template ? { id: template.id, name: template.name } : null,
      ),
    };
  } catch (error) {
    return assignmentActionError(error, 'Erreur lors de la récupération de l\'assignation');
  }
}

export async function updateOrderLetterTemplateAssignment(
  dispensarySlug: string,
  data: {
    id: string;
    mailTemplateId: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = updateAssignmentSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();

    const template = await validateOrgTemplate(
      validatedData.mailTemplateId,
      dispensaryId,
      cookieHeader,
    );

    if (!template) {
      return {
        status: 404,
        error: 'Modèle de courrier introuvable',
      };
    }

    const assignment = await updateOrderMailAssignment(
      {
        ...inventoryScope(dispensaryId),
        id: validatedData.id,
        templateId: validatedData.mailTemplateId,
      },
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: withTemplateSummary(assignment, {
        id: template.id,
        name: template.name,
      }),
    };
  } catch (error) {
    return assignmentActionError(error, 'Erreur lors de la modification de l\'assignation');
  }
}

export async function deleteOrderLetterTemplateAssignment(
  dispensarySlug: string,
  data: { id: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = deleteAssignmentSchema.parse(data);
    await deleteOrderMailAssignment(
      { ...inventoryScope(dispensaryId), ...validatedData },
      await inventoryCookie(),
    );

    return {
      status: 200,
      data: { success: true },
    };
  } catch (error) {
    return assignmentActionError(error, 'Erreur lors de la suppression de l\'assignation');
  }
}
