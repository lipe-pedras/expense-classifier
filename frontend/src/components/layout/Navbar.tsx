import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';

export function Navbar() {
  const { user, logout } = useAuthStore();

  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ gap: 1 }}>
          <ReceiptLongIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
            AI Expense Classifier
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {user?.username}
            </Typography>
            <Button variant="secondary" size="sm" onClick={logout}>
              Sign out
            </Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
