'use client';

import { useEffect, useState } from 'react';
import { Button, Stack, TextInput } from '@mantine/core';
import { IconStethoscope } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';
import { createCareEpisode } from '@/app/_actions/cabinet/careEpisodes';
import { handleAction } from '@/lib/action';
import { getTodayRealDate } from '@/lib/rpCalendar';

interface CareEpisodeFormModalProps {
  opened: boolean;
  onClose: () => void;
  dispensarySlug: string;
  patientId: string;
  onSuccess: () => void;
}

export function CareEpisodeFormModal({
  opened,
  onClose,
  dispensarySlug,
  patientId,
  onSuccess,
}: CareEpisodeFormModalProps) {
  const [motif, setMotif] = useState('');
  const [startedAt, setStartedAt] = useState<Date | null>(() => getTodayRealDate());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (opened) {
      setMotif('');
      setStartedAt(getTodayRealDate());
    }
  }, [opened]);

  const handleSubmit = async () => {
    if (!motif.trim() || !startedAt) return;
    setSubmitting(true);
    try {
      const result = await createCareEpisode(dispensarySlug, {
        patientId,
        motif: motif.trim(),
        startedAt: startedAt.toISOString(),
      });
      handleAction(result);
      notifications.show({
        title: 'Succès',
        message: 'Prise en charge créée',
        color: 'moss',
      });
      onSuccess();
      onClose();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec',
        color: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Nouvelle prise en charge"
      icon={IconStethoscope}
      size="md"
      footer={
        <AppModalFooter>
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button
            color="sage"
            loading={submitting}
            disabled={!motif.trim() || !startedAt}
            onClick={() => void handleSubmit()}
          >
            Créer
          </Button>
        </AppModalFooter>
      }
    >
      <Stack gap="md">
        <TextInput
          label="Motif"
          value={motif}
          onChange={(e) => setMotif(e.currentTarget.value)}
          required
        />
        <RpDatePicker
          label="Date de début"
          value={startedAt}
          onChange={setStartedAt}
          defaultToToday
          required
        />
      </Stack>
    </AppModal>
  );
}
