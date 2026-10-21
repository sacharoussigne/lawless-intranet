'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import {
  completeOrder,
  createOrder,
  deleteOrder,
  updateOrder,
} from '@/app/_actions/orders';
import { fetchRead } from '@/lib/read/fetchRead';
import { handleAction } from '@/lib/action';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import {
  ordersKeys,
  defaultOrdersPageFilters,
  defaultActiveOrdersPageFilters,
  type OrdersPageFilters,
} from '@/lib/orders/queryKeys';
import { realtimeMutationMeta } from '@lawless-intranet/realtime';
import { useOptionalRealtimeSocket, useRealtimeSocketResync } from '@lawless-intranet/realtime/socket';
import { useOrdersRealtime } from '@/lib/orders/realtime/client/useOrdersRealtime';
import { stockKeys } from '@/lib/stock/queryKeys';
import { normalizeItemPrice } from '@/lib/orders/calculateOrderPriceFromItems';
import type { OrdersPageResult, OrderWithRelations } from '@/types/orders';
import type { ItemWithRelations } from '@/types/stock';
import type { OrderMailTemplateAssignment } from '@/types/mailTemplates';

export { defaultOrdersPageFilters, defaultActiveOrdersPageFilters };

function filtersMatchSeed(filters: OrdersPageFilters, seed: OrdersPageFilters): boolean {
  return (
    filters.page === seed.page &&
    filters.pageSize === seed.pageSize &&
    filters.type === seed.type &&
    filters.search === seed.search &&
    filters.createdAtFrom === seed.createdAtFrom &&
    filters.createdAtTo === seed.createdAtTo &&
    filters.mine === seed.mine &&
    filters.status.length === seed.status.length &&
    filters.status.every((status, index) => status === seed.status[index])
  );
}

async function fetchOrdersPage(businessSlug: string, filters: OrdersPageFilters) {
  const result = await fetchRead(businessSlug, 'ordersPage', {
    page: filters.page,
    pageSize: filters.pageSize,
    status: filters.status as Array<
      'DRAFT' | 'LETTER_SENT' | 'PROCESSING' | 'READY' | 'COMPLETED' | 'CANCELLED'
    >,
    type: filters.type as 'INCOMING' | 'OUTGOING' | null | undefined,
    search: filters.search || undefined,
    createdAtFrom: filters.createdAtFrom,
    createdAtTo: filters.createdAtTo,
    mine: filters.mine || undefined,
  });
  return handleAction(result) as OrdersPageResult;
}

async function fetchOrderById(businessSlug: string, orderId: string) {
  const result = await fetchRead(businessSlug, 'order', { id: orderId });
  return handleAction(result) as OrderWithRelations;
}

async function fetchActiveOrdersForGroup(
  businessSlug: string,
  companyGroupId: string,
) {
  const result = await fetchRead(businessSlug, 'activeOrdersForCompanyGroup', {
    companyGroupId,
  });
  return handleAction(result);
}

async function fetchOrderLetterAssignments(businessSlug: string) {
  const result = await fetchRead(businessSlug, 'orderLetterAssignments');
  return handleAction(result) as OrderMailTemplateAssignment[];
}

async function fetchOrderFormItems(
  businessSlug: string,
  companyGroupId: string | null,
) {
  const result = await fetchRead(businessSlug, 'items', companyGroupId ? { companyGroupId } : {});
  const itemsData = handleAction(result);
  if (!itemsData) {
    return [];
  }
  return itemsData.map(
    (item) =>
      ({
        ...item,
        stockToday: null,
        stockYesterday: null,
        stockPreviousAt: null,
        price: normalizeItemPrice(item.price),
        canBeSold: item.canBeSold ?? false,
      }) as ItemWithRelations,
  );
}

export function useOrdersPage(
  filters: OrdersPageFilters,
  initialData?: OrdersPageResult,
  seedFilters: OrdersPageFilters = defaultOrdersPageFilters,
) {
  const businessSlug = useRequiredBusinessSlug();
  const seededInitialData =
    initialData && filtersMatchSeed(filters, seedFilters) ? initialData : undefined;

  return useQuery({
    queryKey: ordersKeys.page(businessSlug, filters),
    queryFn: () => fetchOrdersPage(businessSlug, filters),
    initialData: seededInitialData,
    // RSC payload can be router-cached; never treat it as fresh after mount.
    initialDataUpdatedAt: seededInitialData ? 0 : undefined,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useOrderDetail(orderId: string | null, enabled: boolean) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: ordersKeys.detail(businessSlug, orderId ?? ''),
    queryFn: () => {
      if (!orderId) throw new Error('orderId is required');
      return fetchOrderById(businessSlug, orderId);
    },
    enabled: Boolean(orderId && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useActiveOrdersForGroup(companyGroupId: string | null) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: ordersKeys.activeByGroup(businessSlug, companyGroupId ?? ''),
    queryFn: () => {
      if (!companyGroupId) throw new Error('companyGroupId is required');
      return fetchActiveOrdersForGroup(businessSlug, companyGroupId);
    },
    enabled: Boolean(companyGroupId),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useOrderLetterAssignments(
  initialData?: OrderMailTemplateAssignment[],
) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: ordersKeys.letterAssignments(businessSlug),
    queryFn: () => fetchOrderLetterAssignments(businessSlug),
    initialData,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useOrderFormItems(companyGroupId: string | null, enabled: boolean) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: ordersKeys.formItems(businessSlug, companyGroupId),
    queryFn: () => fetchOrderFormItems(businessSlug, companyGroupId),
    enabled: Boolean(businessSlug && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export type OrderResponsibleOption = { userId: string; name: string; image: string | null };

/** Members of the business that can be made responsible for an order. */
export function useOrderResponsibleOptions(enabled = true) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: ordersKeys.responsibleOptions(businessSlug),
    queryFn: async () =>
      handleAction(await fetchRead(businessSlug, 'orderResponsibleOptions')) as OrderResponsibleOption[],
    enabled: Boolean(businessSlug && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

function invalidateAllOrdersQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  businessSlug: string,
) {
  // Active queries only: the bridge runs on every page, inactive ones refetch when shown.
  void queryClient.invalidateQueries({ queryKey: ordersKeys.all(businessSlug) });
}

/** Tags our mutations so the realtime echo is skipped (onSuccess already invalidates). */
function useOrdersMutationMeta() {
  return realtimeMutationMeta(useOptionalRealtimeSocket()?.clientId);
}

export function useInvalidateOrders() {
  const queryClient = useQueryClient();
  const businessSlug = useRequiredBusinessSlug();

  return () => {
    invalidateAllOrdersQueries(queryClient, businessSlug);
  };
}

export function useOrdersRealtimeInvalidation(enabled = true) {
  const queryClient = useQueryClient();
  const businessSlug = useRequiredBusinessSlug();

  const handleRealtimeChange = useCallback(() => {
    invalidateAllOrdersQueries(queryClient, businessSlug);
  }, [businessSlug, queryClient]);

  useOrdersRealtime({
    enabled: enabled && Boolean(businessSlug),
    onChange: handleRealtimeChange,
  });
  // Changes missed while disconnected.
  useRealtimeSocketResync(handleRealtimeChange, enabled && Boolean(businessSlug));
}

export function useCreateOrderMutation() {
  const mutationMeta = useOrdersMutationMeta();
  const businessSlug = useRequiredBusinessSlug();
  const invalidateOrders = useInvalidateOrders();

  return useMutation({
    mutationFn: async (vars: Parameters<typeof createOrder>[1]) => {
      const result = await createOrder(businessSlug, vars, mutationMeta);
      handleAction(result);
      return vars;
    },
    onSuccess: () => {
      invalidateOrders();
      notifications.show({
        title: 'Succès',
        message: 'Commande créée avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la création de la commande',
        color: 'danger',
      });
    },
  });
}

export function useUpdateOrderMutation() {
  const mutationMeta = useOrdersMutationMeta();
  const businessSlug = useRequiredBusinessSlug();
  const invalidateOrders = useInvalidateOrders();

  return useMutation({
    mutationFn: async (vars: Parameters<typeof updateOrder>[1]) => {
      const result = await updateOrder(businessSlug, vars, mutationMeta);
      handleAction(result);
      return vars;
    },
    onSuccess: () => {
      invalidateOrders();
      notifications.show({
        title: 'Succès',
        message: 'Commande modifiée avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la modification',
        color: 'danger',
      });
    },
  });
}

export function useDeleteOrderMutation() {
  const mutationMeta = useOrdersMutationMeta();
  const businessSlug = useRequiredBusinessSlug();
  const invalidateOrders = useInvalidateOrders();

  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      const result = await deleteOrder(businessSlug, vars, mutationMeta);
      handleAction(result);
      return vars;
    },
    onSuccess: () => {
      invalidateOrders();
      notifications.show({
        title: 'Succès',
        message: 'Commande supprimée avec succès',
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

export function useCompleteOrderMutation() {
  const mutationMeta = useOrdersMutationMeta();
  const businessSlug = useRequiredBusinessSlug();
  const invalidateOrders = useInvalidateOrders();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      vars: Parameters<typeof completeOrder>[1] & { affectedChestIds?: string[] },
    ) => {
      const { affectedChestIds: _affectedChestIds, ...payload } = vars;
      const result = await completeOrder(businessSlug, payload, mutationMeta);
      handleAction(result);
      return { vars };
    },
    onSuccess: ({ vars }) => {
      invalidateOrders();
      for (const chestId of vars.affectedChestIds ?? []) {
        void queryClient.invalidateQueries({
          queryKey: stockKeys.items(businessSlug, chestId),
        });
      }
      void queryClient.invalidateQueries({
        queryKey: stockKeys.items(businessSlug, null),
      });
      notifications.show({
        title: 'Succès',
        message: 'Commande terminée avec succès',
        color: 'moss',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la finalisation de la commande',
        color: 'danger',
      });
    },
  });
}
