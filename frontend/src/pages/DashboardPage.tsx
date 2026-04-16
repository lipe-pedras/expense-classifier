import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '@/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToastStore } from '@/store/toastStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CategoryPieChart } from '@/components/charts/CategoryPieChart';
import { MonthlyBarChart } from '@/components/charts/MonthlyBarChart';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { DocumentList } from '@/components/documents/DocumentList';
import { ExpenseFilters } from '@/components/expenses/ExpenseFilters';
import { ExpenseTable } from '@/components/expenses/ExpenseTable';
import type { ExpenseFilters as Filters, WsMessage } from '@/types';

const currFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function DashboardPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [exporting, setExporting] = useState(false);
  const { addToast } = useToastStore();
  const qc = useQueryClient();

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => expensesApi.dashboard(6),
  });

  useWebSocket((msg: WsMessage) => {
    if (msg.type === 'job:completed') {
      addToast('success', 'Document processed — expenses extracted.');
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    } else {
      addToast('error', `Document processing failed: ${msg.reason ?? 'unknown error'}`);
      qc.invalidateQueries({ queryKey: ['documents'] });
    }
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await expensesApi.export(filters);
    } catch {
      addToast('error', 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const currentMonthTotal = dashboard?.currentMonth.byCategory.reduce(
    (sum, c) => sum + c.total,
    0,
  ) ?? 0;

  return (
    <AppLayout>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: upload + documents */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Document</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentUpload />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              <DocumentList />
            </CardContent>
          </Card>
        </div>

        {/* Right columns: charts + table */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="flex flex-col gap-1 py-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  This Month
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {currFmt.format(currentMonthTotal)}
                </p>
                <p className="text-xs text-gray-400">
                  {dashboard?.currentMonth.byCategory.length ?? 0} categories
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 py-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  6-Month Total
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {currFmt.format(
                    dashboard?.history.reduce((s, m) => s + m.total, 0) ?? 0,
                  )}
                </p>
                <p className="text-xs text-gray-400">
                  {dashboard?.history.length ?? 0} months with data
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By Category — This Month</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CategoryPieChart data={dashboard?.currentMonth.byCategory ?? []} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Monthly History</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <MonthlyBarChart data={dashboard?.history ?? []} />
              </CardContent>
            </Card>
          </div>

          {/* Expenses table */}
          <Card>
            <CardHeader>
              <CardTitle>Expenses</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ExpenseFilters filters={filters} onChange={setFilters} />
              <ExpenseTable filters={filters} onExport={handleExport} exporting={exporting} />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
