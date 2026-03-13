import { Analytics } from '@vercel/analytics/react';
import { getPricingCatalog } from './domain/catalog/currentCatalog';
import { useCalculatorController } from './app/useCalculatorController';
import { ModeToggle } from './components/ModeToggle';
import { BudgetInput } from './components/BudgetInput';
import { TokenInput } from './components/TokenInput';
import { ModelSelector } from './components/ModelSelector';
import { ModelConfigList } from './components/ModelConfigList';
import { BestPlanCard } from './components/BestPlanCard';
import { PlanComparison } from './components/PlanComparison';
import { CursorImportPanel } from './components/CursorImportPanel';
import { WelcomeModal } from './components/WelcomeModal';
import { CalculatorIcon, GitHubIcon, JHDIcon } from './components/Icons';

const PRICING = getPricingCatalog();

function App() {
  const {
    state: {
      mode,
      tokenSource,
      budget,
      tokens,
      inputRatio,
      showAdvanced,
      cursorImportError,
      isImporting,
      cursorImportOptions,
      modelConfigs,
    },
    manualModels,
    selectedModelIds,
    selectedModels,
    showManualControls,
    selectedFileName,
    cursorImportReport,
    recommendation,
    recommendationPresentation,
    setMode,
    setTokenSource,
    setBudget,
    setTokens,
    setInputRatio,
    setShowAdvanced,
    setModelConfigs,
    handleModelSelectionChange,
    handleCursorImportFilesSelected,
    handleApproximationModeChange,
    handleIncludeUserApiKeyChange,
  } = useCalculatorController();

  return (
    <div className="min-h-screen bg-[#f7f7f4] text-[#14120b]">
      <WelcomeModal />
      <header className="bg-white border-b border-[#e0e0d8]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#14120b] rounded-lg flex items-center justify-center">
            <CalculatorIcon className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold">Cursor Cost Calculator</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <ModeToggle mode={mode} onChange={setMode} />

        {mode === 'tokens' && (
          <div className="mt-6 flex justify-center">
            <div className="inline-flex bg-white rounded-full p-1 shadow-sm border border-[#e0e0d8]">
              <button
                onClick={() => setTokenSource('manual')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  tokenSource === 'manual'
                    ? 'bg-[#14120b] text-white shadow-sm'
                    : 'text-[#14120b]/60 hover:text-[#14120b]'
                }`}
              >
                Manual entry
              </button>
              <button
                onClick={() => setTokenSource('cursor_import')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  tokenSource === 'cursor_import'
                    ? 'bg-[#14120b] text-white shadow-sm'
                    : 'text-[#14120b]/60 hover:text-[#14120b]'
                }`}
              >
                Import Cursor CSV
              </button>
            </div>
          </div>
        )}

        <div className="mt-8">
          {mode === 'budget' ? (
            <BudgetInput value={budget} onChange={setBudget} />
          ) : tokenSource === 'manual' ? (
            <TokenInput value={tokens} onChange={setTokens} />
          ) : (
            <CursorImportPanel
              report={cursorImportReport}
              error={cursorImportError}
              selectedFileName={selectedFileName}
              isImporting={isImporting}
              approximationMode={cursorImportOptions.approximationMode}
              includeUserApiKey={cursorImportOptions.includeUserApiKey}
              onFilesSelected={handleCursorImportFilesSelected}
              onApproximationModeChange={handleApproximationModeChange}
              onIncludeUserApiKeyChange={handleIncludeUserApiKeyChange}
            />
          )}
        </div>

        {showManualControls && (
          <>
            <div className="mt-8">
              <label className="block text-sm font-medium text-[#14120b]/60 mb-2">Models to compare</label>
              <ModelSelector
                options={manualModels}
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

            <div className="mt-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-[#14120b]/60 hover:text-[#14120b]"
              >
                <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={inputRatio}
                    onChange={(event) => setInputRatio(Number(event.target.value))}
                    className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]"
                  />
                  <div className="flex justify-between text-xs text-[#14120b]/40 mt-1">
                    <span>1:1</span><span>3:1 typical</span><span>10:1</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {recommendation && recommendationPresentation && (
          <>
            <div className="mt-8">
              <BestPlanCard result={recommendation.best} mode={mode} />
            </div>
            <PlanComparison results={recommendation.all} mode={mode} />
          </>
        )}

        <div className="mt-12 pt-8 border-t border-[#e0e0d8] text-sm text-[#14120b]/60 space-y-4">
          <p>
            <strong>How plans work:</strong> Every plan includes{' '}
            <a href="https://cursor.com/docs/models-and-pricing#usage-pools" className="underline hover:text-[#14120b]" target="_blank" rel="noopener noreferrer">two usage pools</a>.
            Auto and Composer are usage-based and included in every subscription — they don't draw from the API pool.
            The API pool covers all other models. Once exhausted, you pay overage at the same per-token rates.
          </p>
          <p>
            <strong>Max Mode:</strong> Adds 20% Cursor upcharge. For extended context (1M), use the dedicated Max/1M model variants which have long-context pricing built into their rates.
          </p>
          <p className="text-xs text-[#14120b]/40">
            <strong className="text-[#14120b]/50">Disclaimer:</strong> All figures are estimates based on publicly available pricing data. Actual costs depend on your specific usage patterns, and rates may change without notice. This tool is not affiliated with Cursor. Use at your own discretion — we are not responsible for financial decisions made based on these calculations.
          </p>
          <p className="text-xs text-[#14120b]/40 text-center">
            Source: <a href="https://cursor.com/docs/models-and-pricing" className="underline hover:text-[#14120b]/60" target="_blank" rel="noopener noreferrer">cursor.com/docs/models-and-pricing</a> · Last updated {PRICING.meta.retrieved_at}
          </p>
          <p className="text-xs text-[#14120b]/40 text-center">
            <a href="https://github.com/kingdomseed/cursor-calculator" className="inline-flex items-center gap-1 underline hover:text-[#14120b]/60"><GitHubIcon className="w-3.5 h-3.5 inline" />GitHub</a>
            {' · '}
            <a href="https://jasonholtdigital.com" className="inline-flex items-center gap-1 underline hover:text-[#14120b]/60"><JHDIcon className="w-3.5 h-3.5 inline" />Jason Holt Digital</a>
          </p>
        </div>
      </main>
      <Analytics />
    </div>
  );
}

export default App;
