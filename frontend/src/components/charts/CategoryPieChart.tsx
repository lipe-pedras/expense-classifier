import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Box from '@mui/material/Box';
import type { DashboardCategoryTotal } from '@/types';

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#64748b',
];

interface Props {
  data: DashboardCategoryTotal[];
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function CategoryPieChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <Box
        sx={{
          height: 192,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.disabled',
          fontSize: 14,
        }}
      >
        No expenses this month
      </Box>
    );
  }

  const chartData = data.map((d) => ({ name: d.categoryName, value: d.total }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => fmt.format(value)} />
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
