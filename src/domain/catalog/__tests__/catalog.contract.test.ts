import { describe, expect, it } from 'vitest';

import pricingData from '../../../data/cursor-pricing.json';
import { IMPORT_REPLAY_HISTORICAL_MODELS } from '../../../data/importReplayHistoricalModels';
import type { PricingData } from '../../../lib/types';
import {
  getCurrentModels,
  getIncludedPoolModels,
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

  it('exposes the three Cursor first-party models in the included pool', () => {
    const manualModels = getManualSelectableModels();
    const firstPartyModels = getIncludedPoolModels();

    expect(firstPartyModels.map((model) => model.id).sort()).toEqual([
      'auto',
      'composer-2.5',
      'grok-4.5',
    ]);
    expect(firstPartyModels.every((model) => model.pool === 'first_party')).toBe(true);
    expect(firstPartyModels.every((model) => model.provider === 'cursor')).toBe(true);
    expect(manualModels.map((model) => model.id)).toEqual(
      expect.arrayContaining(firstPartyModels.map((model) => model.id)),
    );
    expect(manualModels.map((model) => model.id)).not.toEqual(
      expect.arrayContaining(IMPORT_REPLAY_HISTORICAL_MODELS.map((model) => model.id)),
    );
  });

  it('keeps retired July 2026 entries out of the current manual catalog', () => {
    const retiredIds = [
      'composer-1.5',
      'composer-2',
      'grok-build-0-1',
      'grok-4-3',
      'grok-4-20',
      'kimi-k2.5',
    ];

    expect(retiredIds.every((id) => getModelById(id) === undefined)).toBe(true);
    expect(getModelById('composer-1')?.pool).toBe('api');
  });

  it('contains the July 13 model rates, contexts, and variants', () => {
    expect(getModelById('claude-sonnet-5')).toEqual({
      id: 'claude-sonnet-5',
      name: 'Claude Sonnet 5',
      provider: 'anthropic',
      pool: 'api',
      docs_url: 'https://cursor.com/docs/models/claude-sonnet-5',
      rate_promotion: {
        ends_on: '2026-08-31',
        rates: { input: 2, output: 10 },
        label: '$2/M input and $10/M output through August 31, 2026',
      },
      context: { default: 200000, max: 1000000 },
      rates: { input: 3, cache_write: 3.75, cache_read: 0.3, output: 15 },
      variants: { max_mode: { cursor_upcharge: 0 }, thinking: true },
    });
    expect(getModelById('gpt-5.6-sol')).toMatchObject({
      context: { default: 272000, max: 1000000 },
      rates: { input: 5, cache_write: 6.25, cache_read: 0.5, output: 30 },
      variants: {
        max_mode: {
          rates: { input: 10, cache_write: 12.5, cache_read: 1, output: 45 },
        },
        fast: {
          model_id: 'gpt-5.6-sol-fast',
          rates: { input: 10, cache_write: 12.5, cache_read: 1, output: 60 },
        },
        thinking: true,
      },
    });
    expect(getModelById('gpt-5.6-terra')).toMatchObject({
      context: { default: 272000, max: null },
      rates: { input: 2.5, cache_write: 3.125, cache_read: 0.25, output: 15 },
      variants: {
        fast: {
          model_id: 'gpt-5.6-terra-fast',
          rates: { input: 5, cache_write: 6.25, cache_read: 0.5, output: 30 },
        },
        thinking: true,
      },
    });
    expect(getModelById('gpt-5.6-luna')).toMatchObject({
      context: { default: 272000, max: null },
      rates: { input: 1, cache_write: 1.25, cache_read: 0.1, output: 6 },
      variants: {
        fast: {
          model_id: 'gpt-5.6-luna-fast',
          rates: { input: 2, cache_write: 2.5, cache_read: 0.2, output: 12 },
        },
        thinking: true,
      },
    });
    expect(getModelById('glm-5.2')).toMatchObject({
      provider: 'zai',
      context: { default: 200000, max: null },
      rates: { input: 1.4, cache_write: null, cache_read: 0.26, output: 4.4 },
    });
    expect(getModelById('kimi-k2.7-code')).toMatchObject({
      provider: 'moonshot',
      context: { default: 262000, max: null },
      rates: { input: 0.95, cache_write: null, cache_read: 0.19, output: 4 },
    });
    expect(getModelById('grok-4.5')).toMatchObject({
      provider: 'cursor',
      pool: 'first_party',
      availability_note: 'Not yet available in the European Union',
      pool_usage_promotion: {
        ends_on: '2026-07-15',
        allowance_multiplier: 2,
      },
      context: { default: 256000, max: null },
      rates: { input: 2, cache_write: null, cache_read: 0.5, output: 6 },
      variants: {
        fast: {
          model_id: 'grok-4.5-fast',
          rates: { input: 4, cache_write: null, cache_read: 1, output: 18 },
        },
      },
    });
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

  it('removes Claude Opus 4.6 Fast from the current catalog', () => {
    expect(getModelById('claude-opus-4-6')?.variants?.fast).toBeUndefined();
    expect(getModelById('claude-opus-4-6-fast')).toBeUndefined();
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
