import { describe, expect, it } from 'vitest';
import {
  collectFieldIdsToClearOnSelectChange,
  validateCustomValues,
} from '@/lib/cabinet/formSchema';
import type { FormEntitySchema } from '@/lib/cabinet/formSchema';

const schema: FormEntitySchema = {
  categories: [
    {
      id: 'cat-1',
      name: 'Test',
      isSystem: false,
      order: 0,
      fields: [
        {
          id: 'field-text',
          type: 'text',
          label: 'Notes',
          required: true,
          order: 0,
        },
        {
          id: 'field-select',
          type: 'select',
          label: 'Type',
          required: false,
          order: 1,
          options: [
            { id: 'opt-a', label: 'A' },
            { id: 'opt-b', label: 'B' },
          ],
          conditionalBranches: [
            {
              optionId: 'opt-a',
              fields: [
                {
                  id: 'field-nested',
                  type: 'text',
                  label: 'Détail A',
                  required: true,
                  order: 0,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('validateCustomValues', () => {
  it('rejects missing required fields', () => {
    const result = validateCustomValues(schema, {});
    expect(result.ok).toBe(false);
  });

  it('allows missing required fields when enforceRequired is false', () => {
    const result = validateCustomValues(schema, {}, { enforceRequired: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values['field-text']).toBeNull();
    }
  });

  it('validates nested conditional fields when select matches', () => {
    const result = validateCustomValues(schema, {
      'field-text': 'ok',
      'field-select': 'opt-a',
      'field-nested': 'detail',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values['field-nested']).toBe('detail');
    }
  });

  it('skips nested fields when select option has no branch', () => {
    const result = validateCustomValues(schema, {
      'field-text': 'ok',
      'field-select': 'opt-b',
    });
    expect(result.ok).toBe(true);
  });

  it('validates multiselect values and union of conditional branches', () => {
    const multiSchema: FormEntitySchema = {
      categories: [
        {
          id: 'cat-1',
          name: 'Test',
          isSystem: false,
          order: 0,
          fields: [
            {
              id: 'field-text',
              type: 'text',
              label: 'Notes',
              required: true,
              order: 0,
            },
            {
              id: 'field-multi',
              type: 'select',
              label: 'Symptômes',
              required: false,
              order: 1,
              multiple: true,
              options: [
                { id: 'opt-a', label: 'A' },
                { id: 'opt-b', label: 'B' },
              ],
              conditionalBranches: [
                {
                  optionId: 'opt-a',
                  fields: [
                    {
                      id: 'field-nested-a',
                      type: 'text',
                      label: 'Détail A',
                      required: true,
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
            },
          ],
        },
      ],
    };

    const stored = JSON.stringify(['opt-a', 'opt-b']);
    const result = validateCustomValues(multiSchema, {
      'field-text': 'ok',
      'field-multi': stored,
      'field-nested-a': 'detail a',
      'field-nested-b': 'detail b',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values['field-multi']).toBe(stored);
    }
  });

  it('clears nested fields when multiselect option is removed', () => {
    const field = schema.categories[0].fields[1];
    const prev = 'opt-a';
    const next = JSON.stringify(['opt-a', 'opt-b']);
    const cleared = collectFieldIdsToClearOnSelectChange(
      { ...field, multiple: true },
      prev,
      next,
      {},
    );
    expect(cleared).toEqual([]);

    const clearedOnRemove = collectFieldIdsToClearOnSelectChange(
      { ...field, multiple: true },
      next,
      JSON.stringify(['opt-b']),
      {},
    );
    expect(clearedOnRemove).toContain('field-nested');
  });
});
