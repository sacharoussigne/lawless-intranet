'use client';

import { Paper, Stack, Text } from '@mantine/core';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AppModal } from '@/app/_components/AppModal/AppModal';
import { formatBusinessHistoryAction } from '@/lib/businessWeeklyActivity/historyActionLabel';
import { formatHistoryValueChanges } from '@/lib/businessWeeklyActivity/historyValueDiff';
import { useWeeklyActivityHistory } from './hooks/useWeeklyActivityQueries';
import { useBusinessTypeDefinition } from '@/app/_contexts/PermissionsContext';

type HistoryWeeklyActivityModalProps = {
  activityId: string | null;
  title: string;
  onClose: () => void;
};

export function HistoryWeeklyActivityModal({
  activityId,
  title,
  onClose,
}: HistoryWeeklyActivityModalProps) {
  const { weeklyCounters } = useBusinessTypeDefinition();
  const { data: historyEntries = [], isFetching } = useWeeklyActivityHistory(
    activityId,
    activityId !== null,
  );

  return (
    <AppModal
      opened={activityId !== null}
      onClose={onClose}
      title={`Historique — ${title}`}
      zIndex={400}
    >
      <Stack gap="sm">
        {isFetching && historyEntries.length === 0 ? (
          <Text c="dimmed" size="sm">
            Chargement…
          </Text>
        ) : historyEntries.length === 0 ? (
          <Text c="dimmed" size="sm">
            Aucun historique.
          </Text>
        ) : (
          historyEntries.map((h) => {
            const valueChanges = formatHistoryValueChanges(
              h.action,
              h.previousValues,
              h.nextValues,
              weeklyCounters,
            );
            const counterLabel = weeklyCounters.find((c) => c.key === h.counterKey)?.label ?? h.counterKey;

            return (
              <Paper key={h.id} withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed">
                  {format(new Date(h.createdAt), 'Pp', { locale: fr })} —{' '}
                  {formatBusinessHistoryAction(h.action, counterLabel)} —{' '}
                  {h.source === 'INTRANET' ? 'Intranet' : 'Bot Discord'}
                </Text>
                <Text size="sm">
                  {h.actorResolvedName
                    ? `${h.actorResolvedName}${h.actorDiscordUserId ? ` (${h.actorDiscordUserId})` : ''}`
                    : (h.actorDiscordUserId ?? '—')}
                  {h.actorImpersonatedByName && (
                    <Text span size="xs" c="dimmed">
                      {' '}
                      (fait par {h.actorImpersonatedByName} en tant que cette personne)
                    </Text>
                  )}
                </Text>
                {valueChanges.length > 0 && (
                  <Stack gap={2} mt="xs">
                    {valueChanges.map((line) => (
                      <Text key={line} size="sm" ff="monospace">
                        {line}
                      </Text>
                    ))}
                  </Stack>
                )}
              </Paper>
            );
          })
        )}
      </Stack>
    </AppModal>
  );
}
