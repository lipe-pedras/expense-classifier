import { useQuery } from '@tanstack/react-query';
import { categoriesApi } from '@/api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { ExpenseFilters as Filters } from '@/types';

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function ExpenseFilters({ filters, onChange }: Props) {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const set = (key: keyof Filters, value: string) =>
    onChange({ ...filters, [key]: value || undefined });

  const reset = () => onChange({});

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        label="Category"
        value={filters.categorySlug ?? ''}
        onChange={(e) => set('categorySlug', e.target.value)}
        placeholder="All categories"
        className="w-44"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </Select>

      <Input
        label="Vendor"
        placeholder="Search vendor…"
        value={filters.vendor ?? ''}
        onChange={(e) => set('vendor', e.target.value)}
        className="w-40"
      />

      <Input
        label="From"
        type="date"
        value={filters.dateFrom ?? ''}
        onChange={(e) => set('dateFrom', e.target.value)}
        className="w-36"
      />

      <Input
        label="To"
        type="date"
        value={filters.dateTo ?? ''}
        onChange={(e) => set('dateTo', e.target.value)}
        className="w-36"
      />

      <Input
        label="Min (BRL)"
        type="number"
        placeholder="0"
        value={filters.minAmount ?? ''}
        onChange={(e) => set('minAmount', e.target.value)}
        className="w-28"
      />

      <Input
        label="Max (BRL)"
        type="number"
        placeholder="∞"
        value={filters.maxAmount ?? ''}
        onChange={(e) => set('maxAmount', e.target.value)}
        className="w-28"
      />

      {hasFilters && (
        <Button variant="ghost" size="md" onClick={reset}>
          Clear
        </Button>
      )}
    </div>
  );
}
