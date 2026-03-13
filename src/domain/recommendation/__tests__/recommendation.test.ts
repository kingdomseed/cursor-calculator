import { describe, expect, it } from 'vitest';

import type { Model, PricingData } from '../../catalog/types';
import type { ModelConfig } from '../../../lib/types';
import type { ExactTokenBreakdown, UsageLineItemInput } from '../types';
import { exactTokensToDollars, dollarsToTokens, tokensToDollars } from '../conversions';
import { formatCurrency, formatNumber, formatRate } from '../formatters';
import { computeEffectiveRates } from '../rates';
import { computeExactUsageRecommendation, computeRecommendation } from '../recommendation';

const opusModel: Model = {
  id: 'claude-4-6-opus',
  name: 'Claude 4.6 Opus',
  provider: 'anthropic',
  pool: 'api',
  context: { default: 200000, max: 1000000 },
  rates: { input: 5, cache_write: 6.25, cache_read: 0.5, output: 25 },
  variants: {
    max_mode: {
      cursor_upcharge: 0.20,
    },
    fast: {
      model_id: 'claude-4-6-opus-fast',
      rates: { input: 30, cache_write: 37.5, cache_read: 3, output: 150 },
    },
    thinking: true,
  },
};

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

const baseConfig: ModelConfig = {
  modelId: 'claude-4-6-opus',
  weight: 100,
  maxMode: false,
  fast: false,
  thinking: false,
  caching: false,
  cacheHitRate: 0,
};

const testPlans: PricingData['plans'] = {
  pro: { name: 'Pro', monthly_cost: 20, api_pool: 20, description: '' },
  pro_plus: { name: 'Pro Plus', monthly_cost: 60, api_pool: 70, description: '' },
  ultra: { name: 'Ultra', monthly_cost: 200, api_pool: 400, description: '' },
};

describe('computeEffectiveRates', () => {
  it('returns base rates with no variants enabled', () => {
    const rates = computeEffectiveRates(opusModel, baseConfig);
    expect(rates.input).toBe(5);
    expect(rates.output).toBe(25);
  });

  it('applies max mode as a cursor upcharge only', () => {
    const rates = computeEffectiveRates(opusModel, { ...baseConfig, maxMode: true });
    expect(rates.input).toBe(6);
    expect(rates.output).toBe(30);
  });

  it('replaces rates with the fast variant', () => {
    const rates = computeEffectiveRates(opusModel, { ...baseConfig, fast: true });
    expect(rates.input).toBe(30);
    expect(rates.output).toBe(150);
  });

  it('stacks max mode on top of fast variant pricing', () => {
    const rates = computeEffectiveRates(opusModel, { ...baseConfig, fast: true, maxMode: true });
    expect(rates.input).toBe(36);
    expect(rates.output).toBe(180);
  });

  it('applies Anthropic cache-write amortization', () => {
    const config = { ...baseConfig, caching: true, cacheHitRate: 50 };
    const rates = computeEffectiveRates(opusModel, config);
    expect(rates.input).toBeCloseTo(3.7917, 3);
    expect(rates.output).toBe(25);
  });

  it('scales cache rates when max mode and caching are both enabled', () => {
    const config = { ...baseConfig, maxMode: true, caching: true, cacheHitRate: 50 };
    const rates = computeEffectiveRates(opusModel, config);
    expect(rates.input).toBeCloseTo(4.55, 3);
    expect(rates.output).toBe(30);
  });

  it('applies caching after fast and max layering when all are enabled', () => {
    const config: ModelConfig = {
      modelId: 'claude-4-6-opus',
      weight: 100,
      maxMode: true,
      fast: true,
      thinking: false,
      caching: true,
      cacheHitRate: 50,
    };

    const rates = computeEffectiveRates(opusModel, config);
    expect(rates.input).toBeCloseTo(27.3, 3);
    expect(rates.output).toBe(180);
  });

  it('uses a simple cache-read blend for models without cache_write', () => {
    const config: ModelConfig = {
      modelId: 'gpt-5-4',
      weight: 100,
      maxMode: false,
      fast: false,
      thinking: false,
      caching: true,
      cacheHitRate: 50,
    };

    const rates = computeEffectiveRates(gpt54Model, config);
    expect(rates.input).toBeCloseTo(1.375, 3);
    expect(rates.output).toBe(15);
  });

  it('clamps cache hit rate before pricing cache blends', () => {
    const overConfigured: ModelConfig = {
      modelId: 'gpt-5-4',
      weight: 100,
      maxMode: false,
      fast: false,
      thinking: false,
      caching: true,
      cacheHitRate: 140,
    };

    const rates = computeEffectiveRates(gpt54Model, overConfigured);
    expect(rates.input).toBe(0.25);
    expect(rates.output).toBe(15);
  });
});

describe('computeRecommendation - budget mode', () => {
  it('recommends Pro Plus over Pro at a $60 budget', () => {
    const models = [opusModel];
    const configs: ModelConfig[] = [{ ...baseConfig }];

    const result = computeRecommendation('budget', 60, 0, models, configs, testPlans, 3);

    expect(result.best.plan).toBe('pro_plus');
  });

  it('filters out plans the user cannot afford', () => {
    const models = [opusModel];
    const configs: ModelConfig[] = [{ ...baseConfig }];

    const result = computeRecommendation('budget', 50, 0, models, configs, testPlans, 3);

    expect(result.best.plan).toBe('pro');
    expect(result.all.find((plan) => plan.plan === 'pro_plus')?.affordable).toBe(false);
    expect(result.all.find((plan) => plan.plan === 'ultra')?.affordable).toBe(false);
  });

  it('distributes budget across a weighted model mix', () => {
    const models = [opusModel, gpt54Model];
    const configs: ModelConfig[] = [
      { ...baseConfig, weight: 60 },
      {
        modelId: 'gpt-5-4',
        weight: 40,
        maxMode: false,
        fast: false,
        thinking: false,
        caching: false,
        cacheHitRate: 0,
      },
    ];

    const result = computeRecommendation('budget', 60, 0, models, configs, testPlans, 3);

    expect(result.best.perModel).toHaveLength(2);
    expect(result.best.perModel[0].modelId).toBe('claude-4-6-opus');
    expect(result.best.perModel[1].modelId).toBe('gpt-5-4');
    expect(result.best.perModel[1].tokens.total).toBeGreaterThan(result.best.perModel[0].tokens.total);
  });

  it('normalizes weights that do not sum to 100%', () => {
    const models = [opusModel, gpt54Model];
    const configs: ModelConfig[] = [
      { ...baseConfig, weight: 60 },
      {
        modelId: 'gpt-5-4',
        weight: 60,
        maxMode: false,
        fast: false,
        thinking: false,
        caching: false,
        cacheHitRate: 0,
      },
    ];

    const result = computeRecommendation('budget', 60, 0, models, configs, testPlans, 3);

    expect(result.best.perModel[0].apiCost).toBeCloseTo(result.best.perModel[1].apiCost, 1);
  });

  it('prefers the plan with more API pool headroom on a budget-mode tie', () => {
    const tiePlans: PricingData['plans'] = {
      pro: { name: 'Pro', monthly_cost: 10, api_pool: 15, description: '' },
      pro_plus: { name: 'Pro Plus', monthly_cost: 20, api_pool: 25, description: '' },
      ultra: { name: 'Ultra', monthly_cost: 200, api_pool: 400, description: '' },
    };

    const result = computeRecommendation('budget', 30, 0, [opusModel], [{ ...baseConfig }], tiePlans, 3);

    expect(result.best.plan).toBe('pro_plus');
  });
});

describe('computeRecommendation - token mode', () => {
  it('recommends the cheapest plan that covers the usage', () => {
    const result = computeRecommendation('tokens', 0, 500_000, [opusModel], [{ ...baseConfig }], testPlans, 3);
    expect(result.best.plan).toBe('pro');
  });

  it('calculates overage correctly', () => {
    const result = computeRecommendation('tokens', 0, 10_000_000, [opusModel], [{ ...baseConfig }], testPlans, 3);
    const proResult = result.all.find((plan) => plan.plan === 'pro');

    expect(proResult?.overage).toBeGreaterThan(0);
    expect(proResult?.totalCost).toBe((proResult?.subscription ?? 0) + (proResult?.overage ?? 0));
  });

  it('prefers the plan with more API pool headroom on a token-mode tie', () => {
    const tiePlans: PricingData['plans'] = {
      pro: { name: 'Pro', monthly_cost: 20, api_pool: 10, description: '' },
      pro_plus: { name: 'Pro Plus', monthly_cost: 30, api_pool: 20, description: '' },
      ultra: { name: 'Ultra', monthly_cost: 200, api_pool: 400, description: '' },
    };

    const result = computeRecommendation('tokens', 0, 5_000_000, [opusModel], [{ ...baseConfig }], tiePlans, 3);
    expect(result.best.plan).toBe('pro_plus');
  });

  it('handles zero-weight configs without crashing', () => {
    const result = computeRecommendation('budget', 60, 0, [opusModel], [{ ...baseConfig, weight: 0 }], testPlans, 3);
    expect(result.best.perModel[0].tokens.total).toBe(0);
  });
});

describe('exact usage pricing', () => {
  it('prices exact imported token categories without a global token ratio', () => {
    const exactTokens: ExactTokenBreakdown = {
      inputWithCacheWrite: 0,
      inputWithoutCacheWrite: 1_000_000,
      cacheRead: 250_000,
      output: 500_000,
      total: 1_750_000,
    };

    const cost = exactTokensToDollars(exactTokens, {
      input: 2.5,
      cache_write: null,
      cache_read: 0.25,
      output: 20,
    });

    expect(cost).toBeCloseTo(12.5625, 4);
  });

  it('reuses plan pool math for exact per-model usage entries', () => {
    const usage: UsageLineItemInput[] = [
      {
        key: 'gpt-5-fast',
        modelId: 'gpt-5-4',
        label: 'GPT-5.4',
        provider: 'openai',
        pool: 'api',
        tokens: {
          total: 1_750_000,
          input: 1_250_000,
          output: 500_000,
        },
        exactTokens: {
          inputWithCacheWrite: 0,
          inputWithoutCacheWrite: 1_000_000,
          cacheRead: 250_000,
          output: 500_000,
          total: 1_750_000,
        },
        maxMode: false,
        fast: false,
        thinking: false,
        caching: true,
        cacheHitRate: 0,
        approximated: false,
      },
    ];

    const result = computeExactUsageRecommendation(usage, [gpt54Model], testPlans);
    const pro = result.all.find((plan) => plan.plan === 'pro');

    expect(result.best.plan).toBe('pro');
    expect(pro?.apiUsage).toBeCloseTo(10.0625, 4);
    expect(pro?.overage).toBe(0);
    expect(pro?.perModel[0].label).toBe('GPT-5.4');
  });
});

describe('token conversions', () => {
  it('converts dollars to tokens at a 3:1 ratio', () => {
    const result = dollarsToTokens(20, { input: 5, output: 25 }, 3);

    expect(result.input).toBe(1_500_000);
    expect(result.output).toBe(500_000);
    expect(result.total).toBe(2_000_000);
  });

  it('returns zero tokens for zero dollars', () => {
    const result = dollarsToTokens(0, { input: 5, output: 25 }, 3);
    expect(result.total).toBe(0);
  });

  it('converts token totals back to dollars', () => {
    const rates = { input: 5, output: 25 };
    const tokens = dollarsToTokens(20, rates, 3);
    const cost = tokensToDollars(tokens.total, rates, 3);

    expect(cost).toBeCloseTo(20, 1);
  });
});

describe('formatters', () => {
  it('formats token counts as M, k, or raw values', () => {
    expect(formatNumber(1_500_000)).toBe('1.50M');
    expect(formatNumber(45_000)).toBe('45.0k');
    expect(formatNumber(999)).toBe('999');
  });

  it('formats currency with two decimals', () => {
    expect(formatCurrency(52.34)).toBe('$52.34');
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats per-million rates', () => {
    expect(formatRate(5)).toBe('$5.00');
    expect(formatRate(0.5)).toBe('$0.50');
  });
});
