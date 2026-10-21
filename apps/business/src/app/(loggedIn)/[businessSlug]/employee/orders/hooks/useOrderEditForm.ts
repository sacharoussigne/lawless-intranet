'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  calculateOrderPriceFromItems,
  normalizeItemPrice,
} from '@/lib/orders/calculateOrderPriceFromItems';
import { calculateOrderWeightFromItems } from '@/lib/orders/calculateOrderWeightFromItems';
import { getAvailableItemsForOrder } from '@/lib/orders/getAvailableItemsForOrder';
import {
  initialOrderPriceState,
  orderPricePayload,
  type OrderPriceState,
} from '@/lib/orders/orderPriceMode';
import { handleApiZodError } from '@/lib/services/zod';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { OrderStatusEnum } from '@/types/enum/orderStatus';
import { OrderTypeEnum } from '@/types/enum/orderType';
import type { OrderItem, OrderWithRelations } from '@/types/orders';
import type {
  CompleteOrderPendingPayload,
  CompleteOrderStockLine,
} from '../components/CompleteOrderStockModal';
import { useOrderFormItems, useUpdateOrderMutation } from './useOrdersQueries';

const AUTO_PRICE: OrderPriceState = { manual: false, manualPrice: '' };

function toFormItems(order: OrderWithRelations): OrderItem[] {
  return order.items.map((line) => ({
    id: line.id,
    itemId: line.itemId,
    quantity: line.quantity,
    item: {
      id: line.item.id,
      name: line.item.name,
      price: line.item.price,
      weight: line.item.weight ?? null,
      isEnabled: line.item.isEnabled ?? true,
    },
  }));
}

/** Result of a save: back to reading, waiting for the stock modal, or nothing saved. */
export type OrderEditSubmitResult = 'saved' | 'completing' | 'invalid';

/**
 * Edit state of an order, shared by the edit modal of the list and the in-place
 * edit mode of the order page. The form is loaded from the order each time
 * `active` turns on, and never overwritten by a refetch while editing.
 */
export function useOrderEditForm(order: OrderWithRelations | undefined, active: boolean) {
  const companyGroupId = order?.companyGroupId ?? null;
  const updateOrderMutation = useUpdateOrderMutation();

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [priceState, setPriceState] = useState<OrderPriceState>(AUTO_PRICE);
  const [responsibleUserId, setResponsibleUserId] = useState<string | null>(null);
  const [pendingComplete, setPendingComplete] = useState<CompleteOrderPendingPayload | null>(
    null,
  );
  /** updatedAt of the version being edited, to tell when someone else saved meanwhile. */
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const form = useForm({
    initialValues: {
      name: '',
      status: OrderStatusEnum.DRAFT as OrderStatusEnum,
      type: OrderTypeEnum.INCOMING as OrderTypeEnum,
      details: '',
    },
    validate: {
      name: (value) => (value.trim().length < 1 ? 'Le nom est requis' : null),
    },
  });

  // A sale offers the sellable items; a purchase the items of its company group
  // (whole catalog for an older order without group, narrowed by getAvailableItemsForOrder).
  // Until the form is loaded, its type is the default one: read the order's.
  const editedType = loadedUpdatedAt ? form.values.type : order?.type;
  const isSale = editedType === OrderTypeEnum.OUTGOING;
  const { data: allItems = [], isLoading: loadingItems } = useOrderFormItems(
    isSale ? 'sale' : { companyGroupId },
    active && Boolean(order),
  );

  useEffect(() => {
    if (!active) {
      loadedRef.current = false;
      return;
    }
    if (!order || loadedRef.current) return;
    loadedRef.current = true;
    setOrderItems(toFormItems(order));
    setPriceState(initialOrderPriceState(order));
    setResponsibleUserId(order.responsibleUserId ?? null);
    setPendingComplete(null);
    setLoadedUpdatedAt(order.updatedAt);
    form.setValues({
      name: order.name,
      status: order.status as OrderStatusEnum,
      type: (order.type || OrderTypeEnum.INCOMING) as OrderTypeEnum,
      details: order.details || '',
    });
    form.resetDirty();
    // Loaded once per edit session: a refetch must not erase what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, order]);

  const suggestedPrice = useMemo(
    () =>
      calculateOrderPriceFromItems(
        orderItems.map((line) => ({ quantity: line.quantity, price: line.item.price })),
      ),
    [orderItems],
  );

  const totalWeight = useMemo(
    () =>
      calculateOrderWeightFromItems(
        orderItems.map((line) => ({ quantity: line.quantity, weight: line.item.weight })),
      ),
    [orderItems],
  );

  const availableItemOptions = useMemo(
    () =>
      getAvailableItemsForOrder({
        orderType: form.values.type,
        allItems,
        companyGroupId,
        firstOrderItemId: orderItems[0]?.itemId ?? null,
      })
        .filter((item) => !orderItems.some((line) => line.itemId === item.id))
        .map((item) => ({ value: item.id, label: item.name })),
    [form.values.type, allItems, companyGroupId, orderItems],
  );

  const completeStockLines = useMemo<CompleteOrderStockLine[]>(
    () =>
      orderItems.map((line) => {
        const catalogItem = allItems.find((item) => item.id === line.itemId);
        return {
          itemId: line.itemId,
          quantity: line.quantity,
          name: line.item.name,
          isEnabled: catalogItem?.isEnabled ?? line.item.isEnabled ?? true,
        };
      }),
    [orderItems, allItems],
  );

  const removeItem = (itemId: string) => {
    setOrderItems((lines) => lines.filter((line) => line.itemId !== itemId));
  };

  const changeQuantity = (itemId: string, quantity: number | string) => {
    const next =
      typeof quantity === 'number' ? quantity : quantity === '' ? 1 : Number(quantity) || 1;
    setOrderItems((lines) =>
      lines.map((line) => (line.itemId === itemId ? { ...line, quantity: next } : line)),
    );
  };

  const addItem = (itemId: string) => {
    const itemToAdd = allItems.find((item) => item.id === itemId);
    if (!itemToAdd) return;
    setOrderItems((lines) =>
      lines.some((line) => line.itemId === itemId)
        ? lines
        : [
            ...lines,
            {
              itemId: itemToAdd.id,
              quantity: 1,
              item: {
                id: itemToAdd.id,
                name: itemToAdd.name,
                price: normalizeItemPrice(itemToAdd.price),
                weight: itemToAdd.weight ?? null,
                isEnabled: itemToAdd.isEnabled ?? true,
              },
            },
          ],
    );
  };

  /** Saves the order, or prepares the stock step when the chosen status is Completed. */
  const submit = async (): Promise<OrderEditSubmitResult> => {
    if (!order || form.validate().hasErrors) return 'invalid';
    const values = form.getValues();

    if (orderItems.length === 0) {
      notifications.show({
        title: 'Erreur',
        message: 'La commande doit contenir au moins un article',
        color: 'danger',
      });
      return 'invalid';
    }

    const items = orderItems.map((line) => ({ itemId: line.itemId, quantity: line.quantity }));
    // The service recomputes an automatic price from the catalog.
    const pricing = orderPricePayload(priceState);
    const details = values.details.trim() ? values.details : null;

    if (values.status === OrderStatusEnum.COMPLETED && order.status !== OrderStatusEnum.COMPLETED) {
      setPendingComplete({
        id: order.id,
        name: values.name,
        type: values.type,
        details: details ?? undefined,
        ...pricing,
        items,
      });
      return 'completing';
    }

    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        name: values.name,
        status: values.status as Exclude<OrderStatusEnum, typeof OrderStatusEnum.COMPLETED>,
        type: values.type,
        details,
        ...pricing,
        responsibleUserId,
        items,
      });
      return 'saved';
    } catch (error: unknown) {
      if (error instanceof ParsedZodError) {
        handleApiZodError(error.error, form);
      }
      return 'invalid';
    }
  };

  return {
    form,
    orderItems,
    priceState,
    setPriceState,
    responsibleUserId,
    setResponsibleUserId,
    suggestedPrice,
    totalWeight,
    availableItemOptions,
    loadingItems,
    removeItem,
    changeQuantity,
    addItem,
    submit,
    saving: updateOrderMutation.isPending,
    pendingComplete,
    clearPendingComplete: () => setPendingComplete(null),
    completeStockLines,
    /** True when the order was saved by someone else since the edit started. */
    changedMeanwhile: Boolean(
      active && order && loadedUpdatedAt && order.updatedAt !== loadedUpdatedAt,
    ),
  };
}

export type OrderEditForm = ReturnType<typeof useOrderEditForm>;
