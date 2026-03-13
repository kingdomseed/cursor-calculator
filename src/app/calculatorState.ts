import { createInitialModelConfigs } from '../domain/modelConfig/defaults';
import type { Model } from '../domain/catalog/types';
import { resolveCursorImportOptions } from '../domain/importReplay/options';
import type { CsvInputFile, ResolvedCursorImportOptions } from '../domain/importReplay/types';
import type { Mode, ModelConfig } from '../domain/recommendation/types';

export type TokenSource = 'manual' | 'cursor_import';
export type ImportedCsvFile = CsvInputFile;

export interface CalculatorState {
  mode: Mode;
  tokenSource: TokenSource;
  budget: number;
  tokens: number;
  inputRatio: number;
  showAdvanced: boolean;
  cursorImportFiles: ImportedCsvFile[];
  cursorImportError: string | null;
  isImporting: boolean;
  cursorImportOptions: ResolvedCursorImportOptions;
  modelConfigs: ModelConfig[];
}

export function createInitialCalculatorState(manualModels: Model[]): CalculatorState {
  return {
    mode: 'budget',
    tokenSource: 'manual',
    budget: 60,
    tokens: 1_000_000,
    inputRatio: 3,
    showAdvanced: false,
    cursorImportFiles: [],
    cursorImportError: null,
    isImporting: false,
    cursorImportOptions: resolveCursorImportOptions(),
    modelConfigs: createInitialModelConfigs(manualModels),
  };
}
