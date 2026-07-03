import type { Queue, QueueEvents } from 'bullmq';
import type {
  IChartRepository,
  ISqlChartRepository,
  ICategoryRepository,
} from '../repositories/interfaces/IRepository.js';
import type {
  ChartDateRange,
  ChartGroupBy,
  ChartMetric,
  ChartPlan,
  ChartResult,
  ChartSpec,
  ChartType,
} from '../types/index.js';
import { CHART_JOB_NAME } from './JobQueueService.js';
import { SqlChartError } from '../repositories/SqlChartRepository.js';
import { ChartGenerationFailedError, ChartUnsupportedError } from '../errors/AppError.js';

export const CHART_METRICS: readonly ChartMetric[] = ['sum_amount', 'count', 'avg_amount'];
export const CHART_GROUP_BYS: readonly ChartGroupBy[] = ['category', 'month', 'vendor', 'currency'];
export const CHART_DATE_RANGES: readonly ChartDateRange[] = [
  'last_month',
  'last_3_months',
  'last_6_months',
  'last_year',
  'all',
];
export const CHART_TYPES: readonly ChartType[] = ['bar', 'pie', 'line', 'table'];

// Whitelist of tokens the LLM may choose from — sent with each job so the worker
// (and therefore the model) can only ever pick from what the API can compile.
export const ALLOWED_CHART_SPEC = {
  metric: CHART_METRICS,
  groupBy: CHART_GROUP_BYS,
  dateRange: CHART_DATE_RANGES,
  chart: CHART_TYPES,
} as const;

export class ChartService {
  constructor(
    private readonly queue: Queue,
    private readonly queueEvents: QueueEvents,
    private readonly chartRepo: IChartRepository,
    private readonly sqlChartRepo: ISqlChartRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly timeoutMs = 60_000,
    /** Max times a failed model SQL is fed back for self-correction. */
    private readonly maxSqlRetries = 2,
  ) {}

  async query(userId: string, prompt: string): Promise<ChartResult> {
    // Ground the model on the user's own category vocabulary (Step 5 pattern).
    const categories = (await this.categoryRepo.findAllByUser(userId)).map((c) => ({
      slug: c.slug,
      name: c.name,
    }));

    const plan = this.validatePlan(await this.requestPlan(prompt, categories));
    return this.resolvePlan(userId, plan, prompt, categories);
  }

  /** Enqueues a generation (or fix) job and awaits the model's raw output. */
  private async requestPlan(
    prompt: string,
    categories: Array<{ slug: string; name: string }>,
    retry?: { sql: string; error: string },
  ): Promise<unknown> {
    const job = await this.queue.add(
      CHART_JOB_NAME,
      { prompt, allowed: ALLOWED_CHART_SPEC, categories, ...(retry ? { retry } : {}) },
      { attempts: 1, removeOnComplete: true, removeOnFail: true },
    );

    try {
      return await job.waitUntilFinished(this.queueEvents, this.timeoutMs);
    } catch {
      // The worker errored or we timed out waiting for the model.
      throw new ChartGenerationFailedError();
    }
  }

  /** Executes a validated plan: compile the safe spec, or run model SQL with a
   *  bounded self-correction loop feeding Postgres errors back to the model. */
  private async resolvePlan(
    userId: string,
    plan: ChartPlan,
    prompt: string,
    categories: Array<{ slug: string; name: string }>,
  ): Promise<ChartResult> {
    if (plan.mode === 'spec') {
      const rows = await this.chartRepo.aggregate(userId, plan);
      return { chart: plan.chart, rows };
    }

    let sql = plan.sql;
    let chart = plan.chart;
    for (let attempt = 0; ; attempt++) {
      try {
        const rows = await this.sqlChartRepo.run(userId, sql);
        return { chart, rows };
      } catch (err) {
        if (!(err instanceof SqlChartError) || attempt >= this.maxSqlRetries) {
          // Out of retries (or an unexpected error): fail friendly.
          throw new ChartUnsupportedError();
        }
        // Ask the model to fix its SQL given the Postgres error.
        const fixed = this.validatePlan(
          await this.requestPlan(prompt, categories, { sql, error: err.pgMessage }),
        );
        if (fixed.mode === 'spec') {
          // The model gave up on SQL and fell back to a compilable spec.
          const rows = await this.chartRepo.aggregate(userId, fixed);
          return { chart: fixed.chart, rows };
        }
        sql = fixed.sql;
        chart = fixed.chart;
      }
    }
  }

  /**
   * Turns the model's raw output into a validated {@link ChartPlan}. A `spec`
   * plan is whitelisted token-by-token; a `sql` plan only needs a valid chart
   * type and a non-empty query (the database enforces its safety). Anything
   * else — an `unsupported` flag, a bad token, a missing field — becomes a
   * friendly 422 rather than a silent best-effort chart.
   */
  private validatePlan(raw: unknown): ChartPlan {
    const data = typeof raw === 'string' ? this.safeParse(raw) : raw;
    if (!data || typeof data !== 'object') throw new ChartUnsupportedError();

    const obj = data as Record<string, unknown>;
    if (obj.unsupported) throw new ChartUnsupportedError();

    if (obj.mode === 'sql') {
      const chart = obj.chart as ChartType;
      const sql = obj.sql;
      if (!CHART_TYPES.includes(chart) || typeof sql !== 'string' || !sql.trim()) {
        throw new ChartUnsupportedError();
      }
      return { mode: 'sql', chart, sql };
    }

    // `mode: 'spec'` (or a legacy spec without a mode field).
    const metric = obj.metric as ChartMetric;
    const groupBy = obj.groupBy as ChartGroupBy;
    const dateRange = obj.dateRange as ChartDateRange;
    const chart = obj.chart as ChartType;

    if (
      !CHART_METRICS.includes(metric) ||
      !CHART_GROUP_BYS.includes(groupBy) ||
      !CHART_DATE_RANGES.includes(dateRange) ||
      !CHART_TYPES.includes(chart)
    ) {
      throw new ChartUnsupportedError();
    }

    return { mode: 'spec', metric, groupBy, dateRange, chart };
  }

  private safeParse(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
}
