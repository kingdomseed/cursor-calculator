import type { Model, Plan, PlanKey, PricingData } from '../catalog/types';
import { directBreakdownToDollars, dollarsToTokens, exactTokensToDollars, tokensToDollars } from './conversions';
import { computeBillableRates, computeEffectiveRates, effectiveRatesFromExactCost, effectiveRatesFromExactTokens } from './rates';
import type { Mode, ModelConfig, PlanLineItem, PlanResult, Recommendation, UsageLineItemInput } from './types';

const PLAN_KEYS: PlanKey[] = ['pro', 'pro_plus', 'ultra'];

export function computeRecommendation(
  mode: Mode,
  budget: number,
  totalTokens: number,
  models: Model[],
  configs: ModelConfig[],
  plans: PricingData['plans'],
  inputOutputRatio: number,
): Recommendation {
  const weightSum = configs.reduce((sum, config) => sum + config.weight, 0);
  const normalizedConfigs = weightSum > 0
    ? configs.map((config) => ({ ...config, weight: (config.weight / weightSum) * 100 }))
    : configs;

  const allResults = PLAN_KEYS.map((key) => {
    const plan = plans[key];
    const affordable = mode === 'budget' ? plan.monthly_cost <= budget : true;

    if (mode === 'budget') {
      return computeBudgetPlanResult(key, plan, budget, models, normalizedConfigs, inputOutputRatio, affordable);
    }

    return computeTokenPlanResult(key, plan, totalTokens, models, normalizedConfigs, inputOutputRatio);
  });

  return {
    best: pickBestPlanResult(allResults, mode),
    all: allResults,
  };
}

export function computeExactUsageRecommendation(
  usageItems: UsageLineItemInput[],
  models: Model[],
  plans: PricingData['plans'],
): Recommendation {
  const allResults = PLAN_KEYS.map((key) =>
    computeExactUsagePlanResult(key, plans[key], usageItems, models),
  );

  return {
    best: pickBestPlanResult(allResults, 'tokens'),
    all: allResults,
  };
}

function pickBestPlanResult(results: PlanResult[], mode: Mode): PlanResult {
  const affordableResults = results.filter((result) => result.affordable);
  if (affordableResults.length === 0) {
    return results[0];
  }

  if (mode === 'budget') {
    return affordableResults.reduce((left, right) => {
      const leftTokens = left.perModel.reduce((sum, item) => sum + item.tokens.total, 0);
      const rightTokens = right.perModel.reduce((sum, item) => sum + item.tokens.total, 0);

      if (leftTokens === rightTokens) {
        return left.apiPool > right.apiPool ? left : right;
      }

      return leftTokens > rightTokens ? left : right;
    });
  }

  return affordableResults.reduce((left, right) => {
    if (left.totalCost === right.totalCost) {
      return left.apiPool > right.apiPool ? left : right;
    }

    return left.totalCost < right.totalCost ? left : right;
  });
}

function computeBudgetPlanResult(
  key: PlanKey,
  plan: Plan,
  budget: number,
  models: Model[],
  configs: ModelConfig[],
  ratio: number,
  affordable: boolean,
): PlanResult {
  const apiBudget = Math.max(plan.api_pool, budget);

  const perModel = configs
    .map((config) => {
      const model = models.find((candidate) => candidate.id === config.modelId);
      if (!model) return null;

      const effectiveRates = computeEffectiveRates(model, config);
      const modelDollars = apiBudget * (config.weight / 100);
      const tokens = dollarsToTokens(modelDollars, effectiveRates, ratio);

      return buildPlanLineItem(
        {
          key: config.modelId,
          modelId: config.modelId,
          label: model.name,
          provider: model.provider,
          pool: model.pool,
          tokens,
          maxMode: config.maxMode,
          fast: config.fast,
          thinking: config.thinking,
          caching: config.caching,
          cacheHitRate: config.cacheHitRate,
          approximated: false,
        },
        effectiveRates,
        modelDollars,
      );
    })
    .filter((item): item is PlanLineItem => item !== null);

  const totalApiUsage = perModel.reduce((sum, item) => sum + item.apiCost, 0);
  const overage = Math.max(0, totalApiUsage - plan.api_pool);
  const unusedPool = Math.max(0, plan.api_pool - totalApiUsage);

  return {
    plan: key,
    subscription: plan.monthly_cost,
    apiPool: plan.api_pool,
    apiBudget,
    apiUsage: totalApiUsage,
    overage,
    unusedPool,
    totalCost: plan.monthly_cost + overage,
    affordable,
    perModel,
  };
}

function computeTokenPlanResult(
  key: PlanKey,
  plan: Plan,
  totalTokens: number,
  models: Model[],
  configs: ModelConfig[],
  ratio: number,
): PlanResult {
  const perModel = configs
    .map((config) => {
      const model = models.find((candidate) => candidate.id === config.modelId);
      if (!model) return null;

      const effectiveRates = computeEffectiveRates(model, config);
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
          maxMode: config.maxMode,
          fast: config.fast,
          thinking: config.thinking,
          caching: config.caching,
          cacheHitRate: config.cacheHitRate,
          approximated: false,
        },
        effectiveRates,
        apiCost,
      );
    })
    .filter((item): item is PlanLineItem => item !== null);

  const totalApiCost = perModel.reduce((sum, item) => sum + item.apiCost, 0);
  const overage = Math.max(0, totalApiCost - plan.api_pool);
  const unusedPool = Math.max(0, plan.api_pool - totalApiCost);

  return {
    plan: key,
    subscription: plan.monthly_cost,
    apiPool: plan.api_pool,
    apiBudget: plan.api_pool,
    apiUsage: totalApiCost,
    overage,
    unusedPool,
    totalCost: plan.monthly_cost + overage,
    affordable: true,
    perModel,
  };
}

function computeExactUsagePlanResult(
  key: PlanKey,
  plan: Plan,
  usageItems: UsageLineItemInput[],
  models: Model[],
): PlanResult {
  const perModel = usageItems
    .map((usage) => {
      if (usage.pool !== 'api') return null;

      const model = models.find((candidate) => candidate.id === usage.modelId);
      if (!model) return null;

      const config = createConfigFromUsage(usage);
      const billableRates = computeBillableRates(model, config);
      const effectiveRates = usage.exactCost
        ? effectiveRatesFromExactCost(usage.exactCost, usage.tokens, billableRates)
        : usage.exactTokens
          ? effectiveRatesFromExactTokens(usage.exactTokens, billableRates)
          : {
              input: billableRates.input,
              output: billableRates.output,
            };
      const apiCost = usage.exactCost
        ? usage.exactCost.total
        : usage.exactTokens
          ? exactTokensToDollars(usage.exactTokens, billableRates)
          : directBreakdownToDollars(usage.tokens, effectiveRates);

      return buildPlanLineItem(usage, effectiveRates, apiCost);
    })
    .filter((item): item is PlanLineItem => item !== null);

  const totalApiUsage = perModel.reduce((sum, item) => sum + item.apiCost, 0);
  const overage = Math.max(0, totalApiUsage - plan.api_pool);
  const unusedPool = Math.max(0, plan.api_pool - totalApiUsage);

  return {
    plan: key,
    subscription: plan.monthly_cost,
    apiPool: plan.api_pool,
    apiBudget: plan.api_pool,
    apiUsage: totalApiUsage,
    overage,
    unusedPool,
    totalCost: plan.monthly_cost + overage,
    affordable: true,
    perModel,
  };
}

function buildPlanLineItem(
  usage: UsageLineItemInput,
  effectiveRates: PlanLineItem['effectiveRates'],
  apiCost: number,
): PlanLineItem {
  return {
    ...usage,
    effectiveRates,
    apiCost,
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
