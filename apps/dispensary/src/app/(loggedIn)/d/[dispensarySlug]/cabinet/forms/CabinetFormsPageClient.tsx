'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Container, Group, Stack, Tabs, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import type { CabinetFormSchemas, FormEntityType } from '@/lib/cabinet/formSchema';
import type { CabinetSummaryDTO } from '@/types/cabinet';
import { tenantRoutes } from '@/types/routes';
import { CabinetSelector } from '../components/CabinetSelector';
import { FormSchemaEditorPanel } from '../components/FormSchemaEditorPanel';
import { getFormEntityTabLabel } from '../components/CabinetFormSystemFieldsPreview';

const FORM_TABS: FormEntityType[] = ['patient', 'careEpisode', 'consultation'];

function parseTab(value: string | null): FormEntityType {
  if (value === 'careEpisode' || value === 'consultation') return value;
  return 'patient';
}

interface CabinetFormsPageClientProps {
  dispensarySlug: string;
  cabinets: CabinetSummaryDTO[];
  cabinetId: string;
  cabinetName: string;
  initialFormSchemas: CabinetFormSchemas;
  initialTab: FormEntityType;
}

export function CabinetFormsPageClient({
  dispensarySlug,
  cabinets,
  cabinetId: initialCabinetId,
  cabinetName: initialCabinetName,
  initialFormSchemas,
  initialTab,
}: CabinetFormsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [formSchemas, setFormSchemas] = useState(initialFormSchemas);
  const [activeTab, setActiveTab] = useState<FormEntityType>(initialTab);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    setFormSchemas(initialFormSchemas);
    setActiveTab(initialTab);
    isDirtyRef.current = false;
  }, [initialFormSchemas, initialCabinetId, initialTab]);

  const cabinetIdFromUrl = searchParams.get('cabinetId');
  const selectedCabinetId = useMemo(() => {
    if (cabinetIdFromUrl && cabinets.some((c) => c.id === cabinetIdFromUrl)) {
      return cabinetIdFromUrl;
    }
    return initialCabinetId;
  }, [cabinetIdFromUrl, cabinets, initialCabinetId]);

  const selectedCabinet = cabinets.find((c) => c.id === selectedCabinetId);
  const cabinetName = selectedCabinet?.name ?? initialCabinetName;

  const t = tenantRoutes(dispensarySlug);

  const updateUrl = useCallback(
    (nextCabinetId: string, nextTab: FormEntityType) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('cabinetId', nextCabinetId);
      params.set('tab', nextTab);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const confirmDiscardIfDirty = useCallback((onConfirm: () => void) => {
    if (!isDirtyRef.current) {
      onConfirm();
      return;
    }

    modals.openConfirmModal({
      title: 'Modifications non enregistrées',
      children: (
        <Text size="sm">
          Des modifications n&apos;ont pas été enregistrées. Voulez-vous les abandonner ?
        </Text>
      ),
      labels: { confirm: 'Abandonner', cancel: 'Continuer l\'édition' },
      confirmProps: { color: 'danger' },
      onConfirm,
    });
  }, []);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty;
  }, []);

  const handleTabChange = useCallback(
    (value: string | null) => {
      if (!value) return;
      const nextTab = parseTab(value);
      if (nextTab === activeTab) return;

      confirmDiscardIfDirty(() => {
        isDirtyRef.current = false;
        setActiveTab(nextTab);
        updateUrl(selectedCabinetId, nextTab);
      });
    },
    [activeTab, confirmDiscardIfDirty, selectedCabinetId, updateUrl],
  );

  const handleCabinetChange = useCallback(
    (nextCabinetId: string) => {
      if (nextCabinetId === selectedCabinetId) return;

      confirmDiscardIfDirty(() => {
        isDirtyRef.current = false;
        updateUrl(nextCabinetId, activeTab);
      });
    },
    [activeTab, confirmDiscardIfDirty, selectedCabinetId, updateUrl],
  );

  const handleSchemasSaved = useCallback((schemas: CabinetFormSchemas) => {
    setFormSchemas(schemas);
    isDirtyRef.current = false;
  }, []);

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Formulaires"
        description={`Configuration des champs personnalisés — ${cabinetName}`}
        backHref={`${t.cabinet.index}?cabinetId=${selectedCabinetId}`}
        actions={
          cabinets.length > 1 ? (
            <CabinetSelector
              cabinets={cabinets}
              value={selectedCabinetId}
              onChange={handleCabinetChange}
            />
          ) : undefined
        }
      />

      <Stack gap="xl">
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tabs.List>
            {FORM_TABS.map((tab) => (
              <Tabs.Tab key={tab} value={tab}>
                {getFormEntityTabLabel(tab)}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {FORM_TABS.map((tab) => (
            <Tabs.Panel key={tab} value={tab} pt="md">
              {activeTab === tab && (
                <FormSchemaEditorPanel
                  key={`${selectedCabinetId}-${tab}`}
                  dispensarySlug={dispensarySlug}
                  cabinetId={selectedCabinetId}
                  entityType={tab}
                  formSchemas={formSchemas}
                  onSchemasSaved={handleSchemasSaved}
                  onDirtyChange={handleDirtyChange}
                />
              )}
            </Tabs.Panel>
          ))}
        </Tabs>
      </Stack>
    </Container>
  );
}
