import type { Model, PlanKey } from '../catalog/types';

export type Mode = 'budget' | 'tokens';

export interface ModelConfig {
  modelId: string;
  weight: number;
  maxMode: boolean;
  fast: boolean;
  thinking: boolean;
  caching: boolean;
  cacheHitRate: number;
}

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
  pool: Model['pool'];
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
  estimatedIncludedPoolOverageTokens?: number;
}

export interface IncludedPoolEstimateConfig {
  referenceModelId: string;
  equivalentTokenAllowances: Partial<Record<PlanKey, number>>;
  sourceLabel: string;
  asOf?: Date;
}

export interface PlanResult {
  plan: PlanKey;
  subscription: number;
  apiPool: number;
  apiBudget: number;
  apiUsage: number;
  estimatedIncludedPoolAllowanceTokens?: number | null;
  estimatedIncludedPoolOverageTokens?: number;
  estimatedIncludedPoolOverageCost?: number;
  overage: number;
  unusedPool: number;
  totalCost: number;
  affordable: boolean;
  perModel: PlanLineItem[];
}

export interface Recommendation {
  best: PlanResult;
  all: PlanResult[];
}
