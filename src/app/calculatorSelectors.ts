import { parseCursorUsageFiles } from '../domain/importReplay/summary';
import type { CursorImportReport } from '../domain/importReplay/types';
import { computeExactUsageRecommendation, computeRecommendation } from '../domain/recommendation/recommendation';
import type { Recommendation } from '../domain/recommendation/types';
import type { Model, PricingData } from '../domain/catalog/types';
import {
  buildRecommendationPresentation,
  type RecommendationPresentation,
} from './recommendationPresentation';
import type { CalculatorState } from './calculatorState';

interface RecommendationSelectorInputs {
  manualModels: Model[];
  importReplayModels: Model[];
  plans: PricingData['plans'];
  cursorImportReport?: CursorImportReport | null;
}

export function selectSelectedModelIds(state: CalculatorState): string[] {
  return state.modelConfigs.map((config) => config.modelId);
}

export function selectSelectedModels(state: CalculatorState, manualModels: Model[]): Model[] {
  const selectedIds = new Set(selectSelectedModelIds(state));
  return manualModels.filter((model) => selectedIds.has(model.id));
}

export function selectIsImportMode(state: CalculatorState): boolean {
  return state.mode === 'tokens' && state.tokenSource === 'cursor_import';
}

export function selectShowManualControls(state: CalculatorState): boolean {
  return state.mode === 'budget' || state.tokenSource === 'manual';
}

export function selectSelectedFileName(state: CalculatorState): string | null {
  return state.cursorImportFiles[0]?.name ?? null;
}

export function deriveCursorImportReport(
  cursorImportFiles: CalculatorState['cursorImportFiles'],
  cursorImportOptions: CalculatorState['cursorImportOptions'],
  importReplayModels: Model[],
): CursorImportReport | null {
  if (cursorImportFiles.length === 0) {
    return null;
  }

  return parseCursorUsageFiles(cursorImportFiles, importReplayModels, cursorImportOptions);
}

export function selectCursorImportReport(
  state: CalculatorState,
  importReplayModels: Model[],
): CursorImportReport | null {
  return deriveCursorImportReport(
    state.cursorImportFiles,
    state.cursorImportOptions,
    importReplayModels,
  );
}

export function selectRecommendation(
  state: CalculatorState,
  inputs: RecommendationSelectorInputs,
): Recommendation | null {
  if (selectIsImportMode(state)) {
    const cursorImportReport = inputs.cursorImportReport ?? selectCursorImportReport(state, inputs.importReplayModels);
    if (!cursorImportReport || cursorImportReport.pricedEntries.length === 0) {
      return null;
    }

    return computeExactUsageRecommendation(
      cursorImportReport.pricedEntries,
      inputs.importReplayModels,
      inputs.plans,
    );
  }

  if (state.modelConfigs.length === 0) {
    return null;
  }

  return computeRecommendation(
    state.mode,
    state.budget,
    state.tokens,
    selectSelectedModels(state, inputs.manualModels),
    state.modelConfigs,
    inputs.plans,
    state.inputRatio,
  );
}

export function selectRecommendationPresentation(
  state: CalculatorState,
  recommendation: Recommendation | null,
): RecommendationPresentation | null {
  if (!recommendation) {
    return null;
  }

  return buildRecommendationPresentation({
    mode: state.mode,
    tokenSource: state.tokenSource,
    budgetCeiling: state.mode === 'budget' ? state.budget : undefined,
    recommendation,
  });
}
