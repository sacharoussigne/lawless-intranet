'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Center,
  Group,
  Modal,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import {
  TemplatePreviewWithForm,
  useTemplatePreviewActions,
} from '@lawless-intranet/mail-template-ui';
import type { AnimalDocumentTemplateListItem } from '@/types/animalDocuments';

type TemplateVariables = Record<string, string>;

interface FollowUpTemplateMessageModalProps {
  opened: boolean;
  onClose: () => void;
  templates: AnimalDocumentTemplateListItem[];
  variables: TemplateVariables;
  onApply: (content: string) => void;
}

function getDefaultTemplateId(templates: AnimalDocumentTemplateListItem[]): string | null {
  return templates[0]?.id ?? null;
}

export function FollowUpTemplateMessageModal({
  opened,
  onClose,
  templates,
  variables,
  onApply,
}: FollowUpTemplateMessageModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(() =>
    getDefaultTemplateId(templates),
  );
  const [editedContent, setEditedContent] = useState('');
  const [ready, setReady] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const preview = useTemplatePreviewActions(selectedTemplate?.content ?? '', variables);

  useEffect(() => {
    setSelectedTemplateId(getDefaultTemplateId(templates));
    setEditedContent('');
    setReady(true);
    // Mount-only init: parent remounts this modal on each open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTemplateChange = (templateId: string | null) => {
    setSelectedTemplateId(templateId);
    setEditedContent('');
    preview.handleRegenerate();
  };

  const handleClose = () => {
    onClose();
  };

  const handleApply = () => {
    const content = (editedContent.trim() || preview.resultContent.trim());
    if (!content) return;
    onApply(content);
    handleClose();
  };

  const templateOptions = templates.map((template) => ({
    value: template.id,
    label: template.name,
  }));

  const previewResultContent = editedContent || preview.resultContent;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Écrire depuis un modèle"
      size="90%"
      styles={{
        content: {
          maxWidth: '85rem',
          maxHeight: 'calc(100dvh - 4rem)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
        body: {
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {!ready ? (
        <Center py="xl">
          <Text c="dimmed">Chargement…</Text>
        </Center>
      ) : (
        <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
          <Select
            label="Modèle"
            placeholder="Choisir un modèle"
            data={templateOptions}
            value={selectedTemplateId}
            onChange={handleTemplateChange}
            nothingFoundMessage="Aucun modèle"
            searchable
            style={{ flexShrink: 0 }}
          />

          <div style={{ flexShrink: 0 }}>
            {selectedTemplate ? (
              <TemplatePreviewWithForm
                templateContent={selectedTemplate.content}
                variables={variables}
                formRef={preview.formRef}
                onFormChange={preview.setFormContent}
                resultContent={previewResultContent}
                onResultChange={setEditedContent}
                isManuallyEdited={preview.isManuallyEdited || Boolean(editedContent)}
                onRegenerate={() => {
                  preview.handleRegenerate();
                  setEditedContent('');
                }}
              />
            ) : (
              <Center py="xl">
                <Text c="dimmed">Sélectionnez un modèle pour préparer le message.</Text>
              </Center>
            )}
          </div>

          <Group justify="flex-end" style={{ flexShrink: 0, marginTop: 'auto' }}>
            <Button variant="subtle" color="gray" onClick={handleClose}>
              Annuler
            </Button>
            <Button
              color="terracotta"
              disabled={!previewResultContent.trim()}
              onClick={handleApply}
            >
              Utiliser
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
