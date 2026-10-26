'use client';

import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Container,
  CopyButton,
  Group,
  Paper,
  SegmentedControl,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconCheck, IconCopy, IconEdit, IconHistory, IconPlus, IconSearch } from '@tabler/icons-react';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { apothecaryBooleanPills } from '@/lib/apothecaryPill';
import type { BusinessPeopleList, BusinessPerson } from '@/lib/people/types';
import { EmploymentStatusBadge } from './components/EmploymentStatusBadge';
import { OrgChart } from './components/OrgChart';
import { PersonModal } from './components/PersonModal';
import { StaffHistoryModal } from './components/StaffHistoryModal';
import { usePeople } from './hooks/usePeopleQueries';

const PAGE_SIZE = 25;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

type StaffFilter = 'staff' | 'left' | 'all';

function matchesStaffFilter(person: BusinessPerson, filter: StaffFilter): boolean {
  if (filter === 'staff') return person.employment.active;
  if (filter === 'left') return !person.employment.active;
  return true;
}

function matchesSearch(person: BusinessPerson, query: string): boolean {
  if (!query) return true;
  return [
    person.displayName,
    person.lastDisplayName,
    person.discordUserId,
    person.account?.name ?? '',
    person.accountNumber != null ? String(person.accountNumber) : '',
    person.role ?? '',
  ].some((value) => normalize(value).includes(query));
}

export default function PeoplePageClient({ initialData }: { initialData: BusinessPeopleList }) {
  const { data } = usePeople(initialData);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ person: BusinessPerson | null } | null>(null);
  const [staffFilter, setStaffFilter] = useState<StaffFilter>('all');
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'chart'>('list');
  // From the query data, so the modal follows the status after a hiring or a leaving.
  const historyPerson = data.people.find((p) => p.discordUserId === historyId) ?? null;
  const staffCount = data.people.filter((p) => p.employment.active).length;

  const query = normalize(search.trim());
  const filtered = useMemo(
    () => data.people.filter((person) => matchesStaffFilter(person, staffFilter) && matchesSearch(person, query)),
    [data.people, query, staffFilter],
  );
  const records = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Personnes"
        description="Les personnes du dispensaire, avec ou sans compte intranet. Le nom fixé ici est utilisé partout, et le bot ne l'écrase plus. Une personne ajoutée sans compte y est liée dès qu'elle se connecte avec Discord."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModal({ person: null })}>
            Ajouter une personne
          </Button>
        }
      />

      <Paper shadow="sm" p="md" withBorder>
        <Group mb="md" align="flex-end" wrap="wrap">
          <SegmentedControl
            value={view}
            onChange={(value) => setView(value === 'chart' ? 'chart' : 'list')}
            data={[
              { value: 'list', label: 'Liste' },
              { value: 'chart', label: 'Organigramme' },
            ]}
          />
          {view === 'list' && (
            <SegmentedControl
              value={staffFilter}
              onChange={(value) => {
                setStaffFilter(value as StaffFilter);
                setPage(1);
              }}
              data={[
                { value: 'all', label: 'Tout le monde' },
                { value: 'staff', label: `Effectif actuel (${staffCount})` },
                { value: 'left', label: 'Hors effectif' },
              ]}
            />
          )}
          <TextInput
            style={{ flex: 1, minWidth: 220 }}
            leftSection={<IconSearch size={16} />}
            placeholder="Rechercher un nom, un Discord ID, un n° de compte…"
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setPage(1);
            }}
          />
        </Group>
        {view === 'chart' ? (
          <OrgChart
            people={data.people.filter((person) => matchesSearch(person, query))}
            onOpenPerson={(person) => setHistoryId(person.discordUserId)}
          />
        ) : (
          <DataTable
            records={records}
            idAccessor="discordUserId"
            columns={[
              {
                accessor: 'displayName',
                title: 'Nom',
                render: (person) => (
                  <div>
                    <Text size="sm" fw={600}>
                      {person.displayName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {person.fixedDisplayName ? 'Nom fixé' : 'Nom envoyé par le bot'}
                    </Text>
                  </div>
                ),
              },
              {
                accessor: 'discordUserId',
                title: 'Discord ID',
                render: (person) => (
                  <CopyButton value={person.discordUserId} timeout={1500}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copié' : 'Copier'} withArrow openDelay={100}>
                        <UnstyledButton
                          onClick={copy}
                          aria-label={`Copier le Discord ID de ${person.displayName}`}
                        >
                          <Group gap={6} wrap="nowrap">
                            <Text size="sm" ff="monospace">
                              {person.discordUserId}
                            </Text>
                            {copied ? (
                              <IconCheck size={14} color="var(--disp-sage)" />
                            ) : (
                              <IconCopy size={14} color="var(--disp-ink-muted)" />
                            )}
                          </Group>
                        </UnstyledButton>
                      </Tooltip>
                    )}
                  </CopyButton>
                ),
              },
              {
                accessor: 'account',
                title: 'Compte intranet',
                render: (person) =>
                  person.account ? (
                    <Badge variant="outline" radius="sm" style={apothecaryBooleanPills.yes}>
                      {person.account.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" radius="sm" style={apothecaryBooleanPills.no}>
                      Aucun compte
                    </Badge>
                  ),
              },
              {
                accessor: 'accountNumber',
                title: 'N° de compte',
                render: (person) => person.accountNumber ?? '—',
              },
              {
                accessor: 'role',
                title: 'Grade',
                render: (person) => person.role ?? '—',
              },
              {
                accessor: 'employment',
                title: 'Effectif',
                render: (person) => <EmploymentStatusBadge status={person.employment} />,
              },
              {
                accessor: 'salaryType',
                title: 'Salaire',
                hidden: data.salaryTypes == null,
                render: (person) =>
                  person.salaryType?.label ?? (
                    <Text span size="sm" c="dimmed">
                      Par défaut
                    </Text>
                  ),
              },
              {
                accessor: 'actions',
                title: '',
                textAlign: 'right',
                render: (person) => (
                  <Group gap={6} justify="flex-end" wrap="nowrap">
                    <Tooltip label="Parcours (embauches, grades, départs)" withArrow openDelay={100}>
                      <ActionIcon
                        variant="light"
                        color="sage"
                        onClick={() => setHistoryId(person.discordUserId)}
                        aria-label={`Parcours de ${person.displayName}`}
                      >
                        <IconHistory size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <ActionIcon
                      variant="light"
                      color="slate"
                      onClick={() => setModal({ person })}
                      aria-label={`Modifier ${person.displayName}`}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Group>
                ),
              },
            ]}
            noRecordsText={search ? 'Aucune personne trouvée' : 'Aucune personne pour le moment'}
            striped
            highlightOnHover
            minHeight={200}
            totalRecords={filtered.length}
            recordsPerPage={PAGE_SIZE}
            page={page}
            onPageChange={setPage}
            paginationSize="sm"
            paginationText={({ from, to, totalRecords }) => `${from} - ${to} sur ${totalRecords} personnes`}
          />
        )}
      </Paper>

      <Group mt="xs">
        <Text size="xs" c="dimmed">
          Un compte intranet sans Discord n&apos;a pas besoin d&apos;être ajouté : son nom vient de son
          compte.
        </Text>
      </Group>

      <PersonModal
        opened={modal != null}
        person={modal?.person ?? null}
        membersWithoutProfile={data.membersWithoutProfile}
        salaryTypes={data.salaryTypes}
        onClose={() => setModal(null)}
      />

      <StaffHistoryModal person={historyPerson} onClose={() => setHistoryId(null)} />
    </Container>
  );
}
