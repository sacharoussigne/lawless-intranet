import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LABEL_COLOR,
  parseCabinetDisplaySettings,
  resolveLabelColor,
} from '@/lib/cabinet/displaySettings';

describe('parseCabinetDisplaySettings', () => {
  it('returns empty object for null or empty input', () => {
    expect(parseCabinetDisplaySettings(null)).toEqual({});
    expect(parseCabinetDisplaySettings({})).toEqual({});
  });

  it('parses valid label colors', () => {
    expect(
      parseCabinetDisplaySettings({
        labelColors: { textarea: '#aabbcc', system: null },
      }),
    ).toEqual({
      labelColors: { textarea: '#aabbcc', system: null },
    });
  });

  it('falls back to empty object for invalid input', () => {
    expect(parseCabinetDisplaySettings({ labelColors: { text: 'not-a-color' } })).toEqual({});
  });
});

describe('resolveLabelColor', () => {
  it('returns default when no custom color is set', () => {
    expect(resolveLabelColor('textarea', {})).toBe(DEFAULT_LABEL_COLOR);
  });

  it('returns type color when configured', () => {
    expect(
      resolveLabelColor('textarea', { labelColors: { textarea: '#112233' } }),
    ).toBe('#112233');
  });

  it('prefers field override over type color', () => {
    expect(
      resolveLabelColor(
        'textarea',
        { labelColors: { textarea: '#112233' }, fieldLabelColors: { field1: '#445566' } },
        'field1',
      ),
    ).toBe('#445566');
  });
});
