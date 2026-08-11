'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  ActionIcon,
  Button,
  Container,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import {
  createSpecies,
  createSubspecies,
  createVariant,
  deleteSpecies,
  deleteSubspecies,
  deleteVariant,
  updateSpecies,
  updateSubspecies,
  updateVariant,
} from '@/app/_actions/species';
import classes from './SpeciesPage.module.scss';

export type SpeciesVariantDTO = {
  id: string;
  subspeciesId: string;
  label: string;
  sortOrder: number;
};

export type SubspeciesDTO = {
  id: string;
  speciesId: string;
  name: string;
  sortOrder: number;
  variants: SpeciesVariantDTO[];
};

export type SpeciesDTO = {
  id: string;
  shelterId: string;
  name: string;
  sortOrder: number;
  subspecies: SubspeciesDTO[];
};

function actionErrorMessage(
  result: { status: number; error?: string | Array<{ message: string }> },
  fallback: string,
): string {
  if (typeof result.error === 'string') return result.error;
  if (Array.isArray(result.error)) return result.error.map((e) => e.message).join(', ');
  return fallback;
}

function countVariants(species: SpeciesDTO): number {
  return species.subspecies.reduce((sum, sub) => sum + sub.variants.length, 0);
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
  const [newSpeciesName, setNewSpeciesName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [subInput, setSubInput] = useState('');
  const [variantInputs, setVariantInputs] = useState<Record<string, string>>({});
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState('');
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantDraft, setVariantDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'species' | 'subspecies' | 'variant';
    id: string;
    label: string;
  } | null>(null);

  const selected = useMemo(
    () => species.find((s) => s.id === selectedId) ?? null,
    [species, selectedId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return species;
    return species.filter((s) => s.name.toLowerCase().includes(q));
  }, [species, search]);

  const replaceSpecies = (next: SpeciesDTO) => {
    setSpecies((prev) => prev.map((s) => (s.id === next.id ? next : s)));
  };

  const patchSubspecies = (
    subspeciesId: string,
    updater: (sub: SubspeciesDTO) => SubspeciesDTO,
  ) => {
    if (!selected) return;
    replaceSpecies({
      ...selected,
      subspecies: selected.subspecies.map((sub) =>
        sub.id === subspeciesId ? updater(sub) : sub,
      ),
    });
  };

  const handleCreateSpecies = () => {
    const name = newSpeciesName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createSpecies(shelterSlug, { name });
      if (result.status !== 201 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Création impossible'),
          color: 'red',
        });
        return;
      }
      setSpecies((prev) => [...prev, result.data!]);
      setSelectedId(result.data.id);
      setNewSpeciesName('');
      setCreateOpen(false);
      notifications.show({
        title: 'Espèce créée',
        message: result.data.name,
        color: 'teal',
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
    startTransition(async () => {
      const result = await updateSpecies(shelterSlug, { id: selected.id, name });
      if (result.status !== 200 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Modification impossible'),
          color: 'red',
        });
        return;
      }
      replaceSpecies(result.data);
      setEditingName(false);
      notifications.show({ title: 'Nom mis à jour', message: result.data.name, color: 'teal' });
    });
  };

  const handleAddSubspecies = () => {
    if (!selected) return;
    const name = subInput.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createSubspecies(shelterSlug, {
        speciesId: selected.id,
        name,
      });
      if (result.status !== 201 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Ajout impossible'),
          color: 'red',
        });
        return;
      }
      const created = {
        ...result.data,
        variants: result.data.variants ?? [],
      };
      replaceSpecies({
        ...selected,
        subspecies: [...selected.subspecies, created],
      });
      setSubInput('');
    });
  };

  const handleSaveSubspecies = (id: string) => {
    if (!selected) return;
    const name = subDraft.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await updateSubspecies(shelterSlug, { id, name });
      if (result.status !== 200 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Modification impossible'),
          color: 'red',
        });
        return;
      }
      patchSubspecies(id, (sub) => ({
        ...sub,
        ...result.data!,
        variants: result.data!.variants ?? sub.variants,
      }));
      setEditingSubId(null);
    });
  };

  const handleAddVariant = (subspeciesId: string) => {
    if (!selected) return;
    const label = (variantInputs[subspeciesId] ?? '').trim();
    if (!label) return;
    startTransition(async () => {
      const result = await createVariant(shelterSlug, { subspeciesId, label });
      if (result.status !== 201 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Ajout impossible'),
          color: 'red',
        });
        return;
      }
      patchSubspecies(subspeciesId, (sub) => ({
        ...sub,
        variants: [...sub.variants, result.data!],
      }));
      setVariantInputs((prev) => ({ ...prev, [subspeciesId]: '' }));
    });
  };

  const handleSaveVariant = (subspeciesId: string, id: string) => {
    if (!selected) return;
    const label = variantDraft.trim();
    if (!label) return;
    startTransition(async () => {
      const result = await updateVariant(shelterSlug, { id, label });
      if (result.status !== 200 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Modification impossible'),
          color: 'red',
        });
        return;
      }
      patchSubspecies(subspeciesId, (sub) => ({
        ...sub,
        variants: sub.variants.map((v) => (v.id === id ? result.data! : v)),
      }));
      setEditingVariantId(null);
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      if (target.kind === 'species') {
        const result = await deleteSpecies(shelterSlug, { id: target.id });
        if (result.status !== 200) {
          notifications.show({
            title: 'Erreur',
            message: actionErrorMessage(result, 'Suppression impossible'),
            color: 'red',
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
      } else if (target.kind === 'subspecies' && selected) {
        const result = await deleteSubspecies(shelterSlug, { id: target.id });
        if (result.status !== 200) {
          notifications.show({
            title: 'Erreur',
            message: actionErrorMessage(result, 'Suppression impossible'),
            color: 'red',
          });
          return;
        }
        replaceSpecies({
          ...selected,
          subspecies: selected.subspecies.filter((s) => s.id !== target.id),
        });
      } else if (target.kind === 'variant' && selected) {
        const result = await deleteVariant(shelterSlug, { id: target.id });
        if (result.status !== 200) {
          notifications.show({
            title: 'Erreur',
            message: actionErrorMessage(result, 'Suppression impossible'),
            color: 'red',
          });
          return;
        }
        replaceSpecies({
          ...selected,
          subspecies: selected.subspecies.map((sub) => ({
            ...sub,
            variants: sub.variants.filter((v) => v.id !== target.id),
          })),
        });
      }
      setDeleteTarget(null);
      notifications.show({
        title: 'Supprimé',
        message: target.label,
        color: 'teal',
      });
    });
  };

  return (
    <Container size="xl">
      <PageHeader
        title="Espèces"
        description="Gérez les espèces, sous-espèces et variantes proposées à la création d’un animal."
      />

      <div className={classes.layout}>
        <aside className={classes.listPanel}>
          <div className={classes.listHeader}>
            <Group justify="space-between" align="flex-end" wrap="nowrap" gap="sm">
              <TextInput
                label="Rechercher"
                placeholder="Chien, chat…"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Button
                leftSection={<IconPlus size={16} />}
                color="teal"
                onClick={() => setCreateOpen(true)}
              >
                Nouvelle
              </Button>
            </Group>
          </div>
          <div className={classes.listBody}>
            {filtered.length === 0 ? (
              <div className={classes.emptyState}>
                <Text size="sm">
                  {species.length === 0
                    ? 'Aucune espèce pour l’instant. Créez la première.'
                    : 'Aucun résultat pour cette recherche.'}
                </Text>
              </div>
            ) : (
              filtered.map((item) => {
                const variantsCount = countVariants(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${classes.speciesItem} ${item.id === selectedId ? classes.speciesItemActive : ''}`}
                    onClick={() => {
                      setSelectedId(item.id);
                      setEditingName(false);
                      setEditingSubId(null);
                      setEditingVariantId(null);
                    }}
                  >
                    <span className={classes.speciesName}>{item.name}</span>
                    <span className={classes.speciesMeta}>
                      {item.subspecies.length} sous-espèce
                      {item.subspecies.length === 1 ? '' : 's'} · {variantsCount} variante
                      {variantsCount === 1 ? '' : 's'}
                    </span>
                  </button>
                );
              })
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
                Choisissez une espèce à gauche pour gérer ses sous-espèces et variantes.
              </Text>
            </div>
          ) : (
            <>
              <div className={classes.detailHeader}>
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  {editingName ? (
                    <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
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
                        color="teal"
                        variant="filled"
                        onClick={handleSaveSpeciesName}
                        loading={pending}
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
                    <Group gap="xs">
                      <Title order={2} className="shelter-display-title">
                        {selected.name}
                      </Title>
                      <ActionIcon
                        variant="subtle"
                        color="teal"
                        aria-label="Renommer"
                        onClick={() => {
                          setNameDraft(selected.name);
                          setEditingName(true);
                        }}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    </Group>
                  )}
                  <Button
                    color="red"
                    variant="light"
                    leftSection={<IconTrash size={16} />}
                    onClick={() =>
                      setDeleteTarget({
                        kind: 'species',
                        id: selected.id,
                        label: selected.name,
                      })
                    }
                  >
                    Supprimer
                  </Button>
                </Group>
              </div>

              <div className={classes.detailBody}>
                <div className={classes.section}>
                  <Text className={classes.sectionTitle}>Sous-espèces</Text>
                  <Text size="sm" c="dimmed">
                    Chaque sous-espèce a ses propres variantes (options à la création d’un animal).
                  </Text>

                  <div className={classes.quickAdd}>
                    <TextInput
                      placeholder="Ajouter une sous-espèce (ex. Labrador)"
                      value={subInput}
                      onChange={(e) => setSubInput(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddSubspecies();
                      }}
                      style={{ flex: 1 }}
                    />
                    <Button
                      color="teal"
                      variant="light"
                      leftSection={<IconPlus size={16} />}
                      onClick={handleAddSubspecies}
                      loading={pending}
                    >
                      Ajouter
                    </Button>
                  </div>

                  {selected.subspecies.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      Aucune sous-espèce. Ajoutez-en une pour définir des variantes.
                    </Text>
                  ) : (
                    <Stack gap="md">
                      {selected.subspecies.map((sub) => (
                        <div key={sub.id} className={classes.subspeciesCard}>
                          <Group justify="space-between" wrap="wrap" mb="xs">
                            {editingSubId === sub.id ? (
                              <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
                                <TextInput
                                  size="sm"
                                  value={subDraft}
                                  onChange={(e) => setSubDraft(e.currentTarget.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveSubspecies(sub.id);
                                    if (e.key === 'Escape') setEditingSubId(null);
                                  }}
                                  style={{ flex: 1 }}
                                  autoFocus
                                />
                                <ActionIcon
                                  size="sm"
                                  color="teal"
                                  variant="filled"
                                  onClick={() => handleSaveSubspecies(sub.id)}
                                >
                                  <IconCheck size={14} />
                                </ActionIcon>
                              </Group>
                            ) : (
                              <Group gap="xs">
                                <Text fw={700}>{sub.name}</Text>
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  color="teal"
                                  aria-label={`Renommer ${sub.name}`}
                                  onClick={() => {
                                    setEditingSubId(sub.id);
                                    setSubDraft(sub.name);
                                  }}
                                >
                                  <IconPencil size={14} />
                                </ActionIcon>
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  color="red"
                                  aria-label={`Supprimer ${sub.name}`}
                                  onClick={() =>
                                    setDeleteTarget({
                                      kind: 'subspecies',
                                      id: sub.id,
                                      label: sub.name,
                                    })
                                  }
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Group>
                            )}
                          </Group>

                          <Text size="xs" c="dimmed" mb={6}>
                            Variantes
                          </Text>
                          <div className={classes.chipRow}>
                            {sub.variants.length === 0 ? (
                              <Text size="sm" c="dimmed">
                                Aucune variante.
                              </Text>
                            ) : (
                              sub.variants.map((variant) =>
                                editingVariantId === variant.id ? (
                                  <Group key={variant.id} gap={4} wrap="nowrap">
                                    <TextInput
                                      size="xs"
                                      value={variantDraft}
                                      onChange={(e) => setVariantDraft(e.currentTarget.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleSaveVariant(sub.id, variant.id);
                                        }
                                        if (e.key === 'Escape') setEditingVariantId(null);
                                      }}
                                      autoFocus
                                    />
                                    <ActionIcon
                                      size="sm"
                                      color="teal"
                                      variant="filled"
                                      onClick={() => handleSaveVariant(sub.id, variant.id)}
                                    >
                                      <IconCheck size={14} />
                                    </ActionIcon>
                                  </Group>
                                ) : (
                                  <span key={variant.id} className={classes.chip}>
                                    {variant.label}
                                    <button
                                      type="button"
                                      className={classes.chipButton}
                                      aria-label={`Renommer ${variant.label}`}
                                      onClick={() => {
                                        setEditingVariantId(variant.id);
                                        setVariantDraft(variant.label);
                                      }}
                                    >
                                      <IconPencil size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className={classes.chipButton}
                                      aria-label={`Supprimer ${variant.label}`}
                                      onClick={() =>
                                        setDeleteTarget({
                                          kind: 'variant',
                                          id: variant.id,
                                          label: variant.label,
                                        })
                                      }
                                    >
                                      <IconTrash size={14} />
                                    </button>
                                  </span>
                                ),
                              )
                            )}
                          </div>
                          <div className={classes.quickAdd} style={{ marginTop: '0.65rem' }}>
                            <TextInput
                              size="sm"
                              placeholder="Ajouter une variante (ex. Long poils)"
                              value={variantInputs[sub.id] ?? ''}
                              onChange={(e) => {
                                const value = e.currentTarget.value;
                                setVariantInputs((prev) => ({
                                  ...prev,
                                  [sub.id]: value,
                                }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddVariant(sub.id);
                              }}
                              style={{ flex: 1 }}
                              maxLength={255}
                            />
                            <Button
                              size="sm"
                              color="teal"
                              variant="light"
                              leftSection={<IconPlus size={14} />}
                              onClick={() => handleAddVariant(sub.id)}
                              loading={pending}
                            >
                              Ajouter
                            </Button>
                          </div>
                        </div>
                      ))}
                    </Stack>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvelle espèce"
        centered
      >
        <Stack>
          <TextInput
            label="Nom"
            placeholder="Chien, Chat…"
            value={newSpeciesName}
            onChange={(e) => setNewSpeciesName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSpecies();
            }}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button color="teal" loading={pending} onClick={handleCreateSpecies}>
              Créer
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Confirmer la suppression"
        centered
      >
        <Stack>
          <Text size="sm">
            {deleteTarget?.kind === 'species'
              ? `Supprimer l’espèce « ${deleteTarget.label} » et toutes ses sous-espèces / variantes ?`
              : deleteTarget?.kind === 'subspecies'
                ? `Supprimer la sous-espèce « ${deleteTarget.label} » et ses variantes ?`
                : `Supprimer « ${deleteTarget?.label} » ?`}
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button color="red" loading={pending} onClick={confirmDelete}>
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
