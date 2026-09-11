import type { Audience } from '../catalog/types';

export type CloudProductKind =
  | 'cloud_agent'
  | 'self_hosted_runtime'
  | 'automation'
  | 'bugbot'
  | 'security_agent'
  | 'pr_routing_and_approval'
  | 'projects';

export type CloudRuntimeKind = 'cursor_managed' | 'my_machines' | 'team_pools';
export type CloudAutomationScope = 'team_owned' | 'private' | 'team_visible';

export interface CloudAutomationsInput {
  audience: Audience;
  product: CloudProductKind;
  runtime: CloudRuntimeKind;
  automationScope: CloudAutomationScope;
  modelId: string;
  tokens: number;
  cacheReadShare: number;
  inputRatio: number;
  fast: boolean;
}

export interface CloudCostLine {
  key: string;
  label: string;
  amount: number | null;
  formattedAmount: string;
  status: 'sourced' | 'unverified';
  note?: string;
}

export interface CloudAutomationsResult {
  product: CloudProductKind;
  modelId: string;
  modelName: string;
  billedAtApiRates: boolean;
  usageCost: number | null;
  lines: CloudCostLine[];
  notes: string[];
}
