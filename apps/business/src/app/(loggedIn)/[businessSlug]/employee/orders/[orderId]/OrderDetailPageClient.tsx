'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconMail,
  IconPencil,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { MarkdownContent } from '@/app/_components/MarkdownContent/MarkdownContent';
import { MarkdownTextarea } from '@/app/_components/MarkdownTextarea';
import { OrderStatusBadge } from '@/app/_components/OrderBadges/OrderStatusBadge';
import { OrderTypeBadge } from '@/app/_components/OrderBadges/OrderTypeBadge';
import { usePermissions, useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import { apothecaryPillStyle } from '@/lib/apothecaryPill';
import { amberPalette, sagePalette } from '@/lib/design-tokens';
import { calculateOrderWeightFromItems } from '@/lib/orders/calculateOrderWeightFromItems';
import { formatOrderDateTime, formatOrderPrice } from '@/lib/orders/chatterLines';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import { orderStatusSelectOptions, orderTypeSelectOptions } from '@/lib/orders/orderSelectOptions';
import { OrderStatusEnum } from '@/types/enum/orderStatus';
import type { OrderTypeEnum } from '@/types/enum/orderType';
import {
  getOrderClientDisplayName,
  type OrderChatter as OrderChatterData,
  type OrderPerson,
  type OrderWithRelations,
} from '@/types/orders';
import type { OrderMailTemplateAssignment } from '@/types/mailTemplates';
import type { OrderStatus } from '@lawless-intranet/types';
import {
  CompleteOrderStockModal,
  type CompleteOrderPendingPayload,
} from '../components/CompleteOrderStockModal';
import { OrderLinesTable } from '../components/OrderLinesTable';
import { OrderStatusActions, OrderStatusSteps } from '../components/OrderStatusStepper';
import { OrderItemsTable } from '../components/OrderItemsTable';
import { OrderLetterPreviewModal } from '../components/OrderLetterPreviewModal';
import { OrderPriceField } from '../components/OrderPriceField';
import { OrderResponsibleSelect } from '../components/OrderResponsibleSelect';
import { OrderChatter } from '../components/OrderChatter/OrderChatter';
import { useOrderEditForm } from '../hooks/useOrderEditForm';
import {
  useDeleteOrderMutation,
  useDuplicateOrderMutation,
  useOrderDetail,
  useSetOrderStatusMutation,
  useOrderLetterAssignments,
} from '../hooks/useOrdersQueries';
import classes from './OrderDetail.module.scss';

type OrderDetailPageClientProps = {
  orderId: string;
  currentUserId: string;
  initialOrder: OrderWithRelations;
  initialChatter: OrderChatterData;
  initialAssignments: OrderMailTemplateAssignment[];
};

/** A labelled value of the order; an empty value reads "—". */
function FieldReadout({ label, children }: { label: string; children: ReactNode }) {
  const empty = children == null || children === '';
  return (
    <div className={classes.field}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <div className={classes.fieldValue}>
        {empty ? <Text size="sm">—</Text> : children}
      </div>
    </div>
  );
}

function PersonValue({ person, emptyLabel }: { person?: OrderPerson | null; emptyLabel: string }) {
  if (!person) {
    return (
      <Text size="sm" c="dimmed">
        {emptyLabel}
      </Text>
    );
  }
  return (
    <Group gap={6} wrap="nowrap">
      <Avatar src={person.image} alt="" size={22} radius="xl" color="sage">
        {person.name.slice(0, 1).toUpperCase()}
      </Avatar>
      <Text size="sm" fw={500} truncate="end">
        {person.name}
      </Text>
    </Group>
  );
}

export function OrderDetailPageClient({
  orderId,
  currentUserId,
  initialOrder,
  initialChatter,
  initialAssignments,
}: OrderDetailPageClientProps) {
  const rp = useRpCalendar();
  const router = useRouter();
  const routes = useTenantRoutes();
  const { permissions } = usePermissions();
  const { data: order = initialOrder } = useOrderDetail(orderId, true, initialOrder);
  const { data: assignments = initialAssignments } = useOrderLetterAssignments(initialAssignments);
  const deleteOrder = useDeleteOrderMutation();
  const duplicateOrder = useDuplicateOrderMutation();
  const setStatus = useSetOrderStatusMutation();
  /** Completion asked from the progress bar (the edit form has its own). */
  const [stepperComplete, setStepperComplete] = useState<CompleteOrderPendingPayload | null>(null);
  const [editing, setEditing] = useState(false);
  const [completeModalOpened, setCompleteModalOpened] = useState(false);
  const [letterOpened, setLetterOpened] = useState(false);
  const edit = useOrderEditForm(order, editing);
  const { form } = edit;

  const isCompleted = order.status === OrderStatusEnum.COMPLETED;
  const canUpdate = Boolean(permissions?.orders.update) && !isCompleted;
  const canDelete = Boolean(permissions?.orders.delete) && !isCompleted;
  // An order completed meanwhile (another tab) leaves the edit mode.
  const isEditing = editing && !isCompleted;
  const hasLetterTemplate = assignments.some(
    (assignment) =>
      assignment.orderType === (order.type || 'INCOMING') && assignment.orderStatus === order.status,
  );
  const readWeight = useMemo(
    () =>
      calculateOrderWeightFromItems(
        order.items.map((line) => ({ quantity: line.quantity, weight: line.item.weight })),
      ),
    [order.items],
  );
  const totalWeight = isEditing ? edit.totalWeight : readWeight;

  const stopEditing = () => {
    setEditing(false);
    setCompleteModalOpened(false);
    setStepperComplete(null);
    edit.clearPendingComplete();
  };

  const changeStatus = (status: OrderStatus) => {
    if (status === 'COMPLETED') {
      // Same stock step as the edit form, with the saved order.
      setStepperComplete({
        id: order.id,
        name: order.name,
        type: (order.type || 'INCOMING') as OrderTypeEnum,
        items: order.items.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
      });
      setCompleteModalOpened(true);
      return;
    }
    setStatus.mutate({ id: order.id, status });
  };

  const duplicate = async () => {
    try {
      const copy = await duplicateOrder.mutateAsync({ id: order.id });
      router.push(routes.orders.detail(copy.id));
    } catch {
      // Notified by the mutation hook.
    }
  };

  const completePending = stepperComplete ?? edit.pendingComplete;
  const completeLines = stepperComplete
    ? order.items.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        name: line.item.name,
        isEnabled: line.item.isEnabled ?? true,
      }))
    : edit.completeStockLines;

  const save = async () => {
    const result = await edit.submit();
    if (result === 'saved') stopEditing();
    if (result === 'completing') setCompleteModalOpened(true);
  };

  const titleContent = (
    <Group gap="sm" align="center" wrap="wrap">
      {isEditing ? (
        <TextInput
          aria-label="Nom"
          required
          size="lg"
          className={classes.titleInput}
          {...form.getInputProps('name')}
        />
      ) : (
        <h1 className={classes.title}>{order.name}</h1>
      )}
      {isEditing ? (
        <>
          <Select
            aria-label="Statut"
            data={orderStatusSelectOptions}
            value={form.values.status}
            onChange={(value) => value && form.setFieldValue('status', value as OrderStatusEnum)}
            allowDeselect={false}
            size="lg"
            w={220}
          />
          <Select
            aria-label="Type"
            data={orderTypeSelectOptions}
            value={form.values.type}
            onChange={(value) => value && form.setFieldValue('type', value as OrderTypeEnum)}
            allowDeselect={false}
            size="lg"
            w={150}
          />
        </>
      ) : (
        <Group gap="xs">
          <OrderStatusBadge status={order.status} />
          <OrderTypeBadge type={order.type || 'INCOMING'} />
        </Group>
      )}
    </Group>
  );

  const actions = isEditing ? (
    <Group gap="xs">
      <Button
        variant="light"
        color="slate"
        leftSection={<IconX size={16} />}
        onClick={stopEditing}
        disabled={edit.saving}
      >
        Annuler
      </Button>
      <Button leftSection={<IconCheck size={16} />} loading={edit.saving} onClick={() => void save()}>
        Enregistrer
      </Button>
    </Group>
  ) : (
    <Group gap="xs">
      {hasLetterTemplate && (
        <Button
          variant="light"
          color="slate"
          leftSection={<IconMail size={16} />}
          onClick={() => setLetterOpened(true)}
        >
          Lettre
        </Button>
      )}
      {permissions?.orders.create && (
        <Button
          variant="light"
          color="slate"
          leftSection={<IconCopy size={16} />}
          loading={duplicateOrder.isPending}
          onClick={() => void duplicate()}
        >
          Dupliquer
        </Button>
      )}
      {canUpdate && (
        <Button leftSection={<IconPencil size={16} />} onClick={() => setEditing(true)}>
          Modifier
        </Button>
      )}
      {canDelete && (
        <DeleteConfirmPopover
          title="Supprimer la commande ?"
          message="La commande et son fil seront supprimés définitivement."
          onConfirm={async () => {
            try {
              await deleteOrder.mutateAsync({ id: order.id });
              router.push(routes.orders.index);
            } catch {
              // Notified by the mutation hook.
            }
          }}
        >
          <Button variant="light" color="danger" leftSection={<IconTrash size={16} />}>
            Supprimer
          </Button>
        </DeleteConfirmPopover>
      )}
    </Group>
  );

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title={order.name}
        titleContent={titleContent}
        backHref={routes.orders.index}
        backLabel="Commandes"
        actions={actions}
      />

      {isEditing && edit.changedMeanwhile && (
        <Alert color="amber" icon={<IconAlertTriangle size={16} />} mb="lg">
          Cette commande a été modifiée par quelqu’un d’autre pendant votre saisie. Enregistrer
          remplacera ses changements ; annulez pour voir la dernière version.
        </Alert>
      )}

      <div className={classes.layout}>
        <Stack gap="lg" className={classes.main}>
          <Paper withBorder shadow="sm" p="lg" radius="md">
            {!isEditing && (
              <div className={classes.statusBar}>
                <OrderStatusSteps
                  status={order.status}
                  canChange={Boolean(permissions?.orders.update)}
                  pending={setStatus.isPending}
                  onChange={changeStatus}
                />
              </div>
            )}
            <div className={classes.fields}>
              <FieldReadout label="Client">
                <Text size="sm" fw={500}>
                  {getOrderClientDisplayName(order)}
                </Text>
              </FieldReadout>
              <FieldReadout label="Groupe d'entreprises">
                {order.companyGroup?.name && (
                  <Text size="sm" fw={500}>
                    {order.companyGroup.name}
                  </Text>
                )}
              </FieldReadout>
              {isEditing ? (
                <OrderResponsibleSelect
                  value={edit.responsibleUserId}
                  onChange={edit.setResponsibleUserId}
                />
              ) : (
                <FieldReadout label="Responsable">
                  <PersonValue person={order.responsible} emptyLabel="Aucun" />
                </FieldReadout>
              )}
              {isEditing ? (
                <OrderPriceField
                  state={edit.priceState}
                  onChange={edit.setPriceState}
                  suggestedPrice={edit.suggestedPrice}
                />
              ) : (
                <FieldReadout label="Prix">
                  <Group gap={6} wrap="nowrap">
                    <Text size="sm" fw={500}>
                      {formatOrderPrice(order.price)}
                    </Text>
                    {!isCompleted && (
                      <Badge
                        size="xs"
                        variant="outline"
                        radius="sm"
                        style={apothecaryPillStyle(order.priceManual ? amberPalette : sagePalette)}
                      >
                        {order.priceManual ? 'Manuel' : 'Auto'}
                      </Badge>
                    )}
                  </Group>
                </FieldReadout>
              )}
              <FieldReadout label="Créée par">
                <PersonValue person={order.createdBy} emptyLabel="Inconnu" />
              </FieldReadout>
              <FieldReadout label="Poids total">
                {totalWeight != null && (
                  <Text size="sm" fw={500}>
                    {totalWeight.toFixed(2)} kg
                  </Text>
                )}
              </FieldReadout>
              <FieldReadout label="Créée le">
                <Text size="sm">{formatOrderDateTime(order.createdAt, rp)}</Text>
              </FieldReadout>
              <FieldReadout label="Modifiée le">
                <Text size="sm">{formatOrderDateTime(order.updatedAt, rp)}</Text>
              </FieldReadout>
            </div>
            {isEditing ? (
              <div className={classes.details}>
                <MarkdownTextarea
                  label="Détails"
                  placeholder="Détails de la commande (markdown accepté, Ctrl+B / Ctrl+I)"
                  rows={4}
                  value={form.values.details}
                  onChange={(value) => form.setFieldValue('details', value)}
                  error={form.errors.details}
                />
              </div>
            ) : (
              order.details && (
                <div className={classes.details}>
                  <Text size="xs" c="dimmed" mb={4}>
                    Détails
                  </Text>
                  <MarkdownContent source={order.details} />
                </div>
              )
            )}
            {!isEditing && (
              <div className={classes.statusActions}>
                <OrderStatusActions
                  status={order.status}
                  canChange={Boolean(permissions?.orders.update)}
                  pending={setStatus.isPending}
                  onChange={changeStatus}
                />
              </div>
            )}
          </Paper>

          <Paper withBorder shadow="sm" p="lg" radius="md">
            <h2 className={classes.sectionTitle}>Articles</h2>
            {isEditing ? (
              <OrderItemsTable
                orderItems={edit.orderItems}
                loadingItems={edit.loadingItems}
                availableItemOptions={edit.availableItemOptions}
                onQuantityChange={edit.changeQuantity}
                onRemoveItem={edit.removeItem}
                onAddItem={edit.addItem}
              />
            ) : (
              <OrderLinesTable
                lines={order.items}
                orderPrice={order.price}
                priceManual={order.priceManual}
              />
            )}
          </Paper>
        </Stack>

        <aside className={classes.chatter}>
          <OrderChatter
            orderId={orderId}
            currentUserId={currentUserId}
            initialChatter={initialChatter}
          />
        </aside>
      </div>

      <CompleteOrderStockModal
        opened={completeModalOpened}
        onClose={() => {
          setCompleteModalOpened(false);
          setStepperComplete(null);
          edit.clearPendingComplete();
        }}
        onCompleted={stopEditing}
        orderType={completePending?.type ?? form.values.type}
        pending={completePending}
        lines={completeLines}
      />
      <OrderLetterPreviewModal
        opened={letterOpened}
        onClose={() => setLetterOpened(false)}
        orderId={letterOpened ? orderId : null}
      />
    </Container>
  );
}
