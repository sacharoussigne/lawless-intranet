'use client';

import { ActionIcon, Group, Menu, SegmentedControl, Tooltip, UnstyledButton, Text } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconCheck, IconLayoutGrid, IconList } from '@tabler/icons-react';
import type { MediaSort, MediaSortKey } from '../format';

export type MediaView = 'grid' | 'list';

const SORT_LABELS: Record<MediaSortKey, string> = { name: 'Nom', date: "Date d'ajout" };

/** Grid ↔ list switch (Drive's top-right icons). */
export function ViewToggle({ value, onChange }: { value: MediaView; onChange: (view: MediaView) => void }) {
  return (
    <SegmentedControl
      size="xs"
      radius="xl"
      value={value}
      onChange={(next) => onChange(next === 'list' ? 'list' : 'grid')}
      data={[
        {
          value: 'grid',
          label: (
            <Tooltip label="Grille" withinPortal>
              <IconLayoutGrid size={16} aria-label="Vue en grille" style={{ display: 'block' }} />
            </Tooltip>
          ),
        },
        {
          value: 'list',
          label: (
            <Tooltip label="Liste" withinPortal>
              <IconList size={16} aria-label="Vue en liste" style={{ display: 'block' }} />
            </Tooltip>
          ),
        },
      ]}
    />
  );
}

/** « Nom ↑ » above the grid: the label picks the criterion, the arrow flips the direction. */
export function SortControl({
  sort,
  onChange,
}: {
  sort: MediaSort;
  onChange: (sort: MediaSort) => void;
}) {
  const Arrow = sort.direction === 'asc' ? IconArrowUp : IconArrowDown;
  return (
    <Group gap={2} wrap="nowrap">
      <Menu position="bottom-start" width={200} shadow="md" withinPortal>
        <Menu.Target>
          <UnstyledButton px="xs" py={2} style={{ borderRadius: 'var(--mantine-radius-xl)' }}>
            <Text size="sm" fw={500}>
              {SORT_LABELS[sort.key]}
            </Text>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Trier par</Menu.Label>
          {(Object.keys(SORT_LABELS) as MediaSortKey[]).map((key) => (
            <Menu.Item
              key={key}
              leftSection={key === sort.key ? <IconCheck size={16} /> : <span style={{ width: 16 }} />}
              onClick={() =>
                key !== sort.key && onChange({ key, direction: key === 'date' ? 'desc' : 'asc' })
              }
            >
              {SORT_LABELS[key]}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      <Tooltip label={sort.direction === 'asc' ? 'Ordre croissant' : 'Ordre décroissant'} withinPortal>
        <ActionIcon
          variant="light"
          radius="xl"
          size="sm"
          aria-label="Inverser l'ordre"
          onClick={() => onChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
        >
          <Arrow size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
