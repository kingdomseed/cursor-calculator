import type { PlanKey } from '../domain/catalog/types';
import { formatCurrency, formatNumber, formatRate } from '../domain/recommendation/formatters';
import type { Mode, PlanLineItem, PlanResult, Recommendation } from '../domain/recommendation/types';
import type { TokenSource } from './calculatorState';

export interface RecommendationMetric {
  label: string;
  value: number | null;
  formattedValue: string;
}

export interface RecommendationHero {
  title: string;
  planLabel: string;
  primaryMetric: RecommendationMetric;
  secondaryMetric: RecommendationMetric | null;
  context: string;
}

export interface RecommendationPlanDerivedValues {
  usageValue: number;
  includedPoolUsed: number;
  additionalApiBilled: number;
  totalOutOfPocket: number;
  budgetHeadroom: number | null;
  tokenYield: number;
}

export interface RecommendationModelDisplayRow {
  key: string;
  label: string;
  provider: string;
  badges: string[];
  rateLabel: string;
  primaryMetric: RecommendationMetric;
  secondaryMetric: RecommendationMetric | null;
}

export interface RecommendationPlanPresentation {
  plan: PlanKey;
  planLabel: string;
  affordable: boolean;
  subscription: number;
  includedPool: number;
  unusedPool: number;
  derived: RecommendationPlanDerivedValues;
  modelRows: RecommendationModelDisplayRow[];
}

export interface RecommendationComparisonValue {
  plan: PlanKey;
  planLabel: string;
  affordable: boolean;
  value: number | null;
  formattedValue: string;
}

export interface RecommendationComparisonRow {
  key: string;
  label: string;
  values: RecommendationComparisonValue[];
}

export type RecommendationComparisonSectionKind =
  | 'primary_answer'
  | 'plan_coverage'
  | 'out_of_pocket_breakdown'
  | 'usage_value_details';

export interface RecommendationComparisonSection {
  kind: RecommendationComparisonSectionKind;
  title: string;
  rows: RecommendationComparisonRow[];
}

export interface IncludedPoolItem {
  key: string;
  label: string;
  provider: string;
  poolLabel: string;
}

export interface RecommendationPresentation {
  mode: Mode;
  tokenSource: TokenSource;
  heading: string;
  hero: RecommendationHero;
  bestPlan: RecommendationPlanPresentation;
  plans: RecommendationPlanPresentation[];
  comparisonSections: RecommendationComparisonSection[];
  includedPoolItems: IncludedPoolItem[];
}

export interface IncludedPoolModelInput {
  id: string;
  name: string;
  provider: string;
}

interface BuildRecommendationPresentationInput {
  mode: Mode;
  tokenSource: TokenSource;
  budgetCeiling?: number;
  recommendation: Recommendation;
  includedPoolModels?: IncludedPoolModelInput[];
}

export function buildRecommendationPresentation({
  mode,
  tokenSource,
  budgetCeiling,
  recommendation,
  includedPoolModels = [],
}: BuildRecommendationPresentationInput): RecommendationPresentation {
  const plans = recommendation.all.map((result) =>
    buildPlanPresentation(result, mode, budgetCeiling),
  );
  const bestPlan = plans.find((plan) => plan.plan === recommendation.best.plan);
  const heading = getHeading(mode, tokenSource);

  if (!bestPlan) {
    throw new Error(`Recommendation best plan "${recommendation.best.plan}" was not found in recommendation.all`);
  }

  return {
    mode,
    tokenSource,
    heading,
    hero: buildHero(bestPlan, heading, mode, budgetCeiling),
    bestPlan,
    plans,
    comparisonSections: buildComparisonSections(plans, mode, budgetCeiling),
    includedPoolItems: buildIncludedPoolItems(includedPoolModels),
  };
}

function buildPlanPresentation(
  result: PlanResult,
  mode: Mode,
  budgetCeiling?: number,
): RecommendationPlanPresentation {
  const usageValue = result.apiUsage;
  const additionalApiBilled = result.overage;
  const includedPoolUsed = Math.max(0, usageValue - additionalApiBilled);
  const totalOutOfPocket = result.totalCost;
  const tokenYield = result.perModel.reduce((sum, item) => sum + item.tokens.total, 0);
  const budgetHeadroom = mode === 'budget' && budgetCeiling != null
    ? budgetCeiling - totalOutOfPocket
    : null;

  return {
    plan: result.plan,
    planLabel: formatPlanLabel(result.plan),
    affordable: result.affordable,
    subscription: result.subscription,
    includedPool: result.apiPool,
    unusedPool: result.unusedPool,
    derived: {
      usageValue,
      includedPoolUsed,
      additionalApiBilled,
      totalOutOfPocket,
      budgetHeadroom,
      tokenYield,
    },
    modelRows: result.perModel.map((item) => buildModelDisplayRow(item, mode)),
  };
}

function buildHero(
  plan: RecommendationPlanPresentation,
  heading: string,
  mode: Mode,
  budgetCeiling?: number,
): RecommendationHero {
  if (mode === 'budget') {
    const budgetValue = budgetCeiling == null ? null : budgetCeiling;
    const headroom = plan.derived.budgetHeadroom;
    const context = budgetValue == null || headroom == null
      ? `${plan.planLabel} includes a ${formatCurrency(plan.includedPool)} API pool.`
      : headroom >= 0
        ? `${plan.planLabel} stays ${formatCurrency(headroom)} under your ${formatCurrency(budgetValue)} budget and includes a ${formatCurrency(plan.includedPool)} API pool.`
        : `${plan.planLabel} exceeds your ${formatCurrency(budgetValue)} budget by ${formatCurrency(Math.abs(headroom))} and includes a ${formatCurrency(plan.includedPool)} API pool.`;

    return {
      title: heading,
      planLabel: plan.planLabel,
      primaryMetric: {
        label: 'Estimated monthly cost',
        value: plan.derived.totalOutOfPocket,
        formattedValue: formatCurrency(plan.derived.totalOutOfPocket),
      },
      secondaryMetric: {
        label: 'Estimated monthly tokens at this model mix',
        value: plan.derived.tokenYield,
        formattedValue: formatTokens(plan.derived.tokenYield),
      },
      context,
    };
  }

  const coveredByPlan = plan.derived.includedPoolUsed;
  const billedBeyondPool = plan.derived.additionalApiBilled;
  const context = billedBeyondPool > 0
    ? `${plan.planLabel} covers the first ${formatCurrency(coveredByPlan)} with its included API pool, leaving ${formatCurrency(billedBeyondPool)} billed beyond the pool.`
    : `${plan.planLabel} covers the full ${formatCurrency(coveredByPlan)} usage value with its included API pool.`;

  return {
    title: heading,
    planLabel: plan.planLabel,
    primaryMetric: {
      label: 'Total estimated usage cost',
      value: plan.derived.usageValue,
      formattedValue: formatCurrency(plan.derived.usageValue),
    },
    secondaryMetric: {
      label: `Estimated out-of-pocket with ${plan.planLabel}`,
      value: plan.derived.totalOutOfPocket,
      formattedValue: formatCurrency(plan.derived.totalOutOfPocket),
    },
    context,
  };
}

function buildComparisonSections(
  plans: RecommendationPlanPresentation[],
  mode: Mode,
  budgetCeiling?: number,
): RecommendationComparisonSection[] {
  const primaryRows: RecommendationComparisonRow[] = mode === 'budget'
    ? [
        createRow(plans, 'estimatedMonthlyCost', 'Estimated monthly cost', (plan) => plan.derived.totalOutOfPocket, formatCurrency),
        createRow(plans, 'budgetCeiling', 'Budget ceiling', () => budgetCeiling ?? null, formatCurrency),
        createRow(plans, 'budgetHeadroom', 'Budget headroom', (plan) => plan.derived.budgetHeadroom, formatCurrency),
      ]
    : [
        createRow(plans, 'primaryUsageValue', 'Total estimated usage cost', (plan) => plan.derived.usageValue, formatCurrency),
        createRow(plans, 'primaryEstimatedOutOfPocket', 'Estimated out-of-pocket', (plan) => plan.derived.totalOutOfPocket, formatCurrency),
      ];

  return [
    {
      kind: 'primary_answer',
      title: 'Primary answer',
      rows: primaryRows,
    },
    {
      kind: 'plan_coverage',
      title: 'Plan coverage',
      rows: [
        createRow(plans, 'includedPool', 'Included API pool', (plan) => plan.includedPool, formatCurrency),
        createRow(plans, 'includedPoolUsed', 'Included pool used', (plan) => plan.derived.includedPoolUsed, formatCurrency),
        createRow(plans, 'unusedPool', 'Unused pool', (plan) => plan.unusedPool, formatCurrency),
      ],
    },
    {
      kind: 'out_of_pocket_breakdown',
      title: 'Out-of-pocket breakdown',
      rows: [
        createRow(plans, 'subscription', 'Subscription', (plan) => plan.subscription, formatCurrency),
        createRow(plans, 'additionalApiBilled', 'Additional API billed', (plan) => plan.derived.additionalApiBilled, formatCurrency),
        createRow(plans, 'totalOutOfPocket', 'Total out-of-pocket', (plan) => plan.derived.totalOutOfPocket, formatCurrency),
      ],
    },
    {
      kind: 'usage_value_details',
      title: 'Usage/value details',
      rows: [
        createRow(plans, 'usageValue', 'Usage value', (plan) => plan.derived.usageValue, formatCurrency),
        createRow(plans, 'tokenYield', 'Estimated tokens/month', (plan) => plan.derived.tokenYield, formatTokens),
      ],
    },
  ];
}

function buildModelDisplayRow(item: PlanLineItem, mode: Mode): RecommendationModelDisplayRow {
  const badges: string[] = [];

  if (item.maxMode) badges.push('Max');
  if (item.fast) badges.push('Fast');
  if (item.thinking) badges.push('Thinking');
  if (item.caching) {
    badges.push(item.exactTokens ? 'Cache' : `Cache ${item.cacheHitRate}%`);
  }
  if (item.approximated) badges.push('Approx');
  if (item.sourceLabel) badges.push(item.sourceLabel);

  return {
    key: item.key,
    label: item.label,
    provider: item.provider,
    badges,
    rateLabel: `${formatRate(item.effectiveRates.input)} / ${formatRate(item.effectiveRates.output)} per M`,
    primaryMetric: mode === 'budget'
      ? {
          label: 'Estimated tokens',
          value: item.tokens.total,
          formattedValue: formatTokens(item.tokens.total),
        }
      : {
          label: 'Usage cost',
          value: item.apiCost,
          formattedValue: formatCurrency(item.apiCost),
        },
    secondaryMetric: mode === 'budget'
      ? {
          label: 'Usage value',
          value: item.apiCost,
          formattedValue: formatCurrency(item.apiCost),
        }
      : {
          label: 'Token volume',
          value: item.tokens.total,
          formattedValue: formatTokens(item.tokens.total),
        },
  };
}

function createRow(
  plans: RecommendationPlanPresentation[],
  key: string,
  label: string,
  getValue: (plan: RecommendationPlanPresentation) => number | null,
  formatter: (value: number) => string,
): RecommendationComparisonRow {
  return {
    key,
    label,
    values: plans.map((plan) => {
      const value = getValue(plan);

      return {
        plan: plan.plan,
        planLabel: plan.planLabel,
        affordable: plan.affordable,
        value,
        formattedValue: value == null ? '—' : formatter(value),
      };
    }),
  };
}

function getHeading(mode: Mode, tokenSource: TokenSource): string {
  if (mode === 'budget') {
    return 'Best plan for your budget';
  }

  return tokenSource === 'cursor_import'
    ? 'Best plan for this imported month'
    : 'Best plan for this usage';
}

function formatPlanLabel(plan: PlanKey): string {
  if (plan === 'pro_plus') return 'Pro Plus';
  if (plan === 'ultra') return 'Ultra';
  return 'Pro';
}

function buildIncludedPoolItems(models: IncludedPoolModelInput[]): IncludedPoolItem[] {
  return models.map((model) => ({
    key: model.id,
    label: model.name,
    provider: model.provider,
    poolLabel: 'Included in all plans',
  }));
}

function formatTokens(value: number): string {
  return `${formatNumber(value)} tokens`;
}
