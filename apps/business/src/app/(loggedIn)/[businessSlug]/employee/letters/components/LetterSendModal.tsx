'use client';

import { useState } from 'react';
import { Button, Group, SegmentedControl, Stack, Text, TextInput } from '@mantine/core';
import { IconMail } from '@tabler/icons-react';
import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { RpDateInput } from '@/app/_components/RpDatePicker/RpDateInput';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import { getTodayRealDate } from '@/lib/rpCalendar';
import type { LetterDirection, LetterReplyRefDTO } from '@/types/letters';
import classes from '../letters.module.scss';

export type LetterSendDetails = { title: string; direction: LetterDirection; letterDate: Date };

/**
 * Last step of the message bar: name the letter (suggested title, selected),
 * received or sent, and its RP date. Remounted (key) for each sending.
 */
export function LetterSendModal({
  onClose,
  correspondentName,
  replyTo,
  imageCount,
  hasTranscript,
  pending,
  onConfirm,
}: {
  onClose: () => void;
  correspondentName: string;
  replyTo: LetterReplyRefDTO | null;
  imageCount: number;
  hasTranscript: boolean;
  pending: boolean;
  onConfirm: (details: LetterSendDetails) => void;
}) {
  const { formatRpDate } = useRpCalendar();
  // Answering a received letter: ours is most likely a sent one.
  const [direction, setDirection] = useState<LetterDirection>(replyTo?.direction === 'RECEIVED' ? 'SENT' : 'RECEIVED');
  const [letterDate, setLetterDate] = useState<Date | null>(getTodayRealDate());
  const suggestion = (next: LetterDirection, date: Date | null) =>
    `${next === 'RECEIVED' ? 'Lettre de' : 'Réponse à'} ${correspondentName}${date ? ` du ${formatRpDate(date, 'd MMM yyyy')}` : ''}`;
  const [title, setTitle] = useState(() => suggestion(direction, letterDate));
  // The title follows the direction and the date until it is typed by hand.
  const [titleTouched, setTitleTouched] = useState(false);

  const summary = [
    imageCount > 0 ? `${imageCount} image${imageCount > 1 ? 's' : ''}` : null,
    hasTranscript ? 'transcript' : null,
    replyTo ? `en réponse à ${replyTo.serial}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const confirm = () => {
    if (!title.trim()) return;
    onConfirm({ title: title.trim(), direction, letterDate: letterDate ?? getTodayRealDate() });
  };

  return (
    <AppModal
      opened
      onClose={onClose}
      title="Enregistrer la lettre"
      description={`Conversation avec ${correspondentName}`}
      icon={IconMail}
      size="md"
      footer={
        <AppModalFooter>
          <Button variant="subtle" color="slate" onClick={onClose}>
            Retour
          </Button>
          <Button color="sage" loading={pending} disabled={!title.trim()} onClick={confirm}>
            Enregistrer la lettre
          </Button>
        </AppModalFooter>
      }
    >
      <Stack gap="md">
        <TextInput
          label="Nom de la lettre"
          description="Pour la retrouver facilement dans la recherche."
          data-autofocus
          value={title}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            setTitleTouched(true);
            setTitle(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              confirm();
            }
          }}
          {...noAutofillProps}
        />
        <Group grow align="flex-start">
          <SegmentedControl
            color={direction === 'RECEIVED' ? 'sage' : 'leather'}
            value={direction}
            onChange={(value) => {
              const next = value as LetterDirection;
              setDirection(next);
              if (!titleTouched) setTitle(suggestion(next, letterDate));
            }}
            data={[
              { value: 'RECEIVED', label: 'Reçue' },
              { value: 'SENT', label: 'Envoyée' },
            ]}
          />
          <RpDateInput
            aria-label="Date de la lettre"
            value={letterDate}
            onChange={(date) => {
              setLetterDate(date);
              if (!titleTouched) setTitle(suggestion(direction, date));
            }}
          />
        </Group>
        {summary ? (
          <Text size="xs" c="dimmed">
            Sera enregistré : <span className={classes.serial}>{summary}</span>
          </Text>
        ) : null}
      </Stack>
    </AppModal>
  );
}
