'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import {
  Stack,
  Paper,
  Text,
  Textarea,
  ScrollArea,
  Button,
  Group,
  Grid,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  extractInputs,
  renderTemplate,
} from '@lawless-intranet/mail-template-engine';
import {
  TemplateFormGenerator,
  type TemplateFormGeneratorHandle,
} from './TemplateFormGenerator';
import { buildTemplateRenderContext, useMailTemplateContext } from './MailTemplateProvider';

export function useTemplatePreviewActions(
  templateContent: string,
  variables?: Record<string, string>,
  options?: {
    inputsMode?: 'form' | 'disabled';
    /** Enabled by default. Pass `false` to keep literal Bonjour/Bonsoir text. */
    applyGreetingAdaptation?: boolean;
  },
) {
  const { username, userDescription, userGender } = useMailTemplateContext();
  const formRef = useRef<TemplateFormGeneratorHandle>(null);
  const [formContent, setFormContent] = useState('');
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputsMode = options?.inputsMode ?? 'form';
  const applyGreetingAdaptation = options?.applyGreetingAdaptation !== false;

  const hasInputs = useMemo(
    () => inputsMode === 'form' && extractInputs(templateContent).length > 0,
    [templateContent, inputsMode],
  );

  const staticContent = useMemo(() => {
    if (hasInputs) return '';
    return renderTemplate(
      templateContent,
      buildTemplateRenderContext(username, userDescription, userGender, { inputs: {}, variables }),
      {
        applyGreetingAdaptation,
        skipInputs: inputsMode === 'disabled',
      },
    );
  }, [
    templateContent,
    hasInputs,
    variables,
    username,
    userDescription,
    userGender,
    inputsMode,
    applyGreetingAdaptation,
  ]);

  const autoContent = hasInputs ? formContent : staticContent;
  const resultContent = editedContent ?? autoContent;
  const isManuallyEdited = editedContent !== null;

  useEffect(() => {
    setFormContent('');
    setEditedContent(null);
    formRef.current?.reset();
  }, [templateContent, variables]);

  const resetTemplateForm = () => {
    formRef.current?.reset();
    setEditedContent(null);
  };

  const handleRegenerate = () => {
    setEditedContent(null);
  };

  const handleCopy = async (content?: string) => {
    const contentToCopy = content ?? resultContent;
    if (!contentToCopy) return;

    try {
      await navigator.clipboard.writeText(contentToCopy);
      setCopied(true);
      notifications.show({
        title: 'Succès',
        message: 'Courrier copié dans le presse-papiers',
        color: 'moss',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de copier le courrier',
        color: 'danger',
      });
    }
  };

  return {
    formRef,
    hasInputs,
    formContent,
    setFormContent,
    editedContent,
    setEditedContent,
    resultContent,
    isManuallyEdited,
    copied,
    resetTemplateForm,
    handleRegenerate,
    handleCopy,
  };
}

interface TemplatePreviewWithFormProps {
  templateContent: string;
  variables?: Record<string, string>;
  resultLabel?: string;
  inputsMode?: 'form' | 'disabled';
  formRef: React.RefObject<TemplateFormGeneratorHandle | null>;
  onFormChange: (content: string) => void;
  resultContent: string;
  onResultChange: (value: string) => void;
  isManuallyEdited: boolean;
  onRegenerate: () => void;
}

export function TemplatePreviewWithForm({
  templateContent,
  variables,
  resultLabel = 'Aperçu',
  inputsMode = 'form',
  formRef,
  onFormChange,
  resultContent,
  onResultChange,
  isManuallyEdited,
  onRegenerate,
}: TemplatePreviewWithFormProps) {
  const showForm = inputsMode === 'form';

  return (
    <Grid gutter="xl">
      {showForm && (
        <Grid.Col span={5}>
          <Stack gap="md">
            <Text size="sm" fw={600}>
              Formulaire
            </Text>
            <Paper p="md" withBorder>
              <ScrollArea h={600} scrollbars="y" type="auto">
                <TemplateFormGenerator
                  ref={formRef}
                  template={templateContent}
                  variables={variables}
                  onChange={onFormChange}
                />
              </ScrollArea>
            </Paper>
          </Stack>
        </Grid.Col>
      )}
      <Grid.Col span={showForm ? 7 : 12}>
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              {resultLabel}
            </Text>
            {isManuallyEdited && showForm && (
              <Button variant="subtle" size="xs" onClick={onRegenerate}>
                Réappliquer le formulaire
              </Button>
            )}
          </Group>
          <Paper p="md" withBorder>
            <Textarea
              value={resultContent}
              onChange={(e) => onResultChange(e.currentTarget.value)}
              placeholder={
                showForm
                  ? 'Remplissez le formulaire pour générer le résultat…'
                  : 'Aperçu du courrier…'
              }
              minRows={24}
              autosize
              styles={{
                input: {
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                },
              }}
            />
          </Paper>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
