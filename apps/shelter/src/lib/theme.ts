import { createTheme, DEFAULT_THEME } from '@mantine/core';

const theme = createTheme({
  ...DEFAULT_THEME,
  primaryColor: 'teal',
  primaryShade: 7,
  defaultRadius: 'md',
  fontFamily: 'var(--shelter-font-ui), system-ui, sans-serif',
  headings: {
    fontFamily: 'var(--shelter-font-display), Georgia, serif',
    fontWeight: '600',
  },
});

export default theme;
