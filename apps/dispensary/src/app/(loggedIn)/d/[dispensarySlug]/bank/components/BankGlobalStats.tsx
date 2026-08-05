'use client';

import { Badge, Group, Paper, Stack, Text } from '@mantine/core';
import { IconCalendarEvent } from '@tabler/icons-react';
import type { BankGlobalStats as BankGlobalStatsType } from '@/types/bankAccounts';

type BankGlobalStatsProps = {
  stats: BankGlobalStatsType;
  onPendingClick?: () => void;
};

function formatMoney(value: number, withSign = false) {
  const prefix = withSign && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)} $`;
}

export function BankGlobalStats({ stats, onPendingClick }: BankGlobalStatsProps) {
  return (
    <Paper shadow="sm" p="md" withBorder radius="md">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Group gap="xl" wrap="wrap">
          <Stack gap={2}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Solde actuel
            </Text>
            <Text size="xl" fw={700} style={{ fontFamily: 'var(--disp-font-display)' }}>
              {formatMoney(stats.currentBalance)}
            </Text>
          </Stack>

          <Stack gap={2}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Net du mois
            </Text>
            <Text
              size="lg"
              fw={600}
              c={stats.monthNet >= 0 ? 'moss' : 'danger'}
            >
              {formatMoney(stats.monthNet, true)}
            </Text>
            <Text size="xs" c="dimmed">
              Entrées {formatMoney(stats.monthIn)} · Sorties {formatMoney(stats.monthOut)}
            </Text>
          </Stack>
        </Group>

        {stats.pendingOccurrences > 0 && (
          <Badge
            size="lg"
            variant="outline"
            color="amber"
            leftSection={<IconCalendarEvent size={14} />}
            style={{ cursor: onPendingClick ? 'pointer' : undefined }}
            onClick={onPendingClick}
          >
            {stats.pendingOccurrences} occurrence
            {stats.pendingOccurrences > 1 ? 's' : ''} en attente
          </Badge>
        )}
      </Group>
    </Paper>
  );
}
