import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { categoriesApi, expensesApi } from '@/api';
import { Button } from '@/components/ui/Button';
import type { Expense, ExpenseFilters } from '@/types';

const col = createColumnHelper<Expense>();

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}

interface Props {
  filters: ExpenseFilters;
  onExport: () => void;
  exporting: boolean;
}

export function ExpenseTable({ filters, onExport, exporting }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', filters],
    queryFn: () => expensesApi.list(filters),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const columns = useMemo(
    () => [
      col.accessor('expenseDate', {
        header: 'Date',
        cell: (info) => formatDate(info.getValue()),
        sortingFn: 'datetime',
      }),
      col.accessor('vendor', {
        header: 'Vendor',
        cell: (info) => info.getValue() ?? <span className="text-gray-400">—</span>,
      }),
      col.accessor('categoryId', {
        header: 'Category',
        cell: (info) => categoryById.get(info.getValue())?.name ?? info.getValue(),
        enableSorting: false,
      }),
      col.accessor('amount', {
        header: 'Amount',
        cell: (info) => currencyFmt.format(info.getValue()),
      }),
      col.accessor('currency', {
        header: 'CCY',
        enableSorting: false,
      }),
      col.accessor('confidence', {
        header: 'Conf.',
        cell: (info) => `${Math.round(info.getValue() * 100)}%`,
      }),
    ],
    [categoryById],
  );

  const table = useReactTable({
    data: expenses,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
        </p>
        <Button variant="secondary" size="sm" onClick={onExport} loading={exporting}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export XLSX
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 ${
                      header.column.getCanSort() ? 'cursor-pointer select-none hover:text-gray-700' : ''
                    }`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && ' ↑'}
                      {header.column.getIsSorted() === 'desc' && ' ↓'}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-sm text-gray-400">
                  No expenses match the current filters
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-gray-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              ← Prev
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
