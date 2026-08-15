'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  Badge,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconSend } from '@tabler/icons-react';
import {
  addAnimalFollowUpMessage,
  closeAnimalFollowUp,
  updateAnimalFollowUpStatus,
} from '@/app/_actions/followUps';
import { RpDateInput } from '@/app/_components/RpDateInput/RpDateInput';
import {
  FOLLOW_UP_CLOSE_OPTIONS,
  FOLLOW_UP_OPEN_STATUSES,
  FOLLOW_UP_STATUS_BADGE_COLORS,
  FOLLOW_UP_STATUS_LABELS,
  FOLLOW_UP_STATUS_OPTIONS,
  MESSAGE_SIDE_LABELS,
  isFollowUpClosed,
} from '@/lib/animals/followUpLabels';
import { formatRpDate } from '@/lib/rpCalendar';
import type { AnimalFollowUpMessageSide, AnimalFollowUpStatus } from '@/generated/prisma/client';
import { actionErrorMessage, parseIsoDateOnly, toIsoDateOnly } from '../types';
import classes from './FollowUps.module.scss';
import type { FollowUpDTO } from './followUpTypes';

export function FollowUpThread({
  shelterSlug,
  followUp,
  canUpdate,
  onUpdated,
}: {
  shelterSlug: string;
  followUp: FollowUpDTO;
  canUpdate: boolean;
  onUpdated: (next: FollowUpDTO) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState('');
  const [side, setSide] = useState<AnimalFollowUpMessageSide>('shelter');
  const [letterDate, setLetterDate] = useState<Date | null>(new Date());
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeStatus, setCloseStatus] = useState<'validated' | 'refused' | 'cancelled'>(
    'validated',
  );
  const [closureNote, setClosureNote] = useState('');
  const scrollerRef = useRef<HTMLDivElement>(null);

  const closed = isFollowUpClosed(followUp.status);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [followUp.messages.length, followUp.id]);

  const openStatusOptions = FOLLOW_UP_STATUS_OPTIONS.filter((o) =>
    FOLLOW_UP_OPEN_STATUSES.includes(o.value),
  );

  const handleStatusChange = (value: string | null) => {
    if (!value || value === followUp.status) return;
    startTransition(async () => {
      const result = await updateAnimalFollowUpStatus(shelterSlug, {
        followUpId: followUp.id,
        status: value as AnimalFollowUpStatus,
      });
      if (result.status >= 400 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Impossible de changer le statut'),
          color: 'danger',
        });
        return;
      }
      onUpdated(result.data as FollowUpDTO);
    });
  };

  const handleSend = () => {
    if (!letterDate || !body.trim()) {
      notifications.show({
        title: 'Erreur',
        message: 'Saisissez la lettre et sa date',
        color: 'danger',
      });
      return;
    }
    startTransition(async () => {
      const result = await addAnimalFollowUpMessage(shelterSlug, {
        followUpId: followUp.id,
        side,
        body: body.trim(),
        letterDate: toIsoDateOnly(letterDate),
      });
      if (result.status >= 400 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Impossible d’ajouter la lettre'),
          color: 'danger',
        });
        return;
      }
      onUpdated(result.data as FollowUpDTO);
      setBody('');
    });
  };

  const handleClose = () => {
    if (!closureNote.trim()) {
      notifications.show({
        title: 'Erreur',
        message: 'Indiquez comment le suivi s’est terminé',
        color: 'danger',
      });
      return;
    }
    startTransition(async () => {
      const result = await closeAnimalFollowUp(shelterSlug, {
        followUpId: followUp.id,
        status: closeStatus,
        closureNote: closureNote.trim(),
      });
      if (result.status >= 400 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Impossible de clôturer'),
          color: 'danger',
        });
        return;
      }
      onUpdated(result.data as FollowUpDTO);
      setCloseOpen(false);
      setClosureNote('');
      notifications.show({
        title: 'Suivi clôturé',
        message: FOLLOW_UP_STATUS_LABELS[closeStatus],
        color: 'terracotta',
      });
    });
  };

  return (
    <div className={classes.threadPanel}>
      <div className={classes.threadHeader}>
        <div>
          <Text fw={700}>{followUp.motif}</Text>
          <Text size="sm" c="dimmed">
            Destinataire : {followUp.recipientName} · Conduit par {followUp.conductedByName}
          </Text>
        </div>
        <Group gap="sm" wrap="wrap">
          {canUpdate && !closed ? (
            <Select
              aria-label="Statut du suivi"
              data={openStatusOptions}
              value={followUp.status}
              onChange={handleStatusChange}
              allowDeselect={false}
              w={240}
              disabled={pending}
            />
          ) : (
            <Badge
              size="lg"
              radius="sm"
              color={FOLLOW_UP_STATUS_BADGE_COLORS[followUp.status].color}
              variant={FOLLOW_UP_STATUS_BADGE_COLORS[followUp.status].variant}
            >
              {FOLLOW_UP_STATUS_LABELS[followUp.status]}
            </Badge>
          )}
          {canUpdate && !closed ? (
            <Button
              color="terracotta"
              variant="light"
              onClick={() => setCloseOpen(true)}
              disabled={pending}
            >
              Clôturer
            </Button>
          ) : null}
        </Group>
      </div>

      <div className={classes.threadMessages} ref={scrollerRef}>
        {followUp.messages.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center">
            Aucune lettre pour l’instant. Ajoutez la copie d’un échange.
          </Text>
        ) : (
          followUp.messages.map((message) => {
            const isShelter = message.side === 'shelter';
            return (
              <div
                key={message.id}
                className={`${classes.bubbleRow} ${
                  isShelter ? classes.bubbleRowShelter : classes.bubbleRowRecipient
                }`}
              >
                <div
                  className={`${classes.bubble} ${
                    isShelter ? classes.bubbleShelter : classes.bubbleRecipient
                  }`}
                >
                  <div className={classes.bubbleSide}>
                    {MESSAGE_SIDE_LABELS[message.side]}
                  </div>
                  <div className={classes.bubbleBody}>{message.body}</div>
                  <div className={classes.bubbleDate}>
                    {formatRpDate(parseIsoDateOnly(message.letterDate), 'dd/MM/yyyy')}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {followUp.closureNote ? (
        <div className={classes.closureNote}>
          <Text size="sm" fw={600}>
            Clôture — {FOLLOW_UP_STATUS_LABELS[followUp.status]}
          </Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {followUp.closureNote}
          </Text>
        </div>
      ) : null}

      {canUpdate && !closed ? (
        <div className={classes.threadComposer}>
          <SegmentedControl
            value={side}
            onChange={(v) => setSide(v as AnimalFollowUpMessageSide)}
            data={[
              { value: 'shelter', label: 'Refuge' },
              { value: 'recipient', label: 'Destinataire' },
            ]}
            color="terracotta"
          />
          <Textarea
            placeholder={
              side === 'shelter'
                ? 'Copie de la lettre envoyée par le refuge…'
                : 'Copie de la lettre reçue du destinataire…'
            }
            minRows={3}
            value={body}
            onChange={(e) => setBody(e.currentTarget.value)}
            disabled={pending}
          />
          <div className={classes.composerRow}>
            <RpDateInput
              label="Date de la lettre"
              value={letterDate}
              onChange={setLetterDate}
              disabled={pending}
            />
            <Button
              color="terracotta"
              leftSection={<IconSend size={16} />}
              loading={pending}
              onClick={handleSend}
            >
              Ajouter
            </Button>
          </div>
        </div>
      ) : null}

      <Modal
        opened={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Clôturer le suivi"
        centered
      >
        <Stack gap="md">
          <Select
            label="Issue"
            data={FOLLOW_UP_CLOSE_OPTIONS}
            value={closeStatus}
            onChange={(v) =>
              v && setCloseStatus(v as 'validated' | 'refused' | 'cancelled')
            }
            allowDeselect={false}
          />
          <Textarea
            label="Comment s’est terminé le suivi ?"
            required
            minRows={3}
            value={closureNote}
            onChange={(e) => setClosureNote(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="light" color="terracotta" onClick={() => setCloseOpen(false)}>
              Annuler
            </Button>
            <Button color="terracotta" loading={pending} onClick={handleClose}>
              Clôturer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
