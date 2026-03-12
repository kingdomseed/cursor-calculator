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
