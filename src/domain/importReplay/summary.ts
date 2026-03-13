import type { UsageLineItemInput } from '../recommendation/types';
import { addCostBreakdowns, addDisplayBreakdowns, addExactBreakdowns, buildUsageKey, exactTokensToDisplayBreakdown, getSourceMeta, hasCachingTokens, recordIssue, sortIssues } from './aggregate';
import { parseCursorCsvText } from './csvParser';
import { getExclusionReason } from './filters';
import { normalizeImportedModel } from './normalization';
import { priceImportedRow } from './pricing';
import type { CsvInputFile, CursorImportOptions, CursorImportReport } from './types';

const DEFAULT_OPTIONS: Required<CursorImportOptions> = {
  includeUserApiKey: true,
  approximationMode: 'best_effort',
};

export function parseCursorUsageFiles(
  files: CsvInputFile[],
  models: import('../catalog/types').Model[],
  options: CursorImportOptions = {},
): CursorImportReport {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const modelsById = new Map(models.map((model) => [model.id, model]));
  const aggregate = new Map<string, UsageLineItemInput>();
  const unsupported = new Map<string, import('./types').CursorImportIssue>();
  const excluded = new Map<string, import('./types').CursorImportIssue>();
  const nonApiIncluded = new Map<string, import('./types').CursorImportIssue>();
  const activeDayKeys = new Set<string>();
  const pricedApiDayKeys = new Set<string>();

  let totalRows = 0;

  for (const file of files) {
    const rows = parseCursorCsvText(file.text);

    for (const row of rows) {
      totalRows += 1;
      const totalTokens = row.tokens.total;

      if (totalTokens > 0 && row.dayKey) {
        activeDayKeys.add(row.dayKey);
      }

      const exclusionReason = getExclusionReason(row.kind, resolvedOptions);
      if (exclusionReason) {
        if (totalTokens > 0) {
          recordIssue(excluded, row.model, totalTokens, exclusionReason);
        }
        continue;
      }

      if (totalTokens <= 0) {
        continue;
      }

      const normalized = normalizeImportedModel(
        row.model,
        row.maxMode,
        modelsById,
        resolvedOptions.approximationMode,
      );

      if (normalized.kind === 'unsupported') {
        recordIssue(unsupported, row.model, totalTokens, normalized.reason);
        continue;
      }

      const model = modelsById.get(normalized.modelId);
      if (!model) {
        recordIssue(unsupported, row.model, totalTokens, 'No pricing catalog entry for normalized model');
        continue;
      }

      if (model.pool !== 'api') {
        recordIssue(nonApiIncluded, row.model, totalTokens, 'Included usage pool, not API-priced');
        continue;
      }

      const pricedRow = priceImportedRow(model, normalized, row.tokens, modelsById);
      const sourceMeta = getSourceMeta(row.kind, row.model);
      if (row.dayKey) {
        pricedApiDayKeys.add(row.dayKey);
      }

      const key = buildUsageKey(
        normalized.modelId,
        normalized.fast,
        normalized.maxMode,
        normalized.thinking,
        sourceMeta.group,
      );
      const tokenBreakdown = exactTokensToDisplayBreakdown(row.tokens);
      const existing = aggregate.get(key);

      if (existing) {
        existing.tokens = addDisplayBreakdowns(existing.tokens, tokenBreakdown);
        existing.exactTokens = addExactBreakdowns(existing.exactTokens, row.tokens);
        existing.exactCost = addCostBreakdowns(existing.exactCost, pricedRow.exactCost);
        existing.caching = existing.caching || hasCachingTokens(row.tokens);
        existing.thinking = existing.thinking || normalized.thinking;
        existing.approximated = existing.approximated || normalized.approximated || pricedRow.approximated;
        continue;
      }

      aggregate.set(key, {
        key,
        modelId: normalized.modelId,
        label: model.name,
        provider: model.provider,
        pool: model.pool,
        tokens: tokenBreakdown,
        exactTokens: { ...row.tokens },
        exactCost: pricedRow.exactCost,
        maxMode: normalized.maxMode,
        fast: normalized.fast,
        thinking: normalized.thinking,
        caching: hasCachingTokens(row.tokens),
        cacheHitRate: 0,
        approximated: normalized.approximated || pricedRow.approximated,
        sourceLabel: sourceMeta.label,
      });
    }
  }

  const pricedEntries = [...aggregate.values()].sort((left, right) => right.tokens.total - left.tokens.total);
  const unsupportedIssues = sortIssues(unsupported);
  const excludedIssues = sortIssues(excluded);
  const nonApiIssues = sortIssues(nonApiIncluded);
  const sortedActiveDays = [...activeDayKeys].sort();
  const firstActiveDate = sortedActiveDays[0] ?? null;
  const lastActiveDate = sortedActiveDays[sortedActiveDays.length - 1] ?? null;
  const periodInfo = resolveComparisonPeriod(sortedActiveDays, firstActiveDate, lastActiveDate);

  return {
    files: files.map((file) => file.name),
    pricedEntries,
    unsupported: unsupportedIssues,
    excluded: excludedIssues,
    nonApiIncluded: nonApiIssues,
    summary: {
      totalRows,
      pricedApiTokens: pricedEntries.reduce((sum, entry) => sum + entry.tokens.total, 0),
      approximatedApiTokens: pricedEntries
        .filter((entry) => entry.approximated)
        .reduce((sum, entry) => sum + entry.tokens.total, 0),
      unsupportedTokens: unsupportedIssues.reduce((sum, issue) => sum + issue.tokens, 0),
      excludedTokens: excludedIssues.reduce((sum, issue) => sum + issue.tokens, 0),
      includedNonApiTokens: nonApiIssues.reduce((sum, issue) => sum + issue.tokens, 0),
      activeDays: activeDayKeys.size,
      pricedApiDays: pricedApiDayKeys.size,
      firstActiveDate,
      lastActiveDate,
      activeSpanDays: calculateDaySpan(firstActiveDate, lastActiveDate),
      comparisonDays: periodInfo.days,
      comparisonMode: periodInfo.mode,
    },
  };
}

function calculateDaySpan(start: string | null, end: string | null): number {
  if (!start || !end) {
    return 0;
  }

  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) {
    return 0;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((endTime - startTime) / millisecondsPerDay) + 1;
}

function resolveComparisonPeriod(
  activeDays: string[],
  firstActiveDate: string | null,
  lastActiveDate: string | null,
): { days: number; mode: 'month' | 'span' } {
  const activeMonths = new Set(activeDays.map((dayKey) => dayKey.slice(0, 7)));

  if (activeMonths.size === 1) {
    const onlyDay = activeDays[0];
    if (onlyDay) {
      return {
        days: getDaysInMonth(onlyDay),
        mode: 'month',
      };
    }
  }

  return {
    days: calculateDaySpan(firstActiveDate, lastActiveDate),
    mode: 'span',
  };
}

function getDaysInMonth(dayKey: string): number {
  const match = dayKey.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) {
    return 0;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return 0;
  }

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
