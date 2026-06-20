'use client';

import { Stack, TextInput, Textarea, Select } from '@mantine/core';
import { BUILTIN_VARIABLES } from './segmentUtils';

interface ConditionalBlockEditorProps {
  varName: string;
  empty: string;
  filled: string;
  onChange: (values: { var: string; empty: string; filled: string }) => void;
}

export function ConditionalBlockEditor({
  varName,
  empty,
  filled,
  onChange,
}: ConditionalBlockEditorProps) {
  return (
    <Stack gap="sm">
      <Select
        label="Variable testée"
        data={BUILTIN_VARIABLES.map((variable) => ({
          value: variable,
          label: `\${${variable}}`,
        }))}
        value={varName}
        onChange={(value) => onChange({ var: value ?? 'description', empty, filled })}
        searchable
        allowDeselect={false}
      />
      <Textarea
        label="Si vide"
        value={empty}
        onChange={(event) =>
          onChange({ var: varName, empty: event.currentTarget.value, filled })
        }
        minRows={2}
        autosize
      />
      <Textarea
        label="Si rempli"
        value={filled}
        onChange={(event) =>
          onChange({ var: varName, empty, filled: event.currentTarget.value })
        }
        minRows={2}
        autosize
      />
    </Stack>
  );
}
