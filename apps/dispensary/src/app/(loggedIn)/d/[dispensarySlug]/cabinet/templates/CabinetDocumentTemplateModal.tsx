'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Stack,
  Tabs,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { handleApiZodError } from '@/lib/services/zod';
import {
  TemplateEditorWithModes,
  TemplatePreviewWithForm,
  useTemplatePreviewActions,
} from '@lawless-intranet/mail-template-ui';
import type { ConsultationDocumentTemplateListItem } from '@/types/cabinetDocuments';

const SAMPLE_VARIABLES = {
  cabinetName: 'Cabinet médical central',
  patientFirstName: 'Jean',
  patientLastName: 'Dupont',
  patientFullName: 'Jean Dupont',
  patientBirthDate: '12/03/1990',
  careEpisodeMotif: 'Suivi général',
  careEpisodeStartedAt: '02/06/2026',
  consultationDate: '20/06/2026',
  consultation_traitement: 'Paracétamol 1 g',
};

interface CabinetDocumentTemplateModalProps {
  opened: boolean;
  onClose: () => void;
  editingTemplate: ConsultationDocumentTemplateListItem | null;
  onCreate: (values: {
    name: string;
    description?: string;
    defaultDocumentName?: string;
    content: string;
  }) => Promise<void>;
  onUpdate: (values: {
    id: string;
    name: string;
    description?: string;
    defaultDocumentName?: string;
    content: string;
  }) => Promise<void>;
}

export function CabinetDocumentTemplateModal({
  opened,
  onClose,
  editingTemplate,
  onCreate,
  onUpdate,
}: CabinetDocumentTemplateModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formHydrated, setFormHydrated] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      description: '',
      defaultDocumentName: '',
      content: '',
    },
    validate: {
      name: (value) => (value.trim().length === 0 ? 'Le nom est requis' : null),
      content: (value) => (value.trim().length === 0 ? 'Le contenu est requis' : null),
    },
  });

  const preview = useTemplatePreviewActions(form.values.content, SAMPLE_VARIABLES, {
    inputsMode: 'disabled',
  });

  useEffect(() => {
    if (!opened) {
      setFormHydrated(false);
      return;
    }

    if (editingTemplate) {
      form.setValues({
        name: editingTemplate.name,
        description: editingTemplate.description ?? '',
        defaultDocumentName: editingTemplate.defaultDocumentName ?? '',
        content: editingTemplate.content,
      });
      setFormHydrated(true);
      return;
    }

    form.reset();
    setFormHydrated(true);
  }, [editingTemplate, opened]);

  const handleClose = () => {
    onClose();
    form.reset();
    setSubmitting(false);
    setFormHydrated(false);
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setSubmitting(true);
      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        defaultDocumentName: values.defaultDocumentName.trim() || undefined,
        content: values.content,
      };

      if (editingTemplate) {
        await onUpdate({ id: editingTemplate.id, ...payload });
      } else {
        await onCreate(payload);
      }

      handleClose();
    } catch (error: unknown) {
      if (error instanceof ParsedZodError) {
        handleApiZodError(error.error, form);
      }
      setSubmitting(false);
    }
  };

  const isLoading = !formHydrated;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={editingTemplate ? 'Modifier le template' : 'Nouveau template'}
      size="90%"
      styles={{
        content: { maxWidth: '75rem' },
        body: { maxHeight: 'calc(100dvh - 10rem)' },
      }}
    >
      {isLoading ? (
        <Center py="xl">
          <Loader color="sage" />
        </Center>
      ) : (
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput label="Nom" required {...form.getInputProps('name')} />
            <TextInput
              label="Nom du document par défaut"
              placeholder="Nom proposé à la création d’une prescription"
              {...form.getInputProps('defaultDocumentName')}
            />
            <Textarea
              label="Description"
              placeholder="Description du template"
              minRows={2}
              autosize
              {...form.getInputProps('description')}
            />

            <Tabs defaultValue="editor">
              <Tabs.List>
                <Tabs.Tab value="editor">Éditeur</Tabs.Tab>
                <Tabs.Tab value="preview">Aperçu consultation</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="editor" pt="md">
                <TemplateEditorWithModes
                  key={editingTemplate?.id ?? 'new'}
                  value={form.values.content}
                  onChange={(value) => form.setFieldValue('content', value)}
                  placeholder="Contenu du template"
                  required
                />
              </Tabs.Panel>

              <Tabs.Panel value="preview" pt="md">
                {form.values.content ? (
                  <TemplatePreviewWithForm
                    templateContent={form.values.content}
                    variables={SAMPLE_VARIABLES}
                    inputsMode="disabled"
                    resultLabel="Aperçu consultation (données fictives)"
                    formRef={preview.formRef}
                    onFormChange={preview.setFormContent}
                    resultContent={preview.resultContent}
                    onResultChange={preview.setEditedContent}
                    isManuallyEdited={preview.isManuallyEdited}
                    onRegenerate={preview.handleRegenerate}
                  />
                ) : (
                  <Center py="xl" c="dimmed">
                    Renseignez le contenu du modèle pour voir l&apos;aperçu.
                  </Center>
                )}
              </Tabs.Panel>
            </Tabs>

            <Group justify="flex-end">
              <Button variant="subtle" color="slate" onClick={handleClose}>
                Annuler
              </Button>
              <Button type="submit" loading={submitting}>
                {editingTemplate ? 'Enregistrer' : 'Créer'}
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
