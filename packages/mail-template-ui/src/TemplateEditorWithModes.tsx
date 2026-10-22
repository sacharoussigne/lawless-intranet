'use client';

import { useMemo, useState } from 'react';
import {
  Stack,
  SegmentedControl,
  Grid,
  Text,
  Paper,
  ScrollArea,
  Alert,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { parseTemplateDocument } from '@lawless-intranet/mail-template-engine';
import { TemplateEditor } from './TemplateEditor';
import { DetectedParameters } from './DetectedParameters';
import { TemplateRichEditor } from './richText/TemplateRichEditor';

type EditorMode = 'visual' | 'inline';

interface TemplateEditorWithModesProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  showParametersPanel?: boolean;
}

export function TemplateEditorWithModes({
  value,
  onChange,
  label = 'Contenu',
  placeholder,
  required,
  showParametersPanel = true,
}: TemplateEditorWithModesProps) {
  const [mode, setMode] = useState<EditorMode>('visual');
  const warnings = useMemo(
    () => parseTemplateDocument(value).warnings.map((warning) => warning.message),
    [value],
  );

  const modeControl = (
    <SegmentedControl
      value={mode}
      onChange={(next) => setMode(next as EditorMode)}
      data={[
        { label: 'Visuel', value: 'visual' },
        { label: 'Inline', value: 'inline' },
      ]}
    />
  );

  const editorContent =
    mode === 'inline' ? (
      <TemplateEditor
        label={label}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={onChange}
        hideParameters
        fixedHeight
      />
    ) : (
      <Stack gap="sm">
        {warnings.length > 0 && (
          <Alert color="amber" icon={<IconAlertTriangle size={16} />}>
            {warnings.join(' ')}
          </Alert>
        )}
        <TemplateRichEditor value={value} onChange={onChange} />
      </Stack>
    );

  if (!showParametersPanel) {
    return (
      <Stack gap="md">
        {modeControl}
        {editorContent}
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {modeControl}
      <Grid gutter="xl">
        <Grid.Col span={6} style={{ minWidth: 0 }}>
          <Stack gap="md">
            <Text size="sm" fw={600}>
              Éditeur
            </Text>
            <Paper p="md" withBorder>
              {editorContent}
            </Paper>
          </Stack>
        </Grid.Col>
        <Grid.Col span={6} style={{ minWidth: 0 }}>
          <Stack gap="md">
            <Text size="sm" fw={600}>
              Paramètres détectés
            </Text>
            <Paper p="md" withBorder>
              <ScrollArea h={500} scrollbars="y" type="auto">
                <DetectedParameters content={value} />
              </ScrollArea>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
