'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ActionIcon,
  Anchor,
  Badge,
  Code,
  Container,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconListSearch, IconRefresh, IconSearch } from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';
import type { AppLogRow, ListAppLogsInput } from '@/app/_actions/appLogs';
import { AppModal } from '@/app/_components/AppModal/AppModal';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { handleAction } from '@/lib/action';
import { apothecaryPillStyle } from '@/lib/apothecaryPill';
import dayjs from '@/lib/dayjs';
import { amberPalette, dangerPalette, slatePalette } from '@/lib/design-tokens';
import {
  LOG_FEATURE_LABELS,
  LOG_KIND_LABELS,
  LOG_LEVEL_LABELS,
  LOG_OUTCOME_LABELS,
  LOG_SOURCE_LABELS,
  toSelectData,
} from '@/lib/logs/labels';
import type { LogFeature, LogLevel, LogOutcome } from '@/lib/logs/types';
import { fetchPlatformRead } from '@/lib/read/fetchPlatformRead';
import { DEFAULT_LOG_PERIOD, LOG_PERIODS, logPeriodStart, type LogPeriod } from './logPeriods';

const PAGE_SIZE = 50;
const AUTO_REFRESH_MS = 30_000;

type LogsPage = { rows: AppLogRow[]; total: number };

type Filters = {
  period: LogPeriod;
  dispensaryId: string | null;
  feature: string | null;
  level: string | null;
  kind: string | null;
  source: string | null;
  outcome: string | null;
};

const EMPTY_FILTERS: Filters = {
  period: DEFAULT_LOG_PERIOD,
  dispensaryId: null,
  feature: null,
  level: null,
  kind: null,
  source: null,
  outcome: null,
};

const LEVEL_PALETTES: Record<LogLevel, Parameters<typeof apothecaryPillStyle>[0]> = {
  INFO: slatePalette,
  WARN: amberPalette,
  ERROR: dangerPalette,
};

function featureLabel(feature: string): string {
  return LOG_FEATURE_LABELS[feature as LogFeature] ?? feature;
}

/** Real time (not the RP calendar): logs are matched against Discord and server timestamps. */
function formatLogDate(date: Date): string {
  return dayjs(date).tz('Europe/Paris').format('DD/MM/YYYY HH:mm:ss');
}

function LevelBadge({ level }: { level: LogLevel }) {
  return (
    <Badge variant="outline" radius="sm" style={apothecaryPillStyle(LEVEL_PALETTES[level])}>
      {LOG_LEVEL_LABELS[level]}
    </Badge>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <Stack gap={4}>
      <Text size="sm" fw={700}>
        {label}
      </Text>
      <Code block style={{ maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(value, null, 2)}
      </Code>
    </Stack>
  );
}

function LogDetail({
  log,
  dispensaryName,
  onShowTargetHistory,
}: {
  log: AppLogRow;
  dispensaryName: string | null;
  onShowTargetHistory: (targetId: string) => void;
}) {
  const { targetId } = log;
  const facts: [string, string | null][] = [
    ['Date (heure réelle)', formatLogDate(log.createdAt)],
    ['Type', LOG_KIND_LABELS[log.kind]],
    ['Feature', featureLabel(log.feature)],
    ['Événement', log.event],
    ['Résultat', log.outcome ? LOG_OUTCOME_LABELS[log.outcome as LogOutcome] ?? log.outcome : null],
    ['Source', LOG_SOURCE_LABELS[log.source]],
    ['Dispensaire', dispensaryName ?? log.dispensaryId],
    ['Utilisateur', log.userId],
    ['Discord', log.discordUserId],
    ['Statut HTTP', log.httpStatus === null ? null : String(log.httpStatus)],
    ['Durée', log.durationMs === null ? null : `${log.durationMs} ms`],
    ['Chemin', log.path],
  ];
  return (
    <Stack gap="md">
      <Text>{log.message}</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <Text key={label} size="sm">
              <Text span c="dimmed" size="sm">
                {label} :{' '}
              </Text>
              {value}
            </Text>
          ))}
      </SimpleGrid>
      {targetId && (
        <Text size="sm">
          <Text span c="dimmed" size="sm">
            Objet :{' '}
          </Text>
          <Code>{targetId}</Code>{' '}
          <Anchor component="button" type="button" size="sm" onClick={() => onShowTargetHistory(targetId)}>
            Voir son historique
          </Anchor>
        </Text>
      )}
      <JsonBlock label="Contexte" value={log.context} />
      <JsonBlock label="Erreur" value={log.error} />
    </Stack>
  );
}

export function LogsPageClient({
  initialLogs,
  dispensaries,
}: {
  initialLogs: LogsPage | null;
  dispensaries: { id: string; name: string }[];
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [actor, setActor] = useState('');
  const [targetId, setTargetId] = useState('');
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [debouncedActor] = useDebouncedValue(actor.trim(), 300);
  const [debouncedTargetId] = useDebouncedValue(targetId.trim(), 300);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AppLogRow | null>(null);

  const dispensaryNames = new Map(dispensaries.map((dispensary) => [dispensary.id, dispensary.name]));
  const isInitialKey =
    page === 1 &&
    !debouncedSearch &&
    !debouncedActor &&
    !debouncedTargetId &&
    Object.entries(filters).every(([key, value]) => value === EMPTY_FILTERS[key as keyof Filters]);

  const logsQuery = useQuery({
    queryKey: ['platform', 'appLogs', filters, debouncedSearch, debouncedActor, debouncedTargetId, page],
    queryFn: async () => {
      const input: ListAppLogsInput = {
        page,
        pageSize: PAGE_SIZE,
        from: logPeriodStart(filters.period),
        dispensaryId: filters.dispensaryId ?? undefined,
        feature: filters.feature ?? undefined,
        level: (filters.level as ListAppLogsInput['level']) ?? undefined,
        kind: (filters.kind as ListAppLogsInput['kind']) ?? undefined,
        source: (filters.source as ListAppLogsInput['source']) ?? undefined,
        outcome: (filters.outcome as ListAppLogsInput['outcome']) ?? undefined,
        search: debouncedSearch || undefined,
        actor: debouncedActor || undefined,
        targetId: debouncedTargetId || undefined,
      };
      return handleAction(await fetchPlatformRead('', 'appLogs', input)) as LogsPage;
    },
    initialData: isInitialKey && initialLogs ? initialLogs : undefined,
    placeholderData: keepPreviousData,
    refetchInterval: AUTO_REFRESH_MS,
  });

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const logs = logsQuery.data ?? { rows: [], total: 0 };

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="Logs de l’application"
        description="Toutes les modifications de toutes les features (réussies ou non), erreurs serveur et requêtes du bot Discord. Conservés 90 jours."
        actions={
          <Tooltip label="Rafraîchir (automatique toutes les 30 s)">
            <ActionIcon
              variant="light"
              color="slate"
              size="lg"
              aria-label="Rafraîchir"
              loading={logsQuery.isFetching}
              onClick={() => void logsQuery.refetch()}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        }
      />

      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
          <Select
            label="Période"
            data={LOG_PERIODS.map(({ value, label }) => ({ value, label }))}
            value={filters.period}
            onChange={(value) => updateFilter('period', (value as LogPeriod | null) ?? DEFAULT_LOG_PERIOD)}
            allowDeselect={false}
          />
          <Select
            label="Dispensaire"
            placeholder="Tous"
            data={dispensaries.map((dispensary) => ({ value: dispensary.id, label: dispensary.name }))}
            value={filters.dispensaryId}
            onChange={(value) => updateFilter('dispensaryId', value)}
            searchable
            clearable
          />
          <Select
            label="Feature"
            placeholder="Toutes"
            data={toSelectData(LOG_FEATURE_LABELS)}
            value={filters.feature}
            onChange={(value) => updateFilter('feature', value)}
            searchable
            clearable
          />
          <Select
            label="Niveau"
            placeholder="Tous"
            data={toSelectData(LOG_LEVEL_LABELS)}
            value={filters.level}
            onChange={(value) => updateFilter('level', value)}
            clearable
          />
          <Select
            label="Type"
            placeholder="Tous"
            data={toSelectData(LOG_KIND_LABELS)}
            value={filters.kind}
            onChange={(value) => updateFilter('kind', value)}
            clearable
          />
          <Select
            label="Source"
            placeholder="Toutes"
            data={toSelectData(LOG_SOURCE_LABELS)}
            value={filters.source}
            onChange={(value) => updateFilter('source', value)}
            clearable
          />
          <Select
            label="Résultat"
            placeholder="Tous"
            data={toSelectData(LOG_OUTCOME_LABELS)}
            value={filters.outcome}
            onChange={(value) => updateFilter('outcome', value)}
            clearable
          />
          <TextInput
            label="Utilisateur ou Discord id"
            placeholder="Identifiant exact"
            value={actor}
            onChange={(event) => {
              setActor(event.currentTarget.value);
              setPage(1);
            }}
          />
          <TextInput
            label="Objet (id)"
            placeholder="Id exact : tout son historique"
            value={targetId}
            onChange={(event) => {
              setTargetId(event.currentTarget.value);
              setPage(1);
            }}
          />
        </SimpleGrid>
        <TextInput
          leftSection={<IconSearch size={16} />}
          placeholder="Rechercher dans le message, l’événement ou le chemin"
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setPage(1);
          }}
        />

        <DataTable
          withTableBorder
          highlightOnHover
          minHeight={200}
          fetching={logsQuery.isFetching && !logsQuery.data}
          records={logs.rows}
          totalRecords={logs.total}
          recordsPerPage={PAGE_SIZE}
          page={page}
          onPageChange={setPage}
          onRowClick={({ record }) => setSelected(record)}
          noRecordsText="Aucun log pour ces filtres"
          noRecordsIcon={<IconListSearch size={28} />}
          columns={[
            {
              accessor: 'createdAt',
              title: 'Date',
              width: 170,
              render: (log) => formatLogDate(log.createdAt),
            },
            {
              accessor: 'level',
              title: 'Niveau',
              width: 140,
              render: (log) => <LevelBadge level={log.level} />,
            },
            {
              accessor: 'feature',
              title: 'Feature',
              width: 140,
              render: (log) => featureLabel(log.feature),
            },
            {
              accessor: 'source',
              title: 'Source',
              width: 110,
              render: (log) => LOG_SOURCE_LABELS[log.source],
            },
            {
              accessor: 'dispensaryId',
              title: 'Dispensaire',
              width: 150,
              render: (log) =>
                log.dispensaryId ? dispensaryNames.get(log.dispensaryId) ?? log.dispensaryId : '—',
            },
            {
              accessor: 'message',
              title: 'Message',
              render: (log) => (
                <Text size="sm" lineClamp={2}>
                  {log.message}
                </Text>
              ),
            },
          ]}
        />
        <Group justify="flex-end">
          <Text size="xs" c="dimmed">
            {logs.total} log{logs.total > 1 ? 's' : ''}
          </Text>
        </Group>
      </Stack>

      <AppModal
        opened={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? selected.event : 'Log'}
        size="xl"
      >
        {selected && (
          <LogDetail
            log={selected}
            dispensaryName={selected.dispensaryId ? dispensaryNames.get(selected.dispensaryId) ?? null : null}
            onShowTargetHistory={(id) => {
              // Whole history of the object: any period, no other filter.
              setFilters({ ...EMPTY_FILTERS, period: '90d' });
              setSearch('');
              setActor('');
              setTargetId(id);
              setPage(1);
              setSelected(null);
            }}
          />
        )}
      </AppModal>
    </Container>
  );
}
