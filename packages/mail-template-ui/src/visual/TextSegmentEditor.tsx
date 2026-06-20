'use client';

import { Stack, Textarea, Group, Menu, Button } from '@mantine/core';
import { IconVariable } from '@tabler/icons-react';
import { BUILTIN_VARIABLES } from './segmentUtils';

interface TextSegmentEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TextSegmentEditor({ value, onChange }: TextSegmentEditorProps) {
  const insertVariable = (variable: string) => {
    onChange(`${value}\${${variable}}`);
  };

  return (
    <Stack gap="xs">
      <Group justify="flex-end">
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <Button
              variant="light"
              color="leather"
              size="xs"
              leftSection={<IconVariable size={14} />}
            >
              Insérer variable
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {BUILTIN_VARIABLES.map((variable) => (
              <Menu.Item key={variable} onClick={() => insertVariable(variable)}>
                {'${'}
                {variable}
                {'}'}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="Texte du courrier…"
        minRows={3}
        autosize
      />
    </Stack>
  );
}
