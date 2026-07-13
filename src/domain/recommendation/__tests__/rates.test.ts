import { describe, expect, it } from 'vitest';

import type { Model } from '../../catalog/types';
import { computeBillableRates, getPoolUsageAllowanceMultiplier, isPoolUsagePromotionActive } from '../rates';

const sonnet5: Model = {
  id: 'claude-sonnet-5',
  name: 'Claude Sonnet 5',
  provider: 'anthropic',
  pool: 'api',
  context: { default: 200000, max: 1000000 },
  rates: { input: 3, cache_write: 3.75, cache_read: 0.3, output: 15 },
  rate_promotion: {
    ends_on: '2026-08-31',
    rates: { input: 2, output: 10 },
    label: '$2/M input and $10/M output through August 31, 2026',
  },
  variants: { max_mode: { cursor_upcharge: 0 }, thinking: true },
};

const config = {
  modelId: sonnet5.id,
  weight: 100,
  maxMode: false,
  fast: false,
  thinking: false,
  caching: false,
  cacheHitRate: 0,
};

describe('dated model rate promotions', () => {
  it('applies partial promotional rates through the documented end date', () => {
    expect(computeBillableRates(sonnet5, config, new Date('2026-08-31T12:00:00Z'))).toEqual({
      input: 2,
      cache_write: 3.75,
      cache_read: 0.3,
      output: 10,
    });
  });

  it('returns to standard rates after the promotion', () => {
    expect(computeBillableRates(sonnet5, config, new Date('2026-09-01T00:00:00Z'))).toEqual(
      sonnet5.rates,
    );
  });
});

describe('variant pricing boundaries', () => {
  it('rejects Fast + Max when Cursor does not publish a combined rate', () => {
    const sol: Model = {
      ...sonnet5,
      id: 'gpt-5.6-sol',
      name: 'GPT-5.6 Sol',
      rates: { input: 5, cache_write: 6.25, cache_read: 0.5, output: 30 },
      rate_promotion: undefined,
      variants: {
        max_mode: {
          cursor_upcharge: 0,
          rates: { input: 10, cache_write: 12.5, cache_read: 1, output: 45 },
        },
        fast: {
          model_id: 'gpt-5.6-sol-fast',
          rates: { input: 10, cache_write: 12.5, cache_read: 1, output: 60 },
        },
      },
    };

    expect(() => computeBillableRates(sol, {
      ...config,
      modelId: sol.id,
      fast: true,
      maxMode: true,
    })).toThrow('does not publish combined Fast + Max rates');
  });
});

describe('first-party usage promotions', () => {
  const grok: Model = {
    ...sonnet5,
    id: 'grok-4-5',
    name: 'Grok 4.5',
    pool: 'first_party',
    rate_promotion: undefined,
    pool_usage_promotion: {
      ends_on: '2026-07-15',
      allowance_multiplier: 2,
      label: 'Included first-party usage is doubled through July 15, 2026',
    },
  };

  it('applies the allowance multiplier only through the documented end date', () => {
    expect(isPoolUsagePromotionActive(grok, new Date('2026-07-15T12:00:00Z'))).toBe(true);
    expect(getPoolUsageAllowanceMultiplier(grok, new Date('2026-07-15T12:00:00Z'))).toBe(2);
    expect(isPoolUsagePromotionActive(grok, new Date('2026-07-16T00:00:00Z'))).toBe(false);
    expect(getPoolUsageAllowanceMultiplier(grok, new Date('2026-07-16T00:00:00Z'))).toBe(1);
  });
});
