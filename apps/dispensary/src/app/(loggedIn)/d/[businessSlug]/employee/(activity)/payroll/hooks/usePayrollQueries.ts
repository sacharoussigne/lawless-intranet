'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';
import { useTenantRoutes, useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import {
  createPayrollReportFromForm,
  deletePayrollReport,
  updatePayrollReportResultJson,
  type PayrollPerson,
} from '@/app/_actions/payrollReports';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import type {
  SerializedPayrollReportDetail,
  SerializedPayrollReportListItem,
} from '@/lib/payroll/apiRow';
import { payrollKeys } from '@/lib/payroll/queryKeys';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import type { PayrollReportResult } from '@/lib/payroll/schema';

export type PayrollReportListItem = SerializedPayrollReportListItem;
export type PayrollReportDetail = SerializedPayrollReportDetail;

export type PayrollImportableWeek = {
  weekStart: string;
  periodStart: string;
  periodEnd: string;
};

async function fetchPayrollReports(businessSlug: string): Promise<PayrollReportListItem[]> {
  const result = await fetchRead(businessSlug, 'payrollReports');
  const data = handleAction(result) as { reports?: PayrollReportListItem[] } | undefined;
  return data?.reports ?? [];
}

async function fetchPayrollReportDetail(
  businessSlug: string,
  reportId: string,
): Promise<PayrollReportDetail> {
  const result = await fetchRead(businessSlug, 'payrollReport', { id: reportId });
  const data = handleAction(result) as { report?: PayrollReportDetail } | undefined;
  if (!data?.report) {
    throw new Error('Rapport introuvable');
  }
  return data.report;
}

async function fetchPayrollImportableActivityWeeks(
  businessSlug: string,
): Promise<PayrollImportableWeek[]> {
  const result = await fetchRead(businessSlug, 'payrollImportableWeeks');
  const data = handleAction(result) as { weeks?: PayrollImportableWeek[] } | undefined;
  return data?.weeks ?? [];
}

export function usePayrollReports(initialReports?: PayrollReportListItem[]) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: payrollKeys.list(businessSlug),
    queryFn: () => fetchPayrollReports(businessSlug),
    initialData: initialReports,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function usePayrollReportDetail(
  reportId: string,
  initialReport?: PayrollReportDetail,
) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: payrollKeys.detail(businessSlug, reportId),
    queryFn: () => fetchPayrollReportDetail(businessSlug, reportId),
    initialData: initialReport,
    enabled: Boolean(businessSlug && reportId),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function usePayrollImportableActivityWeeks(enabled: boolean) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: payrollKeys.importableActivityWeeks(businessSlug),
    queryFn: () => fetchPayrollImportableActivityWeeks(businessSlug),
    enabled: Boolean(businessSlug && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

async function fetchPayrollPeople(businessSlug: string): Promise<PayrollPerson[]> {
  const result = await fetchRead(businessSlug, 'payrollPeople');
  const data = handleAction(result) as { people?: PayrollPerson[] } | undefined;
  return data?.people ?? [];
}

/** People of the dispensary offered when adding someone to a report (edit mode). */
export function usePayrollPeople(enabled: boolean) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: payrollKeys.people(businessSlug),
    queryFn: () => fetchPayrollPeople(businessSlug),
    enabled: Boolean(businessSlug && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useInvalidatePayroll() {
  const queryClient = useQueryClient();
  const businessSlug = useRequiredBusinessSlug();

  return {
    invalidateList: () => {
      void queryClient.invalidateQueries({ queryKey: payrollKeys.list(businessSlug) });
    },
    invalidateDetail: (reportId: string) => {
      void queryClient.invalidateQueries({
        queryKey: payrollKeys.detail(businessSlug, reportId),
      });
    },
    invalidateAll: () => {
      void queryClient.invalidateQueries({ queryKey: payrollKeys.all(businessSlug) });
    },
  };
}

export function useCreatePayrollReportMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const routes = useTenantRoutes();
  const router = useRouter();
  const { invalidateList } = useInvalidatePayroll();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const result = await createPayrollReportFromForm(businessSlug, formData);
      const data = handleAction(result) as { id?: string } | undefined;
      return data?.id ?? null;
    },
    onSuccess: (reportId) => {
      invalidateList();
      notifications.show({ title: 'Rapport créé', message: 'Analyse terminée.', color: 'moss' });
      router.push(
        reportId ? routes.employee.payrollDetail(reportId) : routes.employee.payroll,
      );
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur inconnue',
        color: 'danger',
      });
    },
  });
}

export function useUpdatePayrollReportMutation(reportId: string) {
  const businessSlug = useRequiredBusinessSlug();
  const queryClient = useQueryClient();
  const { invalidateList } = useInvalidatePayroll();

  return useMutation({
    mutationFn: async (resultJson: PayrollReportResult) => {
      const result = await updatePayrollReportResultJson(businessSlug, reportId, resultJson);
      const data = handleAction(result) as { resultJson?: PayrollReportResult } | undefined;
      return data?.resultJson ?? resultJson;
    },
    onSuccess: (resultJson) => {
      queryClient.setQueryData<PayrollReportDetail>(
        payrollKeys.detail(businessSlug, reportId),
        (prev) => (prev ? { ...prev, resultJson } : prev),
      );
      invalidateList();
      notifications.show({ title: 'Enregistré', message: '', color: 'moss' });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur inconnue',
        color: 'danger',
      });
    },
  });
}

export function useDeletePayrollReportMutation(options?: { redirectToList?: boolean }) {
  const businessSlug = useRequiredBusinessSlug();
  const routes = useTenantRoutes();
  const router = useRouter();
  const { invalidateList } = useInvalidatePayroll();

  return useMutation({
    mutationFn: async (reportId: string) => {
      const result = await deletePayrollReport(businessSlug, reportId);
      handleAction(result);
      return reportId;
    },
    onSuccess: () => {
      invalidateList();
      notifications.show({ title: 'Rapport supprimé', message: '', color: 'moss' });
      if (options?.redirectToList) {
        router.push(routes.employee.payroll);
      }
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur inconnue',
        color: 'danger',
      });
    },
  });
}
