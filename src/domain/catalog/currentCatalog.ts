import pricingData from '../../data/cursor-pricing.json';
import type { Model, PricingData } from './types';

const CURRENT_CATALOG = pricingData as PricingData;
const CURRENT_MODEL_BY_ID = new Map(CURRENT_CATALOG.models.map((model) => [model.id, model]));
const MANUAL_API_MODELS = CURRENT_CATALOG.models.filter((model) => model.pool === 'api');

export function getPricingCatalog(): PricingData {
  return CURRENT_CATALOG;
}

export function getPlans(): PricingData['plans'] {
  return CURRENT_CATALOG.plans;
}

export function getCurrentModels(): Model[] {
  return CURRENT_CATALOG.models;
}

export function getManualApiModels(): Model[] {
  return MANUAL_API_MODELS;
}

export function getModelById(id: string): Model | undefined {
  return CURRENT_MODEL_BY_ID.get(id);
}
