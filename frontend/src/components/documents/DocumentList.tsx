import { useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '@/api';
import { useToastStore } from '@/store/toastStore';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
    <div className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-gray-50">
      <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">{doc.originalName}</p>
        <p className="text-xs text-gray-400">
          {formatDate(doc.uploadedAt)} · {doc.expenseCount} expense{doc.expenseCount !== 1 ? 's' : ''}
        </p>
      </div>
      <StatusBadge status={doc.status} />
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        className="flex-shrink-0 text-gray-400 hover:text-red-600"
        title="Delete document"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </Button>
    </div>
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
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400">No documents yet</p>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} onDeleted={onDeleted} />
      ))}
    </div>
  );
}
