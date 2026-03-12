import { describe, it, expect } from 'vitest';
import { computeEffectiveRates, computeRecommendation, dollarsToTokens, tokensToDollars } from '../calculations';
import { formatNumber, formatCurrency, formatRate } from '../calculations';
import type { Model, ModelConfig, PricingData } from '../types';

// Test fixture: Claude 4.6 Opus
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

const baseConfig: ModelConfig = {
  modelId: 'claude-4-6-opus',
  weight: 100,
  maxMode: false,
  fast: false,
  thinking: false,
  caching: false,
  cacheHitRate: 0,
};

describe('computeEffectiveRates', () => {
  it('returns base rates with no variants enabled', () => {
    const rates = computeEffectiveRates(opusModel, baseConfig);
    expect(rates.input).toBe(5);
    expect(rates.output).toBe(25);
  });

  it('applies Max Mode: 20% cursor upcharge only', () => {
    const rates = computeEffectiveRates(opusModel, { ...baseConfig, maxMode: true });
    // input: 5 * 1.20 = 6
    expect(rates.input).toBe(6);
    // output: 25 * 1.20 = 30
    expect(rates.output).toBe(30);
  });

  it('applies Fast mode: replaces rates entirely', () => {
    const rates = computeEffectiveRates(opusModel, { ...baseConfig, fast: true });
    expect(rates.input).toBe(30);
    expect(rates.output).toBe(150);
  });

  it('Fast mode ignores Max Mode even if both are true', () => {
    const rates = computeEffectiveRates(opusModel, { ...baseConfig, fast: true, maxMode: true });
    expect(rates.input).toBe(30);
    expect(rates.output).toBe(150);
  });

  it('applies caching blend for Anthropic models (has cache_write)', () => {
    const config = { ...baseConfig, caching: true, cacheHitRate: 50 };
    const rates = computeEffectiveRates(opusModel, config);
    // No Max Mode, so cache rates stay raw. RE_READS=3, cachedRatio=0.5, uncachedRatio=0.5
    // effective = (0.5*6.25 + 0.5*0.5*3 + 0.5*5*3) / 3
    // = (3.125 + 0.75 + 7.5) / 3 = 11.375 / 3 = 3.7917
    expect(rates.input).toBeCloseTo(3.7917, 3);
    expect(rates.output).toBe(25);
  });

  it('scales cache rates with Max Mode upcharge when both are active', () => {
    const config = { ...baseConfig, maxMode: true, caching: true, cacheHitRate: 50 };
    const rates = computeEffectiveRates(opusModel, config);
    // Max Mode: upcharge=1.2 only (no long-context multiplier)
    // Scaled input: 5 * 1.2 = 6
    // Scaled cache_write: 6.25 * 1.2 = 7.5
    // Scaled cache_read: 0.5 * 1.2 = 0.6
    // RE_READS=3, cachedRatio=0.5
    // effective = (0.5*7.5 + 0.5*0.6*3 + 0.5*6*3) / 3
    // = (3.75 + 0.9 + 9) / 3 = 13.65 / 3 = 4.55
    expect(rates.input).toBeCloseTo(4.55, 3);
    // output: 25 * 1.2 = 30
    expect(rates.output).toBe(30);
  });
});

describe('computeEffectiveRates - Fast + Caching', () => {
  it('applies caching with fast variant rates on Anthropic model', () => {
    const config: ModelConfig = {
      modelId: 'claude-4-6-opus', weight: 100,
      maxMode: false, fast: true, thinking: false,
      caching: true, cacheHitRate: 50,
    };
    const rates = computeEffectiveRates(opusModel, config);
    // Fast rates: input=30, cache_write=37.5, cache_read=3
    // RE_READS=3, cachedRatio=0.5
    // effective = (0.5*37.5 + 0.5*3*3 + 0.5*30*3) / 3
    // = (18.75 + 4.5 + 45) / 3 = 68.25 / 3 = 22.75
    expect(rates.input).toBeCloseTo(22.75, 3);
    expect(rates.output).toBe(150);
  });
});

// Test fixture: GPT-5.4 (no cache_write)
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

describe('computeEffectiveRates - non-Anthropic caching', () => {
  it('uses simple blend for cache_read-only models', () => {
    const config: ModelConfig = {
      modelId: 'gpt-5-4', weight: 100,
      maxMode: false, fast: false, thinking: false,
      caching: true, cacheHitRate: 50,
    };
    const rates = computeEffectiveRates(gpt54Model, config);
    // 0.5 * 0.25 + 0.5 * 2.5 = 0.125 + 1.25 = 1.375
    expect(rates.input).toBeCloseTo(1.375, 3);
    expect(rates.output).toBe(15);
  });

  it('GPT-5.4 Max Mode applies 20% upcharge only', () => {
    const config: ModelConfig = {
      modelId: 'gpt-5-4', weight: 100,
      maxMode: true, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    };
    const rates = computeEffectiveRates(gpt54Model, config);
    // input: 2.5 * 1.2 = 3.0
    expect(rates.input).toBe(3);
    // output: 15 * 1.2 = 18.0
    expect(rates.output).toBe(18);
  });

  it('model with no variants returns base rates regardless of config', () => {
    const bareModel: Model = {
      id: 'kimi-k2-5', name: 'Kimi K2.5', provider: 'moonshot', pool: 'api',
      context: { default: 131072, max: null },
      rates: { input: 0.6, cache_write: null, cache_read: 0.1, output: 3 },
    };
    const config: ModelConfig = {
      modelId: 'kimi-k2-5', weight: 100,
      maxMode: true, fast: true, thinking: true,
      caching: false, cacheHitRate: 0,
    };
    const rates = computeEffectiveRates(bareModel, config);
    expect(rates.input).toBe(0.6);
    expect(rates.output).toBe(3);
  });
});

// Minimal pricing data for tests
const testPlans: PricingData['plans'] = {
  pro: { name: 'Pro', monthly_cost: 20, api_pool: 20, description: '' },
  pro_plus: { name: 'Pro Plus', monthly_cost: 60, api_pool: 70, description: '' },
  ultra: { name: 'Ultra', monthly_cost: 200, api_pool: 400, description: '' },
};

describe('computeRecommendation - budget mode', () => {
  it('recommends Pro Plus over Pro at $60 budget (Pro Plus gives more tokens)', () => {
    const models = [opusModel];
    const configs: ModelConfig[] = [{
      modelId: 'claude-4-6-opus', weight: 100,
      maxMode: false, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    }];
    const result = computeRecommendation('budget', 60, 0, models, configs, testPlans, 3);
    expect(result.best.plan).toBe('pro_plus');
  });

  it('filters out plans user cannot afford', () => {
    const models = [opusModel];
    const configs: ModelConfig[] = [{
      modelId: 'claude-4-6-opus', weight: 100,
      maxMode: false, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    }];
    const result = computeRecommendation('budget', 50, 0, models, configs, testPlans, 3);
    expect(result.best.plan).toBe('pro');
    expect(result.all.find(p => p.plan === 'pro_plus')!.affordable).toBe(false);
    expect(result.all.find(p => p.plan === 'ultra')!.affordable).toBe(false);
  });

  it('distributes budget across weighted model mix', () => {
    const models = [opusModel, gpt54Model];
    const configs: ModelConfig[] = [
      { modelId: 'claude-4-6-opus', weight: 60, maxMode: false, fast: false, thinking: false, caching: false, cacheHitRate: 0 },
      { modelId: 'gpt-5-4', weight: 40, maxMode: false, fast: false, thinking: false, caching: false, cacheHitRate: 0 },
    ];
    const result = computeRecommendation('budget', 60, 0, models, configs, testPlans, 3);
    const best = result.best;
    expect(best.perModel).toHaveLength(2);
    expect(best.perModel[0].modelId).toBe('claude-4-6-opus');
    expect(best.perModel[1].modelId).toBe('gpt-5-4');
    expect(best.perModel[1].tokens.total).toBeGreaterThan(best.perModel[0].tokens.total);
  });

  it('normalizes weights that do not sum to 100%', () => {
    const models = [opusModel, gpt54Model];
    const configs: ModelConfig[] = [
      { modelId: 'claude-4-6-opus', weight: 60, maxMode: false, fast: false, thinking: false, caching: false, cacheHitRate: 0 },
      { modelId: 'gpt-5-4', weight: 60, maxMode: false, fast: false, thinking: false, caching: false, cacheHitRate: 0 },
    ];
    const result = computeRecommendation('budget', 60, 0, models, configs, testPlans, 3);
    const best = result.best;
    expect(best.perModel[0].apiCost).toBeCloseTo(best.perModel[1].apiCost, 1);
  });
});

describe('computeRecommendation - tiebreaking', () => {
  it('prefers plan with more API pool headroom on tie', () => {
    const tiePlans2: PricingData['plans'] = {
      pro:      { name: 'Pro',      monthly_cost: 10, api_pool: 15, description: '' },
      pro_plus: { name: 'Pro Plus', monthly_cost: 20, api_pool: 25, description: '' },
      ultra:    { name: 'Ultra',    monthly_cost: 200, api_pool: 400, description: '' },
    };
    const models = [opusModel];
    const configs: ModelConfig[] = [{
      modelId: 'claude-4-6-opus', weight: 100,
      maxMode: false, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    }];
    const result = computeRecommendation('budget', 30, 0, models, configs, tiePlans2, 3);
    expect(result.best.plan).toBe('pro_plus');
  });
});

describe('computeRecommendation - edge cases', () => {
  it('handles zero-weight configs without crashing', () => {
    const models = [opusModel];
    const configs: ModelConfig[] = [{
      modelId: 'claude-4-6-opus', weight: 0,
      maxMode: false, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    }];
    const result = computeRecommendation('budget', 60, 0, models, configs, testPlans, 3);
    expect(result.best).toBeDefined();
    expect(result.best.perModel[0].tokens.total).toBe(0);
  });
});

describe('computeRecommendation - token mode tiebreaking', () => {
  it('prefers plan with more API pool headroom on token mode tie', () => {
    // Plans where (subscription - api_pool) is identical, so any usage
    // exceeding both pools produces the same total cost.
    const tiePlans: PricingData['plans'] = {
      pro:      { name: 'Pro',      monthly_cost: 20, api_pool: 10, description: '' },
      pro_plus: { name: 'Pro Plus', monthly_cost: 30, api_pool: 20, description: '' },
      ultra:    { name: 'Ultra',    monthly_cost: 200, api_pool: 400, description: '' },
    };
    const models = [opusModel];
    const configs: ModelConfig[] = [{
      modelId: 'claude-4-6-opus', weight: 100,
      maxMode: false, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    }];
    // 5M tokens at Opus base rates (3:1 ratio):
    // usage = 3.75M * $5/M + 1.25M * $25/M = $18.75 + $31.25 = $50
    // Pro: $20 + ($50 - $10) = $60
    // Pro Plus: $30 + ($50 - $20) = $60
    // Tie → Pro Plus wins (higher api_pool headroom)
    const result = computeRecommendation('tokens', 0, 5_000_000, models, configs, tiePlans, 3);
    expect(result.best.plan).toBe('pro_plus');
  });
});

describe('computeRecommendation - token mode', () => {
  it('recommends cheapest plan that covers the usage', () => {
    const models = [opusModel];
    const configs: ModelConfig[] = [{
      modelId: 'claude-4-6-opus', weight: 100,
      maxMode: false, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    }];
    const result = computeRecommendation('tokens', 0, 500_000, models, configs, testPlans, 3);
    expect(result.best.plan).toBe('pro');
  });

  it('calculates overage correctly', () => {
    const models = [opusModel];
    const configs: ModelConfig[] = [{
      modelId: 'claude-4-6-opus', weight: 100,
      maxMode: false, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    }];
    const result = computeRecommendation('tokens', 0, 10_000_000, models, configs, testPlans, 3);
    const proResult = result.all.find(p => p.plan === 'pro')!;
    expect(proResult.overage).toBeGreaterThan(0);
    expect(proResult.totalCost).toBe(proResult.subscription + proResult.overage);
  });
});

describe('dollarsToTokens / tokensToDollars', () => {
  it('dollarsToTokens converts correctly at 3:1 ratio', () => {
    const result = dollarsToTokens(20, { input: 5, output: 25 }, 3);
    expect(result.input).toBe(1_500_000);
    expect(result.output).toBe(500_000);
    expect(result.total).toBe(2_000_000);
  });

  it('dollarsToTokens returns zero for zero dollars', () => {
    const result = dollarsToTokens(0, { input: 5, output: 25 }, 3);
    expect(result.total).toBe(0);
  });

  it('tokensToDollars is inverse of dollarsToTokens', () => {
    const rates = { input: 5, output: 25 };
    const tokens = dollarsToTokens(20, rates, 3);
    const cost = tokensToDollars(tokens.total, rates, 3);
    expect(cost).toBeCloseTo(20, 1);
  });
});

describe('formatters', () => {
  it('formatNumber handles M/k/raw', () => {
    expect(formatNumber(1_500_000)).toBe('1.50M');
    expect(formatNumber(45_000)).toBe('45.0k');
    expect(formatNumber(999)).toBe('999');
  });

  it('formatCurrency uses two decimals for precise amounts', () => {
    expect(formatCurrency(52.34)).toBe('$52.34');
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formatRate shows per-M pricing', () => {
    expect(formatRate(5)).toBe('$5.00');
    expect(formatRate(0.5)).toBe('$0.50');
  });
});

