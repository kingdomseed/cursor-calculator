import type { Audience, OtherModelsAllowanceStatus, PlanKey } from '../domain/catalog/types';
import { formatCurrency, formatNumber, formatRate } from '../domain/recommendation/formatters';
import type { Mode, PlanLineItem, PlanResult, Recommendation } from '../domain/recommendation/types';
import type { TokenSource } from './calculatorState';
import { buildModelGroups } from './modelGrouping';
import type { RecommendationModelGroup } from './modelGrouping';

export type { RecommendationModelGroup } from './modelGrouping';

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
  estimatedIncludedPoolAllowanceTokens: number | null;
  estimatedIncludedPoolOverageTokens: number;
  estimatedIncludedPoolOverageCost: number;
  totalOutOfPocket: number;
  budgetHeadroom: number | null;
  tokenYield: number;
}

export interface RecommendationModelDisplayRow {
  key: string;
  modelId: string;
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
  subscriptionNote?: string;
  includedPool: number | null;
  otherModelsAllowanceStatus?: OtherModelsAllowanceStatus;
  otherModelsAllowanceLabel?: string;
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

export interface GrokBotPresentation {
  heading: string;
  cadenceLabel: string;
  grantSummary: string;
  notes: string[];
}

export interface RecommendationPresentation {
  mode: Mode;
  tokenSource: TokenSource;
  audience: Audience;
  heading: string;
  hero: RecommendationHero;
  bestPlan: RecommendationPlanPresentation;
  plans: RecommendationPlanPresentation[];
  comparisonSections: RecommendationComparisonSection[];
  includedPoolItems: IncludedPoolItem[];
  grokBot: GrokBotPresentation;
  modelGroups: RecommendationModelGroup[] | null;
}

export interface IncludedPoolModelInput {
  id: string;
  name: string;
  provider: string;
}

interface BuildRecommendationPresentationInput {
  mode: Mode;
  tokenSource: TokenSource;
  audience?: Audience;
  budgetCeiling?: number;
  recommendation: Recommendation;
  includedPoolModels?: IncludedPoolModelInput[];
}

export function buildRecommendationPresentation({
  mode,
  tokenSource,
  audience = 'personal',
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
    audience,
    heading,
    hero: buildHero(bestPlan, heading, mode, budgetCeiling),
    bestPlan,
    plans,
    comparisonSections: buildComparisonSections(plans, mode, budgetCeiling, audience),
    includedPoolItems: buildIncludedPoolItems(includedPoolModels),
    grokBot: buildGrokBotPresentation(audience, bestPlan.plan),
    modelGroups: buildModelGroups(bestPlan.modelRows, tokenSource),
  };
}

function buildPlanPresentation(
  result: PlanResult,
  mode: Mode,
  budgetCeiling?: number,
): RecommendationPlanPresentation {
  const estimatedIncludedPoolAllowanceTokens = result.estimatedIncludedPoolAllowanceTokens ?? null;
  const estimatedIncludedPoolOverageTokens = result.estimatedIncludedPoolOverageTokens ?? 0;
  const estimatedIncludedPoolOverageCost = result.estimatedIncludedPoolOverageCost ?? 0;
  const usageValue = result.apiUsage + estimatedIncludedPoolOverageCost;
  const additionalApiBilled = result.overage;
  const includedPoolUsed = Math.max(0, result.apiUsage - additionalApiBilled);
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
    subscriptionNote: result.subscriptionNote,
    includedPool: result.apiPool,
    otherModelsAllowanceStatus: result.otherModelsAllowanceStatus,
    otherModelsAllowanceLabel: result.otherModelsAllowanceLabel,
    unusedPool: result.unusedPool,
    derived: {
      usageValue,
      includedPoolUsed,
      additionalApiBilled,
      estimatedIncludedPoolAllowanceTokens,
      estimatedIncludedPoolOverageTokens,
      estimatedIncludedPoolOverageCost,
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
    const poolPhrase = formatOtherModelsAllowance(plan);
    const context = budgetValue == null || headroom == null
      ? `${plan.planLabel} Other Models allowance: ${poolPhrase}.`
      : headroom >= 0
        ? `${plan.planLabel} stays ${formatCurrency(headroom)} under your ${formatCurrency(budgetValue)} budget. Other Models: ${poolPhrase}.`
        : `${plan.planLabel} exceeds your ${formatCurrency(budgetValue)} budget by ${formatCurrency(Math.abs(headroom))}. Other Models: ${poolPhrase}.`;

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
  const estimatedIncludedPoolAllowance = plan.derived.estimatedIncludedPoolAllowanceTokens;
  const estimatedIncludedPoolOverage = plan.derived.estimatedIncludedPoolOverageCost;
  const context = buildTokenModeContext(
    plan.planLabel,
    coveredByPlan,
    billedBeyondPool,
    estimatedIncludedPoolAllowance,
    estimatedIncludedPoolOverage,
  );

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
  audience: Audience = 'personal',
): RecommendationComparisonSection[] {
  const hasIncludedPoolEstimate = plans.some((plan) =>
    plan.derived.estimatedIncludedPoolAllowanceTokens != null,
  );
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

  const planCoverageRows: RecommendationComparisonRow[] = [
    createLabeledRow(
      plans,
      'includedPool',
      'Other Models allowance',
      (plan) => formatOtherModelsAllowance(plan),
      (plan) => plan.includedPool,
    ),
    createRow(plans, 'includedPoolUsed', 'Other Models used', (plan) => (
      plan.includedPool == null ? null : plan.derived.includedPoolUsed
    ), formatCurrency),
    createRow(plans, 'unusedPool', 'Unused Other Models floor', (plan) => (
      plan.includedPool == null ? null : plan.unusedPool
    ), formatCurrency),
  ];
  const outOfPocketRows: RecommendationComparisonRow[] = [
    createLabeledRow(
      plans,
      'subscription',
      'Subscription',
      (plan) => plan.subscriptionNote ?? formatCurrency(plan.subscription),
      (plan) => plan.subscription,
    ),
    createRow(plans, 'additionalApiBilled', 'Billed beyond last published floor', (plan) => (
      plan.includedPool == null ? null : plan.derived.additionalApiBilled
    ), formatCurrency),
  ];

  if (audience === 'teams_enterprise') {
    planCoverageRows.push(
      createLabeledRow(plans, 'cursorTokenRate', 'Cursor Token Rate', () => (
        '$0.25/M on third-party input, output, and cached tokens'
      )),
    );
  }

  if (hasIncludedPoolEstimate) {
    planCoverageRows.push(
      createRow(plans, 'estimatedFirstPartyPool', 'Estimated Composer 2.5-equivalent pool', (plan) => plan.derived.estimatedIncludedPoolAllowanceTokens, formatTokens),
      createRow(plans, 'estimatedFirstPartyOverageTokens', 'Estimated equivalent overage tokens', (plan) => (
        plan.derived.estimatedIncludedPoolAllowanceTokens == null
          ? null
          : plan.derived.estimatedIncludedPoolOverageTokens
      ), formatTokens),
    );
    outOfPocketRows.push(
      createRow(plans, 'estimatedFirstPartyOverage', 'Estimated first-party overage', (plan) => (
        plan.derived.estimatedIncludedPoolAllowanceTokens == null
          ? null
          : plan.derived.estimatedIncludedPoolOverageCost
      ), formatCurrency),
    );
  }

  outOfPocketRows.push(
    createRow(plans, 'totalOutOfPocket', 'Total out-of-pocket', (plan) => plan.derived.totalOutOfPocket, formatCurrency),
  );

  return [
    {
      kind: 'primary_answer',
      title: 'Primary answer',
      rows: primaryRows,
    },
    {
      kind: 'plan_coverage',
      title: 'Plan coverage',
      rows: planCoverageRows,
    },
    {
      kind: 'out_of_pocket_breakdown',
      title: 'Out-of-pocket breakdown',
      rows: outOfPocketRows,
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
    badges.push(item.cacheHitRate > 0 ? `Cache ${item.cacheHitRate}%` : 'Cache');
  }
  if (item.approximated) badges.push('Approx');
  if (item.sourceLabel) badges.push(item.sourceLabel);

  return {
    key: item.key,
    modelId: item.modelId,
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

function createLabeledRow(
  plans: RecommendationPlanPresentation[],
  key: string,
  label: string,
  getLabel: (plan: RecommendationPlanPresentation) => string,
  getValue?: (plan: RecommendationPlanPresentation) => number | null,
): RecommendationComparisonRow {
  return {
    key,
    label,
    values: plans.map((plan) => ({
      plan: plan.plan,
      planLabel: plan.planLabel,
      affordable: plan.affordable,
      value: getValue ? getValue(plan) : null,
      formattedValue: getLabel(plan),
    })),
  };
}

function formatOtherModelsAllowance(plan: RecommendationPlanPresentation): string {
  if (plan.otherModelsAllowanceLabel) {
    return plan.otherModelsAllowanceLabel;
  }
  if (plan.includedPool == null) {
    return 'Unpublished';
  }
  return formatCurrency(plan.includedPool);
}

function getHeading(mode: Mode, tokenSource: TokenSource): string {
  if (mode === 'budget') {
    return 'Best plan for your budget';
  }

  return tokenSource === 'cursor_import'
    ? 'Best plan for this imported month'
    : 'Best plan for this usage';
}

function buildTokenModeContext(
  planLabel: string,
  coveredByPlan: number,
  billedBeyondPool: number,
  estimatedIncludedPoolAllowance: number | null,
  estimatedIncludedPoolOverage: number,
): string {
  if (estimatedIncludedPoolAllowance != null && coveredByPlan === 0 && billedBeyondPool === 0) {
    if (estimatedIncludedPoolOverage > 0) {
      return `No API-priced usage is selected. The optional community preset adds ${formatCurrency(estimatedIncludedPoolOverage)} of estimated first-party pool overage.`;
    }

    return `No API-priced usage is selected. The selected plan estimate covers this first-party usage.`;
  }

  const officialContext = billedBeyondPool > 0
    ? `${planLabel} covers the first ${formatCurrency(coveredByPlan)} with its last published Other Models floor, leaving ${formatCurrency(billedBeyondPool)} billed beyond that floor.`
    : `${planLabel} covers the full ${formatCurrency(coveredByPlan)} usage value within its last published Other Models floor.`;

  if (estimatedIncludedPoolOverage <= 0) {
    return officialContext;
  }

  return `${officialContext} It also includes ${formatCurrency(estimatedIncludedPoolOverage)} of estimated first-party pool overage from the optional community preset.`;
}

export function formatPlanLabel(plan: PlanKey): string {
  switch (plan) {
    case 'hobby':
      return 'Hobby';
    case 'start':
      return 'Start';
    case 'pro':
      return 'Pro';
    case 'pro_plus':
      return 'Pro Plus';
    case 'ultra':
      return 'Ultra';
    case 'teams_standard':
      return 'Teams Standard';
    case 'teams_premium':
      return 'Teams Premium';
    case 'enterprise':
      return 'Enterprise';
    default: {
      const _exhaustive: never = plan;
      return _exhaustive;
    }
  }
}

function buildIncludedPoolItems(models: IncludedPoolModelInput[]): IncludedPoolItem[] {
  return models.map((model) => ({
    key: model.id,
    label: model.name,
    provider: model.provider,
    poolLabel: 'Cursor Models',
  }));
}

export function buildGrokBotPresentation(audience: Audience, plan: PlanKey): GrokBotPresentation {
  if (audience === 'teams_enterprise' && plan === 'enterprise') {
    return {
      heading: 'Grok Bot',
      cadenceLabel: 'Weekly',
      grantSummary: 'Ask your account executive about Grok Bot on Enterprise.',
      notes: grokBotNotes(),
    };
  }

  if (audience === 'teams_enterprise') {
    return {
      heading: 'Grok Bot',
      cadenceLabel: 'Weekly',
      grantSummary: 'You get Grok Bot usage on Teams. You do not need a Premium seat.',
      notes: grokBotNotes(),
    };
  }

  return {
    heading: 'Grok Bot',
    cadenceLabel: 'Weekly',
    grantSummary: 'You get Grok Bot usage on Pro, Pro Plus, and Ultra.',
    notes: grokBotNotes(),
  };
}

function grokBotNotes(): string[] {
  return [
    'Cursor does not publish how much you get each week.',
    'If you run out and on-demand is on, extra usage bills as Cursor on-demand.',
    'SuperGrok and X Premium+ do not add extra Grok Bot usage to your Cursor plan.',
  ];
}

function formatTokens(value: number): string {
  return `${formatNumber(value)} tokens`;
}
