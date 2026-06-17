'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ActionIcon,
  Button,
  Container,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconEye, IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { listCabinetPatients } from '@/app/_actions/cabinet/patients';
import { handleAction } from '@/lib/action';
import {
  canWriteCabinet,
  type CabinetPatientSummaryDTO,
  type CabinetSummaryDTO,
} from '@/types/cabinet';
import { tenantRoutes } from '@/types/routes';
import { computeRpAge, formatRpDate } from '@/lib/rpCalendar';
import { CabinetSelector } from './components/CabinetSelector';
import { PatientFormModal } from './components/PatientFormModal';

interface CabinetPageClientProps {
  dispensarySlug: string;
  cabinets: CabinetSummaryDTO[];
  initialCabinetId: string | null;
  initialPatients: CabinetPatientSummaryDTO[];
  isAdmin: boolean;
}

export function CabinetPageClient({
  dispensarySlug,
  cabinets: initialCabinets,
  initialCabinetId,
  initialPatients,
  isAdmin,
}: CabinetPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cabinetIdFromUrl = searchParams.get('cabinetId');

  const [cabinets] = useState(initialCabinets);
  const [patients, setPatients] = useState(initialPatients);
  const [search, setSearch] = useState('');
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const urlCabinetId = useMemo(() => {
    if (!cabinetIdFromUrl) return null;
    if (!cabinets.some((c) => c.id === cabinetIdFromUrl)) return null;
    return cabinetIdFromUrl;
  }, [cabinetIdFromUrl, cabinets]);

  const selectedCabinetId = urlCabinetId ?? initialCabinetId ?? cabinets[0]?.id ?? null;
  const selectedCabinet = cabinets.find((c) => c.id === selectedCabinetId) ?? null;
  const canWrite = canWriteCabinet(selectedCabinet?.accessLevel);

  const setCabinetInUrl = useCallback(
    (cabinetId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('cabinetId', cabinetId);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const loadPatients = useCallback(async () => {
    if (!selectedCabinetId) return;
    setLoading(true);
    try {
      const result = await listCabinetPatients(dispensarySlug, {
        cabinetId: selectedCabinetId,
        search: search.trim() || undefined,
      });
      const data = handleAction(result);
      if (data) setPatients(data);
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Chargement impossible',
        color: 'danger',
      });
    } finally {
      setLoading(false);
    }
  }, [dispensarySlug, selectedCabinetId, search]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  const t = tenantRoutes(dispensarySlug);

  if (cabinets.length === 0) {
    return (
      <Container size="xl" py="xl">
        <PageHeader
          title="Cabinet"
          description="Dossiers patients des cabinets médicaux."
          backHref={t.employee.index}
        />
        <Text c="dimmed">Aucun cabinet accessible. Contactez un administrateur.</Text>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Cabinet"
        description="Gérez les dossiers patients de votre cabinet médical."
        backHref={t.employee.index}
        actions={
          <Group>
            <CabinetSelector
              cabinets={cabinets}
              value={selectedCabinetId}
              onChange={setCabinetInUrl}
            />
            {canWrite && selectedCabinetId && (
              <Button
                color="sage"
                leftSection={<IconPlus size={16} />}
                onClick={() => setPatientModalOpen(true)}
              >
                Nouveau patient
              </Button>
            )}
          </Group>
        }
      />

      <Stack gap="md">
        <TextInput
          placeholder="Rechercher par nom…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />

        <DataTable
          withTableBorder
          borderRadius="sm"
          highlightOnHover
          fetching={loading}
          records={patients}
          columns={[
            {
              accessor: 'lastName',
              title: 'Nom',
              render: (p) => `${p.lastName} ${p.firstName}`,
            },
            {
              accessor: 'birthDate',
              title: 'Naissance',
              render: (p) => formatRpDate(p.birthDate),
            },
            {
              accessor: 'age',
              title: 'Âge',
              render: (p) => {
                const age = computeRpAge(p.birthDate);
                return age !== null ? `${age} ans` : '—';
              },
            },
            {
              accessor: 'careEpisodeCount',
              title: 'Prises en charge',
            },
            {
              accessor: 'actions',
              title: '',
              textAlign: 'right',
              render: (p) => (
                <ActionIcon
                  component={Link}
                  href={`${t.cabinet.index}/patients/${p.id}?cabinetId=${selectedCabinetId}`}
                  variant="light"
                  color="slate"
                >
                  <IconEye size={16} />
                </ActionIcon>
              ),
            },
          ]}
          emptyState={
            <Stack align="center" py="xl">
              <Text c="dimmed">Aucun patient. Créez-en un pour commencer.</Text>
            </Stack>
          }
        />
      </Stack>

      {selectedCabinetId && (
        <PatientFormModal
          opened={patientModalOpen}
          onClose={() => setPatientModalOpen(false)}
          dispensarySlug={dispensarySlug}
          cabinetId={selectedCabinetId}
          patient={null}
          formSchemas={null}
          onSuccess={loadPatients}
        />
      )}
    </Container>
  );
}
