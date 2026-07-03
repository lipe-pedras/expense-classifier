import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import type { ChartResult } from '@/types';

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#64748b',
];

const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function QueryChart({ result }: { result: ChartResult }) {
  const { chart, rows } = result;

  if (rows.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center', color: 'text.disabled' }}>
        No data matched that query.
      </Box>
    );
  }

  if (chart === 'table') {
    return (
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Label</TableCell>
              <TableCell align="right">Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.label}</TableCell>
                <TableCell align="right">{fmt.format(r.value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    );
  }

  if (chart === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={110} paddingAngle={2}>
            {rows.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => fmt.format(v)} />
          <Legend
            formatter={(value) => (
              <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                {value}
              </Box>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chart === 'line') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmt.format(v)} width={70} />
          <Tooltip formatter={(v: number) => fmt.format(v)} />
          <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // default: bar
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmt.format(v)} width={70} />
        <Tooltip formatter={(v: number) => fmt.format(v)} />
        <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
          {rows.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
