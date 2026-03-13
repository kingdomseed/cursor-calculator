import { reconcileSelectedModelConfigs } from '../domain/modelConfig/defaults';
import type { Model } from '../domain/catalog/types';
import type { ResolvedCursorImportOptions } from '../domain/importReplay/types';
import type { ModelConfig } from '../domain/recommendation/types';
import type { CalculatorState, ImportedCsvFile, TokenSource } from './calculatorState';

export type CalculatorAction =
  | { type: 'set_mode'; mode: CalculatorState['mode'] }
  | { type: 'set_token_source'; tokenSource: TokenSource }
  | { type: 'set_budget'; budget: number }
  | { type: 'set_tokens'; tokens: number }
  | { type: 'set_input_ratio'; inputRatio: number }
  | { type: 'set_show_advanced'; showAdvanced: boolean }
  | { type: 'set_model_configs'; modelConfigs: ModelConfig[] }
  | { type: 'reconcile_selected_models'; ids: string[]; manualModels: Model[] }
  | { type: 'set_cursor_import_options'; cursorImportOptions: ResolvedCursorImportOptions }
  | { type: 'import_started' }
  | { type: 'import_loaded'; files: ImportedCsvFile[] }
  | { type: 'import_failed'; error: string };

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case 'set_mode':
      return { ...state, mode: action.mode };
    case 'set_token_source':
      return { ...state, tokenSource: action.tokenSource };
    case 'set_budget':
      return { ...state, budget: action.budget };
    case 'set_tokens':
      return { ...state, tokens: action.tokens };
    case 'set_input_ratio':
      return { ...state, inputRatio: action.inputRatio };
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
    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
}
