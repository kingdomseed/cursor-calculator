import type { ExactCostBreakdown, ExactTokenBreakdown, TokenBreakdown } from '../recommendation/types';
import type { CursorImportIssue, SourceMeta } from './types';

export function buildUsageKey(
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

export function exactTokensToDisplayBreakdown(tokens: ExactTokenBreakdown): TokenBreakdown {
  return {
    total: tokens.total,
    input: tokens.inputWithCacheWrite + tokens.inputWithoutCacheWrite + tokens.cacheRead,
    output: tokens.output,
  };
}

export function addDisplayBreakdowns(left: TokenBreakdown, right: TokenBreakdown): TokenBreakdown {
  return {
    total: left.total + right.total,
    input: left.input + right.input,
    output: left.output + right.output,
  };
}

export function addExactBreakdowns(
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

export function addCostBreakdowns(
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

export function hasCachingTokens(tokens: ExactTokenBreakdown): boolean {
  return tokens.inputWithCacheWrite > 0 || tokens.cacheRead > 0;
}

export function getSourceMeta(kind: string, rawLabel: string): SourceMeta {
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

export function recordIssue(
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

export function sortIssues(issues: Map<string, CursorImportIssue>): CursorImportIssue[] {
  return [...issues.values()].sort((left, right) => right.tokens - left.tokens);
}
