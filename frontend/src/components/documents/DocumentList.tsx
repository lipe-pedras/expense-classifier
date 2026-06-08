import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { documentsApi } from '@/api';
import { useToastStore } from '@/store/toastStore';
import { StatusBadge } from '@/components/ui/Badge';
import type { Document } from '@/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function DocumentRow({ doc, onDeleted }: { doc: Document; onDeleted: () => void }) {
  const { addToast } = useToastStore();

  const handleDelete = async () => {
    if (!confirm(`Delete "${doc.originalName}"? All its expenses will also be deleted.`)) return;
    try {
      await documentsApi.delete(doc.id);
      addToast('success', `"${doc.originalName}" deleted.`);
      onDeleted();
    } catch {
      addToast('error', 'Failed to delete document.');
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        py: 1,
        borderRadius: 1,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <DescriptionOutlinedIcon sx={{ color: 'text.disabled', flexShrink: 0 }} fontSize="small" />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
          {doc.originalName}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {formatDate(doc.uploadedAt)} · {doc.expenseCount} expense{doc.expenseCount !== 1 ? 's' : ''}
        </Typography>
      </Box>
      <StatusBadge status={doc.status} />
      <Tooltip title="Delete document">
        <IconButton size="small" onClick={handleDelete} sx={{ flexShrink: 0 }}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export function DocumentList() {
  const qc = useQueryClient();
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: documentsApi.list,
    refetchInterval: (query) => {
      const docs = query.state.data ?? [];
      const hasPending = docs.some((d) => d.status === 'PENDING' || d.status === 'PROCESSING');
      return hasPending ? 5000 : false;
    },
  });

  const onDeleted = () => {
    qc.invalidateQueries({ queryKey: ['documents'] });
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  if (isLoading) {
    return (
      <Stack spacing={1} sx={{ px: 1.5 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={48} />
        ))}
      </Stack>
    );
  }

  if (documents.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled" sx={{ py: 2, textAlign: 'center' }}>
        No documents yet
      </Typography>
    );
  }

  return (
    <Stack divider={<Divider />}>
      {documents.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} onDeleted={onDeleted} />
      ))}
    </Stack>
  );
}
