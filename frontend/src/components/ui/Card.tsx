import type { ReactNode } from 'react';
import MuiCard from '@mui/material/Card';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';

interface CardProps {
  children?: ReactNode;
  sx?: SxProps<Theme>;
}

export function Card({ children, sx }: CardProps) {
  return (
    <MuiCard variant="outlined" sx={{ overflow: 'visible', ...sx }}>
      {children}
    </MuiCard>
  );
}

export function CardHeader({ children, sx }: CardProps) {
  return (
    <Box sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider', ...sx }}>
      {children}
    </Box>
  );
}

export function CardTitle({ children, sx }: CardProps) {
  return (
    <Typography variant="subtitle1" sx={{ fontWeight: 600, ...sx }}>
      {children}
    </Typography>
  );
}

export function CardContent({ children, sx }: CardProps) {
  return <Box sx={{ px: 2.5, py: 2, ...sx }}>{children}</Box>;
}
