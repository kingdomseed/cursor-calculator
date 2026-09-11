import pricingData from '../../data/cursor-pricing.json';
import { cloneModel, cloneModels, clonePlans, clonePricingData } from './clones';
import { getPlanKeysForAudience, isCursorModelsPool, isOtherModelsPool } from './pools';
import type { Audience, Model, Plan, PlanKey, PricingData } from './types';

const CURRENT_CATALOG = clonePricingData(pricingData as PricingData);
const CURRENT_MODEL_BY_ID = new Map(CURRENT_CATALOG.models.map((model) => [model.id, model]));
const MANUAL_API_MODELS = CURRENT_CATALOG.models.filter((model) => isOtherModelsPool(model.pool));
const MANUAL_SELECTABLE_MODELS = CURRENT_CATALOG.models;
const INCLUDED_POOL_MODELS = CURRENT_CATALOG.models.filter((model) => isCursorModelsPool(model.pool));

export function getPricingCatalog(): PricingData {
  return clonePricingData(CURRENT_CATALOG);
}

export function getPlans(): PricingData['plans'] {
  return clonePlans(CURRENT_CATALOG.plans);
}

export function getPlansForAudience(audience: Audience): Partial<Record<PlanKey, Plan>> {
  const plans = getPlans();
  return Object.fromEntries(
    getPlanKeysForAudience(audience).flatMap((key) => {
      const plan = plans[key];
      return plan ? [[key, plan]] : [];
    }),
  );
}

export function getCurrentModels(): Model[] {
  return cloneModels(CURRENT_CATALOG.models);
}

export function getManualApiModels(): Model[] {
  return cloneModels(MANUAL_API_MODELS);
}

export function getManualSelectableModels(): Model[] {
  return cloneModels(MANUAL_SELECTABLE_MODELS);
}

export function getIncludedPoolModels(): Model[] {
  return cloneModels(INCLUDED_POOL_MODELS);
}

export function getModelById(id: string): Model | undefined {
  const model = CURRENT_MODEL_BY_ID.get(id);
  return model ? cloneModel(model) : undefined;
}
