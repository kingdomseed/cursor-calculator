import type { Audience, Model, Plan, PlanKey, PricingData } from '../catalog/types';
import { filterPlanKeys, isCursorModelsPool, isOtherModelsPool, isPlanRecommendable, treatsOtherModelsFloorAsUncertain } from '../catalog/pools';
import { dollarsToExactTokens } from './budgetUsage';
import { directBreakdownToDollars, exactTokensToDollars, tokensToDollars } from './conversions';
import { computeBillableRates, computeEffectiveRates, countLongContextInputTokens, effectiveRatesFromExactCost, effectiveRatesFromExactTokens, getPoolUsageAllowanceMultiplier } from './rates';
import type {
  IncludedPoolEstimateConfig,
  Mode,
  ModelConfig,
  PlanLineItem,
  PlanResult,
  Recommendation,
  RecommendationOptions,
  TokenBreakdown,
  UsageLineItemInput,
} from './types';

export function computeRecommendation(
  mode: Mode,
  budget: number,
  totalTokens: number,
  models: Model[],
  configs: ModelConfig[],
  plans: Partial<PricingData['plans']>,
  inputOutputRatio: number,
  cacheReadShare: number = 0,
  options: RecommendationOptions = {},
): Recommendation {
  const weightSum = configs.reduce((sum, config) => sum + config.weight, 0);
  const normalizedConfigs = weightSum > 0
    ? configs.map((config) => ({ ...config, weight: (config.weight / weightSum) * 100 }))
    : configs;
  const audience = options.audience ?? 'personal';

  const allResults = filterPlanKeys(plans, audience).map((key) => {
    const plan = plans[key];
    if (!plan) {
      throw new Error(`Missing plan "${key}"`);
    }
    const monthlyCost = plan.monthly_cost;
    const affordable = mode === 'budget'
      ? monthlyCost != null && monthlyCost <= budget
      : true;

    if (mode === 'budget') {
      return computeBudgetPlanResult(
        key,
        plan,
        budget,
        models,
        normalizedConfigs,
        inputOutputRatio,
        affordable,
        cacheReadShare,
        audience,
      );
    }

    return computeTokenPlanResult(key, plan, totalTokens, models, normalizedConfigs, inputOutputRatio, audience);
  });

  return {
    best: pickBestPlanResult(allResults, mode),
    all: allResults,
  };
}

export function computeExactUsageRecommendation(
  usageItems: UsageLineItemInput[],
  models: Model[],
  plans: Partial<PricingData['plans']>,
  includedPoolEstimate?: IncludedPoolEstimateConfig,
  options: RecommendationOptions = {},
): Recommendation {
  const audience = options.audience ?? 'personal';
  const allResults = filterPlanKeys(plans, audience).map((key) => {
    const plan = plans[key];
    if (!plan) {
      throw new Error(`Missing plan "${key}"`);
    }
    return computeExactUsagePlanResult(key, plan, usageItems, models, includedPoolEstimate, {
      ...options,
      audience,
    });
  });

  return {
    best: pickBestPlanResult(allResults, 'tokens'),
    all: allResults,
  };
}

function pickBestPlanResult(results: PlanResult[], mode: Mode): PlanResult {
  const comparableResults = results.filter((result) => result.recommendable !== false && result.affordable);
  const fallbackResults = comparableResults.length > 0
    ? comparableResults
    : results.filter((result) => result.recommendable !== false);
  if (fallbackResults.length === 0) {
    return results[0];
  }

  if (mode === 'budget') {
    return fallbackResults.reduce((left, right) => {
      const leftTokens = left.perModel.reduce((sum, item) => sum + item.tokens.total, 0);
      const rightTokens = right.perModel.reduce((sum, item) => sum + item.tokens.total, 0);

      if (leftTokens === rightTokens) {
        return pickLowerCertainCost(left, right);
      }

      return leftTokens > rightTokens ? left : right;
    });
  }

  return fallbackResults.reduce((left, right) => pickLowerCertainCost(left, right));
}

function pickLowerCertainCost(left: PlanResult, right: PlanResult): PlanResult {
  if (left.totalCost === right.totalCost) {
    return left.subscription <= right.subscription ? left : right;
  }

  return left.totalCost < right.totalCost ? left : right;
}

function grok47ConfigForPlan(planKey: PlanKey, model: Model, config: ModelConfig): ModelConfig {
  if (model.id !== 'grok-4.7' || !config.fast) {
    return config;
  }

  switch (planKey) {
    case 'pro':
    case 'pro_plus':
    case 'ultra':
    case 'teams_standard':
    case 'teams_premium':
    case 'enterprise':
      return config;
    case 'hobby':
    case 'start':
      return { ...config, fast: false };
    default: {
      const exhaustivePlan: never = planKey;
      return exhaustivePlan;
    }
  }
}

function computeBudgetPlanResult(
  key: PlanKey,
  plan: Plan,
  budget: number,
  models: Model[],
  configs: ModelConfig[],
  ratio: number,
  affordable: boolean,
  cacheReadShare: number = 0,
  audience?: Audience,
): PlanResult {
  const includedPool = plan.api_pool;
  const subscriptionCost = plan.monthly_cost ?? 0;
  const apiBudget = treatsOtherModelsFloorAsUncertain(plan)
    ? Math.max(0, budget - subscriptionCost)
    : includedPool == null
      ? budget
      : Math.max(includedPool, budget);

  const perModel = configs
    .map((config) => {
      const model = models.find((candidate) => candidate.id === config.modelId);
      if (!model) return null;

      const planConfig = grok47ConfigForPlan(key, model, config);
      const billableRates = computeBillableRates(model, planConfig, new Date(), audience);
      const modelDollars = apiBudget * (config.weight / 100);
      const modelCacheShare = Math.min(100, Math.max(0, config.caching ? config.cacheHitRate : cacheReadShare));
      const exactTokens = dollarsToExactTokens(modelDollars, billableRates, modelCacheShare, ratio);
      const apiCost = exactTokensToDollars(exactTokens, billableRates);
      const tokens: TokenBreakdown = {
        total: exactTokens.total,
        input: exactTokens.inputWithCacheWrite + exactTokens.inputWithoutCacheWrite + exactTokens.cacheRead,
        output: exactTokens.output,
      };

      const effectiveRates = effectiveRatesFromExactTokens(exactTokens, billableRates);

      return buildPlanLineItem(
        {
          key: config.modelId,
          modelId: config.modelId,
          label: model.name,
          provider: model.provider,
          pool: model.pool,
          tokens,
          exactTokens,
          maxMode: planConfig.maxMode,
          fast: planConfig.fast,
          thinking: planConfig.thinking,
          caching: modelCacheShare > 0,
          cacheHitRate: modelCacheShare,
          approximated: false,
        },
        effectiveRates,
        apiCost,
      );
    })
    .filter((item): item is PlanLineItem => item !== null);

  return finishPlanResult(key, plan, perModel, apiBudget, affordable, audience);
}

function computeTokenPlanResult(
  key: PlanKey,
  plan: Plan,
  totalTokens: number,
  models: Model[],
  configs: ModelConfig[],
  ratio: number,
  audience?: Audience,
): PlanResult {
  const perModel = configs
    .map((config) => {
      const model = models.find((candidate) => candidate.id === config.modelId);
      if (!model) return null;

      const planConfig = grok47ConfigForPlan(key, model, config);
      const effectiveRates = computeEffectiveRates(model, planConfig, undefined, audience);
      const modelTokens = Math.floor(totalTokens * (config.weight / 100));
      const apiCost = tokensToDollars(modelTokens, effectiveRates, ratio);
      const weightInput = ratio / (ratio + 1);
      const inputTokens = Math.floor(modelTokens * weightInput);
      const outputTokens = modelTokens - inputTokens;

      return buildPlanLineItem(
        {
          key: config.modelId,
          modelId: config.modelId,
          label: model.name,
          provider: model.provider,
          pool: model.pool,
          tokens: { total: modelTokens, input: inputTokens, output: outputTokens },
          maxMode: planConfig.maxMode,
          fast: planConfig.fast,
          thinking: planConfig.thinking,
          caching: planConfig.caching,
          cacheHitRate: planConfig.cacheHitRate,
          approximated: false,
        },
        effectiveRates,
        apiCost,
      );
    })
    .filter((item): item is PlanLineItem => item !== null);

  return finishPlanResult(key, plan, perModel, plan.api_pool ?? 0, true, audience);
}

function withGrok47PlanFast(
  planKey: PlanKey,
  model: Model,
  usage: UsageLineItemInput,
): UsageLineItemInput {
  const adjusted = grok47ConfigForPlan(planKey, model, createConfigFromUsage(usage));
  if (adjusted.fast === usage.fast) {
    return usage;
  }

  return { ...usage, fast: adjusted.fast };
}

function computeExactUsagePlanResult(
  key: PlanKey,
  plan: Plan,
  usageItems: UsageLineItemInput[],
  models: Model[],
  includedPoolEstimate?: IncludedPoolEstimateConfig,
  options: RecommendationOptions = {},
): PlanResult {
  const audience = options.audience;
  const referenceModel = includedPoolEstimate
    ? models.find((model) => model.id === includedPoolEstimate.referenceModelId)
    : undefined;
  const includedPoolAllowance = referenceModel
    ? includedPoolEstimate?.equivalentTokenAllowances[key] ?? null
    : null;
  const pricedUsageItems = usageItems.flatMap((usage) => {
    const model = models.find((candidate) => candidate.id === usage.modelId);
    if (!model) return [];

    const planUsage = options.applyPlanFastDefaults
      ? withGrok47PlanFast(key, model, usage)
      : usage;
    const inputTokens = options.priceLongContextFromInput && planUsage.exactTokens
      ? countLongContextInputTokens(planUsage.exactTokens)
      : undefined;
    const pricing = priceUsageItem(planUsage, model, audience, inputTokens);
    if (!isCursorModelsPool(planUsage.pool) || !referenceModel) {
      return [{ usage: planUsage, ...pricing, equivalentTokens: planUsage.tokens.total }];
    }

    const referenceUsage = {
      ...planUsage,
      modelId: referenceModel.id,
      fast: false,
      maxMode: false,
      exactCost: undefined,
    };
    const referencePricing = priceUsageItem(
      referenceUsage,
      referenceModel,
      audience,
      options.priceLongContextFromInput && referenceUsage.exactTokens
        ? countLongContextInputTokens(referenceUsage.exactTokens)
        : undefined,
    );
    const allowanceMultiplier = getPoolUsageAllowanceMultiplier(
      model,
      includedPoolEstimate?.asOf,
    );
    const equivalentTokens = referencePricing.apiCost > 0
      ? planUsage.tokens.total * (pricing.apiCost / referencePricing.apiCost) / allowanceMultiplier
      : 0;

    return [{ usage: planUsage, ...pricing, equivalentTokens }];
  });
  const includedPoolTokens = pricedUsageItems.reduce(
    (sum, item) => isCursorModelsPool(item.usage.pool) ? sum + item.equivalentTokens : sum,
    0,
  );
  const includedPoolOverageTokens = includedPoolAllowance == null
    ? 0
    : Math.max(0, includedPoolTokens - includedPoolAllowance);
  const includedPoolOverageShare = includedPoolTokens > 0
    ? includedPoolOverageTokens / includedPoolTokens
    : 0;

  const perModel = pricedUsageItems
    .map(({ usage, effectiveRates, apiCost }) => {
      if (!isOtherModelsPool(usage.pool) && (!isCursorModelsPool(usage.pool) || !includedPoolEstimate)) {
        return null;
      }

      if (isCursorModelsPool(usage.pool) && includedPoolEstimate) {
        return buildPlanLineItem(
          {
            ...usage,
            approximated: true,
            sourceLabel: includedPoolEstimate.sourceLabel,
          },
          effectiveRates,
          apiCost * includedPoolOverageShare,
          usage.tokens.total * includedPoolOverageShare,
        );
      }

      return buildPlanLineItem(usage, effectiveRates, apiCost);
    })
    .filter((item): item is PlanLineItem => item !== null);

  const totalApiUsage = perModel.reduce(
    (sum, item) => isOtherModelsPool(item.pool) ? sum + item.apiCost : sum,
    0,
  );
  const includedPoolOverageCost = perModel.reduce(
    (sum, item) => isCursorModelsPool(item.pool) ? sum + item.apiCost : sum,
    0,
  );
  const finished = finishPlanResult(key, plan, perModel, plan.api_pool ?? 0, true, audience, {
    apiUsage: totalApiUsage,
    estimatedIncludedPoolAllowanceTokens: includedPoolAllowance,
    estimatedIncludedPoolOverageTokens: includedPoolOverageTokens,
    estimatedIncludedPoolOverageCost: includedPoolOverageCost,
  });

  return {
    ...finished,
    totalCost: finished.totalCost + includedPoolOverageCost,
  };
}

function finishPlanResult(
  key: PlanKey,
  plan: Plan,
  perModel: PlanLineItem[],
  apiBudget: number,
  affordable: boolean,
  audience?: Audience,
  overrides: Partial<PlanResult> = {},
): PlanResult {
  const totalApiUsage = overrides.apiUsage ?? perModel.reduce((sum, item) => sum + item.apiCost, 0);
  const includedPool = plan.api_pool;
  const overage = includedPool == null ? 0 : Math.max(0, totalApiUsage - includedPool);
  const unusedPool = includedPool == null ? 0 : Math.max(0, includedPool - totalApiUsage);
  const subscription = plan.monthly_cost ?? 0;
  const totalCost = treatsOtherModelsFloorAsUncertain(plan)
    ? subscription + totalApiUsage
    : subscription + overage;

  return {
    plan: key,
    subscription,
    ...(plan.monthly_cost_note ? { subscriptionNote: plan.monthly_cost_note } : {}),
    apiPool: includedPool,
    otherModelsAllowanceStatus: plan.other_models_allowance_status,
    otherModelsAllowanceLabel: plan.other_models_allowance_label,
    apiBudget,
    apiUsage: totalApiUsage,
    estimatedIncludedPoolAllowanceTokens: overrides.estimatedIncludedPoolAllowanceTokens ?? null,
    estimatedIncludedPoolOverageTokens: overrides.estimatedIncludedPoolOverageTokens ?? 0,
    estimatedIncludedPoolOverageCost: overrides.estimatedIncludedPoolOverageCost ?? 0,
    overage,
    unusedPool,
    totalCost,
    affordable,
    recommendable: isPlanRecommendable(plan),
    cursorTokenRateApplied: audience === 'teams_enterprise',
    perModel,
  };
}

function priceUsageItem(
  usage: UsageLineItemInput,
  model: Model,
  audience?: Audience,
  inputTokens?: number,
): Pick<PlanLineItem, 'effectiveRates' | 'apiCost'> {
  if (usage.exactCost) {
    return {
      effectiveRates: effectiveRatesFromExactCost(usage.exactCost, usage.tokens, model.rates),
      apiCost: usage.exactCost.total,
    };
  }

  const config = createConfigFromUsage(usage);
  const billableRates = computeBillableRates(model, config, new Date(), audience, inputTokens);
  const effectiveRates = usage.exactTokens
      ? effectiveRatesFromExactTokens(usage.exactTokens, billableRates)
      : {
          input: billableRates.input,
          output: billableRates.output,
        };
  const apiCost = usage.exactTokens
      ? exactTokensToDollars(usage.exactTokens, billableRates)
      : directBreakdownToDollars(usage.tokens, effectiveRates);

  return { effectiveRates, apiCost };
}

function buildPlanLineItem(
  usage: UsageLineItemInput,
  effectiveRates: PlanLineItem['effectiveRates'],
  apiCost: number,
  estimatedIncludedPoolOverageTokens?: number,
): PlanLineItem {
  return {
    ...usage,
    effectiveRates,
    apiCost,
    ...(estimatedIncludedPoolOverageTokens !== undefined ? { estimatedIncludedPoolOverageTokens } : {}),
  };
}

function createConfigFromUsage(usage: UsageLineItemInput): ModelConfig {
  return {
    modelId: usage.modelId,
    weight: 100,
    maxMode: usage.maxMode,
    fast: usage.fast,
    thinking: usage.thinking,
    caching: usage.caching,
    cacheHitRate: usage.cacheHitRate,
  };
}
