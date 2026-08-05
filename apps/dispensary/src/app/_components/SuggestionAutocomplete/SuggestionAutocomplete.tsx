'use client';

import { useMemo, useState } from 'react';
import { ActionIcon, Autocomplete, Group, Popover, Stack, Text, Button } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';

interface SuggestionAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  extraOptions?: string[];
  onAddSuggestion: (value: string) => Promise<void>;
  onDeleteSuggestion: (value: string, e?: React.MouseEvent) => Promise<void>;
  placeholder?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function SuggestionAutocomplete({
  value,
  onChange,
  suggestions,
  extraOptions = [],
  onAddSuggestion,
  onDeleteSuggestion,
  placeholder = '',
  size = 'xs',
}: SuggestionAutocompleteProps) {
  const [deleteMenuForValue, setDeleteMenuForValue] = useState<string | null>(null);

  const data = useMemo(() => {
    const merged = [...extraOptions];
    for (const suggestion of suggestions) {
      if (!merged.some((v) => v.toLowerCase() === suggestion.toLowerCase())) {
        merged.push(suggestion);
      }
    }
    return merged;
  }, [suggestions, extraOptions]);

  const deletableSet = useMemo(
    () => new Set(suggestions.map((s) => s.toLowerCase())),
    [suggestions],
  );

  const canAddSuggestion =
    value &&
    value.trim().length > 0 &&
    !suggestions.some((s) => s.toLowerCase() === value.toLowerCase().trim()) &&
    !extraOptions.some((s) => s.toLowerCase() === value.toLowerCase().trim());

  return (
    <Autocomplete
      data={data}
      value={value}
      onChange={onChange}
      size={size}
      placeholder={placeholder}
      renderOption={({ option }) => {
        const canDelete = deletableSet.has(option.value.toLowerCase());

        return (
          <Group justify="space-between" style={{ flex: 1 }}>
            <Text size="xs" style={{ flex: 1 }}>
              {option.value}
            </Text>
            {canDelete && (
              <Popover
                position="top"
                withArrow
                shadow="md"
                withinPortal
                opened={deleteMenuForValue === option.value}
                onChange={(opened) => {
                  if (!opened) setDeleteMenuForValue(null);
                }}
              >
                <Popover.Target>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="danger"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteMenuForValue((v) =>
                        v === option.value ? null : option.value,
                      );
                    }}
                  >
                    <IconTrash size={12} />
                  </ActionIcon>
                </Popover.Target>
                <Popover.Dropdown>
                  <Stack gap="xs" p="xs">
                    <Text size="sm" fw={500}>
                      Supprimer la suggestion
                    </Text>
                    <Text size="xs" c="dimmed">
                      Supprimer &quot;{option.value}&quot; des suggestions ?
                    </Text>
                    <Group gap="xs" justify="flex-end" mt="xs">
                      <Button
                        size="xs"
                        variant="subtle"
                        color="slate"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteMenuForValue(null);
                        }}
                      >
                        Annuler
                      </Button>
                      <Button
                        size="xs"
                        color="danger"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void (async () => {
                            await onDeleteSuggestion(option.value, e);
                            setDeleteMenuForValue(null);
                          })();
                        }}
                      >
                        Supprimer
                      </Button>
                    </Group>
                  </Stack>
                </Popover.Dropdown>
              </Popover>
            )}
          </Group>
        );
      }}
      comboboxProps={{ withinPortal: true }}
      rightSection={
        canAddSuggestion ? (
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={(e) => {
              e?.stopPropagation();
              onAddSuggestion(value);
            }}
          >
            <IconPlus size={14} />
          </ActionIcon>
        ) : null
      }
    />
  );
}
