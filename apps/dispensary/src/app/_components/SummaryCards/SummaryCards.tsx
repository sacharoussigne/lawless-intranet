'use client';

import { Group, Paper, Stack, Text } from '@mantine/core';

export interface SummaryCard {
  label: string;
  value: number;
  color?: string;
  backgroundColor?: string;
  formatValue?: (value: number) => string;
  detail?: string;
}

interface SummaryCardsProps {
  cards: SummaryCard[];
}

export function SummaryCards({ cards }: SummaryCardsProps) {
  return (
    <Group gap="md" grow align="stretch">
      {cards.map((card, index) => {
        const formattedValue = card.formatValue
          ? card.formatValue(card.value)
          : card.value.toFixed(2) + ' $';

        return (
          <Paper
            key={index}
            p="md"
            withBorder
            radius="md"
            style={{
              background: card.backgroundColor || 'var(--mantine-color-sage-0)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Stack gap={4} style={{ flex: 1 }}>
              <Text size="xs" c="dimmed" fw={500}>
                {card.label}
              </Text>
              <Text size="xl" fw={700} c={card.color}>
                {formattedValue}
              </Text>
              <Text
                size="xs"
                c="dimmed"
                style={{
                  minHeight: '1.25rem',
                  visibility: card.detail ? 'visible' : 'hidden',
                }}
              >
                {card.detail || '\u00a0'}
              </Text>
            </Stack>
          </Paper>
        );
      })}
    </Group>
  );
}
