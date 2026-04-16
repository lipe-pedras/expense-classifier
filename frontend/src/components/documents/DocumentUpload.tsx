import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
    <label
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
        dragging
          ? 'border-indigo-500 bg-indigo-50'
          : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-gray-50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff"
        className="hidden"
        onChange={onInputChange}
        disabled={uploading}
      />
      <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">
          {uploading ? 'Uploading…' : 'Drop a PDF or image here'}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          PDF, JPEG, PNG, WEBP, TIFF — up to {MAX_MB} MB
        </p>
      </div>
      {!uploading && (
        <Button variant="secondary" size="sm" type="button">
          Browse files
        </Button>
      )}
      {uploading && (
        <div className="h-1 w-full rounded bg-gray-200">
          <div className="h-1 animate-pulse rounded bg-indigo-500" style={{ width: '60%' }} />
        </div>
      )}
    </label>
  );
}
