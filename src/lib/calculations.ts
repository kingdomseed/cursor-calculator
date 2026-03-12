import type { Model, ModelConfig, EffectiveRates } from './types';

// TODO: Spec says RE_READS should be configurable as an advanced option. For now hardcoded.
const DEFAULT_RE_READS = 3;

export function computeEffectiveRates(model: Model, config: ModelConfig, reReads = DEFAULT_RE_READS): EffectiveRates {
  // Layer 1: Fast mode replaces base rates entirely, skips Max Mode
  if (config.fast && model.variants?.fast) {
    const fastRates = model.variants.fast.rates;
    return {
      input: applyCaching(fastRates.input, fastRates.cache_write, fastRates.cache_read, config),
      output: fastRates.output,
    };
  }

  let inputRate = model.rates.input;
  let outputRate = model.rates.output;

  // Layer 2: Cursor Max Mode upcharge
  if (config.maxMode && model.variants?.max_mode) {
    const upcharge = 1 + model.variants.max_mode.cursor_upcharge;
    inputRate *= upcharge;
    outputRate *= upcharge;

    // Layer 3: Long context multipliers (always applied with Max Mode)
    inputRate *= model.variants.max_mode.long_context_input_multiplier;
    outputRate *= model.variants.max_mode.long_context_output_multiplier;
  }

  // Layer 4: Caching blend (affects input only)
  // When Max Mode is active, cache rates must also be scaled by upcharge + long context,
  // because Cursor's upcharge applies to all API usage and provider long-context pricing
  // applies to all token operations including cache reads/writes.
  let cacheWrite = model.rates.cache_write;
  let cacheRead = model.rates.cache_read;
  if (config.maxMode && model.variants?.max_mode) {
    const upcharge = 1 + model.variants.max_mode.cursor_upcharge;
    const lcInput = model.variants.max_mode.long_context_input_multiplier;
    if (cacheWrite !== null) cacheWrite = cacheWrite * upcharge * lcInput;
    if (cacheRead !== null) cacheRead = cacheRead * upcharge * lcInput;
  }
  inputRate = applyCaching(inputRate, cacheWrite, cacheRead, config, reReads);

  return { input: inputRate, output: outputRate };
}

function applyCaching(
  inputRate: number,
  cacheWrite: number | null,
  cacheRead: number | null,
  config: ModelConfig,
  reReads: number = DEFAULT_RE_READS,
): number {
  if (!config.caching || config.cacheHitRate <= 0 || !cacheRead) {
    return inputRate;
  }

  const cachedRatio = config.cacheHitRate / 100;
  const uncachedRatio = 1 - cachedRatio;

  if (cacheWrite) {
    // Anthropic: cache_write + cache_read with RE_READS amortization
    return (
      cachedRatio * cacheWrite +
      cachedRatio * cacheRead * reReads +
      uncachedRatio * inputRate * reReads
    ) / reReads;
  }

  // Non-Anthropic: simple blend of cache_read and input rate
  return cachedRatio * cacheRead + uncachedRatio * inputRate;
}
