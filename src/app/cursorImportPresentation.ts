import type { CursorImportReport } from '../domain/importReplay/types';
import { formatNumber } from '../domain/recommendation/formatters';

export interface ImportSummaryStat {
  label: string;
  value: string;
  note?: string;
  tone?: 'default' | 'amber' | 'red';
}

export interface ImportSummarySection {
  title: string;
  layout: 'usage' | 'pricing';
  stats: ImportSummaryStat[];
}

export function getTokensPerUsedDay(report: CursorImportReport): number {
  if (report.summary.activeDays <= 0) {
    return 0;
  }

  return report.summary.pricedApiTokens / report.summary.activeDays;
}

export function buildDaysUsedNote(report: CursorImportReport): string {
  const { comparisonMode, firstActiveDate, lastActiveDate } = report.summary;

  if (comparisonMode === 'month') {
    return firstActiveDate
      ? `Distinct usage days in ${formatMonthYear(firstActiveDate)}`
      : 'Distinct usage days in imported month';
  }

  if (firstActiveDate && lastActiveDate) {
    return `${firstActiveDate} to ${lastActiveDate}`;
  }

  return 'Distinct usage days across imported date span';
}

export function formatMonthYear(dayKey: string): string {
  const parsed = new Date(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return dayKey.slice(0, 7);
  }

  return parsed.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function buildImportSummarySections(report: CursorImportReport): ImportSummarySection[] {
  return [
    {
      title: 'Usage cadence',
      layout: 'usage',
      stats: [
        {
          label: 'Days used',
          value: `${formatNumber(report.summary.activeDays)} / ${formatNumber(report.summary.comparisonDays)}`,
          note: buildDaysUsedNote(report),
        },
        {
          label: 'API tokens / used day',
          value: formatNumber(getTokensPerUsedDay(report)),
          note: report.summary.activeDays > 0
            ? 'Average across distinct usage days'
            : 'No usage days detected',
        },
      ],
    },
    {
      title: 'Pricing summary',
      layout: 'pricing',
      stats: [
        {
          label: 'API tokens priced',
          value: formatNumber(report.summary.pricedApiTokens),
        },
        {
          label: 'Priced via approximation',
          value: formatNumber(report.summary.approximatedApiTokens),
          note: 'Subset of API tokens priced',
          tone: 'amber',
        },
        {
          label: 'Unsupported tokens',
          value: formatNumber(report.summary.unsupportedTokens),
          tone: 'red',
        },
        {
          label: 'Excluded tokens',
          value: formatNumber(report.summary.excludedTokens),
        },
        {
          label: 'Included pool tokens',
          value: formatNumber(report.summary.includedNonApiTokens),
        },
      ],
    },
  ];
}
