'use client';

import Link from 'next/link';
import { ActionIcon, Badge, Group, MultiSelect, Paper, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { DataTable, type DataTableSortStatus } from 'mantine-datatable';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { ANIMAL_STATUS_LABELS, ANIMAL_STATUS_OPTIONS } from '@/lib/animals/labels';
import {
  FOLLOW_UP_STATUS_BADGE_COLORS,
  FOLLOW_UP_STATUS_LABELS,
  FOLLOW_UP_STATUS_OPTIONS,
} from '@/lib/animals/followUpLabels';
import { formatRpDate } from '@/lib/rpCalendar';
import classes from './AnimalsPage.module.scss';
import { parseIsoDateOnly, type AnimalDTO } from './types';

export type SelectOption = { value: string; label: string };

/** Relative day label + RP date in parentheses (trial display). */
function formatLastFollowUpRelative(isoDate: string): string {
  const date = parseIsoDateOnly(isoDate);
  if (!date) return '—';

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round(
    (startOfToday.getTime() - startOfTarget.getTime()) / (24 * 60 * 60 * 1000),
  );
  const exact = formatRpDate(date, 'dd/MM/yyyy');

  if (days === 0) return `Aujourd'hui (${exact})`;
  if (days === 1) return `Hier (${exact})`;
  if (days > 1) return `Il y a ${days} jours (${exact})`;
  return exact;
}

export const FOLLOW_UP_STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'Aucun suivi' },
  ...FOLLOW_UP_STATUS_OPTIONS,
];

type AnimalsTableProps = {
  animals: AnimalDTO[];
  nameFilter: string;
  speciesFilter: string | null;
  breedFilter: string | null;
  statusFilter: string | null;
  caseManagerFilter: string | null;
  followUpStatusFilter: string[];
  speciesOptions: SelectOption[];
  breedOptions: SelectOption[];
  caseManagerOptions: SelectOption[];
  sortStatus: DataTableSortStatus<AnimalDTO>;
  page: number;
  pageSize: number;
  totalRecords: number;
  canDelete: boolean;
  onNameFilterChange: (value: string) => void;
  onSpeciesFilterChange: (value: string | null) => void;
  onBreedFilterChange: (value: string | null) => void;
  onStatusFilterChange: (value: string | null) => void;
  onCaseManagerFilterChange: (value: string | null) => void;
  onFollowUpStatusFilterChange: (value: string[]) => void;
  onSortStatusChange: (status: DataTableSortStatus<AnimalDTO>) => void;
  onPageChange: (page: number) => void;
  getRowHref: (animal: AnimalDTO) => string;
  onDelete: (animal: AnimalDTO) => void | Promise<void>;
};

export function AnimalsTable({
  animals,
  nameFilter,
  speciesFilter,
  breedFilter,
  statusFilter,
  caseManagerFilter,
  followUpStatusFilter,
  speciesOptions,
  breedOptions,
  caseManagerOptions,
  sortStatus,
  page,
  pageSize,
  totalRecords,
  canDelete,
  onNameFilterChange,
  onSpeciesFilterChange,
  onBreedFilterChange,
  onStatusFilterChange,
  onCaseManagerFilterChange,
  onFollowUpStatusFilterChange,
  onSortStatusChange,
  onPageChange,
  getRowHref,
  onDelete,
}: AnimalsTableProps) {
  return (
    <Paper shadow="sm" p="md" withBorder>
      <DataTable
        records={animals}
        highlightOnHover
        rowStyle={() => ({ cursor: 'pointer' })}
        customRowAttributes={() => ({ style: { position: 'relative' } })}
        sortStatus={sortStatus}
        onSortStatusChange={onSortStatusChange}
        columns={[
          {
            accessor: 'name',
            title: 'Nom',
            sortable: true,
            render: (animal) => (
              <Link href={getRowHref(animal)} className={classes.rowLink}>
                {animal.name}
              </Link>
            ),
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
            accessor: 'species.name',
            title: 'Espèce',
            render: (animal) => animal.species.name,
            filter: (
              <Select
                placeholder="Toutes les espèces"
                data={speciesOptions}
                value={speciesFilter}
                onChange={onSpeciesFilterChange}
                clearable
                searchable
                style={{ minWidth: 200 }}
              />
            ),
          },
          {
            accessor: 'breed.name',
            title: 'Race',
            render: (animal) => animal.breed.name,
            filter: (
              <Select
                placeholder="Toutes les races"
                data={breedOptions}
                value={breedFilter}
                onChange={onBreedFilterChange}
                clearable
                searchable
                disabled={breedOptions.length === 0}
                style={{ minWidth: 200 }}
              />
            ),
          },
          {
            accessor: 'status',
            title: 'Statut',
            sortable: true,
            render: (animal) => ANIMAL_STATUS_LABELS[animal.status],
            filter: (
              <Select
                placeholder="Tous les statuts"
                data={ANIMAL_STATUS_OPTIONS}
                value={statusFilter}
                onChange={onStatusFilterChange}
                clearable
                searchable
                style={{ minWidth: 220 }}
              />
            ),
          },
          {
            accessor: 'lastFollowUpDate',
            title: 'Dernier suivi',
            sortable: true,
            filtering: followUpStatusFilter.length > 0,
            render: (animal) => {
              if (!animal.lastFollowUpDate || !animal.lastFollowUpStatus) {
                return (
                  <Text c="dimmed" size="sm">
                    —
                  </Text>
                );
              }
              return (
                <Stack gap={4}>
                  <Text size="sm">{formatLastFollowUpRelative(animal.lastFollowUpDate)}</Text>
                  <Badge
                    size="sm"
                    radius="sm"
                    color={FOLLOW_UP_STATUS_BADGE_COLORS[animal.lastFollowUpStatus].color}
                    variant={FOLLOW_UP_STATUS_BADGE_COLORS[animal.lastFollowUpStatus].variant}
                    w="fit-content"
                  >
                    {FOLLOW_UP_STATUS_LABELS[animal.lastFollowUpStatus]}
                  </Badge>
                </Stack>
              );
            },
            filter: (
              <MultiSelect
                placeholder="Tous les suivis"
                data={FOLLOW_UP_STATUS_FILTER_OPTIONS}
                value={followUpStatusFilter}
                onChange={onFollowUpStatusFilterChange}
                clearable
                searchable
                hidePickedOptions
                comboboxProps={{ withinPortal: false }}
                style={{ minWidth: 260 }}
              />
            ),
          },
          {
            accessor: 'arrivalDate',
            title: 'Arrivée',
            sortable: true,
            render: (animal) =>
              formatRpDate(parseIsoDateOnly(animal.arrivalDate), 'dd/MM/yyyy'),
          },
          {
            accessor: 'caseManagerName',
            title: 'Responsable',
            sortable: true,
            filter: (
              <Select
                placeholder="Tous les responsables"
                data={caseManagerOptions}
                value={caseManagerFilter}
                onChange={onCaseManagerFilterChange}
                clearable
                searchable
                style={{ minWidth: 200 }}
              />
            ),
          },
          ...(canDelete
            ? [
                {
                  accessor: 'actions',
                  title: '',
                  textAlign: 'right' as const,
                  width: 56,
                  render: (animal: AnimalDTO) => (
                    <Group
                      gap="xs"
                      justify="flex-end"
                      wrap="nowrap"
                      className={classes.rowActions}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <DeleteConfirmPopover
                        title="Supprimer l’animal ?"
                        message={`L’animal « ${animal.name} » sera supprimé.`}
                        onConfirm={() => onDelete(animal)}
                      >
                        <ActionIcon
                          variant="light"
                          color="danger"
                          aria-label={`Supprimer ${animal.name}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </DeleteConfirmPopover>
                    </Group>
                  ),
                },
              ]
            : []),
        ]}
        totalRecords={totalRecords}
        recordsPerPage={pageSize}
        page={page}
        onPageChange={onPageChange}
        noRecordsText="Aucun animal trouvé"
      />
    </Paper>
  );
}
