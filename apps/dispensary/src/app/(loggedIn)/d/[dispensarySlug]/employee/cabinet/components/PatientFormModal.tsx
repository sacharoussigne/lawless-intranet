'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Stack, TextInput } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { RpDatePicker } from '@/app/_components/RpDatePicker/RpDatePicker';
import {
  createCabinetPatient,
  updateCabinetPatient,
} from '@/app/_actions/cabinet/patients';
import { handleAction } from '@/lib/action';
import type { CabinetFormSchemas, CustomValues } from '@/lib/cabinet/formSchema';
import { getEntitySchema } from '@/lib/cabinet/formSchema';
import { tenantRoutes } from '@/types/routes';
import { useCabinetFieldErrors } from '../hooks/useCabinetFieldErrors';
import { CabinetFormErrorBanner } from './CabinetFormErrorBanner';
import { DynamicFormRenderer } from './DynamicFormRenderer';

type PatientFormData = {
  id?: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  emergencyContact: string;
  customValues: CustomValues;
};

interface PatientFormModalProps {
  opened: boolean;
  onClose: () => void;
  dispensarySlug: string;
  cabinetId: string;
  patient: PatientFormData | null;
  formSchemas: CabinetFormSchemas | null;
  onSuccess: () => void;
}

export function PatientFormModal({
  opened,
  onClose,
  dispensarySlug,
  cabinetId,
  patient,
  formSchemas,
  onSuccess,
}: PatientFormModalProps) {
  const router = useRouter();
  const t = tenantRoutes(dispensarySlug);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [customValues, setCustomValues] = useState<CustomValues>({});
  const [submitting, setSubmitting] = useState(false);
  const { fieldErrors, formError, clearFieldError, resetErrors, applySubmitError } =
    useCabinetFieldErrors();

  useEffect(() => {
    if (opened) {
      setFirstName(patient?.firstName ?? '');
      setLastName(patient?.lastName ?? '');
      setBirthDate(patient?.birthDate ?? null);
      setEmergencyContact(patient?.emergencyContact ?? '');
      setCustomValues(patient?.customValues ?? {});
      resetErrors();
    }
  }, [opened, patient, resetErrors]);

  const handleCustomChange = (fieldId: string, value: string | null) => {
    clearFieldError(fieldId);
    setCustomValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    resetErrors();
    try {
      const payload = {
        cabinetId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthDate: birthDate?.toISOString() ?? null,
        emergencyContact: emergencyContact.trim() || null,
        customValues,
      };

      const result = patient?.id
        ? await updateCabinetPatient(dispensarySlug, { id: patient.id, ...payload })
        : await createCabinetPatient(dispensarySlug, payload);

      const data = handleAction(result);
      notifications.show({
        title: 'Succès',
        message: patient?.id ? 'Patient mis à jour' : 'Patient créé',
        color: 'moss',
      });
      onClose();

      if (patient?.id) {
        onSuccess();
      } else if (data?.id) {
        router.push(`${t.cabinet.index}/patients/${data.id}?cabinetId=${cabinetId}`);
      }
    } catch (error: unknown) {
      applySubmitError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const entitySchema = formSchemas ? getEntitySchema(formSchemas, 'patient') : null;

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={patient?.id ? 'Modifier le patient' : 'Nouveau patient'}
      icon={IconUser}
      size="lg"
      footer={
        <AppModalFooter>
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button color="sage" loading={submitting} onClick={() => void handleSubmit()}>
            {patient?.id ? 'Enregistrer' : 'Créer'}
          </Button>
        </AppModalFooter>
      }
    >
      <Stack gap="md">
        <CabinetFormErrorBanner fieldErrors={fieldErrors} formError={formError} />
        <TextInput
          label="Prénom"
          value={firstName}
          onChange={(e) => {
            clearFieldError('firstName');
            setFirstName(e.currentTarget.value);
          }}
          error={fieldErrors.firstName}
          required
        />
        <TextInput
          label="Nom"
          value={lastName}
          onChange={(e) => {
            clearFieldError('lastName');
            setLastName(e.currentTarget.value);
          }}
          error={fieldErrors.lastName}
          required
        />
        <RpDatePicker
          label="Date de naissance"
          value={birthDate}
          onChange={(d) => {
            clearFieldError('birthDate');
            setBirthDate(d);
          }}
          error={fieldErrors.birthDate}
          clearable
        />
        <TextInput
          label="Personne à contacter en cas d'urgence"
          value={emergencyContact}
          onChange={(e) => {
            clearFieldError('emergencyContact');
            setEmergencyContact(e.currentTarget.value);
          }}
          error={fieldErrors.emergencyContact}
        />
        {entitySchema && (
          <DynamicFormRenderer
            schema={entitySchema}
            values={customValues}
            onChange={handleCustomChange}
            fieldErrors={fieldErrors}
          />
        )}
      </Stack>
    </AppModal>
  );
}
