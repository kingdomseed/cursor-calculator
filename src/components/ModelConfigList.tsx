import type { Model, ModelConfig } from '../lib/types';
import { ModelConfigRow } from './ModelConfigRow';

interface Props {
  models: Model[];
  configs: ModelConfig[];
  onChange: (configs: ModelConfig[]) => void;
}

export function ModelConfigList({ models, configs, onChange }: Props) {
  const weightSum = configs.reduce((s, c) => s + c.weight, 0);
  const needsNormalization = configs.length > 0 && weightSum !== 100;

  function handleConfigChange(index: number, updated: ModelConfig) {
    const next = [...configs];
    next[index] = updated;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {configs.map((config, i) => {
        const model = models.find(m => m.id === config.modelId);
        if (!model) return null;
        return (
          <ModelConfigRow
            key={config.modelId}
            model={model}
            config={config}
            onChange={(updated) => handleConfigChange(i, updated)}
          />
        );
      })}
      {needsNormalization && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <span className="inline-block w-4 h-4 bg-amber-100 rounded-full text-center leading-4 font-bold">!</span>
          Weights sum to {weightSum}% — results will be normalized to 100%.
        </p>
      )}
    </div>
  );
}
