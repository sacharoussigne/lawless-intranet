'use client';

import { useMemo } from 'react';
import {
  Stack,
  Paper,
  Group,
  Text,
  Badge,
  ActionIcon,
  ScrollArea,
} from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconTrash,
} from '@tabler/icons-react';
import type { TemplateSegment } from '@lawless-intranet/mail-template-engine';
import { TextSegmentEditor } from './TextSegmentEditor';
import { InputBlockEditor } from './InputBlockEditor';
import { CategoryBlockEditor } from './CategoryBlockEditor';
import { ConditionalBlockEditor } from './ConditionalBlockEditor';
import { JsBlockEditor } from './JsBlockEditor';
import { SegmentToolbar } from './SegmentToolbar';
import {
  moveSegment,
  removeSegmentAtIndex,
  segmentLabel,
  updateSegmentAtIndex,
} from './segmentUtils';

interface TemplateVisualEditorProps {
  segments: TemplateSegment[];
  onChange: (segments: TemplateSegment[]) => void;
}

export function TemplateVisualEditor({
  segments,
  onChange,
}: TemplateVisualEditorProps) {
  const checkboxNames = useMemo(
    () =>
      segments
        .filter(
          (segment): segment is Extract<TemplateSegment, { kind: 'input' }> =>
            segment.kind === 'input' && segment.input.type === 'checkbox' && !segment.input.dependsOn,
        )
        .map((segment) => segment.input.name),
    [segments],
  );

  const updateAt = (index: number, segment: TemplateSegment) => {
    onChange(updateSegmentAtIndex(segments, index, segment));
  };

  const handleRemove = (index: number) => {
    onChange(removeSegmentAtIndex(segments, index));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    onChange(moveSegment(segments, index, direction));
  };

  const handleAdd = (segment: TemplateSegment) => {
    onChange([...segments, segment]);
  };

  if (segments.length === 0) {
    return (
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Commencez par ajouter un bloc de texte ou un champ formulaire.
        </Text>
        <SegmentToolbar onAdd={handleAdd} />
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <ScrollArea h={500} scrollbars="y" type="auto" offsetScrollbars>
        <Stack gap="sm" pr="xs">
          {segments.map((segment, index) => (
            <Paper key={`segment-${index}`} p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Badge variant="light" color="denim">
                    {segmentLabel(segment)}
                  </Badge>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      color="slate"
                      size="sm"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      aria-label="Monter"
                    >
                      <IconArrowUp size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="slate"
                      size="sm"
                      disabled={index === segments.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      aria-label="Descendre"
                    >
                      <IconArrowDown size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="danger"
                      size="sm"
                      onClick={() => handleRemove(index)}
                      aria-label="Supprimer"
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Group>

                {segment.kind === 'text' && (
                  <TextSegmentEditor
                    value={segment.value}
                    onChange={(value) => updateAt(index, { kind: 'text', value })}
                  />
                )}

                {segment.kind === 'input' && (
                  <InputBlockEditor
                    input={segment.input}
                    availableParentNames={checkboxNames}
                    onChange={(input) => updateAt(index, { kind: 'input', input })}
                  />
                )}

                {segment.kind === 'category' && (
                  <CategoryBlockEditor
                    title={segment.title}
                    onChange={(title) => updateAt(index, { kind: 'category', title })}
                  />
                )}

                {segment.kind === 'conditional' && (
                  <ConditionalBlockEditor
                    segment={segment}
                    onChange={(nextSegment) => updateAt(index, nextSegment)}
                  />
                )}

                {segment.kind === 'js' && (
                  <JsBlockEditor
                    code={segment.code}
                    onChange={(code) => updateAt(index, { kind: 'js', code })}
                  />
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </ScrollArea>

      <SegmentToolbar onAdd={handleAdd} />
    </Stack>
  );
}
