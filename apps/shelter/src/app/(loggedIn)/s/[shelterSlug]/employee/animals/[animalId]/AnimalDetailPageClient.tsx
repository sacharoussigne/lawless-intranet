'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import {
  Badge,
  Button,
  Container,
  Grid,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconCheck,
  IconHistory,
  IconPencil,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import {
  deleteAnimal,
  listAnimalHistory,
  listCaseManagerOptions,
  listSpeciesOptions,
  updateAnimal,
} from '@/app/_actions/animals';
import { RpDateInput } from '@/app/_components/RpDateInput/RpDateInput';
import { usePermissions, useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import { ANIMAL_STATUS_LABELS, ANIMAL_STATUS_OPTIONS } from '@/lib/animals/labels';
import { formatRpDate } from '@/lib/rpCalendar';
import type { AnimalStatus } from '@/generated/prisma/client';
import { AdoptionPriceHint } from '../AdoptionPriceHint';
import classes from '../AnimalsPage.module.scss';
import {
  actionErrorMessage,
  formatMoney,
  parseIsoDateOnly,
  toIsoDateOnly,
  type AnimalDTO,
  type AnimalHistoryDTO,
  type CaseManagerOptionDTO,
  type SpeciesOptionDTO,
} from '../types';
import { AnimalFollowUpsSection } from './AnimalFollowUpsSection';

const HISTORY_ACTION_LABELS: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom',
  speciesId: 'Espèce',
  breedId: 'Race',
  variantId: 'Variante',
  arrivalDate: 'Date d’arrivée',
  adoptionPrice: 'Prix d’adoption',
  caseManagerUserId: 'Responsable',
  status: 'Statut',
  biography: 'Biographie',
  careProvided: 'Soins prodigués',
  notes: 'Notes',
  adopterName: 'Adoptant',
  departureDate: 'Date de départ',
};

const STATUS_BADGE_COLORS: Record<
  AnimalStatus,
  { color: string; variant: 'light' | 'outline' | 'filled' }
> = {
  awaiting_adoption: { color: 'terracotta', variant: 'filled' },
  in_care: { color: 'leather', variant: 'filled' },
  adopted: { color: 'teal', variant: 'filled' },
  deceased: { color: 'gray', variant: 'filled' },
};

type FormState = {
  name: string;
  speciesId: string | null;
  breedId: string | null;
  variantId: string | null;
  arrivalDate: Date | null;
  adoptionPrice: number | string;
  caseManagerUserId: string | null;
  status: AnimalStatus;
  biography: string;
  careProvided: string;
  notes: string;
  adopterName: string;
  departureDate: Date | null;
};

function animalToForm(animal: AnimalDTO): FormState {
  return {
    name: animal.name,
    speciesId: animal.speciesId,
    breedId: animal.breedId,
    variantId: animal.variantId,
    arrivalDate: parseIsoDateOnly(animal.arrivalDate),
    adoptionPrice: animal.adoptionPrice,
    caseManagerUserId: animal.caseManagerUserId,
    status: animal.status,
    biography: animal.biography ?? '',
    careProvided: animal.careProvided ?? '',
    notes: animal.notes ?? '',
    adopterName: animal.adopterName ?? '',
    departureDate: parseIsoDateOnly(animal.departureDate),
  };
}

function FieldReadout({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={classes.readout}>
      <div className={classes.fieldLabel}>{label}</div>
      <Text>{value || '—'}</Text>
    </div>
  );
}

function formatHistoryValue(key: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (key === 'status' && typeof value === 'string' && value in ANIMAL_STATUS_LABELS) {
    return ANIMAL_STATUS_LABELS[value as AnimalStatus];
  }
  if (key === 'adoptionPrice' && typeof value === 'number') {
    return formatMoney(value);
  }
  if ((key === 'arrivalDate' || key === 'departureDate') && typeof value === 'string') {
    return formatRpDate(parseIsoDateOnly(value), 'dd/MM/yyyy');
  }
  return String(value);
}

function summarizeHistoryDiff(
  previousValues: unknown,
  nextValues: unknown,
): { label: string; before: string; after: string }[] {
  const prev =
    previousValues && typeof previousValues === 'object'
      ? (previousValues as Record<string, unknown>)
      : null;
  const next =
    nextValues && typeof nextValues === 'object'
      ? (nextValues as Record<string, unknown>)
      : null;

  if (!prev && next) {
    return Object.keys(next).map((key) => ({
      label: FIELD_LABELS[key] ?? key,
      before: '—',
      after: formatHistoryValue(key, next[key]),
    }));
  }
  if (prev && !next) {
    return Object.keys(prev).map((key) => ({
      label: FIELD_LABELS[key] ?? key,
      before: formatHistoryValue(key, prev[key]),
      after: '—',
    }));
  }
  if (!prev || !next) return [];

  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const diffs: { label: string; before: string; after: string }[] = [];
  for (const key of keys) {
    const a = prev[key];
    const b = next[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    diffs.push({
      label: FIELD_LABELS[key] ?? key,
      before: formatHistoryValue(key, a),
      after: formatHistoryValue(key, b),
    });
  }
  return diffs;
}

export function AnimalDetailPageClient({
  shelterSlug,
  initialAnimal,
}: {
  shelterSlug: string;
  initialAnimal: AnimalDTO;
}) {
  const router = useRouter();
  const t = useTenantRoutes();
  const { permissions } = usePermissions();
  const canUpdate = Boolean(permissions?.animals.update);
  const canUpdateCore = Boolean(permissions?.animals.updateCore);
  const canDelete = Boolean(permissions?.animals.delete);
  const canEdit = canUpdate || canUpdateCore;

  const [animal, setAnimal] = useState(initialAnimal);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => animalToForm(initialAnimal));
  const [pending, startTransition] = useTransition();

  const [speciesOptions, setSpeciesOptions] = useState<SpeciesOptionDTO[]>([]);
  const [managers, setManagers] = useState<CaseManagerOptionDTO[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<AnimalHistoryDTO[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadOptions = useCallback(async () => {
    if (optionsLoaded) return;
    const [speciesRes, managersRes] = await Promise.all([
      listSpeciesOptions(shelterSlug),
      listCaseManagerOptions(shelterSlug),
    ]);
    if (speciesRes.status < 400 && 'data' in speciesRes && speciesRes.data) {
      setSpeciesOptions(speciesRes.data);
    }
    if (managersRes.status < 400 && 'data' in managersRes && managersRes.data) {
      setManagers(managersRes.data);
    }
    setOptionsLoaded(true);
  }, [optionsLoaded, shelterSlug]);

  useEffect(() => {
    if (editing) void loadOptions();
  }, [editing, loadOptions]);

  const breeds = useMemo(() => {
    return speciesOptions.find((s) => s.id === form.speciesId)?.breeds ?? [];
  }, [speciesOptions, form.speciesId]);

  const selectedBreed = useMemo(() => {
    if (editing && breeds.length > 0) {
      return breeds.find((b) => b.id === form.breedId) ?? null;
    }
    return animal.breed;
  }, [editing, breeds, form.breedId, animal.breed]);

  const breedVariants = useMemo(() => {
    if (selectedBreed && 'variants' in selectedBreed) {
      return (selectedBreed as SpeciesOptionDTO['breeds'][number]).variants;
    }
    return [] as { id: string; label: string }[];
  }, [selectedBreed]);

  const startEditing = () => {
    setForm(animalToForm(animal));
    setEditing(true);
  };

  const cancelEditing = () => {
    setForm(animalToForm(animal));
    setEditing(false);
  };

  const patchForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSpeciesChange = (value: string | null) => {
    setForm((prev) => ({
      ...prev,
      speciesId: value,
      breedId: null,
      variantId: null,
    }));
  };

  const handleBreedChange = (value: string | null) => {
    const breed = breeds.find((b) => b.id === value);
    setForm((prev) => ({
      ...prev,
      breedId: value,
      variantId: null,
      adoptionPrice:
        breed?.shelterPurchasePrice != null
          ? breed.shelterPurchasePrice + 5
          : prev.adoptionPrice,
    }));
  };

  const handleSave = () => {
    if (canUpdateCore) {
      if (!form.name.trim() || !form.speciesId || !form.breedId || !form.arrivalDate || !form.caseManagerUserId) {
        notifications.show({
          title: 'Erreur',
          message: 'Veuillez renseigner tous les champs principaux obligatoires',
          color: 'danger',
        });
        return;
      }
    }

    startTransition(async () => {
      const payload: Parameters<typeof updateAnimal>[1] = { id: animal.id };

      if (canUpdateCore) {
        if (form.name.trim() !== animal.name) payload.name = form.name.trim();
        if (form.speciesId && form.speciesId !== animal.speciesId) {
          payload.speciesId = form.speciesId;
        }
        if (form.breedId && form.breedId !== animal.breedId) payload.breedId = form.breedId;
        const nextVariant = form.variantId || null;
        if (nextVariant !== animal.variantId) payload.variantId = nextVariant;
        const arrivalIso = form.arrivalDate ? toIsoDateOnly(form.arrivalDate) : null;
        if (arrivalIso && arrivalIso !== animal.arrivalDate) {
          payload.arrivalDate = arrivalIso;
        }
        const price =
          typeof form.adoptionPrice === 'number'
            ? form.adoptionPrice
            : Number(String(form.adoptionPrice).replace(',', '.'));
        if (Number.isFinite(price) && price !== animal.adoptionPrice) {
          payload.adoptionPrice = price;
        }
        if (form.caseManagerUserId && form.caseManagerUserId !== animal.caseManagerUserId) {
          payload.caseManagerUserId = form.caseManagerUserId;
        }
      }

      if (canUpdate) {
        if (form.status !== animal.status) payload.status = form.status;
        const bio = form.biography.trim() || null;
        if (bio !== animal.biography) payload.biography = bio;
        const care = form.careProvided.trim() || null;
        if (care !== animal.careProvided) payload.careProvided = care;
        const notes = form.notes.trim() || null;
        if (notes !== animal.notes) payload.notes = notes;
        const adopter = form.adopterName.trim() || null;
        if (adopter !== animal.adopterName) payload.adopterName = adopter;
        const departureIso = form.departureDate ? toIsoDateOnly(form.departureDate) : null;
        if (departureIso !== animal.departureDate) {
          payload.departureDate = departureIso;
        }
      }

      // If species/breed both need updating together when only one changed in cascade
      if (payload.speciesId || payload.breedId || payload.variantId !== undefined) {
        if (form.speciesId) payload.speciesId = form.speciesId;
        if (form.breedId) payload.breedId = form.breedId;
        payload.variantId = form.variantId || null;
      }

      const keys = Object.keys(payload).filter((k) => k !== 'id');
      if (keys.length === 0) {
        notifications.show({
          title: 'Aucune modification',
          message: 'Rien à enregistrer.',
          color: 'gray',
        });
        setEditing(false);
        return;
      }

      const result = await updateAnimal(shelterSlug, payload);
      if (result.status >= 400 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Impossible d’enregistrer'),
          color: 'danger',
        });
        return;
      }
      setAnimal(result.data as AnimalDTO);
      setForm(animalToForm(result.data as AnimalDTO));
      setEditing(false);
      notifications.show({
        title: 'Enregistré',
        message: result.data.name,
        color: 'terracotta',
      });
      router.refresh();
    });
  };

  const openHistory = () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    startTransition(async () => {
      const result = await listAnimalHistory(shelterSlug, animal.id);
      setHistoryLoading(false);
      if (result.status >= 400 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Impossible de charger l’historique'),
          color: 'danger',
        });
        return;
      }
      setHistory(result.data as AnimalHistoryDTO[]);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAnimal(shelterSlug, { id: animal.id });
      if (result.status >= 400) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Impossible de supprimer'),
          color: 'danger',
        });
        return;
      }
      notifications.show({
        title: 'Animal supprimé',
        message: animal.name,
        color: 'terracotta',
      });
      router.push(t.employee.animals);
      router.refresh();
    });
  };

  const adoptionPriceNumber =
    typeof form.adoptionPrice === 'number'
      ? form.adoptionPrice
      : Number(String(form.adoptionPrice).replace(',', '.'));

  const animalierPrice =
    selectedBreed && 'animalierPurchasePrice' in selectedBreed
      ? selectedBreed.animalierPurchasePrice
      : animal.breed.animalierPurchasePrice;

  const displayStatus = editing ? form.status : animal.status;

  return (
    <Container size="xl">
      <Group mb="md">
        <Button
          variant="subtle"
          color="terracotta"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push(t.employee.animals)}
        >
          Retour
        </Button>
      </Group>

      <div className={classes.detailHeader}>
        <div className={classes.titleBlock}>
          <div className={classes.titleRow}>
            {editing && canUpdateCore ? (
              <TextInput
                aria-label="Nom"
                required
                value={form.name}
                onChange={(e) => patchForm('name', e.currentTarget.value)}
                disabled={pending}
                size="lg"
                className={classes.titleInput}
              />
            ) : (
              <Title order={1} className="shelter-display-title">
                {animal.name}
              </Title>
            )}
            {editing && canUpdate ? (
              <Select
                aria-label="Statut"
                data={ANIMAL_STATUS_OPTIONS}
                value={form.status}
                onChange={(v) => v && patchForm('status', v as AnimalStatus)}
                disabled={pending}
                size="sm"
                w={220}
                allowDeselect={false}
              />
            ) : (
              <Badge
                size="lg"
                radius="sm"
                className={classes.statusBadge}
                color={STATUS_BADGE_COLORS[displayStatus].color}
                variant={STATUS_BADGE_COLORS[displayStatus].variant}
              >
                {ANIMAL_STATUS_LABELS[displayStatus]}
              </Badge>
            )}
          </div>
          <Text c="dimmed" size="sm" mt={4}>
            Fiche animal
          </Text>
        </div>

        <Group gap="sm" wrap="wrap" className={classes.headerActions}>
          <Button
            variant="light"
            color="terracotta"
            leftSection={<IconHistory size={16} />}
            onClick={openHistory}
          >
            Historique
          </Button>
          {!editing && canEdit ? (
            <Button
              color="terracotta"
              leftSection={<IconPencil size={16} />}
              onClick={startEditing}
            >
              Modifier
            </Button>
          ) : null}
          {editing ? (
            <>
              <Button
                variant="light"
                color="terracotta"
                leftSection={<IconX size={16} />}
                onClick={cancelEditing}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button
                color="terracotta"
                leftSection={<IconCheck size={16} />}
                loading={pending}
                onClick={handleSave}
              >
                Enregistrer
              </Button>
            </>
          ) : null}
          {canDelete && !editing ? (
            <Button
              color="danger"
              variant="light"
              leftSection={<IconTrash size={16} />}
              onClick={() => setDeleteOpen(true)}
            >
              Supprimer
            </Button>
          ) : null}
        </Group>
      </div>

      <Stack gap="xl" mt="xl">
        <section>
          <Text className={classes.sectionTitle}>Informations principales</Text>
          {editing && canUpdateCore ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              <Select
                label="Espèce"
                required
                data={speciesOptions.map((s) => ({ value: s.id, label: s.name }))}
                value={form.speciesId}
                onChange={handleSpeciesChange}
                searchable
                disabled={pending || !optionsLoaded}
              />
              <Select
                label="Race"
                required
                data={breeds.map((b) => ({ value: b.id, label: b.name }))}
                value={form.breedId}
                onChange={handleBreedChange}
                searchable
                disabled={pending || !optionsLoaded || !form.speciesId}
              />
              <Select
                label="Variante"
                data={breedVariants.map((v) => ({ value: v.id, label: v.label }))}
                value={form.variantId}
                onChange={(v) => patchForm('variantId', v)}
                clearable
                searchable
                disabled={pending || !optionsLoaded || !form.breedId}
              />
              <RpDateInput
                label="Date d’arrivée"
                required
                value={form.arrivalDate}
                onChange={(d) => patchForm('arrivalDate', d)}
                disabled={pending}
              />
              <div>
                <NumberInput
                  label="Prix d’adoption ($)"
                  required
                  min={0}
                  decimalScale={2}
                  fixedDecimalScale
                  value={form.adoptionPrice}
                  onChange={(v) => patchForm('adoptionPrice', v)}
                  disabled={pending}
                />
                <AdoptionPriceHint
                  adoptionPrice={Number.isFinite(adoptionPriceNumber) ? adoptionPriceNumber : null}
                  animalierPurchasePrice={animalierPrice}
                />
              </div>
              <Select
                label="Responsable"
                required
                data={managers.map((m) => ({ value: m.userId, label: m.name }))}
                value={form.caseManagerUserId}
                onChange={(v) => patchForm('caseManagerUserId', v)}
                searchable
                disabled={pending || !optionsLoaded}
              />
            </SimpleGrid>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              <FieldReadout label="Espèce" value={animal.species.name} />
              <FieldReadout label="Race" value={animal.breed.name} />
              <FieldReadout label="Variante" value={animal.variant?.label} />
              <FieldReadout
                label="Date d’arrivée"
                value={formatRpDate(parseIsoDateOnly(animal.arrivalDate), 'dd/MM/yyyy')}
              />
              <FieldReadout
                label="Prix d’adoption"
                value={
                  <>
                    {formatMoney(animal.adoptionPrice)}
                    <AdoptionPriceHint
                      adoptionPrice={animal.adoptionPrice}
                      animalierPurchasePrice={animal.breed.animalierPurchasePrice}
                    />
                  </>
                }
              />
              <FieldReadout label="Responsable" value={animal.caseManagerName} />
            </SimpleGrid>
          )}
        </section>

        <section>
          <Text className={classes.sectionTitle}>Informations complémentaires</Text>
          {editing && canUpdate ? (
            <Grid>
              <Grid.Col span={12}>
                <Textarea
                  label="Biographie"
                  minRows={3}
                  value={form.biography}
                  onChange={(e) => patchForm('biography', e.currentTarget.value)}
                  disabled={pending}
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Textarea
                  label="Soins prodigués"
                  minRows={3}
                  value={form.careProvided}
                  onChange={(e) => patchForm('careProvided', e.currentTarget.value)}
                  disabled={pending}
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <Textarea
                  label="Notes"
                  minRows={3}
                  value={form.notes}
                  onChange={(e) => patchForm('notes', e.currentTarget.value)}
                  disabled={pending}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Adoptant(s)"
                  value={form.adopterName}
                  onChange={(e) => patchForm('adopterName', e.currentTarget.value)}
                  disabled={pending}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <RpDateInput
                  label="Date de départ"
                  clearable
                  value={form.departureDate}
                  onChange={(d) => patchForm('departureDate', d)}
                  disabled={pending}
                />
              </Grid.Col>
            </Grid>
          ) : (
            <Grid>
              <Grid.Col span={12}>
                <FieldReadout label="Biographie" value={animal.biography} />
              </Grid.Col>
              <Grid.Col span={12}>
                <FieldReadout label="Soins prodigués" value={animal.careProvided} />
              </Grid.Col>
              <Grid.Col span={12}>
                <FieldReadout label="Notes" value={animal.notes} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <FieldReadout label="Adoptant(s)" value={animal.adopterName} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <FieldReadout
                  label="Date de départ"
                  value={
                    animal.departureDate
                      ? formatRpDate(parseIsoDateOnly(animal.departureDate), 'dd/MM/yyyy')
                      : null
                  }
                />
              </Grid.Col>
            </Grid>
          )}
        </section>

        <AnimalFollowUpsSection
          shelterSlug={shelterSlug}
          animalId={animal.id}
          defaultRecipientName={animal.adopterName}
          defaultConductedByUserId={animal.caseManagerUserId}
          canUpdate={canUpdate}
        />
      </Stack>

      {editing && canUpdateCore && !canUpdate ? (
        <Text size="sm" c="dimmed" mt="lg">
          Vous pouvez modifier les informations principales uniquement.
        </Text>
      ) : null}
      {editing && canUpdate && !canUpdateCore ? (
        <Text size="sm" c="dimmed" mt="lg">
          Les informations principales sont en lecture seule.
        </Text>
      ) : null}

      <Modal
        opened={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Historique"
        size="lg"
      >
        {historyLoading ? (
          <Text c="dimmed">Chargement…</Text>
        ) : history.length === 0 ? (
          <Text c="dimmed">Aucun événement.</Text>
        ) : (
          <Stack gap={0}>
            {history.map((entry) => {
              const diffs = summarizeHistoryDiff(entry.previousValues, entry.nextValues);
              return (
                <div key={entry.id} className={classes.historyEntry}>
                  <Group justify="space-between" wrap="wrap">
                    <Text fw={600}>{HISTORY_ACTION_LABELS[entry.action] ?? entry.action}</Text>
                    <Text size="sm" c="dimmed">
                      {formatRpDate(new Date(entry.createdAt), 'dd/MM/yyyy HH:mm')}
                    </Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {entry.actorName ?? 'Système'}
                  </Text>
                  {diffs.length > 0 ? (
                    <Stack gap={4} mt="xs">
                      {diffs.slice(0, 12).map((diff) => (
                        <Text key={diff.label} size="sm">
                          <Text span fw={500}>
                            {diff.label}
                          </Text>
                          {': '}
                          {diff.before} → {diff.after}
                        </Text>
                      ))}
                      {diffs.length > 12 ? (
                        <Text size="xs" c="dimmed">
                          +{diffs.length - 12} autre(s) champ(s)
                        </Text>
                      ) : null}
                    </Stack>
                  ) : null}
                </div>
              );
            })}
          </Stack>
        )}
      </Modal>

      <Modal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Supprimer l’animal"
      >
        <Text mb="md">
          Confirmer la suppression de <strong>{animal.name}</strong> ? Cette action est
          irréversible.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button color="danger" loading={pending} onClick={handleDelete}>
            Supprimer
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
