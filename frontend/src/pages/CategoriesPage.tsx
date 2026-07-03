import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import MuiButton from '@mui/material/Button';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { categoriesApi } from '@/api';
import { useToastStore } from '@/store/toastStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { Category } from '@/types';

function extractStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

function CreateCategoryForm({ existing }: { existing: Category[] }) {
  const qc = useQueryClient();
  const { addToast } = useToastStore();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const duplicate = existing.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  const validationError = duplicate ? 'You already have a category with this name.' : error;
  const canSubmit = trimmed.length > 0 && !duplicate && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(undefined);
    setSaving(true);
    try {
      await categoriesApi.create({ name: trimmed });
      addToast('success', `Category "${trimmed}" created.`);
      setName('');
      qc.invalidateQueries({ queryKey: ['categories'] });
    } catch (err: unknown) {
      setError(
        extractStatus(err) === 409
          ? 'A category with this name already exists.'
          : 'Could not create the category.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New category</CardTitle>
      </CardHeader>
      <CardContent>
        <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={2} onSubmit={handleSubmit}>
          <Input
            label="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={validationError}
            required
            fullWidth
          />
          <Box>
            <Button type="submit" loading={saving} disabled={!canSubmit}>
              Add category
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function RenameCategoryDialog({
  category,
  siblings,
  open,
  onClose,
}: {
  category: Category;
  siblings: Category[];
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { addToast } = useToastStore();
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const duplicate = siblings.some(
    (c) => c.id !== category.id && c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const validationError = duplicate ? 'Another category already uses this name.' : error;
  const canSave = trimmed.length > 0 && !duplicate && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setError(undefined);
    setSaving(true);
    try {
      await categoriesApi.update(category.id, { name: trimmed });
      addToast('success', 'Category renamed.');
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    } catch (err: unknown) {
      setError(
        extractStatus(err) === 409
          ? 'A category with this name already exists.'
          : 'Could not rename the category.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="xs">
      <DialogTitle>Rename category</DialogTitle>
      <DialogContent>
        <Input
          autoFocus
          fullWidth
          label="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={validationError}
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

function CategoryRow({ category, siblings }: { category: Category; siblings: Category[] }) {
  const qc = useQueryClient();
  const { addToast } = useToastStore();
  const [renameOpen, setRenameOpen] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete the "${category.name}" category?`)) return;
    try {
      await categoriesApi.delete(category.id);
      addToast('success', `"${category.name}" deleted.`);
      qc.invalidateQueries({ queryKey: ['categories'] });
    } catch {
      addToast('error', 'Could not delete the category.');
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1 }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
          {category.name}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {category.slug}
        </Typography>
      </Box>
      {category.isSystem ? (
        <Tooltip title="Default categories cannot be edited or deleted">
          <Chip
            size="small"
            icon={<LockOutlinedIcon fontSize="small" />}
            label="Default"
            variant="outlined"
          />
        </Tooltip>
      ) : (
        <>
          <Tooltip title="Rename category">
            <IconButton size="small" onClick={() => setRenameOpen(true)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete category">
            <IconButton size="small" onClick={handleDelete}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <RenameCategoryDialog
            category={category}
            siblings={siblings}
            open={renameOpen}
            onClose={() => setRenameOpen(false)}
          />
        </>
      )}
    </Box>
  );
}

export function CategoriesPage() {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  return (
    <AppLayout>
      <Box sx={{ maxWidth: 640, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Categories
        </Typography>

        <CreateCategoryForm existing={categories} />

        <Card>
          <CardHeader>
            <CardTitle>Your categories</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Stack spacing={1}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rounded" height={44} />
                ))}
              </Stack>
            ) : categories.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ py: 2, textAlign: 'center' }}>
                No categories yet
              </Typography>
            ) : (
              <Stack divider={<Divider />}>
                {categories.map((c) => (
                  <CategoryRow key={c.id} category={c} siblings={categories} />
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </AppLayout>
  );
}
