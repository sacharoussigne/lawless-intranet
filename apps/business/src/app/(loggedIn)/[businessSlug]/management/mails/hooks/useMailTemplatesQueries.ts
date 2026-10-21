'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import {
  createMailTemplate,
  deleteMailTemplate,
  updateMailTemplate,
} from '@/app/_actions/mailTemplates';
import {
  createOrderLetterTemplateAssignment,
  deleteOrderLetterTemplateAssignment,
  updateOrderLetterTemplateAssignment,
} from '@/app/_actions/orderLetterTemplateAssignments';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { mailTemplatesKeys } from '@/lib/mails/queryKeys';
import { ordersKeys } from '@/lib/orders/queryKeys';
import type {
  MailTemplate,
  MailTemplateListItem,
  OrderMailTemplateAssignmentWithTemplate,
} from '@/types/mailTemplates';
import type { OrderStatus, OrderType } from '@lawless-intranet/types';

export type OrderLetterTemplateAssignmentWithTemplate =
  OrderMailTemplateAssignmentWithTemplate;

function toMailTemplateListItem(template: MailTemplate): MailTemplateListItem {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    defaultMailName: template.defaultMailName,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    businessId: template.businessId,
    userId: template.userId,
  };
}

async function fetchManagementMailTemplates(businessSlug: string) {
  const result = await fetchRead(businessSlug, 'mailTemplates');
  return handleAction(result) as MailTemplateListItem[];
}

async function fetchManagementMailTemplateById(businessSlug: string, templateId: string) {
  const result = await fetchRead(businessSlug, 'managementMailTemplate', { id: templateId });
  return handleAction(result) as MailTemplate;
}

async function fetchOrderLetterAssignments(businessSlug: string) {
  const result = await fetchRead(businessSlug, 'orderLetterAssignments');
  return handleAction(result) as OrderLetterTemplateAssignmentWithTemplate[];
}

export function useManagementMailTemplates(initialData: MailTemplateListItem[]) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: mailTemplatesKeys.management(businessSlug),
    queryFn: () => fetchManagementMailTemplates(businessSlug),
    initialData,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useManagementMailTemplateDetail(templateId: string | null, enabled: boolean) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: mailTemplatesKeys.detail(businessSlug, templateId ?? ''),
    queryFn: () => {
      if (!templateId) throw new Error('templateId is required');
      return fetchManagementMailTemplateById(businessSlug, templateId);
    },
    enabled: Boolean(templateId && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useOrderLetterTemplateAssignments(
  initialData: OrderLetterTemplateAssignmentWithTemplate[],
) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: ordersKeys.letterAssignments(businessSlug),
    queryFn: () => fetchOrderLetterAssignments(businessSlug),
    initialData,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

function useManagementMailTemplatesCache() {
  const queryClient = useQueryClient();
  const businessSlug = useRequiredBusinessSlug();
  const queryKey = mailTemplatesKeys.management(businessSlug);

  const updateCache = (updater: (templates: MailTemplateListItem[]) => MailTemplateListItem[]) => {
    queryClient.setQueryData<MailTemplateListItem[]>(queryKey, (current) => {
      if (!current) return current;
      return updater(current).sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
      );
    });
  };

  const invalidateManagement = () => {
    void queryClient.invalidateQueries({ queryKey: mailTemplatesKeys.management(businessSlug) });
  };

  const invalidateAssignments = () => {
    void queryClient.invalidateQueries({ queryKey: ordersKeys.letterAssignments(businessSlug) });
  };

  return { updateCache, invalidateManagement, invalidateAssignments };
}

export function useCreateMailTemplateMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useManagementMailTemplatesCache();

  return useMutation({
    mutationFn: async (vars: {
      name: string;
      description?: string;
      content: string;
      defaultMailName?: string;
    }) => {
      const result = await createMailTemplate(businessSlug, vars);
      return handleAction(result) as MailTemplate;
    },
    onSuccess: (created) => {
      updateCache((templates) => [...templates, toMailTemplateListItem(created)]);
      notifications.show({
        title: 'Succès',
        message: 'Template créé avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      if (error instanceof ParsedZodError) return;
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la création',
        color: 'danger',
      });
    },
  });
}

export function useUpdateMailTemplateMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useManagementMailTemplatesCache();

  return useMutation({
    mutationFn: async (vars: {
      id: string;
      name: string;
      description?: string;
      content: string;
      defaultMailName?: string;
    }) => {
      const result = await updateMailTemplate(businessSlug, vars);
      return handleAction(result) as MailTemplate;
    },
    onSuccess: (updated) => {
      const listItem = toMailTemplateListItem(updated);
      updateCache((templates) =>
        templates.map((template) => (template.id === listItem.id ? listItem : template)),
      );
      notifications.show({
        title: 'Succès',
        message: 'Template modifié avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      if (error instanceof ParsedZodError) return;
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la modification',
        color: 'danger',
      });
    },
  });
}

export function useDeleteMailTemplateMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache } = useManagementMailTemplatesCache();

  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      const result = await deleteMailTemplate(businessSlug, vars);
      handleAction(result);
      return vars.id;
    },
    onSuccess: (deletedId) => {
      updateCache((templates) => templates.filter((template) => template.id !== deletedId));
      notifications.show({
        title: 'Succès',
        message: 'Template supprimé avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la suppression',
        color: 'danger',
      });
    },
  });
}

export function useCreateOrderLetterAssignmentMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { invalidateAssignments } = useManagementMailTemplatesCache();

  return useMutation({
    mutationFn: async (vars: {
      orderType: OrderType;
      orderStatus: OrderStatus;
      mailTemplateId: string;
    }) => {
      const result = await createOrderLetterTemplateAssignment(businessSlug, vars);
      return handleAction(result) as OrderLetterTemplateAssignmentWithTemplate;
    },
    onSuccess: () => {
      invalidateAssignments();
      notifications.show({
        title: 'Succès',
        message: 'Assignation créée avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la création de l\'assignation',
        color: 'danger',
      });
    },
  });
}

export function useUpdateOrderLetterAssignmentMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { invalidateAssignments } = useManagementMailTemplatesCache();

  return useMutation({
    mutationFn: async (vars: { id: string; mailTemplateId: string }) => {
      const result = await updateOrderLetterTemplateAssignment(businessSlug, vars);
      return handleAction(result) as OrderLetterTemplateAssignmentWithTemplate;
    },
    onSuccess: () => {
      invalidateAssignments();
      notifications.show({
        title: 'Succès',
        message: 'Assignation modifiée avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la modification de l\'assignation',
        color: 'danger',
      });
    },
  });
}

export function useDeleteOrderLetterAssignmentMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { invalidateAssignments } = useManagementMailTemplatesCache();

  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      const result = await deleteOrderLetterTemplateAssignment(businessSlug, vars);
      handleAction(result);
      return vars.id;
    },
    onSuccess: () => {
      invalidateAssignments();
      notifications.show({
        title: 'Succès',
        message: 'Assignation supprimée avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la suppression de l\'assignation',
        color: 'danger',
      });
    },
  });
}
