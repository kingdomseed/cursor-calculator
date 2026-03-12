import { useMemo, useState, useCallback } from 'react';
import { Analytics } from '@vercel/analytics/react';
import pricingData from './data/cursor-pricing.json';
import type { Mode, Model, ModelConfig, PricingData } from './lib/types';
import { computeRecommendation } from './lib/calculations';
import { ModeToggle } from './components/ModeToggle';
import { BudgetInput } from './components/BudgetInput';
import { TokenInput } from './components/TokenInput';
import { ModelSelector } from './components/ModelSelector';
import { ModelConfigList } from './components/ModelConfigList';
import { BestPlanCard } from './components/BestPlanCard';
import { PlanComparison } from './components/PlanComparison';

const PRICING = pricingData as PricingData;
const API_MODELS = PRICING.models.filter((m) => m.pool === 'api');

function createDefaultConfig(model: Model): ModelConfig {
  return {
    modelId: model.id,
    weight: 0, // will be redistributed
    maxMode: model.auto_checks?.max_mode ?? false,
    fast: model.auto_checks?.fast ?? false,
    thinking: model.auto_checks?.thinking ?? false,
    caching: false,
    cacheHitRate: 50,
  };
}

function redistributeWeights(configs: ModelConfig[]): ModelConfig[] {
  if (configs.length === 0) return configs;
  const evenWeight = Math.round(100 / configs.length);
  return configs.map((c, i) => ({
    ...c,
    weight: i === configs.length - 1
      ? 100 - evenWeight * (configs.length - 1)  // last one gets remainder
      : evenWeight,
  }));
}

function App() {
  const [mode, setMode] = useState<Mode>('budget');
  const [budget, setBudget] = useState(60);
  const [tokens, setTokens] = useState(1_000_000);
  const [inputRatio, setInputRatio] = useState(3);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>(() => {
    const defaultModel = API_MODELS.find(m => m.id === 'claude-sonnet-4-6') ?? API_MODELS[0];
    return defaultModel ? redistributeWeights([createDefaultConfig(defaultModel)]) : [];
  });

  const selectedModelIds = useMemo(() => modelConfigs.map(c => c.modelId), [modelConfigs]);
  const selectedModels = useMemo(
    () => API_MODELS.filter(m => selectedModelIds.includes(m.id)),
    [selectedModelIds]
  );

  const handleModelSelectionChange = useCallback((ids: string[]) => {
    setModelConfigs(prev => {
      const kept = prev.filter(c => ids.includes(c.modelId));
      const newIds = ids.filter(id => !prev.some(c => c.modelId === id));
      const added = newIds.map(id => {
        const model = API_MODELS.find(m => m.id === id)!;
        return createDefaultConfig(model);
      });
      return redistributeWeights([...kept, ...added]);
    });
  }, []);

  const recommendation = useMemo(() => {
    if (modelConfigs.length === 0) return null;
    return computeRecommendation(
      mode, budget, tokens,
      selectedModels, modelConfigs,
      PRICING.plans, inputRatio
    );
  }, [mode, budget, tokens, selectedModels, modelConfigs, inputRatio]);

  return (
    <div className="min-h-screen bg-[#f7f7f4] text-[#14120b]">
      <header className="bg-white border-b border-[#e0e0d8]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#14120b] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold">Cursor Cost Calculator</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <ModeToggle mode={mode} onChange={setMode} />

        <div className="mt-8">
          {mode === 'budget'
            ? <BudgetInput value={budget} onChange={setBudget} />
            : <TokenInput value={tokens} onChange={setTokens} />
          }
        </div>

        <div className="mt-8">
          <label className="block text-sm font-medium text-[#14120b]/60 mb-2">Models to compare</label>
          <ModelSelector
            options={API_MODELS}
            selected={selectedModelIds}
            onChange={handleModelSelectionChange}
            placeholder="Select models..."
          />
        </div>

        {modelConfigs.length > 0 && (
          <div className="mt-4">
            <ModelConfigList
              models={selectedModels}
              configs={modelConfigs}
              onChange={setModelConfigs}
            />
          </div>
        )}

        {/* Advanced Options */}
        <div className="mt-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-[#14120b]/60 hover:text-[#14120b]"
          >
            <svg className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Advanced options
          </button>
          {showAdvanced && (
            <div className="mt-4 p-4 bg-white rounded-xl border border-[#e0e0d8]">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Input : Output Ratio</label>
                <span className="text-sm font-semibold bg-[#f7f7f4] px-2 py-0.5 rounded">{inputRatio} : 1</span>
              </div>
              <input type="range" min="1" max="10" step="0.5" value={inputRatio}
                onChange={(e) => setInputRatio(Number(e.target.value))}
                className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]" />
              <div className="flex justify-between text-xs text-[#14120b]/40 mt-1">
                <span>1:1</span><span>3:1 typical</span><span>10:1</span>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {recommendation && (
          <>
            <div className="mt-8">
              <BestPlanCard result={recommendation.best} mode={mode} models={selectedModels} configs={modelConfigs} />
            </div>
            <PlanComparison results={recommendation.all} mode={mode} models={selectedModels} />
          </>
        )}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-[#e0e0d8] text-sm text-[#14120b]/60 space-y-4">
          <p>
            <strong>How plans work:</strong> Auto and Composer are usage-based (not token-based) and included in every subscription — they don't draw from the API pool.
            The API pool covers all other models. Once exhausted, you pay overage at the same per-token rates.
          </p>
          <p>
            <strong>Max Mode:</strong> Adds 20% Cursor upcharge. For extended context (1M), use the dedicated Max/1M model variants which have long-context pricing built into their rates.
          </p>
          <p className="text-xs text-[#14120b]/40 text-center">
            Source: cursor.com/docs/models-and-pricing · Last updated {PRICING.meta.retrieved_at}
          </p>
        </div>
      </main>
      <Analytics />
    </div>
  );
}

export default App;
