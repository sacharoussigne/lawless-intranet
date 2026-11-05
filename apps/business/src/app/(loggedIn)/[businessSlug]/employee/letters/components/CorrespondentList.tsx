'use client';

import { useMemo, useState } from 'react';
import { ActionIcon, Avatar, Badge, CloseButton, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { IconArrowBackUp, IconSearch, IconUserPlus } from '@tabler/icons-react';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import type { LetterCorrespondentDTO } from '@/types/letters';
import classes from '../letters.module.scss';

/** Left pane: the contacts of the box, latest letter first (like a messaging app). */
export function CorrespondentList({
  correspondents,
  selectedId,
  canWrite,
  onSelect,
  onCreate,
}: {
  correspondents: LetterCorrespondentDTO[];
  selectedId: string | null;
  canWrite: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
}) {
  const { formatRpDate } = useRpCalendar();
  const [filter, setFilter] = useState('');
  const visible = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase('fr');
    return needle
      ? correspondents.filter((entry) => entry.name.toLocaleLowerCase('fr').includes(needle))
      : correspondents;
  }, [correspondents, filter]);

  return (
    <>
      <div className={classes.contactsHeader}>
        <Group gap="xs" wrap="nowrap">
          <TextInput
            size="xs"
            style={{ flex: 1 }}
            placeholder="Filtrer les correspondants"
            leftSection={<IconSearch size={14} />}
            rightSection={filter ? <CloseButton size="xs" onClick={() => setFilter('')} aria-label="Effacer" /> : null}
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value)}
            {...noAutofillProps}
          />
          {canWrite ? (
            <Tooltip label="Nouveau correspondant">
              <ActionIcon variant="light" color="sage" onClick={() => onCreate(filter.trim())} aria-label="Nouveau correspondant">
                <IconUserPlus size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null}
        </Group>
      </div>
      <div className={classes.contactsList}>
        {visible.length === 0 ? (
          <Stack p="md" gap={4} align="center">
            <Text size="sm" c="dimmed" ta="center">
              {correspondents.length === 0
                ? 'Pas encore de correspondant. Ajoutez une lettre : son expéditeur apparaîtra ici.'
                : 'Aucun correspondant ne correspond.'}
            </Text>
          </Stack>
        ) : (
          visible.map((entry) => (
            <button
              type="button"
              key={entry.id}
              className={classes.contact}
              data-active={entry.id === selectedId || undefined}
              onClick={() => onSelect(entry.id)}
            >
              <Avatar color="leather" radius="xl" size={38}>
                {entry.name.slice(0, 1).toUpperCase()}
              </Avatar>
              <div className={classes.contactBody}>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text size="sm" fw={600} truncate="end">
                    {entry.name}
                  </Text>
                  {entry.lastLetterAt ? (
                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                      {formatRpDate(entry.lastLetterAt, 'd MMM')}
                    </Text>
                  ) : null}
                </Group>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed" truncate="end">
                    {entry.lastLetter ? (
                      <>
                        {entry.lastLetter.direction === 'SENT' ? (
                          <IconArrowBackUp size={12} style={{ verticalAlign: '-2px', marginRight: 2 }} />
                        ) : null}
                        {entry.lastLetter.title}
                      </>
                    ) : (
                      'Aucune lettre'
                    )}
                  </Text>
                  {entry.letterCount > 0 ? (
                    <Badge size="xs" variant="light" color="sage" radius="xl" style={{ flexShrink: 0 }}>
                      {entry.letterCount}
                    </Badge>
                  ) : null}
                </Group>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );
}
