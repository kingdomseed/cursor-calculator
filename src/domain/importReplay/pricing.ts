import { computeBillableRates } from '../recommendation/rates';
import type { ExactTokenBreakdown, ModelConfig } from '../recommendation/types';
import { getLongContextCompanions } from './catalog';
import type { ImportReplayModelsById, PricedImportedRow, SupportedNormalization } from './types';

const LONG_CONTEXT_COMPANIONS = getLongContextCompanions();

export function priceImportedRow(
  model: import('../catalog/types').Model,
  normalized: SupportedNormalization,
  tokens: ExactTokenBreakdown,
  modelsById: ImportReplayModelsById,
): PricedImportedRow {
  const config: ModelConfig = {
    modelId: normalized.modelId,
    weight: 100,
    maxMode: normalized.maxMode,
    fast: normalized.fast,
    thinking: normalized.thinking,
    caching: false,
    cacheHitRate: 0,
  };

  const hasUndocumentedFastMaxRates = !!(
    normalized.fast
    && normalized.maxMode
    && model.variants?.fast
    && model.variants.max_mode?.rates
  );
  let rates = hasUndocumentedFastMaxRates
    ? approximateCombinedFastMaxRates(model)
    : computeBillableRates(model, config);
  let approximated = hasUndocumentedFastMaxRates;

  if (normalized.maxMode) {
    const totalInputTokens =
      tokens.inputWithCacheWrite +
      tokens.inputWithoutCacheWrite +
      tokens.cacheRead;

    if (model.context.default > 0 && totalInputTokens > model.context.default) {
      const adjusted = applyLongContextCompanionRates(model, rates, modelsById);
      rates = adjusted.rates;
      approximated = approximated || adjusted.approximated;
    }
  }

  if (normalized.rateMultiplier && normalized.rateMultiplier !== 1) {
    rates = multiplyRates(rates, normalized.rateMultiplier);
  }

  const cacheWriteRate = rates.cache_write ?? rates.input;
  const cacheReadRate = rates.cache_read ?? rates.input;
  const inputCost = (
    (tokens.inputWithCacheWrite / 1_000_000) * cacheWriteRate +
    (tokens.inputWithoutCacheWrite / 1_000_000) * rates.input +
    (tokens.cacheRead / 1_000_000) * cacheReadRate
  );
  const outputCost = (tokens.output / 1_000_000) * rates.output;

  return {
    exactCost: {
      input: inputCost,
      output: outputCost,
      total: inputCost + outputCost,
    },
    approximated,
  };
}

function approximateCombinedFastMaxRates(
  model: import('../catalog/types').Model,
): import('../catalog/types').Model['rates'] {
  const fastRates = model.variants?.fast?.rates;
  const maxRates = model.variants?.max_mode?.rates;
  if (!fastRates || !maxRates) return model.rates;

  return {
    input: applyMultiplier(fastRates.input, model.rates.input, maxRates.input),
    cache_write: applyOptionalMultiplier(
      fastRates.cache_write,
      model.rates.cache_write,
      maxRates.cache_write,
      model.rates.input,
      maxRates.input,
    ),
    cache_read: applyOptionalMultiplier(
      fastRates.cache_read,
      model.rates.cache_read,
      maxRates.cache_read,
      model.rates.input,
      maxRates.input,
    ),
    output: applyMultiplier(fastRates.output, model.rates.output, maxRates.output),
  };
}

function applyOptionalMultiplier(
  current: number | null,
  base: number | null,
  target: number | null,
  fallbackBase: number,
  fallbackTarget: number,
): number | null {
  if (current === null) return null;
  return applyMultiplier(current, base ?? fallbackBase, target ?? fallbackTarget);
}

function multiplyRates(
  rates: import('../catalog/types').Model['rates'],
  multiplier: number,
): import('../catalog/types').Model['rates'] {
  return {
    input: rates.input * multiplier,
    cache_write: rates.cache_write === null ? null : rates.cache_write * multiplier,
    cache_read: rates.cache_read === null ? null : rates.cache_read * multiplier,
    output: rates.output * multiplier,
  };
}

function applyLongContextCompanionRates(
  model: import('../catalog/types').Model,
  rates: import('../catalog/types').Model['rates'],
  modelsById: ImportReplayModelsById,
): { rates: import('../catalog/types').Model['rates']; approximated: boolean } {
  const companionConfig = LONG_CONTEXT_COMPANIONS[model.id];
  if (!companionConfig) {
    return {
      rates,
      approximated: false,
    };
  }

  const companion = modelsById.get(companionConfig.maxId);
  if (!companion) {
    return {
      rates,
      approximated: companionConfig.approximated ?? true,
    };
  }

  return {
    rates: {
      input: applyMultiplier(rates.input, model.rates.input, companion.rates.input),
      cache_write: rates.cache_write === null
        ? null
        : applyMultiplier(
            rates.cache_write,
            model.rates.cache_write ?? model.rates.input,
            companion.rates.cache_write ?? companion.rates.input,
          ),
      cache_read: rates.cache_read === null
        ? null
        : applyMultiplier(
            rates.cache_read,
            model.rates.cache_read ?? model.rates.input,
            companion.rates.cache_read ?? companion.rates.input,
          ),
      output: applyMultiplier(rates.output, model.rates.output, companion.rates.output),
    },
    approximated: companionConfig.approximated ?? false,
  };
}

function applyMultiplier(current: number, base: number, target: number): number {
  if (base <= 0) return current;
  return current * (target / base);
}
