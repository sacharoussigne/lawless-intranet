'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Center,
  Container,
  Divider,
  Grid,
  Group,
  Paper,
  Popover,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconPlayerPlay, IconTools, IconTrashX } from '@tabler/icons-react';
import { PageHeader } from '../components/PageHeader';
import { useInventoryUi } from '../InventoryUiProvider';
import { getLastRecipeIdForItem, setLastRecipeIdForItem } from '../stock/modals/craftNavStorage';
import type { ChestListItem } from '../types';
import { AddCraftForm } from './AddCraftForm';
import { CraftIngredientsSummary } from './CraftIngredientsSummary';
import { CraftQueueList, type CraftQueueLineActions } from './CraftQueueList';
import { planCraftQueue, subCraftTimes, type CraftQueueEntry, type MissingIngredient } from './plan';
import {
  useCraftQueueRunner,
  useCraftQueueState,
  useCraftRecipesFetcher,
  useQueueRecipes,
  useQueueStock,
} from './useCraftQueue';

/** Below the sticky app header. */
const STICKY_TOP = 'calc(var(--disp-safe-top, 0px) + 88px)';

export type CraftQueuePageProps = {
  chests: ChestListItem[];
};

function ClearQueueButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  const [opened, setOpened] = useState(false);
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" withArrow shadow="md">
      <Popover.Target>
        <Button
          variant="subtle"
          color="slate"
          leftSection={<IconTrashX size={16} />}
          disabled={disabled}
          onClick={() => setOpened((value) => !value)}
        >
          Vider la file
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="sm">Retirer tous les crafts de la file ?</Text>
          <Group justify="flex-end" gap="xs">
            <Button size="xs" variant="subtle" color="slate" onClick={() => setOpened(false)}>
              Annuler
            </Button>
            <Button
              size="xs"
              color="danger"
              onClick={() => {
                onConfirm();
                setOpened(false);
              }}
            >
              Vider
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

/**
 * Craft queue: plan several crafts, see what to bring in the source chest for
 * all of them, then craft line by line or everything at once (normal crafts).
 */
export default function CraftQueuePage({ chests }: CraftQueuePageProps) {
  const { permissions } = useInventoryUi();
  const canCraft = Boolean(permissions.stock.craftWrite);
  const queue = useCraftQueueState(chests);
  const { entries, sourceChestId, destinationChestId } = queue;
  const getRecipe = useQueueRecipes(entries);
  const { stock, items } = useQueueStock(sourceChestId, destinationChestId);
  const fetchRecipes = useCraftRecipesFetcher();
  const runner = useCraftQueueRunner({ sourceChestId, destinationChestId, onCrafted: queue.remove });
  const busy = runner.runningId !== null || runner.runningAll;

  const plan = useMemo(
    () => planCraftQueue({ entries, getRecipe, stock, sourceChestId, destinationChestId }),
    [entries, getRecipe, stock, sourceChestId, destinationChestId],
  );

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const chestOptions = chests.map((chest) => ({ value: chest.id, label: chest.name }));
  const sourceChestName = chests.find((chest) => chest.id === sourceChestId)?.name ?? null;
  const labelOf = (entry: CraftQueueEntry) =>
    itemsById.get(entry.craftedItemId)?.name ?? getRecipe(entry.recipeId)?.name ?? 'Objet';

  const addSubCraft = async (entry: CraftQueueEntry, missing: MissingIngredient) => {
    try {
      const recipes = await fetchRecipes(missing.itemId);
      const last = getLastRecipeIdForItem(missing.itemId);
      const recipe = recipes.find((candidate) => candidate.id === last) ?? recipes[0];
      if (!recipe) {
        notifications.show({ message: `Aucune recette active pour ${missing.name}.`, color: 'danger' });
        return;
      }
      setLastRecipeIdForItem(missing.itemId, recipe.id);
      const times = subCraftTimes(missing.needed - missing.available, recipe.quantity);
      queue.add({ craftedItemId: missing.itemId, recipeId: recipe.id, times }, entry.id);
      notifications.show({ message: `${missing.name} ×${times} ajouté avant ${labelOf(entry)}.`, color: 'moss' });
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : 'Chargement des recettes impossible',
        color: 'danger',
      });
    }
  };

  const lineActions: CraftQueueLineActions = {
    itemName: (itemId) => itemsById.get(itemId)?.name ?? 'Objet',
    isCraftable: (itemId) => Boolean(itemsById.get(itemId)?.isCraftable),
    canCraft,
    busy,
    runningId: runner.runningId,
    onTimesChange: (entry, times) => queue.setTimes(entry.id, times),
    onRemove: (entry) => queue.remove(entry.id),
    onCraft: (entry) => void runner.craftLine(entry, labelOf(entry)),
    onAddSubCraft: (entry, missing) => void addSubCraft(entry, missing),
  };

  const craftAllBlocked = !canCraft
    ? 'Vous n’avez pas la permission de crafter'
    : entries.length === 0
      ? 'La file est vide'
      : !plan.canCraftAll
        ? 'Il manque des ingrédients, ou une recette est indisponible'
        : null;

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="File de craft"
        description="Préparez vos crafts, voyez quoi prendre au coffre, puis craftez en un clic."
        actions={
          <Group gap="sm">
            <ClearQueueButton disabled={entries.length === 0 || busy} onConfirm={queue.clear} />
            <Tooltip label={craftAllBlocked} disabled={!craftAllBlocked} withArrow>
              <span style={{ display: 'inline-block' }}>
                <Button
                  color="sage"
                  leftSection={<IconPlayerPlay size={16} />}
                  disabled={Boolean(craftAllBlocked) || (busy && !runner.runningAll)}
                  loading={runner.runningAll}
                  onClick={() => void runner.craftAll(entries, labelOf)}
                >
                  Tout crafter{entries.length > 0 ? ` (${entries.length})` : ''}
                </Button>
              </span>
            </Tooltip>
          </Group>
        }
      />

      <Stack gap="lg">
        {!canCraft ? (
          <Alert color="amber" icon={<IconAlertCircle size={16} />}>
            Vous pouvez préparer une file, mais pas lancer les crafts : il faut la permission de crafter.
          </Alert>
        ) : null}

        <Paper withBorder radius="md" p="md">
          {chests.length === 0 ? (
            <Text size="sm" c="dimmed">
              Aucun coffre accessible avec votre rôle.
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select
                label="Coffre source"
                description="Les ingrédients sont pris dans ce coffre."
                placeholder="Choisir un coffre"
                data={chestOptions}
                value={sourceChestId}
                onChange={queue.setSourceChestId}
                allowDeselect={false}
                disabled={busy}
              />
              <Select
                label="Coffre de destination"
                description="Les objets craftés y sont déposés."
                placeholder="Choisir un coffre"
                data={chestOptions}
                value={destinationChestId}
                onChange={queue.setDestinationChestId}
                allowDeselect={false}
                disabled={busy}
              />
            </SimpleGrid>
          )}
          <Divider my="md" />
          <AddCraftForm items={items} disabled={!sourceChestId || busy} onAdd={(addition) => queue.add(addition)} />
        </Paper>

        <Grid gutter="lg" align="flex-start">
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Group justify="space-between" align="baseline" mb="xs" gap="xs">
              <Text fw={600} c="var(--disp-ink)">
                File{entries.length > 0 ? ` (${entries.length})` : ''}
              </Text>
              {entries.length > 1 ? (
                <Text size="xs" c="dimmed">
                  Les crafts se font de haut en bas : glissez pour réordonner.
                </Text>
              ) : null}
            </Group>
            {entries.length > 0 ? (
              <CraftQueueList
                entries={entries}
                lines={plan.lines}
                getRecipe={getRecipe}
                actions={lineActions}
                onReorder={queue.reorder}
              />
            ) : (
              <Paper withBorder radius="md" p="xl" style={{ borderStyle: 'dashed' }}>
                <Center>
                  <Stack gap={4} align="center">
                    <IconTools size={36} stroke={1.25} color="var(--disp-ink-muted)" />
                    <Text fw={500}>Votre file est vide</Text>
                    <Text size="sm" c="dimmed" ta="center" maw={360}>
                      Ajoutez des objets à craft : la file calcule ce qu&apos;il faut prendre au coffre pour tout
                      faire.
                    </Text>
                  </Stack>
                </Center>
              </Paper>
            )}
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <div style={{ position: 'sticky', top: STICKY_TOP }}>
              <CraftIngredientsSummary ingredients={plan.ingredients} chestName={sourceChestName} />
            </div>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
