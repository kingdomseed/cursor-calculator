import { describe, expect, it } from 'vitest';

import pricingData from '../../../data/cursor-pricing.json';
import { IMPORT_REPLAY_HISTORICAL_MODELS } from '../../../data/importReplayHistoricalModels';
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
      expect.arrayContaining(IMPORT_REPLAY_HISTORICAL_MODELS.map((model) => model.id)),
    );
  });

  it('can resolve current models by id and returns undefined for unknown ids', () => {
    expect(getModelById('claude-sonnet-4-6')?.id).toBe('claude-sonnet-4-6');
    expect(getModelById('missing-model-id')).toBeUndefined();
  });

  it('returns defensive copies so callers cannot mutate current catalog truth', () => {
    const catalog = getPricingCatalog();
    const plans = getPlans();
    const models = getCurrentModels();
    const sonnet = getModelById('claude-sonnet-4-6');

    catalog.meta.version = 'mutated-version';
    plans.pro.api_pool = -1;
    models[0]!.name = 'Mutated Model Name';
    models.push({
      id: 'mutated-model',
      name: 'Mutated Model',
      provider: 'cursor',
      pool: 'api',
      context: { default: 0, max: 0 },
      rates: { input: 0, cache_write: null, cache_read: null, output: 0 },
    });
    if (sonnet) {
      sonnet.name = 'Mutated Sonnet';
    }

    expect(getPricingCatalog()).toEqual(productionPricing);
    expect(getPlans()).toEqual(productionPricing.plans);
    expect(getCurrentModels()).toEqual(productionPricing.models);
    expect(getModelById('claude-sonnet-4-6')?.name).toBe(
      productionPricing.models.find((model) => model.id === 'claude-sonnet-4-6')?.name,
    );
  });
});
