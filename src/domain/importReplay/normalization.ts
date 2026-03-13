import {
  getApproximateFastReasoningSuffixes,
  getApproximateImportReplayLabelMappings,
  getDefaultApproximateFastMultiplier,
  getExactImportReplayLabelMappings,
} from './catalog';
import type { ApproximationMode, ImportReplayModelsById, NormalizationResult, SupportedNormalization } from './types';

const EXACT_ALIASES = getExactImportReplayLabelMappings();
const APPROXIMATE_ALIASES = getApproximateImportReplayLabelMappings();
const APPROXIMATE_FAST_REASONING_SUFFIXES = new Set(getApproximateFastReasoningSuffixes());
const DEFAULT_APPROXIMATE_FAST_MULTIPLIER = getDefaultApproximateFastMultiplier();

export function normalizeImportedModel(
  rawLabel: string,
  maxMode: boolean,
  modelsById: ImportReplayModelsById,
  approximationMode: ApproximationMode,
): NormalizationResult {
  if (modelsById.has(rawLabel)) {
    return supportedResult(rawLabel, {
      fast: false,
      maxMode: resolveMaxMode(rawLabel, maxMode, modelsById),
      thinking: false,
      approximated: false,
    });
  }

  const exactAlias = EXACT_ALIASES[rawLabel];
  if (exactAlias) {
    return supportedResult(exactAlias.modelId, {
      fast: exactAlias.fast,
      maxMode: resolveMaxMode(exactAlias.modelId, maxMode, modelsById, exactAlias.maxMode),
      thinking: exactAlias.thinking,
      approximated: exactAlias.approximated,
    });
  }

  const approximateAlias = APPROXIMATE_ALIASES[rawLabel];
  if (approximateAlias) {
    if (approximationMode === 'strict') {
      return {
        kind: 'unsupported',
        reason: 'Requires approximation assumptions that are disabled in strict mode',
      };
    }

    return supportedResult(approximateAlias.modelId, {
      fast: approximateAlias.fast,
      maxMode: resolveMaxMode(approximateAlias.modelId, maxMode, modelsById, approximateAlias.maxMode),
      thinking: approximateAlias.thinking,
      approximated: true,
    });
  }

  const approximateGptLabel = normalizeApproximateGpt5Label(
    rawLabel,
    maxMode,
    modelsById,
    approximationMode,
  );
  if (approximateGptLabel) {
    return approximateGptLabel;
  }

  return {
    kind: 'unsupported',
    reason: 'No supported pricing-model mapping for this Cursor model label',
  };
}

function supportedResult(
  modelId: string,
  flags: Omit<SupportedNormalization, 'kind' | 'modelId'>,
): SupportedNormalization {
  return {
    kind: 'supported',
    modelId,
    fast: flags.fast,
    maxMode: flags.maxMode,
    thinking: flags.thinking,
    approximated: flags.approximated,
    rateMultiplier: flags.rateMultiplier,
  };
}

function isDedicatedMaxModel(modelId: string): boolean {
  return modelId.endsWith('-max') || modelId.endsWith('-1m') || modelId === 'claude-4-sonnet-1m';
}

function resolveMaxMode(
  modelId: string,
  rawMaxMode: boolean,
  modelsById: ImportReplayModelsById,
  forceMaxMode: boolean = false,
): boolean {
  if (forceMaxMode || isDedicatedMaxModel(modelId)) {
    return true;
  }

  if (!rawMaxMode) {
    return false;
  }

  const model = modelsById.get(modelId);
  return !!(model?.variants?.max_mode || model?.auto_checks?.max_mode);
}

function normalizeApproximateGpt5Label(
  rawLabel: string,
  rawMaxMode: boolean,
  modelsById: ImportReplayModelsById,
  approximationMode: ApproximationMode,
): SupportedNormalization | null {
  if (approximationMode === 'strict') {
    return null;
  }

  if (!rawLabel.startsWith('gpt-5.')) {
    return null;
  }

  const segments = rawLabel.split('-');
  if (segments.length < 3) {
    return null;
  }

  const fast = segments[segments.length - 1] === 'fast';
  if (fast) {
    segments.pop();
  }

  while (
    segments.length > 0 &&
    APPROXIMATE_FAST_REASONING_SUFFIXES.has(segments[segments.length - 1])
  ) {
    segments.pop();
  }

  const forceMaxMode = segments[segments.length - 1] === 'max';
  if (forceMaxMode) {
    segments.pop();
  }

  const candidateModelId = segments.join('-');
  const model = modelsById.get(candidateModelId);
  if (!model) {
    return null;
  }

  return supportedResult(candidateModelId, {
    fast,
    maxMode: resolveMaxMode(candidateModelId, rawMaxMode || forceMaxMode, modelsById, forceMaxMode),
    thinking: false,
    approximated: true,
    rateMultiplier: fast
      ? model.variants?.fast
        ? 1
        : DEFAULT_APPROXIMATE_FAST_MULTIPLIER
      : undefined,
  });
}
