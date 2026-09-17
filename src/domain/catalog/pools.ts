import type { Audience, Model, Plan, PlanKey, UsagePool } from './types';
import {
  ALL_PLAN_KEYS,
  CURSOR_TOKEN_RATE_USD_PER_MILLION,
  PERSONAL_PLAN_KEYS,
  TEAMS_ENTERPRISE_PLAN_KEYS,
} from './types';

const CURSOR_FIRST_PARTY_PROVIDERS = new Set(['cursor']);

export function isOtherModelsPool(pool: UsagePool): boolean {
  return pool === 'other_models';
}

export function isCursorModelsPool(pool: UsagePool): boolean {
  return pool === 'cursor_models';
}

export function isAutoRouterPool(pool: UsagePool): boolean {
  return pool === 'auto_router';
}

export function isIncludedUsagePool(pool: UsagePool): boolean {
  return isCursorModelsPool(pool) || isAutoRouterPool(pool);
}

export function isThirdPartyModel(model: Model): boolean {
  return !CURSOR_FIRST_PARTY_PROVIDERS.has(model.provider);
}

export function getPlanAudience(plan: Plan): Audience {
  return plan.audience ?? 'personal';
}

export function isPlanRecommendable(plan: Plan): boolean {
  return plan.recommendable ?? true;
}

export function treatsOtherModelsFloorAsUncertain(
  plan: Pick<Plan, 'other_models_allowance_status'>,
): boolean {
  switch (plan.other_models_allowance_status) {
    case 'last_published_official_floor':
      return true;
    case 'not_included':
    case 'unpublished':
    case undefined:
      return false;
    default: {
      const _exhaustive: never = plan.other_models_allowance_status;
      return _exhaustive;
    }
  }
}

export function getPlanKeysForAudience(audience: Audience): PlanKey[] {
  return audience === 'teams_enterprise' ? [...TEAMS_ENTERPRISE_PLAN_KEYS] : [...PERSONAL_PLAN_KEYS];
}

export function filterPlanKeys(
  plans: Partial<Record<PlanKey, Plan>>,
  audience?: Audience,
): PlanKey[] {
  return ALL_PLAN_KEYS.filter((key) => {
    const plan = plans[key];
    if (!plan) return false;
    if (audience && getPlanAudience(plan) !== audience) return false;
    return true;
  });
}

export function resolveCursorTokenRateUsdPerMillion(model: Model, audience?: Audience): number {
  if (audience !== 'teams_enterprise') return 0;
  if (!isOtherModelsPool(model.pool)) return 0;
  if (!isThirdPartyModel(model)) return 0;
  return CURSOR_TOKEN_RATE_USD_PER_MILLION;
}
