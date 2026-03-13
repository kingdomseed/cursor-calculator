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
});
