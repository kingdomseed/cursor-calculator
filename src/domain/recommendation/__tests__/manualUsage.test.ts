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
      cursor_upcharge: 0,
      rates: { input: 5, cache_write: null, cache_read: 0.5, output: 22.5 },
    },
    thinking: true,
  },
  auto_checks: { max_mode: true },
};

const composer25Model: Model = {
  id: 'composer-2.5',
  name: 'Composer 2.5',
  provider: 'cursor',
  pool: 'auto_composer',
  context: { default: 200000, max: null },
  rates: { input: 0.5, cache_write: null, cache_read: 0.2, output: 2.5 },
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

const composerConfig: ModelConfig[] = [{
  modelId: 'composer-2.5',
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

  it('leaves Auto + Composer usage out of official API math without an anecdotal estimate', () => {
    const result = computeManualUsageRecommendation(
      {
        inputWithCacheWrite: 0,
        inputWithoutCacheWrite: 450_000_000,
        cacheRead: 0,
        output: 150_000_000,
        total: 600_000_000,
      },
      [composer25Model],
      composerConfig,
      plans,
    );

    const pro = result.all.find((plan) => plan.plan === 'pro');
    expect(result.best.plan).toBe('pro');
    expect(pro?.apiUsage).toBe(0);
    expect(pro?.totalCost).toBe(20);
    expect(pro?.perModel).toHaveLength(0);
  });

  it('models Composer 2.5 overage only after the anecdotal plan token allowance is exhausted', () => {
    const result = computeManualUsageRecommendation(
      {
        inputWithCacheWrite: 0,
        inputWithoutCacheWrite: 450_000_000,
        cacheRead: 0,
        output: 150_000_000,
        total: 600_000_000,
      },
      [composer25Model],
      composerConfig,
      plans,
      {
        sourceLabel: 'Community estimate',
        tokenAllowances: {
          pro: 500_000_000,
          pro_plus: 1_500_000_000,
          ultra: 6_000_000_000,
        },
      },
    );

    const pro = result.all.find((plan) => plan.plan === 'pro');
    const proPlus = result.all.find((plan) => plan.plan === 'pro_plus');

    expect(result.best.plan).toBe('pro_plus');
    expect(pro?.apiUsage).toBe(0);
    expect(pro?.estimatedIncludedPoolAllowanceTokens).toBe(500_000_000);
    expect(pro?.estimatedIncludedPoolOverageTokens).toBe(100_000_000);
    expect(pro?.estimatedIncludedPoolOverageCost).toBeCloseTo(100, 4);
    expect(pro?.totalCost).toBeCloseTo(120, 4);
    expect(pro?.perModel[0]?.sourceLabel).toBe('Community estimate');
    expect(proPlus?.estimatedIncludedPoolOverageCost).toBe(0);
  });
});
