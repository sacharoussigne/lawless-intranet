'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Stack, TextInput } from '@mantine/core';
import { IconStethoscope } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';
import { createCareEpisode } from '@/app/_actions/cabinet/careEpisodes';
import { handleAction } from '@/lib/action';
import { getTodayRealDate } from '@/lib/rpCalendar';
import { tenantRoutes } from '@/types/routes';
import { useCabinetFieldErrors } from '../hooks/useCabinetFieldErrors';
import { CabinetFormErrorBanner } from './CabinetFormErrorBanner';

interface CareEpisodeFormModalProps {
  opened: boolean;
  onClose: () => void;
  dispensarySlug: string;
  patientId: string;
  cabinetId: string;
  onSuccess: () => void;
}

export function CareEpisodeFormModal({
  opened,
  onClose,
  dispensarySlug,
  patientId,
  cabinetId,
  onSuccess,
}: CareEpisodeFormModalProps) {
  const router = useRouter();
  const t = tenantRoutes(dispensarySlug);
  const [motif, setMotif] = useState('');
  const [startedAt, setStartedAt] = useState<Date | null>(() => getTodayRealDate());
  const [submitting, setSubmitting] = useState(false);
  const { fieldErrors, formError, clearFieldError, resetErrors, applySubmitError } =
    useCabinetFieldErrors();

  useEffect(() => {
    if (opened) {
      setMotif('');
      setStartedAt(getTodayRealDate());
      resetErrors();
    }
  }, [opened, resetErrors]);

  const handleSubmit = async () => {
    if (!startedAt) return;
    setSubmitting(true);
    resetErrors();
    try {
      const result = await createCareEpisode(dispensarySlug, {
        patientId,
        motif: motif.trim(),
        startedAt: startedAt.toISOString(),
      });
      const data = handleAction(result);
      notifications.show({
        title: 'Succès',
        message: 'Prise en charge créée',
        color: 'moss',
      });
      onClose();
      if (data?.id) {
        router.push(
          `${t.cabinet.index}/patients/${patientId}/episodes/${data.id}?cabinetId=${cabinetId}`,
        );
      } else {
        onSuccess();
      }
    } catch (error: unknown) {
      applySubmitError(error);
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
        <CabinetFormErrorBanner fieldErrors={fieldErrors} formError={formError} />
        <TextInput
          label="Motif"
          value={motif}
          onChange={(e) => {
            clearFieldError('motif');
            setMotif(e.currentTarget.value);
          }}
          error={fieldErrors.motif}
          required
        />
        <RpDatePicker
          label="Date de début"
          value={startedAt}
          onChange={(d) => {
            clearFieldError('startedAt');
            setStartedAt(d);
          }}
          error={fieldErrors.startedAt}
          defaultToToday
          required
        />
      </Stack>
    </AppModal>
  );
}
