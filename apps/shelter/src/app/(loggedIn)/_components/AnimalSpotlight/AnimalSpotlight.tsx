'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Loader, Modal, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import { ANIMAL_STATUS_LABELS } from '@/lib/animals/labels';
import type { AnimalDTO } from '@/app/(loggedIn)/s/[shelterSlug]/employee/animals/types';
import type { AnimalStatus } from '@/generated/prisma/client';
import classes from './AnimalSpotlight.module.scss';

type MatchKind = 'name' | 'species' | 'breed' | 'status';

type SpotlightResult = {
  animal: AnimalDTO;
  kind: MatchKind;
};

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

function getResults(animals: AnimalDTO[], query: string): SpotlightResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const seen = new Set<string>();
  const results: SpotlightResult[] = [];

  const push = (animal: AnimalDTO, kind: MatchKind) => {
    if (seen.has(animal.id)) return;
    seen.add(animal.id);
    results.push({ animal, kind });
  };

  for (const animal of animals) {
    if (animal.name.toLowerCase().includes(q)) push(animal, 'name');
  }
  for (const animal of animals) {
    if (animal.species.name.toLowerCase().includes(q)) push(animal, 'species');
  }
  for (const animal of animals) {
    if (animal.breed.name.toLowerCase().includes(q)) push(animal, 'breed');
  }
  for (const animal of animals) {
    const statusLabel = ANIMAL_STATUS_LABELS[animal.status]?.toLowerCase() ?? '';
    if (statusLabel.includes(q)) push(animal, 'status');
  }

  return results.slice(0, 8);
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

  const results = useMemo(() => getResults(animals, debouncedQuery), [animals, debouncedQuery]);

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

  const navigate = (result: SpotlightResult) => {
    const t = tenantRoutes(shelterSlug);
    onClose();

    if (result.kind === 'name') {
      router.push(t.employee.animal(result.animal.id));
      return;
    }

    const base = t.employee.animals;
    if (result.kind === 'species') {
      router.push(`${base}?species=${encodeURIComponent(result.animal.speciesId)}`);
    } else if (result.kind === 'breed') {
      router.push(`${base}?species=${encodeURIComponent(result.animal.speciesId)}`);
    } else if (result.kind === 'status') {
      router.push(`${base}?status=${encodeURIComponent(result.animal.status)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[focusedIndex]) {
      navigate(results[focusedIndex]);
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
        {loading ? (
          <div className={classes.empty}>
            <Loader size="sm" color="var(--shelter-ink)" />
          </div>
        ) : !showResults ? (
          <div className={classes.empty}>
            <Text size="sm" c="dimmed">
              Tapez pour rechercher un animal…
            </Text>
          </div>
        ) : results.length === 0 ? (
          <div className={classes.empty}>
            <Text size="sm" c="dimmed">
              Aucun animal trouvé pour « {debouncedQuery} »
            </Text>
          </div>
        ) : (
          results.map((result, i) => (
            <div
              key={result.animal.id}
              className={`${classes.resultItem} ${i === focusedIndex ? classes.resultItemFocused : ''}`}
              onClick={() => navigate(result)}
              onMouseEnter={() => setFocusedIndex(i)}
              role="button"
              tabIndex={-1}
            >
              <span className={classes.resultName}>{result.animal.name}</span>
              <span className={classes.resultMeta}>
                {result.animal.species.name} · {result.animal.breed.name}
              </span>
              <Badge
                size="xs"
                color={STATUS_COLORS[result.animal.status]}
                variant="light"
              >
                {ANIMAL_STATUS_LABELS[result.animal.status]}
              </Badge>
              <span className={classes.matchType}>via {KIND_LABELS[result.kind]}</span>
            </div>
          ))
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
