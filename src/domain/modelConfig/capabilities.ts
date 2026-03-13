import type { Model } from '../catalog/types';
import type { ModelConfig } from '../recommendation/types';

export function getModelConfigCapabilities(model: Model): {
  hasMaxMode: boolean;
  hasFast: boolean;
  hasThinking: boolean;
  hasCaching: boolean;
} {
  return {
    hasMaxMode: !!model.variants?.max_mode,
    hasFast: !!model.variants?.fast,
    hasThinking: !!model.variants?.thinking,
    hasCaching: model.rates.cache_read !== null,
  };
}

export function getActiveModelConfigBadges(config: ModelConfig): string[] {
  const badges: string[] = [];

  if (config.maxMode) badges.push('Max');
  if (config.fast) badges.push('Fast');
  if (config.thinking) badges.push('Thinking');
  if (config.caching) badges.push(`Cache ${config.cacheHitRate}%`);

  return badges;
}
