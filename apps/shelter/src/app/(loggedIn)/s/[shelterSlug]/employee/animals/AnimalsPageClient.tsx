'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Button,
  Container,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
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
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { RpDateInput } from '@/app/_components/RpDateInput/RpDateInput';
import { usePermissions, useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import { ANIMAL_STATUS_LABELS } from '@/lib/animals/labels';
import { formatRpDate } from '@/lib/rpCalendar';
import { AdoptionPriceHint } from './AdoptionPriceHint';
import classes from './AnimalsPage.module.scss';
import {
  actionErrorMessage,
  parseIsoDateOnly,
  toIsoDateOnly,
  type AnimalDTO,
  type CaseManagerOptionDTO,
  type SpeciesOptionDTO,
} from './types';

function CreateAnimalForm({
  shelterSlug,
  onSuccess,
}: {
  shelterSlug: string;
  onSuccess: (animal: AnimalDTO) => void;
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
      <Group justify="flex-end" mt="sm">
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
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nom</Table.Th>
              <Table.Th>Espèce</Table.Th>
              <Table.Th>Race</Table.Th>
              <Table.Th>Statut</Table.Th>
              <Table.Th>Arrivée</Table.Th>
              <Table.Th>Responsable</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {initialAnimals.map((animal) => (
              <Table.Tr
                key={animal.id}
                className={classes.clickableRow}
                onClick={() => router.push(t.employee.animal(animal.id))}
              >
                <Table.Td>{animal.name}</Table.Td>
                <Table.Td>{animal.species.name}</Table.Td>
                <Table.Td>{animal.breed.name}</Table.Td>
                <Table.Td>{ANIMAL_STATUS_LABELS[animal.status]}</Table.Td>
                <Table.Td>
                  {formatRpDate(parseIsoDateOnly(animal.arrivalDate), 'dd/MM/yyyy')}
                </Table.Td>
                <Table.Td>{animal.caseManagerName}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvel animal"
        size="xl"
      >
        <CreateAnimalForm
          shelterSlug={shelterSlug}
          onSuccess={(animal) => {
            setCreateOpen(false);
            router.push(t.employee.animal(animal.id));
          }}
        />
      </Modal>
    </Container>
  );
}
