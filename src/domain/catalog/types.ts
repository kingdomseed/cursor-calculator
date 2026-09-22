export type Audience = 'personal' | 'teams_enterprise';

export type UsagePool = 'cursor_models' | 'other_models' | 'auto_router';

export type PersonalPlanId = 'hobby' | 'start' | 'pro' | 'pro_plus' | 'ultra';
export type OrganizationPlanId = 'teams_standard' | 'teams_premium' | 'enterprise';
export type PlanKey = PersonalPlanId | OrganizationPlanId;

export type OtherModelsAllowanceStatus =
  | 'last_published_official_floor'
  | 'not_included'
  | 'unpublished';

export interface Plan {
  name: string;
  monthly_cost: number | null;
  api_pool: number | null;
  description: string;
  audience?: Audience;
  recommendable?: boolean;
  other_models_allowance_status?: OtherModelsAllowanceStatus;
  other_models_allowance_label?: string;
  monthly_cost_note?: string;
}

export interface ModelRates {
  input: number;
  cache_write: number | null;
  cache_read: number | null;
  output: number;
}

export interface MaxModeVariant {
  cursor_upcharge: number;
  rates?: ModelRates;
}

export interface LongContextVariant {
  rates: ModelRates;
  fast_rates?: ModelRates;
}

export interface FastVariant {
  model_id: string;
  rates: ModelRates;
}

export interface ModelVariants {
  max_mode?: MaxModeVariant;
  fast?: FastVariant;
  thinking?: boolean;
  long_context?: LongContextVariant;
}

export interface ModelRatePromotion {
  ends_on: string;
  rates: Partial<ModelRates>;
  label: string;
}

export interface PoolUsagePromotion {
  ends_on: string;
  allowance_multiplier: number;
  label: string;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  pool: UsagePool;
  docs_url?: string;
  rate_promotion?: ModelRatePromotion;
  pool_usage_promotion?: PoolUsagePromotion;
  availability_note?: string;
  usage_note?: string;
  hidden_by_default?: boolean;
  context: {
    default: number;
    max: number | null;
  };
  rates: ModelRates;
  variants?: ModelVariants;
  auto_checks?: {
    max_mode?: boolean;
    fast?: boolean;
    thinking?: boolean;
  };
}

export interface PricingData {
  meta: { version: string; source_url: string; retrieved_at: string };
  plans: Record<PlanKey, Plan>;
  models: Model[];
}

export const PERSONAL_PLAN_KEYS: PersonalPlanId[] = ['hobby', 'start', 'pro', 'pro_plus', 'ultra'];
export const TEAMS_ENTERPRISE_PLAN_KEYS: OrganizationPlanId[] = [
  'teams_standard',
  'teams_premium',
  'enterprise',
];
export const ALL_PLAN_KEYS: PlanKey[] = [...PERSONAL_PLAN_KEYS, ...TEAMS_ENTERPRISE_PLAN_KEYS];

export const CURSOR_TOKEN_RATE_USD_PER_MILLION = 0.25;
