import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { BestPlanCard } from '../BestPlanCard';
import { buildRecommendationPresentation } from '../../app/recommendationPresentation';
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

function buildPresentation(options: {
  mode: 'budget' | 'tokens';
  tokenSource: 'manual' | 'cursor_import';
  budgetCeiling?: number;
  recommendation: Recommendation;
  includedPoolModels?: Array<{ id: string; name: string; provider: string }>;
}) {
  return buildRecommendationPresentation(options);
}

function renderCard(options: {
  mode: 'budget' | 'tokens';
  tokenSource: 'manual' | 'cursor_import';
  budgetCeiling?: number;
  recommendation: Recommendation;
  includedPoolModels?: Array<{ id: string; name: string; provider: string }>;
}) {
  const presentation = buildPresentation(options);

  return renderCardFromPresentation(presentation);
}

function renderCardFromPresentation(
  presentation: ReturnType<typeof buildRecommendationPresentation>,
) {
  return renderToStaticMarkup(
    // Intentionally use the presentation-model contract this task is moving the card to.
    <BestPlanCard presentation={presentation} />,
  );
}

describe('BestPlanCard', () => {
  it('renders budget-mode header and hero semantics from the presentation model', () => {
    const html = renderCard({
      mode: 'budget',
      tokenSource: 'manual',
      budgetCeiling: 350,
      recommendation: createRecommendation(createPlanResult()),
    });

    expect(html).toContain('Best plan for your budget');
    expect(html).toContain('Estimated monthly cost');
    expect(html).toContain('stays $50.00 under your $350.00 budget');
    expect(html).toContain('Plan coverage');
    expect(html).toContain('Out-of-pocket breakdown');
    expect(html).not.toContain('API value /month');
  });

  it('renders token-mode hero semantics with usage cost first and plan out-of-pocket second', () => {
    const html = renderCard({
      mode: 'tokens',
      tokenSource: 'manual',
      recommendation: createRecommendation(createPlanResult({
        plan: 'pro_plus',
        subscription: 60,
        apiPool: 70,
        apiBudget: 70,
        apiUsage: 120,
        overage: 50,
        totalCost: 110,
        perModel: [createLineItem({ apiCost: 120 })],
      })),
    });

    expect(html).toContain('Best plan for this usage');
    expect(html).toContain('Total estimated usage cost');
    expect(html).toContain('Estimated out-of-pocket with Pro Plus');
    expect(html).toContain('$120.00');
    expect(html).toContain('$110.00');
  });

  it('uses imported-month wording for csv replay recommendations', () => {
    const html = renderCard({
      mode: 'tokens',
      tokenSource: 'cursor_import',
      recommendation: createRecommendation(createPlanResult({
        plan: 'pro_plus',
        subscription: 60,
        apiPool: 70,
        apiBudget: 70,
        apiUsage: 120,
        overage: 50,
        totalCost: 110,
        perModel: [createLineItem({ apiCost: 120 })],
      })),
    });

    expect(html).toContain('Best plan for this imported month');
  });

  it('renders included-pool models with their pool label before API-pool model rows', () => {
    const presentation = buildPresentation({
      mode: 'tokens',
      tokenSource: 'manual',
      recommendation: createRecommendation(createPlanResult()),
      includedPoolModels: [
        { id: 'auto', name: 'Auto', provider: 'cursor' },
        { id: 'composer-1.5', name: 'Composer 1.5', provider: 'cursor' },
      ],
    });

    const html = renderCardFromPresentation(presentation);

    expect(html).toContain('Auto');
    expect(html).toContain('Composer 1.5');
    expect(html).toContain('Included');
    expect(html).toContain('Included in all plans');
    const autoIndex = html.indexOf('Auto');
    const modelIndex = html.indexOf('Model 1');
    expect(autoIndex).toBeLessThan(modelIndex);
  });

  it('ignores the primary-answer section using section semantics rather than display title copy', () => {
    const presentation = buildPresentation({
      mode: 'budget',
      tokenSource: 'manual',
      budgetCeiling: 350,
      recommendation: createRecommendation(createPlanResult()),
    });

    presentation.comparisonSections = presentation.comparisonSections.map((section, index) => (
      index === 0 ? { ...section, title: 'Overview' } : section
    ));

    const html = renderCardFromPresentation(presentation);

    expect(html).not.toContain('Overview');
    expect(html).not.toContain('Budget ceiling');
    expect(html).toContain('Plan coverage');
  });

  it('renders collapsed model groups with variant count when modelGroups is present', () => {
    const presentation = buildPresentation({
      mode: 'tokens',
      tokenSource: 'cursor_import',
      recommendation: createRecommendation(createPlanResult({
        plan: 'ultra',
        perModel: [
          createLineItem({ key: 'co46-base', modelId: 'claude-opus-4-6', label: 'Claude 4.6 Opus', apiCost: 50, tokens: { total: 5_000_000, input: 3_750_000, output: 1_250_000 } }),
          createLineItem({ key: 'co46-max', modelId: 'claude-opus-4-6-max', label: 'Claude 4.6 Opus Max', apiCost: 70, tokens: { total: 3_000_000, input: 2_250_000, output: 750_000 } }),
        ],
      })),
    });

    const html = renderCardFromPresentation(presentation);
    // Should show the grouped family (highest-cost child label after sort)
    expect(html).toContain('2 variants');
  });

  it('selects grouped breakdown values and model details from the recommended plan in multi-plan data', () => {
    const firstPlan = createPlanResult({
      plan: 'pro',
      subscription: 22,
      apiPool: 21,
      apiBudget: 21,
      apiUsage: 140,
      overage: 119,
      totalCost: 141,
      perModel: [createLineItem({
        key: 'model-first',
        modelId: 'model-first',
        label: 'First Plan Model',
        apiCost: 140,
      })],
    });
    const bestPlan = createPlanResult({
      plan: 'pro_plus',
      subscription: 66,
      apiPool: 77,
      apiBudget: 77,
      apiUsage: 120,
      overage: 43,
      totalCost: 109,
      perModel: [createLineItem({
        key: 'model-best',
        modelId: 'model-best',
        label: 'Best Plan Model',
        apiCost: 120,
      })],
    });

    const html = renderCard({
      mode: 'tokens',
      tokenSource: 'manual',
      recommendation: createRecommendation(bestPlan, [firstPlan, bestPlan]),
    });

    expect(html).toContain('Pro Plus');
    expect(html).toContain('Best Plan Model');
    expect(html).not.toContain('First Plan Model');
    expect(html).toContain('Included API pool');
    expect(html).toContain('$77.00');
    expect(html).not.toContain('$21.00');
  });
});
