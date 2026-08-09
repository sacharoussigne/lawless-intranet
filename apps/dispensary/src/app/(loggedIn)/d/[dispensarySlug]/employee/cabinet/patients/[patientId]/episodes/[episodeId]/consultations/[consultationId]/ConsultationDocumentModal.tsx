'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Center,
  Group,
  Modal,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { handleApiZodError } from '@/lib/services/zod';
import {
  TemplatePreviewWithForm,
  useTemplatePreviewActions,
} from '@lawless-intranet/mail-template-ui';
import type {
  ConsultationDocumentListItem,
  ConsultationDocumentTemplateListItem,
} from '@/types/cabinetDocuments';

type TemplateVariables = Record<string, string>;

interface ConsultationDocumentModalProps {
  opened: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  document: ConsultationDocumentListItem | null;
  templates: ConsultationDocumentTemplateListItem[];
  variables: TemplateVariables;
  onCreateFreeText: (values: { name: string; content: string }) => Promise<void>;
  onCreateFromTemplate: (values: {
    templateId: string;
    name: string;
    content: string;
  }) => Promise<void>;
  onUpdate: (values: { id: string; name: string; content: string }) => Promise<void>;
}

type CreateMode = 'template' | 'freeText';

function getInitialCreateMode(
  templates: ConsultationDocumentTemplateListItem[],
): CreateMode {
  return templates.length > 0 ? 'template' : 'freeText';
}

function getDefaultTemplateId(
  templates: ConsultationDocumentTemplateListItem[],
): string | null {
  return templates[0]?.id ?? null;
}

export function ConsultationDocumentModal({
  opened,
  onClose,
  mode,
  document,
  templates,
  variables,
  onCreateFreeText,
  onCreateFromTemplate,
  onUpdate,
}: ConsultationDocumentModalProps) {
  const isEdit = mode === 'edit' && document !== null;
  const [createMode, setCreateMode] = useState<CreateMode>(() =>
    isEdit && document
      ? document.source === 'template'
        ? 'template'
        : 'freeText'
      : getInitialCreateMode(templates),
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(() =>
    isEdit && document?.templateId
      ? document.templateId
      : getDefaultTemplateId(templates),
  );
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const form = useForm({
    initialValues: {
      name: '',
      content: '',
    },
    validate: {
      name: (value) => (value.trim().length === 0 ? 'Le nom est requis' : null),
      content: (value) => (value.trim().length === 0 ? 'Le contenu est requis' : null),
    },
  });

  const preview = useTemplatePreviewActions(selectedTemplate?.content ?? '', variables);

  useEffect(() => {
    if (isEdit && document) {
      setCreateMode(document.source === 'template' ? 'template' : 'freeText');
      setSelectedTemplateId(document.templateId);
      form.setValues({
        name: document.name,
        content: document.content,
      });
    } else {
      const defaultTemplateId = getDefaultTemplateId(templates);
      const defaultTemplate = templates.find((t) => t.id === defaultTemplateId) ?? null;
      setCreateMode(getInitialCreateMode(templates));
      setSelectedTemplateId(defaultTemplateId);
      form.setValues({
        name: defaultTemplate?.defaultDocumentName ?? defaultTemplate?.name ?? '',
        content: '',
      });
    }

    setReady(true);
    // Mount-only init: parent remounts this modal on each open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    onClose();
    setSubmitting(false);
  };

  const handleCreateModeChange = (value: string | null) => {
    const nextMode = (value as CreateMode) ?? 'template';
    setCreateMode(nextMode);
    if (nextMode === 'freeText') {
      form.setFieldValue('content', '');
    } else {
      preview.handleRegenerate();
      form.setFieldValue('content', '');
    }
  };

  const handleTemplateChange = (templateId: string | null) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;

    form.setFieldValue('name', template.defaultDocumentName ?? template.name);
    form.setFieldValue('content', '');
    preview.handleRegenerate();
  };

  const resolveContent = () => {
    if (isEdit || createMode === 'freeText') {
      return form.values.content.trim();
    }
    return form.values.content.trim() || preview.resultContent.trim();
  };

  const handleSubmit = async () => {
    const name = form.values.name.trim();
    const content = resolveContent();

    if (!name) {
      form.setFieldError('name', 'Le nom est requis');
      return;
    }
    if (!content) {
      form.setFieldError('content', 'Le contenu est requis');
      return;
    }

    try {
      setSubmitting(true);

      if (isEdit && document) {
        await onUpdate({ id: document.id, name, content });
      } else if (createMode === 'template') {
        if (!selectedTemplateId) {
          form.setFieldError('content', 'Sélectionnez un template');
          setSubmitting(false);
          return;
        }

        await onCreateFromTemplate({
          templateId: selectedTemplateId,
          name,
          content,
        });
      } else {
        await onCreateFreeText({ name, content });
      }

      handleClose();
    } catch (error: unknown) {
      if (error instanceof ParsedZodError) {
        handleApiZodError(error.error, form);
      }
      setSubmitting(false);
    }
  };

  const templateOptions = templates.map((template) => ({
    value: template.id,
    label: template.name,
  }));

  const previewResultContent = form.values.content || preview.resultContent;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={isEdit ? 'Modifier le document' : 'Nouveau document'}
      size="90%"
      styles={{
        content: { maxWidth: '75rem' },
        body: { maxHeight: 'calc(100dvh - 10rem)' },
      }}
    >
      {!ready ? (
        <Center py="xl">
          <Text c="dimmed">Chargement…</Text>
        </Center>
      ) : (
        <Stack>
          {!isEdit && (
            <Tabs value={createMode} onChange={handleCreateModeChange}>
              <Tabs.List>
                <Tabs.Tab value="template" disabled={templates.length === 0}>
                  Depuis un template
                </Tabs.Tab>
                <Tabs.Tab value="freeText">Texte libre</Tabs.Tab>
              </Tabs.List>
            </Tabs>
          )}

          <TextInput
            label="Nom"
            placeholder="Nom du document"
            required
            {...form.getInputProps('name')}
          />

          {!isEdit && createMode === 'template' && (
            <>
              <Select
                label="Template"
                placeholder="Choisir un template"
                data={templateOptions}
                value={selectedTemplateId}
                onChange={handleTemplateChange}
                nothingFoundMessage="Aucun template"
                searchable
              />

              {selectedTemplate ? (
                <TemplatePreviewWithForm
                  templateContent={selectedTemplate.content}
                  variables={variables}
                  formRef={preview.formRef}
                  onFormChange={preview.setFormContent}
                  resultContent={previewResultContent}
                  onResultChange={(value) => form.setFieldValue('content', value)}
                  isManuallyEdited={preview.isManuallyEdited || Boolean(form.values.content)}
                  onRegenerate={() => {
                    preview.handleRegenerate();
                    form.setFieldValue('content', '');
                  }}
                />
              ) : (
                <Center py="xl">
                  <Text c="dimmed">Sélectionnez un template pour préparer le document.</Text>
                </Center>
              )}
            </>
          )}

          {(isEdit || createMode === 'freeText') && (
            <Textarea
              label="Contenu"
              placeholder="Contenu du document"
              minRows={24}
              autosize
              required
              {...form.getInputProps('content')}
            />
          )}

          <Group justify="flex-end">
            <Button variant="subtle" color="slate" onClick={handleClose}>
              Annuler
            </Button>
            <Button loading={submitting} onClick={() => void handleSubmit()}>
              {isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
