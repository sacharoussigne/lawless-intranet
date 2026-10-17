'use client';

import { Badge, Group, Paper, Stack, Table, Text } from '@mantine/core';
import { IconCircleCheck, IconAlertTriangle } from '@tabler/icons-react';
import { apothecaryBooleanPills } from '../lib/apothecaryPill';
import type { IngredientTotal } from './plan';

const MISSING_ROW = { backgroundColor: 'var(--disp-danger-soft)' };
const MISSING_TEXT = { color: 'var(--disp-danger-soft-text)' };

/** What the whole queue needs in the source chest, against what is there. */
export function CraftIngredientsSummary({
  ingredients,
  chestName,
}: {
  ingredients: readonly IngredientTotal[];
  chestName: string | null;
}) {
  const missingCount = ingredients.filter((ingredient) => ingredient.missing > 0).length;

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <div>
          <Text fw={600} c="var(--disp-ink)">
            À prévoir
          </Text>
          <Text size="xs" c="dimmed">
            {chestName ? `Ingrédients à avoir dans « ${chestName} » avant de lancer la file` : 'Choisissez un coffre source'}
          </Text>
        </div>

        {ingredients.length === 0 ? (
          <Text size="sm" c="dimmed">
            Ajoutez des crafts à la file pour voir les ingrédients nécessaires.
          </Text>
        ) : (
          <>
            <Table.ScrollContainer minWidth={320}>
              <Table verticalSpacing={6} horizontalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Ingrédient</Table.Th>
                    <Table.Th ta="right">À avoir</Table.Th>
                    <Table.Th ta="right">En stock</Table.Th>
                    <Table.Th ta="right">Statut</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ingredients.map((ingredient) => {
                    const short = ingredient.missing > 0;
                    return (
                      <Table.Tr key={ingredient.itemId} style={short ? MISSING_ROW : undefined}>
                        <Table.Td>
                          <Text size="sm" fw={500} style={short ? MISSING_TEXT : undefined}>
                            {ingredient.name}
                          </Text>
                          {ingredient.producedInQueue > 0 ? (
                            <Text size="xs" c="dimmed">
                              dont {ingredient.producedInQueue} crafté{ingredient.producedInQueue > 1 ? 's' : ''} dans la
                              file
                            </Text>
                          ) : null}
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {ingredient.toHave}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {ingredient.available}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          {short ? (
                            <Badge variant="outline" style={apothecaryBooleanPills.noAlert}>
                              −{ingredient.missing}
                            </Badge>
                          ) : (
                            <Badge variant="outline" style={apothecaryBooleanPills.yes}>
                              OK
                            </Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            <Group gap={6} wrap="nowrap">
              {missingCount > 0 ? (
                <>
                  <IconAlertTriangle size={16} style={{ ...MISSING_TEXT, flexShrink: 0 }} />
                  <Text size="sm" style={MISSING_TEXT}>
                    Il manque {missingCount} ingrédient{missingCount > 1 ? 's' : ''} pour toute la file.
                  </Text>
                </>
              ) : (
                <>
                  <IconCircleCheck size={16} style={{ color: 'var(--disp-moss-soft-text)', flexShrink: 0 }} />
                  <Text size="sm" style={{ color: 'var(--disp-moss-soft-text)' }}>
                    Tout est disponible.
                  </Text>
                </>
              )}
            </Group>
          </>
        )}
      </Stack>
    </Paper>
  );
}
