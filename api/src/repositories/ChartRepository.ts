import { PrismaRepository } from './base/PrismaRepository.js';
import type { IChartRepository } from './interfaces/IRepository.js';
import type {
  ChartGroupBy,
  ChartMetric,
  ChartRow,
  ChartSpec,
  ChartDateRange,
} from '../types/index.js';

/**
 * Compiles a validated {@link ChartSpec} into parameterised SQL and runs it.
 *
 * SECURITY: every SQL fragment below is a hardcoded constant selected by an
 * already-validated enum token — no caller/LLM text is ever concatenated into
 * the query. The only runtime value is `userId`, bound as `$1`, and every query
 * is scoped by `WHERE e."userId" = $1`, so a request can never read another
 * user's rows nor inject SQL.
 */
const METRIC_SQL: Record<ChartMetric, string> = {
  sum_amount: 'COALESCE(SUM(e."amount"), 0)::float',
  count: 'COUNT(*)::int',
  avg_amount: 'COALESCE(AVG(e."amount"), 0)::float',
};

interface GroupFragment {
  join: string;
  label: string;
  /** Ordering clause referencing the SELECT ordinals (1 = label, 2 = value). */
  order: string;
}

const GROUP_SQL: Record<ChartGroupBy, GroupFragment> = {
  category: {
    join: 'LEFT JOIN "Category" c ON c."id" = e."categoryId"',
    label: `COALESCE(c."name", 'Uncategorized')`,
    order: 'value DESC',
  },
  month: {
    join: '',
    label: `to_char(date_trunc('month', e."expenseDate"), 'YYYY-MM')`,
    order: 'label ASC',
  },
  vendor: {
    join: '',
    label: `COALESCE(NULLIF(e."vendor", ''), 'Unknown')`,
    order: 'value DESC',
  },
  currency: {
    join: '',
    label: 'e."currency"',
    order: 'value DESC',
  },
};

const DATE_SQL: Record<ChartDateRange, string> = {
  all: '',
  last_month: `AND e."expenseDate" >= now() - interval '1 month'`,
  last_3_months: `AND e."expenseDate" >= now() - interval '3 months'`,
  last_6_months: `AND e."expenseDate" >= now() - interval '6 months'`,
  last_year: `AND e."expenseDate" >= now() - interval '1 year'`,
};

export class ChartRepository extends PrismaRepository implements IChartRepository {
  async aggregate(userId: string, spec: ChartSpec): Promise<ChartRow[]> {
    const metric = METRIC_SQL[spec.metric];
    const group = GROUP_SQL[spec.groupBy];
    const dateClause = DATE_SQL[spec.dateRange];

    const sql = `
      SELECT ${group.label} AS label, ${metric} AS value
      FROM "Expense" e
      ${group.join}
      WHERE e."userId" = $1 ${dateClause}
      GROUP BY 1
      ORDER BY ${group.order}
      LIMIT 100
    `;

    const rows = await this.prisma.$queryRawUnsafe<Array<{ label: string | null; value: number }>>(
      sql,
      userId,
    );
    return rows.map((r) => ({ label: r.label ?? 'Unknown', value: Number(r.value) }));
  }
}
