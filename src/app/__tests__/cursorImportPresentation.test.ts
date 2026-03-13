import { describe, expect, it } from 'vitest';

import {
  buildDaysUsedNote,
  buildImportSummarySections,
  formatMonthYear,
  getTokensPerUsedDay,
} from '../cursorImportPresentation';
import type { CursorImportReport } from '../../domain/importReplay/types';

function createReport(overrides: Partial<CursorImportReport['summary']> = {}): CursorImportReport {
  return {
    files: ['cursor-usage.csv'],
    pricedEntries: [],
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
    ]);

    expect(sections[1]?.stats.map((stat) => stat.label)).toEqual([
      'API tokens priced',
      'Priced via approximation',
      'Unsupported tokens',
      'Excluded tokens',
      'Included pool tokens',
    ]);

    expect(sections[1]?.stats[1]).toMatchObject({
      label: 'Priced via approximation',
      note: 'Subset of API tokens priced',
      tone: 'amber',
    });
  });
});
