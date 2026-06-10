import { describe, expect, it } from 'vitest';

import pricingData from '../../../data/cursor-pricing.json';
import { IMPORT_REPLAY_HISTORICAL_MODELS } from '../../../data/importReplayHistoricalModels';
import type { PricingData } from '../../../lib/types';
import {
  getCurrentModels,
  getManualApiModels,
  getManualSelectableModels,
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

  it('exposes Composer 2.5 in the included pool and keeps older Composer rows API-priced', () => {
    const manualModels = getManualSelectableModels();

    expect(manualModels.map((model) => model.id)).toEqual(
      expect.arrayContaining(['composer-1.5', 'composer-2', 'composer-2.5']),
    );
    expect(getModelById('composer-1.5')?.pool).toBe('api');
    expect(getModelById('composer-2')?.pool).toBe('api');
    expect(getModelById('composer-2.5')?.pool).toBe('auto_composer');
    expect(manualModels.map((model) => model.id)).not.toEqual(
      expect.arrayContaining(IMPORT_REPLAY_HISTORICAL_MODELS.map((model) => model.id)),
    );
  });

  it('does not expose retired standalone companion model names in the current catalog', () => {
    expect(getModelById('claude-opus-4-6-max')).toBeUndefined();
    expect(getModelById('gpt-5.4-max')).toBeUndefined();
    expect(getModelById('grok-code-fast-1')).toBeUndefined();
  });

  it('keeps Composer 2.5 Fast as a fast variant on Composer 2.5', () => {
    expect(getModelById('composer-2.5')?.variants?.fast).toEqual({
      model_id: 'composer-2.5-fast',
      rates: {
        input: 3,
        cache_write: null,
        cache_read: 0.5,
        output: 15,
      },
    });
  });

  it('can resolve current models by id and returns undefined for unknown ids', () => {
    expect(getModelById('claude-4-6-sonnet')?.id).toBe('claude-4-6-sonnet');
    expect(getModelById('missing-model-id')).toBeUndefined();
  });

  it('returns defensive copies so callers cannot mutate current catalog truth', () => {
    const catalog = getPricingCatalog();
    const plans = getPlans();
    const models = getCurrentModels();
    const sonnet = getModelById('claude-4-6-sonnet');

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
    expect(getModelById('claude-4-6-sonnet')?.name).toBe(
      productionPricing.models.find((model) => model.id === 'claude-4-6-sonnet')?.name,
    );
  });
});
