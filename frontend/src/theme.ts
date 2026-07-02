import { createTheme, type ThemeOptions } from '@mui/material/styles';

export type ThemeMode = 'light' | 'dark';

/**
 * Options shared by both palettes. Palette preserves the previous Tailwind look:
 * indigo primary, red error, green success.
 */
const sharedOptions: ThemeOptions = {
  typography: {
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: 'none', fontWeight: 500 } },
    },
  },
};

const brand = {
  primary: { main: '#6366f1' },
  error: { main: '#ef4444' },
  success: { main: '#10b981' },
  warning: { main: '#f59e0b' },
  info: { main: '#3b82f6' },
};

export const lightTheme = createTheme({
  ...sharedOptions,
  palette: {
    mode: 'light',
    ...brand,
    background: { default: '#f9fafb', paper: '#ffffff' },
  },
});

export const darkTheme = createTheme({
  ...sharedOptions,
  palette: {
    mode: 'dark',
    ...brand,
    background: { default: '#0f172a', paper: '#1e293b' },
  },
});

export const themes: Record<ThemeMode, typeof lightTheme> = {
  light: lightTheme,
  dark: darkTheme,
};
