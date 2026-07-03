import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { Link as RouterLink } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { Button } from '@/components/ui/Button';

export function Navbar() {
  const { user, logout } = useAuthStore();
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);

  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ gap: 1 }}>
          <Box
            component={RouterLink}
            to="/"
            aria-label="Go to dashboard"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexGrow: 1,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <ReceiptLongIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              AI Expense Classifier
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Link
              component={RouterLink}
              to="/categories"
              variant="body2"
              color="text.secondary"
              underline="hover"
            >
              Categories
            </Link>
            <Tooltip title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
              <IconButton onClick={toggleMode} color="inherit" aria-label="Toggle theme">
                {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
              </IconButton>
            </Tooltip>
            <Link
              component={RouterLink}
              to="/profile"
              variant="body2"
              color="text.secondary"
              underline="hover"
            >
              {user?.username}
            </Link>
            <Button variant="secondary" size="sm" onClick={logout}>
              Sign out
            </Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
