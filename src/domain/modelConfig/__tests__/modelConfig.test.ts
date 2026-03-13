import { describe, expect, it } from 'vitest';

import type { Model, ModelConfig } from '../../../lib/types';
import {
  createDefaultModelConfig,
  createInitialModelConfigs,
  reconcileSelectedModelConfigs,
} from '../defaults';
import {
  getWeightSummary,
  redistributeWeights,
} from '../weights';
import {
  getActiveModelConfigBadges,
  getModelConfigCapabilities,
} from '../capabilities';

const preferredModel: Model = {
  id: 'claude-sonnet-4-6',
  name: 'Claude Sonnet 4.6',
  provider: 'anthropic',
  pool: 'api',
  context: { default: 200000, max: 1000000 },
  rates: { input: 3, cache_write: 3.75, cache_read: 0.3, output: 15 },
  variants: {
    max_mode: { cursor_upcharge: 0.2 },
    fast: {
      model_id: 'claude-sonnet-4-6-fast',
      rates: { input: 6, cache_write: 7.5, cache_read: 0.6, output: 30 },
    },
    thinking: true,
  },
  auto_checks: {
    max_mode: true,
    fast: false,
    thinking: true,
  },
};

const secondaryModel: Model = {
  id: 'gpt-5',
  name: 'GPT-5',
  provider: 'openai',
  pool: 'api',
  context: { default: 272000, max: 1000000 },
  rates: { input: 1.25, cache_write: null, cache_read: 0.125, output: 10 },
  variants: {
    max_mode: { cursor_upcharge: 0.2 },
  },
};

describe('defaults', () => {
  it('creates a default config from model auto-checks', () => {
    expect(createDefaultModelConfig(preferredModel)).toEqual({
      modelId: 'claude-sonnet-4-6',
      weight: 0,
      maxMode: true,
      fast: false,
      thinking: true,
      caching: false,
      cacheHitRate: 75,
    });
  });

  it('prefers Claude Sonnet 4.6 for the initial config when available', () => {
    expect(createInitialModelConfigs([secondaryModel, preferredModel])).toEqual([
      {
        modelId: 'claude-sonnet-4-6',
        weight: 100,
        maxMode: true,
        fast: false,
        thinking: true,
        caching: false,
        cacheHitRate: 75,
      },
    ]);
  });

  it('falls back to the first model when the preferred default is absent', () => {
    expect(createInitialModelConfigs([secondaryModel])).toEqual([
      {
        modelId: 'gpt-5',
        weight: 100,
        maxMode: false,
        fast: false,
        thinking: false,
        caching: false,
        cacheHitRate: 75,
      },
    ]);
  });

  it('reconciles selected model ids by keeping existing configs, adding defaults, and redistributing weights', () => {
    const previous: ModelConfig[] = [
      {
        modelId: 'gpt-5',
        weight: 100,
        maxMode: true,
        fast: false,
        thinking: false,
        caching: true,
        cacheHitRate: 50,
      },
    ];

    expect(
      reconcileSelectedModelConfigs(previous, ['gpt-5', 'claude-sonnet-4-6'], [secondaryModel, preferredModel]),
    ).toEqual([
      {
        modelId: 'gpt-5',
        weight: 50,
        maxMode: true,
        fast: false,
        thinking: false,
        caching: true,
        cacheHitRate: 50,
      },
      {
        modelId: 'claude-sonnet-4-6',
        weight: 50,
        maxMode: true,
        fast: false,
        thinking: true,
        caching: false,
        cacheHitRate: 75,
      },
    ]);
  });
});

describe('weights', () => {
  it('redistributes weights evenly and assigns the remainder to the last config', () => {
    const configs: ModelConfig[] = [
      { modelId: 'a', weight: 0, maxMode: false, fast: false, thinking: false, caching: false, cacheHitRate: 0 },
      { modelId: 'b', weight: 0, maxMode: false, fast: false, thinking: false, caching: false, cacheHitRate: 0 },
      { modelId: 'c', weight: 0, maxMode: false, fast: false, thinking: false, caching: false, cacheHitRate: 0 },
    ];

    expect(redistributeWeights(configs).map((config) => config.weight)).toEqual([33, 33, 34]);
  });

  it('reports when weights need normalization', () => {
    const summary = getWeightSummary([
      { modelId: 'a', weight: 60, maxMode: false, fast: false, thinking: false, caching: false, cacheHitRate: 0 },
      { modelId: 'b', weight: 30, maxMode: false, fast: false, thinking: false, caching: false, cacheHitRate: 0 },
    ]);

    expect(summary).toEqual({
      weightSum: 90,
      needsNormalization: true,
    });
  });
});

describe('capabilities', () => {
  it('derives per-model config capabilities from the catalog model', () => {
    expect(getModelConfigCapabilities(preferredModel)).toEqual({
      hasMaxMode: true,
      hasFast: true,
      hasThinking: true,
      hasCaching: true,
    });
  });

  it('builds collapsed active badges from the current config', () => {
    expect(
      getActiveModelConfigBadges({
        modelId: 'claude-sonnet-4-6',
        weight: 100,
        maxMode: true,
        fast: true,
        thinking: true,
        caching: true,
        cacheHitRate: 75,
      }),
    ).toEqual(['Max', 'Fast', 'Thinking', 'Cache 75%']);
  });
});
