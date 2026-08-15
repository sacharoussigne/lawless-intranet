import { createTheme, DEFAULT_THEME, type CSSVariablesResolver } from '@mantine/core';
import {
  dangerPalette,
  leatherPalette,
  mossPalette,
  sageDustPalette,
  shelterPillStyle,
  shelterTokens,
  slatePalette,
  terracottaPalette,
} from '@/lib/design-tokens';

const { colors: c, radius: r, shadows: s } = shelterTokens;

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

  white: c.surface,
  black: c.ink,

  colors: {
    terracotta: [...terracottaPalette],
    sageDust: [...sageDustPalette],
    danger: [...dangerPalette],
    slate: [...slatePalette],
    leather: [...leatherPalette],
    moss: [...mossPalette],
  },

  primaryColor: 'terracotta',
  primaryShade: 6,

  defaultRadius: 'sm',

  fontFamily: shelterTokens.fonts.ui,
  fontFamilyMonospace: shelterTokens.fonts.mono,
  headings: {
    fontFamily: shelterTokens.fonts.display,
    fontWeight: '400',
    sizes: {
      h1: { fontSize: '2rem', lineHeight: '1.25' },
      h2: { fontSize: '1.5rem', lineHeight: '1.3' },
      h3: { fontSize: '1.25rem', lineHeight: '1.35' },
    },
  },

  radius: {
    xs: r.sm,
    sm: r.sm,
    md: r.md,
    lg: r.lg,
    xl: r.lg,
  },

  spacing: {
    xs: '0.625rem',
    sm: '0.875rem',
    md: '1.25rem',
    lg: '1.875rem',
    xl: '3rem',
  },

  shadows: {
    xs: '0 1px 2px rgba(62, 59, 57, 0.04)',
    sm: s.card,
    md: s.elevated,
    lg: '0 8px 24px rgba(62, 59, 57, 0.1)',
    xl: '0 12px 32px rgba(62, 59, 57, 0.12)',
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
    shelterSurface: c.surface,
    shelterSurfaceBorder: c.surfaceBorder,
    shelterInk: c.ink,
    shelterBackground: c.background,
  },

  components: {
    Button: {
      defaultProps: {
        radius: 'md',
        color: 'terracotta',
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
        color: 'terracotta',
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
          ...shelterPillStyle(terracottaPalette),
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
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
          borderRadius: r.lg,
          boxShadow: s.card,
        },
      },
    },

    Paper: {
      styles: {
        root: {
          backgroundColor: c.surface,
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
          fontFamily: shelterTokens.fonts.display,
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
      styles: {
        input: selectLikeInput,
        section: selectLikeSection,
        dropdown: comboboxDropdown,
        option: comboboxOption,
      },
    },

    MultiSelect: {
      defaultProps: {
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
        pill: shelterPillStyle(terracottaPalette),
      },
    },

    Textarea: {
      styles: {
        input: {
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
          color: c.ink,
        },
      },
    },

    NumberInput: {
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
        color: 'terracotta',
      },
      vars: () => ({
        root: {
          '--tab-hover-color': 'var(--mantine-color-terracotta-0)',
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
          '--table-highlight-on-hover-color': 'var(--mantine-color-terracotta-0)',
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

export const shelterCssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-dimmed': c.inkMuted,
    '--mantine-color-body': c.background,
    '--mantine-color-text': c.ink,
    '--mantine-color-default-hover': c.tableHeader,
    '--mantine-color-default-border': c.surfaceBorder,
    '--mantine-color-disabled': c.tableHeader,
    '--mantine-color-disabled-color': c.inkMuted,
    '--mantine-color-disabled-border': c.surfaceBorder,
    '--mantine-font-family': shelterTokens.fonts.ui,
    '--mantine-font-family-monospace': shelterTokens.fonts.mono,
  },
  dark: {
    '--mantine-color-dimmed': 'var(--mantine-color-dark-2)',
    '--mantine-font-family': shelterTokens.fonts.ui,
    '--mantine-font-family-monospace': shelterTokens.fonts.mono,
  },
});

export default theme;
