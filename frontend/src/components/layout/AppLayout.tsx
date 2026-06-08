import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { Navbar } from './Navbar';
import { Toaster } from '@/components/ui/Toaster';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Navbar />
      <Container maxWidth="xl" component="main" sx={{ py: 3 }}>
        {children}
      </Container>
      <Toaster />
    </Box>
  );
}
