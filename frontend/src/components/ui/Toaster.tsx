import { useToastStore } from '@/store/toastStore';

const typeClasses = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-indigo-600',
};

const typeIcons = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${typeClasses[toast.type]}`}
        >
          <span className="font-bold">{typeIcons[toast.type]}</span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
