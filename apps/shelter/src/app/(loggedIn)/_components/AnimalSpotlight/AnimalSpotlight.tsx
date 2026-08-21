'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Loader, Modal, Text, TextInput } from '@mantine/core';
import { IconFilter, IconSearch } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import { ANIMAL_STATUS_LABELS } from '@/lib/animals/labels';
import type { AnimalDTO } from '@/app/(loggedIn)/s/[shelterSlug]/employee/animals/types';
import type { AnimalStatus } from '@/generated/prisma/client';
import classes from './AnimalSpotlight.module.scss';

type MatchKind = 'name' | 'species' | 'breed' | 'status';

type SpotlightAnimalItem = {
  type: 'animal';
  animal: AnimalDTO;
  kind: MatchKind;
};

type SpotlightFilterItem = {
  type: 'filter';
  filter: 'species' | 'breed' | 'status';
  label: string;
  speciesId?: string;
  value: string;
};

type SpotlightItem = SpotlightAnimalItem | SpotlightFilterItem;

const STATUS_COLORS: Record<AnimalStatus, string> = {
  in_care: 'sageDust',
  awaiting_adoption: 'sageDust',
  adopted: 'leather',
  deceased: 'danger',
};

const KIND_LABELS: Record<MatchKind, string> = {
  name: 'nom',
  species: 'espèce',
  breed: 'race',
  status: 'statut',
};

const FILTER_LABELS: Record<SpotlightFilterItem['filter'], string> = {
  species: 'espèce',
  breed: 'race',
  status: 'statut',
};

function getItems(animals: AnimalDTO[], query: string): SpotlightItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const items: SpotlightItem[] = [];
  const seenSpecies = new Set<string>();
  const seenBreeds = new Set<string>();
  const seenStatuses = new Set<string>();

  for (const animal of animals) {
    if (animal.species.name.toLowerCase().includes(q) && !seenSpecies.has(animal.speciesId)) {
      seenSpecies.add(animal.speciesId);
      items.push({
        type: 'filter',
        filter: 'species',
        label: animal.species.name,
        value: animal.speciesId,
      });
    }
  }

  for (const animal of animals) {
    if (animal.breed.name.toLowerCase().includes(q) && !seenBreeds.has(animal.breedId)) {
      seenBreeds.add(animal.breedId);
      items.push({
        type: 'filter',
        filter: 'breed',
        label: animal.breed.name,
        speciesId: animal.speciesId,
        value: animal.breedId,
      });
    }
  }

  for (const [status, label] of Object.entries(ANIMAL_STATUS_LABELS) as [AnimalStatus, string][]) {
    if (label.toLowerCase().includes(q) && !seenStatuses.has(status)) {
      seenStatuses.add(status);
      items.push({
        type: 'filter',
        filter: 'status',
        label,
        value: status,
      });
    }
  }

  const seenAnimals = new Set<string>();
  const animalItems: SpotlightAnimalItem[] = [];

  const pushAnimal = (animal: AnimalDTO, kind: MatchKind) => {
    if (seenAnimals.has(animal.id)) return;
    seenAnimals.add(animal.id);
    animalItems.push({ type: 'animal', animal, kind });
  };

  for (const animal of animals) {
    if (animal.name.toLowerCase().includes(q)) pushAnimal(animal, 'name');
  }
  for (const animal of animals) {
    if (animal.species.name.toLowerCase().includes(q)) pushAnimal(animal, 'species');
  }
  for (const animal of animals) {
    if (animal.breed.name.toLowerCase().includes(q)) pushAnimal(animal, 'breed');
  }
  for (const animal of animals) {
    const statusLabel = ANIMAL_STATUS_LABELS[animal.status]?.toLowerCase() ?? '';
    if (statusLabel.includes(q)) pushAnimal(animal, 'status');
  }

  return [...items, ...animalItems.slice(0, 8)];
}

export function AnimalSpotlight({
  shelterSlug,
  animals,
  loading,
  opened,
  onClose,
}: {
  shelterSlug: string;
  animals: AnimalDTO[];
  loading: boolean;
  opened: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const items = useMemo(() => getItems(animals, debouncedQuery), [animals, debouncedQuery]);

  useEffect(() => {
    if (opened) {
      setQuery('');
      setDebouncedQuery('');
      setFocusedIndex(0);
    }
  }, [opened]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [debouncedQuery]);

  const navigate = (item: SpotlightItem) => {
    const t = tenantRoutes(shelterSlug);
    onClose();

    if (item.type === 'animal') {
      router.push(t.employee.animal(item.animal.id));
      return;
    }

    const base = t.employee.animals;
    if (item.filter === 'species') {
      router.push(`${base}?species=${encodeURIComponent(item.value)}`);
    } else if (item.filter === 'breed') {
      const params = new URLSearchParams({ breed: item.value });
      if (item.speciesId) params.set('species', item.speciesId);
      router.push(`${base}?${params.toString()}`);
    } else {
      router.push(`${base}?status=${encodeURIComponent(item.value)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && items[focusedIndex]) {
      navigate(items[focusedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const showResults = !loading && query.trim().length > 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      size="lg"
      padding={0}
      className={classes.overlay}
      styles={{ body: { padding: 0 } }}
      yOffset="15vh"
    >
      <div className={classes.searchWrapper}>
        <TextInput
          ref={inputRef}
          autoFocus
          placeholder="Rechercher un animal par nom, espèce, race ou statut…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          leftSection={<IconSearch size={16} />}
          variant="unstyled"
          size="md"
          styles={{
            input: {
              fontFamily: 'var(--shelter-font-ui)',
              color: 'var(--shelter-ink)',
              fontSize: '0.95rem',
            },
          }}
        />
      </div>

      <div className={classes.results}>
        {loading && animals.length === 0 ? (
          <div className={classes.empty}>
            <Loader size="sm" color="var(--shelter-ink)" />
          </div>
        ) : !showResults ? (
          <div className={classes.empty}>
            <Text size="sm" c="dimmed">
              Tapez pour rechercher un animal…
            </Text>
          </div>
        ) : items.length === 0 ? (
          <div className={classes.empty}>
            <Text size="sm" c="dimmed">
              Aucun résultat pour « {debouncedQuery} »
            </Text>
          </div>
        ) : (
          items.map((item, i) =>
            item.type === 'filter' ? (
              <div
                key={`filter-${item.filter}-${item.value}`}
                className={`${classes.resultItem} ${classes.filterItem} ${i === focusedIndex ? classes.resultItemFocused : ''}`}
                onClick={() => navigate(item)}
                onMouseEnter={() => setFocusedIndex(i)}
                role="button"
                tabIndex={-1}
              >
                <IconFilter size={14} className={classes.filterIcon} />
                <span className={classes.filterLabel}>
                  Filtrer par {FILTER_LABELS[item.filter]} : {item.label}
                </span>
              </div>
            ) : (
              <div
                key={item.animal.id}
                className={`${classes.resultItem} ${i === focusedIndex ? classes.resultItemFocused : ''}`}
                onClick={() => navigate(item)}
                onMouseEnter={() => setFocusedIndex(i)}
                role="button"
                tabIndex={-1}
              >
                <span className={classes.resultName}>{item.animal.name}</span>
                <span className={classes.resultMeta}>
                  {item.animal.species.name} · {item.animal.breed.name}
                </span>
                <Badge
                  size="xs"
                  color={STATUS_COLORS[item.animal.status]}
                  variant="light"
                >
                  {ANIMAL_STATUS_LABELS[item.animal.status]}
                </Badge>
                <span className={classes.matchType}>via {KIND_LABELS[item.kind]}</span>
              </div>
            ),
          )
        )}
      </div>

      <div className={classes.hint}>
        <span><span className={classes.hintKey}>↑↓</span> naviguer</span>
        <span><span className={classes.hintKey}>↵</span> ouvrir</span>
        <span><span className={classes.hintKey}>Échap</span> fermer</span>
      </div>
    </Modal>
  );
}
