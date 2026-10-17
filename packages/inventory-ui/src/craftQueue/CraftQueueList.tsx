'use client';

import { useState } from 'react';
import {
  closestCenter,
  DndContext,
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  NumberInput,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconGripVertical, IconPlus, IconTools, IconTrash } from '@tabler/icons-react';
import { apothecaryBooleanPills, apothecaryPillStyle, denimPalette } from '../lib/apothecaryPill';
import type { CraftQueueEntry, LinePlan, MissingIngredient, RecipeLookup } from './plan';

export type CraftQueueLineActions = {
  /** Item names of the source chest (recipe ingredients carry their own). */
  itemName: (itemId: string) => string;
  /** Ingredients that have a recipe: a missing one can be added as a sub-craft. */
  isCraftable: (itemId: string) => boolean;
  canCraft: boolean;
  busy: boolean;
  runningId: string | null;
  onTimesChange: (entry: CraftQueueEntry, times: number) => void;
  onRemove: (entry: CraftQueueEntry) => void;
  onCraft: (entry: CraftQueueEntry) => void;
  onAddSubCraft: (entry: CraftQueueEntry, missing: MissingIngredient) => void;
};

/** Craft count of a line: a cleared or invalid field is only kept while typing. */
function TimesInput({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (times: number) => void }) {
  const [draft, setDraft] = useState<number | string | null>(null);
  return (
    <NumberInput
      size="xs"
      w={88}
      prefix="×"
      aria-label="Nombre de fois"
      min={1}
      allowDecimal={false}
      allowNegative={false}
      value={draft ?? value}
      disabled={disabled}
      onChange={(next) => {
        setDraft(next);
        if (typeof next === 'number' && Number.isInteger(next) && next >= 1) onChange(next);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function StatusBadge({ plan }: { plan: LinePlan | undefined }) {
  if (!plan || plan.status === 'loading') return <Loader size="xs" color="sage" type="dots" />;
  if (plan.status === 'unavailable') {
    return (
      <Badge variant="outline" style={apothecaryBooleanPills.noAlert}>
        Recette indisponible
      </Badge>
    );
  }
  return plan.status === 'ready' ? (
    <Badge variant="outline" style={apothecaryBooleanPills.yes}>
      Prêt
    </Badge>
  ) : (
    <Badge variant="outline" style={apothecaryBooleanPills.noAlert}>
      Manque
    </Badge>
  );
}

function craftBlockedReason(plan: LinePlan | undefined, canCraft: boolean): string | null {
  if (!canCraft) return 'Vous n’avez pas la permission de crafter';
  if (!plan || plan.status === 'loading') return 'Chargement de la recette…';
  if (plan.status === 'unavailable') return 'Cette recette a été supprimée ou désactivée';
  if (plan.readyNow) return null;
  return plan.status === 'ready'
    ? 'Il faut d’abord crafter les lignes au-dessus'
    : 'Il manque des ingrédients dans le coffre source';
}

function QueueLine({
  entry,
  plan,
  getRecipe,
  actions,
}: {
  entry: CraftQueueEntry;
  plan: LinePlan | undefined;
  getRecipe: RecipeLookup;
  actions: CraftQueueLineActions;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
    disabled: actions.busy,
  });
  const recipe = getRecipe(entry.recipeId);
  const name = actions.itemName(entry.craftedItemId);
  const blocked = craftBlockedReason(plan, actions.canCraft);
  const running = actions.runningId === entry.id;
  const missing = plan && 'missing' in plan ? plan.missing : [];

  return (
    <Paper
      ref={setNodeRef}
      withBorder
      radius="md"
      p="sm"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: 'relative',
        zIndex: isDragging ? 1 : undefined,
        boxShadow: isDragging ? 'var(--disp-shadow-card)' : undefined,
        borderColor: missing.length > 0 ? 'var(--disp-danger-soft-border)' : undefined,
      }}
    >
      <Group wrap="nowrap" align="flex-start" gap="xs">
        <ActionIcon
          variant="subtle"
          color="slate"
          aria-label={`Déplacer ${name}`}
          style={{ cursor: actions.busy ? 'default' : 'grab', touchAction: 'none', flexShrink: 0 }}
          {...attributes}
          {...listeners}
        >
          <IconGripVertical size={18} stroke={1.5} />
        </ActionIcon>

        <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" align="center" gap="xs" wrap="wrap">
            <div style={{ minWidth: 0, flex: '1 1 160px' }}>
              <Group gap="xs" wrap="nowrap">
                <Text fw={600} truncate="end" c="var(--disp-ink)">
                  {name}
                </Text>
                {plan && 'produced' in plan ? (
                  <Badge variant="outline" style={{ ...apothecaryPillStyle(denimPalette), flexShrink: 0 }}>
                    → {plan.produced}
                  </Badge>
                ) : null}
              </Group>
              {recipe && recipe.name !== name ? (
                <Text size="xs" c="dimmed" truncate="end">
                  Recette : {recipe.name}
                </Text>
              ) : null}
            </div>

            <Group gap="xs" wrap="nowrap">
              <TimesInput
                value={entry.times}
                disabled={actions.busy}
                onChange={(times) => actions.onTimesChange(entry, times)}
              />
              <StatusBadge plan={plan} />
              <Tooltip label={blocked} disabled={!blocked || running} withArrow>
                {/* A disabled button gets no hover: the wrapper shows the reason. */}
                <span style={{ display: 'inline-block' }}>
                <Button
                  size="xs"
                  variant="light"
                  color="sage"
                  leftSection={<IconTools size={14} />}
                  disabled={Boolean(blocked) || (actions.busy && !running)}
                  loading={running}
                  onClick={() => actions.onCraft(entry)}
                >
                  Crafter
                </Button>
                </span>
              </Tooltip>
              <ActionIcon
                variant="subtle"
                color="danger"
                aria-label={`Retirer ${name} de la file`}
                disabled={actions.busy}
                onClick={() => actions.onRemove(entry)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Group>

          {missing.length > 0 ? (
            <Stack gap={2}>
              {missing.map((item) => (
                <Group key={item.itemId} gap="xs" wrap="wrap">
                  <Text size="xs" style={{ color: 'var(--disp-danger-soft-text)' }}>
                    Il manque {item.needed - item.available} {item.name} ({item.available} sur{' '}
                    {item.needed})
                  </Text>
                  {actions.isCraftable(item.itemId) ? (
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="sage"
                      leftSection={<IconPlus size={12} />}
                      disabled={actions.busy}
                      onClick={() => actions.onAddSubCraft(entry, item)}
                    >
                      Ajouter le sous-craft
                    </Button>
                  ) : null}
                </Group>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Group>
    </Paper>
  );
}

/** Queue lines in craft order; dragging the handle reorders them. */
export function CraftQueueList({
  entries,
  lines,
  getRecipe,
  actions,
  onReorder,
}: {
  entries: readonly CraftQueueEntry[];
  lines: Record<string, LinePlan>;
  getRecipe: RecipeLookup;
  actions: CraftQueueLineActions;
  onReorder: (entries: CraftQueueEntry[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = entries.findIndex((entry) => entry.id === active.id);
    const to = entries.findIndex((entry) => entry.id === over.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove([...entries], from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={entries.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
        <Stack gap="xs">
          {entries.map((entry) => (
            <QueueLine key={entry.id} entry={entry} plan={lines[entry.id]} getRecipe={getRecipe} actions={actions} />
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  );
}
