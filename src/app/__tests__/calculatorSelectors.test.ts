import { describe, expect, it } from 'vitest';

import type { PlanLineItem, PlanResult, Recommendation } from '../../domain/recommendation/types';
import { getManualApiModels, getPlans } from '../../domain/catalog/currentCatalog';
import { createInitialCalculatorState } from '../calculatorState';
import { selectRecommendation, selectRecommendationPresentation } from '../calculatorSelectors';

function createLineItem(overrides: Partial<PlanLineItem> = {}): PlanLineItem {
  return {
    key: 'model-1',
    modelId: 'model-1',
    label: 'Model 1',
    provider: 'anthropic',
    pool: 'api',
    tokens: {
      total: 10_000_000,
      input: 7_500_000,
      output: 2_500_000,
    },
    maxMode: false,
    fast: false,
    thinking: false,
    caching: false,
    cacheHitRate: 0,
    approximated: false,
    effectiveRates: {
      input: 3,
      output: 15,
    },
    apiCost: 500,
    ...overrides,
  };
}

function createPlanResult(overrides: Partial<PlanResult> = {}): PlanResult {
  return {
    plan: 'ultra',
    subscription: 200,
    apiPool: 400,
    apiBudget: 500,
    apiUsage: 500,
    overage: 100,
    unusedPool: 0,
    totalCost: 300,
    affordable: true,
    perModel: [createLineItem()],
    ...overrides,
  };
}

function createRecommendation(best: PlanResult, all: PlanResult[] = [best]): Recommendation {
  return {
    best,
    all,
  };
}

function findRowValue(
  recommendation: NonNullable<ReturnType<typeof selectRecommendationPresentation>>,
  rowKey: string,
  planKey: PlanResult['plan'],
) {
  return recommendation.comparisonSections
    .flatMap((section) => section.rows)
    .find((row) => row.key === rowKey)
    ?.values.find((value) => value.plan === planKey)?.value;
}

const manualModels = getManualApiModels();

describe('selectRecommendationPresentation', () => {
  it('passes the current budget through as the budget ceiling in budget mode', () => {
    const state = {
      ...createInitialCalculatorState(manualModels),
      budget: 350,
    };

    const presentation = selectRecommendationPresentation(
      state,
      createRecommendation(createPlanResult()),
    );

    expect(presentation).not.toBeNull();
    expect(findRowValue(presentation!, 'budgetCeiling', 'ultra')).toBe(350);
  });

  it('uses the manual token source in manual token mode', () => {
    const state = {
      ...createInitialCalculatorState(manualModels),
      mode: 'tokens' as const,
      tokenSource: 'manual' as const,
    };

    const presentation = selectRecommendationPresentation(
      state,
      createRecommendation(createPlanResult()),
    );

    expect(presentation?.tokenSource).toBe('manual');
  });

  it('uses the cursor import token source in csv replay mode', () => {
    const state = {
      ...createInitialCalculatorState(manualModels),
      mode: 'tokens' as const,
      tokenSource: 'cursor_import' as const,
    };

    const presentation = selectRecommendationPresentation(
      state,
      createRecommendation(createPlanResult()),
    );

    expect(presentation?.tokenSource).toBe('cursor_import');
  });

  it('returns null when no recommendation is available', () => {
    const state = createInitialCalculatorState(manualModels);

    expect(selectRecommendationPresentation(state, null)).toBeNull();
  });
});

describe('selectRecommendation', () => {
  it('budget mode with cacheReadShare > 0 produces more tokens than cacheReadShare: 0', () => {
    const plans = getPlans();
    const inputs = { manualModels, importReplayModels: [], plans };

    const baseState = {
      ...createInitialCalculatorState(manualModels),
      mode: 'budget' as const,
      budget: 130,
    };

    const noCacheResult = selectRecommendation(
      { ...baseState, cacheReadShare: 0 },
      inputs,
    );
    const highCacheResult = selectRecommendation(
      { ...baseState, cacheReadShare: 80 },
      inputs,
    );

    expect(noCacheResult).not.toBeNull();
    expect(highCacheResult).not.toBeNull();

    const noCacheTokens = noCacheResult!.best.perModel.reduce(
      (sum, item) => sum + item.tokens.total, 0,
    );
    const highCacheTokens = highCacheResult!.best.perModel.reduce(
      (sum, item) => sum + item.tokens.total, 0,
    );

    expect(highCacheTokens).toBeGreaterThan(noCacheTokens);
  });
});
