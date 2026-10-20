'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import {
  createCompanyGroup,
  updateCompanyGroup,
  deleteCompanyGroup,
} from '@/app/_actions/companyGroups';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { companyGroupsKeys } from '@/lib/companyGroups/queryKeys';
import { companiesKeys } from '@/lib/companies/queryKeys';
import { sortCompanyGroups } from '@/lib/companyGroups/sortCompanyGroups';
import type { CompanyGroupForOrders, CompanyGroupWithRelations } from '@/types/companyGroups';
import type { CompanyGroupSelect } from '@/types/items';

async function fetchManagementCompanyGroups(businessSlug: string) {
  const result = await fetchRead(businessSlug, 'companyGroups');
  return handleAction(result) as CompanyGroupWithRelations[];
}

async function fetchCompanyGroupsForSelect(businessSlug: string) {
  const result = await fetchRead(businessSlug, 'companyGroupsForSelect');
  return handleAction(result) as CompanyGroupSelect[];
}

async function fetchCompanyGroupsForOrders(businessSlug: string) {
  const result = await fetchRead(businessSlug, 'companyGroupsForOrders');
  return handleAction(result) as CompanyGroupForOrders[];
}

export function useManagementCompanyGroups(initialData: CompanyGroupWithRelations[]) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: companyGroupsKeys.management(businessSlug),
    queryFn: () => fetchManagementCompanyGroups(businessSlug),
    initialData,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useCompanyGroupsForSelect(initialData?: CompanyGroupSelect[]) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: companyGroupsKeys.select(businessSlug),
    queryFn: () => fetchCompanyGroupsForSelect(businessSlug),
    initialData,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useCompanyGroupsForOrders(enabled: boolean) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: companyGroupsKeys.forOrders(businessSlug),
    queryFn: () => fetchCompanyGroupsForOrders(businessSlug),
    enabled: Boolean(businessSlug) && enabled,
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

function useManagementCompanyGroupsCache() {
  const queryClient = useQueryClient();
  const businessSlug = useRequiredBusinessSlug();

  const queryKey = companyGroupsKeys.management(businessSlug);

  const updateCache = (
    updater: (companyGroups: CompanyGroupWithRelations[]) => CompanyGroupWithRelations[],
  ) => {
    queryClient.setQueryData<CompanyGroupWithRelations[]>(queryKey, (current) => {
      if (!current) return current;
      return sortCompanyGroups(updater(current));
    });
  };

  const invalidateForOrders = () => {
    queryClient.invalidateQueries({ queryKey: companyGroupsKeys.forOrders(businessSlug) });
  };

  const invalidateCompaniesManagement = () => {
    queryClient.invalidateQueries({ queryKey: companiesKeys.management(businessSlug) });
  };

  const invalidateSelect = () => {
    queryClient.invalidateQueries({ queryKey: companyGroupsKeys.select(businessSlug) });
  };

  return { updateCache, invalidateForOrders, invalidateCompaniesManagement, invalidateSelect };
}

export function useCreateCompanyGroupMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache, invalidateForOrders, invalidateCompaniesManagement, invalidateSelect } =
    useManagementCompanyGroupsCache();

  return useMutation({
    mutationFn: async (vars: {
      name: string;
      description?: string;
      companyIds?: string[];
    }) => {
      const result = await createCompanyGroup(businessSlug, vars);
      return handleAction(result) as CompanyGroupWithRelations;
    },
    onSuccess: (created) => {
      updateCache((companyGroups) => [...companyGroups, created]);
      invalidateForOrders();
      invalidateCompaniesManagement();
      invalidateSelect();
      notifications.show({
        title: 'Succès',
        message: 'Groupe d\'entreprises créé avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      if (error instanceof ParsedZodError) return;
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la sauvegarde',
        color: 'danger',
      });
    },
  });
}

export function useUpdateCompanyGroupMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache, invalidateForOrders, invalidateCompaniesManagement } =
    useManagementCompanyGroupsCache();

  return useMutation({
    mutationFn: async (vars: {
      id: string;
      name: string;
      description?: string;
      companyIds?: string[];
    }) => {
      const result = await updateCompanyGroup(businessSlug, vars);
      return handleAction(result) as CompanyGroupWithRelations;
    },
    onSuccess: (updated) => {
      updateCache((companyGroups) =>
        companyGroups.map((companyGroup) =>
          companyGroup.id === updated.id ? updated : companyGroup,
        ),
      );
      invalidateForOrders();
      invalidateCompaniesManagement();
      notifications.show({
        title: 'Succès',
        message: 'Groupe d\'entreprises modifié avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      if (error instanceof ParsedZodError) return;
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la sauvegarde',
        color: 'danger',
      });
    },
  });
}

export function useDeleteCompanyGroupMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache, invalidateForOrders, invalidateCompaniesManagement, invalidateSelect } =
    useManagementCompanyGroupsCache();

  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      const result = await deleteCompanyGroup(businessSlug, vars);
      handleAction(result);
      return vars;
    },
    onSuccess: ({ id }) => {
      updateCache((companyGroups) => companyGroups.filter((companyGroup) => companyGroup.id !== id));
      invalidateForOrders();
      invalidateCompaniesManagement();
      invalidateSelect();
      notifications.show({
        title: 'Succès',
        message: 'Groupe d\'entreprises supprimé avec succès',
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
