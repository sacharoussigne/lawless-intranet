'use client';

import { forwardRef, useState } from 'react';
import { ActionIcon, Anchor, Badge, CopyButton, Group, Menu, Text, Tooltip } from '@mantine/core';
import {
  IconArchive,
  IconArchiveOff,
  IconArrowBackUp,
  IconCheck,
  IconCopy,
  IconDots,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import { apothecaryPillStyle } from '@/lib/apothecaryPill';
import { amberPalette, leatherPalette, sagePalette, slatePalette } from '@/lib/design-tokens';
import { letterDirectionLabel, type LetterDTO } from '@/types/letters';
import classes from '../letters.module.scss';

const LONG_TRANSCRIPT = 280;

export type LetterBubbleActions = {
  onOpenImage: (letter: LetterDTO, index: number) => void;
  onReply: (letter: LetterDTO) => void;
  onEdit: (letter: LetterDTO) => void;
  onToggleArchived: (letter: LetterDTO) => void;
  onDelete: (letter: LetterDTO) => Promise<void>;
  onShowLetter: (letterId: string) => void;
};

/** One letter of the conversation: received on the left, sent on the right (like a chat). */
export const LetterBubble = forwardRef<
  HTMLDivElement,
  { letter: LetterDTO; highlighted: boolean; canWrite: boolean } & LetterBubbleActions
>(function LetterBubble({ letter, highlighted, canWrite, ...actions }, ref) {
  const { formatRpDate } = useRpCalendar();
  const [expanded, setExpanded] = useState(false);
  const transcript = letter.transcript ?? '';
  const long = transcript.length > LONG_TRANSCRIPT || transcript.split('\n').length > 5;
  const archived = letter.archivedAt !== null;
  const { replyTo } = letter;

  return (
    <div ref={ref} className={classes.row} data-direction={letter.direction} id={`letter-${letter.id}`}>
      <article
        className={classes.bubble}
        data-direction={letter.direction}
        data-archived={archived || undefined}
        data-highlighted={highlighted || undefined}
        aria-label={letter.title}
      >
        {replyTo ? (
          <button type="button" className={classes.quote} onClick={() => actions.onShowLetter(replyTo.id)}>
            <Group gap={6} wrap="nowrap">
              <IconArrowBackUp size={14} style={{ flexShrink: 0 }} />
              <Text size="xs" truncate="end">
                En réponse à <span className={classes.serial}>{replyTo.serial}</span> · {replyTo.title}
              </Text>
            </Group>
          </button>
        ) : null}

        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <div style={{ minWidth: 0 }}>
            <h3 className={classes.bubbleTitle}>{letter.title}</h3>
            <Group gap={6} mt={2} wrap="wrap">
              <CopyButton value={letter.serial}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copié' : 'Copier le n° de série'}>
                    <Badge
                      variant="outline"
                      radius="sm"
                      style={{ ...apothecaryPillStyle(slatePalette), cursor: 'pointer' }}
                      className={classes.serial}
                      onClick={copy}
                      rightSection={copied ? <IconCheck size={10} /> : <IconCopy size={10} />}
                    >
                      {letter.serial}
                    </Badge>
                  </Tooltip>
                )}
              </CopyButton>
              <Badge
                variant="outline"
                radius="sm"
                style={apothecaryPillStyle(letter.direction === 'RECEIVED' ? sagePalette : leatherPalette)}
              >
                {letterDirectionLabel(letter.direction)}
              </Badge>
              {archived ? (
                <Badge variant="outline" radius="sm" style={apothecaryPillStyle(amberPalette)}>
                  Archivée
                </Badge>
              ) : null}
            </Group>
          </div>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="slate" aria-label="Actions de la lettre">
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconArrowBackUp size={16} />} disabled={!canWrite} onClick={() => actions.onReply(letter)}>
                Répondre
              </Menu.Item>
              <Menu.Item leftSection={<IconPencil size={16} />} disabled={!canWrite} onClick={() => actions.onEdit(letter)}>
                Modifier
              </Menu.Item>
              <Menu.Item
                leftSection={archived ? <IconArchiveOff size={16} /> : <IconArchive size={16} />}
                disabled={!canWrite}
                onClick={() => actions.onToggleArchived(letter)}
              >
                {archived ? 'Désarchiver' : 'Archiver'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        {letter.images.length > 0 ? (
          <div className={classes.thumbs}>
            {letter.images.map((image, index) => (
              <button
                type="button"
                key={image.id}
                className={classes.thumb}
                onClick={() => actions.onOpenImage(letter, index)}
                aria-label={`Voir ${image.name}`}
              >
                {image.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                  <img src={image.previewUrl} alt={image.name} loading="lazy" />
                ) : (
                  <Text size="xs" c="dimmed" p="xs">
                    Aperçu indisponible
                  </Text>
                )}
              </button>
            ))}
          </div>
        ) : null}

        {transcript ? (
          <>
            <p className={`${classes.transcript} ${long && !expanded ? classes.transcriptClamp : ''}`}>{transcript}</p>
            <Group gap="sm" mt={4}>
              {long ? (
                <Anchor component="button" type="button" size="xs" c="sage" onClick={() => setExpanded((open) => !open)}>
                  {expanded ? 'Réduire' : 'Lire tout'}
                </Anchor>
              ) : null}
              <CopyButton value={transcript}>
                {({ copied, copy }) => (
                  <Anchor component="button" type="button" size="xs" c="dimmed" onClick={copy}>
                    {copied ? 'Transcript copié' : 'Copier le transcript'}
                  </Anchor>
                )}
              </CopyButton>
            </Group>
          </>
        ) : null}

        <Group justify="space-between" mt="xs" gap="xs">
          <Text size="xs" c="dimmed">
            {formatRpDate(letter.letterDate, 'd MMMM yyyy')} · ajoutée par {letter.createdBy.name}
          </Text>
          <Group gap={4}>
            {canWrite ? (
              <>
                <Tooltip label="Répondre">
                  <ActionIcon size="sm" variant="subtle" color="sage" onClick={() => actions.onReply(letter)} aria-label="Répondre">
                    <IconArrowBackUp size={16} />
                  </ActionIcon>
                </Tooltip>
                <DeleteConfirmPopover
                  title="Supprimer la lettre ?"
                  message={`« ${letter.title} » et ses images seront supprimées définitivement. Pour la retirer du fil sans la perdre, archivez-la.`}
                  onConfirm={() => actions.onDelete(letter)}
                >
                  <ActionIcon size="sm" variant="subtle" color="danger" aria-label="Supprimer la lettre">
                    <IconTrash size={15} />
                  </ActionIcon>
                </DeleteConfirmPopover>
              </>
            ) : null}
          </Group>
        </Group>
      </article>
    </div>
  );
});
