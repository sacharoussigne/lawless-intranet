import { describe, expect, it } from 'vitest';
import {
  collectFieldDefaultsToSeedOnSelectChange,
  collectFieldIdsToClearOnSelectChange,
  getVisibleFieldGroupsForSelectValue,
} from '@/lib/cabinet/formSchema';
import type { FormField } from '@/lib/cabinet/formSchema';

const multiSelectField: FormField = {
  id: 'field-multi',
  type: 'select',
  label: 'Symptômes',
  required: false,
  order: 0,
  multiple: true,
  options: [
    { id: 'opt-a', label: 'Option A' },
    { id: 'opt-b', label: 'Option B' },
  ],
  conditionalBranches: [
    {
      optionId: 'opt-a',
      fields: [
        {
          id: 'field-nested-a',
          type: 'text',
          label: 'Détail A',
          required: false,
          order: 0,
        },
      ],
    },
    {
      optionId: 'opt-b',
      fields: [
        {
          id: 'field-nested-b',
          type: 'text',
          label: 'Détail B',
          required: false,
          order: 0,
        },
      ],
    },
  ],
};

describe('getVisibleFieldGroupsForSelectValue', () => {
  it('returns one group per selected option with branch fields', () => {
    const groups = getVisibleFieldGroupsForSelectValue(
      multiSelectField,
      JSON.stringify(['opt-a', 'opt-b']),
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].optionLabel).toBe('Option A');
    expect(groups[0].fields.map((f) => f.id)).toEqual(['field-nested-a']);
    expect(groups[1].optionLabel).toBe('Option B');
    expect(groups[1].fields.map((f) => f.id)).toEqual(['field-nested-b']);
  });

  it('returns empty for mono select', () => {
    const mono = { ...multiSelectField, multiple: false };
    const groups = getVisibleFieldGroupsForSelectValue(mono, 'opt-a');
    expect(groups).toEqual([]);
  });

  it('clears only nested fields that are no longer visible', () => {
    const nestedSelect: FormField = {
      id: 'field-nested-select',
      type: 'select',
      label: 'Nom',
      required: false,
      order: 0,
      options: [
        { id: 'opt-a', label: 'A' },
        { id: 'opt-b', label: 'B' },
      ],
      conditionalBranches: [
        {
          optionId: 'opt-a',
          fields: [
            {
              id: 'field-detail-a',
              type: 'text',
              label: 'Détail A',
              required: false,
              order: 0,
            },
          ],
        },
        {
          optionId: 'opt-b',
          fields: [
            {
              id: 'field-detail-b',
              type: 'text',
              label: 'Détail B',
              required: false,
              order: 0,
            },
          ],
        },
      ],
    };

    const cleared = collectFieldIdsToClearOnSelectChange(
      nestedSelect,
      'opt-a',
      'opt-b',
      { 'field-detail-a': 'filled' },
    );
    expect(cleared).toEqual(['field-detail-a']);
  });

  it('seeds defaults for newly visible conditional fields', () => {
    const nestedSelect: FormField = {
      id: 'field-nested-select',
      type: 'select',
      label: 'Nom',
      required: false,
      order: 0,
      options: [
        { id: 'opt-a', label: 'A' },
        { id: 'opt-b', label: 'B' },
      ],
      conditionalBranches: [
        {
          optionId: 'opt-a',
          fields: [
            {
              id: 'field-detail-a',
              type: 'text',
              label: 'Composition',
              required: false,
              order: 0,
              defaultValue: 'Menthe, verveine',
            },
          ],
        },
      ],
    };

    const seeds = collectFieldDefaultsToSeedOnSelectChange(
      nestedSelect,
      null,
      'opt-a',
      {},
    );
    expect(seeds).toEqual([
      { fieldId: 'field-detail-a', defaultValue: 'Menthe, verveine' },
    ]);
  });

  it('seeds nested defaults when parent select has a default value', () => {
    const nestedSelect: FormField = {
      id: 'field-nested-select',
      type: 'select',
      label: 'Nom',
      required: false,
      order: 0,
      defaultValue: 'opt-a',
      options: [
        { id: 'opt-a', label: 'A' },
      ],
      conditionalBranches: [
        {
          optionId: 'opt-a',
          fields: [
            {
              id: 'field-detail-a',
              type: 'text',
              label: 'Composition',
              required: false,
              order: 0,
              defaultValue: 'Gingembre, miel',
            },
          ],
        },
      ],
    };

    const seeds = collectFieldDefaultsToSeedOnSelectChange(
      nestedSelect,
      null,
      'opt-a',
      {},
    );
    expect(seeds).toEqual([
      { fieldId: 'field-detail-a', defaultValue: 'Gingembre, miel' },
    ]);
  });
});
