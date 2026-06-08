import type { ReactNode } from 'react';
import Chip from '@mui/material/Chip';
import type { ProcessingStatus } from '@/types';

type ChipColor = 'default' | 'warning' | 'info' | 'success' | 'error';

const statusColor: Record<ProcessingStatus, ChipColor> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  DONE: 'success',
  FAILED: 'error',
};

const statusLabels: Record<ProcessingStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  DONE: 'Done',
  FAILED: 'Failed',
};

interface StatusBadgeProps {
  status: ProcessingStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Chip
      size="small"
      variant="outlined"
      color={statusColor[status]}
      label={statusLabels[status]}
    />
  );
}

interface BadgeProps {
  children: ReactNode;
}

export function Badge({ children }: BadgeProps) {
  return <Chip size="small" variant="outlined" label={children} />;
}
