import type { Queue, QueueEvents } from 'bullmq';
import type { IChartRepository } from '../repositories/interfaces/IRepository.js';
import type {
  ChartDateRange,
  ChartGroupBy,
  ChartMetric,
  ChartResult,
  ChartSpec,
  ChartType,
} from '../types/index.js';
import { CHART_JOB_NAME } from './JobQueueService.js';
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
    private readonly timeoutMs = 60_000,
  ) {}

  async query(userId: string, prompt: string): Promise<ChartResult> {
    const job = await this.queue.add(
      CHART_JOB_NAME,
      { prompt, allowed: ALLOWED_CHART_SPEC },
      { attempts: 1, removeOnComplete: true, removeOnFail: true },
    );

    let returnValue: unknown;
    try {
      returnValue = await job.waitUntilFinished(this.queueEvents, this.timeoutMs);
    } catch {
      // The worker errored or we timed out waiting for the model.
      throw new ChartGenerationFailedError();
    }

    const spec = this.validateSpec(returnValue);
    const rows = await this.chartRepo.aggregate(userId, spec);
    return { chart: spec.chart, rows };
  }

  /**
   * Turns the model's raw output into a validated {@link ChartSpec}. Anything
   * the model could not map to the whitelist (an explicit `unsupported` flag, a
   * missing field, or an out-of-whitelist token) becomes a friendly 422 rather
   * than a silent best-effort chart.
   */
  private validateSpec(raw: unknown): ChartSpec {
    const data = typeof raw === 'string' ? this.safeParse(raw) : raw;
    if (!data || typeof data !== 'object') throw new ChartUnsupportedError();

    const obj = data as Record<string, unknown>;
    if (obj.unsupported) throw new ChartUnsupportedError();

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

    return { metric, groupBy, dateRange, chart };
  }

  private safeParse(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
}
