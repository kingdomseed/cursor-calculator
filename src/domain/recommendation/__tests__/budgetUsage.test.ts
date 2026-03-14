import { describe, expect, it } from 'vitest';
import { dollarsToExactTokens } from '../budgetUsage';
import { exactTokensToDollars } from '../conversions';
import type { ModelRates } from '../../catalog/types';

const opusRates: ModelRates = { input: 5, cache_write: 6.25, cache_read: 0.50, output: 25 };
const gptRates: ModelRates = { input: 2.50, cache_write: null, cache_read: 0.25, output: 15 };

describe('dollarsToExactTokens', () => {
  it('produces tokens that round-trip back to the same dollar amount', () => {
    const tokens = dollarsToExactTokens(100, opusRates, 90, 3);
    const cost = exactTokensToDollars(tokens, opusRates);
    expect(cost).toBeCloseTo(100, 1);
  });

  it('allocates 90% of tokens as cache reads with 3:1 ratio on remainder', () => {
    const tokens = dollarsToExactTokens(100, opusRates, 90, 3);
    const cacheShare = tokens.cacheRead / tokens.total;
    expect(cacheShare).toBeCloseTo(0.9, 2);
    const remainingInput = tokens.inputWithoutCacheWrite;
    const remainingOutput = tokens.output;
    expect(remainingInput / remainingOutput).toBeCloseTo(3, 0);
  });

  it('produces more tokens with higher cache share (cheaper tokens)', () => {
    const noCacheTokens = dollarsToExactTokens(100, opusRates, 0, 3);
    const highCacheTokens = dollarsToExactTokens(100, opusRates, 90, 3);
    expect(highCacheTokens.total).toBeGreaterThan(noCacheTokens.total);
  });

  it('handles models without cache_write rates', () => {
    const tokens = dollarsToExactTokens(100, gptRates, 80, 3);
    const cost = exactTokensToDollars(tokens, gptRates);
    expect(cost).toBeCloseTo(100, 1);
    expect(tokens.inputWithCacheWrite).toBe(0);
  });

  it('handles zero cache share (no caching)', () => {
    const tokens = dollarsToExactTokens(100, opusRates, 0, 3);
    expect(tokens.cacheRead).toBe(0);
    expect(tokens.total).toBe(tokens.inputWithoutCacheWrite + tokens.output);
  });

  it('returns zero tokens for zero dollars', () => {
    const tokens = dollarsToExactTokens(0, opusRates, 90, 3);
    expect(tokens.total).toBe(0);
  });
});
