import { describe, expect, it } from 'vitest';
import { validateCustomValues } from '@/lib/cabinet/formSchema';
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
});
