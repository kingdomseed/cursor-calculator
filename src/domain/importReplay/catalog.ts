import { getCurrentModels } from '../catalog/currentCatalog';
import { cloneModel, cloneModels } from '../catalog/clones';
import type { Model } from '../catalog/types';
import {
  APPROXIMATE_IMPORT_REPLAY_LABEL_MAPPINGS,
  EXACT_IMPORT_REPLAY_LABEL_MAPPINGS,
  IMPORT_REPLAY_APPROXIMATE_FAST_REASONING_SUFFIXES,
  IMPORT_REPLAY_DEFAULT_APPROXIMATE_FAST_MULTIPLIER,
  IMPORT_REPLAY_LONG_CONTEXT_COMPANIONS,
  type ImportReplayLabelMapping,
  type ImportReplayLongContextCompanion,
} from '../../data/importReplayLabelMappings';
import { IMPORT_REPLAY_HISTORICAL_MODELS } from '../../data/importReplayHistoricalModels';

const IMPORT_REPLAY_MODELS = [...getCurrentModels(), ...cloneModels(IMPORT_REPLAY_HISTORICAL_MODELS)];
const IMPORT_REPLAY_MODEL_BY_ID = new Map(IMPORT_REPLAY_MODELS.map((model) => [model.id, model]));
const EXACT_IMPORT_REPLAY_MAPPINGS = cloneLabelMappings(EXACT_IMPORT_REPLAY_LABEL_MAPPINGS);
const APPROXIMATE_IMPORT_REPLAY_MAPPINGS = cloneLabelMappings(APPROXIMATE_IMPORT_REPLAY_LABEL_MAPPINGS);
const LONG_CONTEXT_COMPANIONS = cloneLongContextCompanions(IMPORT_REPLAY_LONG_CONTEXT_COMPANIONS);

export function getImportReplayModels(): Model[] {
  return cloneModels(IMPORT_REPLAY_MODELS);
}

export function getImportReplayHistoricalModels(): Model[] {
  return cloneModels(IMPORT_REPLAY_HISTORICAL_MODELS);
}

export function getImportReplayModelById(id: string): Model | undefined {
  const model = IMPORT_REPLAY_MODEL_BY_ID.get(id);
  return model ? cloneModel(model) : undefined;
}

export function getExactImportReplayLabelMappings(): Record<string, ImportReplayLabelMapping> {
  return cloneLabelMappings(EXACT_IMPORT_REPLAY_MAPPINGS);
}

export function getApproximateImportReplayLabelMappings(): Record<string, ImportReplayLabelMapping> {
  return cloneLabelMappings(APPROXIMATE_IMPORT_REPLAY_MAPPINGS);
}

export function getLongContextCompanions(): Record<string, ImportReplayLongContextCompanion> {
  return cloneLongContextCompanions(LONG_CONTEXT_COMPANIONS);
}

export function getApproximateFastReasoningSuffixes(): string[] {
  return [...IMPORT_REPLAY_APPROXIMATE_FAST_REASONING_SUFFIXES];
}

export function getDefaultApproximateFastMultiplier(): number {
  return IMPORT_REPLAY_DEFAULT_APPROXIMATE_FAST_MULTIPLIER;
}

function cloneLabelMappings(
  mappings: Record<string, ImportReplayLabelMapping>,
): Record<string, ImportReplayLabelMapping> {
  return Object.fromEntries(
    Object.entries(mappings).map(([label, mapping]) => [
      label,
      {
        modelId: mapping.modelId,
        fast: mapping.fast,
        maxMode: mapping.maxMode,
        thinking: mapping.thinking,
        approximated: mapping.approximated,
      },
    ]),
  );
}

function cloneLongContextCompanions(
  companions: Record<string, ImportReplayLongContextCompanion>,
): Record<string, ImportReplayLongContextCompanion> {
  return Object.fromEntries(
    Object.entries(companions).map(([modelId, companion]) => [
      modelId,
      {
        maxId: companion.maxId,
        approximated: companion.approximated,
      },
    ]),
  );
}
