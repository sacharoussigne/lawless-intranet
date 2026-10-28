'use client';

import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import { useState } from 'react';
import {
  Stack,
  TextInput,
  Select,
  Button,
  Text,
  Divider,
  SimpleGrid,
  Loader,
} from '@mantine/core';
import {
  orderStatusSelectOptions,
  orderTypeSelectOptions,
} from '@/lib/orders/orderSelectOptions';
import { MarkdownTextarea } from '@/app/_components/MarkdownTextarea';
import { OrderStatusEnum } from '@/types/enum/orderStatus';
import type { OrderTypeEnum } from '@/types/enum/orderType';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { OrderItemsTable } from './OrderItemsTable';
import { OrderPriceField } from './OrderPriceField';
import { OrderResponsibleSelect } from './OrderResponsibleSelect';
import { CompleteOrderStockModal } from './CompleteOrderStockModal';
import { useOrderDetail } from '../hooks/useOrdersQueries';
import { useOrderEditForm } from '../hooks/useOrderEditForm';

interface EditOrderModalProps {
  opened: boolean;
  onClose: () => void;
  orderId: string | null;
}

export function EditOrderModal({ opened, onClose, orderId }: EditOrderModalProps) {
  const { data: editingOrder, isLoading: loadingOrder } = useOrderDetail(
    orderId,
    opened && Boolean(orderId),
  );
  const edit = useOrderEditForm(editingOrder, opened);
  const { form } = edit;
  const [completeModalOpened, setCompleteModalOpened] = useState(false);

  const close = () => {
    setCompleteModalOpened(false);
    edit.clearPendingComplete();
    // Defer parent close so nested Mantine modals unmount sequentially.
    window.setTimeout(() => {
      onClose();
    }, 0);
  };

  const handleSubmit = async () => {
    const result = await edit.submit();
    if (result === 'completing') setCompleteModalOpened(true);
    if (result === 'saved') close();
  };

  const isCompleted = editingOrder?.status === OrderStatusEnum.COMPLETED;
  const isLoading = loadingOrder || edit.loadingItems;

  return (
    <>
      <AppModal
        opened={opened && !completeModalOpened}
        onClose={close}
        title="Modifier la commande"
        size="xl"
        footer={
          <AppModalFooter>
            <Button variant="subtle" color="slate" onClick={close}>
              Annuler
            </Button>
            <Button
              type="submit"
              form="edit-order-form"
              disabled={isCompleted || isLoading}
              loading={edit.saving}
            >
              Enregistrer
            </Button>
          </AppModalFooter>
        }
      >
        {isLoading && !editingOrder ? (
          <Stack align="center" py="xl">
            <Loader />
          </Stack>
        ) : (
          <form
            {...noAutofillProps}
            id="edit-order-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <Stack gap="md">
              <Stack gap="sm">
                <Text fw={600} size="xs" c="dimmed" tt="uppercase">
                  Informations générales
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <TextInput
                    label="Nom"
                    placeholder="Nom de la commande"
                    required
                    {...form.getInputProps('name')}
                    disabled={isCompleted}
                  />
                  <Select
                    label="Type"
                    data={orderTypeSelectOptions}
                    required
                    value={form.values.type}
                    onChange={(value) => value && form.setFieldValue('type', value as OrderTypeEnum)}
                    allowDeselect={false}
                    disabled={isCompleted}
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Select
                    label="Statut"
                    data={orderStatusSelectOptions}
                    required
                    value={form.values.status}
                    onChange={(value) =>
                      value && form.setFieldValue('status', value as OrderStatusEnum)
                    }
                    allowDeselect={false}
                    disabled={isCompleted}
                  />
                  <OrderResponsibleSelect
                    value={edit.responsibleUserId}
                    onChange={edit.setResponsibleUserId}
                    disabled={isCompleted}
                  />
                </SimpleGrid>

                <OrderPriceField
                  state={edit.priceState}
                  onChange={edit.setPriceState}
                  suggestedPrice={edit.suggestedPrice}
                  frozenPrice={isCompleted ? (editingOrder?.price ?? null) : undefined}
                />

                <MarkdownTextarea
                  label="Détails (optionnel)"
                  placeholder="Détails de la commande (markdown accepté)"
                  rows={3}
                  value={form.values.details}
                  onChange={(value) => form.setFieldValue('details', value)}
                  error={form.errors.details}
                  disabled={isCompleted}
                />

                {edit.totalWeight != null && (
                  <Text size="sm" c="dimmed">
                    Poids total :{' '}
                    <Text span fw={500} c="inherit">
                      {edit.totalWeight.toFixed(2)} kg
                    </Text>
                  </Text>
                )}
              </Stack>

              <Divider />

              <Stack gap="sm">
                <Text fw={600} size="xs" c="dimmed" tt="uppercase">
                  Objets de la commande
                </Text>
                <OrderItemsTable
                  orderItems={edit.orderItems}
                  disabled={isCompleted}
                  loadingItems={edit.loadingItems}
                  availableItemOptions={edit.availableItemOptions}
                  onQuantityChange={edit.changeQuantity}
                  onRemoveItem={edit.removeItem}
                  onAddItem={edit.addItem}
                />
              </Stack>
            </Stack>
          </form>
        )}
      </AppModal>

      <CompleteOrderStockModal
        opened={completeModalOpened}
        onClose={() => {
          setCompleteModalOpened(false);
          edit.clearPendingComplete();
        }}
        onCompleted={close}
        orderType={edit.pendingComplete?.type ?? form.values.type}
        pending={edit.pendingComplete}
        lines={edit.completeStockLines}
      />
    </>
  );
}
