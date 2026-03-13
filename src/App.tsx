import { startTransition, useCallback, useMemo, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { getManualApiModels, getPricingCatalog } from './domain/catalog/currentCatalog';
import { getImportReplayModels } from './domain/importReplay/catalog';
import { parseCursorUsageFiles } from './domain/importReplay/summary';
import type { ApproximationMode, CursorImportOptions, CursorImportReport } from './domain/importReplay/types';
import { createInitialModelConfigs, reconcileSelectedModelConfigs } from './domain/modelConfig/defaults';
import { computeExactUsageRecommendation, computeRecommendation } from './domain/recommendation/recommendation';
import type { Mode, ModelConfig } from './lib/types';
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
const API_MODELS = getManualApiModels();
const IMPORT_REPLAY_MODELS = getImportReplayModels();

type TokenSource = 'manual' | 'cursor_import';
type ImportedCsvFile = { name: string; text: string };

function App() {
  const [mode, setMode] = useState<Mode>('budget');
  const [tokenSource, setTokenSource] = useState<TokenSource>('manual');
  const [budget, setBudget] = useState(60);
  const [tokens, setTokens] = useState(1_000_000);
  const [inputRatio, setInputRatio] = useState(3);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cursorImportFiles, setCursorImportFiles] = useState<ImportedCsvFile[]>([]);
  const [cursorImportReport, setCursorImportReport] = useState<CursorImportReport | null>(null);
  const [cursorImportError, setCursorImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [cursorImportOptions, setCursorImportOptions] = useState<CursorImportOptions>({
    includeUserApiKey: true,
    approximationMode: 'best_effort',
  });
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>(() => createInitialModelConfigs(API_MODELS));

  const selectedModelIds = useMemo(() => modelConfigs.map((config) => config.modelId), [modelConfigs]);
  const selectedModels = useMemo(
    () => API_MODELS.filter((model) => selectedModelIds.includes(model.id)),
    [selectedModelIds],
  );
  const isImportMode = mode === 'tokens' && tokenSource === 'cursor_import';
  const showManualControls = mode === 'budget' || tokenSource === 'manual';

  const handleModelSelectionChange = useCallback((ids: string[]) => {
    setModelConfigs((previous) => reconcileSelectedModelConfigs(previous, ids, API_MODELS));
  }, []);

  const recommendation = useMemo(() => {
    if (isImportMode) {
      if (!cursorImportReport || cursorImportReport.pricedEntries.length === 0) return null;
      return computeExactUsageRecommendation(cursorImportReport.pricedEntries, IMPORT_REPLAY_MODELS, PRICING.plans);
    }

    if (modelConfigs.length === 0) return null;
    return computeRecommendation(
      mode,
      budget,
      tokens,
      selectedModels,
      modelConfigs,
      PRICING.plans,
      inputRatio,
    );
  }, [
    budget,
    cursorImportReport,
    inputRatio,
    isImportMode,
    mode,
    modelConfigs,
    selectedModels,
    tokens,
  ]);

  async function handleCursorImportFilesSelected(files: FileList | null) {
    setCursorImportError(null);

    if (!files || files.length === 0) {
      return;
    }

    setIsImporting(true);
    try {
      const selectedFile = files[0];
      const loadedFiles = [{
        name: selectedFile.name,
        text: await selectedFile.text(),
      }];

      setCursorImportFiles(loadedFiles);
      const report = parseCursorUsageFiles(loadedFiles, IMPORT_REPLAY_MODELS, cursorImportOptions);
      startTransition(() => setCursorImportReport(report));
    } catch {
      setCursorImportFiles([]);
      startTransition(() => setCursorImportReport(null));
      setCursorImportError('Could not read the selected CSV files.');
    } finally {
      setIsImporting(false);
    }
  }

  function applyCursorImportOptions(nextOptions: CursorImportOptions) {
    setCursorImportOptions(nextOptions);
    if (cursorImportFiles.length === 0) return;

    const report = parseCursorUsageFiles(cursorImportFiles, IMPORT_REPLAY_MODELS, nextOptions);
    startTransition(() => setCursorImportReport(report));
  }

  function handleApproximationModeChange(nextMode: ApproximationMode) {
    applyCursorImportOptions({
      ...cursorImportOptions,
      approximationMode: nextMode,
    });
  }

  function handleIncludeUserApiKeyChange(checked: boolean) {
    applyCursorImportOptions({
      ...cursorImportOptions,
      includeUserApiKey: checked,
    });
  }

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
              selectedFileName={cursorImportFiles[0]?.name ?? null}
              isImporting={isImporting}
              approximationMode={cursorImportOptions.approximationMode ?? 'best_effort'}
              includeUserApiKey={cursorImportOptions.includeUserApiKey ?? true}
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

        {recommendation && (
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
