import type { ModelRates } from '../catalog/types';
import type { EffectiveRates, ExactTokenBreakdown, TokenBreakdown } from './types';

export function exactTokensToDollars(tokens: ExactTokenBreakdown, rates: ModelRates): number {
  const cacheWriteRate = rates.cache_write ?? rates.input;
  const cacheReadRate = rates.cache_read ?? rates.input;

  return (
    (tokens.inputWithCacheWrite / 1_000_000) * cacheWriteRate +
    (tokens.inputWithoutCacheWrite / 1_000_000) * rates.input +
    (tokens.cacheRead / 1_000_000) * cacheReadRate +
    (tokens.output / 1_000_000) * rates.output
  );
}

export function directBreakdownToDollars(tokens: TokenBreakdown, rates: EffectiveRates): number {
  return (
    (tokens.input / 1_000_000) * rates.input +
    (tokens.output / 1_000_000) * rates.output
  );
}

export function dollarsToTokens(dollars: number, rates: EffectiveRates, ratio: number): TokenBreakdown {
  const costPerCycle = (ratio * rates.input + rates.output) / 1_000_000;
  if (costPerCycle <= 0) return { total: 0, input: 0, output: 0 };

  const cycles = dollars / costPerCycle;
  const total = Math.round(cycles * (ratio + 1));
  const input = Math.round((total * ratio) / (ratio + 1));
  const output = total - input;

  return { total, input, output };
}

export function tokensToDollars(tokens: number, rates: EffectiveRates, ratio: number): number {
  const weightInput = ratio / (ratio + 1);
  const inputTokens = tokens * weightInput;
  const outputTokens = tokens - inputTokens;

  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}
