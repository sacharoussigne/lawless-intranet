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
import { ActionIcon, Badge, Button, Group, Loader, NumberInput, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { IconGripVertical, IconPlus, IconTools, IconX } from '@tabler/icons-react';
import { apothecaryBooleanPills, apothecaryPillStyle, denimPalette } from '../lib/apothecaryPill';
import type { CraftQueueEntry, LinePlan } from './plan';
import type { CraftQueue } from './useCraftQueue';

/** Craft count of a line: a cleared or invalid field is only kept while typing. */
function TimesInput({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (times: number) => void }) {
  const [draft, setDraft] = useState<number | string | null>(null);
  return (
    <NumberInput
      size="xs"
      w={72}
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
      <Badge size="sm" variant="outline" style={apothecaryBooleanPills.noAlert}>
        Indisponible
      </Badge>
    );
  }
  return plan.status === 'ready' ? (
    <Badge size="sm" variant="outline" style={apothecaryBooleanPills.yes}>
      Prêt
    </Badge>
  ) : (
    <Badge size="sm" variant="outline" style={apothecaryBooleanPills.noAlert}>
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

type LineProps = {
  entry: CraftQueueEntry;
  queue: CraftQueue;
  chestName: (chestId: string) => string;
  canCraft: boolean;
};

function QueueLine({ entry, queue, chestName, canCraft }: LineProps) {
  const { runner } = queue;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
    disabled: runner.busy,
  });
  const plan = queue.plan.lines[entry.id];
  const recipe = queue.getRecipe(entry.recipeId);
  const name = queue.itemName(entry.craftedItemId);
  const blocked = craftBlockedReason(plan, canCraft);
  const running = runner.runningId === entry.id;
  const missing = plan && 'missing' in plan ? plan.missing : [];
  const chests =
    entry.sourceChestId === entry.destinationChestId
      ? chestName(entry.sourceChestId)
      : `${chestName(entry.sourceChestId)} → ${chestName(entry.destinationChestId)}`;

  return (
    <Paper
      ref={setNodeRef}
      withBorder
      radius="md"
      p={8}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: 'relative',
        zIndex: isDragging ? 1 : undefined,
        boxShadow: isDragging ? 'var(--disp-shadow-card)' : undefined,
        borderColor: missing.length > 0 ? 'var(--disp-danger-soft-border)' : undefined,
      }}
    >
      <Group wrap="nowrap" align="flex-start" gap={4}>
        <ActionIcon
          variant="subtle"
          color="slate"
          size="sm"
          aria-label={`Déplacer ${name}`}
          style={{ cursor: runner.busy ? 'default' : 'grab', touchAction: 'none', flexShrink: 0, marginTop: 2 }}
          {...attributes}
          {...listeners}
        >
          <IconGripVertical size={16} stroke={1.5} />
        </ActionIcon>

        <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={6} wrap="nowrap" justify="space-between">
            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} truncate="end" c="var(--disp-ink)" title={recipe ? `Recette : ${recipe.name}` : undefined}>
                {name}
              </Text>
              {plan && 'produced' in plan ? (
                <Badge size="sm" variant="outline" style={{ ...apothecaryPillStyle(denimPalette), flexShrink: 0 }}>
                  → {plan.produced}
                </Badge>
              ) : null}
            </Group>
            <ActionIcon
              variant="subtle"
              color="slate"
              size="sm"
              aria-label={`Retirer ${name} de la file`}
              disabled={runner.busy}
              onClick={() => queue.remove(entry.id)}
            >
              <IconX size={14} />
            </ActionIcon>
          </Group>

          <Group gap={6} wrap="nowrap" justify="space-between">
            <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
              <TimesInput
                value={entry.times}
                disabled={runner.busy}
                onChange={(times) => queue.setTimes(entry.id, times)}
              />
              <Text size="xs" c="dimmed" truncate="end" title={chests} style={{ minWidth: 0, flex: 1 }}>
                {chests}
              </Text>
            </Group>
            <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
              <StatusBadge plan={plan} />
              <Tooltip label={blocked} disabled={!blocked || running} withArrow>
                {/* A disabled button gets no hover: the wrapper shows the reason. */}
                <span style={{ display: 'inline-block' }}>
                  <Button
                    size="compact-sm"
                    variant="light"
                    color="sage"
                    leftSection={<IconTools size={14} />}
                    disabled={Boolean(blocked) || (runner.busy && !running)}
                    loading={running}
                    onClick={() => void runner.craftLine(entry, name)}
                  >
                    Crafter
                  </Button>
                </span>
              </Tooltip>
            </Group>
          </Group>

          {missing.length > 0 ? (
            <Stack gap={2}>
              {missing.map((item) => (
                <Group key={item.itemId} gap={4} wrap="wrap">
                  <Text size="xs" style={{ color: 'var(--disp-danger-soft-text)' }}>
                    Il manque {item.needed - item.available} {item.name} ({item.available} sur {item.needed})
                  </Text>
                  {queue.isCraftable(item.itemId) ? (
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="sage"
                      leftSection={<IconPlus size={12} />}
                      disabled={runner.busy}
                      onClick={() => void queue.addSubCraft(entry, item.itemId, item.needed - item.available)}
                    >
                      Sous-craft
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
  queue,
  chestName,
  canCraft,
}: {
  queue: CraftQueue;
  chestName: (chestId: string) => string;
  canCraft: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const { entries } = queue;

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = entries.findIndex((entry) => entry.id === active.id);
    const to = entries.findIndex((entry) => entry.id === over.id);
    if (from >= 0 && to >= 0) queue.reorder(arrayMove([...entries], from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={entries.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
        <Stack gap={6}>
          {entries.map((entry) => (
            <QueueLine key={entry.id} entry={entry} queue={queue} chestName={chestName} canCraft={canCraft} />
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  );
}
