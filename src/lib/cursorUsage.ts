import { computeBillableRates } from './calculations';
import type {
  ExactCostBreakdown,
  ExactTokenBreakdown,
  Model,
  ModelConfig,
  TokenBreakdown,
  UsageLineItemInput,
} from './types';

export type ApproximationMode = 'strict' | 'best_effort';

export interface CursorImportOptions {
  includeUserApiKey?: boolean;
  approximationMode?: ApproximationMode;
}

export interface CursorImportIssue {
  label: string;
  tokens: number;
  rows: number;
  reason: string;
}

export interface CursorImportSummary {
  totalRows: number;
  pricedApiTokens: number;
  approximatedApiTokens: number;
  unsupportedTokens: number;
  excludedTokens: number;
  includedNonApiTokens: number;
  activeDays: number;
  pricedApiDays: number;
  firstActiveDate: string | null;
  lastActiveDate: string | null;
  activeSpanDays: number;
  comparisonDays: number;
  comparisonMode: 'month' | 'span';
}

export interface CursorImportReport {
  files: string[];
  pricedEntries: UsageLineItemInput[];
  unsupported: CursorImportIssue[];
  excluded: CursorImportIssue[];
  nonApiIncluded: CursorImportIssue[];
  summary: CursorImportSummary;
}

interface CsvInputFile {
  name: string;
  text: string;
}

interface ParsedRow {
  dayKey: string | null;
  kind: string;
  model: string;
  maxMode: boolean;
  tokens: ExactTokenBreakdown;
}

interface SupportedNormalization {
  kind: 'supported';
  modelId: string;
  fast: boolean;
  maxMode: boolean;
  thinking: boolean;
  approximated: boolean;
  rateMultiplier?: number;
}

interface UnsupportedNormalization {
  kind: 'unsupported';
  reason: string;
}

type NormalizationResult = SupportedNormalization | UnsupportedNormalization;

const DEFAULT_OPTIONS: Required<CursorImportOptions> = {
  includeUserApiKey: true,
  approximationMode: 'best_effort',
};

const EXACT_ALIASES: Record<string, Omit<SupportedNormalization, 'kind'>> = {
  'gpt-5-fast': {
    modelId: 'gpt-5',
    fast: true,
    maxMode: false,
    thinking: false,
    approximated: false,
  },
  'claude-4-sonnet-thinking': {
    modelId: 'claude-4-sonnet',
    fast: false,
    maxMode: false,
    thinking: true,
    approximated: false,
  },
  'claude-4.5-sonnet-thinking': {
    modelId: 'claude-4-5-sonnet',
    fast: false,
    maxMode: false,
    thinking: true,
    approximated: false,
  },
  'claude-4.6-opus-max-thinking': {
    modelId: 'claude-opus-4-6-max',
    fast: false,
    maxMode: true,
    thinking: true,
    approximated: false,
  },
};

const APPROXIMATE_ALIASES: Record<string, Omit<SupportedNormalization, 'kind'>> = {
  'us.anthropic.claude-opus-4-6-v1': {
    modelId: 'claude-opus-4-6',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'global.anthropic.claude-opus-4-6-v1': {
    modelId: 'claude-opus-4-6',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'anthropic.claude-opus-4-6-v1': {
    modelId: 'claude-opus-4-6',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'us.anthropic.claude-opus-4-6-v1:0': {
    modelId: 'claude-opus-4-6',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'us.anthropic.claude-opus-4-6-20260205-v1:0': {
    modelId: 'claude-opus-4-6',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'us.anthropic.claude-opus-4-5-20251101-v1:0': {
    modelId: 'claude-4-5-opus',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0': {
    modelId: 'claude-4-5-sonnet',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'global.anthropic.claude-sonnet-4-6-v1': {
    modelId: 'claude-sonnet-4-6',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'us.anthropic.claude-3-7-sonnet-20250219-v1:0': {
    modelId: 'claude-4-sonnet',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'claude-4.5-opus-high-thinking': {
    modelId: 'claude-4-5-opus',
    fast: false,
    maxMode: false,
    thinking: true,
    approximated: true,
  },
  'claude-4.6-opus-high-thinking': {
    modelId: 'claude-opus-4-6',
    fast: false,
    maxMode: false,
    thinking: true,
    approximated: true,
  },
  'claude-4-opus-thinking': {
    modelId: 'provider-anthropic-claude-opus-4',
    fast: false,
    maxMode: false,
    thinking: true,
    approximated: true,
  },
  'claude-4.1-opus-thinking': {
    modelId: 'provider-anthropic-claude-opus-4-1',
    fast: false,
    maxMode: false,
    thinking: true,
    approximated: true,
  },
  'gpt-5-high-fast': {
    modelId: 'gpt-5',
    fast: true,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gpt-5-medium-fast': {
    modelId: 'gpt-5',
    fast: true,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gpt-5-high': {
    modelId: 'gpt-5',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gpt-5.1-codex-high': {
    modelId: 'gpt-5.1-codex',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gpt-5.2-codex-xhigh': {
    modelId: 'gpt-5.2-codex',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gpt-5.2-codex-high': {
    modelId: 'gpt-5.2-codex',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gpt-5.3-codex-high': {
    modelId: 'gpt-5.3-codex',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gemini-3-pro-preview': {
    modelId: 'gemini-3-pro',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gemini-3-flash-preview': {
    modelId: 'gemini-3-flash',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  o3: {
    modelId: 'provider-openai-o3',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  agent_review: {
    modelId: 'gpt-5',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'grok-4-0709': {
    modelId: 'grok-code-fast-1',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
};

// Only models with documented long-context pricing belong here. Other Max rows
// still get Cursor's flat Max upcharge, but no additional long-context multiplier.
const LONG_CONTEXT_COMPANIONS: Record<string, { maxId: string; approximated?: boolean }> = {
  'claude-4-sonnet': { maxId: 'claude-4-sonnet-1m' },
  'claude-4-5-opus': { maxId: 'claude-opus-4-6-max', approximated: true },
  'claude-4-5-sonnet': { maxId: 'claude-4-sonnet-1m', approximated: true },
  'claude-opus-4-6': { maxId: 'claude-opus-4-6-max' },
  'claude-sonnet-4-6': { maxId: 'claude-4-sonnet-1m', approximated: true },
  'gpt-5.4': { maxId: 'gpt-5.4-max' },
};

const APPROXIMATE_FAST_REASONING_SUFFIXES = new Set(['medium', 'high', 'xhigh']);
const DEFAULT_APPROXIMATE_FAST_MULTIPLIER = 2;

export function parseCursorUsageFiles(
  files: CsvInputFile[],
  models: Model[],
  options: CursorImportOptions = {},
): CursorImportReport {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const modelsById = new Map(models.map((model) => [model.id, model]));
  const aggregate = new Map<string, UsageLineItemInput>();
  const unsupported = new Map<string, CursorImportIssue>();
  const excluded = new Map<string, CursorImportIssue>();
  const nonApiIncluded = new Map<string, CursorImportIssue>();
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

  const pricedEntries = [...aggregate.values()].sort((a, b) => b.tokens.total - a.tokens.total);
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

function parseCursorCsvText(text: string): ParsedRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length <= 1) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));

    const tokens: ExactTokenBreakdown = {
      inputWithCacheWrite: toNumber(row['Input (w/ Cache Write)']),
      inputWithoutCacheWrite: toNumber(row['Input (w/o Cache Write)']),
      cacheRead: toNumber(row['Cache Read']),
      output: toNumber(row['Output Tokens']),
      total: toNumber(row['Total Tokens']),
    };

    const computedTotal =
      tokens.inputWithCacheWrite +
      tokens.inputWithoutCacheWrite +
      tokens.cacheRead +
      tokens.output;

    if (tokens.total <= 0 && computedTotal > 0) {
      tokens.total = computedTotal;
    }

    return {
      dayKey: extractDayKey(row.Date),
      kind: row.Kind ?? '',
      model: row.Model ?? 'unknown',
      maxMode: (row['Max Mode'] ?? '').toLowerCase() === 'yes',
      tokens,
    };
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function normalizeImportedModel(
  rawLabel: string,
  maxMode: boolean,
  modelsById: Map<string, Model>,
  approximationMode: ApproximationMode,
): NormalizationResult {
  if (modelsById.has(rawLabel)) {
    return supportedResult(rawLabel, {
      fast: false,
      maxMode: resolveMaxMode(rawLabel, maxMode, modelsById),
      thinking: false,
      approximated: false,
    });
  }

  const exactAlias = EXACT_ALIASES[rawLabel];
  if (exactAlias) {
    return supportedResult(exactAlias.modelId, {
      fast: exactAlias.fast,
      maxMode: resolveMaxMode(exactAlias.modelId, maxMode, modelsById, exactAlias.maxMode),
      thinking: exactAlias.thinking,
      approximated: exactAlias.approximated,
    });
  }

  const approximateAlias = APPROXIMATE_ALIASES[rawLabel];
  if (approximateAlias) {
    if (approximationMode === 'strict') {
      return {
        kind: 'unsupported',
        reason: 'Requires approximation assumptions that are disabled in strict mode',
      };
    }

    return supportedResult(approximateAlias.modelId, {
      fast: approximateAlias.fast,
      maxMode: resolveMaxMode(approximateAlias.modelId, maxMode, modelsById, approximateAlias.maxMode),
      thinking: approximateAlias.thinking,
      approximated: true,
    });
  }

  const approximateFastLabel = normalizeApproximateFastLabel(
    rawLabel,
    maxMode,
    modelsById,
    approximationMode,
  );
  if (approximateFastLabel) {
    return approximateFastLabel;
  }

  return {
    kind: 'unsupported',
    reason: 'No supported pricing-model mapping for this Cursor model label',
  };
}

function supportedResult(
  modelId: string,
  flags: Omit<SupportedNormalization, 'kind' | 'modelId'>,
): SupportedNormalization {
  return {
    kind: 'supported',
    modelId,
    fast: flags.fast,
    maxMode: flags.maxMode,
    thinking: flags.thinking,
    approximated: flags.approximated,
    rateMultiplier: flags.rateMultiplier,
  };
}

function isDedicatedMaxModel(modelId: string): boolean {
  return modelId.endsWith('-max') || modelId.endsWith('-1m') || modelId === 'claude-4-sonnet-1m';
}

function resolveMaxMode(
  modelId: string,
  rawMaxMode: boolean,
  modelsById: Map<string, Model>,
  forceMaxMode: boolean = false,
): boolean {
  if (forceMaxMode || isDedicatedMaxModel(modelId)) {
    return true;
  }

  if (!rawMaxMode) {
    return false;
  }

  const model = modelsById.get(modelId);
  return !!(model?.variants?.max_mode || model?.auto_checks?.max_mode);
}

function normalizeApproximateFastLabel(
  rawLabel: string,
  rawMaxMode: boolean,
  modelsById: Map<string, Model>,
  approximationMode: ApproximationMode,
): SupportedNormalization | null {
  if (approximationMode === 'strict') {
    return null;
  }

  if (!rawLabel.startsWith('gpt-5.') || !rawLabel.endsWith('-fast')) {
    return null;
  }

  const segments = rawLabel.split('-');
  if (segments.length < 3) {
    return null;
  }

  segments.pop();

  while (segments.length > 0 && APPROXIMATE_FAST_REASONING_SUFFIXES.has(segments[segments.length - 1])) {
    segments.pop();
  }

  const forceMaxMode = segments[segments.length - 1] === 'max';
  if (forceMaxMode) {
    segments.pop();
  }

  const candidateModelId = segments.join('-');
  const model = modelsById.get(candidateModelId);
  if (!model) {
    return null;
  }

  return supportedResult(candidateModelId, {
    fast: true,
    maxMode: resolveMaxMode(candidateModelId, rawMaxMode || forceMaxMode, modelsById, forceMaxMode),
    thinking: false,
    approximated: true,
    rateMultiplier: model.variants?.fast ? 1 : DEFAULT_APPROXIMATE_FAST_MULTIPLIER,
  });
}

function getExclusionReason(
  kind: string,
  options: Required<CursorImportOptions>,
): string | null {
  if (kind === 'Errored, No Charge' || kind === 'Aborted, Not Charged') {
    return 'No-charge row excluded from pricing replay';
  }

  if (kind === 'Free') {
    return 'Free row excluded from pricing replay';
  }

  if (kind === 'User API Key' && !options.includeUserApiKey) {
    return 'User API Key row excluded from Cursor-plan replay';
  }

  return null;
}

function buildUsageKey(
  modelId: string,
  fast: boolean,
  maxMode: boolean,
  thinking: boolean,
  sourceGroup: string,
): string {
  return [
    modelId,
    fast ? 'fast' : 'base',
    maxMode ? 'max' : 'standard',
    thinking ? 'thinking' : 'plain',
    sourceGroup,
  ].join(':');
}

function exactTokensToDisplayBreakdown(tokens: ExactTokenBreakdown): TokenBreakdown {
  return {
    total: tokens.total,
    input: tokens.inputWithCacheWrite + tokens.inputWithoutCacheWrite + tokens.cacheRead,
    output: tokens.output,
  };
}

function addDisplayBreakdowns(left: TokenBreakdown, right: TokenBreakdown): TokenBreakdown {
  return {
    total: left.total + right.total,
    input: left.input + right.input,
    output: left.output + right.output,
  };
}

function addExactBreakdowns(
  left: ExactTokenBreakdown | undefined,
  right: ExactTokenBreakdown,
): ExactTokenBreakdown {
  const base = left ?? {
    inputWithCacheWrite: 0,
    inputWithoutCacheWrite: 0,
    cacheRead: 0,
    output: 0,
    total: 0,
  };

  return {
    inputWithCacheWrite: base.inputWithCacheWrite + right.inputWithCacheWrite,
    inputWithoutCacheWrite: base.inputWithoutCacheWrite + right.inputWithoutCacheWrite,
    cacheRead: base.cacheRead + right.cacheRead,
    output: base.output + right.output,
    total: base.total + right.total,
  };
}

function addCostBreakdowns(
  left: ExactCostBreakdown | undefined,
  right: ExactCostBreakdown,
): ExactCostBreakdown {
  const base = left ?? {
    input: 0,
    output: 0,
    total: 0,
  };

  return {
    input: base.input + right.input,
    output: base.output + right.output,
    total: base.total + right.total,
  };
}

function hasCachingTokens(tokens: ExactTokenBreakdown): boolean {
  return tokens.inputWithCacheWrite > 0 || tokens.cacheRead > 0;
}

function getSourceMeta(kind: string, rawLabel: string): { group: string; label?: string } {
  if (kind === 'User API Key') {
    return { group: 'api_key', label: 'API Key' };
  }

  if (rawLabel === 'agent_review') {
    return { group: 'agent_review', label: 'Review Est.' };
  }

  if (rawLabel === 'grok-4-0709') {
    return { group: 'grok_4', label: 'Grok 4 Est.' };
  }

  return { group: 'cursor' };
}

function priceImportedRow(
  model: Model,
  normalized: SupportedNormalization,
  tokens: ExactTokenBreakdown,
  modelsById: Map<string, Model>,
): { exactCost: ExactCostBreakdown; approximated: boolean } {
  const config: ModelConfig = {
    modelId: normalized.modelId,
    weight: 100,
    maxMode: normalized.maxMode,
    fast: normalized.fast,
    thinking: normalized.thinking,
    caching: false,
    cacheHitRate: 0,
  };

  let rates = computeBillableRates(model, config);
  let approximated = false;

  if (normalized.maxMode) {
    const totalInputTokens =
      tokens.inputWithCacheWrite +
      tokens.inputWithoutCacheWrite +
      tokens.cacheRead;

    if (model.context.default > 0 && totalInputTokens > model.context.default) {
      const adjusted = applyLongContextCompanionRates(model, rates, modelsById);
      rates = adjusted.rates;
      approximated = adjusted.approximated;
    }
  }

  if (normalized.rateMultiplier && normalized.rateMultiplier !== 1) {
    rates = multiplyRates(rates, normalized.rateMultiplier);
  }

  const cacheWriteRate = rates.cache_write ?? rates.input;
  const cacheReadRate = rates.cache_read ?? rates.input;
  const inputCost = (
    (tokens.inputWithCacheWrite / 1_000_000) * cacheWriteRate +
    (tokens.inputWithoutCacheWrite / 1_000_000) * rates.input +
    (tokens.cacheRead / 1_000_000) * cacheReadRate
  );
  const outputCost = (tokens.output / 1_000_000) * rates.output;

  return {
    exactCost: {
      input: inputCost,
      output: outputCost,
      total: inputCost + outputCost,
    },
    approximated,
  };
}

function multiplyRates(rates: Model['rates'], multiplier: number): Model['rates'] {
  return {
    input: rates.input * multiplier,
    cache_write: rates.cache_write === null ? null : rates.cache_write * multiplier,
    cache_read: rates.cache_read === null ? null : rates.cache_read * multiplier,
    output: rates.output * multiplier,
  };
}

function applyLongContextCompanionRates(
  model: Model,
  rates: Model['rates'],
  modelsById: Map<string, Model>,
): { rates: Model['rates']; approximated: boolean } {
  const companionConfig = LONG_CONTEXT_COMPANIONS[model.id];
  if (!companionConfig) {
    return {
      rates,
      approximated: false,
    };
  }

  const companion = modelsById.get(companionConfig.maxId);
  if (!companion) {
    return {
      rates,
      approximated: companionConfig.approximated ?? true,
    };
  }

  return {
    rates: {
      input: applyMultiplier(rates.input, model.rates.input, companion.rates.input),
      cache_write: rates.cache_write === null
        ? null
        : applyMultiplier(
            rates.cache_write,
            model.rates.cache_write ?? model.rates.input,
            companion.rates.cache_write ?? companion.rates.input,
          ),
      cache_read: rates.cache_read === null
        ? null
        : applyMultiplier(
            rates.cache_read,
            model.rates.cache_read ?? model.rates.input,
            companion.rates.cache_read ?? companion.rates.input,
          ),
      output: applyMultiplier(rates.output, model.rates.output, companion.rates.output),
    },
    approximated: companionConfig.approximated ?? false,
  };
}

function applyMultiplier(current: number, base: number, target: number): number {
  if (base <= 0) return current;
  return current * (target / base);
}

function recordIssue(
  issues: Map<string, CursorImportIssue>,
  label: string,
  tokens: number,
  reason: string,
): void {
  const key = `${label}::${reason}`;
  const existing = issues.get(key);

  if (existing) {
    existing.tokens += tokens;
    existing.rows += 1;
    return;
  }

  issues.set(key, {
    label,
    tokens,
    rows: 1,
    reason,
  });
}

function sortIssues(issues: Map<string, CursorImportIssue>): CursorImportIssue[] {
  return [...issues.values()].sort((left, right) => right.tokens - left.tokens);
}

function toNumber(value: string | undefined): number {
  const normalized = (value ?? '').replace(/,/g, '').trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractDayKey(value: string | undefined): string | null {
  const normalized = (value ?? '').trim();
  if (!normalized) return null;

  const directMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch) {
    return directMatch[1];
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
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
