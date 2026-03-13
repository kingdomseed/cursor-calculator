import { createInitialModelConfigs } from '../domain/modelConfig/defaults';
import type { Model } from '../domain/catalog/types';
import type { CursorImportOptions, CsvInputFile } from '../domain/importReplay/types';
import type { Mode, ModelConfig } from '../domain/recommendation/types';

export type TokenSource = 'manual' | 'cursor_import';
export type ImportedCsvFile = CsvInputFile;
export type ResolvedCursorImportOptions = Required<CursorImportOptions>;

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

export const DEFAULT_CURSOR_IMPORT_OPTIONS: ResolvedCursorImportOptions = {
  includeUserApiKey: true,
  approximationMode: 'best_effort',
};

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
    cursorImportOptions: DEFAULT_CURSOR_IMPORT_OPTIONS,
    modelConfigs: createInitialModelConfigs(manualModels),
  };
}
