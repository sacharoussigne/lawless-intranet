'use client';

import { Alert, Button, Center, CopyButton, Loader, Stack, Text, Textarea } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { useRequiredBusinessSlug, useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { payrollKeys } from '@/lib/payroll/queryKeys';

type PayrollLetter = { content: string; templateName: string };

/** City hall letter of the report, rendered from its saved lines. */
export function PayrollLetterModal({
  reportId,
  opened,
  hasUnsavedChanges,
  onClose,
}: {
  reportId: string;
  opened: boolean;
  hasUnsavedChanges: boolean;
  onClose: () => void;
}) {
  const businessSlug = useRequiredBusinessSlug();
  const routes = useTenantRoutes();
  const { data, error, isPending } = useQuery({
    queryKey: payrollKeys.letter(businessSlug, reportId),
    queryFn: async () =>
      handleAction(await fetchRead(businessSlug, 'payrollLetter', { reportId })) as PayrollLetter,
    enabled: opened,
    retry: false,
  });

  return (
    <AppModal opened={opened} onClose={onClose} title="Lettre à la mairie" size="lg">
      <Stack gap="md">
        {hasUnsavedChanges && (
          <Alert color="amber">
            La lettre reprend le rapport enregistré : sauvegardez vos modifications pour les y voir.
          </Alert>
        )}
        {isPending ? (
          <Center py="xl">
            <Loader color="sage" />
          </Center>
        ) : error ? (
          <Alert color="danger">
            <Stack gap="xs">
              <Text size="sm">{error.message}</Text>
              <Button component={Link} href={`${routes.admin.settings}?tab=salaries`} variant="light" size="xs" w="fit-content">
                Rédiger la lettre
              </Button>
            </Stack>
          </Alert>
        ) : (
          data && <Textarea value={data.content} readOnly autosize minRows={8} maxRows={24} />
        )}
        <AppModalFooter>
          <Button variant="subtle" color="slate" onClick={onClose}>
            Fermer
          </Button>
          {data && (
            <CopyButton value={data.content} timeout={1500}>
              {({ copied, copy }) => (
                <Button
                  onClick={copy}
                  leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  color={copied ? 'moss' : 'sage'}
                >
                  {copied ? 'Copiée' : 'Copier la lettre'}
                </Button>
              )}
            </CopyButton>
          )}
        </AppModalFooter>
      </Stack>
    </AppModal>
  );
}
