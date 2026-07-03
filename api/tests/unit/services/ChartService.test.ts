import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Queue, QueueEvents } from 'bullmq';
import { ChartService } from '../../../src/services/ChartService.js';
import type { IChartRepository } from '../../../src/repositories/interfaces/IRepository.js';
import { ChartGenerationFailedError, ChartUnsupportedError } from '../../../src/errors/AppError.js';

const validSpec = {
  metric: 'sum_amount',
  groupBy: 'category',
  dateRange: 'last_3_months',
  chart: 'pie',
};

function makeService(returnValue: unknown, reject = false) {
  const job = {
    waitUntilFinished: reject
      ? vi.fn().mockRejectedValue(new Error('timeout'))
      : vi.fn().mockResolvedValue(returnValue),
  };
  const queue = { add: vi.fn().mockResolvedValue(job) } as unknown as Queue;
  const queueEvents = {} as QueueEvents;
  const chartRepo: IChartRepository = {
    aggregate: vi.fn().mockResolvedValue([{ label: 'Rent', value: 100 }]),
  };
  const service = new ChartService(queue, queueEvents, chartRepo, 1000);
  return { service, queue, chartRepo, job };
}

describe('ChartService', () => {
  describe('query', () => {
    it('enqueues the prompt with the allowed whitelist', async () => {
      const { service, queue } = makeService(JSON.stringify(validSpec));
      await service.query('user-1', 'spending by category');
      expect(queue.add).toHaveBeenCalledWith(
        'generate-chart-spec',
        expect.objectContaining({ prompt: 'spending by category', allowed: expect.any(Object) }),
        expect.any(Object),
      );
    });

    it('compiles a valid spec (JSON string) and returns chart + aggregated rows', async () => {
      const { service, chartRepo } = makeService(JSON.stringify(validSpec));
      const result = await service.query('user-1', 'spending by category');

      expect(chartRepo.aggregate).toHaveBeenCalledWith('user-1', validSpec);
      expect(result).toEqual({ chart: 'pie', rows: [{ label: 'Rent', value: 100 }] });
    });

    it('accepts an already-parsed object return value (Node worker shape)', async () => {
      const { service } = makeService(validSpec);
      const result = await service.query('user-1', 'x');
      expect(result.chart).toBe('pie');
    });

    it('throws ChartUnsupportedError when the model returns { unsupported: true }', async () => {
      const { service, chartRepo } = makeService(JSON.stringify({ unsupported: true }));
      await expect(service.query('user-1', 'the weather')).rejects.toBeInstanceOf(
        ChartUnsupportedError,
      );
      expect(chartRepo.aggregate).not.toHaveBeenCalled();
    });

    it('throws ChartUnsupportedError on an out-of-whitelist token', async () => {
      const { service } = makeService(JSON.stringify({ ...validSpec, metric: 'median_amount' }));
      await expect(service.query('user-1', 'x')).rejects.toBeInstanceOf(ChartUnsupportedError);
    });

    it('throws ChartUnsupportedError on a missing field', async () => {
      const { service } = makeService(JSON.stringify({ metric: 'count', groupBy: 'vendor' }));
      await expect(service.query('user-1', 'x')).rejects.toBeInstanceOf(ChartUnsupportedError);
    });

    it('throws ChartUnsupportedError on unparseable output', async () => {
      const { service } = makeService('not json {{{');
      await expect(service.query('user-1', 'x')).rejects.toBeInstanceOf(ChartUnsupportedError);
    });

    it('throws ChartGenerationFailedError when the job fails or times out', async () => {
      const { service, chartRepo } = makeService(undefined, true);
      await expect(service.query('user-1', 'x')).rejects.toBeInstanceOf(ChartGenerationFailedError);
      expect(chartRepo.aggregate).not.toHaveBeenCalled();
    });
  });
});
