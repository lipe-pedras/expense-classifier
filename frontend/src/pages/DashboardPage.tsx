import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
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
import { ExpenseFormDialog } from '@/components/expenses/ExpenseFormDialog';
import type { Expense, ExpenseFilters as Filters, WsMessage } from '@/types';

const currFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 2.5 }}>
        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }} color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {hint}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [exporting, setExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const { addToast } = useToastStore();
  const qc = useQueryClient();

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setDialogOpen(true);
  };

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
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' },
        }}
      >
        {/* Left column: upload + documents */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
            <CardContent sx={{ px: 0, py: 1 }}>
              <DocumentList />
            </CardContent>
          </Card>
        </Box>

        {/* Right columns: charts + table */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: { lg: 'span 2' } }}>
          {/* Stats row */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <StatCard
              label="This Month"
              value={currFmt.format(currentMonthTotal)}
              hint={`${dashboard?.currentMonth.byCategory.length ?? 0} categories`}
            />
            <StatCard
              label="6-Month Total"
              value={currFmt.format(dashboard?.history.reduce((s, m) => s + m.total, 0) ?? 0)}
              hint={`${dashboard?.history.length ?? 0} months with data`}
            />
          </Box>

          {/* Charts row */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
            <Card>
              <CardHeader>
                <CardTitle>By Category — This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryPieChart data={dashboard?.currentMonth.byCategory ?? []} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Monthly History</CardTitle>
              </CardHeader>
              <CardContent>
                <MonthlyBarChart data={dashboard?.history ?? []} />
              </CardContent>
            </Card>
          </Box>

          {/* Expenses table */}
          <Card>
            <CardHeader>
              <CardTitle>Expenses</CardTitle>
            </CardHeader>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <ExpenseFilters filters={filters} onChange={setFilters} />
              <ExpenseTable
                filters={filters}
                onExport={handleExport}
                exporting={exporting}
                onAdd={openAdd}
                onEdit={openEdit}
              />
            </CardContent>
          </Card>
        </Box>
      </Box>

      <ExpenseFormDialog
        open={dialogOpen}
        expense={editing}
        onClose={() => setDialogOpen(false)}
      />
    </AppLayout>
  );
}
