import type { Model, ModelRates, ModelVariants, Plan, PlanKey, PricingData } from './types';

function cloneRates(rates: ModelRates): ModelRates {
  return {
    input: rates.input,
    cache_write: rates.cache_write,
    cache_read: rates.cache_read,
    output: rates.output,
  };
}

function cloneVariants(variants?: ModelVariants): ModelVariants | undefined {
  if (!variants) {
    return undefined;
  }

  return {
    max_mode: variants.max_mode
      ? { cursor_upcharge: variants.max_mode.cursor_upcharge }
      : undefined,
    fast: variants.fast
      ? {
          model_id: variants.fast.model_id,
          rates: cloneRates(variants.fast.rates),
        }
      : undefined,
    thinking: variants.thinking,
  };
}

export function cloneModel(model: Model): Model {
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    pool: model.pool,
    context: {
      default: model.context.default,
      max: model.context.max,
    },
    rates: cloneRates(model.rates),
    variants: cloneVariants(model.variants),
    auto_checks: model.auto_checks
      ? {
          max_mode: model.auto_checks.max_mode,
          fast: model.auto_checks.fast,
          thinking: model.auto_checks.thinking,
        }
      : undefined,
  };
}

export function cloneModels(models: Model[]): Model[] {
  return models.map(cloneModel);
}

function clonePlan(plan: Plan): Plan {
  return {
    name: plan.name,
    monthly_cost: plan.monthly_cost,
    api_pool: plan.api_pool,
    description: plan.description,
  };
}

export function clonePlans(plans: Record<PlanKey, Plan>): Record<PlanKey, Plan> {
  return {
    pro: clonePlan(plans.pro),
    pro_plus: clonePlan(plans.pro_plus),
    ultra: clonePlan(plans.ultra),
  };
}

export function clonePricingData(pricing: PricingData): PricingData {
  return {
    meta: {
      version: pricing.meta.version,
      source_url: pricing.meta.source_url,
      retrieved_at: pricing.meta.retrieved_at,
    },
    plans: clonePlans(pricing.plans),
    models: cloneModels(pricing.models),
  };
}
