import type {
  Model,
  PlanKey,
} from '../domain/catalog/types';

export type { FastVariant, MaxModeVariant, Model, ModelRates, ModelVariants, Plan, PlanKey, PricingData } from '../domain/catalog/types';

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
