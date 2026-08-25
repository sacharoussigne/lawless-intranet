'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Button,
  Container,
  Grid,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { DataTable, type DataTableSortStatus } from 'mantine-datatable';
import {
  IconArrowLeft,
  IconCheck,
  IconClipboardList,
  IconEye,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { realtimeMutationMeta } from '@lawless-intranet/realtime';
import { useOptionalRealtimeClientId } from '@lawless-intranet/realtime/client';
import { ActiveFilters } from '@/app/_components/ActiveFilters/ActiveFilters';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { RpDateInput } from '@/app/_components/RpDateInput/RpDateInput';
import {
  createAnimalWaitRequest,
  deleteAnimalWaitRequest,
  listAnimalWaitRequests,
  listAnimalsForWaitlistLink,
  setAnimalWaitRequestStatus,
  updateAnimalWaitRequest,
} from '@/app/_actions/animalWaitRequests';
import { handleAction } from '@/lib/action';
import { formatRpDate } from '@/lib/rpCalendar';
import { notifyWaitlistLocalRefresh } from '@/lib/realtime/waitlist/localRefresh';
import { useWaitlistRealtime } from '@/lib/realtime/waitlist/useWaitlistRealtime';
import { useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import { parseIsoDateOnly } from '@/app/(loggedIn)/s/[shelterSlug]/employee/animals/types';
import {
  ANIMAL_WAIT_REQUEST_STATUS_LABELS,
  type AnimalWaitRequestListItem,
  type AnimalWaitRequestStatus,
} from '@/types/animalWaitRequests';

type SpeciesOption = {
  id: string;
  name: string;
  breeds: Array<{ id: string; name: string }>;
};

type WaitlistPageClientProps = {
  shelterSlug: string;
  initialRequests: AnimalWaitRequestListItem[];
  speciesOptions: SpeciesOption[];
};

type RequestFormValues = {
  requestedAt: Date | null;
  requesterName: string;
  speciesId: string | null;
  breedId: string | null;
  comment: string;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('fr');
}

const COMMENT_PREVIEW_MAX = 80;

function truncateComment(comment: string): string {
  if (comment.length <= COMMENT_PREVIEW_MAX) return comment;
  return `${comment.slice(0, COMMENT_PREVIEW_MAX)}…`;
}

function compareRequests(
  a: AnimalWaitRequestListItem,
  b: AnimalWaitRequestListItem,
  columnAccessor: string,
  direction: 'asc' | 'desc',
) {
  const factor = direction === 'asc' ? 1 : -1;
  const left =
    columnAccessor === 'requesterName'
      ? a.requesterName
      : columnAccessor === 'speciesName'
        ? a.speciesName
        : columnAccessor === 'breedName'
          ? (a.breedName ?? '')
          : columnAccessor === 'status'
            ? a.status
            : a.requestedAt;
  const right =
    columnAccessor === 'requesterName'
      ? b.requesterName
      : columnAccessor === 'speciesName'
        ? b.speciesName
        : columnAccessor === 'breedName'
          ? (b.breedName ?? '')
          : columnAccessor === 'status'
            ? b.status
            : b.requestedAt;
  return left.localeCompare(right, 'fr', { sensitivity: 'base' }) * factor;
}

export function WaitlistPageClient({
  shelterSlug,
  initialRequests,
  speciesOptions,
}: WaitlistPageClientProps) {
  const router = useRouter();
  const t = useTenantRoutes();
  const realtimeClientId = useOptionalRealtimeClientId();
  const mutationMeta = realtimeMutationMeta(realtimeClientId);
  const [requests, setRequests] = useState(initialRequests);
  const [statusFilter, setStatusFilter] = useState<string | null>('open');
  const [requesterFilter, setRequesterFilter] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
  const [sortStatus, setSortStatus] = useState<
    DataTableSortStatus<AnimalWaitRequestListItem>
  >({
    columnAccessor: 'requestedAt',
    direction: 'asc',
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AnimalWaitRequestListItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [fulfillOpen, setFulfillOpen] = useState(false);
  const [fulfilling, setFulfilling] = useState<AnimalWaitRequestListItem | null>(null);
  const [animalOptions, setAnimalOptions] = useState<Array<{ value: string; label: string }>>(
    [],
  );
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const [loadingAnimals, setLoadingAnimals] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewingDetail, setViewingDetail] = useState<AnimalWaitRequestListItem | null>(null);

  const refreshRequests = useCallback(async () => {
    const result = await listAnimalWaitRequests(shelterSlug);
    if (result.status === 200 && 'data' in result && result.data) {
      setRequests(result.data);
    }
  }, [shelterSlug]);

  useWaitlistRealtime({
    enabled: true,
    onChange: () => {
      void refreshRequests();
    },
  });

  const form = useForm<RequestFormValues>({
    initialValues: {
      requestedAt: new Date(),
      requesterName: '',
      speciesId: null,
      breedId: null,
      comment: '',
    },
    validate: {
      requestedAt: (value) => (value ? null : 'La date est requise'),
      requesterName: (value) =>
        value.trim().length === 0 ? 'Le demandeur est requis' : null,
      speciesId: (value) => (value ? null : 'L’espèce est requise'),
    },
  });

  const breedOptions = useMemo(() => {
    const species = speciesOptions.find((item) => item.id === form.values.speciesId);
    return (species?.breeds ?? []).map((breed) => ({
      value: breed.id,
      label: breed.name,
    }));
  }, [form.values.speciesId, speciesOptions]);

  const speciesSelectData = useMemo(
    () => speciesOptions.map((species) => ({ value: species.id, label: species.name })),
    [speciesOptions],
  );

  const filteredRequests = useMemo(() => {
    const requesterQuery = normalize(requesterFilter);
    return requests.filter((request) => {
      if (statusFilter && request.status !== statusFilter) return false;
      if (speciesFilter && request.speciesId !== speciesFilter) return false;
      if (requesterQuery && !normalize(request.requesterName).includes(requesterQuery)) {
        return false;
      }
      return true;
    });
  }, [requests, statusFilter, speciesFilter, requesterFilter]);

  const sortedRequests = useMemo(
    () =>
      [...filteredRequests].sort((a, b) =>
        compareRequests(a, b, String(sortStatus.columnAccessor), sortStatus.direction),
      ),
    [filteredRequests, sortStatus],
  );

  const openCreate = () => {
    setEditing(null);
    form.setValues({
      requestedAt: new Date(),
      requesterName: '',
      speciesId: null,
      breedId: null,
      comment: '',
    });
    form.clearErrors();
    setEditorOpen(true);
  };

  const openEdit = (request: AnimalWaitRequestListItem) => {
    setEditing(request);
    form.setValues({
      requestedAt: parseIsoDateOnly(request.requestedAt) ?? new Date(),
      requesterName: request.requesterName,
      speciesId: request.speciesId,
      breedId: request.breedId,
      comment: request.comment ?? '',
    });
    form.clearErrors();
    setEditorOpen(true);
  };

  const handleSubmit = async () => {
    const validation = form.validate();
    if (validation.hasErrors) return;
    if (!form.values.requestedAt || !form.values.speciesId) return;

    setSubmitting(true);
    try {
      const payload = {
        requestedAt: form.values.requestedAt,
        requesterName: form.values.requesterName.trim(),
        speciesId: form.values.speciesId,
        breedId: form.values.breedId,
        comment: form.values.comment.trim() || null,
        ...mutationMeta,
      };

      const result = editing
        ? await updateAnimalWaitRequest(shelterSlug, { id: editing.id, ...payload })
        : await createAnimalWaitRequest(shelterSlug, payload);
      const saved = handleAction(result) as AnimalWaitRequestListItem;

      setRequests((current) =>
        editing
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current],
      );
      notifyWaitlistLocalRefresh();
      notifications.show({
        title: editing ? 'Demande mise à jour' : 'Demande créée',
        message: '',
        color: 'teal',
      });
      setEditorOpen(false);
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec de l’enregistrement',
        color: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openFulfill = async (request: AnimalWaitRequestListItem) => {
    setFulfilling(request);
    setSelectedAnimalId(null);
    setFulfillOpen(true);
    setLoadingAnimals(true);
    try {
      const result = await listAnimalsForWaitlistLink(shelterSlug);
      if (result.status === 200 && 'data' in result && result.data) {
        setAnimalOptions(
          result.data.map((animal: { id: string; label: string }) => ({
            value: animal.id,
            label: animal.label,
          })),
        );
      } else {
        setAnimalOptions([]);
      }
    } finally {
      setLoadingAnimals(false);
    }
  };

  const handleSetStatus = async (
    request: AnimalWaitRequestListItem,
    status: AnimalWaitRequestStatus,
    fulfilledAnimalId?: string | null,
  ) => {
    try {
      const result = await setAnimalWaitRequestStatus(shelterSlug, {
        id: request.id,
        status,
        fulfilledAnimalId: status === 'fulfilled' ? (fulfilledAnimalId ?? null) : null,
        ...mutationMeta,
      });
      const updated = handleAction(result) as AnimalWaitRequestListItem;
      setRequests((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      notifyWaitlistLocalRefresh();
      notifications.show({
        title:
          status === 'fulfilled'
            ? 'Demande honorée'
            : status === 'cancelled'
              ? 'Demande annulée'
              : 'Demande rouverte',
        message: '',
        color: 'teal',
      });
      setFulfillOpen(false);
      setFulfilling(null);
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec du changement de statut',
        color: 'danger',
      });
    }
  };

  const handleDelete = async (request: AnimalWaitRequestListItem) => {
    try {
      const result = await deleteAnimalWaitRequest(shelterSlug, {
        id: request.id,
        ...mutationMeta,
      });
      handleAction(result);
      setRequests((current) => current.filter((item) => item.id !== request.id));
      notifyWaitlistLocalRefresh();
      notifications.show({
        title: 'Demande supprimée',
        message: '',
        color: 'teal',
      });
    } catch (error: unknown) {
      notifications.show({
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Échec de la suppression',
        color: 'danger',
      });
    }
  };

  return (
    <Container size="xl">
      <Group mb="md">
        <Button
          variant="subtle"
          color="terracotta"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push(t.employee.index)}
        >
          Retour
        </Button>
      </Group>

      <PageHeader
        title="File d’attente"
        description="Demandes d’animaux absents à faire arriver plus tard pour la cohérence RP."
      />

      <Stack gap="md">
        <Group justify="flex-end">
          <Button
            leftSection={<IconPlus size={16} />}
            color="terracotta"
            onClick={openCreate}
          >
            Nouvelle demande
          </Button>
        </Group>

        <ActiveFilters
          filters={[
            {
              label: 'Statut',
              value: statusFilter,
              displayValue: statusFilter
                ? ANIMAL_WAIT_REQUEST_STATUS_LABELS[statusFilter as AnimalWaitRequestStatus]
                : undefined,
              onRemove: () => setStatusFilter(null),
            },
            {
              label: 'Demandeur',
              value: requesterFilter,
              onRemove: () => setRequesterFilter(''),
            },
            {
              label: 'Espèce',
              value: speciesFilter,
              displayValue: speciesOptions.find((s) => s.id === speciesFilter)?.name,
              onRemove: () => setSpeciesFilter(null),
            },
          ]}
        />

        <Paper shadow="sm" p="md" withBorder>
          <DataTable
            highlightOnHover
            minHeight={sortedRequests.length === 0 ? 200 : undefined}
            records={sortedRequests}
            sortStatus={sortStatus}
            onSortStatusChange={setSortStatus}
            columns={[
              {
                accessor: 'requestedAt',
                title: 'Date',
                sortable: true,
                render: (request) =>
                  formatRpDate(parseIsoDateOnly(request.requestedAt), 'dd/MM/yyyy'),
              },
              {
                accessor: 'requesterName',
                title: 'Demandeur',
                sortable: true,
                filtering: requesterFilter.trim().length > 0,
                filter: (
                  <TextInput
                    placeholder="Rechercher un demandeur…"
                    value={requesterFilter}
                    onChange={(event) => setRequesterFilter(event.currentTarget.value)}
                    style={{ minWidth: 180 }}
                  />
                ),
              },
              {
                accessor: 'speciesName',
                title: 'Espèce',
                sortable: true,
                filtering: Boolean(speciesFilter),
                filter: (
                  <Select
                    placeholder="Toutes les espèces"
                    data={speciesSelectData}
                    value={speciesFilter}
                    onChange={setSpeciesFilter}
                    clearable
                    searchable
                    style={{ minWidth: 180 }}
                  />
                ),
              },
              {
                accessor: 'breedName',
                title: 'Race',
                sortable: true,
                render: (request) => request.breedName || '—',
              },
              {
                accessor: 'status',
                title: 'Statut',
                sortable: true,
                filtering: Boolean(statusFilter),
                render: (request) => (
                  <Stack gap={2}>
                    <Text size="sm">{ANIMAL_WAIT_REQUEST_STATUS_LABELS[request.status]}</Text>
                    {request.status === 'fulfilled' && request.fulfilledAnimalName ? (
                      <Text size="xs" c="dimmed">
                        → {request.fulfilledAnimalName}
                      </Text>
                    ) : null}
                  </Stack>
                ),
                filter: (
                  <Select
                    placeholder="Tous les statuts"
                    data={[
                      { value: 'open', label: 'Ouverte' },
                      { value: 'fulfilled', label: 'Honorée' },
                      { value: 'cancelled', label: 'Annulée' },
                    ]}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    clearable
                    style={{ minWidth: 160 }}
                  />
                ),
              },
              {
                accessor: 'comment',
                title: 'Commentaire',
                width: 220,
                render: (request) =>
                  request.comment ? (
                    <Text
                      size="sm"
                      title={request.comment}
                      style={{
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {truncateComment(request.comment)}
                    </Text>
                  ) : (
                    '—'
                  ),
              },
              {
                accessor: 'actions',
                title: '',
                textAlign: 'right',
                width: 240,
                cellsStyle: () => ({ paddingLeft: 24 }),
                render: (request) => (
                  <Group gap="xs" justify="flex-end" wrap="nowrap">
                    <ActionIcon
                      variant="light"
                      color="terracotta"
                      aria-label={`Voir ${request.requesterName}`}
                      onClick={() => {
                        setViewingDetail(request);
                        setDetailOpen(true);
                      }}
                    >
                      <IconEye size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="terracotta"
                      aria-label={`Modifier ${request.requesterName}`}
                      onClick={() => openEdit(request)}
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                    {request.status === 'open' ? (
                      <>
                        <ActionIcon
                          variant="light"
                          color="teal"
                          aria-label="Marquer comme honorée"
                          onClick={() => void openFulfill(request)}
                        >
                          <IconCheck size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color="gray"
                          aria-label="Annuler la demande"
                          onClick={() => void handleSetStatus(request, 'cancelled')}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </>
                    ) : (
                      <ActionIcon
                        variant="light"
                        color="terracotta"
                        aria-label="Rouvrir la demande"
                        onClick={() => void handleSetStatus(request, 'open')}
                      >
                        <IconClipboardList size={16} />
                      </ActionIcon>
                    )}
                    <DeleteConfirmPopover
                      title="Supprimer la demande ?"
                      message={`La demande de « ${request.requesterName} » sera supprimée.`}
                      onConfirm={() => handleDelete(request)}
                    >
                      <ActionIcon
                        variant="light"
                        color="danger"
                        aria-label={`Supprimer ${request.requesterName}`}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </DeleteConfirmPopover>
                  </Group>
                ),
              },
            ]}
            emptyState={
              <Stack align="center" gap="xs" py="xl">
                <IconClipboardList size={20} />
                <Text size="sm" c="dimmed">
                  {requests.length === 0
                    ? 'Aucune demande pour le moment.'
                    : 'Aucune demande ne correspond aux filtres.'}
                </Text>
              </Stack>
            }
          />
        </Paper>
      </Stack>

      <Modal
        opened={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? 'Modifier la demande' : 'Nouvelle demande'}
        size="lg"
      >
        <Stack gap="md">
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <RpDateInput
                label="Date de la demande"
                required
                value={form.values.requestedAt}
                onChange={(date) => form.setFieldValue('requestedAt', date)}
                error={form.errors.requestedAt}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Demandeur"
                required
                placeholder="Nom de la personne"
                {...form.getInputProps('requesterName')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Espèce"
                required
                searchable
                data={speciesSelectData}
                value={form.values.speciesId}
                onChange={(value) => {
                  form.setFieldValue('speciesId', value);
                  form.setFieldValue('breedId', null);
                }}
                error={form.errors.speciesId}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Race"
                searchable
                clearable
                data={breedOptions}
                value={form.values.breedId}
                onChange={(value) => form.setFieldValue('breedId', value)}
                disabled={!form.values.speciesId || breedOptions.length === 0}
                placeholder={
                  !form.values.speciesId
                    ? 'Choisir une espèce d’abord'
                    : breedOptions.length === 0
                      ? 'Aucune race'
                      : 'Optionnel'
                }
              />
            </Grid.Col>
          </Grid>
          <Textarea
            label="Commentaire"
            minRows={3}
            autosize
            {...form.getInputProps('comment')}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setEditorOpen(false)}>
              Annuler
            </Button>
            <Button color="terracotta" loading={submitting} onClick={() => void handleSubmit()}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={fulfillOpen}
        onClose={() => {
          setFulfillOpen(false);
          setFulfilling(null);
        }}
        title="Marquer comme honorée"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Lier optionnellement l’animal qui a été fait arriver pour cette demande.
          </Text>
          <Select
            label="Animal (optionnel)"
            placeholder={loadingAnimals ? 'Chargement…' : 'Choisir un animal'}
            data={animalOptions}
            value={selectedAnimalId}
            onChange={setSelectedAnimalId}
            searchable
            clearable
            disabled={loadingAnimals}
          />
          <Group justify="flex-end">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                setFulfillOpen(false);
                setFulfilling(null);
              }}
            >
              Annuler
            </Button>
            <Button
              color="terracotta"
              disabled={!fulfilling}
              onClick={() => {
                if (!fulfilling) return;
                void handleSetStatus(fulfilling, 'fulfilled', selectedAnimalId);
              }}
            >
              Confirmer
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setViewingDetail(null);
        }}
        title="Détail de la demande"
        size="lg"
      >
        {viewingDetail ? (
          <Stack gap="md">
            <TextInput
              label="Date"
              readOnly
              value={
                formatRpDate(parseIsoDateOnly(viewingDetail.requestedAt), 'dd/MM/yyyy') ?? '—'
              }
            />
            <TextInput label="Demandeur" readOnly value={viewingDetail.requesterName} />
            <TextInput label="Espèce" readOnly value={viewingDetail.speciesName} />
            <TextInput label="Race" readOnly value={viewingDetail.breedName || '—'} />
            <TextInput
              label="Statut"
              readOnly
              value={ANIMAL_WAIT_REQUEST_STATUS_LABELS[viewingDetail.status]}
            />
            {viewingDetail.status === 'fulfilled' ? (
              <TextInput
                label="Animal honoré"
                readOnly
                value={viewingDetail.fulfilledAnimalName || '—'}
              />
            ) : null}
            <Textarea
              label="Commentaire"
              readOnly
              autosize
              minRows={3}
              value={viewingDetail.comment || '—'}
            />
            <Group justify="flex-end">
              <Button
                variant="subtle"
                color="gray"
                onClick={() => {
                  setDetailOpen(false);
                  setViewingDetail(null);
                }}
              >
                Fermer
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </Container>
  );
}
