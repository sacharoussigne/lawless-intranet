'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Container, Grid, Group, Stack, Tabs, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconCheck, IconCopy } from '@tabler/icons-react';
import {
  TemplateEditorWithModes,
  TemplatePreviewWithForm,
  useTemplatePreviewActions,
} from '@lawless-intranet/mail-template-ui';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import {
  createAnimalDocumentTemplate,
  updateAnimalDocumentTemplate,
} from '@/app/_actions/animalDocumentTemplates';
import { handleAction } from '@/lib/action';
import { useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import type { AnimalDocumentTemplateListItem } from '@/types/animalDocuments';
import { SAMPLE_ANIMAL_TEMPLATE_VARIABLES } from './sampleAnimalTemplateVariables';

interface TemplateFormPageProps {
  shelterSlug: string;
  mode: 'create' | 'edit';
  template?: AnimalDocumentTemplateListItem;
}

export function TemplateFormPage({ shelterSlug, mode, template }: TemplateFormPageProps) {
  const router = useRouter();
  const routes = useTenantRoutes();
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

  const preview = useTemplatePreviewActions(
    form.values.content,
    SAMPLE_ANIMAL_TEMPLATE_VARIABLES,
    {
      inputsMode: 'disabled',
    },
  );

  const handleCopy = async () => {
    if (!form.values.content) return;

    try {
      await navigator.clipboard.writeText(form.values.content);
      setCopied(true);
      notifications.show({
        title: 'Succès',
        message: 'Modèle copié dans le presse-papiers',
        color: 'teal',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de copier le modèle',
        color: 'danger',
      });
    }
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setLoading(true);
      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        defaultDocumentName: values.defaultDocumentName.trim() || undefined,
        content: values.content,
      };

      const result =
        mode === 'create'
          ? await createAnimalDocumentTemplate(shelterSlug, payload)
          : template
            ? await updateAnimalDocumentTemplate(shelterSlug, {
                id: template.id,
                ...payload,
              })
            : null;

      if (!result) return;

      handleAction(result);
      notifications.show({
        title: 'Succès',
        message:
          mode === 'create' ? 'Modèle créé avec succès' : 'Modèle modifié avec succès',
        color: 'teal',
      });
      router.push(routes.management.templates);
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Erreur lors de la sauvegarde',
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl">
      <Group mb="md">
        <Button
          variant="subtle"
          color="terracotta"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push(routes.management.templates)}
        >
          Retour aux modèles
        </Button>
      </Group>

      <PageHeader
        title={mode === 'create' ? 'Nouveau modèle' : `Modifier ${template?.name ?? 'le modèle'}`}
        description="Modèle de document animal du refuge"
      />

      <Group mb="md" justify="flex-end">
        {form.values.content ? (
          <Button
            leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            onClick={handleCopy}
            variant={copied ? 'light' : 'default'}
            color={copied ? 'teal' : undefined}
          >
            {copied ? 'Copié' : 'Copier'}
          </Button>
        ) : null}
        <Button
          type="submit"
          form="animal-template-form"
          color="terracotta"
          loading={loading}
        >
          {mode === 'create' ? 'Créer' : 'Enregistrer'}
        </Button>
      </Group>

      <form id="animal-template-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Grid gutter="xl">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Nom"
                placeholder="Nom du modèle"
                required
                {...form.getInputProps('name')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Nom du document par défaut"
                placeholder="Nom proposé à la création d’un document"
                {...form.getInputProps('defaultDocumentName')}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Textarea
                label="Description"
                placeholder="Description du modèle"
                minRows={2}
                autosize
                {...form.getInputProps('description')}
              />
            </Grid.Col>
          </Grid>

          <Tabs defaultValue="editor">
            <Tabs.List>
              <Tabs.Tab value="editor">Éditeur</Tabs.Tab>
              <Tabs.Tab value="preview">Aperçu animal</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="editor" pt="md">
              <TemplateEditorWithModes
                key={template?.id ?? 'new'}
                value={form.values.content}
                onChange={(value) => form.setFieldValue('content', value)}
                placeholder="Contenu du modèle (ex. {{animalName}}, {{shelterName}})"
                required
              />
            </Tabs.Panel>

            <Tabs.Panel value="preview" pt="md">
              <TemplatePreviewWithForm
                templateContent={form.values.content}
                variables={SAMPLE_ANIMAL_TEMPLATE_VARIABLES}
                inputsMode="disabled"
                resultLabel="Aperçu animal (données fictives)"
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
    </Container>
  );
}
