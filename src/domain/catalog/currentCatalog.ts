import pricingData from '../../data/cursor-pricing.json';
import { cloneModel, cloneModels, clonePlans, clonePricingData } from './clones';
import type { Model, PricingData } from './types';

const CURRENT_CATALOG = clonePricingData(pricingData as PricingData);
const CURRENT_MODEL_BY_ID = new Map(CURRENT_CATALOG.models.map((model) => [model.id, model]));
const MANUAL_API_MODELS = CURRENT_CATALOG.models.filter((model) => model.pool === 'api');

export function getPricingCatalog(): PricingData {
  return clonePricingData(CURRENT_CATALOG);
}

export function getPlans(): PricingData['plans'] {
  return clonePlans(CURRENT_CATALOG.plans);
}

export function getCurrentModels(): Model[] {
  return cloneModels(CURRENT_CATALOG.models);
}

export function getManualApiModels(): Model[] {
  return cloneModels(MANUAL_API_MODELS);
}

export function getModelById(id: string): Model | undefined {
  const model = CURRENT_MODEL_BY_ID.get(id);
  return model ? cloneModel(model) : undefined;
}
