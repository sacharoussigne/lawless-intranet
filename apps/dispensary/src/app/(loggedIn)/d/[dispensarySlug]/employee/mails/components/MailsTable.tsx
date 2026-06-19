'use client';

import { Paper, TextInput } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconEdit, IconTrash, IconEye, IconUsers } from '@tabler/icons-react';
import { Group, ActionIcon } from '@mantine/core';
import type { MailListItem } from '@/types/mails';
import { SharedResourceAccessBadge } from '@/app/_components/mails/SharedResourceAccessBadge';

interface MailsTableProps {
  mails: MailListItem[];
  loading: boolean;
  nameFilter: string;
  receiverFilter: string;
  page: number;
  pageSize: number;
  totalRecords: number;
  onNameFilterChange: (value: string) => void;
  onReceiverFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onEdit: (mail: MailListItem) => void;
  onDelete: (mail: MailListItem) => void;
  onView: (mail: MailListItem) => void;
  onManageAccess?: (mail: MailListItem) => void;
}

export function MailsTable({
  mails,
  loading,
  nameFilter,
  receiverFilter,
  page,
  pageSize,
  totalRecords,
  onNameFilterChange,
  onReceiverFilterChange,
  onPageChange,
  onEdit,
  onDelete,
  onView,
  onManageAccess,
}: MailsTableProps) {
  return (
    <Paper shadow="sm" p="md" withBorder>
      <DataTable
        records={mails}
        columns={[
          {
            accessor: 'access',
            title: 'Accès',
            width: 240,
            render: (mail: MailListItem) => (
              <SharedResourceAccessBadge
                isOwner={mail.isOwner}
                isSharedWithMe={mail.isSharedWithMe}
                ownerName={mail.ownerName}
                accessType={mail.accessType}
              />
            ),
          },
          {
            accessor: 'name',
            title: 'Nom',
            filter: (
              <TextInput
                placeholder="Rechercher un nom..."
                value={nameFilter}
                onChange={(e) => onNameFilterChange(e.currentTarget.value)}
                style={{ minWidth: 200 }}
              />
            ),
          },
          {
            accessor: 'receiver',
            title: 'Destinataire',
            filter: (
              <TextInput
                placeholder="Rechercher un destinataire..."
                value={receiverFilter}
                onChange={(e) => onReceiverFilterChange(e.currentTarget.value)}
                style={{ minWidth: 200 }}
              />
            ),
          },
          {
            accessor: 'contentPreview',
            title: 'Contenu',
            render: (mail: MailListItem) => <span>{mail.contentPreview}</span>,
          },
          {
            accessor: 'createdAt',
            title: 'Date',
            render: (mail: MailListItem) => {
              return new Date(mail.createdAt).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
            },
          },
          {
            accessor: 'actions',
            title: 'Actions',
            render: (mail: MailListItem) => (
              <Group gap="xs" wrap="nowrap" justify="flex-end">
                <ActionIcon
                  variant="light"
                  color="denim"
                  onClick={() => onView(mail)}
                  title="Voir"
                >
                  <IconEye size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="light"
                  color="leather"
                  onClick={() => onManageAccess?.(mail)}
                  title="Partager"
                  disabled={!onManageAccess || !mail.canWrite}
                >
                  <IconUsers size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="light"
                  color="slate"
                  onClick={() => onEdit(mail)}
                  title="Modifier"
                  disabled={!mail.canWrite}
                >
                  <IconEdit size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="light"
                  color="danger"
                  onClick={() => onDelete(mail)}
                  title="Supprimer"
                  disabled={!mail.canWrite}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ),
          },
        ]}
        fetching={loading}
        noRecordsText={
          nameFilter || receiverFilter
            ? 'Aucun courrier trouvé avec ces filtres'
            : 'Aucun courrier trouvé'
        }
        striped
        highlightOnHover
        minHeight={200}
        totalRecords={totalRecords}
        recordsPerPage={pageSize}
        page={page}
        onPageChange={onPageChange}
        paginationSize="sm"
        paginationText={({ from, to, totalRecords }) =>
          `${from} - ${to} sur ${totalRecords} courriers`
        }
      />
    </Paper>
  );
}
