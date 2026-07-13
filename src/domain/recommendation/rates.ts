import type { Model, ModelRates } from '../catalog/types';
import type { EffectiveRates, ExactCostBreakdown, ExactTokenBreakdown, ModelConfig, TokenBreakdown } from './types';

const DEFAULT_RE_READS = 3;

export function isRatePromotionActive(model: Model, at = new Date()): boolean {
  if (!model.rate_promotion) return false;

  return at.toISOString().slice(0, 10) <= model.rate_promotion.ends_on;
}

export function getCurrentBaseRates(model: Model, at = new Date()): ModelRates {
  const rates = { ...model.rates };
  if (!isRatePromotionActive(model, at) || !model.rate_promotion) {
    return rates;
  }

  return { ...rates, ...model.rate_promotion.rates };
}

export function isPoolUsagePromotionActive(model: Model, at = new Date()): boolean {
  const promotion = model.pool_usage_promotion;
  return !!promotion && at.toISOString().slice(0, 10) <= promotion.ends_on;
}

export function getPoolUsageAllowanceMultiplier(model: Model, at = new Date()): number {
  const promotion = model.pool_usage_promotion;
  if (!promotion || !isPoolUsagePromotionActive(model, at)) return 1;

  return Math.max(1, promotion.allowance_multiplier);
}

export function computeBillableRates(model: Model, config: ModelConfig, at = new Date()): ModelRates {
  if (config.fast && config.maxMode && model.variants?.fast && model.variants.max_mode?.rates) {
    throw new Error(`Cursor does not publish combined Fast + Max rates for ${model.name}`);
  }

  const rates: ModelRates = config.fast && model.variants?.fast
    ? { ...model.variants.fast.rates }
    : getCurrentBaseRates(model, at);

  if (config.maxMode && model.variants?.max_mode) {
    if (model.variants.max_mode.rates) {
      return { ...model.variants.max_mode.rates };
    }

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
