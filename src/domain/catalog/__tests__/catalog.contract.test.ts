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
  getPlansForAudience,
  getPricingCatalog,
} from '../currentCatalog';

const productionPricing = pricingData as PricingData;

describe('current catalog contract', () => {
  it('returns the full current pricing catalog from one accessor', () => {
    expect(getPricingCatalog()).toEqual(productionPricing);
    expect(getPlans()).toEqual(productionPricing.plans);
    expect(getCurrentModels()).toEqual(productionPricing.models);
  });

  it('exposes only current Other Models to the manual API accessor', () => {
    const manualModels = getManualApiModels();

    expect(manualModels.length).toBeGreaterThan(0);
    expect(manualModels.every((model) => model.pool === 'other_models')).toBe(true);
    expect(manualModels.map((model) => model.id)).not.toEqual(
      expect.arrayContaining(IMPORT_REPLAY_HISTORICAL_MODELS.map((model) => model.id)),
    );
  });

  it('keeps Cursor Models included and Auto as a router, not a pool member', () => {
    const included = getIncludedPoolModels();
    const selectable = getManualSelectableModels();

    expect(included.map((model) => model.id).sort()).toEqual([
      'composer-2.5',
      'grok-4.5',
      'grok-4.6',
    ]);
    expect(included.every((model) => model.pool === 'cursor_models')).toBe(true);
    expect(getModelById('auto')?.pool).toBe('auto_router');
    expect(included.map((model) => model.id)).not.toContain('auto');
    expect(selectable.map((model) => model.id)).toEqual(
      expect.arrayContaining(['auto', ...included.map((model) => model.id)]),
    );
    expect(selectable.map((model) => model.id)).not.toEqual(
      expect.arrayContaining(IMPORT_REPLAY_HISTORICAL_MODELS.map((model) => model.id)),
    );
  });

  it('splits personal plans from Teams and Enterprise', () => {
    const personal = getPlansForAudience('personal');
    const teams = getPlansForAudience('teams_enterprise');

    expect(Object.keys(personal).sort()).toEqual(['hobby', 'pro', 'pro_plus', 'start', 'ultra']);
    expect(Object.keys(teams).sort()).toEqual(['enterprise', 'teams_premium', 'teams_standard']);
    expect(personal.pro?.api_pool).toBe(20);
    expect(personal.pro?.other_models_allowance_status).toBe('last_published_official_floor');
    expect(personal.pro_plus?.api_pool).toBe(70);
    expect(personal.ultra?.api_pool).toBe(400);
    expect(personal.start?.other_models_allowance_status).toBe('not_included');
    expect(teams.teams_standard?.api_pool).toBeNull();
    expect(teams.teams_premium?.other_models_allowance_status).toBe('unpublished');
  });

  it('keeps retired historical entries out of the current manual catalog', () => {
    const retiredIds = [
      'composer-1.5',
      'composer-2',
      'grok-build-0-1',
      'grok-4-3',
      'grok-4-20',
      'kimi-k2.5',
    ];

    expect(retiredIds.every((id) => getModelById(id) === undefined)).toBe(true);
    expect(getModelById('composer-1')?.pool).toBe('other_models');
  });

  it('contains the September 2026 current rates and new live rows', () => {
    expect(getModelById('claude-sonnet-5')?.rates).toEqual({
      input: 2,
      cache_write: 2.5,
      cache_read: 0.2,
      output: 10,
    });
    expect(getModelById('claude-sonnet-5')?.rate_promotion).toBeUndefined();
    expect(getModelById('gpt-5.6-sol')?.rates).toEqual({
      input: 4,
      cache_write: 5,
      cache_read: 0.4,
      output: 20,
    });
    expect(getModelById('gpt-5.6-sol')?.variants?.fast?.rates).toEqual({
      input: 8,
      cache_write: 10,
      cache_read: 0.8,
      output: 40,
    });
    expect(getModelById('gpt-5.6-terra')?.context).toEqual({ default: 272000, max: 1000000 });
    expect(getModelById('gpt-5.6-luna')?.rates).toEqual({
      input: 0.2,
      cache_write: 0.25,
      cache_read: 0.02,
      output: 1.2,
    });
    expect(getModelById('grok-4.6')?.pool).toBe('cursor_models');
    expect(getModelById('grok-4.6')?.rates).toEqual({
      input: 2,
      cache_write: null,
      cache_read: 0.5,
      output: 6,
    });
    expect(getModelById('claude-opus-5')?.rates).toEqual({
      input: 5,
      cache_write: 6.25,
      cache_read: 0.5,
      output: 25,
    });
    expect(getModelById('claude-fable-5-1')?.rates.cache_read).toBe(0.25);
    expect(getModelById('gemini-3.8-flash')?.id).toBe('gemini-3.8-flash');
    expect(getModelById('muse-spark-1.3')?.provider).toBe('meta');
    expect(getModelById('kimi-k3')?.rates).toEqual({
      input: 3,
      cache_write: null,
      cache_read: 0.3,
      output: 15,
    });
    expect(getModelById('grok-4.5')?.pool_usage_promotion).toBeUndefined();
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
      pool: 'other_models',
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
