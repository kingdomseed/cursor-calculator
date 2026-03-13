import type { Model } from '../catalog/types';
import type { ModelConfig } from '../recommendation/types';
import { redistributeWeights } from './weights';

const DEFAULT_CACHE_HIT_RATE = 75;
const PREFERRED_DEFAULT_MODEL_ID = 'claude-sonnet-4-6';

export function createDefaultModelConfig(model: Model): ModelConfig {
  return {
    modelId: model.id,
    weight: 0,
    maxMode: model.auto_checks?.max_mode ?? false,
    fast: model.auto_checks?.fast ?? false,
    thinking: model.auto_checks?.thinking ?? false,
    caching: false,
    cacheHitRate: DEFAULT_CACHE_HIT_RATE,
  };
}

export function createInitialModelConfigs(
  models: Model[],
  preferredModelId = PREFERRED_DEFAULT_MODEL_ID,
): ModelConfig[] {
  const defaultModel = models.find((model) => model.id === preferredModelId) ?? models[0];
  return defaultModel ? redistributeWeights([createDefaultModelConfig(defaultModel)]) : [];
}

export function reconcileSelectedModelConfigs(
  previousConfigs: ModelConfig[],
  selectedIds: string[],
  models: Model[],
): ModelConfig[] {
  const kept = previousConfigs.filter((config) => selectedIds.includes(config.modelId));
  const newIds = selectedIds.filter((id) => !previousConfigs.some((config) => config.modelId === id));
  const added = newIds
    .map((id) => models.find((candidate) => candidate.id === id))
    .filter((model): model is Model => model !== undefined)
    .map((model) => createDefaultModelConfig(model));

  return redistributeWeights([...kept, ...added]);
}
