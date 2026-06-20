'use client';

import { Stack, TextInput, Textarea, Select, SegmentedControl, Button, Group } from '@mantine/core';
import type { TemplateSegment } from '@lawless-intranet/mail-template-engine';
import { BUILTIN_VARIABLES } from './segmentUtils';

type ConditionalSegment = Extract<TemplateSegment, { kind: 'conditional' }>;

interface ConditionalBlockEditorProps {
  segment: ConditionalSegment;
  onChange: (segment: ConditionalSegment) => void;
}

function isEqualsMode(segment: ConditionalSegment): segment is Extract<ConditionalSegment, { eq: string }> {
  return 'eq' in segment && typeof segment.eq === 'string';
}

export function ConditionalBlockEditor({
  segment,
  onChange,
}: ConditionalBlockEditorProps) {
  const mode = isEqualsMode(segment) ? 'equals' : 'emptyFilled';

  const handleModeChange = (nextMode: string) => {
    if (nextMode === mode) return;

    if (nextMode === 'equals') {
      onChange({
        kind: 'conditional',
        var: segment.var || 'gender',
        eq: 'female',
        then: 'Je soussignée',
        else: 'Je soussigné',
      });
      return;
    }

    onChange({
      kind: 'conditional',
      var: segment.var || 'description',
      empty: 'Madame, Monsieur,',
      filled: 'En ma qualité de ${description},',
    });
  };

  const variableOptions = BUILTIN_VARIABLES.map((variable) => ({
    value: variable,
    label: `\${${variable}}`,
  }));

  return (
    <Stack gap="sm">
      <SegmentedControl
        value={mode}
        onChange={handleModeChange}
        data={[
          { label: 'Vide / Rempli', value: 'emptyFilled' },
          { label: 'Égal à une valeur', value: 'equals' },
        ]}
        fullWidth
      />

      {mode === 'equals' && isEqualsMode(segment) ? (
        <>
          <Group align="flex-end" wrap="nowrap">
            <Select
              style={{ flex: 1 }}
              label="Variable testée"
              data={variableOptions}
              value={segment.var}
              onChange={(value) =>
                onChange({
                  ...segment,
                  var: value ?? 'gender',
                })
              }
              searchable
              allowDeselect={false}
            />
            <Button
              variant="light"
              onClick={() =>
                onChange({
                  kind: 'conditional',
                  var: 'gender',
                  eq: 'female',
                  then: 'Je soussignée',
                  else: 'Je soussigné',
                })
              }
            >
              Accord genre
            </Button>
          </Group>
          <TextInput
            label="Valeur attendue"
            value={segment.eq}
            onChange={(event) =>
              onChange({ ...segment, eq: event.currentTarget.value })
            }
          />
          <Textarea
            label="Si égal"
            value={segment.then}
            onChange={(event) =>
              onChange({ ...segment, then: event.currentTarget.value })
            }
            minRows={2}
            autosize
          />
          <Textarea
            label="Sinon"
            value={segment.else}
            onChange={(event) =>
              onChange({ ...segment, else: event.currentTarget.value })
            }
            minRows={2}
            autosize
          />
        </>
      ) : !isEqualsMode(segment) ? (
        <>
          <Select
            label="Variable testée"
            data={variableOptions}
            value={segment.var}
            onChange={(value) =>
              onChange({
                ...segment,
                var: value ?? 'description',
              })
            }
            searchable
            allowDeselect={false}
          />
          <Textarea
            label="Si vide"
            value={segment.empty}
            onChange={(event) =>
              onChange({ ...segment, empty: event.currentTarget.value })
            }
            minRows={2}
            autosize
          />
          <Textarea
            label="Si rempli"
            value={segment.filled}
            onChange={(event) =>
              onChange({ ...segment, filled: event.currentTarget.value })
            }
            minRows={2}
            autosize
          />
        </>
      ) : null}
    </Stack>
  );
}
