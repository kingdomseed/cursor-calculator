import { describe, expect, it } from 'vitest';

import { getIncludedPoolModels, getManualApiModels, getModelById, getPlans } from '../currentCatalog';
import {
  filterPlanKeys,
  isAutoRouterPool,
  isCursorModelsPool,
  isOtherModelsPool,
  resolveCursorTokenRateUsdPerMillion,
  treatsOtherModelsFloorAsUncertain,
} from '../pools';

describe('audience and pool splits', () => {
  it('keeps Cursor Models out of the Other Models accessor', () => {
    expect(getManualApiModels().some((model) => isCursorModelsPool(model.pool))).toBe(false);
    expect(getIncludedPoolModels().some((model) => isOtherModelsPool(model.pool))).toBe(false);
    expect(getIncludedPoolModels().some((model) => isAutoRouterPool(model.pool))).toBe(false);
  });

  it('applies the Cursor Token Rate only to Teams third-party Other Models', () => {
    const sonnet = getModelById('claude-sonnet-5');
    const composer = getModelById('composer-2.5');
    const composer1 = getModelById('composer-1');
    const grok = getModelById('grok-4.6');

    expect(sonnet).toBeDefined();
    expect(resolveCursorTokenRateUsdPerMillion(sonnet!, 'personal')).toBe(0);
    expect(resolveCursorTokenRateUsdPerMillion(sonnet!, 'teams_enterprise')).toBe(0.25);
    expect(resolveCursorTokenRateUsdPerMillion(composer!, 'teams_enterprise')).toBe(0);
    expect(resolveCursorTokenRateUsdPerMillion(composer1!, 'teams_enterprise')).toBe(0);
    expect(resolveCursorTokenRateUsdPerMillion(grok!, 'teams_enterprise')).toBe(0);
  });

  it('filters plan keys by audience without inventing Teams Other Models dollars', () => {
    const plans = getPlans();
    expect(filterPlanKeys(plans, 'personal')).toEqual(['hobby', 'start', 'pro', 'pro_plus', 'ultra']);
    expect(filterPlanKeys(plans, 'teams_enterprise')).toEqual([
      'teams_standard',
      'teams_premium',
      'enterprise',
    ]);
    expect(plans.teams_standard.api_pool).toBeNull();
    expect(plans.pro.other_models_allowance_label).toContain('Last published official floor: at least $20');
    expect(plans.pro.other_models_allowance_label).toContain('A billing doc still lists $20');
    expect(plans.pro.other_models_allowance_label).toContain('the live pricing table no longer publishes it');
    expect(plans.pro_plus.other_models_allowance_label).toContain('Last published official floor: $70');
    expect(plans.pro_plus.other_models_allowance_label).toContain('A billing doc still lists $70');
    expect(plans.ultra.other_models_allowance_label).toContain('$400 on a $200 plan');
    expect(plans.ultra.other_models_allowance_label).toContain('A billing doc still lists $400');
    expect(plans.ultra.other_models_allowance_label).toContain('You may not get that now');
    expect(treatsOtherModelsFloorAsUncertain(plans.pro)).toBe(true);
    expect(treatsOtherModelsFloorAsUncertain(plans.start)).toBe(false);
    expect(treatsOtherModelsFloorAsUncertain(plans.teams_standard)).toBe(false);
    expect(treatsOtherModelsFloorAsUncertain({ other_models_allowance_status: undefined })).toBe(false);
  });
});
