import type { ProcessingStatus } from '@/types';

const statusClasses: Record<ProcessingStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  DONE: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
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
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[status]}`}
    >
      {status === 'PROCESSING' && (
        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
      )}
      {statusLabels[status]}
    </span>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 ${className}`}
    >
      {children}
    </span>
  );
}
