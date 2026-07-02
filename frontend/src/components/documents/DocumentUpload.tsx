import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { documentsApi } from '@/api';
import { useToastStore } from '@/store/toastStore';
import { Button } from '@/components/ui/Button';
import type { Document } from '@/types';

const MAX_MB = Number(import.meta.env.VITE_MAX_FILE_SIZE_MB ?? 20);
const MAX_FILES = 20;
const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff'];

export function DocumentUpload() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const { addToast } = useToastStore();
  const qc = useQueryClient();

  const uploadMany = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      if (files.length > MAX_FILES) {
        addToast('error', `You can upload at most ${MAX_FILES} files at once.`);
        return;
      }

      // Validate each file up front; skip invalid ones with a per-file message.
      const valid: File[] = [];
      for (const file of files) {
        if (!ACCEPTED.includes(file.type)) {
          addToast('error', `"${file.name}": unsupported file type.`);
          continue;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          addToast('error', `"${file.name}": too large (max ${MAX_MB} MB).`);
          continue;
        }
        valid.push(file);
      }
      if (valid.length === 0) return;

      setUploading(true);
      setProgress({ done: 0, total: valid.length });
      const created: Document[] = [];
      const failed: string[] = [];
      for (const file of valid) {
        try {
          created.push(await documentsApi.upload(file));
        } catch {
          failed.push(file.name);
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }

      if (created.length > 0) {
        // Insert immediately so rows show without waiting for a refetch round-trip.
        qc.setQueryData<Document[]>(['documents'], (old = []) => [...created, ...old]);
        // Reconcile with the server (also picks up anything the optimistic insert missed).
        qc.invalidateQueries({ queryKey: ['documents'] });
        addToast(
          'success',
          `${created.length} file${created.length !== 1 ? 's' : ''} uploaded — processing started.`,
        );
      }
      if (failed.length > 0) {
        addToast('error', `Failed to upload: ${failed.join(', ')}.`);
      }
      setUploading(false);
    },
    [addToast, qc],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      uploadMany(Array.from(e.dataTransfer.files));
    },
    [uploadMany],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadMany(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  return (
    <Box
      component="label"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        p: 4,
        cursor: 'pointer',
        borderRadius: 2,
        border: '2px dashed',
        borderColor: dragging ? 'primary.main' : 'divider',
        bgcolor: dragging ? 'action.hover' : 'background.paper',
        transition: 'border-color 0.2s, background-color 0.2s',
        '&:hover': { borderColor: 'primary.light', bgcolor: 'action.hover' },
      }}
    >
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff"
        multiple
        hidden
        onChange={onInputChange}
        disabled={uploading}
      />
      <CloudUploadIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {uploading
            ? `Uploading ${progress.done} of ${progress.total}…`
            : 'Drop PDFs or images here'}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Up to {MAX_FILES} files · PDF, JPEG, PNG, WEBP, TIFF · {MAX_MB} MB each
        </Typography>
      </Box>
      {!uploading && (
        <Button variant="secondary" size="sm" component="span">
          Browse files
        </Button>
      )}
      {uploading && <LinearProgress sx={{ width: '100%' }} />}
    </Box>
  );
}
