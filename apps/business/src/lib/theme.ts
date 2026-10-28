import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import { createTheme, DEFAULT_THEME, type CSSVariablesResolver } from '@mantine/core';
import { apothecaryPillStyle } from '@/lib/apothecaryPill';
import {
  amberPalette,
  clayPalette,
  dangerPalette,
  denimPalette,
  dispTokens,
  leatherPalette,
  mossPalette,
  sagePalette,
  slatePalette,
  winePalette,
} from '@/lib/design-tokens';
import { DISP_SOFT_PALETTES } from '@/lib/themes/palettes';

const { colors: c, radius: r, shadows: s } = dispTokens;

/** Surface of cards and papers; nested ones get `--disp-paper-bg` (see `mantine-overrides.scss`). */
const paperBackground = `var(--disp-paper-bg, ${c.surface})`;

const selectLikeInput = {
  backgroundColor: c.surface,
  borderColor: c.surfaceBorder,
  color: c.ink,
  lineHeight: 1.25,
};

const selectLikeSection = {
  display: 'flex',
  alignItems: 'center',
  lineHeight: 0,
};

const comboboxDropdown = {
  backgroundColor: c.surface,
  borderColor: c.surfaceBorder,
};

const comboboxOption = {
  display: 'flex',
  alignItems: 'center',
  lineHeight: 1.25,
  borderRadius: 'var(--mantine-radius-sm)',
  marginBottom: '0.2rem',
  color: c.ink,
};


const theme = createTheme({
  ...DEFAULT_THEME,

  /**
   * Literal colors: Mantine parses them. Cream text on filled buttons, ink as
   * fallback text; surfaces and text otherwise come from the theme variables.
   */
  white: '#FFFCF6',
  black: '#3D3429',

  colors: {
    sage: [...sagePalette],
    leather: [...leatherPalette],
    danger: [...dangerPalette],
    slate: [...slatePalette],
    wine: [...winePalette],
    clay: [...clayPalette],
    amber: [...amberPalette],
    moss: [...mossPalette],
    denim: [...denimPalette],
    /** Dark scheme surfaces (« Lampe à huile »): warm browns instead of Mantine's blue-grays. */
    dark: [
      '#ECE3D2',
      '#D3C8B6',
      '#BFB3A1',
      '#9A8E7E',
      '#4A4036',
      '#3D352B',
      '#342C23',
      '#262019',
      '#14110E',
      '#0F0D0A',
    ],
    blue: [
      '#e3f4fd',
      '#cbe8fb',
      '#93d5f7',
      '#57c1f3',
      '#2bb1f0',
      '#0aa7ee',
      '#00a3ef',
      '#008fd5',
      '#007fbf',
      '#006ea8',
    ],
  },

  primaryColor: 'sage',
  // Lighter accent on dark surfaces.
  primaryShade: { light: 6, dark: 5 },

  defaultRadius: 'md',

  fontFamily: dispTokens.fonts.ui,
  fontFamilyMonospace: dispTokens.fonts.mono,
  headings: {
    fontFamily: dispTokens.fonts.display,
    fontWeight: '400',
    sizes: {
      h1: { fontSize: '2rem', lineHeight: '1.25' },
      h2: { fontSize: '1.5rem', lineHeight: '1.3' },
      h3: { fontSize: '1.25rem', lineHeight: '1.35' },
    },
  },

  spacing: {
    xs: '0.625rem',
    sm: '0.875rem',
    md: '1.25rem',
    lg: '1.875rem',
    xl: '3rem',
  },

  shadows: {
    xs: s.xs,
    sm: s.card,
    md: s.elevated,
    lg: s.lg,
    xl: s.xl,
  },

  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
  },

  lineHeights: {
    xs: '1.4',
    sm: '1.45',
    md: '1.55',
    lg: '1.6',
    xl: '1.65',
  },

  other: {
    dispSurface: c.surface,
    dispSurfaceBorder: c.surfaceBorder,
    dispInk: c.ink,
    dispBackground: c.background,
  },

  components: {
    Button: {
      defaultProps: {
        radius: 'md',
        color: 'sage',
      },
      styles: {
        root: {
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        inner: {
          display: 'flex',
          alignItems: 'center',
          lineHeight: 1.25,
        },
        label: {
          lineHeight: 1.25,
          position: 'relative',
          top: 1,
        },
        section: {
          display: 'flex',
          alignItems: 'center',
          lineHeight: 0,
        },
      },
    },

    ActionIcon: {
      defaultProps: {
        color: 'sage',
      },
    },

    Badge: {
      defaultProps: {
        variant: 'outline',
        radius: 'sm',
      },
      styles: {
        root: {
          fontWeight: 600,
          fontSize: 'var(--mantine-font-size-xs)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        label: {
          lineHeight: 1.25,
          position: 'relative',
          top: 1,
        },
        section: {
          display: 'flex',
          alignItems: 'center',
          lineHeight: 0,
        },
      },
    },

    Pill: {
      styles: {
        root: {
          ...apothecaryPillStyle(sagePalette),
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
        },
        label: {
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          top: 2,
        },
        remove: {
          display: 'flex',
          alignItems: 'center',
          alignSelf: 'center',
          position: 'relative',
          top: 1,
        },
      },
    },

    Card: {
      defaultProps: {
        radius: 'md',
        withBorder: true,
      },
      styles: {
        root: {
          backgroundColor: paperBackground,
          borderColor: c.surfaceBorder,
          borderRadius: r.lg,
          boxShadow: s.card,
        },
      },
    },

    Paper: {
      styles: {
        root: {
          backgroundColor: paperBackground,
          borderColor: c.surfaceBorder,
          borderRadius: r.lg,
        },
      },
    },

    Modal: {
      styles: {
        header: {
          backgroundColor: c.surface,
          borderBottom: `1px solid ${c.surfaceBorder}`,
        },
        title: {
          fontFamily: dispTokens.fonts.display,
          fontWeight: 400,
          color: c.ink,
        },
        content: {
          borderRadius: r.modal,
          backgroundColor: c.surface,
        },
        body: {
          backgroundColor: c.surface,
          paddingTop: 'var(--mantine-spacing-md)',
        },
      },
    },

    Menu: {
      styles: {
        dropdown: {
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
        },
        item: {
          color: c.ink,
        },
        label: {
          color: c.inkMuted,
        },
      },
    },

    SegmentedControl: {
      styles: {
        root: {
          backgroundColor: c.background,
        },
      },
    },

    Drawer: {
      styles: {
        content: {
          backgroundColor: c.surface,
        },
        header: {
          backgroundColor: c.surface,
          borderBottom: `1px solid ${c.surfaceBorder}`,
        },
      },
    },

    TextInput: {
      defaultProps: noAutofillProps,
      styles: {
        input: {
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
          color: c.ink,
        },
      },
    },

    Select: {
      defaultProps: {
        ...noAutofillProps,
        withAlignedLabels: true,
      },
      styles: {
        input: selectLikeInput,
        section: selectLikeSection,
        dropdown: comboboxDropdown,
        option: comboboxOption,
      },
    },

    Combobox: {
      styles: {
        dropdown: comboboxDropdown,
        option: comboboxOption,
      },
    },

    Popover: {
      styles: {
        dropdown: {
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
        },
      },
    },

    Autocomplete: {
      defaultProps: noAutofillProps,
      styles: {
        input: selectLikeInput,
        section: selectLikeSection,
        dropdown: comboboxDropdown,
        option: comboboxOption,
      },
    },

    MultiSelect: {
      defaultProps: {
        ...noAutofillProps,
        withAlignedLabels: true,
      },
      styles: {
        input: selectLikeInput,
        inputField: {
          lineHeight: 1.25,
        },
        section: selectLikeSection,
        dropdown: comboboxDropdown,
        option: comboboxOption,
        pill: apothecaryPillStyle(sagePalette),
      },
    },

    Textarea: {
      defaultProps: noAutofillProps,
      styles: {
        input: {
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
          color: c.ink,
        },
      },
    },

    TagsInput: { defaultProps: noAutofillProps },
    DateInput: { defaultProps: noAutofillProps },
    DateTimePicker: { defaultProps: noAutofillProps },

    NumberInput: {
      defaultProps: noAutofillProps,
      styles: {
        input: {
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
          color: c.ink,
        },
      },
    },

    Accordion: {
      styles: {
        control: {
          backgroundColor: c.tableHeader,
          color: c.ink,
        },
        item: {
          borderColor: c.surfaceBorder,
          backgroundColor: c.tableHeader,
        },
        panel: {
          backgroundColor: c.surface,
        },
        chevron: {
          color: c.inkMuted,
        },
      },
    },

    Divider: {
      styles: {
        label: {
          color: c.inkMuted,
          fontWeight: 600,
        },
      },
    },

    Tabs: {
      defaultProps: {
        color: 'sage',
      },
      vars: () => ({
        root: {
          '--tab-hover-color': 'var(--disp-sage-soft)',
          '--tab-border-color': c.surfaceBorder,
        },
      }),
      styles: {
        list: {
          borderColor: c.surfaceBorder,
        },
        tab: {
          color: c.inkMuted,
        },
      },
    },

    Table: {
      vars: () => ({
        table: {
          '--table-striped-color': c.tableZebra,
          '--table-highlight-on-hover-color': 'var(--disp-sage-soft)',
          '--table-border-color': c.surfaceBorder,
        },
      }),
      styles: {
        table: {
          backgroundColor: c.surface,
        },
        thead: {
          backgroundColor: c.tableHeader,
        },
        th: {
          color: c.ink,
          fontWeight: 600,
          backgroundColor: c.tableHeader,
          lineHeight: 1.25,
        },
        td: {
          color: c.ink,
          lineHeight: 1.25,
        },
      },
    },
  },
});

/** Mantine base colors follow the active theme, in both schemes. */
const themeMantineVariables = {
  '--mantine-color-dimmed': c.inkMuted,
  '--mantine-color-body': c.background,
  '--mantine-color-text': c.ink,
  '--mantine-color-default': c.surface,
  '--mantine-color-default-color': c.ink,
  '--mantine-color-default-hover': c.tableHeader,
  '--mantine-color-default-border': c.surfaceBorder,
  '--mantine-color-disabled': c.tableHeader,
  '--mantine-color-disabled-color': c.inkMuted,
  '--mantine-color-disabled-border': c.surfaceBorder,
};

/**
 * Dark scheme: Mantine's defaults (text = shade 4, filled = shade 5) are too
 * dim on brown surfaces. Colored text uses shade 3 and filled backgrounds use
 * shade 6, so that cream labels stay readable.
 */
const darkFilledShade: Record<string, number> = { amber: 7 };

const darkPaletteVariables = Object.fromEntries(
  Object.keys(DISP_SOFT_PALETTES).flatMap((name) => {
    const filled = darkFilledShade[name] ?? 6;
    return [
      [`--mantine-color-${name}-text`, `var(--mantine-color-${name}-3)`],
      [`--mantine-color-${name}-filled`, `var(--mantine-color-${name}-${filled})`],
      [`--mantine-color-${name}-filled-hover`, `var(--mantine-color-${name}-${filled + 1})`],
    ];
  }),
);

export const dispCssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    '--mantine-font-family': dispTokens.fonts.ui,
    '--mantine-font-family-monospace': dispTokens.fonts.mono,
  },
  light: themeMantineVariables,
  dark: {
    ...themeMantineVariables,
    ...darkPaletteVariables,
    '--mantine-color-anchor': 'var(--mantine-color-sage-3)',
  },
});

export default theme;
