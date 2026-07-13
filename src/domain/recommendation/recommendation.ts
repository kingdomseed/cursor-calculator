import type { Model, Plan, PlanKey, PricingData } from '../catalog/types';
import { dollarsToExactTokens } from './budgetUsage';
import { directBreakdownToDollars, exactTokensToDollars, tokensToDollars } from './conversions';
import { computeBillableRates, computeEffectiveRates, effectiveRatesFromExactCost, effectiveRatesFromExactTokens, getPoolUsageAllowanceMultiplier } from './rates';
import type {
  IncludedPoolEstimateConfig,
  Mode,
  ModelConfig,
  PlanLineItem,
  PlanResult,
  Recommendation,
  TokenBreakdown,
  UsageLineItemInput,
} from './types';

const PLAN_KEYS: PlanKey[] = ['pro', 'pro_plus', 'ultra'];

export function computeRecommendation(
  mode: Mode,
  budget: number,
  totalTokens: number,
  models: Model[],
  configs: ModelConfig[],
  plans: PricingData['plans'],
  inputOutputRatio: number,
  cacheReadShare: number = 0,
): Recommendation {
  const weightSum = configs.reduce((sum, config) => sum + config.weight, 0);
  const normalizedConfigs = weightSum > 0
    ? configs.map((config) => ({ ...config, weight: (config.weight / weightSum) * 100 }))
    : configs;

  const allResults = PLAN_KEYS.map((key) => {
    const plan = plans[key];
    const affordable = mode === 'budget' ? plan.monthly_cost <= budget : true;

    if (mode === 'budget') {
      return computeBudgetPlanResult(key, plan, budget, models, normalizedConfigs, inputOutputRatio, affordable, cacheReadShare);
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
  includedPoolEstimate?: IncludedPoolEstimateConfig,
): Recommendation {
  const allResults = PLAN_KEYS.map((key) =>
    computeExactUsagePlanResult(key, plans[key], usageItems, models, includedPoolEstimate),
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
  cacheReadShare: number = 0,
): PlanResult {
  const apiBudget = Math.max(plan.api_pool, budget);

  const perModel = configs
    .map((config) => {
      const model = models.find((candidate) => candidate.id === config.modelId);
      if (!model) return null;

      const billableRates = computeBillableRates(model, config);
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
          maxMode: config.maxMode,
          fast: config.fast,
          thinking: config.thinking,
          caching: modelCacheShare > 0,
          cacheHitRate: modelCacheShare,
          approximated: false,
        },
        effectiveRates,
        apiCost,
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
    estimatedIncludedPoolAllowanceTokens: null,
    estimatedIncludedPoolOverageTokens: 0,
    estimatedIncludedPoolOverageCost: 0,
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
    estimatedIncludedPoolAllowanceTokens: null,
    estimatedIncludedPoolOverageTokens: 0,
    estimatedIncludedPoolOverageCost: 0,
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
  includedPoolEstimate?: IncludedPoolEstimateConfig,
): PlanResult {
  const referenceModel = includedPoolEstimate
    ? models.find((model) => model.id === includedPoolEstimate.referenceModelId)
    : undefined;
  const includedPoolAllowance = referenceModel
    ? includedPoolEstimate?.equivalentTokenAllowances[key] ?? null
    : null;
  const pricedUsageItems = usageItems.flatMap((usage) => {
    const model = models.find((candidate) => candidate.id === usage.modelId);
    if (!model) return [];

    const pricing = priceUsageItem(usage, model);
    if (usage.pool !== 'first_party' || !referenceModel) {
      return [{ usage, ...pricing, equivalentTokens: usage.tokens.total }];
    }

    const referencePricing = priceUsageItem(
      {
        ...usage,
        modelId: referenceModel.id,
        fast: false,
        maxMode: false,
        exactCost: undefined,
      },
      referenceModel,
    );
    const allowanceMultiplier = getPoolUsageAllowanceMultiplier(
      model,
      includedPoolEstimate?.asOf,
    );
    const equivalentTokens = referencePricing.apiCost > 0
      ? usage.tokens.total * (pricing.apiCost / referencePricing.apiCost) / allowanceMultiplier
      : 0;

    return [{ usage, ...pricing, equivalentTokens }];
  });
  const includedPoolTokens = pricedUsageItems.reduce(
    (sum, item) => item.usage.pool === 'first_party' ? sum + item.equivalentTokens : sum,
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
      if (usage.pool !== 'api' && (usage.pool !== 'first_party' || !includedPoolEstimate)) {
        return null;
      }

      if (usage.pool === 'first_party' && includedPoolEstimate) {
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
    (sum, item) => item.pool === 'api' ? sum + item.apiCost : sum,
    0,
  );
  const includedPoolOverageCost = perModel.reduce(
    (sum, item) => item.pool === 'first_party' ? sum + item.apiCost : sum,
    0,
  );
  const overage = Math.max(0, totalApiUsage - plan.api_pool);
  const unusedPool = Math.max(0, plan.api_pool - totalApiUsage);

  return {
    plan: key,
    subscription: plan.monthly_cost,
    apiPool: plan.api_pool,
    apiBudget: plan.api_pool,
    apiUsage: totalApiUsage,
    estimatedIncludedPoolAllowanceTokens: includedPoolAllowance,
    estimatedIncludedPoolOverageTokens: includedPoolOverageTokens,
    estimatedIncludedPoolOverageCost: includedPoolOverageCost,
    overage,
    unusedPool,
    totalCost: plan.monthly_cost + overage + includedPoolOverageCost,
    affordable: true,
    perModel,
  };
}

function priceUsageItem(
  usage: UsageLineItemInput,
  model: Model,
): Pick<PlanLineItem, 'effectiveRates' | 'apiCost'> {
  if (usage.exactCost) {
    return {
      effectiveRates: effectiveRatesFromExactCost(usage.exactCost, usage.tokens, model.rates),
      apiCost: usage.exactCost.total,
    };
  }

  const config = createConfigFromUsage(usage);
  const billableRates = computeBillableRates(model, config);
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
