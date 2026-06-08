import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import { useToastStore } from '@/store/toastStore';

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return (
    <Stack
      spacing={1}
      sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: (t) => t.zIndex.snackbar }}
    >
      {toasts.map((toast) => (
        <Alert
          key={toast.id}
          severity={toast.type}
          variant="filled"
          onClose={() => removeToast(toast.id)}
          sx={{ boxShadow: 6 }}
        >
          {toast.message}
        </Alert>
      ))}
    </Stack>
  );
}
