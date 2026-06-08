import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { documentsApi } from '@/api';
import { useToastStore } from '@/store/toastStore';
import { Button } from '@/components/ui/Button';

const MAX_MB = Number(import.meta.env.VITE_MAX_FILE_SIZE_MB ?? 20);
const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff'];

export function DocumentUpload() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { addToast } = useToastStore();
  const qc = useQueryClient();

  const upload = useCallback(
    async (file: File) => {
      if (!ACCEPTED.includes(file.type)) {
        addToast('error', 'Unsupported file type. Use PDF or image (JPEG/PNG/WEBP/TIFF).');
        return;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        addToast('error', `File too large. Maximum size is ${MAX_MB} MB.`);
        return;
      }
      setUploading(true);
      try {
        await documentsApi.upload(file);
        addToast('success', `"${file.name}" uploaded — processing started.`);
        qc.invalidateQueries({ queryKey: ['documents'] });
      } catch {
        addToast('error', 'Upload failed. Please try again.');
      } finally {
        setUploading(false);
      }
    },
    [addToast, qc],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) upload(file);
    },
    [upload],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
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
        hidden
        onChange={onInputChange}
        disabled={uploading}
      />
      <CloudUploadIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {uploading ? 'Uploading…' : 'Drop a PDF or image here'}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          PDF, JPEG, PNG, WEBP, TIFF — up to {MAX_MB} MB
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
