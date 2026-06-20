'use client';

import { useEffect, useState } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  Button,
  Group,
  Loader,
  Center,
  Tabs,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { handleApiZodError } from '@/lib/services/zod';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import type { MailTemplateListItem } from '@/types/mailTemplates';
import {
  TemplateEditorWithModes,
  TemplatePreviewWithForm,
  useTemplatePreviewActions,
} from '@lawless-intranet/mail-template-ui';
import {
  type useCreateMailTemplateMutation,
  useManagementMailTemplateDetail,
  type useUpdateMailTemplateMutation,
} from '../hooks/useMailTemplatesQueries';

const SAMPLE_ORDER_VARIABLES = {
  name: 'Jean Dupont',
  items: '- Bandage (x2)\n- Seringue (x1)',
  price: '150.00 $',
};

interface MailTemplateModalProps {
  opened: boolean;
  onClose: () => void;
  editingMailTemplate: MailTemplateListItem | null;
  createMutation: ReturnType<typeof useCreateMailTemplateMutation>;
  updateMutation: ReturnType<typeof useUpdateMailTemplateMutation>;
}

export function MailTemplateModal({
  opened,
  onClose,
  editingMailTemplate,
  createMutation,
  updateMutation,
}: MailTemplateModalProps) {
  const [formHydrated, setFormHydrated] = useState(false);
  const { data: editingDetail, isFetching: isLoadingDetail } =
    useManagementMailTemplateDetail(editingMailTemplate?.id ?? null, opened && Boolean(editingMailTemplate));

  const form = useForm({
    initialValues: {
      name: '',
      description: '',
      defaultMailName: '',
      content: '',
    },
    validate: {
      name: (value) => (value.length < 1 ? 'Le nom est requis' : null),
      content: (value) => (value.length < 1 ? 'Le contenu est requis' : null),
    },
  });

  const orderPreview = useTemplatePreviewActions(form.values.content, SAMPLE_ORDER_VARIABLES, {
    inputsMode: 'disabled',
  });

  useEffect(() => {
    if (!opened) {
      setFormHydrated(false);
      return;
    }

    if (editingMailTemplate && editingDetail) {
      form.setValues({
        name: editingDetail.name,
        description: editingDetail.description || '',
        defaultMailName: editingDetail.defaultMailName || '',
        content: editingDetail.content,
      });
      setFormHydrated(true);
    } else if (!editingMailTemplate) {
      form.reset();
      setFormHydrated(true);
    }
  }, [editingMailTemplate, editingDetail, opened]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isEditLoading =
    Boolean(editingMailTemplate) && (!formHydrated || (isLoadingDetail && !editingDetail));

  const handleSubmit = async (values: typeof form.values) => {
    try {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        content: values.content,
        defaultMailName: values.defaultMailName || undefined,
      };

      if (editingMailTemplate) {
        await updateMutation.mutateAsync({ id: editingMailTemplate.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
      form.reset();
    } catch (error: unknown) {
      if (error instanceof ParsedZodError) {
        handleApiZodError(error.error, form);
      }
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        onClose();
        form.reset();
      }}
      title={editingMailTemplate ? 'Modifier le modèle' : 'Créer un modèle'}
      size="xl"
    >
      {isEditLoading ? (
        <Center py="xl">
          <Loader color="sage" />
        </Center>
      ) : (
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Nom"
              placeholder="Nom du template"
              required
              {...form.getInputProps('name')}
            />
            <TextInput
              label="Nom du courrier par défaut"
              placeholder="Préremplit le champ « Nom » à la création d’un courrier (optionnel)"
              {...form.getInputProps('defaultMailName')}
            />
            <Textarea
              label="Description"
              placeholder="Description du template (optionnel)"
              minRows={2}
              autosize
              {...form.getInputProps('description')}
            />

            <Tabs defaultValue="editor">
              <Tabs.List>
                <Tabs.Tab value="editor">Éditeur</Tabs.Tab>
                <Tabs.Tab value="order-preview">Aperçu commande</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="editor" pt="md">
                <TemplateEditorWithModes
                  key={editingMailTemplate?.id ?? 'new'}
                  value={form.values.content}
                  onChange={(value) => form.setFieldValue('content', value)}
                  placeholder="Contenu du modèle de courrier"
                  required
                />
              </Tabs.Panel>

              <Tabs.Panel value="order-preview" pt="md">
                {form.values.content ? (
                  <TemplatePreviewWithForm
                    templateContent={form.values.content}
                    variables={SAMPLE_ORDER_VARIABLES}
                    inputsMode="disabled"
                    resultLabel="Aperçu commande (données fictives)"
                    formRef={orderPreview.formRef}
                    onFormChange={orderPreview.setFormContent}
                    resultContent={orderPreview.resultContent}
                    onResultChange={orderPreview.setEditedContent}
                    isManuallyEdited={orderPreview.isManuallyEdited}
                    onRegenerate={orderPreview.handleRegenerate}
                  />
                ) : (
                  <Center py="xl" c="dimmed">
                    Renseignez le contenu du modèle pour voir l&apos;aperçu commande.
                  </Center>
                )}
              </Tabs.Panel>
            </Tabs>

            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                color="slate"
                onClick={() => {
                  onClose();
                  form.reset();
                }}
              >
                Annuler
              </Button>
              <Button type="submit" loading={isPending}>
                {editingMailTemplate ? 'Modifier' : 'Créer'}
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
