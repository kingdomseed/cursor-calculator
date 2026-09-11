import { useCallback, useMemo, useReducer } from 'react';
import { getIncludedPoolModels, getManualSelectableModels, getPlans } from '../domain/catalog/currentCatalog';
import type { Audience } from '../domain/catalog/types';
import { isOtherModelsPool } from '../domain/catalog/pools';
import type {
  CloudAutomationScope,
  CloudAutomationsResult,
  CloudProductKind,
  CloudRuntimeKind,
} from '../domain/cloudAutomations/types';
import { getImportReplayModels } from '../domain/importReplay/catalog';
import type {
  ApproximationMode,
  CursorImportReport,
  ResolvedCursorImportOptions,
} from '../domain/importReplay/types';
import type { ExactTokenBreakdown, Recommendation } from '../domain/recommendation/types';
import type { Model, PricingData } from '../domain/catalog/types';
import { startCursorImport } from './cursorImportActions';
import { calculatorReducer } from './calculatorReducer';
import {
  createInitialCalculatorState,
  type CalculatorState,
  type ManualTokenInputMode,
  type NavigationTarget,
  type TokenSource,
} from './calculatorState';
import {
  deriveCursorImportReport,
  selectCloudAutomationsResult,
  selectIsImportMode,
  selectRecommendation,
  selectRecommendationPresentation,
  selectSelectedFileName,
  selectSelectedModelIds,
  selectSelectedModels,
  selectShowManualControls,
} from './calculatorSelectors';
import type { RecommendationPresentation } from './recommendationPresentation';

interface CalculatorControllerDependencies {
  manualModels?: Model[];
  importReplayModels?: Model[];
  plans?: PricingData['plans'];
}

interface CalculatorController {
  state: CalculatorState;
  manualModels: Model[];
  selectedModelIds: string[];
  selectedModels: Model[];
  isImportMode: boolean;
  showManualControls: boolean;
  selectedFileName: string | null;
  cursorImportReport: CursorImportReport | null;
  recommendation: Recommendation | null;
  recommendationPresentation: RecommendationPresentation | null;
  cloudAutomationsResult: CloudAutomationsResult;
  navigationTarget: NavigationTarget;
  navigate: (target: NavigationTarget) => void;
  setAudience: (audience: Audience) => void;
  setCloudProduct: (cloudProduct: CloudProductKind) => void;
  setCloudRuntime: (cloudRuntime: CloudRuntimeKind) => void;
  setCloudAutomationScope: (cloudAutomationScope: CloudAutomationScope) => void;
  setCloudModelId: (cloudModelId: string) => void;
  setCloudTokens: (cloudTokens: number) => void;
  setCloudCacheReadShare: (cloudCacheReadShare: number) => void;
  setCloudInputRatio: (cloudInputRatio: number) => void;
  setCloudFast: (cloudFast: boolean) => void;
  setMode: (mode: CalculatorState['mode']) => void;
  setTokenSource: (tokenSource: TokenSource) => void;
  setBudget: (budget: number) => void;
  setTokens: (tokens: number) => void;
  setManualTokenInputMode: (manualTokenInputMode: ManualTokenInputMode) => void;
  setUseAnecdotalIncludedPoolEstimate: (checked: boolean) => void;
  setCacheReadShare: (cacheReadShare: number) => void;
  setManualExactTokens: (manualExactTokens: ExactTokenBreakdown) => void;
  setInputRatio: (inputRatio: number) => void;
  setShowAdvanced: (showAdvanced: boolean) => void;
  setModelConfigs: (configs: CalculatorState['modelConfigs']) => void;
  handleModelSelectionChange: (ids: string[]) => void;
  handleCursorImportFilesSelected: (files: FileList | null) => Promise<void>;
  handleApproximationModeChange: (mode: ApproximationMode) => void;
  handleIncludeUserApiKeyChange: (checked: boolean) => void;
}

export function useCalculatorController(
  dependencies: CalculatorControllerDependencies = {},
): CalculatorController {
  const manualModels = useMemo(
    () => dependencies.manualModels ?? getManualSelectableModels(),
    [dependencies.manualModels],
  );
  const importReplayModels = useMemo(
    () => dependencies.importReplayModels ?? getImportReplayModels(),
    [dependencies.importReplayModels],
  );
  const plans = useMemo(
    () => dependencies.plans ?? getPlans(),
    [dependencies.plans],
  );
  const includedPoolModels = useMemo(
    () => getIncludedPoolModels(),
    [],
  );
  const apiModels = useMemo(
    () => manualModels.filter((model) => isOtherModelsPool(model.pool)),
    [manualModels],
  );
  const apiModelIds = useMemo(
    () => new Set(apiModels.map((model) => model.id)),
    [apiModels],
  );
  const initialModels = apiModels.length > 0 ? apiModels : manualModels;

  const [state, dispatch] = useReducer(calculatorReducer, initialModels, createInitialCalculatorState);
  const { cursorImportFiles, cursorImportOptions } = state;

  const selectedModelIds = useMemo(() => selectSelectedModelIds(state), [state]);
  const selectedModels = useMemo(() => selectSelectedModels(state, manualModels), [manualModels, state]);
  const cursorImportReport = useMemo(
    () => deriveCursorImportReport(cursorImportFiles, cursorImportOptions, importReplayModels),
    [cursorImportFiles, cursorImportOptions, importReplayModels],
  );
  const recommendation = useMemo(
    () => selectRecommendation(state, { manualModels, importReplayModels, plans, cursorImportReport }),
    [cursorImportReport, importReplayModels, manualModels, plans, state],
  );
  const recommendationPresentation = useMemo(
    () => selectRecommendationPresentation(state, recommendation, includedPoolModels),
    [includedPoolModels, recommendation, state],
  );
  const cloudAutomationsResult = useMemo(
    () => selectCloudAutomationsResult(state, manualModels),
    [manualModels, state],
  );

  const navigationTarget: NavigationTarget = state.view;

  const navigate = useCallback((target: NavigationTarget) => {
    dispatch({ type: 'navigate', target });

    if (target === 'budget' && apiModels.length > 0) {
      const selectedApiIds: string[] = [];
      for (const config of state.modelConfigs) {
        if (apiModelIds.has(config.modelId)) {
          selectedApiIds.push(config.modelId);
        }
      }
      dispatch({
        type: 'reconcile_selected_models',
        ids: selectedApiIds.length > 0 ? selectedApiIds : [apiModels[0].id],
        manualModels: apiModels,
      });
    }
  }, [apiModelIds, apiModels, state.modelConfigs]);

  const setMode = useCallback((mode: CalculatorState['mode']) => {
    dispatch({ type: 'set_mode', mode });
  }, []);

  const setTokenSource = useCallback((tokenSource: TokenSource) => {
    dispatch({ type: 'set_token_source', tokenSource });
  }, []);

  const setAudience = useCallback((audience: Audience) => {
    dispatch({ type: 'set_audience', audience });
  }, []);

  const setCloudProduct = useCallback((cloudProduct: CloudProductKind) => {
    dispatch({ type: 'set_cloud_product', cloudProduct });
  }, []);

  const setCloudRuntime = useCallback((cloudRuntime: CloudRuntimeKind) => {
    dispatch({ type: 'set_cloud_runtime', cloudRuntime });
  }, []);

  const setCloudAutomationScope = useCallback((cloudAutomationScope: CloudAutomationScope) => {
    dispatch({ type: 'set_cloud_automation_scope', cloudAutomationScope });
  }, []);

  const setCloudModelId = useCallback((cloudModelId: string) => {
    dispatch({ type: 'set_cloud_model_id', cloudModelId });
  }, []);

  const setCloudTokens = useCallback((cloudTokens: number) => {
    dispatch({ type: 'set_cloud_tokens', cloudTokens });
  }, []);

  const setCloudCacheReadShare = useCallback((cloudCacheReadShare: number) => {
    dispatch({ type: 'set_cloud_cache_read_share', cloudCacheReadShare });
  }, []);

  const setCloudInputRatio = useCallback((cloudInputRatio: number) => {
    dispatch({ type: 'set_cloud_input_ratio', cloudInputRatio });
  }, []);

  const setCloudFast = useCallback((cloudFast: boolean) => {
    dispatch({ type: 'set_cloud_fast', cloudFast });
  }, []);

  const setBudget = useCallback((budget: number) => {
    dispatch({ type: 'set_budget', budget });
  }, []);

  const setTokens = useCallback((tokens: number) => {
    dispatch({ type: 'set_tokens', tokens });
  }, []);

  const setManualTokenInputMode = useCallback((manualTokenInputMode: ManualTokenInputMode) => {
    dispatch({ type: 'set_manual_token_input_mode', manualTokenInputMode });
  }, []);

  const setUseAnecdotalIncludedPoolEstimate = useCallback((checked: boolean) => {
    dispatch({
      type: 'set_use_anecdotal_included_pool_estimate',
      useAnecdotalIncludedPoolEstimate: checked,
    });
  }, []);

  const setCacheReadShare = useCallback((cacheReadShare: number) => {
    dispatch({ type: 'set_cache_read_share', cacheReadShare });
  }, []);

  const setManualExactTokens = useCallback((manualExactTokens: ExactTokenBreakdown) => {
    dispatch({ type: 'set_manual_exact_tokens', manualExactTokens });
  }, []);

  const setInputRatio = useCallback((inputRatio: number) => {
    dispatch({ type: 'set_input_ratio', inputRatio });
  }, []);

  const setShowAdvanced = useCallback((showAdvanced: boolean) => {
    dispatch({ type: 'set_show_advanced', showAdvanced });
  }, []);

  const setModelConfigs = useCallback((configs: CalculatorState['modelConfigs']) => {
    dispatch({ type: 'set_model_configs', modelConfigs: configs });
  }, []);

  const handleModelSelectionChange = useCallback((ids: string[]) => {
    dispatch({ type: 'reconcile_selected_models', ids, manualModels });
  }, [manualModels]);

  const updateCursorImportOptions = useCallback((cursorImportOptions: ResolvedCursorImportOptions) => {
    dispatch({ type: 'set_cursor_import_options', cursorImportOptions });
  }, []);

  const handleApproximationModeChange = useCallback((mode: ApproximationMode) => {
    updateCursorImportOptions({
      ...state.cursorImportOptions,
      approximationMode: mode,
    });
  }, [state.cursorImportOptions, updateCursorImportOptions]);

  const handleIncludeUserApiKeyChange = useCallback((checked: boolean) => {
    updateCursorImportOptions({
      ...state.cursorImportOptions,
      includeUserApiKey: checked,
    });
  }, [state.cursorImportOptions, updateCursorImportOptions]);

  const handleCursorImportFilesSelected = useCallback(async (files: FileList | null) => {
    const flow = startCursorImport(files);
    if (flow.startedAction) {
      dispatch(flow.startedAction);
    }

    const completionAction = await flow.completion;
    if (completionAction) {
      dispatch(completionAction);
    }
  }, []);

  return {
    state,
    manualModels,
    selectedModelIds,
    selectedModels,
    isImportMode: selectIsImportMode(state),
    showManualControls: selectShowManualControls(state),
    selectedFileName: selectSelectedFileName(state),
    cursorImportReport,
    recommendation,
    recommendationPresentation,
    cloudAutomationsResult,
    navigationTarget,
    navigate,
    setAudience,
    setCloudProduct,
    setCloudRuntime,
    setCloudAutomationScope,
    setCloudModelId,
    setCloudTokens,
    setCloudCacheReadShare,
    setCloudInputRatio,
    setCloudFast,
    setMode,
    setTokenSource,
    setBudget,
    setTokens,
    setManualTokenInputMode,
    setUseAnecdotalIncludedPoolEstimate,
    setCacheReadShare,
    setManualExactTokens,
    setInputRatio,
    setShowAdvanced,
    setModelConfigs,
    handleModelSelectionChange,
    handleCursorImportFilesSelected,
    handleApproximationModeChange,
    handleIncludeUserApiKeyChange,
  };
}
