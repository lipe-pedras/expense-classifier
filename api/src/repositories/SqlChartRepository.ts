import { PrismaRepository } from './base/PrismaRepository.js';
import type { ISqlChartRepository } from './interfaces/IRepository.js';
import type { ChartRow } from '../types/index.js';

/** Thrown when the model's SQL fails validation/execution; carries the raw
 *  Postgres message so the caller can feed it back for a self-correction. */
export class SqlChartError extends Error {
  constructor(public readonly pgMessage: string) {
    super(pgMessage);
    this.name = 'SqlChartError';
  }
}

/** Hard cap on rows returned to the chart UI regardless of the model's SQL. */
const ROW_CAP = 500;

/**
 * Executes LLM-authored SQL under defence-in-depth controls:
 *   - the injected PrismaClient connects as the least-privilege `chart_reader`
 *     role (SELECT-only), so writes fail at the engine;
 *   - a read-only transaction pins `app.user_id`, which row-level security uses
 *     to fence every visible row to that user;
 *   - `statement_timeout` bounds runaway queries;
 *   - the query is wrapped to enforce the `label`/`value` result contract and
 *     the row cap;
 *   - `EXPLAIN` validates syntax, names, and the column contract before any
 *     execution, and its error is surfaced for the retry loop.
 * The model's SQL is never trusted for isolation — the database enforces it.
 */
export class SqlChartRepository extends PrismaRepository implements ISqlChartRepository {
  async run(userId: string, sql: string): Promise<ChartRow[]> {
    // Strip a trailing terminator so the statement composes inside a subquery;
    // stacked statements are additionally rejected by the extended protocol.
    const inner = sql.trim().replace(/;\s*$/, '');
    const wrapped = `SELECT "label", "value" FROM (${inner}) AS chart_q LIMIT ${ROW_CAP}`;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        // is_local = true → scoped to this transaction only.
        await tx.$executeRawUnsafe("SELECT set_config('app.user_id', $1, true)", userId);
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '3s'");

        // EXPLAIN (no ANALYZE) parses + resolves names/columns without executing.
        await tx.$queryRawUnsafe(`EXPLAIN ${wrapped}`);

        const rows = await tx.$queryRawUnsafe<Array<{ label: unknown; value: unknown }>>(wrapped);
        return rows.map((r) => ({ label: String(r.label ?? 'Unknown'), value: Number(r.value) }));
      });
    } catch (err) {
      throw new SqlChartError(err instanceof Error ? err.message : String(err));
    }
  }
}
