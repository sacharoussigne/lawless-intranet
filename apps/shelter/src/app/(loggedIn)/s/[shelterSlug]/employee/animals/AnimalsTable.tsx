'use client';

import { Paper, Select, TextInput } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { ANIMAL_STATUS_LABELS, ANIMAL_STATUS_OPTIONS } from '@/lib/animals/labels';
import { formatRpDate } from '@/lib/rpCalendar';
import { parseIsoDateOnly, type AnimalDTO } from './types';

export type SelectOption = { value: string; label: string };

type AnimalsTableProps = {
  animals: AnimalDTO[];
  nameFilter: string;
  speciesFilter: string | null;
  breedFilter: string | null;
  statusFilter: string | null;
  caseManagerFilter: string | null;
  speciesOptions: SelectOption[];
  breedOptions: SelectOption[];
  caseManagerOptions: SelectOption[];
  page: number;
  pageSize: number;
  totalRecords: number;
  onNameFilterChange: (value: string) => void;
  onSpeciesFilterChange: (value: string | null) => void;
  onBreedFilterChange: (value: string | null) => void;
  onStatusFilterChange: (value: string | null) => void;
  onCaseManagerFilterChange: (value: string | null) => void;
  onPageChange: (page: number) => void;
  onRowClick: (animal: AnimalDTO) => void;
};

export function AnimalsTable({
  animals,
  nameFilter,
  speciesFilter,
  breedFilter,
  statusFilter,
  caseManagerFilter,
  speciesOptions,
  breedOptions,
  caseManagerOptions,
  page,
  pageSize,
  totalRecords,
  onNameFilterChange,
  onSpeciesFilterChange,
  onBreedFilterChange,
  onStatusFilterChange,
  onCaseManagerFilterChange,
  onPageChange,
  onRowClick,
}: AnimalsTableProps) {
  return (
    <Paper shadow="sm" p="md" withBorder>
      <DataTable
        records={animals}
        highlightOnHover
        rowStyle={() => ({ cursor: 'pointer' })}
        onRowClick={({ record }) => onRowClick(record)}
        columns={[
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
            accessor: 'arrivalDate',
            title: 'Arrivée',
            render: (animal) =>
              formatRpDate(parseIsoDateOnly(animal.arrivalDate), 'dd/MM/yyyy'),
          },
          {
            accessor: 'caseManagerName',
            title: 'Responsable',
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
