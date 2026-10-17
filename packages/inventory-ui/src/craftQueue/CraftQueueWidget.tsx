'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Popover,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
  Transition,
} from '@mantine/core';
import { IconChevronDown, IconPlayerPlay, IconTools, IconTrashX } from '@tabler/icons-react';
import type { ChestListItem } from '../types';
import { CraftIngredientsSummary } from './CraftIngredientsSummary';
import { CraftQueueList } from './CraftQueueList';
import type { CraftQueue } from './useCraftQueue';

/** Above the host's bottom bar (phones) and the home indicator. */
const FLOATING_BOTTOM = 'calc(var(--app-bottom-bar-height, 0px) + env(safe-area-inset-bottom, 0px) + 16px)';
const PANEL_WIDTH = 'min(540px, calc(100vw - 24px))';

function ClearQueueButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  const [opened, setOpened] = useState(false);
  return (
    <Popover opened={opened} onChange={setOpened} position="top-start" withArrow shadow="md">
      <Popover.Target>
        <Button
          size="xs"
          variant="subtle"
          color="slate"
          leftSection={<IconTrashX size={14} />}
          disabled={disabled}
          onClick={() => setOpened((value) => !value)}
        >
          Vider
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
 * Floating craft queue, like a game's crafting queue: a pill in the corner
 * (count, red dot when something is missing) opening a panel with the lines,
 * what to have in the chests, and « Tout crafter ». Hidden while empty.
 */
export function CraftQueueWidget({
  queue,
  chests,
  canCraft,
}: {
  queue: CraftQueue;
  chests: readonly ChestListItem[];
  canCraft: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [tab, setTab] = useState<'queue' | 'needs'>('queue');
  const { entries, plan, runner } = queue;
  if (entries.length === 0) return null;

  const chestName = (chestId: string) => chests.find((chest) => chest.id === chestId)?.name ?? 'Coffre';
  const missingIngredients = plan.ingredients.filter((ingredient) => ingredient.missing > 0).length;
  const craftAllBlocked = !canCraft
    ? 'Vous n’avez pas la permission de crafter'
    : !plan.canCraftAll
      ? 'Il manque des ingrédients, ou une recette est indisponible'
      : null;
  const labelOf = (entry: (typeof entries)[number]) => queue.itemName(entry.craftedItemId);

  return (
    <Box pos="fixed" right={12} bottom={FLOATING_BOTTOM} style={{ zIndex: 190 }}>
      <Transition mounted={opened} transition="pop-bottom-right" duration={150}>
        {(styles) => (
          <Paper
            withBorder
            radius="lg"
            shadow="xl"
            w={PANEL_WIDTH}
            mb="xs"
            style={{
              ...styles,
              display: 'flex',
              flexDirection: 'column',
              maxHeight: `calc(100dvh - ${FLOATING_BOTTOM} - 140px)`,
            }}
          >
            <Group justify="space-between" wrap="nowrap" px="md" pt="sm" pb="xs">
              <Group gap="xs" wrap="nowrap">
                <IconTools size={18} color="var(--disp-sage-soft-text)" />
                <Text fw={600} c="var(--disp-ink)">
                  File de craft
                </Text>
                <Badge size="sm" variant="light" color="sage">
                  {entries.length}
                </Badge>
              </Group>
              <ActionIcon variant="subtle" color="slate" aria-label="Replier la file" onClick={() => setOpened(false)}>
                <IconChevronDown size={18} />
              </ActionIcon>
            </Group>

            <Box px="md" pb="xs">
              <SegmentedControl
                fullWidth
                size="xs"
                value={tab}
                onChange={(value) => setTab(value === 'needs' ? 'needs' : 'queue')}
                data={[
                  { value: 'queue', label: `Crafts (${entries.length})` },
                  {
                    value: 'needs',
                    label: missingIngredients > 0 ? `À prévoir · ${missingIngredients} manquant${missingIngredients > 1 ? 's' : ''}` : 'À prévoir',
                  },
                ]}
              />
            </Box>

            <ScrollArea.Autosize mah="100%" style={{ flex: 1, minHeight: 0 }} px="md" type="auto" scrollbars="y">
              <Box pb="sm">
                {tab === 'queue' ? (
                  <>
                    {entries.length > 1 ? (
                      <Text size="xs" c="dimmed" mb={6}>
                        Les crafts se font de haut en bas : glissez pour réordonner.
                      </Text>
                    ) : null}
                    <CraftQueueList queue={queue} chestName={chestName} canCraft={canCraft} />
                  </>
                ) : (
                  <CraftIngredientsSummary ingredients={plan.ingredients} chestName={chestName} />
                )}
              </Box>
            </ScrollArea.Autosize>

            <Group
              justify="space-between"
              wrap="nowrap"
              px="md"
              py="sm"
              style={{ borderTop: '1px solid var(--disp-surface-border)' }}
            >
              <ClearQueueButton disabled={runner.busy} onConfirm={queue.clear} />
              <Tooltip label={craftAllBlocked} disabled={!craftAllBlocked} withArrow>
                <span style={{ display: 'inline-block' }}>
                  <Button
                    size="sm"
                    color="sage"
                    leftSection={<IconPlayerPlay size={16} />}
                    disabled={Boolean(craftAllBlocked) || (runner.busy && !runner.runningAll)}
                    loading={runner.runningAll}
                    onClick={() => void runner.craftAll(entries, labelOf)}
                  >
                    Tout crafter ({entries.length})
                  </Button>
                </span>
              </Tooltip>
            </Group>
          </Paper>
        )}
      </Transition>

      {!opened ? (
        <Group justify="flex-end">
          <Box pos="relative">
            <Button
              color="sage"
              radius="xl"
              size="md"
              leftSection={<IconTools size={18} />}
              rightSection={
                <Badge size="sm" variant="white" color="sage" circle={entries.length < 10}>
                  {entries.length}
                </Badge>
              }
              onClick={() => setOpened(true)}
              aria-label={`Ouvrir la file de craft (${entries.length})`}
              style={{ boxShadow: 'var(--disp-shadow-elevated)' }}
            >
              File de craft
            </Button>
            {plan.missingCount > 0 ? (
              <Box
                title="Ingrédients manquants"
                style={{
                  position: 'absolute',
                  top: -3,
                  right: -3,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: 'var(--mantine-color-danger-filled)',
                  border: '2px solid var(--disp-surface)',
                  pointerEvents: 'none',
                }}
              />
            ) : null}
          </Box>
        </Group>
      ) : null}
    </Box>
  );
}
