import type {
  EffectiveRates,
  ExactCostBreakdown,
  ExactTokenBreakdown,
  Mode,
  Model,
  ModelConfig,
  ModelRates,
  Plan,
  PlanKey,
  PlanLineItem,
  PlanResult,
  PricingData,
  Recommendation,
  TokenBreakdown,
  UsageLineItemInput,
} from './types';

// TODO: Spec says RE_READS should be configurable as an advanced option. For now hardcoded.
const DEFAULT_RE_READS = 3;

export function computeBillableRates(model: Model, config: ModelConfig): ModelRates {
  const rates: ModelRates = config.fast && model.variants?.fast
    ? { ...model.variants.fast.rates }
    : { ...model.rates };

  // Cursor Max Mode adds a flat upcharge in the current calculator.
  if (config.maxMode && model.variants?.max_mode) {
    const upcharge = 1 + model.variants.max_mode.cursor_upcharge;
    rates.input *= upcharge;
    rates.output *= upcharge;
    if (rates.cache_write !== null) rates.cache_write *= upcharge;
    if (rates.cache_read !== null) rates.cache_read *= upcharge;
  }

  return rates;
}

export function computeEffectiveRates(model: Model, config: ModelConfig, reReads = DEFAULT_RE_READS): EffectiveRates {
  const rates = computeBillableRates(model, config);
  return {
    input: applyCaching(rates.input, rates.cache_write, rates.cache_read, config, reReads),
    output: rates.output,
  };
}

function applyCaching(
  inputRate: number,
  cacheWrite: number | null,
  cacheRead: number | null,
  config: ModelConfig,
  reReads: number = DEFAULT_RE_READS,
): number {
  if (!config.caching || config.cacheHitRate <= 0 || !cacheRead) {
    return inputRate;
  }

  const cachedRatio = config.cacheHitRate / 100;
  const uncachedRatio = 1 - cachedRatio;

  if (cacheWrite) {
    // Anthropic: cache_write + cache_read with RE_READS amortization
    return (
      cachedRatio * cacheWrite +
      cachedRatio * cacheRead * reReads +
      uncachedRatio * inputRate * reReads
    ) / reReads;
  }

  // Non-Anthropic: simple blend of cache_read and input rate
  return cachedRatio * cacheRead + uncachedRatio * inputRate;
}

export function exactTokensToDollars(tokens: ExactTokenBreakdown, rates: ModelRates): number {
  const cacheWriteRate = rates.cache_write ?? rates.input;
  const cacheReadRate = rates.cache_read ?? rates.input;

  return (
    (tokens.inputWithCacheWrite / 1_000_000) * cacheWriteRate +
    (tokens.inputWithoutCacheWrite / 1_000_000) * rates.input +
    (tokens.cacheRead / 1_000_000) * cacheReadRate +
    (tokens.output / 1_000_000) * rates.output
  );
}

export function computeRecommendation(
  mode: Mode,
  budget: number,
  totalTokens: number,
  models: Model[],
  configs: ModelConfig[],
  plans: PricingData['plans'],
  inputOutputRatio: number,
): Recommendation {
  const planKeys: PlanKey[] = ['pro', 'pro_plus', 'ultra'];

  const weightSum = configs.reduce((sum, c) => sum + c.weight, 0);
  const normalizedConfigs = weightSum > 0
    ? configs.map(c => ({ ...c, weight: c.weight / weightSum * 100 }))
    : configs;

  const allResults: PlanResult[] = planKeys.map(key => {
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
  const planKeys: PlanKey[] = ['pro', 'pro_plus', 'ultra'];
  const allResults = planKeys.map((key) =>
    computeExactUsagePlanResult(key, plans[key], usageItems, models)
  );

  return {
    best: pickBestPlanResult(allResults, 'tokens'),
    all: allResults,
  };
}

function pickBestPlanResult(results: PlanResult[], mode: Mode): PlanResult {
  const affordableResults = results.filter(r => r.affordable);
  if (affordableResults.length === 0) {
    return results[0];
  }

  if (mode === 'budget') {
    return affordableResults.reduce((a, b) => {
      const aTokens = a.perModel.reduce((sum, item) => sum + item.tokens.total, 0);
      const bTokens = b.perModel.reduce((sum, item) => sum + item.tokens.total, 0);
      if (aTokens === bTokens) return a.apiPool > b.apiPool ? a : b;
      return aTokens > bTokens ? a : b;
    });
  }

  return affordableResults.reduce((a, b) => {
    if (a.totalCost === b.totalCost) return a.apiPool > b.apiPool ? a : b;
    return a.totalCost < b.totalCost ? a : b;
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
  // Even if the plan isn't affordable, show what you'd get at its subscription cost
  // so the comparison table is useful. The greyed-out styling signals it's over budget.
  const apiBudget = plan.api_pool + Math.max(0, budget - plan.monthly_cost);

  const perModel = configs
    .map((config) => {
      const model = models.find(m => m.id === config.modelId);
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
      const model = models.find(m => m.id === config.modelId);
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
  effectiveRates: EffectiveRates,
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

function effectiveRatesFromExactTokens(tokens: ExactTokenBreakdown, rates: ModelRates): EffectiveRates {
  const cacheWriteRate = rates.cache_write ?? rates.input;
  const cacheReadRate = rates.cache_read ?? rates.input;
  const totalInputTokens =
    tokens.inputWithCacheWrite +
    tokens.inputWithoutCacheWrite +
    tokens.cacheRead;

  if (totalInputTokens <= 0) {
    return { input: rates.input, output: rates.output };
  }

  const inputCost = (
    (tokens.inputWithCacheWrite / 1_000_000) * cacheWriteRate +
    (tokens.inputWithoutCacheWrite / 1_000_000) * rates.input +
    (tokens.cacheRead / 1_000_000) * cacheReadRate
  );

  return {
    input: inputCost * 1_000_000 / totalInputTokens,
    output: rates.output,
  };
}

function effectiveRatesFromExactCost(
  costs: ExactCostBreakdown,
  tokens: TokenBreakdown,
  fallbackRates: ModelRates,
): EffectiveRates {
  return {
    input: tokens.input > 0 ? (costs.input * 1_000_000) / tokens.input : fallbackRates.input,
    output: tokens.output > 0 ? (costs.output * 1_000_000) / tokens.output : fallbackRates.output,
  };
}

function directBreakdownToDollars(tokens: TokenBreakdown, rates: EffectiveRates): number {
  return (
    (tokens.input / 1_000_000) * rates.input +
    (tokens.output / 1_000_000) * rates.output
  );
}

export function dollarsToTokens(dollars: number, rates: EffectiveRates, ratio: number): TokenBreakdown {
  const costPerCycle = (ratio * rates.input + rates.output) / 1_000_000;
  if (costPerCycle <= 0) return { total: 0, input: 0, output: 0 };

  const cycles = dollars / costPerCycle;
  const total = Math.round(cycles * (ratio + 1));
  const input = Math.round(total * ratio / (ratio + 1));
  const output = total - input;

  return { total, input, output };
}

export function tokensToDollars(tokens: number, rates: EffectiveRates, ratio: number): number {
  const weightInput = ratio / (ratio + 1);
  const inputTokens = tokens * weightInput;
  const outputTokens = tokens - inputTokens;
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(Math.round(num));
}

export function formatCurrency(num: number): string {
  return `$${num.toFixed(2)}`;
}

export function formatRate(rate: number): string {
  return `$${rate.toFixed(2)}`;
}
