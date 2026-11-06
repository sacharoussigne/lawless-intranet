'use client';

import { useState } from 'react';
import { Avatar, Badge, Checkbox, Group, Loader, Modal, ScrollArea, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import { apothecaryPillStyle } from '@/lib/apothecaryPill';
import { amberPalette } from '@/lib/design-tokens';
import { letterDirectionLabel, type LetterSearchHitDTO } from '@/types/letters';
import { useLetterSearch } from '../hooks/useLettersQueries';
import classes from '../letters.module.scss';

/**
 * Search of the whole box (Ctrl/Cmd + K): contacts, letters by title, transcript or serial, then the
 * letters close by meaning (« la lettre où il demande un oiseau »).
 */
export function LetterSearchSpotlight({
  opened,
  onClose,
  boxId,
  onOpenCorrespondent,
  onOpenLetter,
}: {
  opened: boolean;
  onClose: () => void;
  boxId: string;
  onOpenCorrespondent: (id: string) => void;
  onOpenLetter: (hit: LetterSearchHitDTO) => void;
}) {
  const { formatRpDate } = useRpCalendar();
  const [query, setQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(true);
  const [debounced] = useDebouncedValue(query, 200);
  const search = useLetterSearch(boxId, debounced, includeArchived);
  const results = search.data;
  const tooShort = debounced.trim().length < 2;
  const exactLetters = results?.letters.filter((hit) => hit.match === 'text') ?? [];
  const meaningLetters = results?.letters.filter((hit) => hit.match === 'meaning') ?? [];
  const renderHit = (hit: LetterSearchHitDTO) => (
    <UnstyledButton
      key={hit.id}
      className={classes.contact}
      onClick={() => {
        onOpenLetter(hit);
        onClose();
      }}
    >
      <div className={classes.contactBody}>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Text size="sm" fw={600} truncate="end">
            {hit.title}
          </Text>
          <Text size="xs" c="dimmed" className={classes.serial} style={{ flexShrink: 0 }}>
            {hit.serial}
          </Text>
        </Group>
        <Group gap={6} wrap="nowrap">
          <Text size="xs" c="dimmed" truncate="end">
            {letterDirectionLabel(hit.direction)} · {hit.correspondentName} ·{' '}
            {formatRpDate(hit.letterDate, 'd MMM yyyy')}
          </Text>
          {hit.archived ? (
            <Badge size="xs" variant="outline" radius="sm" style={apothecaryPillStyle(amberPalette)}>
              Archivée
            </Badge>
          ) : null}
        </Group>
        {hit.excerpt ? (
          <Text size="xs" mt={2} lineClamp={2}>
            {hit.excerpt}
          </Text>
        ) : null}
      </div>
    </UnstyledButton>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      size="lg"
      yOffset="10vh"
      padding="md"
      radius="md"
    >
      <Stack gap="sm">
        <TextInput
          data-autofocus
          size="md"
          placeholder="Nom, mot, idée de la lettre ou n° de série (GM-…)"
          leftSection={search.isFetching ? <Loader size={16} color="sage" /> : <IconSearch size={18} />}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          {...noAutofillProps}
        />
        <Checkbox
          size="xs"
          color="sage"
          label="Inclure les lettres archivées"
          checked={includeArchived}
          onChange={(event) => setIncludeArchived(event.currentTarget.checked)}
        />
        <ScrollArea.Autosize mah="55vh" type="auto">
          {tooShort ? (
            <Text size="sm" c="dimmed" ta="center" py="lg">
              Tapez au moins 2 caractères.
            </Text>
          ) : results && results.correspondents.length === 0 && results.letters.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="lg">
              Rien trouvé pour « {debounced.trim()} ».
            </Text>
          ) : (
            <Stack gap={4}>
              {results?.correspondents.map((entry) => (
                <UnstyledButton
                  key={entry.id}
                  className={classes.contact}
                  onClick={() => {
                    onOpenCorrespondent(entry.id);
                    onClose();
                  }}
                >
                  <Avatar color="leather" radius="xl" size={30}>
                    {entry.name.slice(0, 1).toUpperCase()}
                  </Avatar>
                  <Text size="sm" fw={600}>
                    {entry.name}
                  </Text>
                  <Text size="xs" c="dimmed" ml="auto">
                    Correspondant
                  </Text>
                </UnstyledButton>
              ))}
              {exactLetters.map(renderHit)}
              {meaningLetters.length > 0 ? (
                <Text size="xs" c="dimmed" fw={600} tt="uppercase" mt="xs" px="sm">
                  Proches par le sens
                </Text>
              ) : null}
              {meaningLetters.map(renderHit)}
            </Stack>
          )}
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
}
