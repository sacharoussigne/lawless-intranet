'use client';

import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Button,
  CopyButton,
  Group,
  Loader,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { useWindowEvent } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowBackUp, IconCheck, IconCopy, IconMail, IconX } from '@tabler/icons-react';
import { pastedFiles, useFileDrop } from '@lawless-intranet/media-ui';
import type { MediaLimitsRecord } from '@lawless-intranet/types';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { RpDateInput } from '@/app/_components/RpDatePicker/RpDateInput';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import { createLetterCorrespondent } from '@/app/_actions/letters/correspondents';
import { updateLetter } from '@/app/_actions/letters/letters';
import { getTodayRealDate } from '@/lib/rpCalendar';
import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import type { LetterCorrespondentDTO, LetterDTO, LetterDirection, LetterReplyRefDTO } from '@/types/letters';
import { useLetterBoxMutation } from '../hooks/useLettersQueries';
import { toFormImages, useLetterImageUploads } from '../hooks/useLetterImageUploads';
import { LetterImagesField } from './LetterImagesField';
import classes from '../letters.module.scss';

/** Value of the « Ajouter « X » » option of the correspondent list. */
const CREATE_VALUE_PREFIX = '__create__:';


/**
 * Edit a letter (letters are added with the message bar of the conversation).
 * Mounted with a new `key` for each opening, so its state starts from the letter.
 */
export function LetterFormModal({
  opened,
  onClose,
  boxId,
  limits,
  correspondents,
  letter: editing,
  onSaved,
}: {
  opened: boolean;
  onClose: () => void;
  boxId: string;
  limits: MediaLimitsRecord;
  correspondents: LetterCorrespondentDTO[];
  letter: LetterDTO;
  onSaved: (letter: { id: string; correspondentId: string }) => void;
}) {
  const { formatRpDate } = useRpCalendar();
  const [direction, setDirection] = useState<LetterDirection>(
    editing.direction,
  );
  const [correspondentId, setCorrespondentId] = useState<string | null>(
    editing.correspondentId,
  );
  const [correspondentSearch, setCorrespondentSearch] = useState('');
  const [title, setTitle] = useState(editing.title);
  const [transcript, setTranscript] = useState(editing.transcript ?? '');
  const [letterDate, setLetterDate] = useState<Date | null>(editing.letterDate);
  const [replyTo, setReplyTo] = useState<LetterReplyRefDTO | null>(editing.replyTo);
  const [extraCorrespondents, setExtraCorrespondents] = useState<{ id: string; name: string }[]>([]);
  const uploads = useLetterImageUploads(boxId, limits, toFormImages(editing.images));
  const { add } = uploads;

  const correspondentOptions = useMemo(
    () =>
      [...correspondents, ...extraCorrespondents]
        .map((entry) => ({ value: entry.id, label: entry.name }))
        .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    [correspondents, extraCorrespondents],
  );
  const newName = correspondentSearch.trim();
  const canCreateCorrespondent =
    newName.length > 0 &&
    !correspondentOptions.some((option) => option.label.toLocaleLowerCase('fr') === newName.toLocaleLowerCase('fr'));
  // Unknown name typed: « Ajouter « X » » at the end of the list, like the breed variants of the shelter.
  const selectData = canCreateCorrespondent
    ? [...correspondentOptions, { value: `${CREATE_VALUE_PREFIX}${newName}`, label: `Ajouter « ${newName} »` }]
    : correspondentOptions;
  const correspondentName = correspondentOptions.find((option) => option.value === correspondentId)?.label ?? '';
  const suggestedTitle = correspondentName
    ? `${direction === 'RECEIVED' ? 'Lettre de' : 'Réponse à'} ${correspondentName}${
        letterDate ? ` du ${formatRpDate(letterDate, 'd MMM yyyy')}` : ''
      }`
    : '';
  const addCorrespondent = useLetterBoxMutation(
    boxId,
    (slug, name: string, meta) => createLetterCorrespondent(slug, { boxId, name }, meta),
    { error: 'Impossible d’ajouter le correspondant' },
  );
  const createCorrespondent = (name: string) =>
    void addCorrespondent
      .mutateAsync(name)
      .then((created) => {
        const entry = created as { id: string; name: string };
        setExtraCorrespondents((current) => [...current, entry]);
        setCorrespondentId(entry.id);
        setCorrespondentSearch(entry.name);
      })
      .catch(() => undefined);

  const save = useLetterBoxMutation(
    boxId,
    (slug, vars: Parameters<typeof updateLetter>[1], meta) => updateLetter(slug, vars, meta),
    { error: 'Impossible d’enregistrer la lettre' },
  );

  // Images dropped anywhere on the form go to it (the browser would open them otherwise).
  useFileDrop({ enabled: opened && limits.storageConfigured, onDrop: (files) => add(files) });

  // Images pasted anywhere in the form (even in a field: an image cannot go in the text).
  useWindowEvent('paste', (event) => {
    if (!opened) return;
    const files = pastedFiles(event.clipboardData, limits.allowedMimeTypes, `${formatRpDate(new Date(), 'd MMM yyyy HH')}h`);
    if (files.length === 0) return;
    event.preventDefault();
    uploads.add(files);
  });

  // Images uploaded for this form and not saved are removed from the storage; saved ones stay.
  const close = () => {
    uploads.discardFresh();
    onClose();
  };

  const submit = async () => {
    if (!correspondentId) {
      notifications.show({ title: 'Lettres', message: 'Choisissez le correspondant', color: 'danger' });
      return;
    }
    const finalTitle = title.trim() || suggestedTitle;
    const images = uploads.images.flatMap((image) =>
      image.status === 'ready' && image.mediaFileId ? [{ mediaFileId: image.mediaFileId }] : [],
    );
    await save.mutateAsync({
      id: editing.id,
      correspondentId,
      direction,
      title: finalTitle,
      transcript: transcript.trim() || null,
      letterDate: letterDate ?? getTodayRealDate(),
      replyToId: replyTo?.id ?? null,
      images,
    });
    notifications.show({ title: 'Lettres', message: 'Lettre modifiée', color: 'moss' });
    onSaved({ id: editing.id, correspondentId });
    onClose();
  };

  const blocked = uploads.uploading || uploads.failed || !correspondentId;

  return (
    <AppModal
      opened={opened}
      onClose={close}
      title="Modifier la lettre"
      icon={IconMail}
      size="xl"
      footer={
        <AppModalFooter align="space-between">
          <Text size="xs" c="dimmed">
            {uploads.uploading
              ? 'Envoi des images…'
              : uploads.failed
                ? 'Retirez les images en erreur pour enregistrer'
                : `N° ${editing.serial}`}
          </Text>
          <Group gap="xs">
            <Button variant="subtle" color="slate" onClick={close}>
              Annuler
            </Button>
            <Button color="sage" loading={save.isPending} disabled={blocked} onClick={() => void submit().catch(() => undefined)}>
              Enregistrer
            </Button>
          </Group>
        </AppModalFooter>
      }
    >
      <Stack gap="md">
        {replyTo ? (
          <Group gap="xs" wrap="nowrap" className={classes.quote} style={{ cursor: 'default' }}>
            <IconArrowBackUp size={16} />
            <Text size="xs" style={{ flex: 1 }} truncate="end">
              En réponse à <span className={classes.serial}>{replyTo.serial}</span> · {replyTo.title}
            </Text>
            <Tooltip label="Ne plus répondre à cette lettre">
              <ActionIcon size="sm" variant="subtle" color="slate" onClick={() => setReplyTo(null)} aria-label="Retirer la réponse">
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null}

        <Group grow align="flex-start">
          <SegmentedControl
            color={direction === 'RECEIVED' ? 'sage' : 'leather'}
            value={direction}
            onChange={(value) => setDirection(value as LetterDirection)}
            data={[
              { value: 'RECEIVED', label: 'Reçue' },
              { value: 'SENT', label: 'Envoyée' },
            ]}
          />
          <RpDateInput label={undefined} aria-label="Date de la lettre" value={letterDate} onChange={setLetterDate} />
        </Group>

        <Select
          label={direction === 'RECEIVED' ? 'Expéditeur' : 'Destinataire'}
          placeholder="Choisir ou taper un nom"
          searchable
          data={selectData}
          value={correspondentId}
          onChange={(next) => {
            if (next?.startsWith(CREATE_VALUE_PREFIX)) {
              createCorrespondent(next.slice(CREATE_VALUE_PREFIX.length));
              return;
            }
            setCorrespondentId(next);
          }}
          searchValue={correspondentSearch}
          onSearchChange={setCorrespondentSearch}
          disabled={addCorrespondent.isPending}
          rightSection={addCorrespondent.isPending ? <Loader size={16} color="sage" /> : undefined}
          nothingFoundMessage={canCreateCorrespondent ? `Ajouter « ${newName} »` : 'Aucun correspondant'}
          {...noAutofillProps}
        />

        <TextInput
          label="Titre"
          description="Pour la retrouver facilement. Vide : le titre proposé."
          placeholder={suggestedTitle || 'Ex. Commande de bandages'}
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          data-autofocus
          rightSection={
            !title && suggestedTitle ? (
              <Tooltip label="Utiliser le titre proposé">
                <ActionIcon variant="subtle" color="sage" onClick={() => setTitle(suggestedTitle)} aria-label="Utiliser le titre proposé">
                  <IconCheck size={16} />
                </ActionIcon>
              </Tooltip>
            ) : undefined
          }
          {...noAutofillProps}
        />

        <LetterImagesField
          images={uploads.images}
          onAdd={uploads.add}
          onRemove={uploads.remove}
          onReorder={uploads.setImages}
          accept={limits.allowedMimeTypes.filter((type) => type.startsWith('image/')).join(',')}
        />

        <Textarea
          label="Transcript"
          description="Le texte de la lettre : il se copie en un clic et se retrouve avec la recherche."
          placeholder="Recopiez ou collez le texte ici…"
          autosize
          minRows={4}
          maxRows={14}
          value={transcript}
          onChange={(event) => setTranscript(event.currentTarget.value)}
          {...noAutofillProps}
        />
        {transcript ? (
          <Group justify="flex-end" mt={-8}>
            <CopyButton value={transcript}>
              {({ copied, copy }) => (
                <Button size="compact-xs" variant="subtle" color="slate" leftSection={<IconCopy size={12} />} onClick={copy}>
                  {copied ? 'Copié' : 'Copier le transcript'}
                </Button>
              )}
            </CopyButton>
          </Group>
        ) : null}
      </Stack>
    </AppModal>
  );
}
