'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDebouncedValue } from '@mantine/hooks';
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
import { IconEye, IconPlus, IconSettings, IconTrash, IconUser } from '@tabler/icons-react';
import Link from 'next/link';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { DataTableEmptyState } from '@/app/_components/DataTableEmptyState/DataTableEmptyState';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { deleteCabinetPatient, listCabinetPatients } from '@/app/_actions/cabinet/patients';
import { handleAction } from '@/lib/action';
import {
  canOwnCabinet,
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
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const initialFetchSkipped = useRef(false);

  const isSearchDebouncing = searchInput !== debouncedSearch;

  const urlCabinetId = useMemo(() => {
    if (!cabinetIdFromUrl) return null;
    if (!cabinets.some((c) => c.id === cabinetIdFromUrl)) return null;
    return cabinetIdFromUrl;
  }, [cabinetIdFromUrl, cabinets]);

  const selectedCabinetId = urlCabinetId ?? initialCabinetId ?? cabinets[0]?.id ?? null;
  const selectedCabinet = cabinets.find((c) => c.id === selectedCabinetId) ?? null;
  const canWrite = canWriteCabinet(selectedCabinet?.accessLevel);
  const canConfigureForms =
    selectedCabinetId !== null &&
    (canOwnCabinet(selectedCabinet?.accessLevel) || isAdmin);

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
        search: debouncedSearch.trim() || undefined,
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
  }, [dispensarySlug, selectedCabinetId, debouncedSearch]);

  const handleDeletePatient = async (patient: CabinetPatientSummaryDTO) => {
    try {
      const result = await deleteCabinetPatient(dispensarySlug, patient.id);
      handleAction(result);
      notifications.show({ title: 'Patient supprimé', message: '', color: 'moss' });
      await loadPatients();
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec de la suppression',
        color: 'danger',
      });
    }
  };

  useEffect(() => {
    if (!selectedCabinetId) return;

    const skipInitialFetch =
      !initialFetchSkipped.current &&
      debouncedSearch === '' &&
      selectedCabinetId === initialCabinetId;

    if (skipInitialFetch) {
      initialFetchSkipped.current = true;
      return;
    }

    void loadPatients();
  }, [selectedCabinetId, debouncedSearch, initialCabinetId, loadPatients]);

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
            {canConfigureForms && (
              <Button
                component={Link}
                href={t.cabinet.forms(selectedCabinetId!)}
                variant="light"
                color="leather"
                leftSection={<IconSettings size={16} />}
              >
                Formulaires
              </Button>
            )}
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
          value={searchInput}
          onChange={(e) => setSearchInput(e.currentTarget.value)}
        />

        <DataTable
          withTableBorder
          borderRadius="sm"
          highlightOnHover
          fetching={loading || isSearchDebouncing}
          minHeight={patients.length === 0 ? 200 : undefined}
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
                <Group gap="xs" justify="flex-end">
                  <ActionIcon
                    component={Link}
                    href={`${t.cabinet.index}/patients/${p.id}?cabinetId=${selectedCabinetId}`}
                    variant="light"
                    color="slate"
                  >
                    <IconEye size={16} />
                  </ActionIcon>
                  {canWrite && (
                    <DeleteConfirmPopover
                      title="Supprimer le patient ?"
                      message={`« ${p.lastName} ${p.firstName} » et toutes ses données seront supprimées.`}
                      position="left"
                      onConfirm={() => handleDeletePatient(p)}
                    >
                      <ActionIcon
                        variant="light"
                        color="danger"
                        aria-label={`Supprimer ${p.lastName} ${p.firstName}`}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </DeleteConfirmPopover>
                  )}
                </Group>
              ),
            },
          ]}
          emptyState={
            <DataTableEmptyState
              icon={IconUser}
              message={
                canWrite
                  ? 'Aucun patient. Créez-en un pour commencer.'
                  : 'Aucun patient.'
              }
            />
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
