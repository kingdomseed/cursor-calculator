import { describe, expect, it } from 'vitest';

import pricingData from '../../../data/cursor-pricing.json';
import { PROVIDER_IMPORT_MODELS } from '../../../data/providerImportModels';
import type { PricingData } from '../../../lib/types';
import {
  getCurrentModels,
  getManualApiModels,
  getModelById,
  getPlans,
  getPricingCatalog,
} from '../currentCatalog';

const productionPricing = pricingData as PricingData;

describe('current catalog contract', () => {
  it('returns the full current pricing catalog from one accessor', () => {
    expect(getPricingCatalog()).toEqual(productionPricing);
    expect(getPlans()).toEqual(productionPricing.plans);
    expect(getCurrentModels()).toEqual(productionPricing.models);
  });

  it('exposes only current api-pool models to the manual selector', () => {
    const manualModels = getManualApiModels();

    expect(manualModels.length).toBeGreaterThan(0);
    expect(manualModels.every((model) => model.pool === 'api')).toBe(true);
    expect(manualModels.map((model) => model.id)).not.toEqual(
      expect.arrayContaining(PROVIDER_IMPORT_MODELS.map((model) => model.id)),
    );
  });

  it('can resolve current models by id and returns undefined for unknown ids', () => {
    expect(getModelById('claude-sonnet-4-6')?.id).toBe('claude-sonnet-4-6');
    expect(getModelById('missing-model-id')).toBeUndefined();
  });
});
