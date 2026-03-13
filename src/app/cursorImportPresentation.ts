import type { CursorImportReport } from '../domain/importReplay/types';

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
