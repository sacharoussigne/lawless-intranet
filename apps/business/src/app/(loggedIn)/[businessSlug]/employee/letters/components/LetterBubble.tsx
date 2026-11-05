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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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

        <Group justify="space-between" align="center" wrap="wrap" gap={6}>
          <h3 className={classes.bubbleTitle}>{letter.title}</h3>
          <Group gap={4} wrap="nowrap" ml="auto">
            <CopyButton value={letter.serial}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copié' : 'Copier le n° de série'}>
                  <Badge
                    size="xs"
                    variant="outline"
                    radius="sm"
                    style={{ ...apothecaryPillStyle(slatePalette), cursor: 'pointer' }}
                    className={classes.serial}
                    onClick={copy}
                    rightSection={copied ? <IconCheck size={9} /> : <IconCopy size={9} />}
                  >
                    {letter.serial}
                  </Badge>
                </Tooltip>
              )}
            </CopyButton>
            <Badge
              size="xs"
              variant="outline"
              radius="sm"
              style={apothecaryPillStyle(letter.direction === 'RECEIVED' ? sagePalette : leatherPalette)}
            >
              {letterDirectionLabel(letter.direction)}
            </Badge>
            {archived ? (
              <Badge size="xs" variant="outline" radius="sm" style={apothecaryPillStyle(amberPalette)}>
                Archivée
              </Badge>
            ) : null}
            {canWrite ? (
              <Tooltip label="Répondre">
                <ActionIcon size="sm" variant="subtle" color="sage" onClick={() => actions.onReply(letter)} aria-label="Répondre">
                  <IconArrowBackUp size={16} />
                </ActionIcon>
              </Tooltip>
            ) : null}
            <Menu position="bottom-end" withinPortal onClose={() => setConfirmingDelete(false)}>
              <Menu.Target>
                <ActionIcon size="sm" variant="subtle" color="slate" aria-label="Actions de la lettre">
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown maw={280}>
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
                {canWrite ? (
                  <>
                    <Menu.Divider />
                    {confirmingDelete ? (
                      <Menu.Label style={{ whiteSpace: 'normal' }}>
                        La lettre et ses images seront supprimées définitivement. Pour la retirer du fil sans la perdre,
                        archivez-la.
                      </Menu.Label>
                    ) : null}
                    <Menu.Item
                      color="danger"
                      leftSection={<IconTrash size={16} />}
                      closeMenuOnClick={confirmingDelete}
                      onClick={() => (confirmingDelete ? void actions.onDelete(letter) : setConfirmingDelete(true))}
                    >
                      {confirmingDelete ? 'Confirmer la suppression' : 'Supprimer'}
                    </Menu.Item>
                  </>
                ) : null}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {letter.images.length > 0 || transcript ? (
          <div className={classes.bubbleBody}>
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
                      <Text size="xs" c="dimmed" p={4}>
                        Aperçu indisponible
                      </Text>
                    )}
                  </button>
                ))}
              </div>
            ) : null}
            {transcript ? (
              <div className={classes.transcriptBlock}>
                <p className={`${classes.transcript} ${long && !expanded ? classes.transcriptClamp : ''}`}>{transcript}</p>
                {long ? (
                  <Anchor component="button" type="button" size="xs" c="sage" onClick={() => setExpanded((open) => !open)}>
                    {expanded ? 'Réduire' : 'Lire tout'}
                  </Anchor>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <Group justify="space-between" mt={4} gap="xs" wrap="nowrap">
          <Text size="xs" c="dimmed" truncate="end">
            {formatRpDate(letter.letterDate, 'd MMMM yyyy')} · ajoutée par {letter.createdBy.name}
          </Text>
          {transcript ? (
            <CopyButton value={transcript}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Transcript copié' : 'Copier le transcript'}>
                  <ActionIcon size="sm" variant="subtle" color="slate" onClick={copy} aria-label="Copier le transcript">
                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          ) : null}
        </Group>
      </article>
    </div>
  );
});
