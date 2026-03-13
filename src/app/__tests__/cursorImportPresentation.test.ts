import { describe, expect, it } from 'vitest';

import {
  buildDaysUsedNote,
  buildImportSummarySections,
  formatMonthYear,
  getPricedApiCacheReadShare,
  getPricedApiNonCacheTokens,
  getTotalImportedTokens,
  getTokensPerUsedDay,
} from '../cursorImportPresentation';
import type { CursorImportReport } from '../../domain/importReplay/types';

function createReport(overrides: Partial<CursorImportReport['summary']> = {}): CursorImportReport {
  return {
    files: ['cursor-usage.csv'],
    pricedEntries: [
      {
        key: 'gpt-5.4',
        modelId: 'gpt-5.4',
        label: 'GPT-5.4',
        provider: 'openai',
        pool: 'api',
        tokens: { total: 250_000, input: 240_000, output: 10_000 },
        exactTokens: {
          inputWithCacheWrite: 20_000,
          inputWithoutCacheWrite: 30_000,
          cacheRead: 190_000,
          output: 10_000,
          total: 250_000,
        },
        exactCost: { input: 1, output: 1, total: 2 },
        maxMode: false,
        fast: false,
        thinking: false,
        caching: true,
        cacheHitRate: 0,
        approximated: false,
      },
      {
        key: 'claude-sonnet-4-6',
        modelId: 'claude-sonnet-4-6',
        label: 'Claude 4.6 Sonnet',
        provider: 'anthropic',
        pool: 'api',
        tokens: { total: 60_000, input: 50_000, output: 10_000 },
        exactTokens: {
          inputWithCacheWrite: 5_000,
          inputWithoutCacheWrite: 10_000,
          cacheRead: 35_000,
          output: 10_000,
          total: 60_000,
        },
        exactCost: { input: 1, output: 1, total: 2 },
        maxMode: false,
        fast: false,
        thinking: false,
        caching: true,
        cacheHitRate: 0,
        approximated: false,
      },
    ],
    unsupported: [],
    excluded: [],
    nonApiIncluded: [],
    summary: {
      totalRows: 1,
      pricedApiTokens: 310_000,
      approximatedApiTokens: 0,
      unsupportedTokens: 0,
      excludedTokens: 0,
      includedNonApiTokens: 0,
      activeDays: 2,
      pricedApiDays: 2,
      firstActiveDate: '2026-02-10',
      lastActiveDate: '2026-02-11',
      activeSpanDays: 2,
      comparisonDays: 28,
      comparisonMode: 'month',
      ...overrides,
    },
  };
}

describe('cursor import presentation', () => {
  it('computes tokens per used day from the replay summary', () => {
    expect(getTokensPerUsedDay(createReport())).toBe(155_000);
    expect(getTokensPerUsedDay(createReport({ activeDays: 0 }))).toBe(0);
  });

  it('computes total imported tokens plus priced-api cache composition helpers', () => {
    const report = createReport({
      unsupportedTokens: 3_000,
      excludedTokens: 4_000,
      includedNonApiTokens: 7_000,
    });

    expect(getTotalImportedTokens(report)).toBe(324_000);
    expect(getPricedApiNonCacheTokens(report)).toBe(85_000);
    expect(getPricedApiCacheReadShare(report)).toBeCloseTo(225_000 / 310_000, 6);
  });

  it('builds month and span day notes from the replay summary', () => {
    expect(buildDaysUsedNote(createReport())).toBe('Distinct usage days in February 2026');
    expect(buildDaysUsedNote(createReport({
      comparisonMode: 'span',
      firstActiveDate: '2026-02-10',
      lastActiveDate: '2026-02-16',
    }))).toBe('2026-02-10 to 2026-02-16');
  });

  it('formats imported month labels with a safe fallback', () => {
    expect(formatMonthYear('2026-02-10')).toBe('February 2026');
    expect(formatMonthYear('not-a-date')).toBe('not-a-d');
  });

  it('groups usage cadence separately from pricing summary and clarifies approximate priced tokens', () => {
    const sections = buildImportSummarySections(createReport({
      approximatedApiTokens: 170_470_000,
      unsupportedTokens: 0,
      excludedTokens: 4_030_000,
    }));

    expect(sections.map((section) => section.title)).toEqual([
      'Usage cadence',
      'Pricing summary',
    ]);

    expect(sections[0]?.stats.map((stat) => stat.label)).toEqual([
      'Days used',
      'API tokens / used day',
      'Total imported tokens',
    ]);

    expect(sections[1]?.stats.map((stat) => stat.label)).toEqual([
      'API tokens priced',
      'Cache-read share (priced API)',
      'Non-cache priced tokens',
      'Priced via approximation',
      'Unsupported tokens',
      'Excluded tokens',
      'Included pool tokens',
    ]);

    expect(sections[1]?.stats[0]).toMatchObject({
      label: 'API tokens priced',
      note: 'Use this as your simple-mode token total for the closest import match',
    });

    expect(sections[1]?.stats[1]).toMatchObject({
      label: 'Cache-read share (priced API)',
      note: 'Then copy this percentage into the simple-mode cache slider',
    });

    expect(sections[1]?.stats[2]).toMatchObject({
      label: 'Non-cache priced tokens',
      note: 'Use this instead for a conservative no-cache baseline',
    });

    expect(sections[1]?.stats[3]).toMatchObject({
      label: 'Priced via approximation',
      note: 'Subset of API tokens priced',
      tone: 'amber',
    });
  });
});
