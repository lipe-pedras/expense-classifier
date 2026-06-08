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
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableSortLabel from '@mui/material/TableSortLabel';
import TablePagination from '@mui/material/TablePagination';
import Paper from '@mui/material/Paper';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
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
        cell: (info) =>
          info.getValue() ?? <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>,
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
      <Stack spacing={1}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="rounded" height={40} />
        ))}
      </Stack>
    );
  }

  const { pageIndex, pageSize } = table.getState().pagination;

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
        </Typography>
        <Button
          variant="secondary"
          size="sm"
          onClick={onExport}
          loading={exporting}
          startIcon={<FileDownloadIcon />}
        >
          Export XLSX
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} sx={{ bgcolor: 'action.hover' }}>
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableCell key={header.id} sx={{ fontWeight: 600 }}>
                      {header.column.getCanSort() ? (
                        <TableSortLabel
                          active={Boolean(sorted)}
                          direction={sorted === 'desc' ? 'desc' : 'asc'}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </TableSortLabel>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 4, color: 'text.disabled' }}>
                  No expenses match the current filters
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} hover>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={expenses.length}
        page={pageIndex}
        onPageChange={(_, page) => table.setPageIndex(page)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => table.setPageSize(Number(e.target.value))}
        rowsPerPageOptions={[10, 20, 50]}
      />
    </Stack>
  );
}
