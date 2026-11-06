'use client';

import { useMemo, useState } from 'react';
import { Button, Card, Center, Group, Loader, Stack, Tabs, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconMail } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TemplateEditorWithModes,
  TemplatePreviewWithForm,
  useTemplatePreviewActions,
} from '@lawless-intranet/mail-template-ui';
import { savePayrollLetterTemplate, type PayrollLetterTemplate } from '@/app/_actions/payrollLetter';
import { handleAction } from '@/lib/action';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import { fetchRead } from '@/lib/read/fetchRead';
import { payrollKeys } from '@/lib/payroll/queryKeys';
import {
  DEFAULT_PAYROLL_LETTER_CONTENT,
  payrollLetterVariableDescriptions,
  samplePayrollLetterVariables,
} from '@/lib/payroll/letter/variables';

/** City hall letter generated from each « Employés » payroll report (Paramètres › Salaires). */
export function PayrollLetterPanel({ businessSlug }: { businessSlug: string }) {
  const { data: template, isPending } = useQuery({
    queryKey: payrollKeys.letterTemplate(businessSlug),
    queryFn: async () =>
      handleAction(await fetchRead(businessSlug, 'payrollLetterTemplate')) as PayrollLetterTemplate,
  });

  return (
    <Card withBorder shadow="sm" radius="md" padding="lg">
      <Stack gap="md">
        <Group gap="xs">
          <IconMail size={20} />
          <Title order={4}>Lettre à la mairie</Title>
        </Group>
        <Text size="sm" c="dimmed">
          Générée depuis chaque rapport « Employés » : la liste des employés de la semaine (registre
          de Gestion › Personnes), leur n° de compte, leurs présences et les totaux de soins. Tapez @
          pour insérer une variable.
        </Text>
        {isPending ? (
          <Center py="xl">
            <Loader color="sage" />
          </Center>
        ) : (
          <LetterEditor
            key={template?.id ?? 'new'}
            businessSlug={businessSlug}
            initialContent={template?.content ?? DEFAULT_PAYROLL_LETTER_CONTENT}
            isNew={!template}
          />
        )}
      </Stack>
    </Card>
  );
}

function LetterEditor({
  businessSlug,
  initialContent,
  isNew,
}: {
  businessSlug: string;
  initialContent: string;
  isNew: boolean;
}) {
  const [content, setContent] = useState(initialContent);
  const queryClient = useQueryClient();
  const { currentYear } = useRpCalendar();
  const variableDescriptions = useMemo(() => payrollLetterVariableDescriptions(currentYear), [currentYear]);
  const sampleVariables = useMemo(() => samplePayrollLetterVariables(currentYear), [currentYear]);
  const preview = useTemplatePreviewActions(content, sampleVariables, { inputsMode: 'disabled' });

  const save = useMutation({
    mutationFn: async () =>
      handleAction(await savePayrollLetterTemplate(businessSlug, { content })) as PayrollLetterTemplate,
    onSuccess: (saved) => {
      queryClient.setQueryData(payrollKeys.letterTemplate(businessSlug), saved);
      void queryClient.invalidateQueries({ queryKey: payrollKeys.all(businessSlug) });
      notifications.show({ title: 'Lettre enregistrée', message: '', color: 'moss' });
    },
    onError: (error: Error) =>
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de l’enregistrement',
        color: 'danger',
      }),
  });

  return (
    <Stack gap="md">
      <Tabs defaultValue="editor">
        <Tabs.List>
          <Tabs.Tab value="editor">Éditeur</Tabs.Tab>
          <Tabs.Tab value="preview">Aperçu (données fictives)</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="editor" pt="md">
          <TemplateEditorWithModes
            value={content}
            onChange={setContent}
            variables={variableDescriptions}
            showParametersPanel={false}
            required
          />
        </Tabs.Panel>
        <Tabs.Panel value="preview" pt="md">
          <TemplatePreviewWithForm
            templateContent={content}
            variables={sampleVariables}
            inputsMode="disabled"
            resultLabel="Aperçu de la lettre"
            formRef={preview.formRef}
            onFormChange={preview.setFormContent}
            resultContent={preview.resultContent}
            onResultChange={preview.setEditedContent}
            isManuallyEdited={preview.isManuallyEdited}
            onRegenerate={preview.handleRegenerate}
          />
        </Tabs.Panel>
      </Tabs>
      <Group justify="flex-end">
        {isNew && (
          <Text size="xs" c="dimmed">
            Texte de départ : enregistrez-le pour activer la lettre.
          </Text>
        )}
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!content.trim()}>
          Enregistrer la lettre
        </Button>
      </Group>
    </Stack>
  );
}
