'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Badge, Button, Container, Group, Paper, Stack, Table, Text } from '@mantine/core';
import { IconMail, IconPencil, IconTrash } from '@tabler/icons-react';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { MarkdownContent } from '@/app/_components/MarkdownContent/MarkdownContent';
import { OrderStatusBadge } from '@/app/_components/OrderBadges/OrderStatusBadge';
import { OrderTypeBadge } from '@/app/_components/OrderBadges/OrderTypeBadge';
import { usePermissions, useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import { apothecaryPillStyle } from '@/lib/apothecaryPill';
import { amberPalette, sagePalette } from '@/lib/design-tokens';
import { calculateOrderWeightFromItems } from '@/lib/orders/calculateOrderWeightFromItems';
import { formatOrderDateTime, formatOrderPrice } from '@/lib/orders/chatterLines';
import { getOrderClientDisplayName, type OrderChatter as OrderChatterData, type OrderPerson, type OrderWithRelations } from '@/types/orders';
import type { OrderMailTemplateAssignment } from '@/types/mailTemplates';
import { EditOrderModal } from '../components/EditOrderModal';
import { OrderLetterPreviewModal } from '../components/OrderLetterPreviewModal';
import { OrderChatter } from '../components/OrderChatter/OrderChatter';
import {
  useDeleteOrderMutation,
  useOrderDetail,
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={classes.field}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <div className={classes.fieldValue}>{children}</div>
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
  const router = useRouter();
  const routes = useTenantRoutes();
  const { permissions } = usePermissions();
  const { data: order = initialOrder } = useOrderDetail(orderId, true, initialOrder);
  const { data: assignments = initialAssignments } = useOrderLetterAssignments(initialAssignments);
  const deleteOrder = useDeleteOrderMutation();
  const [editOpened, setEditOpened] = useState(false);
  const [letterOpened, setLetterOpened] = useState(false);

  const isCompleted = order.status === 'COMPLETED';
  const canUpdate = Boolean(permissions?.orders.update) && !isCompleted;
  const canDelete = Boolean(permissions?.orders.delete) && !isCompleted;
  const hasLetterTemplate = assignments.some(
    (assignment) =>
      assignment.orderType === (order.type || 'INCOMING') && assignment.orderStatus === order.status,
  );
  const totalWeight = useMemo(
    () =>
      calculateOrderWeightFromItems(
        order.items.map((line) => ({ quantity: line.quantity, weight: line.item.weight })),
      ),
    [order.items],
  );

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title={order.name}
        backHref={routes.orders.index}
        backLabel="Commandes"
        actions={
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
            {canUpdate && (
              <Button leftSection={<IconPencil size={16} />} onClick={() => setEditOpened(true)}>
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
        }
      />

      <div className={classes.layout}>
        <Stack gap="lg" className={classes.main}>
          <Paper withBorder shadow="sm" p="lg" radius="md">
            <Group gap="xs" mb="md">
              <OrderStatusBadge status={order.status} />
              <OrderTypeBadge type={order.type || 'INCOMING'} />
            </Group>
            <div className={classes.fields}>
              <Field label="Client">
                <Text size="sm" fw={500}>
                  {getOrderClientDisplayName(order)}
                </Text>
              </Field>
              <Field label="Groupe d'entreprises">
                <Text size="sm" fw={500} c={order.companyGroup ? undefined : 'dimmed'}>
                  {order.companyGroup?.name ?? 'Aucun'}
                </Text>
              </Field>
              <Field label="Prix">
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
              </Field>
              <Field label="Responsable">
                <PersonValue person={order.responsible} emptyLabel="Aucun" />
              </Field>
              <Field label="Créée par">
                <PersonValue person={order.createdBy} emptyLabel="Inconnu" />
              </Field>
              <Field label="Poids total">
                <Text size="sm" fw={500}>
                  {totalWeight != null ? `${totalWeight.toFixed(2)} kg` : '—'}
                </Text>
              </Field>
              <Field label="Créée le">
                <Text size="sm">{formatOrderDateTime(order.createdAt)}</Text>
              </Field>
              <Field label="Modifiée le">
                <Text size="sm">{formatOrderDateTime(order.updatedAt)}</Text>
              </Field>
            </div>
            {order.details && (
              <div className={classes.details}>
                <Text size="xs" c="dimmed" mb={4}>
                  Détails
                </Text>
                <MarkdownContent source={order.details} />
              </div>
            )}
          </Paper>

          <Paper withBorder shadow="sm" p="lg" radius="md">
            <h2 className={classes.sectionTitle}>Articles</h2>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Objet</Table.Th>
                  <Table.Th ta="right">Quantité</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {order.items.map((line) => (
                  <Table.Tr key={line.id ?? line.itemId}>
                    <Table.Td>{line.item.name}</Table.Td>
                    <Table.Td ta="right">{line.quantity}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
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

      <EditOrderModal
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        orderId={editOpened ? orderId : null}
      />
      <OrderLetterPreviewModal
        opened={letterOpened}
        onClose={() => setLetterOpened(false)}
        orderId={letterOpened ? orderId : null}
      />
    </Container>
  );
}
