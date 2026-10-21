'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import {
  deleteMail,
} from '@/app/_actions/mails';
import {
  deleteUserMailTemplate,
} from '@/app/_actions/mailTemplates';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { mailsKeys, mailTemplatesKeys } from '@/lib/mails/queryKeys';
import type {
  Mail,
  MailTemplate,
  MailTemplateOption,
  MailsPageFilters,
  MailsPageResult,
  MailTemplatesPageFilters,
  MailTemplatesPageResult,
} from '@/types/mails';

export const DEFAULT_MAILS_PAGE_SIZE = 10;

export const defaultMailsPageFilters: MailsPageFilters = {
  page: 1,
  pageSize: DEFAULT_MAILS_PAGE_SIZE,
  nameSearch: '',
  receiverSearch: '',
};

export const defaultMailTemplatesPageFilters: MailTemplatesPageFilters = {
  page: 1,
  pageSize: DEFAULT_MAILS_PAGE_SIZE,
  nameSearch: '',
};

function isDefaultMailsPage(filters: MailsPageFilters): boolean {
  return (
    filters.page === 1 &&
    filters.pageSize === DEFAULT_MAILS_PAGE_SIZE &&
    filters.nameSearch === '' &&
    filters.receiverSearch === ''
  );
}

function isDefaultMailTemplatesPage(filters: MailTemplatesPageFilters): boolean {
  return (
    filters.page === 1 &&
    filters.pageSize === DEFAULT_MAILS_PAGE_SIZE &&
    filters.nameSearch === ''
  );
}

async function fetchMailsPage(businessSlug: string, filters: MailsPageFilters) {
  const result = await fetchRead(businessSlug, 'mailsPage', {
    page: filters.page,
    pageSize: filters.pageSize,
    nameSearch: filters.nameSearch || undefined,
    receiverSearch: filters.receiverSearch || undefined,
  });
  return handleAction(result) as MailsPageResult;
}

async function fetchMailTemplatesPage(
  businessSlug: string,
  filters: MailTemplatesPageFilters,
) {
  const result = await fetchRead(businessSlug, 'userMailTemplatesPage', {
    page: filters.page,
    pageSize: filters.pageSize,
    nameSearch: filters.nameSearch || undefined,
  });
  return handleAction(result) as MailTemplatesPageResult;
}

async function fetchMailById(businessSlug: string, mailId: string) {
  const result = await fetchRead(businessSlug, 'mail', { id: mailId });
  return handleAction(result) as Mail;
}

async function fetchUserMailTemplateById(
  businessSlug: string,
  templateId: string,
) {
  const result = await fetchRead(businessSlug, 'userMailTemplate', { id: templateId });
  return handleAction(result) as MailTemplate;
}

async function fetchUserMailTemplateOptions(businessSlug: string) {
  const result = await fetchRead(businessSlug, 'userMailTemplateOptions');
  return handleAction(result) as MailTemplateOption[];
}

export function useMailsPage(
  filters: MailsPageFilters,
  options?: { initialData?: MailsPageResult; enabled?: boolean },
) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: mailsKeys.page(businessSlug, filters),
    queryFn: () => fetchMailsPage(businessSlug, filters),
    initialData:
      options?.initialData && isDefaultMailsPage(filters)
        ? options.initialData
        : undefined,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug) && (options?.enabled ?? true),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useUserMailTemplatesPage(
  filters: MailTemplatesPageFilters,
  options?: { initialData?: MailTemplatesPageResult; enabled?: boolean },
) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: mailTemplatesKeys.page(businessSlug, filters),
    queryFn: () => fetchMailTemplatesPage(businessSlug, filters),
    initialData:
      options?.initialData && isDefaultMailTemplatesPage(filters)
        ? options.initialData
        : undefined,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug) && (options?.enabled ?? true),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useMailDetail(mailId: string | null, enabled: boolean) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: mailsKeys.detail(businessSlug, mailId ?? ''),
    queryFn: () => {
      if (!mailId) throw new Error('mailId is required');
      return fetchMailById(businessSlug, mailId);
    },
    enabled: Boolean(mailId && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useUserMailTemplateDetail(
  templateId: string | null,
  enabled: boolean,
) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: mailTemplatesKeys.detail(businessSlug, templateId ?? ''),
    queryFn: () => {
      if (!templateId) throw new Error('templateId is required');
      return fetchUserMailTemplateById(businessSlug, templateId);
    },
    enabled: Boolean(templateId && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useUserMailTemplateOptions(
  initialData?: MailTemplateOption[],
) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: mailTemplatesKeys.options(businessSlug),
    queryFn: () => fetchUserMailTemplateOptions(businessSlug),
    initialData,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useInvalidateMails() {
  const queryClient = useQueryClient();
  const businessSlug = useRequiredBusinessSlug();

  return () => {
    void queryClient.invalidateQueries({
      queryKey: mailsKeys.all(businessSlug),
    });
  };
}

export function useInvalidateMailTemplates() {
  const queryClient = useQueryClient();
  const businessSlug = useRequiredBusinessSlug();

  return () => {
    void queryClient.invalidateQueries({
      queryKey: mailTemplatesKeys.all(businessSlug),
    });
  };
}

export function useDeleteMailMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const invalidateMails = useInvalidateMails();

  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      const result = await deleteMail(businessSlug, vars);
      handleAction(result);
      return vars;
    },
    onSuccess: () => {
      invalidateMails();
      notifications.show({
        title: 'Succès',
        message: 'Courrier supprimé avec succès',
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

export function useDeleteUserMailTemplateMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const invalidateMailTemplates = useInvalidateMailTemplates();

  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      const result = await deleteUserMailTemplate(businessSlug, vars);
      handleAction(result);
      return vars;
    },
    onSuccess: () => {
      invalidateMailTemplates();
      notifications.show({
        title: 'Succès',
        message: 'Modèle supprimé avec succès',
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
