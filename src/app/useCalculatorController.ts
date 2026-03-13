import { useCallback, useMemo, useReducer } from 'react';
import { getManualApiModels, getPlans } from '../domain/catalog/currentCatalog';
import { getImportReplayModels } from '../domain/importReplay/catalog';
import type {
  ApproximationMode,
  CursorImportReport,
  ResolvedCursorImportOptions,
} from '../domain/importReplay/types';
import type { Recommendation } from '../domain/recommendation/types';
import type { Model, PricingData } from '../domain/catalog/types';
import { buildCursorImportActions } from './cursorImportActions';
import { calculatorReducer } from './calculatorReducer';
import {
  createInitialCalculatorState,
  type CalculatorState,
  type TokenSource,
} from './calculatorState';
import {
  deriveCursorImportReport,
  selectIsImportMode,
  selectRecommendation,
  selectSelectedFileName,
  selectSelectedModelIds,
  selectSelectedModels,
  selectShowManualControls,
} from './calculatorSelectors';

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
  setMode: (mode: CalculatorState['mode']) => void;
  setTokenSource: (tokenSource: TokenSource) => void;
  setBudget: (budget: number) => void;
  setTokens: (tokens: number) => void;
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
    () => dependencies.manualModels ?? getManualApiModels(),
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

  const [state, dispatch] = useReducer(calculatorReducer, manualModels, createInitialCalculatorState);
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

  const setMode = useCallback((mode: CalculatorState['mode']) => {
    dispatch({ type: 'set_mode', mode });
  }, []);

  const setTokenSource = useCallback((tokenSource: TokenSource) => {
    dispatch({ type: 'set_token_source', tokenSource });
  }, []);

  const setBudget = useCallback((budget: number) => {
    dispatch({ type: 'set_budget', budget });
  }, []);

  const setTokens = useCallback((tokens: number) => {
    dispatch({ type: 'set_tokens', tokens });
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
    const actions = await buildCursorImportActions(files);
    for (const action of actions) {
      dispatch(action);
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
    setMode,
    setTokenSource,
    setBudget,
    setTokens,
    setInputRatio,
    setShowAdvanced,
    setModelConfigs,
    handleModelSelectionChange,
    handleCursorImportFilesSelected,
    handleApproximationModeChange,
    handleIncludeUserApiKeyChange,
  };
}
