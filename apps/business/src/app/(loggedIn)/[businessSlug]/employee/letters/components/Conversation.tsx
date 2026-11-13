'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Button,
  Checkbox,
  CloseButton,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconPencil, IconSearch } from '@tabler/icons-react';
import { MediaViewer, copyImageToClipboard } from '@lawless-intranet/media-ui';
import type { MediaFileRecord, MediaLimitsRecord } from '@lawless-intranet/types';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import { archiveLetter, deleteLetter, unarchiveLetter } from '@/app/_actions/letters/letters';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import type { LetterCorrespondentDTO, LetterDTO, LetterReplyRefDTO } from '@/types/letters';
import { useLetterBoxMutation, useLetterConversation, type ConversationFilters } from '../hooks/useLettersQueries';
import { LetterBubble } from './LetterBubble';
import { letterDay } from '@/lib/letters/letterTime';
import { LetterComposer } from './LetterComposer';
import classes from '../letters.module.scss';

const HIGHLIGHT_MS = 2500;

function toViewerFiles(letter: LetterDTO): MediaFileRecord[] {
  const iso = new Date(letter.letterDate).toISOString();
  return letter.images.map((image) => ({
    id: image.mediaFileId,
    folderId: null,
    name: image.name,
    mimeType: image.mimeType,
    size: image.size,
    uploadedById: letter.createdBy.id,
    createdAt: iso,
    updatedAt: iso,
    previewUrl: image.previewUrl,
    shareToken: null,
  }));
}

export function Conversation({
  boxId,
  canWrite,
  correspondent,
  initialLetters,
  focus,
  onBack,
  limits,
  paused,
  onEditLetter,
  onEditCorrespondent,
}: {
  boxId: string;
  canWrite: boolean;
  correspondent: LetterCorrespondentDTO;
  initialLetters?: LetterDTO[];
  /** Letter to scroll to and highlight (from the search). The parent remounts the conversation for each request. */
  focus: { letterId: string; archived: boolean } | null;
  onBack: () => void;
  limits: MediaLimitsRecord;
  /** A dialog of the page is open (edit form…): the message bar leaves paste and drop to it. */
  paused: boolean;
  onEditLetter: (letter: LetterDTO) => void;
  onEditCorrespondent: () => void;
}) {
  const { formatRpDate } = useRpCalendar();
  const slug = useRequiredBusinessSlug();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search.trim(), 250);
  // An archived letter asked by the search is only in the list with the archived ones.
  const [includeArchived, setIncludeArchived] = useState(focus?.archived ?? false);
  const filters: ConversationFilters = { search: debouncedSearch, includeArchived };
  const isDefaultView = !debouncedSearch && !includeArchived;
  const conversation = useLetterConversation(boxId, correspondent.id, filters, isDefaultView ? initialLetters : undefined);
  const letters = useMemo(() => conversation.data ?? [], [conversation.data]);
  const [viewer, setViewer] = useState<{ letter: LetterDTO; index: number } | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<LetterReplyRefDTO | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const bubbles = useRef(new Map<string, HTMLDivElement>());

  const archive = useLetterBoxMutation(
    boxId,
    (slug, letter: LetterDTO, meta) =>
      letter.archivedAt ? unarchiveLetter(slug, { id: letter.id }, meta) : archiveLetter(slug, { id: letter.id }, meta),
    { success: 'Lettre mise à jour', error: 'Impossible de modifier la lettre' },
  );
  const remove = useLetterBoxMutation(
    boxId,
    (slug, letter: LetterDTO, meta) => deleteLetter(slug, { id: letter.id }, meta),
    { success: 'Lettre supprimée', error: 'Impossible de supprimer la lettre' },
  );

  const focusDone = useRef(false);

  const flash = useCallback((letterId: string) => {
    const element = bubbles.current.get(letterId);
    if (!element) return false;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlighted(letterId);
    window.setTimeout(() => setHighlighted((current) => (current === letterId ? null : current)), HIGHLIGHT_MS);
    return true;
  }, []);

  // Opening: the letter asked by the search, else the newest one (at the bottom, like a chat).
  const lastId = letters.at(-1)?.id;
  useEffect(() => {
    if (focus && !focusDone.current) {
      if (conversation.isFetching) return;
      focusDone.current = true;
      const frame = window.requestAnimationFrame(() => flash(focus.letterId));
      return () => window.cancelAnimationFrame(frame);
    }
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [focus, lastId, conversation.isFetching, flash]);

  // A letter just sent: sorted by its date and time, it can land above the newest ones. Go to it
  // once the refreshed conversation holds it.
  const sentId = useRef<string | null>(null);
  useEffect(() => {
    const id = sentId.current;
    if (!id || !letters.some((letter) => letter.id === id)) return;
    sentId.current = null;
    const frame = window.requestAnimationFrame(() => flash(id));
    return () => window.cancelAnimationFrame(frame);
  }, [letters, flash]);

  const showLetter = (letterId: string) => {
    if (!flash(letterId)) {
      notifications.show({
        title: 'Lettres',
        message: includeArchived
          ? 'Cette lettre est dans une autre conversation ou a été supprimée.'
          : 'Lettre introuvable ici : elle est peut-être archivée (cochez « Archivées »).',
        color: 'slate',
      });
    }
  };

  const viewerFiles = viewer ? toViewerFiles(viewer.letter) : [];
  const viewerImageUrl = viewer?.letter.images[viewer.index]?.previewUrl ?? null;
  const download = async (fileId: string) => {
    try {
      const data = handleAction(await fetchRead(slug, 'letterImageDownloadUrl', { boxId, fileId }));
      if (data) window.location.assign(data.url);
    } catch (error) {
      notifications.show({ title: 'Erreur', message: error instanceof Error ? error.message : 'Téléchargement impossible', color: 'danger' });
    }
  };

  return (
    <>
      <header className={classes.conversationHeader}>
        <ActionIcon variant="subtle" color="slate" onClick={onBack} hiddenFrom="sm" aria-label="Retour aux correspondants">
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Avatar color="leather" radius="xl" size={36}>
          {correspondent.name.slice(0, 1).toUpperCase()}
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group gap={4} wrap="nowrap">
            <h2 className={classes.conversationName}>{correspondent.name}</h2>
            {canWrite ? (
              <Tooltip label="Renommer, note, supprimer">
                <ActionIcon size="sm" variant="subtle" color="slate" onClick={onEditCorrespondent} aria-label="Modifier le correspondant">
                  <IconPencil size={14} />
                </ActionIcon>
              </Tooltip>
            ) : null}
          </Group>
          <Text size="xs" c="dimmed" truncate="end">
            {correspondent.letterCount} lettre{correspondent.letterCount > 1 ? 's' : ''}
            {correspondent.note ? ` · ${correspondent.note}` : ''}
          </Text>
        </div>
        <TextInput
          size="xs"
          w={{ base: '100%', xs: 220 }}
          placeholder="Chercher dans la conversation"
          leftSection={<IconSearch size={14} />}
          rightSection={search ? <CloseButton size="xs" onClick={() => setSearch('')} aria-label="Effacer" /> : null}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          {...noAutofillProps}
        />
        <Checkbox
          size="xs"
          color="sage"
          label="Archivées"
          checked={includeArchived}
          onChange={(event) => setIncludeArchived(event.currentTarget.checked)}
        />
      </header>

      <div ref={feedRef} className={classes.feed}>
        {conversation.isLoading ? (
          <Stack align="center" py="xl">
            <Loader color="sage" />
          </Stack>
        ) : letters.length === 0 ? (
          <div className={classes.empty}>
            <Stack gap={6} align="center" maw={360}>
              <Text fw={600}>{debouncedSearch ? 'Aucune lettre trouvée' : 'Aucune lettre pour le moment'}</Text>
              <Text size="sm" c="dimmed">
                {debouncedSearch
                  ? 'Essayez un autre mot, le n° de série, ou cochez « Archivées ».'
                  : canWrite
                    ? 'Collez les captures de sa lettre (Ctrl/Cmd + V) ou glissez-les ici, puis envoyez.'
                    : 'Les lettres ajoutées apparaîtront ici.'}
              </Text>
            </Stack>
          </div>
        ) : (
          letters.map((letter, index) => {
            const day = formatRpDate(letterDay(letter.letterDate), 'EEEE d MMMM yyyy');
            const previous = letters[index - 1];
            const previousDay = previous ? formatRpDate(letterDay(previous.letterDate), 'EEEE d MMMM yyyy') : null;
            return (
              <Fragment key={letter.id}>
                {day !== previousDay ? <div className={classes.day}>{day}</div> : null}
                <LetterBubble
                  ref={(element) => {
                    if (element) bubbles.current.set(letter.id, element);
                    else bubbles.current.delete(letter.id);
                  }}
                  letter={letter}
                  highlighted={highlighted === letter.id}
                  canWrite={canWrite}
                  onOpenImage={(target, imageIndex) => setViewer({ letter: target, index: imageIndex })}
                  onReply={(target) =>
                    setReplyTo({ id: target.id, serial: target.serial, title: target.title, direction: target.direction })
                  }
                  onEdit={onEditLetter}
                  onToggleArchived={(target) => archive.mutate(target)}
                  onDelete={async (target) => {
                    await remove.mutateAsync(target).catch(() => undefined);
                  }}
                  onShowLetter={showLetter}
                />
              </Fragment>
            );
          })
        )}
      </div>

      {canWrite ? (
        <LetterComposer
          boxId={boxId}
          limits={limits}
          correspondent={correspondent}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          paused={paused || viewer !== null}
          onSent={(id) => {
            sentId.current = id;
          }}
        />
      ) : null}

      <MediaViewer
        files={viewerFiles}
        index={viewer?.index ?? null}
        onIndexChange={(index) => setViewer((current) => (current ? { ...current, index } : current))}
        onDownload={(fileId) => void download(fileId)}
        onExpired={() => void conversation.refetch()}
        onClose={() => setViewer(null)}
        formatDate={(iso) => formatRpDate(new Date(iso), 'd MMMM yyyy')}
        asideLabel="transcript"
        aside={
          viewer ? (
            <Stack gap="sm">
              <Text fw={700}>{viewer.letter.title}</Text>
              <Text size="xs" opacity={0.75} className={classes.serial}>
                {viewer.letter.serial}
              </Text>
              {viewer.letter.transcript ? (
                <>
                  <Button
                    size="compact-sm"
                    variant="white"
                    color="slate"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() =>
                      void navigator.clipboard.writeText(viewer.letter.transcript ?? '').then(() =>
                        notifications.show({ title: 'Lettres', message: 'Transcript copié', color: 'moss' }),
                      )
                    }
                  >
                    Copier le transcript
                  </Button>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {viewer.letter.transcript}
                  </Text>
                </>
              ) : (
                <Text size="sm" opacity={0.75}>
                  Pas de transcript pour cette lettre.
                </Text>
              )}
              {viewerImageUrl ? (
                <Button
                  size="compact-sm"
                  variant="white"
                  color="slate"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() =>
                    void copyImageToClipboard(async () => viewerImageUrl)
                      .then(() => notifications.show({ title: 'Lettres', message: 'Image copiée', color: 'moss' }))
                      .catch((error: unknown) =>
                        notifications.show({
                          title: 'Erreur',
                          message: error instanceof Error ? error.message : 'Copie impossible',
                          color: 'danger',
                        }),
                      )
                  }
                >
                  Copier l’image
                </Button>
              ) : null}
            </Stack>
          ) : null
        }
      />
    </>
  );
}
