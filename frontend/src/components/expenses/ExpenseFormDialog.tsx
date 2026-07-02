import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import { categoriesApi, expensesApi } from '@/api';
import { useToastStore } from '@/store/toastStore';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { Expense } from '@/types';

interface Props {
  open: boolean;
  expense?: Expense | null;
  onClose: () => void;
}

function toDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function ExpenseFormDialog({ open, expense, onClose }: Props) {
  const isEdit = Boolean(expense);
  const { addToast } = useToastStore();
  const qc = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [expenseDate, setExpenseDate] = useState('');
  const [vendor, setVendor] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset the form whenever the dialog opens (for create or for a specific expense).
  useEffect(() => {
    if (!open) return;
    setError('');
    setAmount(expense ? String(expense.amount) : '');
    setCurrency(expense?.currency ?? 'BRL');
    setExpenseDate(expense ? toDateInput(expense.expenseDate) : toDateInput(new Date().toISOString()));
    setVendor(expense?.vendor ?? '');
    setCategoryId(expense?.categoryId ?? '');
  }, [open, expense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    if (!categoryId) {
      setError('Select a category.');
      return;
    }

    const payload = {
      amount: amountNum,
      currency: currency || 'BRL',
      expenseDate: new Date(expenseDate).toISOString(),
      vendor: vendor.trim() || null,
      categoryId,
    };

    setSaving(true);
    try {
      if (isEdit && expense) {
        await expensesApi.update(expense.id, payload);
        addToast('success', 'Expense updated.');
      } else {
        await expensesApi.create(payload);
        addToast('success', 'Expense added.');
      }
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    } catch {
      setError('Could not save the expense. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{isEdit ? 'Edit expense' : 'Add expense'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Input
              label="Amount"
              type="number"
              inputProps={{ step: '0.01', min: '0' }}
              value={amount}
              placeholder="Use dot as decimal separator (e.g. 12.34)"
              onChange={(e) => setAmount(e.target.value)}
              required
              fullWidth
            />
            <Input
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              fullWidth
            />
            <Input
              label="Date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
              fullWidth
            />
            <Input
              label="Vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              fullWidth
            />
            <Select
              label="Category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="Select a category"
              required
              fullWidth
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? 'Save changes' : 'Add expense'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
