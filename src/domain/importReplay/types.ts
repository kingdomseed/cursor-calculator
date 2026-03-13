import type { Model } from '../catalog/types';
import type { ExactCostBreakdown, ExactTokenBreakdown, UsageLineItemInput } from '../recommendation/types';

export type { ExactCostBreakdown, ExactTokenBreakdown, UsageLineItemInput } from '../recommendation/types';

export type ApproximationMode = 'strict' | 'best_effort';

export interface CursorImportOptions {
  includeUserApiKey?: boolean;
  approximationMode?: ApproximationMode;
}

export type ResolvedCursorImportOptions = Required<CursorImportOptions>;

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

export interface CsvInputFile {
  name: string;
  text: string;
}

export interface ParsedRow {
  dayKey: string | null;
  kind: string;
  model: string;
  maxMode: boolean;
  tokens: ExactTokenBreakdown;
}

export interface SupportedNormalization {
  kind: 'supported';
  modelId: string;
  fast: boolean;
  maxMode: boolean;
  thinking: boolean;
  approximated: boolean;
  rateMultiplier?: number;
}

export interface UnsupportedNormalization {
  kind: 'unsupported';
  reason: string;
}

export type NormalizationResult = SupportedNormalization | UnsupportedNormalization;

export interface PricedImportedRow {
  exactCost: ExactCostBreakdown;
  approximated: boolean;
}

export interface SourceMeta {
  group: string;
  label?: string;
}

export type ImportReplayModelsById = Map<string, Model>;
