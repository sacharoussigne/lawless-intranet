'use client';

import { useState, type KeyboardEvent } from 'react';
import { ActionIcon, Menu, Popover, Textarea, Tooltip, UnstyledButton } from '@mantine/core';
import {
  IconCalendar,
  IconCheck,
  IconEraser,
  IconMail,
  IconPlus,
  IconSend,
  IconTemplate,
} from '@tabler/icons-react';
import { RpDatePicker } from '@/app/_components/RpDateInput/RpDatePicker';
import { MESSAGE_SIDE_LABELS } from '@/lib/animals/followUpLabels';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import type { AnimalFollowUpMessageSide } from '@/generated/prisma/client';
import classes from './FollowUps.module.scss';

const SIDES: { value: AnimalFollowUpMessageSide; label: string }[] = [
  { value: 'shelter', label: 'Lettre du refuge' },
  { value: 'recipient', label: 'Lettre du destinataire' },
];

function isSubmitShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey);
}

export function FollowUpComposer({
  body,
  onBodyChange,
  side,
  onSideChange,
  letterDate,
  onLetterDateChange,
  pending,
  canUseTemplates,
  onOpenTemplates,
  onSubmit,
}: {
  body: string;
  onBodyChange: (value: string) => void;
  side: AnimalFollowUpMessageSide;
  onSideChange: (value: AnimalFollowUpMessageSide) => void;
  letterDate: Date | null;
  onLetterDateChange: (value: Date | null) => void;
  pending: boolean;
  canUseTemplates: boolean;
  onOpenTemplates: () => void;
  onSubmit: () => void;
}) {
  const { formatRpDate } = useRpCalendar();
  const [dateOpen, setDateOpen] = useState(false);
  const empty = !body.trim();

  return (
    <div className={classes.threadComposer}>
      <div className={classes.composerBox}>
        <div className={classes.composerInputRow}>
          <Menu shadow="md" width={260} position="top-start" disabled={pending} returnFocus={false}>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="terracotta"
                radius="xl"
                size="lg"
                aria-label="Options de la lettre"
                disabled={pending}
              >
                <IconPlus size={18} stroke={1.8} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {canUseTemplates ? (
                <Menu.Item leftSection={<IconTemplate size={16} />} onClick={onOpenTemplates}>
                  Utiliser un modèle
                </Menu.Item>
              ) : null}
              <Menu.Item leftSection={<IconCalendar size={16} />} onClick={() => setDateOpen(true)}>
                Changer la date de la lettre
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Expéditeur</Menu.Label>
              {SIDES.map((option) => (
                <Menu.Item
                  key={option.value}
                  leftSection={
                    option.value === side ? (
                      <IconCheck size={14} />
                    ) : (
                      <span className={classes.statusMenuSpacer} />
                    )
                  }
                  onClick={() => onSideChange(option.value)}
                >
                  {option.label}
                </Menu.Item>
              ))}
              {!empty ? (
                <>
                  <Menu.Divider />
                  <Menu.Item
                    color="danger"
                    leftSection={<IconEraser size={16} />}
                    onClick={() => onBodyChange('')}
                  >
                    Vider le brouillon
                  </Menu.Item>
                </>
              ) : null}
            </Menu.Dropdown>
          </Menu>

          <Textarea
            className={classes.composerInput}
            classNames={{ input: classes.composerInputField }}
            // The theme sets the Textarea surface and border inline; the box carries them here.
            styles={{ input: { backgroundColor: 'transparent', border: 0 } }}
            variant="unstyled"
            placeholder={
              side === 'shelter'
                ? 'Copie de la lettre envoyée par le refuge…'
                : 'Copie de la lettre reçue du destinataire…'
            }
            autosize
            minRows={1}
            maxRows={10}
            resize="none"
            value={body}
            onChange={(e) => onBodyChange(e.currentTarget.value)}
            onKeyDown={(event) => {
              if (isSubmitShortcut(event)) {
                event.preventDefault();
                if (!empty && !pending) onSubmit();
              }
            }}
            disabled={pending}
          />

          <Tooltip label="Ajouter la lettre (Ctrl+Entrée)">
            <ActionIcon
              className={classes.composerSend}
              variant="subtle"
              color="terracotta"
              radius="xl"
              size="lg"
              aria-label="Ajouter la lettre"
              loading={pending}
              disabled={empty}
              onClick={onSubmit}
            >
              <IconSend size={16} />
            </ActionIcon>
          </Tooltip>
        </div>

        <div className={classes.composerFooter}>
          <UnstyledButton
            className={classes.composerPill}
            onClick={() => onSideChange(side === 'shelter' ? 'recipient' : 'shelter')}
            disabled={pending}
            aria-label="Changer l’expéditeur de la lettre"
          >
            <IconMail size={14} stroke={1.7} />
            {MESSAGE_SIDE_LABELS[side]}
          </UnstyledButton>

          <Popover opened={dateOpen} onChange={setDateOpen} position="top-start" shadow="md">
            <Popover.Target>
              <UnstyledButton
                className={classes.composerPill}
                onClick={() => setDateOpen((open) => !open)}
                disabled={pending}
                aria-label="Date de la lettre"
              >
                <IconCalendar size={14} stroke={1.7} />
                {letterDate ? formatRpDate(letterDate, 'dd/MM/yyyy') : 'Choisir une date'}
              </UnstyledButton>
            </Popover.Target>
            <Popover.Dropdown>
              <RpDatePicker
                value={letterDate}
                onChange={(date) => {
                  onLetterDateChange(date);
                  setDateOpen(false);
                }}
              />
            </Popover.Dropdown>
          </Popover>

          <span className={classes.composerHint}>Ctrl+Entrée pour ajouter</span>
        </div>
      </div>
    </div>
  );
}
