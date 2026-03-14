import { getPricingCatalog } from '../domain/catalog/currentCatalog';
import { IMPORT_REPLAY_LONG_CONTEXT_COMPANIONS } from '../data/importReplayLabelMappings';
import type { TokenSource } from './calculatorState';
import type { RecommendationModelDisplayRow } from './recommendationPresentation';

export interface RecommendationModelGroup {
  groupKey: string;
  familyLabel: string;
  provider: string;
  variantCount: number;
  totalTokens: number;
  totalCost: number;
  children: RecommendationModelDisplayRow[];
}

// Module-scope maps built once from catalog and companion data

const fastVariantToParent: Map<string, string> = new Map();
const catalog = getPricingCatalog();
for (const model of catalog.models) {
  if (model.variants?.fast) {
    fastVariantToParent.set(model.variants.fast.model_id, model.id);
  }
}

const maxIdToBaseId: Map<string, string> = new Map();
// First pass: add all companion entries
for (const [baseId, companion] of Object.entries(IMPORT_REPLAY_LONG_CONTEXT_COMPANIONS)) {
  maxIdToBaseId.set(companion.maxId, baseId);
}
// Second pass: overwrite with non-approximated entries (preferred)
for (const [baseId, companion] of Object.entries(IMPORT_REPLAY_LONG_CONTEXT_COMPANIONS)) {
  if (!companion.approximated) {
    maxIdToBaseId.set(companion.maxId, baseId);
  }
}

export function getBaseModelId(modelId: string): string {
  // Check fast variants first
  const fastParent = fastVariantToParent.get(modelId);
  if (fastParent) return fastParent;

  // Check max/long-context companions
  const maxBase = maxIdToBaseId.get(modelId);
  if (maxBase) return maxBase;

  // Return as-is (base models and standalone entries)
  return modelId;
}

export function buildModelGroups(
  modelRows: RecommendationModelDisplayRow[],
  tokenSource: TokenSource,
): RecommendationModelGroup[] | null {
  if (tokenSource !== 'cursor_import') return null;

  // Group rows by base model ID (using modelId, not key)
  const groupMap = new Map<string, RecommendationModelDisplayRow[]>();
  for (const row of modelRows) {
    const baseId = getBaseModelId(row.modelId);
    const existing = groupMap.get(baseId);
    if (existing) {
      existing.push(row);
    } else {
      groupMap.set(baseId, [row]);
    }
  }

  // Build groups
  const groups: RecommendationModelGroup[] = [];
  for (const [groupKey, children] of groupMap) {
    // Sort children by primaryMetric.value descending (cost)
    children.sort((a, b) => (b.primaryMetric.value ?? 0) - (a.primaryMetric.value ?? 0));

    const baseChild = children.find((child) => child.modelId === groupKey);
    const familyLabel = baseChild?.label ?? children[0].label;
    const provider = children[0].provider;
    const totalCost = children.reduce((sum, row) => sum + (row.primaryMetric.value ?? 0), 0);
    const totalTokens = children.reduce((sum, row) => sum + (row.secondaryMetric?.value ?? 0), 0);

    groups.push({
      groupKey,
      familyLabel,
      provider,
      variantCount: children.length,
      totalTokens,
      totalCost,
      children,
    });
  }

  // Sort groups by totalCost descending
  groups.sort((a, b) => b.totalCost - a.totalCost);

  return groups;
}
