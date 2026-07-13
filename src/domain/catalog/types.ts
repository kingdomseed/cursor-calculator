export type PlanKey = 'pro' | 'pro_plus' | 'ultra';

export interface Plan {
  name: string;
  monthly_cost: number;
  api_pool: number;
  description: string;
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

export interface FastVariant {
  model_id: string;
  rates: ModelRates;
}

export interface ModelVariants {
  max_mode?: MaxModeVariant;
  fast?: FastVariant;
  thinking?: boolean;
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
  pool: 'api' | 'first_party';
  docs_url?: string;
  rate_promotion?: ModelRatePromotion;
  pool_usage_promotion?: PoolUsagePromotion;
  availability_note?: string;
  usage_note?: string;
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
