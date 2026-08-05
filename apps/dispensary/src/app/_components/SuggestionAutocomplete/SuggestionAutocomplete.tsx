'use client';

import { useMemo } from 'react';
import { ActionIcon, Autocomplete, Group, Text } from '@mantine/core';
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
  const data = useMemo(() => {
    const merged = [...suggestions];
    for (const option of extraOptions) {
      if (!merged.some((v) => v.toLowerCase() === option.toLowerCase())) {
        merged.push(option);
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
          <Group justify="space-between" gap="xs" wrap="nowrap" style={{ flex: 1 }}>
            <Text size="xs" style={{ flex: 1, minWidth: 0 }} truncate>
              {option.value}
            </Text>
            {canDelete ? (
              <ActionIcon
                size="xs"
                variant="subtle"
                color="danger"
                aria-label={`Supprimer la suggestion ${option.value}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void onDeleteSuggestion(option.value, e);
                }}
              >
                <IconTrash size={12} />
              </ActionIcon>
            ) : null}
          </Group>
        );
      }}
      comboboxProps={{ withinPortal: true }}
      rightSection={
        canAddSuggestion ? (
          <ActionIcon
            size="sm"
            variant="subtle"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              void onAddSuggestion(value);
            }}
          >
            <IconPlus size={14} />
          </ActionIcon>
        ) : null
      }
    />
  );
}
