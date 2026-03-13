import { getCurrentModels } from '../catalog/currentCatalog';
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

const IMPORT_REPLAY_MODELS = [...getCurrentModels(), ...IMPORT_REPLAY_HISTORICAL_MODELS];
const IMPORT_REPLAY_MODEL_BY_ID = new Map(IMPORT_REPLAY_MODELS.map((model) => [model.id, model]));

export function getImportReplayModels(): Model[] {
  return IMPORT_REPLAY_MODELS;
}

export function getImportReplayHistoricalModels(): Model[] {
  return IMPORT_REPLAY_HISTORICAL_MODELS;
}

export function getImportReplayModelById(id: string): Model | undefined {
  return IMPORT_REPLAY_MODEL_BY_ID.get(id);
}

export function getExactImportReplayLabelMappings(): Record<string, ImportReplayLabelMapping> {
  return EXACT_IMPORT_REPLAY_LABEL_MAPPINGS;
}

export function getApproximateImportReplayLabelMappings(): Record<string, ImportReplayLabelMapping> {
  return APPROXIMATE_IMPORT_REPLAY_LABEL_MAPPINGS;
}

export function getLongContextCompanions(): Record<string, ImportReplayLongContextCompanion> {
  return IMPORT_REPLAY_LONG_CONTEXT_COMPANIONS;
}

export function getApproximateFastReasoningSuffixes(): string[] {
  return [...IMPORT_REPLAY_APPROXIMATE_FAST_REASONING_SUFFIXES];
}

export function getDefaultApproximateFastMultiplier(): number {
  return IMPORT_REPLAY_DEFAULT_APPROXIMATE_FAST_MULTIPLIER;
}
