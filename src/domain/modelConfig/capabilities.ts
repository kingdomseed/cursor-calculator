import type { Model } from '../catalog/types';
import type { ModelConfig } from '../recommendation/types';

export type FastVariantRelation = 'separate-from-max' | 'stacks-with-max' | 'none';

export function getFastVariantRelation(model: Model): FastVariantRelation {
  if (model.variants?.long_context?.fast_rates || !model.variants?.max_mode) {
    return 'none';
  }
  if (model.variants.max_mode.rates) {
    return 'separate-from-max';
  }
  return 'stacks-with-max';
}

export function fastVariantRelationLabel(relation: FastVariantRelation): string | null {
  switch (relation) {
    case 'separate-from-max':
      return '(separate from Max)';
    case 'stacks-with-max':
      return '(stacks with Max)';
    case 'none':
      return null;
    default: {
      const exhaustiveRelation: never = relation;
      return exhaustiveRelation;
    }
  }
}

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
