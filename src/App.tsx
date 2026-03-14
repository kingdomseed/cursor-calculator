import { Analytics } from '@vercel/analytics/react';
import { getPricingCatalog } from './domain/catalog/currentCatalog';
import { useCalculatorController } from './app/useCalculatorController';
import { SidebarLayout } from './components/SidebarLayout';
import { BudgetInput } from './components/BudgetInput';
import { TokenInput } from './components/TokenInput';
import { ModelSelector } from './components/ModelSelector';
import { ModelConfigList } from './components/ModelConfigList';
import { BestPlanCard } from './components/BestPlanCard';
import { PlanComparison } from './components/PlanComparison';
import { CursorImportPanel } from './components/CursorImportPanel';
import { Collapsible } from './components/Collapsible';
import { WelcomeModal } from './components/WelcomeModal';

const PRICING = getPricingCatalog();

function App() {
  const {
    state: {
      mode,
      tokenSource,
      budget,
      tokens,
      manualTokenInputMode,
      cacheReadShare,
      manualExactTokens,
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
    navigationTarget,
    navigate,
    setBudget,
    setTokens,
    setManualTokenInputMode,
    setCacheReadShare,
    setManualExactTokens,
    setInputRatio,
    setShowAdvanced,
    setModelConfigs,
    handleModelSelectionChange,
    handleCursorImportFilesSelected,
    handleApproximationModeChange,
    handleIncludeUserApiKeyChange,
  } = useCalculatorController();

  return (
    <>
      <WelcomeModal />
      <SidebarLayout activeTarget={navigationTarget} onNavigate={navigate} pricingDate={PRICING.meta.retrieved_at}>
        <div>
          {mode === 'budget' ? (
            <>
              <BudgetInput value={budget} onChange={setBudget} />
              <div className="mt-6 p-4 bg-white rounded-xl border border-[#e0e0d8]">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Cache-read share</label>
                  <span className="text-sm font-semibold bg-[#f7f7f4] px-2 py-0.5 rounded">
                    {cacheReadShare}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={cacheReadShare}
                  onChange={(e) => setCacheReadShare(Number(e.target.value))}
                  className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]"
                />
                <div className="flex justify-between text-xs text-[#14120b]/40 mt-1">
                  <span>0%</span><span>No caching</span><span>100%</span>
                </div>
                <p className="text-xs text-[#14120b]/50 mt-2">
                  Cache reads are 90% cheaper than input tokens. Higher cache share means more tokens per dollar.
                </p>
              </div>
            </>
          ) : tokenSource === 'manual' ? (
            <TokenInput
              value={tokens}
              onChange={setTokens}
              manualTokenInputMode={manualTokenInputMode}
              onManualTokenInputModeChange={setManualTokenInputMode}
              cacheReadShare={cacheReadShare}
              onCacheReadShareChange={setCacheReadShare}
              exactTokens={manualExactTokens}
              onExactTokensChange={setManualExactTokens}
            />
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

            {(mode === 'budget' || (mode === 'tokens' && tokenSource === 'manual' && manualTokenInputMode === 'simple')) && (
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
                <Collapsible open={showAdvanced}>
                  <div className="mt-4 p-4 bg-white rounded-xl border border-[#e0e0d8]">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">
                        {mode === 'tokens' ? 'Non-cache Input : Output Ratio' : 'Input : Output Ratio'}
                      </label>
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
                </Collapsible>
              </div>
            )}
          </>
        )}

        {recommendation && recommendationPresentation && (
          <>
            <div className="mt-8">
              <BestPlanCard presentation={recommendationPresentation} />
            </div>
            <PlanComparison presentation={recommendationPresentation} />
          </>
        )}
      </SidebarLayout>
      <Analytics />
    </>
  );
}

export default App;
