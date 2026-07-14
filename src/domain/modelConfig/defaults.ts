import type { Model } from '../catalog/types';
import type { ModelConfig } from '../recommendation/types';
import { redistributeWeights } from './weights';

const DEFAULT_CACHE_HIT_RATE = 75;
const PREFERRED_DEFAULT_MODEL_ID = 'composer-2.5';

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
  const selectedIdSet = new Set(selectedIds);
  const previousIdSet = new Set(previousConfigs.map((config) => config.modelId));
  const modelById = new Map(models.map((model) => [model.id, model]));
  const kept: ModelConfig[] = [];
  const added: ModelConfig[] = [];

  for (const config of previousConfigs) {
    if (selectedIdSet.has(config.modelId)) {
      kept.push(config);
    }
  }

  for (const id of selectedIds) {
    if (previousIdSet.has(id)) continue;

    const model = modelById.get(id);
    if (model) {
      added.push(createDefaultModelConfig(model));
    }
  }

  return redistributeWeights([...kept, ...added]);
}
