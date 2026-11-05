'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Badge, Button, Group, Kbd, Select, Stack, Text, UnstyledButton } from '@mantine/core';
import { useWindowEvent } from '@mantine/hooks';
import { IconMailbox, IconSearch, IconUserPlus, IconUsers } from '@tabler/icons-react';
import type { LettersPageBootstrap } from '@/app/_actions/letters/letters';
import { apothecaryPillStyle } from '@/lib/apothecaryPill';
import { slatePalette } from '@/lib/design-tokens';
import {
  letterBoxAccessLevelLabel,
  type LetterBoxSummaryDTO,
  type LetterCorrespondentDTO,
  type LetterDTO,
  type LetterSearchHitDTO,
} from '@/types/letters';
import { useLetterCorrespondents, useLettersRealtime } from './hooks/useLettersQueries';
import { Conversation } from './components/Conversation';
import { CorrespondentFormModal } from './components/CorrespondentFormModal';
import { CorrespondentList } from './components/CorrespondentList';
import { LetterBoxMembersModal } from './components/LetterBoxMembersModal';
import { LetterFormModal } from './components/LetterFormModal';
import { LetterSearchSpotlight } from './components/LetterSearchSpotlight';
import classes from './letters.module.scss';

type FormState = { key: number; letter: LetterDTO } | null;
type CorrespondentFormState = { key: number; correspondent: LetterCorrespondentDTO | null; name: string } | null;

/**
 * « Lettres »: the contacts of the box on the left, the conversation of letters on the right.
 * Letters are added from a conversation, with its message bar (paste or drop the screenshots).
 */
export function LettersPageClient({ initial, box }: { initial: LettersPageBootstrap; box: LetterBoxSummaryDTO }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const boxId = box.id;
  const canWrite = box.accessLevel !== 'READ';
  const { limits } = initial;

  const correspondentsQuery = useLetterCorrespondents(boxId, initial.correspondents);
  const correspondents = correspondentsQuery.data ?? [];
  const correspondentId = searchParams.get('c') ?? initial.correspondentId;
  const correspondent = correspondents.find((entry) => entry.id === correspondentId) ?? null;
  useLettersRealtime(boxId);

  const [focus, setFocus] = useState<{ letterId: string; archived: boolean; nonce: number } | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [correspondentForm, setCorrespondentForm] = useState<CorrespondentFormState>(null);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const anyDialog = form !== null || correspondentForm !== null || spotlightOpen || membersOpen;

  // Contact in the URL without a server round trip (shareable link, back button).
  const selectCorrespondent = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('box', boxId);
      if (id) params.set('c', id);
      else params.delete('c');
      window.history.pushState(null, '', `${pathname}?${params.toString()}`);
    },
    [boxId, pathname, searchParams],
  );

  const openCorrespondentForm = (name: string) =>
    setCorrespondentForm((current) => ({ key: (current?.key ?? 0) + 1, correspondent: null, name }));

  // Ctrl/Cmd + K: search of the box.
  useWindowEvent('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setSpotlightOpen(true);
    }
  });
  const openLetterFromSearch = (hit: LetterSearchHitDTO) => {
    selectCorrespondent(hit.correspondentId);
    setFocus((current) => ({ letterId: hit.id, archived: hit.archived, nonce: (current?.nonce ?? 0) + 1 }));
  };

  return (
    <>
      <div className={classes.toolbar}>
        <IconMailbox size={28} stroke={1.4} color="var(--disp-sage)" />
        <h1 className={classes.title}>Lettres</h1>
        {initial.boxes.length > 1 ? (
          <Select
            size="sm"
            w={220}
            aria-label="Boîte aux lettres"
            data={initial.boxes.map((entry) => ({ value: entry.id, label: entry.name }))}
            value={boxId}
            allowDeselect={false}
            onChange={(value) => value && value !== boxId && router.push(`${pathname}?box=${encodeURIComponent(value)}`)}
          />
        ) : (
          <Text fw={600}>{box.name}</Text>
        )}
        <Badge variant="outline" radius="sm" style={apothecaryPillStyle(slatePalette)}>
          {letterBoxAccessLevelLabel(box.accessLevel)}
        </Badge>
        <UnstyledButton className={classes.searchTrigger} onClick={() => setSpotlightOpen(true)} aria-label="Rechercher une lettre">
          <Group
            gap="xs"
            px="sm"
            py={6}
            wrap="nowrap"
            style={{ border: '1px solid var(--disp-surface-border)', borderRadius: 'var(--mantine-radius-md)', background: 'var(--disp-surface)' }}
          >
            <IconSearch size={16} color="var(--disp-ink-muted)" />
            <Text size="sm" c="dimmed" style={{ flex: 1 }} truncate="end">
              Rechercher une lettre, un nom, un n° de série…
            </Text>
            <Kbd size="xs" visibleFrom="sm">Ctrl K</Kbd>
          </Group>
        </UnstyledButton>
        {initial.canManageMembers ? (
          <Button variant="light" color="slate" leftSection={<IconUsers size={16} />} onClick={() => setMembersOpen(true)}>
            Accès
          </Button>
        ) : null}
      </div>

      <div className={classes.layout}>
        <aside className={`${classes.contacts} ${correspondent ? classes.hideOnPhone : ''}`} aria-label="Correspondants">
          <CorrespondentList
            correspondents={correspondents}
            selectedId={correspondent?.id ?? null}
            canWrite={canWrite}
            onSelect={selectCorrespondent}
            onCreate={openCorrespondentForm}
          />
        </aside>

        <section className={`${classes.conversation} ${correspondent ? '' : classes.hideOnPhone}`}>
          {correspondent ? (
            <Conversation
              key={`${correspondent.id}-${focus?.nonce ?? 0}`}
              boxId={boxId}
              canWrite={canWrite}
              correspondent={correspondent}
              initialLetters={correspondent.id === initial.correspondentId ? initial.letters : undefined}
              focus={focus}
              onBack={() => selectCorrespondent(null)}
              limits={limits}
              paused={anyDialog}
              onEditLetter={(letter) => setForm((current) => ({ key: (current?.key ?? 0) + 1, letter }))}
              onEditCorrespondent={() =>
                setCorrespondentForm((current) => ({ key: (current?.key ?? 0) + 1, correspondent, name: correspondent.name }))
              }
            />
          ) : (
            <div className={classes.empty}>
              <Stack gap="sm" align="center" maw={420}>
                <IconMailbox size={56} stroke={1.1} color="var(--disp-ink-muted)" />
                <Text fw={600} ta="center">
                  Choisissez un correspondant pour voir vos échanges
                </Text>
                {canWrite ? (
                  <>
                    <Text size="sm" c="dimmed" ta="center">
                      Ouvrez sa conversation, puis collez ou glissez les captures de la lettre dans la barre du bas. Nouveau
                      correspondant : bouton + de la liste.
                    </Text>
                    <Button color="sage" leftSection={<IconUserPlus size={16} />} onClick={() => openCorrespondentForm('')}>
                      Nouveau correspondant
                    </Button>
                  </>
                ) : null}
              </Stack>
            </div>
          )}
        </section>
      </div>

      {form ? (
        <LetterFormModal
          key={form.key}
          opened
          onClose={() => setForm(null)}
          boxId={boxId}
          limits={limits}
          correspondents={correspondents}
          letter={form.letter}
          onSaved={(saved) => {
            if (saved.correspondentId !== correspondent?.id) selectCorrespondent(saved.correspondentId);
          }}
        />
      ) : null}

      {correspondentForm ? (
        <CorrespondentFormModal
          key={correspondentForm.key}
          opened
          onClose={() => setCorrespondentForm(null)}
          boxId={boxId}
          correspondent={correspondentForm.correspondent}
          initialName={correspondentForm.name}
          onSaved={(id) => selectCorrespondent(id)}
          onDeleted={() => {
            setCorrespondentForm(null);
            selectCorrespondent(null);
          }}
        />
      ) : null}

      <LetterSearchSpotlight
        opened={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
        boxId={boxId}
        onOpenCorrespondent={(id) => selectCorrespondent(id)}
        onOpenLetter={openLetterFromSearch}
      />

      <LetterBoxMembersModal opened={membersOpen} onClose={() => setMembersOpen(false)} boxId={boxId} boxName={box.name} />
    </>
  );
}
