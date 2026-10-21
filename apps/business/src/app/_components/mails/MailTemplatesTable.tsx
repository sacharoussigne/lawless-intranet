'use client';

import { Paper, TextInput, Text } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconEdit, IconTrash, IconFlask, IconUsers } from '@tabler/icons-react';
import { Group, ActionIcon } from '@mantine/core';
import { SharedResourceAccessBadge } from './SharedResourceAccessBadge';

export type MailTemplateTableRow = {
  id: string;
  name: string;
  description?: string | null;
  isOwner?: boolean;
  isSharedWithMe?: boolean;
  isSharedByMe?: boolean;
  accessType?: 'READ' | 'WRITE' | null;
  canWrite?: boolean;
  ownerId?: string | null;
  ownerName?: string | null;
};

interface MailTemplatesTableProps<T extends MailTemplateTableRow> {
  mailTemplates: T[];
  loading: boolean;
  nameFilter: string;
  page: number;
  pageSize: number;
  totalRecords: number;
  showAccessControls?: boolean;
  onNameFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onEdit: (mailTemplate: T) => void;
  onDelete: (mailTemplate: T) => void;
  onTest?: (mailTemplate: T) => void;
  onManageAccess?: (mailTemplate: T) => void;
}

export function MailTemplatesTable<T extends MailTemplateTableRow>({
  mailTemplates,
  loading,
  nameFilter,
  page,
  pageSize,
  totalRecords,
  showAccessControls = true,
  onNameFilterChange,
  onPageChange,
  onEdit,
  onDelete,
  onTest,
  onManageAccess,
}: MailTemplatesTableProps<T>) {
  const columns = [
    ...(showAccessControls
      ? [
          {
            accessor: 'access',
            title: 'Accès',
            width: 240,
            render: (mailTemplate: T) => (
              <SharedResourceAccessBadge
                isOwner={mailTemplate.isOwner}
                isSharedWithMe={mailTemplate.isSharedWithMe}
                ownerName={mailTemplate.ownerName}
                accessType={mailTemplate.accessType}
              />
            ),
          },
        ]
      : []),
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
      accessor: 'description',
      title: 'Description',
      render: (mailTemplate: T) => {
        if (!mailTemplate.description) {
          return (
            <Text c="dimmed" span>
              —
            </Text>
          );
        }
        const preview =
          mailTemplate.description.length > 100
            ? `${mailTemplate.description.substring(0, 100)}...`
            : mailTemplate.description;
        return <span>{preview}</span>;
      },
    },
    {
      accessor: 'actions',
      title: 'Actions',
      width: 120,
      render: (mailTemplate: T) => (
        <Group gap="xs" wrap="nowrap" justify="flex-end">
          {onTest && (
            <ActionIcon
              variant="light"
              color="moss"
              onClick={() => onTest(mailTemplate)}
              title="Tester le template"
            >
              <IconFlask size={16} />
            </ActionIcon>
          )}
          {showAccessControls && (
            <ActionIcon
              variant="light"
              color="leather"
              onClick={() => onManageAccess?.(mailTemplate)}
              title="Partager"
              disabled={!onManageAccess || mailTemplate.canWrite === false}
            >
              <IconUsers size={16} />
            </ActionIcon>
          )}
          <ActionIcon
            variant="light"
            color="slate"
            onClick={() => onEdit(mailTemplate)}
            title="Modifier"
            disabled={showAccessControls && mailTemplate.canWrite === false}
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            color="danger"
            onClick={() => onDelete(mailTemplate)}
            title="Supprimer"
            disabled={showAccessControls && mailTemplate.canWrite === false}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ),
    },
  ];

  return (
    <Paper shadow="sm" p="md" withBorder w="100%">
      <DataTable
        records={mailTemplates}
        columns={columns}
        fetching={loading}
        noRecordsText={
          nameFilter
            ? 'Aucun template trouvé avec ces filtres'
            : 'Aucun template trouvé'
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
          `${from} - ${to} sur ${totalRecords} templates`
        }
      />
    </Paper>
  );
}
