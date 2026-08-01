'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import {
  completeOrder,
  createOrder,
  deleteOrder,
  getActiveOrdersForCompanyGroup,
  getOrderById,
  getOrdersPage,
  updateOrder,
} from '@/app/_actions/orders';
import { getItems } from '@/app/_actions/items';
import { getOrderLetterTemplateAssignments } from '@/app/_actions/orderLetterTemplateAssignments';
import { handleAction } from '@/lib/action';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import {
  ordersKeys,
  type OrdersPageFilters,
} from '@/lib/orders/queryKeys';
import { stockKeys } from '@/lib/stock/queryKeys';
import { normalizeItemPrice } from '@/lib/orders/calculateOrderPriceFromItems';
import type { OrdersPageResult, OrderWithRelations } from '@/types/orders';
import type { ItemWithRelations } from '@/types/stock';
import type { OrderMailTemplateAssignment } from '@/types/mailTemplates';

const DEFAULT_PAGE_SIZE = 10;

export const defaultOrdersPageFilters: OrdersPageFilters = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  status: [],
  type: null,
  search: '',
  createdAtFrom: null,
  createdAtTo: null,
};

function isDefaultInitialPage(filters: OrdersPageFilters): boolean {
  return (
    filters.page === 1 &&
    filters.pageSize === DEFAULT_PAGE_SIZE &&
    filters.status.length === 0 &&
    filters.type === null &&
    filters.search === '' &&
    filters.createdAtFrom === null &&
    filters.createdAtTo === null
  );
}

async function fetchOrdersPage(dispensarySlug: string, filters: OrdersPageFilters) {
  const result = await getOrdersPage(dispensarySlug, {
    page: filters.page,
    pageSize: filters.pageSize,
    status: filters.status as Array<
      'DRAFT' | 'LETTER_SENT' | 'PROCESSING' | 'READY' | 'COMPLETED' | 'CANCELLED'
    >,
    type: filters.type as 'INCOMING' | 'OUTGOING' | null | undefined,
    search: filters.search || undefined,
    createdAtFrom: filters.createdAtFrom,
    createdAtTo: filters.createdAtTo,
  });
  return handleAction(result) as OrdersPageResult;
}

async function fetchOrderById(dispensarySlug: string, orderId: string) {
  const result = await getOrderById(dispensarySlug, { id: orderId });
  return handleAction(result) as OrderWithRelations;
}

async function fetchActiveOrdersForGroup(
  dispensarySlug: string,
  companyGroupId: string,
) {
  const result = await getActiveOrdersForCompanyGroup(dispensarySlug, {
    companyGroupId,
  });
  return handleAction(result);
}

async function fetchOrderLetterAssignments(dispensarySlug: string) {
  const result = await getOrderLetterTemplateAssignments(dispensarySlug);
  return handleAction(result) as OrderMailTemplateAssignment[];
}

async function fetchOrderFormItems(
  dispensarySlug: string,
  companyGroupId: string | null,
) {
  const result = await getItems(
    dispensarySlug,
    companyGroupId ? { companyGroupId } : undefined,
  );
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
) {
  const dispensarySlug = useRequiredDispensarySlug();

  return useQuery({
    queryKey: ordersKeys.page(dispensarySlug, filters),
    queryFn: () => fetchOrdersPage(dispensarySlug, filters),
    initialData:
      initialData && isDefaultInitialPage(filters) ? initialData : undefined,
    placeholderData: (previous) => previous,
    enabled: Boolean(dispensarySlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useOrderDetail(orderId: string | null, enabled: boolean) {
  const dispensarySlug = useRequiredDispensarySlug();

  return useQuery({
    queryKey: ordersKeys.detail(dispensarySlug, orderId ?? ''),
    queryFn: () => {
      if (!orderId) throw new Error('orderId is required');
      return fetchOrderById(dispensarySlug, orderId);
    },
    enabled: Boolean(orderId && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useActiveOrdersForGroup(companyGroupId: string | null) {
  const dispensarySlug = useRequiredDispensarySlug();

  return useQuery({
    queryKey: ordersKeys.activeByGroup(dispensarySlug, companyGroupId ?? ''),
    queryFn: () => {
      if (!companyGroupId) throw new Error('companyGroupId is required');
      return fetchActiveOrdersForGroup(dispensarySlug, companyGroupId);
    },
    enabled: Boolean(companyGroupId),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useOrderLetterAssignments(
  initialData?: OrderMailTemplateAssignment[],
) {
  const dispensarySlug = useRequiredDispensarySlug();

  return useQuery({
    queryKey: ordersKeys.letterAssignments(dispensarySlug),
    queryFn: () => fetchOrderLetterAssignments(dispensarySlug),
    initialData,
    enabled: Boolean(dispensarySlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useOrderFormItems(companyGroupId: string | null, enabled: boolean) {
  const dispensarySlug = useRequiredDispensarySlug();

  return useQuery({
    queryKey: ordersKeys.formItems(dispensarySlug, companyGroupId),
    queryFn: () => fetchOrderFormItems(dispensarySlug, companyGroupId),
    enabled: Boolean(dispensarySlug && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useInvalidateOrders() {
  const queryClient = useQueryClient();
  const dispensarySlug = useRequiredDispensarySlug();

  return () => {
    void queryClient.invalidateQueries({
      queryKey: ordersKeys.all(dispensarySlug),
    });
  };
}

export function useCreateOrderMutation() {
  const dispensarySlug = useRequiredDispensarySlug();
  const invalidateOrders = useInvalidateOrders();

  return useMutation({
    mutationFn: async (vars: Parameters<typeof createOrder>[1]) => {
      const result = await createOrder(dispensarySlug, vars);
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
  const dispensarySlug = useRequiredDispensarySlug();
  const invalidateOrders = useInvalidateOrders();

  return useMutation({
    mutationFn: async (vars: Parameters<typeof updateOrder>[1]) => {
      const result = await updateOrder(dispensarySlug, vars);
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
  const dispensarySlug = useRequiredDispensarySlug();
  const invalidateOrders = useInvalidateOrders();

  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      const result = await deleteOrder(dispensarySlug, vars);
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
  const dispensarySlug = useRequiredDispensarySlug();
  const invalidateOrders = useInvalidateOrders();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      vars: Parameters<typeof completeOrder>[1] & { affectedChestIds?: string[] },
    ) => {
      const { affectedChestIds: _affectedChestIds, ...payload } = vars;
      const result = await completeOrder(dispensarySlug, payload);
      handleAction(result);
      return vars;
    },
    onSuccess: (vars) => {
      invalidateOrders();
      for (const chestId of vars.affectedChestIds ?? []) {
        void queryClient.invalidateQueries({
          queryKey: stockKeys.items(dispensarySlug, chestId),
        });
      }
      void queryClient.invalidateQueries({
        queryKey: stockKeys.items(dispensarySlug, null),
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
