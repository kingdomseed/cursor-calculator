import type { ModelConfig } from '../recommendation/types';

export function redistributeWeights(configs: ModelConfig[]): ModelConfig[] {
  if (configs.length === 0) return configs;

  const evenWeight = Math.round(100 / configs.length);

  return configs.map((config, index) => ({
    ...config,
    weight: index === configs.length - 1
      ? 100 - evenWeight * (configs.length - 1)
      : evenWeight,
  }));
}

export function getWeightSummary(configs: ModelConfig[]): {
  weightSum: number;
  needsNormalization: boolean;
} {
  const weightSum = configs.reduce((sum, config) => sum + config.weight, 0);

  return {
    weightSum,
    needsNormalization: configs.length > 0 && weightSum !== 100,
  };
}
