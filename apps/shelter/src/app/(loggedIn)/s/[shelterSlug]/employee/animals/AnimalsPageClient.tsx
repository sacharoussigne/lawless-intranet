'use client';

import { useEffect, useMemo, useState, useTransition, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Button,
  Container,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import {
  createAnimal,
  listCaseManagerOptions,
  listSpeciesOptions,
} from '@/app/_actions/animals';
import { ActiveFilters } from '@/app/_components/ActiveFilters/ActiveFilters';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { RpDateInput } from '@/app/_components/RpDateInput/RpDateInput';
import { usePermissions, useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import { ANIMAL_STATUS_LABELS } from '@/lib/animals/labels';
import { AdoptionPriceHint } from './AdoptionPriceHint';
import { AnimalsTable } from './AnimalsTable';
import {
  actionErrorMessage,
  toIsoDateOnly,
  type AnimalDTO,
  type CaseManagerOptionDTO,
  type SpeciesOptionDTO,
} from './types';

function CreateAnimalForm({
  shelterSlug,
  onSuccess,
  onCancel,
}: {
  shelterSlug: string;
  onSuccess: (animal: AnimalDTO) => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [speciesOptions, setSpeciesOptions] = useState<SpeciesOptionDTO[]>([]);
  const [managers, setManagers] = useState<CaseManagerOptionDTO[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [name, setName] = useState('');
  const [speciesId, setSpeciesId] = useState<string | null>(null);
  const [breedId, setBreedId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [arrivalDate, setArrivalDate] = useState<Date | null>(new Date());
  const [adoptionPrice, setAdoptionPrice] = useState<number | string>('');
  const [caseManagerUserId, setCaseManagerUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingOptions(true);
      try {
        const [speciesRes, managersRes] = await Promise.all([
          listSpeciesOptions(shelterSlug),
          listCaseManagerOptions(shelterSlug),
        ]);
        if (cancelled) return;
        if (speciesRes.status < 400 && 'data' in speciesRes && speciesRes.data) {
          setSpeciesOptions(speciesRes.data);
        }
        if (managersRes.status < 400 && 'data' in managersRes && managersRes.data) {
          setManagers(managersRes.data);
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shelterSlug]);

  const breeds = useMemo(() => {
    return speciesOptions.find((s) => s.id === speciesId)?.breeds ?? [];
  }, [speciesOptions, speciesId]);

  const selectedBreed = useMemo(
    () => breeds.find((b) => b.id === breedId) ?? null,
    [breeds, breedId],
  );

  const variants = selectedBreed?.variants ?? [];

  const handleSpeciesChange = (value: string | null) => {
    setSpeciesId(value);
    setBreedId(null);
    setVariantId(null);
    setAdoptionPrice('');
  };

  const handleBreedChange = (value: string | null) => {
    setBreedId(value);
    setVariantId(null);
    const breed = breeds.find((b) => b.id === value);
    if (breed?.shelterPurchasePrice != null) {
      setAdoptionPrice(breed.shelterPurchasePrice + 5);
    } else {
      setAdoptionPrice('');
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      notifications.show({ title: 'Erreur', message: 'Le nom est requis', color: 'danger' });
      return;
    }
    if (!speciesId || !breedId || !arrivalDate || !caseManagerUserId) {
      notifications.show({
        title: 'Erreur',
        message: 'Veuillez renseigner tous les champs obligatoires',
        color: 'danger',
      });
      return;
    }
    const price =
      typeof adoptionPrice === 'number' ? adoptionPrice : Number(String(adoptionPrice).replace(',', '.'));
    if (!Number.isFinite(price)) {
      notifications.show({ title: 'Erreur', message: 'Prix d’adoption invalide', color: 'danger' });
      return;
    }

    startTransition(async () => {
      const result = await createAnimal(shelterSlug, {
        name: name.trim(),
        speciesId,
        breedId,
        variantId,
        arrivalDate: toIsoDateOnly(arrivalDate),
        adoptionPrice: price,
        caseManagerUserId,
      });
      if (result.status >= 400 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Impossible de créer l’animal'),
          color: 'danger',
        });
        return;
      }
      notifications.show({
        title: 'Animal créé',
        message: result.data.name,
        color: 'terracotta',
      });
      onSuccess(result.data as AnimalDTO);
    });
  };

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <TextInput
          label="Nom"
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          disabled={pending || loadingOptions}
        />
        <RpDateInput
          label="Date d’arrivée"
          required
          value={arrivalDate}
          onChange={setArrivalDate}
          disabled={pending || loadingOptions}
        />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Select
          label="Espèce"
          required
          data={speciesOptions.map((s) => ({ value: s.id, label: s.name }))}
          value={speciesId}
          onChange={handleSpeciesChange}
          searchable
          disabled={pending || loadingOptions}
        />
        <Select
          label="Race"
          required
          data={breeds.map((b) => ({ value: b.id, label: b.name }))}
          value={breedId}
          onChange={handleBreedChange}
          searchable
          disabled={pending || loadingOptions || !speciesId}
        />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Select
          label="Variante"
          data={variants.map((v) => ({ value: v.id, label: v.label }))}
          value={variantId}
          onChange={setVariantId}
          clearable
          searchable
          disabled={pending || loadingOptions || !breedId || variants.length === 0}
          placeholder={variants.length === 0 ? 'Aucune variante' : undefined}
        />
        <div>
          <NumberInput
            label="Prix d’adoption ($)"
            required
            min={0}
            decimalScale={2}
            fixedDecimalScale
            value={adoptionPrice}
            onChange={setAdoptionPrice}
            disabled={pending || loadingOptions}
          />
          <AdoptionPriceHint
            adoptionPrice={
              typeof adoptionPrice === 'number'
                ? adoptionPrice
                : Number(String(adoptionPrice).replace(',', '.')) || null
            }
            animalierPurchasePrice={selectedBreed?.animalierPurchasePrice ?? null}
          />
        </div>
      </SimpleGrid>
      <Select
        label="Responsable"
        required
        data={managers.map((m) => ({ value: m.userId, label: m.name }))}
        value={caseManagerUserId}
        onChange={setCaseManagerUserId}
        searchable
        disabled={pending || loadingOptions}
      />
      <Group justify="flex-end" mt="sm" gap="sm">
        <Button
          variant="light"
          color="terracotta"
          onClick={onCancel}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button color="terracotta" loading={pending} onClick={handleSubmit}>
          Créer
        </Button>
      </Group>
    </Stack>
  );
}

export function AnimalsPageClient({
  shelterSlug,
  initialAnimals,
}: {
  shelterSlug: string;
  initialAnimals: AnimalDTO[];
}) {
  const router = useRouter();
  const t = useTenantRoutes();
  const { permissions } = usePermissions();
  const canCreate = Boolean(permissions?.animals.create);
  const [createOpen, setCreateOpen] = useState(false);
  const searchParams = useSearchParams();
  const initializedFromParams = useRef(false);

  const [nameFilter, setNameFilter] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
  const [breedFilter, setBreedFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [caseManagerFilter, setCaseManagerFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Read spotlight-driven query params once on mount
  useEffect(() => {
    if (initializedFromParams.current) return;
    initializedFromParams.current = true;
    const name = searchParams.get('name');
    const species = searchParams.get('species');
    const status = searchParams.get('status');
    if (name) setNameFilter(name);
    if (species) setSpeciesFilter(species);
    if (status) setStatusFilter(status);
  }, [searchParams]);
  const pageSize = 10;

  const speciesOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const animal of initialAnimals) {
      map.set(animal.speciesId, animal.species.name);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [initialAnimals]);

  const breedOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const animal of initialAnimals) {
      if (speciesFilter && animal.speciesId !== speciesFilter) continue;
      map.set(animal.breedId, animal.breed.name);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [initialAnimals, speciesFilter]);

  const caseManagerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const animal of initialAnimals) {
      map.set(animal.caseManagerUserId, animal.caseManagerName);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [initialAnimals]);

  const filteredAnimals = useMemo(() => {
    const needle = nameFilter.trim().toLowerCase();
    return initialAnimals.filter((animal) => {
      if (needle && !animal.name.toLowerCase().includes(needle)) return false;
      if (speciesFilter && animal.speciesId !== speciesFilter) return false;
      if (breedFilter && animal.breedId !== breedFilter) return false;
      if (statusFilter && animal.status !== statusFilter) return false;
      if (caseManagerFilter && animal.caseManagerUserId !== caseManagerFilter) return false;
      return true;
    });
  }, [
    initialAnimals,
    nameFilter,
    speciesFilter,
    breedFilter,
    statusFilter,
    caseManagerFilter,
  ]);

  const pagedAnimals = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAnimals.slice(start, start + pageSize);
  }, [filteredAnimals, page, pageSize]);

  const speciesLabel = speciesOptions.find((s) => s.value === speciesFilter)?.label;
  const breedLabel = breedOptions.find((b) => b.value === breedFilter)?.label;
  const caseManagerLabel = caseManagerOptions.find((m) => m.value === caseManagerFilter)?.label;
  const statusLabel =
    statusFilter && statusFilter in ANIMAL_STATUS_LABELS
      ? ANIMAL_STATUS_LABELS[statusFilter as keyof typeof ANIMAL_STATUS_LABELS]
      : undefined;

  return (
    <Container size="xl">
      <PageHeader title="Animaux" description="Suivi des animaux du refuge." />
      {canCreate ? (
        <Group justify="flex-end" mb="md">
          <Button
            color="terracotta"
            leftSection={<IconPlus size={18} />}
            onClick={() => setCreateOpen(true)}
          >
            Créer
          </Button>
        </Group>
      ) : null}

      {initialAnimals.length === 0 ? (
        <Text c="dimmed">Aucun animal pour le moment.</Text>
      ) : (
        <>
          <ActiveFilters
            filters={[
              {
                label: 'Nom',
                value: nameFilter,
                onRemove: () => {
                  setNameFilter('');
                  setPage(1);
                },
              },
              {
                label: 'Espèce',
                value: speciesFilter,
                displayValue: speciesLabel,
                onRemove: () => {
                  setSpeciesFilter(null);
                  setBreedFilter(null);
                  setPage(1);
                },
              },
              {
                label: 'Race',
                value: breedFilter,
                displayValue: breedLabel,
                onRemove: () => {
                  setBreedFilter(null);
                  setPage(1);
                },
              },
              {
                label: 'Statut',
                value: statusFilter,
                displayValue: statusLabel,
                onRemove: () => {
                  setStatusFilter(null);
                  setPage(1);
                },
              },
              {
                label: 'Responsable',
                value: caseManagerFilter,
                displayValue: caseManagerLabel,
                onRemove: () => {
                  setCaseManagerFilter(null);
                  setPage(1);
                },
              },
            ]}
          />
          <AnimalsTable
            animals={pagedAnimals}
            nameFilter={nameFilter}
            speciesFilter={speciesFilter}
            breedFilter={breedFilter}
            statusFilter={statusFilter}
            caseManagerFilter={caseManagerFilter}
            speciesOptions={speciesOptions}
            breedOptions={breedOptions}
            caseManagerOptions={caseManagerOptions}
            page={page}
            pageSize={pageSize}
            totalRecords={filteredAnimals.length}
            onNameFilterChange={(value) => {
              setNameFilter(value);
              setPage(1);
            }}
            onSpeciesFilterChange={(value) => {
              setSpeciesFilter(value);
              setBreedFilter(null);
              setPage(1);
            }}
            onBreedFilterChange={(value) => {
              setBreedFilter(value);
              setPage(1);
            }}
            onStatusFilterChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            onCaseManagerFilterChange={(value) => {
              setCaseManagerFilter(value);
              setPage(1);
            }}
            onPageChange={setPage}
            onRowClick={(animal) => router.push(t.employee.animal(animal.id))}
          />
        </>
      )}

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvel animal"
        size="xl"
      >
        <CreateAnimalForm
          shelterSlug={shelterSlug}
          onCancel={() => setCreateOpen(false)}
          onSuccess={(animal) => {
            setCreateOpen(false);
            router.push(t.employee.animal(animal.id));
          }}
        />
      </Modal>
    </Container>
  );
}
