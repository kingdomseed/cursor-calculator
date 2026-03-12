import { describe, it, expect } from 'vitest';
import { computeEffectiveRates } from '../calculations';
import type { Model, ModelConfig } from '../types';

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
      long_context_input_multiplier: 2.0,
      long_context_output_multiplier: 1.0,
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

  it('applies Max Mode: cursor upcharge + long context multipliers', () => {
    const rates = computeEffectiveRates(opusModel, { ...baseConfig, maxMode: true });
    // input: 5 * 1.20 * 2.0 = 12
    expect(rates.input).toBe(12);
    // output: 25 * 1.20 * 1.0 = 30
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

  it('scales cache rates with Max Mode when both are active', () => {
    const config = { ...baseConfig, maxMode: true, caching: true, cacheHitRate: 50 };
    const rates = computeEffectiveRates(opusModel, config);
    // Max Mode: upcharge=1.2, long_context_input=2.0
    // Scaled input: 5 * 1.2 * 2.0 = 12
    // Scaled cache_write: 6.25 * 1.2 * 2.0 = 15
    // Scaled cache_read: 0.5 * 1.2 * 2.0 = 1.2
    // RE_READS=3, cachedRatio=0.5
    // effective = (0.5*15 + 0.5*1.2*3 + 0.5*12*3) / 3
    // = (7.5 + 1.8 + 18) / 3 = 27.3 / 3 = 9.1
    expect(rates.input).toBeCloseTo(9.1, 3);
    // output: 25 * 1.2 * 1.0 = 30
    expect(rates.output).toBe(30);
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
      long_context_input_multiplier: 2.0,
      long_context_output_multiplier: 1.5,
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

  it('GPT-5.4 Max Mode has different output multiplier', () => {
    const config: ModelConfig = {
      modelId: 'gpt-5-4', weight: 100,
      maxMode: true, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    };
    const rates = computeEffectiveRates(gpt54Model, config);
    // input: 2.5 * 1.2 * 2.0 = 6.0
    expect(rates.input).toBe(6);
    // output: 15 * 1.2 * 1.5 = 27.0
    expect(rates.output).toBe(27);
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
