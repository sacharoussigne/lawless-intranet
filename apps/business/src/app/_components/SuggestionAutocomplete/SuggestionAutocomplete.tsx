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
  label?: string;
  required?: boolean;
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
  label,
  required,
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
    Boolean(value?.trim()) &&
    !suggestions.some((s) => s.toLowerCase() === value.toLowerCase().trim()) &&
    !extraOptions.some((s) => s.toLowerCase() === value.toLowerCase().trim());

  return (
    <Autocomplete
      data={data}
      value={value}
      onChange={onChange}
      size={size}
      label={label}
      required={required}
      placeholder={placeholder}
      renderOption={({ option }) => {
        const canDelete = deletableSet.has(option.value.toLowerCase());

        return (
          <Group
            gap="xs"
            wrap="nowrap"
            align="flex-start"
            justify="space-between"
            w="100%"
            style={{ minWidth: 0 }}
          >
            <Text
              size="xs"
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                lineHeight: 1.35,
              }}
            >
              {option.value}
            </Text>
            {canDelete ? (
              <ActionIcon
                size="xs"
                variant="subtle"
                color="danger"
                aria-label={`Supprimer la suggestion ${option.value}`}
                style={{ flex: '0 0 auto', marginTop: 1 }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void onDeleteSuggestion(option.value, e);
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <IconTrash size={12} />
              </ActionIcon>
            ) : null}
          </Group>
        );
      }}
      comboboxProps={{
        withinPortal: true,
      }}
      styles={{
        option: {
          paddingInline: 8,
          paddingBlock: 6,
          alignItems: 'flex-start',
        },
      }}
      rightSection={
        canAddSuggestion ? (
          <ActionIcon
            size="sm"
            variant="subtle"
            aria-label="Ajouter aux suggestions"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
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
