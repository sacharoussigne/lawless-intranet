'use client';

import { Badge, Group, Stack, Table, Text } from '@mantine/core';
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react';
import { apothecaryBooleanPills } from '../lib/apothecaryPill';
import type { IngredientTotal } from './plan';

const MISSING_ROW = { backgroundColor: 'var(--disp-danger-soft)' };
const MISSING_TEXT = { color: 'var(--disp-danger-soft-text)' };

/** What the whole queue needs in each source chest, against what is there. */
export function CraftIngredientsSummary({
  ingredients,
  chestName,
}: {
  ingredients: readonly IngredientTotal[];
  chestName: (chestId: string) => string;
}) {
  if (ingredients.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Aucun ingrédient nécessaire.
      </Text>
    );
  }

  const chestIds = [...new Set(ingredients.map((ingredient) => ingredient.chestId))];
  const missingCount = ingredients.filter((ingredient) => ingredient.missing > 0).length;

  return (
    <Stack gap="sm">
      {chestIds.map((chestId) => (
        <Stack key={chestId} gap={4}>
          <Text size="xs" fw={600} tt="uppercase" c="dimmed">
            À avoir dans « {chestName(chestId)} »
          </Text>
          <Table verticalSpacing={4} horizontalSpacing={6} fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Ingrédient</Table.Th>
                <Table.Th ta="right" style={{ whiteSpace: 'nowrap' }}>
                  À avoir
                </Table.Th>
                <Table.Th ta="right">Stock</Table.Th>
                <Table.Th ta="right" w={64} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {ingredients
                .filter((ingredient) => ingredient.chestId === chestId)
                .map((ingredient) => {
                  const short = ingredient.missing > 0;
                  return (
                    <Table.Tr key={ingredient.itemId} style={short ? MISSING_ROW : undefined}>
                      <Table.Td>
                        <Text size="sm" fw={500} style={short ? MISSING_TEXT : undefined}>
                          {ingredient.name}
                        </Text>
                        {ingredient.producedInQueue > 0 ? (
                          <Text size="xs" c="dimmed">
                            dont {ingredient.producedInQueue} crafté{ingredient.producedInQueue > 1 ? 's' : ''} dans la file
                          </Text>
                        ) : null}
                      </Table.Td>
                      <Table.Td ta="right" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {ingredient.toHave}
                      </Table.Td>
                      <Table.Td ta="right" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {ingredient.available}
                      </Table.Td>
                      <Table.Td ta="right">
                        {short ? (
                          <Badge size="sm" variant="outline" style={apothecaryBooleanPills.noAlert}>
                            −{ingredient.missing}
                          </Badge>
                        ) : (
                          <Badge size="sm" variant="outline" style={apothecaryBooleanPills.yes}>
                            OK
                          </Badge>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
            </Table.Tbody>
          </Table>
        </Stack>
      ))}

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
    </Stack>
  );
}
