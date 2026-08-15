'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ActionIcon,
  Button,
  Container,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  IconCheck,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import {
  createSpecies,
  createBreed,
  createVariant,
  deleteSpecies,
  deleteBreed,
  deleteVariant,
  reorderSpecies,
  reorderBreeds,
  reorderVariants,
  updateSpecies,
  updateBreed,
  updateVariant,
} from '@/app/_actions/species';
import { SortableSpeciesItem } from './SortableSpeciesItem';
import { SortableBreedCard } from './SortableBreedCard';
import type { SpeciesDTO, BreedDTO } from './types';
import classes from './SpeciesPage.module.scss';

export type { SpeciesDTO, BreedDTO, SpeciesVariantDTO } from './types';

function actionErrorMessage(
  result: { status: number; error?: string | Array<{ message: string }> },
  fallback: string,
): string {
  if (typeof result.error === 'string') return result.error;
  if (Array.isArray(result.error)) return result.error.map((e) => e.message).join(', ');
  return fallback;
}

function withSortOrders<T extends { id: string; sortOrder: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, sortOrder: index }));
}

export function SpeciesPageClient({
  shelterSlug,
  initialSpecies,
}: {
  shelterSlug: string;
  initialSpecies: SpeciesDTO[];
}) {
  const [species, setSpecies] = useState(initialSpecies);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSpecies[0]?.id ?? null,
  );
  const [search, setSearch] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [breedInput, setBreedInput] = useState('');
  const [variantInputs, setVariantInputs] = useState<Record<string, string>>({});
  const [editingBreedId, setEditingBreedId] = useState<string | null>(null);
  const [breedDraft, setBreedDraft] = useState('');
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantDraft, setVariantDraft] = useState('');

  const runBusy = useCallback(async (key: string, fn: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await fn();
    } finally {
      setBusyKey(null);
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selected = useMemo(
    () => species.find((s) => s.id === selectedId) ?? null,
    [species, selectedId],
  );

  const searchQuery = search.trim().toLowerCase();
  const canReorderSpecies = searchQuery.length === 0;

  const filtered = useMemo(() => {
    if (!searchQuery) return species;
    return species.filter((s) => s.name.toLowerCase().includes(searchQuery));
  }, [species, searchQuery]);

  const replaceSpecies = (next: SpeciesDTO) => {
    setSpecies((prev) => prev.map((s) => (s.id === next.id ? next : s)));
  };

  const patchBreed = (breedId: string, updater: (breed: BreedDTO) => BreedDTO) => {
    if (!selected) return;
    replaceSpecies({
      ...selected,
      breeds: selected.breeds.map((breed) =>
        breed.id === breedId ? updater(breed) : breed,
      ),
    });
  };

  const persistSpeciesOrder = (next: SpeciesDTO[], previous: SpeciesDTO[]) => {
    setSpecies(next);
    void (async () => {
      const result = await reorderSpecies(shelterSlug, {
        items: next.map((item, index) => ({ id: item.id, sortOrder: index })),
      });
      if (result.status !== 200) {
        setSpecies(previous);
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Réordonnancement impossible'),
          color: 'danger',
        });
      }
    })();
  };

  const handleSpeciesDragEnd = (event: DragEndEvent) => {
    if (!canReorderSpecies) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = species.findIndex((item) => item.id === active.id);
    const newIndex = species.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = species;
    const next = withSortOrders(arrayMove(species, oldIndex, newIndex));
    persistSpeciesOrder(next, previous);
  };

  const handleBreedsDragEnd = (event: DragEndEvent) => {
    if (!selected) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = selected.breeds.findIndex((item) => item.id === active.id);
    const newIndex = selected.breeds.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = selected;
    const nextBreeds = withSortOrders(arrayMove(selected.breeds, oldIndex, newIndex));
    const nextSpecies: SpeciesDTO = { ...selected, breeds: nextBreeds };
    replaceSpecies(nextSpecies);

    void (async () => {
      const result = await reorderBreeds(shelterSlug, {
        speciesId: selected.id,
        items: nextBreeds.map((item, index) => ({ id: item.id, sortOrder: index })),
      });
      if (result.status !== 200) {
        replaceSpecies(previous);
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Réordonnancement impossible'),
          color: 'danger',
        });
      }
    })();
  };

  const handleVariantsReorder = (
    breedId: string,
    activeId: string,
    overId: string,
  ) => {
    if (!selected) return;
    const breed = selected.breeds.find((b) => b.id === breedId);
    if (!breed) return;

    const oldIndex = breed.variants.findIndex((item) => item.id === activeId);
    const newIndex = breed.variants.findIndex((item) => item.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = selected;
    const nextVariants = withSortOrders(arrayMove(breed.variants, oldIndex, newIndex));
    const nextSpecies: SpeciesDTO = {
      ...selected,
      breeds: selected.breeds.map((b) =>
        b.id === breedId ? { ...b, variants: nextVariants } : b,
      ),
    };
    replaceSpecies(nextSpecies);

    void (async () => {
      const result = await reorderVariants(shelterSlug, {
        breedId,
        items: nextVariants.map((item, index) => ({ id: item.id, sortOrder: index })),
      });
      if (result.status !== 200) {
        replaceSpecies(previous);
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Réordonnancement impossible'),
          color: 'danger',
        });
      }
    })();
  };

  const handleCreateSpecies = () => {
    const name = search.trim();
    if (!name) return;
    void runBusy('create-species', async () => {
      const result = await createSpecies(shelterSlug, { name });
      if (result.status !== 201 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Création impossible'),
          color: 'danger',
        });
        return;
      }
      setSpecies((prev) => [...prev, result.data!]);
      setSelectedId(result.data.id);
      setSearch('');
      setEditingName(false);
      setEditingBreedId(null);
      setEditingVariantId(null);
      notifications.show({
        title: 'Espèce créée',
        message: result.data.name,
        color: 'terracotta',
      });
    });
  };

  const handleSaveSpeciesName = () => {
    if (!selected) return;
    const name = nameDraft.trim();
    if (!name || name === selected.name) {
      setEditingName(false);
      return;
    }
    void runBusy('save-species-name', async () => {
      const result = await updateSpecies(shelterSlug, { id: selected.id, name });
      if (result.status !== 200 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Modification impossible'),
          color: 'danger',
        });
        return;
      }
      replaceSpecies(result.data);
      setEditingName(false);
      notifications.show({ title: 'Nom mis à jour', message: result.data.name, color: 'terracotta' });
    });
  };

  const handleDeleteSpecies = async () => {
    if (!selected) return;
    const target = { id: selected.id, label: selected.name };
    await runBusy(`delete:species:${target.id}`, async () => {
      const result = await deleteSpecies(shelterSlug, { id: target.id });
      if (result.status !== 200) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Suppression impossible'),
          color: 'danger',
        });
        return;
      }
      setSpecies((prev) => {
        const next = prev.filter((s) => s.id !== target.id);
        setSelectedId((current) =>
          current === target.id ? (next[0]?.id ?? null) : current,
        );
        return next;
      });
      notifications.show({
        title: 'Supprimé',
        message: target.label,
        color: 'terracotta',
      });
    });
  };

  const handleAddBreed = () => {
    if (!selected) return;
    const name = breedInput.trim();
    if (!name) return;
    void runBusy('add-breed', async () => {
      const result = await createBreed(shelterSlug, {
        speciesId: selected.id,
        name,
      });
      if (result.status !== 201 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Ajout impossible'),
          color: 'danger',
        });
        return;
      }
      const created = {
        ...result.data,
        shelterPurchasePrice: result.data.shelterPurchasePrice ?? null,
        animalierPurchasePrice: result.data.animalierPurchasePrice ?? null,
        variants: result.data.variants ?? [],
      };
      replaceSpecies({
        ...selected,
        breeds: [...selected.breeds, created],
      });
      setBreedInput('');
    });
  };

  const handleSaveBreed = (id: string) => {
    if (!selected) return;
    const name = breedDraft.trim();
    if (!name) return;
    void runBusy(`save-breed:${id}`, async () => {
      const result = await updateBreed(shelterSlug, { id, name });
      if (result.status !== 200 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Modification impossible'),
          color: 'danger',
        });
        return;
      }
      patchBreed(id, (breed) => ({
        ...breed,
        ...result.data!,
        variants: result.data!.variants ?? breed.variants,
      }));
      setEditingBreedId(null);
    });
  };

  const handleSaveBreedPrices = (
    id: string,
    prices: {
      shelterPurchasePrice: number;
      animalierPurchasePrice: number | null;
    },
  ) => {
    if (!selected) return;
    const current = selected.breeds.find((b) => b.id === id);
    if (!current) return;
    void runBusy(`save-prices:${id}`, async () => {
      const result = await updateBreed(shelterSlug, {
        id,
        name: current.name,
        shelterPurchasePrice: prices.shelterPurchasePrice,
        animalierPurchasePrice: prices.animalierPurchasePrice,
      });
      if (result.status !== 200 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Enregistrement des prix impossible'),
          color: 'danger',
        });
        return;
      }
      patchBreed(id, (breed) => ({
        ...breed,
        ...result.data!,
        variants: result.data!.variants ?? breed.variants,
      }));
      notifications.show({
        title: 'Prix enregistrés',
        message: current.name,
        color: 'terracotta',
      });
    });
  };

  const handleDeleteBreed = async (id: string, label: string) => {
    if (!selected) return;
    await runBusy(`delete:breed:${id}`, async () => {
      const result = await deleteBreed(shelterSlug, { id });
      if (result.status !== 200) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Suppression impossible'),
          color: 'danger',
        });
        return;
      }
      replaceSpecies({
        ...selected,
        breeds: selected.breeds.filter((b) => b.id !== id),
      });
      notifications.show({
        title: 'Supprimé',
        message: label,
        color: 'terracotta',
      });
    });
  };

  const handleAddVariant = (breedId: string) => {
    if (!selected) return;
    const label = (variantInputs[breedId] ?? '').trim();
    if (!label) return;
    void runBusy(`add-variant:${breedId}`, async () => {
      const result = await createVariant(shelterSlug, { breedId, label });
      if (result.status !== 201 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Ajout impossible'),
          color: 'danger',
        });
        return;
      }
      patchBreed(breedId, (breed) => ({
        ...breed,
        variants: [...breed.variants, result.data!],
      }));
      setVariantInputs((prev) => ({ ...prev, [breedId]: '' }));
    });
  };

  const handleSaveVariant = (breedId: string, id: string) => {
    if (!selected) return;
    const label = variantDraft.trim();
    if (!label) return;
    void runBusy(`save-variant:${id}`, async () => {
      const result = await updateVariant(shelterSlug, { id, label });
      if (result.status !== 200 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Modification impossible'),
          color: 'danger',
        });
        return;
      }
      patchBreed(breedId, (breed) => ({
        ...breed,
        variants: breed.variants.map((v) => (v.id === id ? result.data! : v)),
      }));
      setEditingVariantId(null);
    });
  };

  const handleDeleteVariant = async (id: string, label: string) => {
    if (!selected) return;
    await runBusy(`delete:variant:${id}`, async () => {
      const result = await deleteVariant(shelterSlug, { id });
      if (result.status !== 200) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Suppression impossible'),
          color: 'danger',
        });
        return;
      }
      replaceSpecies({
        ...selected,
        breeds: selected.breeds.map((breed) => ({
          ...breed,
          variants: breed.variants.filter((v) => v.id !== id),
        })),
      });
      notifications.show({
        title: 'Supprimé',
        message: label,
        color: 'terracotta',
      });
    });
  };

  const speciesList = (
    <>
      {filtered.map((item) => (
        <SortableSpeciesItem
          key={item.id}
          item={item}
          active={item.id === selectedId}
          sortable={canReorderSpecies}
          onSelect={() => {
            setSelectedId(item.id);
            setEditingName(false);
            setEditingBreedId(null);
            setEditingVariantId(null);
          }}
        />
      ))}
    </>
  );

  return (
    <Container size="xl">
      <PageHeader
        title="Espèces"
        description="Gérez les espèces, races et variantes proposées à la création d’un animal."
      />

      <div className={classes.layout}>
        <aside className={classes.listPanel}>
          <div className={classes.listHeader}>
            <div className={classes.searchCreateRow}>
              <TextInput
                placeholder="Rechercher ou créer…"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSpecies();
                }}
                style={{ flex: 1 }}
              />
              <ActionIcon
                color="terracotta"
                variant="filled"
                size="input-sm"
                aria-label="Créer une espèce"
                onClick={handleCreateSpecies}
                loading={busyKey === 'create-species'}
                disabled={search.trim().length === 0}
              >
                <IconPlus size={16} />
              </ActionIcon>
            </div>
            {filtered.length === 0 && search.trim().length > 0 ? (
              <Text size="xs" c="dimmed" mt={6}>
                Aucun résultat — Entrée pour créer « {search.trim()} »
              </Text>
            ) : null}
          </div>
          <div className={classes.listBody}>
            {filtered.length === 0 ? (
              species.length === 0 ? (
                <div className={classes.emptyState}>
                  <Text size="sm">
                    Aucune espèce pour l’instant. Tapez un nom puis + pour créer.
                  </Text>
                </div>
              ) : null
            ) : canReorderSpecies ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleSpeciesDragEnd}
              >
                <SortableContext
                  items={filtered.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {speciesList}
                </SortableContext>
              </DndContext>
            ) : (
              speciesList
            )}
          </div>
        </aside>

        <section className={classes.detailPanel}>
          {!selected ? (
            <div className={classes.emptyState}>
              <Title order={3} className="shelter-display-title" mb="xs">
                Sélectionnez une espèce
              </Title>
              <Text size="sm">
                Choisissez une espèce à gauche pour gérer ses races et variantes.
              </Text>
            </div>
          ) : (
            <>
              <div className={classes.detailHeader}>
                {editingName ? (
                  <Group gap="xs" wrap="nowrap" align="center">
                    <TextInput
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveSpeciesName();
                        if (e.key === 'Escape') setEditingName(false);
                      }}
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <ActionIcon
                      color="terracotta"
                      variant="filled"
                      onClick={handleSaveSpeciesName}
                      loading={busyKey === 'save-species-name'}
                      aria-label="Enregistrer"
                    >
                      <IconCheck size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => setEditingName(false)}
                      aria-label="Annuler"
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </Group>
                ) : (
                  <div className={classes.headerRow}>
                    <div className={classes.titleActions}>
                      <Title
                        order={2}
                        className={`shelter-display-title ${classes.speciesTitle}`}
                      >
                        {selected.name}
                      </Title>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="terracotta"
                        aria-label="Renommer"
                        onClick={() => {
                          setNameDraft(selected.name);
                          setEditingName(true);
                        }}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    </div>
                    <DeleteConfirmPopover
                      title="Supprimer l’espèce"
                      message={`Supprimer l’espèce « ${selected.name} » et toutes ses races / variantes ?`}
                      onConfirm={handleDeleteSpecies}
                    >
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="danger"
                        aria-label="Supprimer"
                        loading={busyKey === `delete:species:${selected.id}`}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </DeleteConfirmPopover>
                  </div>
                )}
              </div>

              <div className={classes.detailBody}>
                <div className={classes.section}>
                  <Text className={classes.sectionTitle}>Races</Text>
                  <Text size="sm" c="dimmed">
                    Chaque race a ses propres variantes (options à la création d’un animal).
                  </Text>

                  <div className={classes.quickAdd}>
                    <TextInput
                      placeholder="Ajouter une race (ex. Labrador)"
                      value={breedInput}
                      onChange={(e) => setBreedInput(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddBreed();
                      }}
                      style={{ flex: 1 }}
                    />
                    <Button
                      color="terracotta"
                      variant="light"
                      leftSection={<IconPlus size={16} />}
                      onClick={handleAddBreed}
                      loading={busyKey === 'add-breed'}
                    >
                      Ajouter
                    </Button>
                  </div>

                  {selected.breeds.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      Aucune race. Ajoutez-en une pour définir des variantes.
                    </Text>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleBreedsDragEnd}
                    >
                      <SortableContext
                        items={selected.breeds.map((breed) => breed.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <Stack gap="md">
                          {selected.breeds.map((breed) => (
                            <SortableBreedCard
                              key={breed.id}
                              breed={breed}
                              busyKey={busyKey}
                              editingBreedId={editingBreedId}
                              breedDraft={breedDraft}
                              editingVariantId={editingVariantId}
                              variantDraft={variantDraft}
                              variantInput={variantInputs[breed.id] ?? ''}
                              onBreedDraftChange={setBreedDraft}
                              onSaveBreed={() => handleSaveBreed(breed.id)}
                              onCancelEditBreed={() => setEditingBreedId(null)}
                              onStartEditBreed={() => {
                                setEditingBreedId(breed.id);
                                setBreedDraft(breed.name);
                              }}
                              onDeleteBreed={() =>
                                handleDeleteBreed(breed.id, breed.name)
                              }
                              onSavePrices={(prices) =>
                                handleSaveBreedPrices(breed.id, prices)
                              }
                              onVariantDraftChange={setVariantDraft}
                              onSaveVariant={(variantId) =>
                                handleSaveVariant(breed.id, variantId)
                              }
                              onCancelEditVariant={() => setEditingVariantId(null)}
                              onStartEditVariant={(variantId, label) => {
                                setEditingVariantId(variantId);
                                setVariantDraft(label);
                              }}
                              onDeleteVariant={(variantId) => {
                                const label =
                                  breed.variants.find((v) => v.id === variantId)?.label ??
                                  variantId;
                                return handleDeleteVariant(variantId, label);
                              }}
                              onVariantInputChange={(value) =>
                                setVariantInputs((prev) => ({
                                  ...prev,
                                  [breed.id]: value,
                                }))
                              }
                              onAddVariant={() => handleAddVariant(breed.id)}
                              onVariantsReorder={(activeId, overId) =>
                                handleVariantsReorder(breed.id, activeId, overId)
                              }
                            />
                          ))}
                        </Stack>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </Container>
  );
}
