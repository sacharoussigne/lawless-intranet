'use client';

import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Button, CopyButton, Group, Stack, Text, Textarea, Tooltip } from '@mantine/core';
import { useWindowEvent } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowBackUp, IconPaperclip, IconSend, IconX } from '@tabler/icons-react';
import { pastedFiles, useFileDrop } from '@lawless-intranet/media-ui';
import type { MediaLimitsRecord } from '@lawless-intranet/types';
import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import { createLetter } from '@/app/_actions/letters/letters';
import type { LetterCorrespondentDTO, LetterReplyRefDTO } from '@/types/letters';
import { useLetterBoxMutation } from '../hooks/useLettersQueries';
import { useLetterImageUploads } from '../hooks/useLetterImageUploads';
import { LetterImageTiles } from './LetterImagesField';
import { LetterSendModal, type LetterSendDetails } from './LetterSendModal';
import classes from '../letters.module.scss';

/**
 * Message bar of a conversation (Discord-like): paste or drop the screenshots of a
 * letter, type or paste its transcript, then send; the name and the rest are asked then.
 */
export function LetterComposer({
  boxId,
  limits,
  correspondent,
  replyTo,
  onClearReply,
  paused,
  onSent,
}: {
  boxId: string;
  limits: MediaLimitsRecord;
  correspondent: LetterCorrespondentDTO;
  replyTo: LetterReplyRefDTO | null;
  onClearReply: () => void;
  /** Another dialog is open (viewer, edit form): its own paste and drop win. */
  paused: boolean;
  onSent: (letterId: string) => void;
}) {
  const { formatRpDate } = useRpCalendar();
  const uploads = useLetterImageUploads(boxId, limits, []);
  const [transcript, setTranscript] = useState('');
  const [sending, setSending] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const create = useLetterBoxMutation(
    boxId,
    (slug, vars: Parameters<typeof createLetter>[1], meta) => createLetter(slug, vars, meta),
    { error: 'Impossible d’enregistrer la lettre' },
  );

  // Leaving the conversation with a draft: its uploaded images would stay in the storage for nothing.
  const discardRef = useRef(uploads.discardFresh);
  useEffect(() => {
    discardRef.current = uploads.discardFresh;
  });
  useEffect(() => () => discardRef.current(), []);

  const active = !paused && sending === null && limits.storageConfigured;
  const imageLabel = () => `${formatRpDate(new Date(), 'd MMM yyyy HH')}h`;
  useWindowEvent('paste', (event) => {
    if (!active) return;
    const files = pastedFiles(event.clipboardData, limits.allowedMimeTypes, imageLabel());
    if (files.length === 0) return; // plain text: pasted where the cursor is
    event.preventDefault();
    uploads.add(files);
  });
  const drop = useFileDrop({ enabled: active, onDrop: (files) => uploads.add(files) });

  const hasContent = uploads.images.length > 0 || transcript.trim().length > 0;
  const canSend = hasContent && !uploads.uploading && !uploads.failed;
  const openSend = () => {
    if (canSend) setSending((current) => (current ?? 0) + 1);
  };

  const confirm = (details: LetterSendDetails) => {
    const images = uploads.images.flatMap((image) => (image.mediaFileId ? [{ mediaFileId: image.mediaFileId }] : []));
    create.mutate(
      {
        boxId,
        correspondentId: correspondent.id,
        direction: details.direction,
        title: details.title,
        transcript: transcript.trim() || null,
        letterDate: details.letterDate,
        replyToId: replyTo?.id ?? null,
        images,
      },
      {
        onSuccess: (saved) => {
          const { id, serial } = saved as { id: string; serial: string };
          uploads.clear();
          setTranscript('');
          onClearReply();
          setSending(null);
          onSent(id);
          notifications.show({
            title: 'Lettre enregistrée',
            color: 'moss',
            autoClose: 10_000,
            message: (
              <Group gap="xs" wrap="nowrap">
                <Text size="sm">
                  N° de série : <span className={classes.serial}>{serial}</span>
                </Text>
                <CopyButton value={serial}>
                  {({ copied, copy }) => (
                    <Button size="compact-xs" variant="light" color="sage" onClick={copy}>
                      {copied ? 'Copié' : 'Copier'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
            ),
          });
        },
      },
    );
  };

  const status = uploads.uploading
    ? 'Envoi des images…'
    : uploads.failed
      ? 'Retirez les images en erreur'
      : uploads.images.length > 0
        ? `${uploads.images.length} image${uploads.images.length > 1 ? 's' : ''} · glissez pour changer l’ordre`
        : null;

  return (
    <footer className={classes.composer}>
      {replyTo ? (
        <Group gap="xs" wrap="nowrap" className={classes.quote} style={{ cursor: 'default', marginBottom: 0 }}>
          <IconArrowBackUp size={16} style={{ flexShrink: 0 }} />
          <Text size="xs" style={{ flex: 1 }} truncate="end">
            Réponse à <span className={classes.serial}>{replyTo.serial}</span> · {replyTo.title}
          </Text>
          <Tooltip label="Annuler la réponse">
            <ActionIcon size="sm" variant="subtle" color="slate" onClick={onClearReply} aria-label="Annuler la réponse">
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ) : null}

      <LetterImageTiles compact images={uploads.images} onRemove={uploads.remove} onReorder={uploads.setImages} />

      <div className={classes.composerBox}>
        <Tooltip label="Ajouter des images (ou collez / glissez-les)">
          <ActionIcon
            variant="subtle"
            color="slate"
            size="lg"
            aria-label="Ajouter des images"
            disabled={!limits.storageConfigured}
            onClick={() => fileInput.current?.click()}
          >
            <IconPaperclip size={20} />
          </ActionIcon>
        </Tooltip>
        <Textarea
          ref={textarea}
          className={classes.composerInput}
          placeholder={`Collez les captures de la lettre de ${correspondent.name}, et son transcript si vous l’avez…`}
          autosize
          minRows={1}
          maxRows={8}
          value={transcript}
          onChange={(event) => setTranscript(event.currentTarget.value)}
          onKeyDown={(event) => {
            // Enter: new line (a transcript has several); Ctrl/Cmd + Enter: send.
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              openSend();
            }
          }}
          {...noAutofillProps}
        />
        <Tooltip label="Envoyer (Ctrl/Cmd + Entrée)">
          <ActionIcon
            variant={canSend ? 'filled' : 'light'}
            color="sage"
            size="lg"
            aria-label="Envoyer"
            disabled={!canSend}
            onClick={openSend}
          >
            <IconSend size={18} />
          </ActionIcon>
        </Tooltip>
      </div>
      <Stack gap={0}>
        <Text size="xs" c="dimmed">
          {status ?? 'Collez (Ctrl/Cmd + V) ou glissez les captures ici · Ctrl/Cmd + Entrée pour envoyer'}
        </Text>
      </Stack>

      <input
        ref={fileInput}
        type="file"
        hidden
        multiple
        accept={limits.allowedMimeTypes.filter((type) => type.startsWith('image/')).join(',')}
        onChange={(event) => {
          uploads.add(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = '';
          textarea.current?.focus();
        }}
      />

      {drop.active ? (
        <div className={classes.dropOverlay}>
          <Stack gap={4} align="center">
            <IconPaperclip size={36} stroke={1.4} />
            <Text fw={600}>Déposez pour ajouter à la lettre</Text>
            <Text size="sm" c="dimmed">
              Conversation avec {correspondent.name}
            </Text>
          </Stack>
        </div>
      ) : null}

      {sending !== null ? (
        <LetterSendModal
          key={sending}
          onClose={() => setSending(null)}
          correspondentName={correspondent.name}
          replyTo={replyTo}
          imageCount={uploads.images.length}
          hasTranscript={transcript.trim().length > 0}
          pending={create.isPending}
          onConfirm={confirm}
        />
      ) : null}
    </footer>
  );
}
