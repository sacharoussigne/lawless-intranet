'use client';

import {
  Stack,
  TextInput,
  Textarea,
  Select,
  Switch,
  Grid,
} from '@mantine/core';
import type { TemplateInput } from '@lawless-intranet/mail-template-engine';

const INPUT_TYPES = [
  { value: 'text', label: 'Texte' },
  { value: 'textarea', label: 'Zone de texte' },
  { value: 'number', label: 'Nombre' },
  { value: 'checkbox', label: 'Case à cocher' },
  { value: 'switch', label: 'Interrupteur' },
  { value: 'select', label: 'Liste déroulante' },
];

interface InputBlockEditorProps {
  input: TemplateInput;
  onChange: (input: TemplateInput) => void;
  availableParentNames?: string[];
}

export function InputBlockEditor({
  input,
  onChange,
  availableParentNames = [],
}: InputBlockEditorProps) {
  const update = (patch: Partial<TemplateInput>) => {
    onChange({ ...input, ...patch });
  };

  const showCheckboxFields = input.type === 'checkbox';
  const showSelectFields = input.type === 'select';
  const showDependsOnFields = Boolean(input.dependsOn) || availableParentNames.length > 0;
  const defaultIsJsBlock = Boolean(input.defaultValue?.trim().startsWith('{js:'));

  const defaultValueField = defaultIsJsBlock ? (
    <Textarea
      label="Valeur par défaut (JavaScript)"
      value={input.defaultValue ?? ''}
      onChange={(event) =>
        update({ defaultValue: event.currentTarget.value || undefined })
      }
      description="Conservez le format {js:…:endjs} tel quel — le code n'est pas exécuté ici."
      minRows={4}
      autosize
      styles={{
        input: {
          fontFamily: 'monospace',
          fontSize: '12px',
        },
      }}
    />
  ) : (
    <TextInput
      label="Valeur par défaut"
      value={input.defaultValue ?? ''}
      onChange={(event) =>
        update({ defaultValue: event.currentTarget.value || undefined })
      }
      description='Texte statique ou bloc {js:(()=>"valeur")():endjs}'
    />
  );

  return (
    <Stack gap="sm">
      <Grid gutter="sm">
        <Grid.Col span={6}>
          <Select
            label="Type"
            data={INPUT_TYPES}
            value={input.type}
            onChange={(value) => update({ type: value ?? 'text' })}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Nom (identifiant)"
            value={input.name}
            onChange={(event) => update({ name: event.currentTarget.value })}
            required
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Label"
            value={input.label}
            onChange={(event) => update({ label: event.currentTarget.value })}
            required
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Placeholder"
            value={input.placeholder ?? ''}
            onChange={(event) =>
              update({ placeholder: event.currentTarget.value || undefined })
            }
          />
        </Grid.Col>
      </Grid>

      <Switch
        label="Champ requis"
        checked={Boolean(input.required)}
        onChange={(event) => update({ required: event.currentTarget.checked })}
      />

      {showCheckboxFields && (
        <TextInput
          label="Valeur si coché (checkedValue)"
          value={input.checkedValue ?? ''}
          onChange={(event) =>
            update({ checkedValue: event.currentTarget.value || undefined })
          }
          description="Texte inséré dans le courrier lorsque la case est cochée"
        />
      )}

      {showSelectFields && (
        <TextInput
          label="Options"
          value={input.options ?? ''}
          onChange={(event) =>
            update({ options: event.currentTarget.value || undefined })
          }
          placeholder="Option A|Option B|Option C"
          description="Séparez les options avec | ou ,"
        />
      )}

      {showDependsOnFields && (
        <Grid gutter="sm">
          <Grid.Col span={6}>
            <Select
              label="Dépend de"
              data={[
                { value: '', label: 'Aucun' },
                ...availableParentNames.map((name) => ({ value: name, label: name })),
              ]}
              value={input.dependsOn ?? ''}
              onChange={(value) =>
                update({ dependsOn: value || undefined, layout: value ? input.layout : undefined })
              }
              clearable
            />
          </Grid.Col>
          {input.dependsOn && (
            <Grid.Col span={6}>
              <Select
                label="Disposition"
                data={[
                  { value: 'inline', label: 'Inline (à côté)' },
                  { value: 'below', label: 'Sous la case' },
                ]}
                value={input.layout ?? 'inline'}
                onChange={(value) =>
                  update({ layout: (value as 'inline' | 'below') ?? 'inline' })
                }
              />
            </Grid.Col>
          )}
        </Grid>
      )}

      {defaultValueField}
    </Stack>
  );
}
