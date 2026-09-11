import { createInitialModelConfigs } from '../domain/modelConfig/defaults';
import type { Audience, Model } from '../domain/catalog/types';
import { resolveCursorImportOptions } from '../domain/importReplay/options';
import type { CsvInputFile, ResolvedCursorImportOptions } from '../domain/importReplay/types';
import { buildSimpleExactTokenBreakdown } from '../domain/recommendation/manualUsage';
import type { ExactTokenBreakdown, Mode, ModelConfig } from '../domain/recommendation/types';
import type {
  CloudAutomationScope,
  CloudProductKind,
  CloudRuntimeKind,
} from '../domain/cloudAutomations/types';

export type TokenSource = 'manual' | 'cursor_import';
export type ManualTokenInputMode = 'simple' | 'advanced';
export type NavigationTarget = 'budget' | 'manual_usage' | 'csv_import' | 'cloud_automations';
export type ImportedCsvFile = CsvInputFile;

export interface CalculatorState {
  view: NavigationTarget;
  audience: Audience;
  mode: Mode;
  tokenSource: TokenSource;
  budget: number;
  tokens: number;
  cloudProduct: CloudProductKind;
  cloudRuntime: CloudRuntimeKind;
  cloudAutomationScope: CloudAutomationScope;
  cloudModelId: string;
  cloudTokens: number;
  cloudCacheReadShare: number;
  cloudInputRatio: number;
  cloudFast: boolean;
  manualTokenInputMode: ManualTokenInputMode;
  useAnecdotalIncludedPoolEstimate: boolean;
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

  const defaultCloudModel = manualModels.find((model) => model.id === 'composer-2.5')
    ?? manualModels.find((model) => model.pool === 'other_models')
    ?? manualModels[0];

  return {
    view: 'budget',
    audience: 'personal',
    mode: 'budget',
    tokenSource: 'manual',
    budget: 60,
    tokens,
    manualTokenInputMode: 'simple',
    useAnecdotalIncludedPoolEstimate: false,
    cacheReadShare,
    manualExactTokens: buildSimpleExactTokenBreakdown(tokens, cacheReadShare, inputRatio),
    inputRatio,
    showAdvanced: false,
    cursorImportFiles: [],
    cursorImportError: null,
    isImporting: false,
    cursorImportOptions: resolveCursorImportOptions(),
    modelConfigs: createInitialModelConfigs(manualModels),
    cloudProduct: 'cloud_agent',
    cloudRuntime: 'cursor_managed',
    cloudAutomationScope: 'private',
    cloudModelId: defaultCloudModel?.id ?? 'composer-2.5',
    cloudTokens: 1_000_000,
    cloudCacheReadShare: 0,
    cloudInputRatio: 3,
    cloudFast: false,
  };
}
