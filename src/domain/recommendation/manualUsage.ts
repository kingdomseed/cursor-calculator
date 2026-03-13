import type { Model, PricingData } from '../catalog/types';
import { computeExactUsageRecommendation } from './recommendation';
import type {
  ExactTokenBreakdown,
  ModelConfig,
  Recommendation,
  UsageLineItemInput,
} from './types';

const EXACT_BUCKET_KEYS = [
  'inputWithCacheWrite',
  'inputWithoutCacheWrite',
  'cacheRead',
  'output',
] as const;

type ExactBucketKey = typeof EXACT_BUCKET_KEYS[number];

export function normalizeExactTokenBreakdown(
  tokens: Partial<ExactTokenBreakdown>,
): ExactTokenBreakdown {
  const inputWithCacheWrite = clampWholeTokens(tokens.inputWithCacheWrite);
  const inputWithoutCacheWrite = clampWholeTokens(tokens.inputWithoutCacheWrite);
  const cacheRead = clampWholeTokens(tokens.cacheRead);
  const output = clampWholeTokens(tokens.output);
  const total = inputWithCacheWrite + inputWithoutCacheWrite + cacheRead + output;

  return {
    inputWithCacheWrite,
    inputWithoutCacheWrite,
    cacheRead,
    output,
    total,
  };
}

export function buildSimpleExactTokenBreakdown(
  totalTokens: number,
  cacheReadShare: number,
  inputOutputRatio: number,
): ExactTokenBreakdown {
  const clampedTotalTokens = clampWholeTokens(totalTokens);
  const clampedCacheReadShare = Math.min(100, Math.max(0, cacheReadShare));
  const safeRatio = Number.isFinite(inputOutputRatio) && inputOutputRatio > 0 ? inputOutputRatio : 1;
  const cacheRead = Math.round(clampedTotalTokens * (clampedCacheReadShare / 100));
  const remainingTokens = clampedTotalTokens - cacheRead;
  const inputWithoutCacheWrite = Math.round(remainingTokens * (safeRatio / (safeRatio + 1)));
  const output = remainingTokens - inputWithoutCacheWrite;

  return normalizeExactTokenBreakdown({
    inputWithCacheWrite: 0,
    inputWithoutCacheWrite,
    cacheRead,
    output,
  });
}

export function buildManualUsageEntries(
  exactTokens: ExactTokenBreakdown,
  models: Model[],
  configs: ModelConfig[],
): UsageLineItemInput[] {
  const configsWithModels = configs
    .map((config) => ({
      config,
      model: models.find((candidate) => candidate.id === config.modelId),
    }))
    .filter((entry): entry is { config: ModelConfig; model: Model } => entry.model !== undefined);

  if (configsWithModels.length === 0) {
    return [];
  }

  const weightSum = configsWithModels.reduce((sum, entry) => sum + entry.config.weight, 0);
  if (weightSum <= 0) {
    return configsWithModels.map(({ config, model }) => ({
      key: config.modelId,
      modelId: config.modelId,
      label: model.name,
      provider: model.provider,
      pool: model.pool,
      tokens: { total: 0, input: 0, output: 0 },
      exactTokens: normalizeExactTokenBreakdown({}),
      maxMode: config.maxMode,
      fast: config.fast,
      thinking: config.thinking,
      caching: false,
      cacheHitRate: 0,
      approximated: false,
    }));
  }

  const normalizedConfigs = configsWithModels.map(({ config, model }) => ({
    config: {
      ...config,
      weight: (config.weight / weightSum) * 100,
    },
    model,
  }));

  const allocatedSoFar: Record<ExactBucketKey, number> = {
    inputWithCacheWrite: 0,
    inputWithoutCacheWrite: 0,
    cacheRead: 0,
    output: 0,
  };

  return normalizedConfigs.map(({ config, model }, index) => {
    const isLast = index === normalizedConfigs.length - 1;
    const perModelExactTokens = normalizeExactTokenBreakdown(
      EXACT_BUCKET_KEYS.reduce<Partial<ExactTokenBreakdown>>((accumulator, key) => {
        const totalForKey = exactTokens[key];
        const allocatedValue = isLast
          ? totalForKey - allocatedSoFar[key]
          : Math.round(totalForKey * (config.weight / 100));

        allocatedSoFar[key] += allocatedValue;
        accumulator[key] = allocatedValue;
        return accumulator;
      }, {}),
    );

    return {
      key: config.modelId,
      modelId: config.modelId,
      label: model.name,
      provider: model.provider,
      pool: model.pool,
      tokens: {
        total: perModelExactTokens.total,
        input: perModelExactTokens.inputWithCacheWrite + perModelExactTokens.inputWithoutCacheWrite + perModelExactTokens.cacheRead,
        output: perModelExactTokens.output,
      },
      exactTokens: perModelExactTokens,
      maxMode: config.maxMode,
      fast: config.fast,
      thinking: config.thinking,
      caching: perModelExactTokens.cacheRead > 0 || perModelExactTokens.inputWithCacheWrite > 0,
      cacheHitRate: 0,
      approximated: false,
    };
  });
}

export function computeManualUsageRecommendation(
  exactTokens: ExactTokenBreakdown,
  models: Model[],
  configs: ModelConfig[],
  plans: PricingData['plans'],
): Recommendation {
  return computeExactUsageRecommendation(
    buildManualUsageEntries(exactTokens, models, configs),
    models,
    plans,
  );
}

function clampWholeTokens(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value ?? 0));
}
