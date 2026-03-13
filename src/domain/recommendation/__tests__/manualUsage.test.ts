import { describe, expect, it } from 'vitest';

import type { Model, PricingData } from '../../catalog/types';
import type { ModelConfig } from '../../../lib/types';
import { buildManualUsageEntries, buildSimpleExactTokenBreakdown, computeManualUsageRecommendation } from '../manualUsage';

const gpt54Model: Model = {
  id: 'gpt-5-4',
  name: 'GPT-5.4',
  provider: 'openai',
  pool: 'api',
  context: { default: 272000, max: 1000000 },
  rates: { input: 2.5, cache_write: null, cache_read: 0.25, output: 15 },
  variants: {
    max_mode: {
      cursor_upcharge: 0.20,
    },
    thinking: true,
  },
  auto_checks: { max_mode: true },
};

const plans: PricingData['plans'] = {
  pro: { name: 'Pro', monthly_cost: 20, api_pool: 20, description: '' },
  pro_plus: { name: 'Pro Plus', monthly_cost: 60, api_pool: 70, description: '' },
  ultra: { name: 'Ultra', monthly_cost: 200, api_pool: 400, description: '' },
};

const singleConfig: ModelConfig[] = [{
  modelId: 'gpt-5-4',
  weight: 100,
  maxMode: false,
  fast: false,
  thinking: false,
  caching: false,
  cacheHitRate: 0,
}];

describe('buildSimpleExactTokenBreakdown', () => {
  it('converts total tokens, cache-read share, and ratio into exact buckets', () => {
    const breakdown = buildSimpleExactTokenBreakdown(1_000_000, 80, 3);

    expect(breakdown).toEqual({
      inputWithCacheWrite: 0,
      inputWithoutCacheWrite: 150_000,
      cacheRead: 800_000,
      output: 50_000,
      total: 1_000_000,
    });
  });
});

describe('buildManualUsageEntries', () => {
  it('preserves exact token buckets in per-model usage entries', () => {
    const entries = buildManualUsageEntries(
      {
        inputWithCacheWrite: 0,
        inputWithoutCacheWrite: 1_000_000,
        cacheRead: 250_000,
        output: 500_000,
        total: 1_750_000,
      },
      [gpt54Model],
      singleConfig,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.exactTokens).toEqual({
      inputWithCacheWrite: 0,
      inputWithoutCacheWrite: 1_000_000,
      cacheRead: 250_000,
      output: 500_000,
      total: 1_750_000,
    });
    expect(entries[0]?.tokens).toEqual({
      total: 1_750_000,
      input: 1_250_000,
      output: 500_000,
    });
  });
});

describe('computeManualUsageRecommendation', () => {
  it('prices manual exact-token usage through the exact usage path', () => {
    const result = computeManualUsageRecommendation(
      {
        inputWithCacheWrite: 0,
        inputWithoutCacheWrite: 1_000_000,
        cacheRead: 250_000,
        output: 500_000,
        total: 1_750_000,
      },
      [gpt54Model],
      singleConfig,
      plans,
    );

    const pro = result.all.find((plan) => plan.plan === 'pro');
    expect(result.best.plan).toBe('pro');
    expect(pro?.apiUsage).toBeCloseTo(10.0625, 4);
    expect(pro?.perModel[0]?.exactTokens?.cacheRead).toBe(250_000);
  });
});
