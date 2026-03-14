import { describe, expect, it } from 'vitest';

import { buildRecommendationPresentation } from '../recommendationPresentation';
import type { PlanLineItem, PlanResult, Recommendation } from '../../domain/recommendation/types';

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
  recommendation: ReturnType<typeof buildRecommendationPresentation>,
  rowKey: string,
  planKey: PlanResult['plan'],
) {
  return recommendation.comparisonSections
    .flatMap((section) => section.rows)
    .find((row) => row.key === rowKey)
    ?.values.find((value) => value.plan === planKey)?.value;
}

describe('recommendation presentation', () => {
  it('uses actual out-of-pocket cost as the budget-mode hero value and exposes budget ceiling separately from headroom', () => {
    const best = createPlanResult({
      plan: 'ultra',
      subscription: 200,
      apiPool: 400,
      apiBudget: 500,
      apiUsage: 500,
      overage: 100,
      totalCost: 300,
      perModel: [createLineItem({ apiCost: 500 })],
    });
    const alternative = createPlanResult({
      plan: 'pro_plus',
      subscription: 60,
      apiPool: 70,
      apiBudget: 350,
      apiUsage: 350,
      overage: 280,
      totalCost: 340,
      perModel: [createLineItem({ apiCost: 350, tokens: { total: 6_000_000, input: 4_500_000, output: 1_500_000 } })],
    });

    const presentation = buildRecommendationPresentation({
      mode: 'budget',
      tokenSource: 'manual',
      budgetCeiling: 350,
      recommendation: createRecommendation(best, [best, alternative]),
    });

    expect(presentation.heading).toBe('Best plan for your budget');
    expect(presentation.hero.primaryMetric).toMatchObject({
      label: 'Estimated monthly cost',
      value: 300,
      formattedValue: '$300.00',
    });
    expect(presentation.bestPlan.derived).toMatchObject({
      usageValue: 500,
      includedPoolUsed: 400,
      additionalApiBilled: 100,
      totalOutOfPocket: 300,
      budgetHeadroom: 50,
      tokenYield: 10_000_000,
    });
    expect(findRowValue(presentation, 'budgetCeiling', 'ultra')).toBe(350);
    expect(findRowValue(presentation, 'budgetHeadroom', 'ultra')).toBe(50);
  });

  it('uses total estimated usage cost as the token-mode hero value and keeps plan coverage separate from final out-of-pocket', () => {
    const best = createPlanResult({
      plan: 'pro_plus',
      subscription: 60,
      apiPool: 70,
      apiBudget: 70,
      apiUsage: 120,
      overage: 50,
      totalCost: 110,
      perModel: [createLineItem({ apiCost: 120 })],
    });

    const presentation = buildRecommendationPresentation({
      mode: 'tokens',
      tokenSource: 'manual',
      recommendation: createRecommendation(best),
    });

    expect(presentation.heading).toBe('Best plan for this usage');
    expect(presentation.hero.primaryMetric).toMatchObject({
      label: 'Total estimated usage cost',
      value: 120,
      formattedValue: '$120.00',
    });
    expect(presentation.hero.secondaryMetric).toMatchObject({
      label: 'Estimated out-of-pocket with Pro Plus',
      value: 110,
      formattedValue: '$110.00',
    });
    expect(presentation.bestPlan.derived).toMatchObject({
      usageValue: 120,
      includedPoolUsed: 70,
      additionalApiBilled: 50,
      totalOutOfPocket: 110,
      budgetHeadroom: null,
      tokenYield: 10_000_000,
    });
    expect(findRowValue(presentation, 'includedPoolUsed', 'pro_plus')).toBe(70);
    expect(findRowValue(presentation, 'totalOutOfPocket', 'pro_plus')).toBe(110);
  });

  it('uses the same usage-first framing for csv replay as manual token mode', () => {
    const best = createPlanResult({
      plan: 'pro_plus',
      subscription: 60,
      apiPool: 70,
      apiBudget: 70,
      apiUsage: 120,
      overage: 50,
      totalCost: 110,
      perModel: [createLineItem({ apiCost: 120 })],
    });

    const manualPresentation = buildRecommendationPresentation({
      mode: 'tokens',
      tokenSource: 'manual',
      recommendation: createRecommendation(best),
    });
    const importPresentation = buildRecommendationPresentation({
      mode: 'tokens',
      tokenSource: 'cursor_import',
      recommendation: createRecommendation(best),
    });

    expect(importPresentation.heading).toBe('Best plan for this imported month');
    expect(importPresentation.hero.primaryMetric).toEqual(manualPresentation.hero.primaryMetric);
    expect(importPresentation.hero.secondaryMetric).toEqual(manualPresentation.hero.secondaryMetric);
    expect(importPresentation.comparisonSections.map((section) => section.title)).toEqual(
      manualPresentation.comparisonSections.map((section) => section.title),
    );
  });

  it('returns grouped comparison sections in the expected semantic order', () => {
    const presentation = buildRecommendationPresentation({
      mode: 'tokens',
      tokenSource: 'manual',
      recommendation: createRecommendation(createPlanResult()),
    });

    expect(presentation.comparisonSections.map((section) => section.title)).toEqual([
      'Primary answer',
      'Plan coverage',
      'Out-of-pocket breakdown',
      'Usage/value details',
    ]);
  });

  it('throws when recommendation.best.plan is missing from recommendation.all', () => {
    const best = createPlanResult({ plan: 'ultra' });
    const onlyResult = createPlanResult({
      plan: 'pro',
      subscription: 20,
      apiPool: 20,
      apiBudget: 20,
      apiUsage: 20,
      overage: 0,
      totalCost: 20,
    });

    expect(() => buildRecommendationPresentation({
      mode: 'tokens',
      tokenSource: 'manual',
      recommendation: createRecommendation(best, [onlyResult]),
    })).toThrow('Recommendation best plan "ultra" was not found in recommendation.all');
  });

  it('includes included-pool models in the presentation when provided', () => {
    const presentation = buildRecommendationPresentation({
      mode: 'tokens',
      tokenSource: 'manual',
      recommendation: createRecommendation(createPlanResult()),
      includedPoolModels: [
        { id: 'auto', name: 'Auto', provider: 'cursor' },
        { id: 'composer-1.5', name: 'Composer 1.5', provider: 'cursor' },
      ],
    });

    expect(presentation.includedPoolItems).toEqual([
      { key: 'auto', label: 'Auto', provider: 'cursor', poolLabel: 'Included in all plans' },
      { key: 'composer-1.5', label: 'Composer 1.5', provider: 'cursor', poolLabel: 'Included in all plans' },
    ]);
  });

  it('defaults to an empty included-pool list when none are provided', () => {
    const presentation = buildRecommendationPresentation({
      mode: 'tokens',
      tokenSource: 'manual',
      recommendation: createRecommendation(createPlanResult()),
    });

    expect(presentation.includedPoolItems).toEqual([]);
  });

  it('formats negative budget headroom with the sign before the dollar symbol', () => {
    const best = createPlanResult({
      plan: 'ultra',
      subscription: 200,
      apiPool: 400,
      apiBudget: 400,
      apiUsage: 400,
      overage: 0,
      totalCost: 200,
    });

    const presentation = buildRecommendationPresentation({
      mode: 'budget',
      tokenSource: 'manual',
      budgetCeiling: 60,
      recommendation: createRecommendation(best),
    });

    const headroomRow = presentation.comparisonSections
      .flatMap((section) => section.rows)
      .find((row) => row.key === 'budgetHeadroom');
    const ultraValue = headroomRow?.values.find((v) => v.plan === 'ultra');

    expect(ultraValue?.value).toBe(-140);
    expect(ultraValue?.formattedValue).toBe('-$140.00');
    expect(presentation.hero.context).toContain('exceeds your $60.00 budget by $140.00');
  });

  it('assigns unique comparison row keys across all sections', () => {
    const presentation = buildRecommendationPresentation({
      mode: 'tokens',
      tokenSource: 'manual',
      recommendation: createRecommendation(createPlanResult()),
    });

    const rowKeys = presentation.comparisonSections.flatMap((section) =>
      section.rows.map((row) => row.key),
    );

    expect(new Set(rowKeys).size).toBe(rowKeys.length);
  });

  it('populates modelGroups for csv import mode', () => {
    const presentation = buildRecommendationPresentation({
      mode: 'tokens',
      tokenSource: 'cursor_import',
      recommendation: createRecommendation(createPlanResult()),
    });

    expect(presentation.modelGroups).not.toBeNull();
    expect(presentation.modelGroups!.length).toBeGreaterThan(0);
    expect(presentation.modelGroups![0].groupKey).toBe('model-1');
  });

  it('returns null modelGroups for manual token mode', () => {
    const presentation = buildRecommendationPresentation({
      mode: 'tokens',
      tokenSource: 'manual',
      recommendation: createRecommendation(createPlanResult()),
    });

    expect(presentation.modelGroups).toBeNull();
  });

  it('returns null modelGroups for budget mode', () => {
    const presentation = buildRecommendationPresentation({
      mode: 'budget',
      tokenSource: 'manual',
      budgetCeiling: 200,
      recommendation: createRecommendation(createPlanResult()),
    });

    expect(presentation.modelGroups).toBeNull();
  });
});
