import { describe, it, expect, vi } from 'vitest';
import type { Queue, QueueEvents } from 'bullmq';
import { ChartService } from '../../../src/services/ChartService.js';
import type {
  IChartRepository,
  ISqlChartRepository,
  ICategoryRepository,
} from '../../../src/repositories/interfaces/IRepository.js';
import { SqlChartError } from '../../../src/repositories/SqlChartRepository.js';
import { ChartGenerationFailedError, ChartUnsupportedError } from '../../../src/errors/AppError.js';

const validSpec = {
  mode: 'spec',
  metric: 'sum_amount',
  groupBy: 'category',
  dateRange: 'last_3_months',
  chart: 'pie',
};

const sqlPlan = {
  mode: 'sql',
  chart: 'line',
  sql: 'SELECT c.name AS label, SUM(e.amount) AS value FROM "Expense" e',
};

/**
 * Each queued job resolves to the next scripted return value, so a retry loop
 * can be driven by supplying several values in order.
 */
function makeService(returnValues: unknown[], opts: { rejectJob?: boolean } = {}) {
  const values = [...returnValues];
  const queue = {
    add: vi.fn().mockImplementation(async () => ({
      waitUntilFinished: opts.rejectJob
        ? vi.fn().mockRejectedValue(new Error('timeout'))
        : vi.fn().mockResolvedValue(values.shift()),
    })),
  } as unknown as Queue;
  const queueEvents = {} as QueueEvents;
  const chartRepo: IChartRepository = {
    aggregate: vi.fn().mockResolvedValue([{ label: 'Rent', value: 100 }]),
  };
  const sqlChartRepo: ISqlChartRepository = {
    run: vi.fn().mockResolvedValue([{ label: 'Rent', value: 200 }]),
  };
  const categoryRepo = {
    findAllByUser: vi.fn().mockResolvedValue([{ slug: 'rent', name: 'Rent' }]),
  } as unknown as ICategoryRepository;
  const service = new ChartService(queue, queueEvents, chartRepo, sqlChartRepo, categoryRepo, 1000);
  return { service, queue, chartRepo, sqlChartRepo, categoryRepo };
}

describe('ChartService', () => {
  describe('query — spec path', () => {
    it('enqueues the prompt with whitelist and the user categories', async () => {
      const { service, queue, categoryRepo } = makeService([JSON.stringify(validSpec)]);
      await service.query('user-1', 'spending by category');
      expect(categoryRepo.findAllByUser).toHaveBeenCalledWith('user-1');
      expect(queue.add).toHaveBeenCalledWith(
        'generate-chart-spec',
        expect.objectContaining({
          prompt: 'spending by category',
          allowed: expect.any(Object),
          categories: [{ slug: 'rent', name: 'Rent' }],
        }),
        expect.any(Object),
      );
    });

    it('compiles a valid spec and returns chart + aggregated rows', async () => {
      const { service, chartRepo } = makeService([JSON.stringify(validSpec)]);
      const result = await service.query('user-1', 'spending by category');
      expect(chartRepo.aggregate).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ metric: 'sum_amount', groupBy: 'category', chart: 'pie' }),
      );
      expect(result).toEqual({ chart: 'pie', rows: [{ label: 'Rent', value: 100 }] });
    });

    it('accepts an already-parsed object return value (Node worker shape)', async () => {
      const { service } = makeService([validSpec]);
      const result = await service.query('user-1', 'x');
      expect(result.chart).toBe('pie');
    });
  });

  describe('query — sql path', () => {
    it('runs model SQL and returns its chart + rows', async () => {
      const { service, sqlChartRepo, chartRepo } = makeService([JSON.stringify(sqlPlan)]);
      const result = await service.query('user-1', 'rent per month');
      expect(sqlChartRepo.run).toHaveBeenCalledWith('user-1', sqlPlan.sql);
      expect(chartRepo.aggregate).not.toHaveBeenCalled();
      expect(result).toEqual({ chart: 'line', rows: [{ label: 'Rent', value: 200 }] });
    });

    it('feeds a Postgres error back and succeeds on the corrected SQL', async () => {
      const fixed = { ...sqlPlan, sql: 'SELECT c.name AS label, COUNT(*) AS value FROM "Expense" e' };
      const { service, sqlChartRepo, queue } = makeService([JSON.stringify(sqlPlan), JSON.stringify(fixed)]);
      (sqlChartRepo.run as any)
        .mockRejectedValueOnce(new SqlChartError('column "amount" does not exist'))
        .mockResolvedValueOnce([{ label: 'Rent', value: 3 }]);

      const result = await service.query('user-1', 'rent per month');

      expect(sqlChartRepo.run).toHaveBeenCalledTimes(2);
      // Second enqueue carries the retry payload with the prior SQL + error.
      expect(queue.add).toHaveBeenLastCalledWith(
        'generate-chart-spec',
        expect.objectContaining({
          retry: { sql: sqlPlan.sql, error: 'column "amount" does not exist' },
        }),
        expect.any(Object),
      );
      expect(result).toEqual({ chart: 'line', rows: [{ label: 'Rent', value: 3 }] });
    });

    it('gives up with a friendly 422 after exhausting retries', async () => {
      const { service, sqlChartRepo } = makeService([
        JSON.stringify(sqlPlan),
        JSON.stringify(sqlPlan),
        JSON.stringify(sqlPlan),
      ]);
      (sqlChartRepo.run as any).mockRejectedValue(new SqlChartError('boom'));

      await expect(service.query('user-1', 'x')).rejects.toBeInstanceOf(ChartUnsupportedError);
      // initial + 2 retries = 3 attempts
      expect(sqlChartRepo.run).toHaveBeenCalledTimes(3);
    });

    it('honours a model that falls back from sql to a compilable spec', async () => {
      const { service, sqlChartRepo, chartRepo } = makeService([
        JSON.stringify(sqlPlan),
        JSON.stringify(validSpec),
      ]);
      (sqlChartRepo.run as any).mockRejectedValueOnce(new SqlChartError('bad'));

      const result = await service.query('user-1', 'x');
      expect(chartRepo.aggregate).toHaveBeenCalledTimes(1);
      expect(result.chart).toBe('pie');
    });
  });

  describe('query — rejections', () => {
    it('throws ChartUnsupportedError when the model returns { unsupported: true }', async () => {
      const { service, chartRepo, sqlChartRepo } = makeService([JSON.stringify({ unsupported: true })]);
      await expect(service.query('user-1', 'the weather')).rejects.toBeInstanceOf(ChartUnsupportedError);
      expect(chartRepo.aggregate).not.toHaveBeenCalled();
      expect(sqlChartRepo.run).not.toHaveBeenCalled();
    });

    it('throws ChartUnsupportedError on an out-of-whitelist spec token', async () => {
      const { service } = makeService([JSON.stringify({ ...validSpec, metric: 'median_amount' })]);
      await expect(service.query('user-1', 'x')).rejects.toBeInstanceOf(ChartUnsupportedError);
    });

    it('throws ChartUnsupportedError on a sql plan with no query', async () => {
      const { service } = makeService([JSON.stringify({ mode: 'sql', chart: 'bar', sql: '  ' })]);
      await expect(service.query('user-1', 'x')).rejects.toBeInstanceOf(ChartUnsupportedError);
    });

    it('throws ChartUnsupportedError on unparseable output', async () => {
      const { service } = makeService(['not json {{{']);
      await expect(service.query('user-1', 'x')).rejects.toBeInstanceOf(ChartUnsupportedError);
    });

    it('throws ChartGenerationFailedError when the job fails or times out', async () => {
      const { service, chartRepo } = makeService([], { rejectJob: true });
      await expect(service.query('user-1', 'x')).rejects.toBeInstanceOf(ChartGenerationFailedError);
      expect(chartRepo.aggregate).not.toHaveBeenCalled();
    });
  });
});
