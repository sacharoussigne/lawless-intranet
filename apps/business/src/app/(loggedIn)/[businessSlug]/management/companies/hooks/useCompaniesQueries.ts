'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import {
  createCompany,
  updateCompany,
  deleteCompany,
} from '@/app/_actions/companies';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { companiesKeys } from '@/lib/companies/queryKeys';
import { companyGroupsKeys } from '@/lib/companyGroups/queryKeys';
import { sortCompanies } from '@/lib/companies/sortCompanies';
import type { CompanySelect, CompanyWithRelations } from '@/types/companies';

async function fetchManagementCompanies(businessSlug: string) {
  const result = await fetchRead(businessSlug, 'companies');
  return handleAction(result) as CompanyWithRelations[];
}

async function fetchCompaniesForSelect(businessSlug: string) {
  const result = await fetchRead(businessSlug, 'companiesForSelect');
  return handleAction(result) as CompanySelect[];
}

export function useManagementCompanies(initialData: CompanyWithRelations[]) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: companiesKeys.management(businessSlug),
    queryFn: () => fetchManagementCompanies(businessSlug),
    initialData,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useCompaniesForSelect(initialData?: CompanySelect[]) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: companiesKeys.select(businessSlug),
    queryFn: () => fetchCompaniesForSelect(businessSlug),
    initialData,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

function useManagementCompaniesCache() {
  const queryClient = useQueryClient();
  const businessSlug = useRequiredBusinessSlug();

  const queryKey = companiesKeys.management(businessSlug);

  const updateCache = (updater: (companies: CompanyWithRelations[]) => CompanyWithRelations[]) => {
    queryClient.setQueryData<CompanyWithRelations[]>(queryKey, (current) => {
      if (!current) return current;
      return sortCompanies(updater(current));
    });
  };

  const invalidateSelect = () => {
    queryClient.invalidateQueries({ queryKey: companiesKeys.select(businessSlug) });
  };

  const invalidateCompanyGroups = () => {
    queryClient.invalidateQueries({ queryKey: companyGroupsKeys.management(businessSlug) });
    queryClient.invalidateQueries({ queryKey: companyGroupsKeys.select(businessSlug) });
    queryClient.invalidateQueries({ queryKey: companyGroupsKeys.forOrders(businessSlug) });
  };

  return { updateCache, invalidateSelect, invalidateCompanyGroups };
}

export function useCreateCompanyMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache, invalidateSelect, invalidateCompanyGroups } = useManagementCompaniesCache();

  return useMutation({
    mutationFn: async (vars: {
      name: string;
      bankAccountNumber?: string | null;
      companyGroupIds?: string[];
    }) => {
      const result = await createCompany(businessSlug, vars);
      return handleAction(result) as CompanyWithRelations;
    },
    onSuccess: (created) => {
      updateCache((companies) => [...companies, created]);
      invalidateSelect();
      invalidateCompanyGroups();
      notifications.show({
        title: 'Succès',
        message: 'Entreprise créée avec succès',
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

export function useUpdateCompanyMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache, invalidateSelect, invalidateCompanyGroups } = useManagementCompaniesCache();

  return useMutation({
    mutationFn: async (vars: {
      id: string;
      name: string;
      bankAccountNumber?: string | null;
      companyGroupIds?: string[];
    }) => {
      const result = await updateCompany(businessSlug, vars);
      return handleAction(result) as CompanyWithRelations;
    },
    onSuccess: (updated) => {
      updateCache((companies) =>
        companies.map((company) => (company.id === updated.id ? updated : company)),
      );
      invalidateSelect();
      invalidateCompanyGroups();
      notifications.show({
        title: 'Succès',
        message: 'Entreprise modifiée avec succès',
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

export function useDeleteCompanyMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const { updateCache, invalidateSelect, invalidateCompanyGroups } = useManagementCompaniesCache();

  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      const result = await deleteCompany(businessSlug, vars);
      handleAction(result);
      return vars;
    },
    onSuccess: ({ id }) => {
      updateCache((companies) => companies.filter((company) => company.id !== id));
      invalidateSelect();
      invalidateCompanyGroups();
      notifications.show({
        title: 'Succès',
        message: 'Entreprise supprimée avec succès',
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
