import { reconcileSelectedModelConfigs } from '../domain/modelConfig/defaults';
import type { Model } from '../domain/catalog/types';
import type { ResolvedCursorImportOptions } from '../domain/importReplay/types';
import { buildSimpleExactTokenBreakdown, normalizeExactTokenBreakdown } from '../domain/recommendation/manualUsage';
import type { ExactTokenBreakdown, ModelConfig } from '../domain/recommendation/types';
import type { Audience } from '../domain/catalog/types';
import type {
  CloudAutomationScope,
  CloudProductKind,
  CloudRuntimeKind,
} from '../domain/cloudAutomations/types';
import type { CalculatorState, ImportedCsvFile, ManualTokenInputMode, NavigationTarget, TokenSource } from './calculatorState';

export type CalculatorAction =
  | { type: 'set_mode'; mode: CalculatorState['mode'] }
  | { type: 'set_token_source'; tokenSource: TokenSource }
  | { type: 'set_audience'; audience: Audience }
  | { type: 'set_cloud_product'; cloudProduct: CloudProductKind }
  | { type: 'set_cloud_runtime'; cloudRuntime: CloudRuntimeKind }
  | { type: 'set_cloud_automation_scope'; cloudAutomationScope: CloudAutomationScope }
  | { type: 'set_cloud_model_id'; cloudModelId: string }
  | { type: 'set_cloud_tokens'; cloudTokens: number }
  | { type: 'set_cloud_cache_read_share'; cloudCacheReadShare: number }
  | { type: 'set_cloud_input_ratio'; cloudInputRatio: number }
  | { type: 'set_cloud_fast'; cloudFast: boolean }
  | { type: 'set_budget'; budget: number }
  | { type: 'set_tokens'; tokens: number }
  | { type: 'set_manual_token_input_mode'; manualTokenInputMode: ManualTokenInputMode }
  | { type: 'set_use_anecdotal_included_pool_estimate'; useAnecdotalIncludedPoolEstimate: boolean }
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
    case 'set_audience':
      return {
        ...state,
        audience: action.audience,
        useAnecdotalIncludedPoolEstimate: action.audience === 'personal'
          ? state.useAnecdotalIncludedPoolEstimate
          : false,
        cloudAutomationScope: action.audience === 'personal' && state.cloudAutomationScope === 'team_owned'
          ? 'private'
          : state.cloudAutomationScope,
        cloudRuntime: action.audience === 'personal' && state.cloudRuntime === 'team_pools'
          ? 'cursor_managed'
          : state.cloudRuntime,
      };
    case 'set_cloud_product':
      return { ...state, cloudProduct: action.cloudProduct };
    case 'set_cloud_runtime':
      return { ...state, cloudRuntime: action.cloudRuntime };
    case 'set_cloud_automation_scope':
      return { ...state, cloudAutomationScope: action.cloudAutomationScope };
    case 'set_cloud_model_id':
      return { ...state, cloudModelId: action.cloudModelId };
    case 'set_cloud_tokens':
      return { ...state, cloudTokens: action.cloudTokens };
    case 'set_cloud_cache_read_share':
      return { ...state, cloudCacheReadShare: Math.min(100, Math.max(0, action.cloudCacheReadShare)) };
    case 'set_cloud_input_ratio':
      return { ...state, cloudInputRatio: action.cloudInputRatio };
    case 'set_cloud_fast':
      return { ...state, cloudFast: action.cloudFast };
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
    case 'set_use_anecdotal_included_pool_estimate':
      return {
        ...state,
        useAnecdotalIncludedPoolEstimate: action.useAnecdotalIncludedPoolEstimate,
      };
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
          return { ...state, view: 'budget', mode: 'budget', tokenSource: 'manual' };
        case 'manual_usage':
          return { ...state, view: 'manual_usage', mode: 'tokens', tokenSource: 'manual' };
        case 'csv_import':
          return { ...state, view: 'csv_import', mode: 'tokens', tokenSource: 'cursor_import' };
        case 'cloud_automations':
          return { ...state, view: 'cloud_automations' };
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
