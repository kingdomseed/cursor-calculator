import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { buildRecommendationPresentation } from '../../app/recommendationPresentation';
import type { PlanLineItem, PlanResult, Recommendation } from '../../domain/recommendation/types';
import { PlanComparison } from '../PlanComparison';

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

function renderComparison(options: {
  mode: 'budget' | 'tokens';
  tokenSource: 'manual' | 'cursor_import';
  budgetCeiling?: number;
  recommendation: Recommendation;
  includedPoolModels?: Array<{ id: string; name: string; provider: string }>;
  defaultOpen?: boolean;
}) {
  const presentation = buildPresentation(options);

  return renderComparisonFromPresentation(presentation, options.defaultOpen);
}

function renderComparisonFromPresentation(
  presentation: ReturnType<typeof buildRecommendationPresentation>,
  defaultOpen = false,
) {
  return renderToStaticMarkup(
    <PlanComparison presentation={presentation} defaultOpen={defaultOpen} />,
  );
}

describe('PlanComparison', () => {
  it('renders grouped budget sections with presentation-driven labels and no ambiguous legacy copy', () => {
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
      perModel: [createLineItem({
        key: 'model-2',
        modelId: 'model-2',
        label: 'Model 2',
        apiCost: 350,
        tokens: {
          total: 6_000_000,
          input: 4_500_000,
          output: 1_500_000,
        },
      })],
    });

    const html = renderComparison({
      mode: 'budget',
      tokenSource: 'manual',
      budgetCeiling: 350,
      recommendation: createRecommendation(best, [best, alternative]),
      defaultOpen: true,
    });

    expect(html).toContain('Primary answer');
    expect(html).toContain('Plan coverage');
    expect(html).toContain('Out-of-pocket breakdown');
    expect(html).toContain('Usage/value details');
    expect(html).toContain('Budget ceiling');
    expect(html).toContain('Budget headroom');
    expect(html).not.toContain('API value /month');
    expect(html).not.toContain('Total cash cost');
    expect(html).not.toContain('API value unlocked');
  });

  it('renders token-mode rows from the presentation model instead of legacy raw-result labels', () => {
    const html = renderComparison({
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
      defaultOpen: true,
    });

    expect(html).toContain('Total estimated usage cost');
    expect(html).toContain('Estimated out-of-pocket');
    expect(html).not.toContain('Your API usage');
    expect(html).not.toContain('Total cost');
    expect(html).not.toContain('API value unlocked');
  });

  it('renders row values and model details from the presentation model', () => {
    const presentation = buildPresentation({
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

    presentation.comparisonSections = presentation.comparisonSections.map((section) => (
      section.kind === 'out_of_pocket_breakdown'
        ? {
            ...section,
            rows: section.rows.map((row) => (
              row.key === 'totalOutOfPocket'
                ? {
                    ...row,
                    label: 'Custom out-of-pocket label',
                    values: row.values.map((value) => ({
                      ...value,
                      formattedValue: '$123.45 custom',
                    })),
                  }
                : row
            )),
          }
        : section
    ));
    presentation.plans = presentation.plans.map((plan) => ({
      ...plan,
      modelRows: plan.modelRows.map((row, index) => (
        index === 0
          ? {
              ...row,
              primaryMetric: {
                ...row.primaryMetric,
                formattedValue: '42 custom tokens',
              },
              secondaryMetric: row.secondaryMetric
                ? {
                    ...row.secondaryMetric,
                    formattedValue: '$88.00 custom',
                  }
                : null,
            }
          : row
      )),
    }));

    const html = renderComparisonFromPresentation(presentation, true);

    expect(html).toContain('Custom out-of-pocket label');
    expect(html).toContain('$123.45 custom');
    expect(html).toContain('42 custom tokens');
    expect(html).toContain('$88.00 custom');
  });

  it('keeps the comparison collapsed by default and allows deterministic expanded rendering for tests', () => {
    const presentation = buildPresentation({
      mode: 'tokens',
      tokenSource: 'manual',
      recommendation: createRecommendation(createPlanResult()),
    });

    const closedHtml = renderComparisonFromPresentation(presentation);
    const openHtml = renderComparisonFromPresentation(presentation, true);

    expect(closedHtml).toContain('Compare all plans');
    expect(closedHtml).not.toContain('Primary answer');
    expect(openHtml).toContain('Primary answer');
  });

  it('renders included-pool models with "Included" in every plan column', () => {
    const pro = createPlanResult({
      plan: 'pro',
      subscription: 20,
      apiPool: 20,
      apiBudget: 20,
      apiUsage: 20,
      overage: 0,
      totalCost: 20,
      perModel: [createLineItem({ key: 'model-a', modelId: 'model-a', label: 'Model A', apiCost: 20 })],
    });
    const proPlusPlan = createPlanResult({
      plan: 'pro_plus',
      subscription: 60,
      apiPool: 70,
      apiBudget: 70,
      apiUsage: 20,
      overage: 0,
      totalCost: 60,
      perModel: [createLineItem({ key: 'model-a', modelId: 'model-a', label: 'Model A', apiCost: 20 })],
    });

    const html = renderComparison({
      mode: 'tokens',
      tokenSource: 'manual',
      recommendation: createRecommendation(proPlusPlan, [pro, proPlusPlan]),
      includedPoolModels: [
        { id: 'auto', name: 'Auto', provider: 'cursor' },
        { id: 'composer-1.5', name: 'Composer 1.5', provider: 'cursor' },
      ],
      defaultOpen: true,
    });

    expect(html).toContain('Auto');
    expect(html).toContain('Composer 1.5');
    expect(html).toContain('Included in all plans');
    const includedMatches = html.match(/Included<\/td>/g) ?? [];
    expect(includedMatches.length).toBe(4);
  });

  it('keeps per-model cells aligned to plan columns when a model is missing from another plan', () => {
    const proPlan = createPlanResult({
      plan: 'pro',
      subscription: 20,
      apiPool: 20,
      apiBudget: 20,
      apiUsage: 20,
      overage: 0,
      totalCost: 20,
      perModel: [
        createLineItem({
          key: 'shared-model',
          modelId: 'shared-model',
          label: 'Shared Model',
          apiCost: 20,
        }),
      ],
    });
    const proPlusPlan = createPlanResult({
      plan: 'pro_plus',
      subscription: 60,
      apiPool: 70,
      apiBudget: 70,
      apiUsage: 120,
      overage: 50,
      totalCost: 110,
      perModel: [
        createLineItem({
          key: 'shared-model',
          modelId: 'shared-model',
          label: 'Shared Model',
          apiCost: 20,
        }),
        createLineItem({
          key: 'missing-from-pro',
          modelId: 'missing-from-pro',
          label: 'Only In Pro Plus',
          apiCost: 222,
          tokens: {
            total: 42_000_000,
            input: 31_500_000,
            output: 10_500_000,
          },
        }),
      ],
    });

    const html = renderComparison({
      mode: 'tokens',
      tokenSource: 'manual',
      recommendation: createRecommendation(proPlusPlan, [proPlan, proPlusPlan]),
      defaultOpen: true,
    });
    const missingPlanRow = html.match(/Only In Pro Plus[\s\S]*?<\/tr>/)?.[0] ?? '';
    const tdCount = (missingPlanRow.match(/<td/g) ?? []).length;

    expect(tdCount).toBe(2);
    expect(missingPlanRow).toContain('—');
    expect(missingPlanRow).toContain('$222.00');
    expect(missingPlanRow.indexOf('—')).toBeLessThan(missingPlanRow.indexOf('$222.00'));
  });
});
