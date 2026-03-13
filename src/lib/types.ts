// ─── Pricing Data Types (mirror cursor-pricing.json schema) ──────────

export type PlanKey = "pro" | "pro_plus" | "ultra";

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

export interface Model {
  id: string;
  name: string;
  provider: string;
  pool: "api" | "auto_composer";
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

// ─── UI State Types ──────────────────────────────────────────────────

export type Mode = "budget" | "tokens";

export interface ModelConfig {
  modelId: string;
  weight: number;        // 0-100, user-facing percentage
  maxMode: boolean;
  fast: boolean;
  thinking: boolean;
  caching: boolean;
  cacheHitRate: number;  // 0-95
}

// ─── Calculation Result Types ────────────────────────────────────────

export interface EffectiveRates {
  input: number;
  output: number;
}

export interface TokenBreakdown {
  total: number;
  input: number;
  output: number;
}

export interface ExactTokenBreakdown {
  inputWithCacheWrite: number;
  inputWithoutCacheWrite: number;
  cacheRead: number;
  output: number;
  total: number;
}

export interface ExactCostBreakdown {
  input: number;
  output: number;
  total: number;
}

export interface UsageLineItemInput {
  key: string;
  modelId: string;
  label: string;
  provider: string;
  pool: Model["pool"];
  tokens: TokenBreakdown;
  exactTokens?: ExactTokenBreakdown;
  exactCost?: ExactCostBreakdown;
  maxMode: boolean;
  fast: boolean;
  thinking: boolean;
  caching: boolean;
  cacheHitRate: number;
  approximated: boolean;
  sourceLabel?: string;
}

export interface PlanLineItem extends UsageLineItemInput {
  effectiveRates: EffectiveRates;
  apiCost: number;
}

export interface PlanResult {
  plan: PlanKey;
  subscription: number;
  apiPool: number;
  apiBudget: number;        // pool + overage budget
  apiUsage: number;          // actual API cost from model mix
  overage: number;
  unusedPool: number;
  totalCost: number;
  affordable: boolean;       // subscription <= budget (budget mode only)
  perModel: PlanLineItem[];
}

export interface Recommendation {
  best: PlanResult;
  all: PlanResult[];
}
