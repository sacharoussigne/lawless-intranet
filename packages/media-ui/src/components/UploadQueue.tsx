'use client';

import { ActionIcon, Group, Paper, Progress, Stack, Text, Tooltip } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import type { MediaUploadItem } from '../hooks/useMediaUploads';

type UploadQueueProps = {
  items: MediaUploadItem[];
  onClear: () => void;
};

export function UploadQueue({ items, onClear }: UploadQueueProps) {
  if (items.length === 0) return null;
  const running = items.some((item) => item.status === 'pending' || item.status === 'uploading');

  return (
    <Paper
      withBorder
      shadow="md"
      p="sm"
      radius="md"
      style={{ position: 'fixed', right: 16, bottom: 16, width: 340, maxWidth: 'calc(100vw - 32px)', zIndex: 200 }}
    >
      <Group justify="space-between" mb="xs">
        <Text fw={600} size="sm">
          {running ? 'Import en cours…' : 'Imports terminés'}
        </Text>
        {!running ? (
          <Tooltip label="Fermer">
            <ActionIcon variant="subtle" color="slate" size="sm" onClick={onClear} aria-label="Fermer">
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
        ) : null}
      </Group>
      <Stack gap="xs" mah={240} style={{ overflowY: 'auto' }}>
        {items.map((item) => (
          <Stack key={item.id} gap={2}>
            <Group justify="space-between" wrap="nowrap" gap="xs">
              <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                {item.name}
              </Text>
              {item.status === 'done' ? <IconCheck size={14} color="var(--mantine-color-moss-6)" /> : null}
            </Group>
            {item.status === 'error' ? (
              <Text size="xs" c="danger">
                {item.error}
              </Text>
            ) : (
              <Progress
                value={Math.round(item.progress * 100)}
                size="sm"
                color={item.status === 'done' ? 'moss' : undefined}
                animated={item.status === 'uploading'}
              />
            )}
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
