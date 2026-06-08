import { createTheme } from '@mui/material/styles';

/**
 * Central MUI theme. Palette preserves the previous Tailwind look:
 * indigo primary, red error, green success.
 */
export const theme = createTheme({
  palette: {
    primary: { main: '#6366f1' },
    error: { main: '#ef4444' },
    success: { main: '#10b981' },
    warning: { main: '#f59e0b' },
    info: { main: '#3b82f6' },
    background: { default: '#f9fafb' },
  },
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
});
