'use client';

import { Stack, Textarea, Badge, Text } from '@mantine/core';

interface JsBlockEditorProps {
  code: string;
  onChange: (code: string) => void;
}

export function JsBlockEditor({ code, onChange }: JsBlockEditorProps) {
  return (
    <Stack gap="xs">
      <Badge variant="light" color="denim" w="fit-content">
        Code avancé
      </Badge>
      <Text size="xs" c="dimmed">
        Expression JavaScript évaluée à la génération du courrier.
      </Text>
      <Textarea
        value={code}
        onChange={(event) => onChange(event.currentTarget.value)}
        minRows={4}
        autosize
        styles={{
          input: {
            fontFamily: 'monospace',
          },
        }}
      />
    </Stack>
  );
}
