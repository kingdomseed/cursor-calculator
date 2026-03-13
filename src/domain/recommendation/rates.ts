import type { Model, ModelRates } from '../catalog/types';
import type { EffectiveRates, ExactCostBreakdown, ExactTokenBreakdown, ModelConfig, TokenBreakdown } from './types';

const DEFAULT_RE_READS = 3;

export function computeBillableRates(model: Model, config: ModelConfig): ModelRates {
  const rates: ModelRates = config.fast && model.variants?.fast
    ? { ...model.variants.fast.rates }
    : { ...model.rates };

  if (config.maxMode && model.variants?.max_mode) {
    const upcharge = 1 + model.variants.max_mode.cursor_upcharge;
    rates.input *= upcharge;
    rates.output *= upcharge;
    if (rates.cache_write !== null) rates.cache_write *= upcharge;
    if (rates.cache_read !== null) rates.cache_read *= upcharge;
  }

  return rates;
}

export function computeEffectiveRates(
  model: Model,
  config: ModelConfig,
  reReads = DEFAULT_RE_READS,
): EffectiveRates {
  const rates = computeBillableRates(model, config);

  return {
    input: applyCaching(rates.input, rates.cache_write, rates.cache_read, config, reReads),
    output: rates.output,
  };
}

export function effectiveRatesFromExactTokens(
  tokens: ExactTokenBreakdown,
  rates: ModelRates,
): EffectiveRates {
  const cacheWriteRate = rates.cache_write ?? rates.input;
  const cacheReadRate = rates.cache_read ?? rates.input;
  const totalInputTokens =
    tokens.inputWithCacheWrite +
    tokens.inputWithoutCacheWrite +
    tokens.cacheRead;

  if (totalInputTokens <= 0) {
    return { input: rates.input, output: rates.output };
  }

  const inputCost = (
    (tokens.inputWithCacheWrite / 1_000_000) * cacheWriteRate +
    (tokens.inputWithoutCacheWrite / 1_000_000) * rates.input +
    (tokens.cacheRead / 1_000_000) * cacheReadRate
  );

  return {
    input: (inputCost * 1_000_000) / totalInputTokens,
    output: rates.output,
  };
}

export function effectiveRatesFromExactCost(
  costs: ExactCostBreakdown,
  tokens: TokenBreakdown,
  fallbackRates: ModelRates,
): EffectiveRates {
  return {
    input: tokens.input > 0 ? (costs.input * 1_000_000) / tokens.input : fallbackRates.input,
    output: tokens.output > 0 ? (costs.output * 1_000_000) / tokens.output : fallbackRates.output,
  };
}

function applyCaching(
  inputRate: number,
  cacheWrite: number | null,
  cacheRead: number | null,
  config: ModelConfig,
  reReads = DEFAULT_RE_READS,
): number {
  const clampedCacheHitRate = Math.min(100, Math.max(0, config.cacheHitRate));

  if (!config.caching || clampedCacheHitRate <= 0 || cacheRead === null) {
    return inputRate;
  }

  const cachedRatio = clampedCacheHitRate / 100;
  const uncachedRatio = 1 - cachedRatio;

  if (cacheWrite !== null) {
    return (
      cachedRatio * cacheWrite +
      cachedRatio * cacheRead * reReads +
      uncachedRatio * inputRate * reReads
    ) / reReads;
  }

  return cachedRatio * cacheRead + uncachedRatio * inputRate;
}
