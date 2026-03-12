import { useMemo } from 'react';
import type { Model, ModelConfig } from '../lib/types';
import { computeEffectiveRates, formatRate } from '../lib/calculations';
import { PROVIDER_COLORS } from '../lib/constants';

interface Props {
  model: Model;
  config: ModelConfig;
  onChange: (config: ModelConfig) => void;
}

export function ModelConfigRow({ model, config, onChange }: Props) {
  const effectiveRates = useMemo(
    () => computeEffectiveRates(model, config),
    [model, config]
  );

  const hasMaxMode = !!model.variants?.max_mode;
  const hasFast = !!model.variants?.fast;
  const hasThinking = !!model.variants?.thinking;
  const hasCaching = model.rates.cache_read !== null;

  function toggleMaxMode(checked: boolean) {
    onChange({ ...config, maxMode: checked, fast: checked ? false : config.fast });
  }

  function toggleFast(checked: boolean) {
    onChange({ ...config, fast: checked, maxMode: checked ? false : config.maxMode });
  }

  return (
    <div className="bg-white rounded-xl border border-[#e0e0d8] p-4 space-y-3">
      {/* Header: name + weight */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${PROVIDER_COLORS[model.provider] || 'bg-gray-400'}`} />
          <span className="font-semibold">{model.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number" min="0" max="100" step="5"
            value={config.weight}
            onChange={(e) => onChange({ ...config, weight: Number(e.target.value) })}
            className="w-16 text-right text-sm font-semibold bg-[#f7f7f4] border border-[#e0e0d8] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#14120b]/30"
          />
          <span className="text-sm text-[#14120b]/50">%</span>
        </div>
      </div>

      {/* Variant checkboxes: pricing variants */}
      {(hasMaxMode || hasFast) && (
        <div className="flex flex-wrap gap-4 text-sm">
          {hasMaxMode && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={config.maxMode} onChange={(e) => toggleMaxMode(e.target.checked)}
                className="w-4 h-4 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]" />
              <span>Max Mode</span>
              <span className="text-xs text-[#14120b]/40">(+20%)</span>
            </label>
          )}
          {hasFast && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={config.fast} onChange={(e) => toggleFast(e.target.checked)}
                className="w-4 h-4 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]" />
              <span>Fast</span>
            </label>
          )}
        </div>
      )}

      {/* Token usage modifiers: thinking + caching */}
      {(hasThinking || hasCaching) && (
        <div className="space-y-2 text-sm">
          {hasThinking && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={config.thinking} onChange={(e) => onChange({ ...config, thinking: e.target.checked })}
                className="w-4 h-4 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]" />
              <span>Thinking</span>
              <span className="text-xs text-[#14120b]/40">(uses more output tokens)</span>
            </label>
          )}
        </div>
      )}

      {/* Caching */}
      {hasCaching && (
        <div>
          <label className="flex items-center gap-1.5 cursor-pointer text-sm">
            <input type="checkbox" checked={config.caching} onChange={(e) => onChange({ ...config, caching: e.target.checked })}
              className="w-4 h-4 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]" />
            <span>Caching</span>
          </label>
          {config.caching && (
            <div className="mt-2 pl-6">
              <div className="flex items-center gap-2">
                <input type="range" min="0" max="95" step="5" value={config.cacheHitRate}
                  onChange={(e) => onChange({ ...config, cacheHitRate: Number(e.target.value) })}
                  className="flex-1 h-1.5 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]" />
                <span className="text-xs font-semibold bg-[#f7f7f4] px-1.5 py-0.5 rounded w-10 text-center">{config.cacheHitRate}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Effective rate */}
      <div className="text-xs text-[#14120b]/50 pt-1 border-t border-[#e0e0d8]/50">
        effective: {formatRate(effectiveRates.input)} in / {formatRate(effectiveRates.output)} out per M
      </div>
    </div>
  );
}
