'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Container, Grid, Group, Stack, Tabs, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconCheck, IconCopy } from '@tabler/icons-react';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { handleApiZodError } from '@/lib/services/zod';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { handleAction } from '@/lib/action';
import {
  createConsultationDocumentTemplate,
  updateConsultationDocumentTemplate,
} from '@/app/_actions/cabinet/consultationDocumentTemplates';
import { tenantRoutes } from '@/types/routes';
import type { ConsultationDocumentTemplateListItem } from '@/types/cabinetDocuments';
import {
  TemplateEditorWithModes,
  TemplatePreviewWithForm,
  useTemplatePreviewActions,
} from '@lawless-intranet/mail-template-ui';

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

interface TemplateFormPageProps {
  dispensarySlug: string;
  cabinetId: string;
  mode: 'create' | 'edit';
  template?: ConsultationDocumentTemplateListItem;
}

export function TemplateFormPage({
  dispensarySlug,
  cabinetId,
  mode,
  template,
}: TemplateFormPageProps) {
  const router = useRouter();
  const routes = tenantRoutes(dispensarySlug);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const form = useForm({
    initialValues: {
      name: template?.name ?? '',
      description: template?.description ?? '',
      defaultDocumentName: template?.defaultDocumentName ?? '',
      content: template?.content ?? '',
    },
    validate: {
      name: (value) => (value.trim().length < 1 ? 'Le nom est requis' : null),
      content: (value) => (value.trim().length < 1 ? 'Le contenu est requis' : null),
    },
  });

  const preview = useTemplatePreviewActions(form.values.content, SAMPLE_VARIABLES, {
    inputsMode: 'disabled',
  });

  const handleCopy = async () => {
    if (!form.values.content) return;

    try {
      await navigator.clipboard.writeText(form.values.content);
      setCopied(true);
      notifications.show({
        title: 'Succès',
        message: 'Template copié dans le presse-papiers',
        color: 'moss',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de copier le template',
        color: 'danger',
      });
    }
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setLoading(true);
      const payload = {
        cabinetId,
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        defaultDocumentName: values.defaultDocumentName.trim() || undefined,
        content: values.content,
      };

      const result =
        mode === 'create'
          ? await createConsultationDocumentTemplate(dispensarySlug, payload)
          : template
            ? await updateConsultationDocumentTemplate(dispensarySlug, {
                id: template.id,
                ...payload,
              })
            : null;

      if (!result) return;

      handleAction(result);
      notifications.show({
        title: 'Succès',
        message:
          mode === 'create'
            ? 'Template créé avec succès'
            : 'Template modifié avec succès',
        color: 'moss',
      });
      router.push(routes.cabinet.templates(cabinetId));
    } catch (error: unknown) {
      if (error instanceof ParsedZodError) {
        handleApiZodError(error.error, form);
      } else {
        notifications.show({
          title: 'Erreur',
          message:
            error instanceof Error ? error.message : 'Erreur lors de la sauvegarde',
          color: 'danger',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        <PageHeader
          title={mode === 'create' ? 'Nouveau template' : `Modifier ${template?.name ?? 'le template'}`}
          description="Template de prescription du cabinet"
          backHref={routes.cabinet.templates(cabinetId)}
          backLabel="Retour aux templates"
          actions={
            <Group>
              {form.values.content && (
                <Button
                  leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  onClick={handleCopy}
                  variant={copied ? 'light' : 'default'}
                  color={copied ? 'moss' : undefined}
                >
                  {copied ? 'Copié' : 'Copier'}
                </Button>
              )}
              <Button
                variant="subtle"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => router.push(routes.cabinet.templates(cabinetId))}
              >
                Retour
              </Button>
              <Button type="submit" form="cabinet-template-form" loading={loading}>
                {mode === 'create' ? 'Créer' : 'Enregistrer'}
              </Button>
            </Group>
          }
        />

        <form id="cabinet-template-form" onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Grid gutter="xl">
              <Grid.Col span={6}>
                <TextInput
                  label="Nom"
                  placeholder="Nom du template"
                  required
                  {...form.getInputProps('name')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Nom du document par défaut"
                  placeholder="Nom proposé à la création d’une prescription"
                  {...form.getInputProps('defaultDocumentName')}
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Textarea
                  label="Description"
                  placeholder="Description du template"
                  minRows={2}
                  autosize
                  {...form.getInputProps('description')}
                />
              </Grid.Col>
            </Grid>

            <Tabs defaultValue="editor">
              <Tabs.List>
                <Tabs.Tab value="editor">Éditeur</Tabs.Tab>
                <Tabs.Tab value="preview">Aperçu consultation</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="editor" pt="md">
                <TemplateEditorWithModes
                  key={template?.id ?? 'new'}
                  value={form.values.content}
                  onChange={(value) => form.setFieldValue('content', value)}
                  placeholder="Contenu du template"
                  required
                />
              </Tabs.Panel>

              <Tabs.Panel value="preview" pt="md">
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
              </Tabs.Panel>
            </Tabs>
          </Stack>
        </form>
      </Stack>
    </Container>
  );
}
