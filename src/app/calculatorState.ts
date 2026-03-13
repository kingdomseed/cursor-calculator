import { createInitialModelConfigs } from '../domain/modelConfig/defaults';
import type { Model } from '../domain/catalog/types';
import { resolveCursorImportOptions } from '../domain/importReplay/options';
import type { CsvInputFile, ResolvedCursorImportOptions } from '../domain/importReplay/types';
import { buildSimpleExactTokenBreakdown } from '../domain/recommendation/manualUsage';
import type { ExactTokenBreakdown, Mode, ModelConfig } from '../domain/recommendation/types';

export type TokenSource = 'manual' | 'cursor_import';
export type ManualTokenInputMode = 'simple' | 'advanced';
export type ImportedCsvFile = CsvInputFile;

export interface CalculatorState {
  mode: Mode;
  tokenSource: TokenSource;
  budget: number;
  tokens: number;
  manualTokenInputMode: ManualTokenInputMode;
  cacheReadShare: number;
  manualExactTokens: ExactTokenBreakdown;
  inputRatio: number;
  showAdvanced: boolean;
  cursorImportFiles: ImportedCsvFile[];
  cursorImportError: string | null;
  isImporting: boolean;
  cursorImportOptions: ResolvedCursorImportOptions;
  modelConfigs: ModelConfig[];
}

export function createInitialCalculatorState(manualModels: Model[]): CalculatorState {
  const tokens = 1_000_000;
  const inputRatio = 3;
  const cacheReadShare = 0;

  return {
    mode: 'budget',
    tokenSource: 'manual',
    budget: 60,
    tokens,
    manualTokenInputMode: 'simple',
    cacheReadShare,
    manualExactTokens: buildSimpleExactTokenBreakdown(tokens, cacheReadShare, inputRatio),
    inputRatio,
    showAdvanced: false,
    cursorImportFiles: [],
    cursorImportError: null,
    isImporting: false,
    cursorImportOptions: resolveCursorImportOptions(),
    modelConfigs: createInitialModelConfigs(manualModels),
  };
}
