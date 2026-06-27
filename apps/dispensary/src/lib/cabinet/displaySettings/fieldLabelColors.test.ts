import { describe, expect, it } from 'vitest';
import type { CabinetFormSchemas } from '@/lib/cabinet/formSchema';
import {
  pruneFieldLabelColors,
  removeFieldLabelColorOverride,
  setFieldLabelColorOverride,
} from '@/lib/cabinet/displaySettings/fieldLabelColors';

const schemas = {
  patient: {
    categories: [
      {
        id: 'cat-1',
        name: 'Cat',
        isSystem: false,
        order: 0,
        fields: [
          {
            id: 'field-a',
            type: 'text' as const,
            label: 'A',
            required: false,
            order: 0,
          },
          {
            id: 'field-b',
            type: 'textarea' as const,
            label: 'B',
            required: false,
            order: 1,
          },
        ],
      },
    ],
  },
  careEpisode: { categories: [] },
  consultation: { categories: [] },
} satisfies CabinetFormSchemas;

describe('fieldLabelColors helpers', () => {
  it('sets and clears a field override', () => {
    const withColor = setFieldLabelColorOverride({}, 'field-a', '#aabbcc');
    expect(withColor.fieldLabelColors?.['field-a']).toBe('#aabbcc');

    const cleared = removeFieldLabelColorOverride(withColor, 'field-a');
    expect(cleared.fieldLabelColors).toBeUndefined();
  });

  it('prunes overrides for deleted fields', () => {
    const settings = {
      fieldLabelColors: {
        'field-a': '#aabbcc',
        'field-deleted': '#112233',
      },
    };

    const pruned = pruneFieldLabelColors(settings, new Set(['field-a', 'field-b']));
    expect(pruned.fieldLabelColors).toEqual({ 'field-a': '#aabbcc' });
  });
});
