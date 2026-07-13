import { describe, expect, it } from 'vitest';

import { getManualApiModels } from '../../catalog/currentCatalog';
import {
  getApproximateFastReasoningSuffixes,
  getApproximateImportReplayLabelMappings,
  getDefaultApproximateFastMultiplier,
  getExactImportReplayLabelMappings,
  getImportReplayHistoricalModels,
  getImportReplayModelById,
  getImportReplayModels,
  getLongContextCompanions,
} from '../catalog';

describe('import replay catalog contract', () => {
  it('assembles current models and historical replay-only models in one place', () => {
    const replayModels = getImportReplayModels();
    const historicalModels = getImportReplayHistoricalModels();
    const replayIds = new Set(replayModels.map((model) => model.id));

    expect(replayModels.length).toBeGreaterThan(getManualApiModels().length);
    expect(historicalModels.every((model) => replayIds.has(model.id))).toBe(true);
    expect(getManualApiModels().map((model) => model.id)).not.toEqual(
      expect.arrayContaining(historicalModels.map((model) => model.id)),
    );
    expect(historicalModels.map((model) => model.id)).toEqual(
      expect.arrayContaining([
        'composer-1.5',
        'composer-2',
        'grok-build-0-1',
        'grok-4-3',
        'grok-4-20',
        'kimi-k2.5',
        'claude-opus-4-6-fast',
      ]),
    );
  });

  it('preserves exact replay pricing for retired current-catalog entries', () => {
    expect(getImportReplayModelById('composer-2')?.variants?.fast?.rates).toEqual({
      input: 1.5,
      cache_write: null,
      cache_read: 0.35,
      output: 7.5,
    });
    expect(getImportReplayModelById('grok-4-20')?.variants?.max_mode?.rates).toEqual({
      input: 4,
      cache_write: null,
      cache_read: 0.4,
      output: 12,
    });
    expect(getImportReplayModelById('claude-opus-4-6-fast')?.rates).toEqual({
      input: 30,
      cache_write: 37.5,
      cache_read: 3,
      output: 150,
    });
  });

  it('resolves every exact and approximate label mapping to a valid replay model', () => {
    const replayIds = new Set(getImportReplayModels().map((model) => model.id));

    for (const mapping of Object.values(getExactImportReplayLabelMappings())) {
      expect(replayIds.has(mapping.modelId)).toBe(true);
      expect(getImportReplayModelById(mapping.modelId)?.id).toBe(mapping.modelId);
    }

    for (const mapping of Object.values(getApproximateImportReplayLabelMappings())) {
      expect(replayIds.has(mapping.modelId)).toBe(true);
      expect(getImportReplayModelById(mapping.modelId)?.id).toBe(mapping.modelId);
    }
  });

  it('keeps companion-model and approximation policy tables internally consistent', () => {
    const replayIds = new Set(getImportReplayModels().map((model) => model.id));

    for (const companion of Object.values(getLongContextCompanions())) {
      expect(replayIds.has(companion.maxId)).toBe(true);
    }

    expect(getApproximateFastReasoningSuffixes()).toEqual(['medium', 'high', 'xhigh']);
    expect(getDefaultApproximateFastMultiplier()).toBe(2);
  });

  it('returns defensive copies so callers cannot mutate replay catalog truth', () => {
    const replayModels = getImportReplayModels();
    const historicalModels = getImportReplayHistoricalModels();
    const exactMappings = getExactImportReplayLabelMappings();
    const approximateMappings = getApproximateImportReplayLabelMappings();
    const companions = getLongContextCompanions();
    const resolved = getImportReplayModelById('provider-openai-o3');

    replayModels[0]!.name = 'Mutated Replay Model';
    replayModels.pop();
    historicalModels[0]!.name = 'Mutated Historical Model';
    exactMappings['gpt-5-fast']!.modelId = 'mutated-model-id';
    approximateMappings.agent_review!.modelId = 'mutated-model-id';
    companions['claude-4-sonnet'] = { maxId: 'mutated-model-id' };
    if (resolved) {
      resolved.name = 'Mutated Resolved Model';
    }

    expect(getImportReplayModelById('provider-openai-o3')?.name).toBe('o3');
    expect(getExactImportReplayLabelMappings()['gpt-5-fast']?.modelId).toBe('gpt-5');
    expect(getApproximateImportReplayLabelMappings().agent_review?.modelId).toBe('gpt-5');
    expect(getLongContextCompanions()['claude-4-sonnet']?.maxId).toBe('claude-4-sonnet-1m');
    expect(getImportReplayHistoricalModels().find((model) => model.id === 'provider-openai-o3')?.name).toBe('o3');
    expect(getImportReplayModels().some((model) => model.id === 'provider-openai-o3')).toBe(true);
  });
});
