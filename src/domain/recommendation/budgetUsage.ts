import type { ModelRates } from '../catalog/types';
import type { ExactTokenBreakdown } from './types';

export function dollarsToExactTokens(
  dollars: number,
  rates: ModelRates,
  cacheReadShare: number,
  inputOutputRatio: number,
): ExactTokenBreakdown {
  if (dollars <= 0) {
    return { inputWithCacheWrite: 0, inputWithoutCacheWrite: 0, cacheRead: 0, output: 0, total: 0 };
  }

  const clampedShare = Math.min(100, Math.max(0, cacheReadShare)) / 100;
  const safeRatio = Number.isFinite(inputOutputRatio) && inputOutputRatio > 0 ? inputOutputRatio : 1;

  const remaining = 1 - clampedShare;
  const inputFraction = remaining * (safeRatio / (safeRatio + 1));
  const outputFraction = remaining * (1 / (safeRatio + 1));

  const cacheReadRate = rates.cache_read ?? rates.input;
  const blendedRatePerToken = (
    clampedShare * cacheReadRate +
    inputFraction * rates.input +
    outputFraction * rates.output
  ) / 1_000_000;

  if (blendedRatePerToken <= 0) {
    return { inputWithCacheWrite: 0, inputWithoutCacheWrite: 0, cacheRead: 0, output: 0, total: 0 };
  }

  const totalTokens = Math.round(dollars / blendedRatePerToken);
  const cacheRead = Math.round(totalTokens * clampedShare);
  const remainingTokens = totalTokens - cacheRead;
  const inputWithoutCacheWrite = Math.round(remainingTokens * (safeRatio / (safeRatio + 1)));
  const output = remainingTokens - inputWithoutCacheWrite;

  return {
    inputWithCacheWrite: 0,
    inputWithoutCacheWrite,
    cacheRead,
    output,
    total: totalTokens,
  };
}
