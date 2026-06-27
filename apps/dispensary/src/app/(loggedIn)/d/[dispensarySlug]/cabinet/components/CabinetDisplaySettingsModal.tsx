'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Button,
  ColorInput,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPalette, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { MarkdownContent } from '@/app/_components/MarkdownContent';
import { updateCabinetDisplaySettings } from '@/app/_actions/cabinet/displaySettings';
import { handleAction } from '@/lib/action';
import {
  DISPLAY_SETTINGS_PREVIEW_MARKDOWN,
  LABEL_COLOR_KEYS,
  type CabinetDisplaySettings,
  type CabinetLabelColorKey,
} from '@/lib/cabinet/displaySettings';
import { CabinetFieldLabel } from './CabinetFieldLabel';
import { CabinetDisplaySettingsProvider } from './CabinetDisplaySettingsContext';

type LabelColorFormValues = Record<CabinetLabelColorKey, string>;

function settingsToFormValues(settings: CabinetDisplaySettings): LabelColorFormValues {
  const values = {} as LabelColorFormValues;
  for (const { key } of LABEL_COLOR_KEYS) {
    values[key] = settings.labelColors?.[key] ?? '';
  }
  return values;
}

function formValuesToSettings(values: LabelColorFormValues): CabinetDisplaySettings {
  const labelColors: Partial<Record<CabinetLabelColorKey, string | null>> = {};
  for (const { key } of LABEL_COLOR_KEYS) {
    const trimmed = values[key].trim();
    if (trimmed) {
      labelColors[key] = trimmed;
    }
  }
  return Object.keys(labelColors).length > 0 ? { labelColors } : {};
}

interface CabinetDisplaySettingsModalProps {
  opened: boolean;
  onClose: () => void;
  dispensarySlug: string;
  cabinetId: string;
  initialSettings: CabinetDisplaySettings;
  onSaved?: (settings: CabinetDisplaySettings) => void;
}

export function CabinetDisplaySettingsModal({
  opened,
  onClose,
  dispensarySlug,
  cabinetId,
  initialSettings,
  onSaved,
}: CabinetDisplaySettingsModalProps) {
  const [saving, setSaving] = useState(false);

  const form = useForm<LabelColorFormValues>({
    initialValues: settingsToFormValues(initialSettings),
  });

  useEffect(() => {
    if (opened) {
      form.setValues(settingsToFormValues(initialSettings));
      form.resetDirty();
    }
  }, [opened, initialSettings]);

  const previewSettings = useMemo(
    () => formValuesToSettings(form.values),
    [form.values],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const displaySettings = formValuesToSettings(form.values);
      const result = await updateCabinetDisplaySettings(dispensarySlug, {
        cabinetId,
        displaySettings,
      });
      const saved = handleAction(result);
      if (saved) {
        notifications.show({
          title: 'Affichage enregistré',
          message: '',
          color: 'moss',
        });
        onSaved?.(saved);
        onClose();
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec de la sauvegarde',
        color: 'danger',
      });
    } finally {
      setSaving(false);
    }
  }, [cabinetId, dispensarySlug, form.values, onClose, onSaved]);

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Affichage des formulaires"
      description="Personnalisez la couleur des libellés pour les distinguer du contenu Markdown. Laissez vide pour la couleur par défaut."
      icon={IconPalette}
      size="lg"
      footer={
        <AppModalFooter>
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button color="sage" loading={saving} onClick={() => void handleSave()}>
            Enregistrer
          </Button>
        </AppModalFooter>
      }
    >
      <Stack gap="md">
        {LABEL_COLOR_KEYS.map(({ key, label }) => (
          <ColorInput
            key={key}
            label={label}
            description="Laisse vide pour la couleur par défaut."
            format="hex"
            value={form.values[key]}
            onChange={(value) => form.setFieldValue(key, value)}
            rightSection={
              form.values[key] ? (
                <ActionIcon
                  variant="subtle"
                  color="slate"
                  aria-label="Réinitialiser"
                  onClick={() => form.setFieldValue(key, '')}
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : null
            }
            rightSectionPointerEvents="all"
          />
        ))}

        <Paper withBorder p="md" radius="sm">
          <Text size="sm" fw={500} mb="sm">
            Aperçu
          </Text>
          <CabinetDisplaySettingsProvider settings={previewSettings}>
            <Stack gap={4} style={{ minWidth: 0 }}>
              <CabinetFieldLabel labelKey="textarea">Exercices</CabinetFieldLabel>
              <MarkdownContent source={DISPLAY_SETTINGS_PREVIEW_MARKDOWN} />
            </Stack>
          </CabinetDisplaySettingsProvider>
        </Paper>
      </Stack>
    </AppModal>
  );
}
