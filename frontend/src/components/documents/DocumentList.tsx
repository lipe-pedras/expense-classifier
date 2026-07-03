import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MuiButton from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
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

function RenameDialog({
  doc,
  open,
  onClose,
  onRenamed,
}: {
  doc: Document;
  open: boolean;
  onClose: () => void;
  onRenamed: () => void;
}) {
  const { addToast } = useToastStore();
  const [name, setName] = useState(doc.originalName);
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const updated = await documentsApi.rename(doc.id, trimmed);
      if (updated.originalName !== trimmed) {
        addToast('info', `Name already existed — saved as "${updated.originalName}".`);
      } else {
        addToast('success', 'Document renamed.');
      }
      onRenamed();
      onClose();
    } catch {
      addToast('error', 'Failed to rename document.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="xs">
      <DialogTitle>Rename document</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Document name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={trimmed.length === 0}
          helperText={trimmed.length === 0 ? 'Name cannot be empty.' : ' '}
          sx={{ mt: 1 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
        />
      </DialogContent>
      <DialogActions>
        <MuiButton onClick={onClose} disabled={saving}>
          Cancel
        </MuiButton>
        <MuiButton onClick={handleSave} variant="contained" disabled={!canSave}>
          {saving ? 'Saving…' : 'Save'}
        </MuiButton>
      </DialogActions>
    </Dialog>
  );
}

function DocumentRow({ doc, onChanged }: { doc: Document; onChanged: () => void }) {
  const { addToast } = useToastStore();
  const [renameOpen, setRenameOpen] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  // While the document is queued/running a fresh inference is already under way.
  const isProcessing = doc.status === 'PENDING' || doc.status === 'PROCESSING';

  const handleReprocess = async () => {
    if (isProcessing || reprocessing) return;
    setReprocessing(true);
    try {
      await documentsApi.reprocess(doc.id);
      addToast('info', `Re-running classification on "${doc.originalName}".`);
      onChanged();
    } catch {
      addToast('error', 'Failed to reprocess document.');
    } finally {
      setReprocessing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${doc.originalName}"? All its expenses will also be deleted.`)) return;
    try {
      await documentsApi.delete(doc.id);
      addToast('success', `"${doc.originalName}" deleted.`);
      onChanged();
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
      <Tooltip title={isProcessing ? 'Already processing' : 'Re-run classification'}>
        <span>
          <IconButton
            size="small"
            onClick={handleReprocess}
            disabled={isProcessing || reprocessing}
            sx={{ flexShrink: 0 }}
          >
            {reprocessing ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
      <StatusBadge status={doc.status} />
      <Tooltip title="Rename document">
        <IconButton size="small" onClick={() => setRenameOpen(true)} sx={{ flexShrink: 0 }}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete document">
        <IconButton size="small" onClick={handleDelete} sx={{ flexShrink: 0 }}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <RenameDialog
        doc={doc}
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        onRenamed={onChanged}
      />
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

  const onChanged = () => {
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
        <DocumentRow key={doc.id} doc={doc} onChanged={onChanged} />
      ))}
    </Stack>
  );
}
