'use client';

import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Button, Group, Popover, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { IconCheck, IconEdit, IconScale } from '@tabler/icons-react';
import type { ItemWithRelations } from '@/types/stock';
import { evaluateDecimalExpression, evaluateIntegerExpression } from '@/lib/stock/expression';

interface EditableStockCellProps {
  item: ItemWithRelations;
  hasStockToday: boolean;
  initialValue: number | null;
  disabled?: boolean;
  onCommitQuantity: (itemId: string, quantity: number | null) => void;
}

export const EditableStockCell = ({
  item,
  hasStockToday,
  initialValue,
  disabled = false,
  onCommitQuantity,
}: EditableStockCellProps) => {
  const initialString = initialValue !== null ? String(initialValue) : '';
  const [inputValue, setInputValue] = useState(initialString);

  const [weightPopoverOpened, setWeightPopoverOpened] = useState(false);
  const [weightInputValue, setWeightInputValue] = useState<string>('');
  const [snapshot, setSnapshot] = useState<{ input: string; quantity: number | null } | null>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!weightPopoverOpened) return;

    const frameId = requestAnimationFrame(() => {
      weightInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frameId);
  }, [weightPopoverOpened]);

  const commitQuantityIfChanged = (quantity: number | null) => {
    if (quantity === initialValue) return;
    onCommitQuantity(item.id, quantity);
  };

  const commitFromInput = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      commitQuantityIfChanged(null);
      return;
    }

    if (/[\+\-\*\/]/.test(trimmed)) {
      const result = evaluateIntegerExpression(trimmed);
      if (result !== '') {
        setInputValue(String(result));
        commitQuantityIfChanged(result);
      }
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return;
    }
    commitQuantityIfChanged(parsed);
  };

  const computeQuantityFromWeight = (raw: string): number | null => {
    if (!item.weight || item.weight <= 0) return null;
    const trimmed = raw.trim();
    if (trimmed === '') return null;

    let weightInKg: number;
    if (/[\+\-\*\/]/.test(trimmed)) {
      const result = evaluateDecimalExpression(trimmed);
      if (result === '') return null;
      weightInKg = result;
    } else {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return null;
      weightInKg = parsed;
    }

    if (weightInKg <= 0) return null;
    return Math.round(weightInKg / item.weight);
  };

  const rightSectionWidth = hasStockToday && item.weight != null && item.weight > 0 ? 60 : undefined;

  return (
    <TextInput
      value={inputValue}
      onChange={(e) => setInputValue(String(e.currentTarget.value))}
      onBlur={(e) => commitFromInput(e.currentTarget.value)}
      disabled={disabled}
      placeholder="Quantité (ex: 30 + 45)"
      style={{ maxWidth: 200 }}
      rightSectionWidth={rightSectionWidth}
      rightSection={
        <Group gap={2} wrap="nowrap">
          {hasStockToday && (
            <Tooltip label="Mise à jour du stock existant">
              <ActionIcon size="sm" variant="subtle" tabIndex={-1}>
                <IconEdit size={14} />
              </ActionIcon>
            </Tooltip>
          )}

          {item.weight != null && item.weight > 0 && (
            <Popover
              position="top"
              withArrow
              shadow="md"
              trapFocus
              returnFocus={false}
              opened={weightPopoverOpened}
              onChange={setWeightPopoverOpened}
            >
              <Popover.Target>
                <Tooltip label="Calculer à partir du poids">
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      const isOpening = !weightPopoverOpened;
                      setWeightPopoverOpened(isOpening);
                      if (isOpening) {
                        setSnapshot({ input: inputValue, quantity: initialValue });
                        setWeightInputValue('');
                      }
                    }}
                  >
                    <IconScale size={14} />
                  </ActionIcon>
                </Tooltip>
              </Popover.Target>
              <Popover.Dropdown>
                <Stack gap="xs" p="xs">
                  <Text size="sm" fw={500}>
                    Calculer à partir du poids
                  </Text>
                  <Text size="xs" c="dimmed">
                    Poids unitaire: {item.weight} kg
                  </Text>
                  <TextInput
                    ref={weightInputRef}
                    value={weightInputValue}
                    onChange={(e) => {
                      const v = String(e.currentTarget.value);
                      setWeightInputValue(v);
                      const computed = computeQuantityFromWeight(v);
                      if (computed != null) {
                        setInputValue(String(computed));
                      }
                    }}
                    placeholder="Poids en kg (ex: 2.5 + 1.2)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const computed = computeQuantityFromWeight(weightInputValue);
                        if (computed != null) {
                          setInputValue(String(computed));
                          commitQuantityIfChanged(computed);
                        }
                        setWeightPopoverOpened(false);
                        setWeightInputValue('');
                      }
                    }}
                    size="xs"
                    rightSection={
                      <Group gap={2} wrap="nowrap" pr={16}>
                        <Text size="xs" c="dimmed">
                          KG
                        </Text>
                        {weightInputValue && /[\+\-\*\/]/.test(weightInputValue) ? (
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            onClick={() => {
                              const trimmed = weightInputValue.trim();
                              if (!trimmed) return;
                              const result = evaluateDecimalExpression(trimmed);
                              if (result !== '') setWeightInputValue(String(result));
                            }}
                          >
                            <IconCheck size={12} />
                          </ActionIcon>
                        ) : undefined}
                      </Group>
                    }
                  />
                  <Group gap="xs" justify="flex-end" mt="xs">
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => {
                        if (snapshot) {
                          setInputValue(snapshot.input);
                          onCommitQuantity(item.id, snapshot.quantity);
                        }
                        setWeightPopoverOpened(false);
                        setWeightInputValue('');
                      }}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="xs"
                      onClick={() => {
                        const computed = computeQuantityFromWeight(weightInputValue);
                        if (computed != null) {
                          setInputValue(String(computed));
                          commitQuantityIfChanged(computed);
                        }
                        setWeightPopoverOpened(false);
                        setWeightInputValue('');
                      }}
                    >
                      Valider
                    </Button>
                  </Group>
                </Stack>
              </Popover.Dropdown>
            </Popover>
          )}
        </Group>
      }
    />
  );
};

