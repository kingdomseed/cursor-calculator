import { parseCursorUsageFiles } from '../domain/importReplay/summary';
import type { CursorImportReport } from '../domain/importReplay/types';
import { buildSimpleExactTokenBreakdown, computeManualUsageRecommendation } from '../domain/recommendation/manualUsage';
import { computeExactUsageRecommendation, computeRecommendation } from '../domain/recommendation/recommendation';
import type { Recommendation } from '../domain/recommendation/types';
import type { Model, PricingData } from '../domain/catalog/types';
import { getPlanKeysForAudience } from '../domain/catalog/pools';
import { computeCloudAutomationsCost } from '../domain/cloudAutomations/pricing';
import type { CloudAutomationsResult } from '../domain/cloudAutomations/types';
import { ANECDOTAL_INCLUDED_POOL_ESTIMATE } from '../data/includedPoolEstimates';
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
  return state.view !== 'cloud_automations' && (state.mode === 'budget' || state.tokenSource === 'manual');
}

export function selectAudiencePlans(
  state: CalculatorState,
  plans: PricingData['plans'],
): Partial<PricingData['plans']> {
  return Object.fromEntries(
    getPlanKeysForAudience(state.audience).flatMap((key) => {
      const plan = plans[key];
      return plan ? [[key, plan]] : [];
    }),
  );
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
  if (state.view === 'cloud_automations') {
    return null;
  }

  const audiencePlans = selectAudiencePlans(state, inputs.plans);
  const recommendationOptions = { audience: state.audience };

  if (selectIsImportMode(state)) {
    const cursorImportReport = inputs.cursorImportReport ?? selectCursorImportReport(state, inputs.importReplayModels);
    if (!cursorImportReport || cursorImportReport.pricedEntries.length === 0) {
      return null;
    }

    return computeExactUsageRecommendation(
      cursorImportReport.pricedEntries,
      inputs.importReplayModels,
      audiencePlans,
      undefined,
      recommendationOptions,
    );
  }

  if (state.modelConfigs.length === 0) {
    return null;
  }

  if (state.mode === 'tokens' && state.tokenSource === 'manual') {
    const exactTokens = state.manualTokenInputMode === 'advanced'
      ? state.manualExactTokens
      : buildSimpleExactTokenBreakdown(state.tokens, state.cacheReadShare, state.inputRatio);

    return computeManualUsageRecommendation(
      exactTokens,
      selectSelectedModels(state, inputs.manualModels),
      state.modelConfigs,
      audiencePlans,
      state.audience === 'personal' && state.useAnecdotalIncludedPoolEstimate
        ? ANECDOTAL_INCLUDED_POOL_ESTIMATE
        : undefined,
      inputs.manualModels,
      {
        ...recommendationOptions,
        priceLongContextFromInput: state.manualTokenInputMode === 'advanced',
      },
    );
  }

  return computeRecommendation(
    state.mode,
    state.budget,
    state.tokens,
    selectSelectedModels(state, inputs.manualModels),
    state.modelConfigs,
    audiencePlans,
    state.inputRatio,
    state.cacheReadShare,
    recommendationOptions,
  );
}

export function selectRecommendationPresentation(
  state: CalculatorState,
  recommendation: Recommendation | null,
  includedPoolModels: Model[] = [],
): RecommendationPresentation | null {
  if (!recommendation) {
    return null;
  }

  return buildRecommendationPresentation({
    mode: state.mode,
    tokenSource: state.tokenSource,
    audience: state.audience,
    budgetCeiling: state.mode === 'budget' ? state.budget : undefined,
    recommendation,
    includedPoolModels,
  });
}

export function selectCloudAutomationsResult(
  state: CalculatorState,
  models: Model[],
): CloudAutomationsResult {
  return computeCloudAutomationsCost(
    {
      audience: state.audience,
      product: state.cloudProduct,
      runtime: state.cloudRuntime,
      automationScope: state.cloudAutomationScope,
      modelId: state.cloudModelId,
      tokens: state.cloudTokens,
      cacheReadShare: state.cloudCacheReadShare,
      inputRatio: state.cloudInputRatio,
      fast: state.cloudFast,
    },
    models,
  );
}
