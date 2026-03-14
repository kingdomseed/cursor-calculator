import { reconcileSelectedModelConfigs } from '../domain/modelConfig/defaults';
import type { Model } from '../domain/catalog/types';
import type { ResolvedCursorImportOptions } from '../domain/importReplay/types';
import { buildSimpleExactTokenBreakdown, normalizeExactTokenBreakdown } from '../domain/recommendation/manualUsage';
import type { ExactTokenBreakdown, ModelConfig } from '../domain/recommendation/types';
import type { CalculatorState, ImportedCsvFile, ManualTokenInputMode, NavigationTarget, TokenSource } from './calculatorState';

export type CalculatorAction =
  | { type: 'set_mode'; mode: CalculatorState['mode'] }
  | { type: 'set_token_source'; tokenSource: TokenSource }
  | { type: 'set_budget'; budget: number }
  | { type: 'set_tokens'; tokens: number }
  | { type: 'set_manual_token_input_mode'; manualTokenInputMode: ManualTokenInputMode }
  | { type: 'set_cache_read_share'; cacheReadShare: number }
  | { type: 'set_manual_exact_tokens'; manualExactTokens: ExactTokenBreakdown }
  | { type: 'set_input_ratio'; inputRatio: number }
  | { type: 'set_show_advanced'; showAdvanced: boolean }
  | { type: 'set_model_configs'; modelConfigs: ModelConfig[] }
  | { type: 'reconcile_selected_models'; ids: string[]; manualModels: Model[] }
  | { type: 'set_cursor_import_options'; cursorImportOptions: ResolvedCursorImportOptions }
  | { type: 'import_started' }
  | { type: 'import_loaded'; files: ImportedCsvFile[] }
  | { type: 'import_failed'; error: string }
  | { type: 'navigate'; target: NavigationTarget };

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case 'set_mode':
      return { ...state, mode: action.mode };
    case 'set_token_source':
      return { ...state, tokenSource: action.tokenSource };
    case 'set_budget':
      return { ...state, budget: action.budget };
    case 'set_tokens': {
      const nextState = { ...state, tokens: action.tokens };
      return nextState.manualTokenInputMode === 'simple'
        ? syncSimpleManualExactTokens(nextState)
        : nextState;
    }
    case 'set_manual_token_input_mode':
      return { ...state, manualTokenInputMode: action.manualTokenInputMode };
    case 'set_cache_read_share': {
      const nextState = {
        ...state,
        cacheReadShare: Math.min(100, Math.max(0, action.cacheReadShare)),
      };
      return nextState.manualTokenInputMode === 'simple'
        ? syncSimpleManualExactTokens(nextState)
        : nextState;
    }
    case 'set_manual_exact_tokens': {
      const manualExactTokens = normalizeExactTokenBreakdown(action.manualExactTokens);
      return {
        ...state,
        manualExactTokens,
        tokens: manualExactTokens.total,
      };
    }
    case 'set_input_ratio': {
      const nextState = { ...state, inputRatio: action.inputRatio };
      return nextState.manualTokenInputMode === 'simple'
        ? syncSimpleManualExactTokens(nextState)
        : nextState;
    }
    case 'set_show_advanced':
      return { ...state, showAdvanced: action.showAdvanced };
    case 'set_model_configs':
      return { ...state, modelConfigs: action.modelConfigs };
    case 'reconcile_selected_models':
      return {
        ...state,
        modelConfigs: reconcileSelectedModelConfigs(state.modelConfigs, action.ids, action.manualModels),
      };
    case 'set_cursor_import_options':
      return {
        ...state,
        cursorImportOptions: action.cursorImportOptions,
      };
    case 'import_started':
      return {
        ...state,
        cursorImportError: null,
        isImporting: true,
      };
    case 'import_loaded':
      return {
        ...state,
        cursorImportFiles: action.files,
        cursorImportError: null,
        isImporting: false,
      };
    case 'import_failed':
      return {
        ...state,
        cursorImportFiles: [],
        cursorImportError: action.error,
        isImporting: false,
      };
    case 'navigate': {
      switch (action.target) {
        case 'budget':
          return { ...state, mode: 'budget' };
        case 'manual_usage':
          return { ...state, mode: 'tokens', tokenSource: 'manual' };
        case 'csv_import':
          return { ...state, mode: 'tokens', tokenSource: 'cursor_import' };
        default: {
          const _exhaustive: never = action.target;
          return _exhaustive;
        }
      }
    }
    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
}

function syncSimpleManualExactTokens(state: CalculatorState): CalculatorState {
  return {
    ...state,
    manualExactTokens: buildSimpleExactTokenBreakdown(
      state.tokens,
      state.cacheReadShare,
      state.inputRatio,
    ),
  };
}
