'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  parseTemplateDocument,
  serializeTemplateDocument,
  type TemplateSegment,
} from '@lawless-intranet/mail-template-engine';
import { TemplateEditor } from './TemplateEditor';
import { DetectedParameters } from './DetectedParameters';
import { TemplateVisualEditor } from './visual/TemplateVisualEditor';
import { createDefaultSegment } from './visual/segmentUtils';

type EditorMode = 'visual' | 'inline';

interface TemplateEditorWithModesProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  showParametersPanel?: boolean;
}

function buildSegmentsFromContent(content: string): {
  segments: TemplateSegment[];
  warnings: string[];
} {
  const { document, warnings } = parseTemplateDocument(content);
  return {
    segments:
      document.segments.length > 0
        ? document.segments
        : [createDefaultSegment('text')],
    warnings: warnings.map((warning) => warning.message),
  };
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
  const initial = buildSegmentsFromContent(value);
  const [segments, setSegments] = useState<TemplateSegment[]>(initial.segments);
  const [warnings, setWarnings] = useState<string[]>(initial.warnings);
  const lastEmittedRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const pendingParentSyncRef = useRef(false);

  const syncVisualFromContent = useCallback((content: string) => {
    const parsed = buildSegmentsFromContent(content);
    setSegments(parsed.segments);
    setWarnings(parsed.warnings);
  }, []);

  const handleSegmentsChange = useCallback((nextSegments: TemplateSegment[]) => {
    setSegments(nextSegments);
    const serialized = serializeTemplateDocument({ segments: nextSegments });
    if (serialized === lastEmittedRef.current) {
      return;
    }
    lastEmittedRef.current = serialized;
    pendingParentSyncRef.current = true;
    onChangeRef.current(serialized);
  }, []);

  useEffect(() => {
    if (mode !== 'visual') return;

    if (pendingParentSyncRef.current) {
      if (value === lastEmittedRef.current) {
        pendingParentSyncRef.current = false;
      }
      return;
    }

    if (value === lastEmittedRef.current) return;

    lastEmittedRef.current = value;
    syncVisualFromContent(value);
  }, [value, mode, syncVisualFromContent]);

  const handleModeChange = (nextMode: string) => {
    const typedMode = nextMode as EditorMode;
    if (typedMode === mode) return;

    if (typedMode === 'visual') {
      lastEmittedRef.current = value;
      syncVisualFromContent(value);
    } else {
      const serialized = serializeTemplateDocument({ segments });
      if (serialized !== value) {
        lastEmittedRef.current = serialized;
        onChangeRef.current(serialized);
      }
    }

    setMode(typedMode);
  };

  const detectedContent = useMemo(
    () => serializeTemplateDocument({ segments }),
    [segments],
  );

  const modeControl = (
    <SegmentedControl
      value={mode}
      onChange={handleModeChange}
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
        <TemplateVisualEditor segments={segments} onChange={handleSegmentsChange} />
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
                <DetectedParameters content={detectedContent} />
              </ScrollArea>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
