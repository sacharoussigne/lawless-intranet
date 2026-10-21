import type { CabinetLabelColorKey } from './types';

export const DEFAULT_LABEL_COLOR = 'var(--disp-ink-muted)';

export const LABEL_COLOR_KEYS: { key: CabinetLabelColorKey; label: string }[] = [
  { key: 'text', label: 'Texte court' },
  { key: 'textarea', label: 'Zone de texte' },
  { key: 'date', label: 'Date' },
  { key: 'select', label: 'Liste déroulante' },
  { key: 'system', label: 'Champs système' },
];

export const DISPLAY_SETTINGS_PREVIEW_MARKDOWN = `**4 répétitions réalisées**

- Respiration lente
- **Observations:** amplitude complète

1. Premier exercice
2. Deuxième exercice`;
