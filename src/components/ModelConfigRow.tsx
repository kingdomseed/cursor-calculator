import { getActiveModelConfigBadges, getModelConfigCapabilities } from '../domain/modelConfig/capabilities';
import { useMemo, useState } from 'react';
import type { Model, ModelConfig } from '../lib/types';
import { formatRate } from '../domain/recommendation/formatters';
import { computeEffectiveRates } from '../domain/recommendation/rates';
import { PROVIDER_COLORS } from '../lib/constants';
import { Collapsible } from './Collapsible';

interface Props {
  model: Model;
  config: ModelConfig;
  onChange: (config: ModelConfig) => void;
}

export function ModelConfigRow({ model, config, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const effectiveRates = useMemo(
    () => computeEffectiveRates(model, config),
    [model, config]
  );

  const {
    hasMaxMode,
    hasFast,
    hasThinking,
    hasCaching,
  } = getModelConfigCapabilities(model);
  const activeBadges = getActiveModelConfigBadges(config);

  return (
    <div className="bg-white rounded-xl border border-[#e0e0d8] p-4">
      {/* Header: always visible, clickable to expand */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg className={`w-3.5 h-3.5 text-[#14120b]/40 transition-transform flex-shrink-0 ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${PROVIDER_COLORS[model.provider] || 'bg-gray-400'}`} />
          <span className="font-semibold truncate">{model.name}</span>
          {!expanded && activeBadges.map(badge => (
            <span key={badge} className="text-[10px] px-1.5 py-0.5 rounded bg-[#f7f7f4] text-[#14120b]/50 flex-shrink-0">{badge}</span>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="number" min="0" max="100" step="5"
            value={config.weight}
            onChange={(e) => onChange({ ...config, weight: Number(e.target.value) })}
            className="w-16 text-right text-sm font-semibold bg-[#f7f7f4] border border-[#e0e0d8] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#14120b]/30"
          />
          <span className="text-sm text-[#14120b]/50">%</span>
        </div>
      </button>

      {/* Expandable details */}
      <Collapsible open={expanded}>
        <div className="mt-3 space-y-3">
          {/* Variant checkboxes: pricing variants */}
          {(hasMaxMode || hasFast) && (
            <div className="flex flex-wrap gap-4 text-sm">
              {hasMaxMode && (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={config.maxMode} onChange={(e) => onChange({ ...config, maxMode: e.target.checked })}
                    className="w-4 h-4 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]" />
                  <span>Max Mode</span>
                  <span className="text-xs text-[#14120b]/40">(+20%)</span>
                </label>
              )}
              {hasFast && (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={config.fast} onChange={(e) => onChange({ ...config, fast: e.target.checked })}
                    className="w-4 h-4 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]" />
                  <span>Fast</span>
                  <span className="text-xs text-[#14120b]/40">(stacks with Max)</span>
                </label>
              )}
            </div>
          )}

          {/* Token usage modifiers: thinking */}
          {hasThinking && (
            <div className="text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={config.thinking} onChange={(e) => onChange({ ...config, thinking: e.target.checked })}
                  className="w-4 h-4 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]" />
                <span>Thinking</span>
                <span className="text-xs text-[#14120b]/40">(uses more output tokens)</span>
              </label>
            </div>
          )}

          {/* Caching */}
          {hasCaching && (
            <div>
              <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                <input type="checkbox" checked={config.caching} onChange={(e) => onChange({ ...config, caching: e.target.checked })}
                  className="w-4 h-4 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]" />
                <span>Custom cache-read share</span>
              </label>
              <p className="text-xs text-[#14120b]/40 mt-1 pl-6">Overrides the global cache-read share for this model</p>
              {config.caching && (
                <div className="mt-2 pl-6">
                  <div className="flex items-center gap-2">
                    <input type="range" min="0" max="100" step="5" value={config.cacheHitRate}
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
      </Collapsible>
    </div>
  );
}
