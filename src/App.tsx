import { useMemo, useState } from "react";
import cursorPricing from "./data/cursor-pricing.json";

// ─── Types ───────────────────────────────────────────────────────────────────

type PlanKey = "pro" | "pro_plus" | "ultra";
type Mode = "budget" | "tokens";

interface Model {
  id: string;
  name: string;
  provider: string;
  rates: {
    input: number;
    cache_write: number | null;
    cache_read: number | null;
    output: number;
  };
  pool: "api" | "auto_composer";
  max_mode_available: boolean;
}

interface Plan {
  name: string;
  monthly_cost: number;
  api_pool: number;
  description: string;
}

interface PricingData {
  meta: { version: string; retrieved_at: string };
  plans: Record<PlanKey, Plan>;
  models: Model[];
  settings: {
    max_mode_upcharge: number;
    default_input_output_ratio: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRICING = cursorPricing as PricingData;

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "bg-orange-500",
  openai: "bg-green-500",
  google: "bg-blue-500",
  xai: "bg-gray-500",
  moonshot: "bg-purple-500",
  cursor: "bg-[#14120b]",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString();
}

function formatCurrency(num: number): string {
  return `$${num.toFixed(0)}`;
}

function calculateTokensFromBudget(
  model: Model,
  budget: number,
  ratio: number,
  maxMode: boolean,
  useCaching: boolean = false,
  cacheHitRate: number = 0
): { total: number; input: number; output: number } {
  // Calculate effective input rate with caching
  let effectiveInputRate = model.rates.input;
  if (useCaching && model.rates.cache_read && model.rates.cache_write && cacheHitRate > 0) {
    const RE_READS = 3;
    const cachedRatio = cacheHitRate / 100;
    const uncachedRatio = 1 - cachedRatio;
    const cacheWriteCost = cachedRatio * model.rates.cache_write;
    const cacheReadCost = cachedRatio * model.rates.cache_read * RE_READS;
    const uncachedCost = uncachedRatio * model.rates.input * RE_READS;
    effectiveInputRate = (cacheWriteCost + cacheReadCost + uncachedCost) / RE_READS;
  }
  
  // Apply Max Mode multiplier if enabled
  if (maxMode && model.max_mode_available) {
    effectiveInputRate *= 1.2;
  }
  
  const outputRate = maxMode && model.max_mode_available 
    ? model.rates.output * 1.2 
    : model.rates.output;
  
  // For ratio R:1 (input:output), cost per "cycle" is:
  // (R × inputRate + 1 × outputRate) / 1M
  // Number of cycles = budget / cost_per_cycle
  const costPerCycle = (ratio * effectiveInputRate + outputRate) / 1_000_000;
  const cycles = budget / costPerCycle;
  
  const inputTokens = Math.floor(cycles * ratio);
  const outputTokens = Math.floor(cycles);
  
  return {
    total: inputTokens + outputTokens,
    input: inputTokens,
    output: outputTokens,
  };
}

function calculateCostFromTokens(
  model: Model,
  tokens: number,
  ratio: number,
  maxMode: boolean,
  useCaching: boolean = false,
  cacheHitRate: number = 0
): number {
  const weightInput = ratio / (ratio + 1);
  const inputTokens = tokens * weightInput;
  const outputTokens = tokens - inputTokens;
  const maxMultiplier = maxMode && model.max_mode_available ? 1.2 : 1;
  
  let inputCost: number;
  
  if (useCaching && model.rates.cache_read && model.rates.cache_write && cacheHitRate > 0) {
    // With caching: blend of cached and uncached input tokens
    const cachedTokens = inputTokens * (cacheHitRate / 100);
    const uncachedTokens = inputTokens - cachedTokens;
    
    // Pay cache_write once for cached portion, then cache_read for reads
    // Assume 3x re-read pattern for iterative coding
    const RE_READS = 3;
    const cacheWriteCost = (cachedTokens / 1_000_000) * model.rates.cache_write;
    const cacheReadCost = (cachedTokens / 1_000_000) * model.rates.cache_read * RE_READS;
    const uncachedCost = (uncachedTokens / 1_000_000) * model.rates.input * RE_READS;
    
    inputCost = cacheWriteCost + cacheReadCost + uncachedCost;
  } else {
    // Without caching: standard input rate
    inputCost = (inputTokens / 1_000_000) * model.rates.input;
  }
  
  const outputCost = (outputTokens / 1_000_000) * model.rates.output;
  return (inputCost + outputCost) * maxMultiplier;
}

function getBestPlan(apiCost: number): { plan: PlanKey; totalCost: number; overage: number; poolCovers: boolean } {
  const options = (["pro", "pro_plus", "ultra"] as PlanKey[]).map((key) => {
    const plan = PRICING.plans[key];
    const overage = Math.max(0, apiCost - plan.api_pool);
    return {
      plan: key,
      totalCost: plan.monthly_cost + overage,
      overage,
      poolCovers: apiCost <= plan.api_pool,
    };
  });
  return options.reduce((best, current) => (current.totalCost < best.totalCost ? current : best));
}

// ─── Components ───────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex bg-white rounded-full p-1 shadow-sm border border-[#e0e0d8]">
        <button
          onClick={() => onChange("budget")}
          className={`px-6 py-2.5 rounded-full font-medium text-sm transition-all ${
            mode === "budget"
              ? "bg-[#14120b] text-white shadow-sm"
              : "text-[#14120b]/60 hover:text-[#14120b]"
          }`}
        >
          I have a budget
        </button>
        <button
          onClick={() => onChange("tokens")}
          className={`px-6 py-2.5 rounded-full font-medium text-sm transition-all ${
            mode === "tokens"
              ? "bg-[#14120b] text-white shadow-sm"
              : "text-[#14120b]/60 hover:text-[#14120b]"
          }`}
        >
          I know my usage
        </button>
      </div>
    </div>
  );
}

function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: Model[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedModels = options.filter((m) => selected.includes(m.id));
  const unselectedModels = options.filter((m) => !selected.includes(m.id));

  return (
    <div className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-[#e0e0d8] rounded-xl px-4 py-3 flex items-center justify-between hover:border-[#14120b]/30 transition-colors cursor-pointer"
      >
        <div className="flex flex-wrap gap-2">
          {selectedModels.length === 0 ? (
            <span className="text-[#14120b]/40">{placeholder}</span>
          ) : (
            selectedModels.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1.5 bg-[#f7f7f4] rounded-full px-3 py-1 text-sm">
                <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[m.provider] || "bg-gray-400"}`} />
                <span className="font-medium">{m.name}</span>
              </span>
            ))
          )}
        </div>
        <svg className={`w-5 h-5 text-[#14120b]/40 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-[#e0e0d8] rounded-xl shadow-lg max-h-72 overflow-auto">
            {unselectedModels.length > 0 && (
              <div className="p-2">
                {unselectedModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => onChange([...selected, model.id])}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#f7f7f4] rounded-lg text-left"
                  >
                    <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[model.provider] || "bg-gray-400"}`} />
                    <div className="flex-1">
                      <span className="font-medium">{model.name}</span>
                      <span className="text-xs text-[#14120b]/40 ml-2">${model.rates.input}/${model.rates.output} per M</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedModels.length > 0 && unselectedModels.length > 0 && <div className="border-t border-[#e0e0d8]" />}
            {selectedModels.length > 0 && (
              <div className="p-2">
                <p className="text-xs font-medium text-[#14120b]/40 px-3 py-1 uppercase tracking-wide">Selected</p>
                {selectedModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => onChange(selected.filter((id) => id !== model.id))}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 rounded-lg text-left"
                  >
                    <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[model.provider] || "bg-gray-400"}`} />
                    <span className="font-medium">{model.name}</span>
                    <span className="ml-auto text-red-500 text-sm">Remove</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BestPlanCard({
  bestPlan,
  mode,
  primaryValue,
  primaryModel,
}: {
  bestPlan: { plan: PlanKey; totalCost: number; overage: number; poolCovers: boolean };
  mode: Mode;
  primaryValue: { total: number; input: number; output: number } | number;
  primaryModel: Model;
}) {
  const plan = PRICING.plans[bestPlan.plan];
  const otherPlans = (["pro", "pro_plus", "ultra"] as PlanKey[]).filter((k) => k !== bestPlan.plan);

  // Normalize primaryValue to the object format
  const tokens = typeof primaryValue === "number" 
    ? { total: primaryValue, input: Math.round((primaryValue * 3) / 4), output: Math.round(primaryValue / 4) }
    : primaryValue;

  return (
    <div className="bg-[#14120b] text-white rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium text-white/70 uppercase tracking-wide">Your Best Option</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-6">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold">{plan.name}</h2>
          <p className="text-white/60 text-sm mt-1">{plan.description}</p>
        </div>
        <div className="text-right">
          <p className="text-4xl sm:text-5xl font-bold">{formatCurrency(bestPlan.totalCost)}</p>
          <p className="text-white/60 text-sm">/month</p>
        </div>
      </div>

      <div className="space-y-3 border-t border-white/20 pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-white/60">Base subscription</span>
          <span>{formatCurrency(plan.monthly_cost)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60">API pool included</span>
          <span className={bestPlan.poolCovers ? "text-green-400" : ""}>
            {formatCurrency(plan.api_pool)}
            {bestPlan.poolCovers && " ✓"}
          </span>
        </div>
        {bestPlan.overage > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-white/60">Overage</span>
            <span className="text-amber-400">+${bestPlan.overage.toFixed(2)}</span>
          </div>
        )}
      </div>

      {mode === "budget" && (
        <div className="mt-6 pt-4 border-t border-white/20">
          <p className="text-sm text-white/60 mb-2">What you get with {primaryModel.name}:</p>
          <p className="text-2xl font-bold">{formatNumber(tokens.total)} tokens</p>
          <p className="text-sm text-white/50">
            ≈ {formatNumber(tokens.input)} in / {formatNumber(tokens.output)} out
          </p>
        </div>
      )}

      {mode === "tokens" && bestPlan.poolCovers && (
        <div className="mt-6 pt-4 border-t border-white/20">
          <p className="text-green-400 text-sm font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Your usage fits entirely in the API pool
          </p>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-white/10 text-xs text-white/40">
        Compare to: {otherPlans.map((k) => `${PRICING.plans[k].name} (${formatCurrency(PRICING.plans[k].monthly_cost)})`).join(" or ")}
      </div>
    </div>
  );
}

function ComparisonTable({
  models,
  mode,
  budget,
  tokens,
  ratio,
  maxMode,
  useCaching,
  cacheHitRate,
}: {
  models: Model[];
  mode: Mode;
  budget: number;
  tokens: number;
  ratio: number;
  maxMode: boolean;
  useCaching: boolean;
  cacheHitRate: number;
}) {
  const results = models.map((model) => {
    if (mode === "budget") {
      // With caching enabled, you get more tokens for the same budget
      const tokenResult = calculateTokensFromBudget(model, budget, ratio, maxMode, useCaching, cacheHitRate);
      return { model, value: tokenResult.total, display: `${formatNumber(tokenResult.total)} tokens` };
    } else {
      const cost = calculateCostFromTokens(model, tokens, ratio, maxMode, useCaching, cacheHitRate);
      return { model, value: cost, display: formatCurrency(cost) };
    }
  });

  return (
    <div className="bg-white border border-[#e0e0d8] rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#f7f7f4]">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-[#14120b]/60">Model</th>
            <th className="text-right px-4 py-3 font-medium text-[#14120b]/60">
              {mode === "budget" ? "Tokens you get" : "Monthly cost"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e0e0d8]">
          {results.map(({ model, display }) => (
            <tr key={model.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[model.provider] || "bg-gray-400"}`} />
                  <span className="font-medium">{model.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-semibold">{display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const [mode, setMode] = useState<Mode>("budget");
  const [selectedModels, setSelectedModels] = useState<string[]>(["claude-4-6-sonnet"]);
  const [budget, setBudget] = useState<number>(60);
  const [tokens, setTokens] = useState<number>(1_000_000);
  const [inputRatio, setInputRatio] = useState<number>(3);
  const [useMaxMode, setUseMaxMode] = useState<boolean>(false);
  const [useCaching, setUseCaching] = useState<boolean>(false);
  const [cacheHitRate, setCacheHitRate] = useState<number>(50);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const apiModels = PRICING.models.filter((m) => m.pool === "api");
  const selectedModelObjects = useMemo(() => apiModels.filter((m) => selectedModels.includes(m.id)), [apiModels, selectedModels]);
  const primaryModel = selectedModelObjects[0] || apiModels[0];

  const primaryValue = useMemo(() => {
    if (mode === "budget") {
      // With caching, the same budget gets you more tokens
      return calculateTokensFromBudget(primaryModel, budget, inputRatio, useMaxMode, useCaching, cacheHitRate);
    }
    return tokens;
  }, [mode, primaryModel, budget, tokens, inputRatio, useMaxMode, useCaching, cacheHitRate]);

  const apiCost = useMemo(() => {
    if (mode === "budget") return budget;
    return selectedModelObjects.reduce((sum, m) => sum + calculateCostFromTokens(m, tokens, inputRatio, useMaxMode, useCaching, cacheHitRate), 0);
  }, [mode, budget, tokens, selectedModelObjects, inputRatio, useMaxMode, useCaching, cacheHitRate]);

  const bestPlan = useMemo(() => getBestPlan(apiCost), [apiCost]);

  return (
    <div className="min-h-screen bg-[#f7f7f4] text-[#14120b]">
      {/* Header */}
      <header className="bg-white border-b border-[#e0e0d8]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#14120b] rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold">Cursor Cost Calculator</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Mode Toggle */}
        <ModeToggle mode={mode} onChange={setMode} />

        {/* Primary Input */}
        <div className="mt-8 text-center">
          <p className="text-[#14120b]/60 mb-4">
            {mode === "budget" ? "What's your monthly budget?" : "How many tokens per month?"}
          </p>

          {mode === "budget" ? (
            <div className="text-center">
              <div className="inline-flex items-baseline gap-1">
                <span className="text-2xl font-medium text-[#14120b]/40">$</span>
                <input
                  type="text"
                  value={budget.toLocaleString()}
                  onChange={(e) => {
                    const val = parseInt(e.target.value.replace(/,/g, ""), 10);
                    setBudget(isNaN(val) ? 0 : val);
                  }}
                  className="w-48 sm:w-56 text-6xl sm:text-7xl md:text-8xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-center p-0"
                />
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-baseline gap-2">
                <input
                  type="text"
                  value={tokens.toLocaleString()}
                  onChange={(e) => {
                    const val = parseInt(e.target.value.replace(/,/g, ""), 10);
                    setTokens(isNaN(val) ? 0 : val);
                  }}
                  className="w-72 sm:w-96 md:w-[28rem] text-4xl sm:text-5xl md:text-6xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-center p-0 overflow-visible"
                />
                <span className="text-lg sm:text-xl text-[#14120b]/40">tokens</span>
              </div>
              {tokens >= 1_000 && (
                <p className="text-lg text-[#14120b]/50 mt-2 font-medium">
                  {tokens >= 1_000_000_000 
                    ? `${(tokens / 1_000_000_000).toFixed(tokens % 1_000_000_000 === 0 ? 0 : 2)} billion`
                    : tokens >= 1_000_000 
                    ? `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 2)} million`
                    : `${(tokens / 1_000).toFixed(tokens % 1_000 === 0 ? 0 : 1)}k`
                  }
                </p>
              )}
            </div>
          )}

          {/* Slider */}
          <div className="mt-6 px-4">
            {mode === "budget" ? (
              <input
                type="range"
                min="20"
                max="500"
                step="10"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]"
              />
            ) : (
              <input
                type="range"
                min="100000"
                max="1000000000"
                step="100000"
                value={Math.min(tokens, 1_000_000_000)}
                onChange={(e) => setTokens(Number(e.target.value))}
                className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]"
              />
            )}
            <div className="flex justify-between text-xs text-[#14120b]/40 mt-2">
              {mode === "budget" ? (
                <>
                  <span>$20</span>
                  <span>$200</span>
                  <span>$500</span>
                </>
              ) : (
                <>
                  <span>100k</span>
                  <span>500M</span>
                  <span>1B</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Model Selector */}
        <div className="mt-8">
          <label className="block text-sm font-medium text-[#14120b]/60 mb-2">Models to compare</label>
          <MultiSelectDropdown
            options={apiModels}
            selected={selectedModels}
            onChange={setSelectedModels}
            placeholder="Select models..."
          />
        </div>

        {/* Options - Max Mode & Caching */}
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer bg-white rounded-xl border border-[#e0e0d8] p-3 hover:border-[#14120b]/30 transition-colors">
            <input
              type="checkbox"
              checked={useMaxMode}
              onChange={(e) => setUseMaxMode(e.target.checked)}
              className="w-5 h-5 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]"
            />
            <div className="flex-1">
              <span className="font-medium">Max Mode (+20%)</span>
              <p className="text-xs text-[#14120b]/50">Extended context window, 20% higher API rates</p>
            </div>
          </label>

          {/* Caching Option - only show for models that support it */}
          {primaryModel.rates.cache_read && primaryModel.rates.cache_write && (
            <div className="bg-white rounded-xl border border-[#e0e0d8] p-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCaching}
                  onChange={(e) => setUseCaching(e.target.checked)}
                  className="w-5 h-5 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]"
                />
                <div className="flex-1">
                  <span className="font-medium">Enable Caching</span>
                  <p className="text-xs text-[#14120b]/50">
                    Cache reads are {Math.round(primaryModel.rates.input / primaryModel.rates.cache_read)}× cheaper than input
                  </p>
                </div>
              </label>
              
              {useCaching && (
                <div className="mt-3 pt-3 border-t border-[#e0e0d8]">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Cache Hit Rate</label>
                    <span className="text-sm font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{cacheHitRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="95"
                    step="5"
                    value={cacheHitRate}
                    onChange={(e) => setCacheHitRate(Number(e.target.value))}
                    className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-[#14120b]/40 mt-1">
                    <span>0% (no cache)</span>
                    <span>50% typical</span>
                    <span>95% max</span>
                  </div>
                  {cacheHitRate > 0 && (
                    <p className="text-xs text-blue-600 mt-2">
                      With {cacheHitRate}% cache hit rate, you could save approximately {Math.round(cacheHitRate * 0.4)}% on input costs
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

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
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Input : Output Ratio</label>
                  <span className="text-sm font-semibold bg-[#f7f7f4] px-2 py-0.5 rounded">{inputRatio} : 1</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={inputRatio}
                  onChange={(e) => setInputRatio(Number(e.target.value))}
                  className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]"
                />
                <div className="flex justify-between text-xs text-[#14120b]/40 mt-1">
                  <span>1:1</span>
                  <span>3:1 typical</span>
                  <span>10:1</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Result Card */}
        <div className="mt-8">
          <BestPlanCard
            bestPlan={bestPlan}
            mode={mode}
            primaryValue={primaryValue}
            primaryModel={primaryModel}
          />
        </div>

        {/* Comparison Table */}
        {selectedModels.length > 1 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-[#14120b]/60 mb-3">All models compared</h3>
            <ComparisonTable
              models={selectedModelObjects}
              mode={mode}
              budget={budget}
              tokens={tokens}
              ratio={inputRatio}
              maxMode={useMaxMode}
              useCaching={useCaching}
              cacheHitRate={cacheHitRate}
            />
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-12 pt-8 border-t border-[#e0e0d8] text-sm text-[#14120b]/60 space-y-4">
          <p>
            <strong>How plans work:</strong> All plans include unlimited Auto and Composer 1.5 through a separate pool. 
            The API pool is used for all other models. Once exhausted, you pay overage at the same rates.
          </p>
          <p>
            <strong>Max Mode:</strong> Extends context to maximum supported but adds 20% to API rates.
          </p>
          <p className="text-xs text-[#14120b]/40 text-center">
            Source: cursor.com/docs/models-and-pricing · Last updated March 2026
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
