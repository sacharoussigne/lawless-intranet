export type ThemeScheme = 'light' | 'dark';

/** Ten shades, lightest first (Mantine palette). */
export type ThemePalette = readonly [string, string, string, string, string, string, string, string, string, string];

/** Tinted surfaces derived from a palette: hovers, pills, highlighted rows. */
export type SoftColors = {
  /** Lightest tint (hover backgrounds). */
  soft: string;
  /** Stronger tint (pill backgrounds). */
  strong: string;
  border: string;
  /** Readable text on `soft` / `strong`. */
  text: string;
};

/**
 * A theme is a set of tokens turned into CSS variables. Predefined themes live
 * in each app; a user-made theme will be the same object, stored in the database.
 */
export type ThemeDefinition = {
  id: string;
  label: string;
  /** Mantine color scheme used with this theme. */
  scheme: ThemeScheme;
  /** `--<prefix>-<name>`, e.g. `surface` → `--disp-surface`. */
  tokens: Record<string, string>;
  /** `--<prefix>-<palette>-soft`, `-soft-strong`, `-soft-border`, `-soft-text`. */
  soft: Record<string, SoftColors>;
};

/** What the client needs to switch themes (no colors). */
export type ThemeOption = Pick<ThemeDefinition, 'id' | 'label' | 'scheme'>;

export type ThemeConfig = {
  /** Variable and attribute prefix: `disp` → `--disp-*`, `data-disp-theme`. */
  prefix: string;
  defaultThemeId: string;
  themes: readonly ThemeOption[];
};
