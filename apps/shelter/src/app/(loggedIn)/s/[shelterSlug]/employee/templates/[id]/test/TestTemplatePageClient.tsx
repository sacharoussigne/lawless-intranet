'use client';

import { useRouter } from 'next/navigation';
import {
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconRefresh,
} from '@tabler/icons-react';
import {
  TemplatePreviewWithForm,
  useTemplatePreviewActions,
} from '@lawless-intranet/mail-template-ui';
import { useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import type { AnimalDocumentTemplateListItem } from '@/types/animalDocuments';
import { SAMPLE_ANIMAL_TEMPLATE_VARIABLES } from '../../sampleAnimalTemplateVariables';

interface TestTemplatePageClientProps {
  template: AnimalDocumentTemplateListItem;
}

export default function TestTemplatePageClient({
  template,
}: TestTemplatePageClientProps) {
  const routes = useTenantRoutes();
  const router = useRouter();
  const preview = useTemplatePreviewActions(
    template.content,
    SAMPLE_ANIMAL_TEMPLATE_VARIABLES,
  );

  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Button
            variant="subtle"
            color="terracotta"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.push(routes.employee.templates)}
          >
            Retour
          </Button>
          <Group>
            {preview.hasInputs && (
              <Button
                variant="subtle"
                leftSection={<IconRefresh size={16} />}
                onClick={preview.resetTemplateForm}
              >
                Réinitialiser
              </Button>
            )}
            {preview.resultContent && (
              <Button
                leftSection={
                  preview.copied ? <IconCheck size={16} /> : <IconCopy size={16} />
                }
                onClick={() => preview.handleCopy()}
                variant={preview.copied ? 'light' : 'default'}
                color={preview.copied ? 'moss' : undefined}
              >
                {preview.copied ? 'Copié !' : 'Copier le document'}
              </Button>
            )}
          </Group>
        </Group>

        <Title order={1}>Modèle &quot;{template.name}&quot;</Title>

        {preview.hasInputs ? (
          <TemplatePreviewWithForm
            templateContent={template.content}
            variables={SAMPLE_ANIMAL_TEMPLATE_VARIABLES}
            resultLabel="Résultat"
            formRef={preview.formRef}
            onFormChange={preview.setFormContent}
            resultContent={preview.resultContent}
            onResultChange={preview.setEditedContent}
            isManuallyEdited={preview.isManuallyEdited}
            onRegenerate={preview.handleRegenerate}
          />
        ) : (
          <Stack gap="md">
            <Text size="sm" fw={600}>
              Résultat
            </Text>
            <Paper p="md" withBorder>
              <Textarea
                value={preview.resultContent}
                onChange={(e) => preview.setEditedContent(e.currentTarget.value)}
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
            <Group justify="flex-end">
              <Button
                variant="subtle"
                color="terracotta"
                onClick={() => router.push(routes.employee.templates)}
              >
                Fermer
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
