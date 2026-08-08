'use client';

import { DataTable } from 'mantine-datatable';
import { Paper, ActionIcon, Group } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import type { OrderType, OrderStatus } from '@lawless-intranet/types';
import type { OrderMailTemplateAssignmentWithTemplate } from '@/types/mailTemplates';
import { OrderTypeBadge } from '@/app/_components/OrderBadges/OrderTypeBadge';
import { OrderStatusBadge } from '@/app/_components/OrderBadges/OrderStatusBadge';

interface OrderLetterTemplateAssignmentsTableProps {
  assignments: OrderMailTemplateAssignmentWithTemplate[];
  loading: boolean;
  onEdit: (assignment: OrderMailTemplateAssignmentWithTemplate) => void;
  onDelete: (assignment: OrderMailTemplateAssignmentWithTemplate) => void;
}

export function OrderLetterTemplateAssignmentsTable({
  assignments,
  loading,
  onEdit,
  onDelete,
}: OrderLetterTemplateAssignmentsTableProps) {
  return (
    <Paper shadow="sm" p="md" withBorder w="100%">
      <DataTable
        records={assignments}
        columns={[
          {
            accessor: 'orderType',
            title: 'Type de commande',
            render: (assignment: OrderMailTemplateAssignmentWithTemplate) => (
              <OrderTypeBadge type={assignment.orderType as OrderType} />
            ),
          },
          {
            accessor: 'orderStatus',
            title: 'Statut de commande',
            render: (assignment: OrderMailTemplateAssignmentWithTemplate) => (
              <OrderStatusBadge status={assignment.orderStatus as OrderStatus} />
            ),
          },
          {
            accessor: 'mailTemplate.name',
            title: 'Modèle de courrier',
            render: (assignment: OrderMailTemplateAssignmentWithTemplate) =>
              assignment.mailTemplate?.name ?? '—',
          },
          {
            accessor: 'actions',
            title: 'Actions',
            width: 100,
            render: (assignment: OrderMailTemplateAssignmentWithTemplate) => (
              <Group gap="xs" wrap="nowrap" justify="flex-end">
                <ActionIcon
                  variant="light"
                  color="slate"
                  onClick={() => onEdit(assignment)}
                  title="Modifier"
                >
                  <IconEdit size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="light"
                  color="danger"
                  onClick={() => onDelete(assignment)}
                  title="Supprimer"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ),
          },
        ]}
        fetching={loading}
        noRecordsText="Aucune assignation trouvée"
        striped
        highlightOnHover
        minHeight={200}
      />
    </Paper>
  );
}
