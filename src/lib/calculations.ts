import type {
  Model, ModelConfig, EffectiveRates, TokenBreakdown,
  PlanKey, Plan, PlanResult, Recommendation, PricingData, Mode,
} from './types';

// TODO: Spec says RE_READS should be configurable as an advanced option. For now hardcoded.
const DEFAULT_RE_READS = 3;

export function computeEffectiveRates(model: Model, config: ModelConfig, reReads = DEFAULT_RE_READS): EffectiveRates {
  // Layer 1: Fast mode replaces base rates entirely, skips Max Mode
  if (config.fast && model.variants?.fast) {
    const fastRates = model.variants.fast.rates;
    return {
      input: applyCaching(fastRates.input, fastRates.cache_write, fastRates.cache_read, config),
      output: fastRates.output,
    };
  }

  let inputRate = model.rates.input;
  let outputRate = model.rates.output;

  // Layer 2: Cursor Max Mode upcharge
  if (config.maxMode && model.variants?.max_mode) {
    const upcharge = 1 + model.variants.max_mode.cursor_upcharge;
    inputRate *= upcharge;
    outputRate *= upcharge;

    // Layer 3: Long context multipliers (always applied with Max Mode)
    inputRate *= model.variants.max_mode.long_context_input_multiplier;
    outputRate *= model.variants.max_mode.long_context_output_multiplier;
  }

  // Layer 4: Caching blend (affects input only)
  // When Max Mode is active, cache rates must also be scaled by upcharge + long context,
  // because Cursor's upcharge applies to all API usage and provider long-context pricing
  // applies to all token operations including cache reads/writes.
  let cacheWrite = model.rates.cache_write;
  let cacheRead = model.rates.cache_read;
  if (config.maxMode && model.variants?.max_mode) {
    const upcharge = 1 + model.variants.max_mode.cursor_upcharge;
    const lcInput = model.variants.max_mode.long_context_input_multiplier;
    if (cacheWrite !== null) cacheWrite = cacheWrite * upcharge * lcInput;
    if (cacheRead !== null) cacheRead = cacheRead * upcharge * lcInput;
  }
  inputRate = applyCaching(inputRate, cacheWrite, cacheRead, config, reReads);

  return { input: inputRate, output: outputRate };
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
    } else {
      return computeTokenPlanResult(key, plan, totalTokens, models, normalizedConfigs, inputOutputRatio);
    }
  });

  const affordableResults = allResults.filter(r => r.affordable);
  let best: PlanResult;

  if (affordableResults.length === 0) {
    best = allResults[0];
  } else if (mode === 'budget') {
    best = affordableResults.reduce((a, b) => {
      const aTokens = a.perModel.reduce((s, m) => s + m.tokens.total, 0);
      const bTokens = b.perModel.reduce((s, m) => s + m.tokens.total, 0);
      if (aTokens === bTokens) return a.apiPool > b.apiPool ? a : b;
      return aTokens > bTokens ? a : b;
    });
  } else {
    best = affordableResults.reduce((a, b) => {
      if (a.totalCost === b.totalCost) return a.apiPool > b.apiPool ? a : b;
      return a.totalCost < b.totalCost ? a : b;
    });
  }

  return { best, all: allResults };
}

function computeBudgetPlanResult(
  key: PlanKey, plan: Plan, budget: number, models: Model[],
  configs: ModelConfig[], ratio: number, affordable: boolean,
): PlanResult {
  const apiBudget = affordable ? plan.api_pool + (budget - plan.monthly_cost) : 0;

  const validConfigs = configs.filter(c => models.some(m => m.id === c.modelId));
  const perModel = validConfigs.map(config => {
    const model = models.find(m => m.id === config.modelId)!;
    const effectiveRates = computeEffectiveRates(model, config);
    const modelDollars = apiBudget * (config.weight / 100);
    const tokens = dollarsToTokens(modelDollars, effectiveRates, ratio);
    return { modelId: config.modelId, tokens, effectiveRates, apiCost: modelDollars };
  });

  const totalApiUsage = perModel.reduce((s, m) => s + m.apiCost, 0);
  const overage = Math.max(0, totalApiUsage - plan.api_pool);
  const unusedPool = Math.max(0, plan.api_pool - totalApiUsage);

  return {
    plan: key, subscription: plan.monthly_cost, apiPool: plan.api_pool,
    apiBudget, apiUsage: totalApiUsage, overage, unusedPool,
    totalCost: plan.monthly_cost + overage, affordable, perModel,
  };
}

function computeTokenPlanResult(
  key: PlanKey, plan: Plan, totalTokens: number, models: Model[],
  configs: ModelConfig[], ratio: number,
): PlanResult {
  const validConfigs = configs.filter(c => models.some(m => m.id === c.modelId));
  const perModel = validConfigs.map(config => {
    const model = models.find(m => m.id === config.modelId)!;
    const effectiveRates = computeEffectiveRates(model, config);
    const modelTokens = Math.floor(totalTokens * (config.weight / 100));
    const apiCost = tokensToDollars(modelTokens, effectiveRates, ratio);
    const weightInput = ratio / (ratio + 1);
    const inputTokens = Math.floor(modelTokens * weightInput);
    const outputTokens = modelTokens - inputTokens;
    return {
      modelId: config.modelId,
      tokens: { total: modelTokens, input: inputTokens, output: outputTokens },
      effectiveRates, apiCost,
    };
  });

  const totalApiCost = perModel.reduce((s, m) => s + m.apiCost, 0);
  const overage = Math.max(0, totalApiCost - plan.api_pool);
  const unusedPool = Math.max(0, plan.api_pool - totalApiCost);

  return {
    plan: key, subscription: plan.monthly_cost, apiPool: plan.api_pool,
    apiBudget: plan.api_pool, apiUsage: totalApiCost, overage, unusedPool,
    totalCost: plan.monthly_cost + overage, affordable: true, perModel,
  };
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

