import { describe, expect, it } from 'vitest';

import { getImportReplayModels } from '../../domain/importReplay/catalog';
import { getManualApiModels, getPlans } from '../../domain/catalog/currentCatalog';
import type { ModelConfig } from '../../lib/types';
import { createInitialCalculatorState } from '../calculatorState';
import { calculatorReducer } from '../calculatorReducer';
import {
  selectCursorImportReport,
  selectIsImportMode,
  selectRecommendation,
  selectSelectedFileName,
  selectSelectedModelIds,
  selectShowManualControls,
} from '../calculatorSelectors';

const manualModels = getManualApiModels();
const importReplayModels = getImportReplayModels();
const plans = getPlans();

describe('createInitialCalculatorState', () => {
  it('builds the default calculator state from the manual catalog', () => {
    const state = createInitialCalculatorState(manualModels);

    expect(state.mode).toBe('budget');
    expect(state.tokenSource).toBe('manual');
    expect(state.budget).toBe(60);
    expect(state.tokens).toBe(1_000_000);
    expect(state.manualTokenInputMode).toBe('simple');
    expect(state.cacheReadShare).toBe(0);
    expect(state.manualExactTokens).toEqual({
      inputWithCacheWrite: 0,
      inputWithoutCacheWrite: 750_000,
      cacheRead: 0,
      output: 250_000,
      total: 1_000_000,
    });
    expect(state.inputRatio).toBe(3);
    expect(state.showAdvanced).toBe(false);
    expect(state.cursorImportFiles).toEqual([]);
    expect(state.cursorImportError).toBeNull();
    expect(state.isImporting).toBe(false);
    expect(state.cursorImportOptions).toEqual({
      includeUserApiKey: true,
      approximationMode: 'best_effort',
    });
    expect(state.modelConfigs).toHaveLength(1);
    expect(state.modelConfigs[0]?.modelId).toBe('claude-sonnet-4-6');
    expect(state.modelConfigs[0]?.weight).toBe(100);
  });
});

describe('calculatorReducer', () => {
  it('updates primitive calculator fields and model configs', () => {
    const initial = createInitialCalculatorState(manualModels);
    const customConfigs: ModelConfig[] = [
      {
        modelId: 'gpt-5',
        weight: 100,
        maxMode: false,
        fast: false,
        thinking: false,
        caching: false,
        cacheHitRate: 75,
      },
    ];

    const state = [
      { type: 'set_mode', mode: 'tokens' } as const,
      { type: 'set_token_source', tokenSource: 'cursor_import' } as const,
      { type: 'set_budget', budget: 120 } as const,
      { type: 'set_tokens', tokens: 2_500_000 } as const,
      { type: 'set_manual_token_input_mode', manualTokenInputMode: 'advanced' } as const,
      { type: 'set_cache_read_share', cacheReadShare: 82 } as const,
      {
        type: 'set_manual_exact_tokens',
        manualExactTokens: {
          inputWithCacheWrite: 100_000,
          inputWithoutCacheWrite: 200_000,
          cacheRead: 300_000,
          output: 400_000,
          total: 0,
        },
      } as const,
      { type: 'set_input_ratio', inputRatio: 4 } as const,
      { type: 'set_show_advanced', showAdvanced: true } as const,
      { type: 'set_model_configs', modelConfigs: customConfigs } as const,
    ].reduce(calculatorReducer, initial);

    expect(state.mode).toBe('tokens');
    expect(state.tokenSource).toBe('cursor_import');
    expect(state.budget).toBe(120);
    expect(state.tokens).toBe(1_000_000);
    expect(state.manualTokenInputMode).toBe('advanced');
    expect(state.cacheReadShare).toBe(82);
    expect(state.manualExactTokens).toEqual({
      inputWithCacheWrite: 100_000,
      inputWithoutCacheWrite: 200_000,
      cacheRead: 300_000,
      output: 400_000,
      total: 1_000_000,
    });
    expect(state.inputRatio).toBe(4);
    expect(state.showAdvanced).toBe(true);
    expect(state.modelConfigs).toEqual(customConfigs);
  });

  it('reconciles selected model ids into normalized configs', () => {
    const initial = createInitialCalculatorState(manualModels);

    const state = calculatorReducer(initial, {
      type: 'reconcile_selected_models',
      ids: ['claude-sonnet-4-6', 'gpt-5'],
      manualModels,
    });

    expect(state.modelConfigs).toHaveLength(2);
    expect(state.modelConfigs.map((config) => config.modelId)).toEqual([
      'claude-sonnet-4-6',
      'gpt-5',
    ]);
    expect(state.modelConfigs.map((config) => config.weight)).toEqual([50, 50]);
  });

  it('tracks the import lifecycle and clears stale state on failure', () => {
    const initial = createInitialCalculatorState(manualModels);

    const loading = calculatorReducer(initial, { type: 'import_started' });
    expect(loading.isImporting).toBe(true);
    expect(loading.cursorImportError).toBeNull();

    const loaded = calculatorReducer(loading, {
      type: 'import_loaded',
      files: [{ name: 'cursor-usage.csv', text: 'csv-body' }],
    });
    expect(loaded.isImporting).toBe(false);
    expect(loaded.cursorImportFiles).toEqual([{ name: 'cursor-usage.csv', text: 'csv-body' }]);
    expect(loaded.cursorImportError).toBeNull();

    const failed = calculatorReducer(loaded, {
      type: 'import_failed',
      error: 'Could not read the selected CSV files.',
    });
    expect(failed.isImporting).toBe(false);
    expect(failed.cursorImportFiles).toEqual([]);
    expect(failed.cursorImportError).toBe('Could not read the selected CSV files.');
  });

  it('stores import options used by derived replay parsing', () => {
    const initial = createInitialCalculatorState(manualModels);
    const loaded = calculatorReducer(initial, {
      type: 'import_loaded',
      files: [{
        name: 'cursor-usage.csv',
        text: `Date,User,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Requests
"2026-02-10T13:06:04.478Z","developer@jasonholtdigital.com","User API Key","gpt-5","No","0","100000","0","10000","110000","1"`,
      }],
    });
    const includedReport = selectCursorImportReport(loaded, importReplayModels);
    const excludedState = calculatorReducer(loaded, {
      type: 'set_cursor_import_options',
      cursorImportOptions: {
        includeUserApiKey: false,
        approximationMode: 'best_effort',
      },
    });
    const excludedReport = selectCursorImportReport(excludedState, importReplayModels);

    expect(includedReport?.summary.pricedApiTokens).toBe(110_000);
    expect(excludedReport?.summary.pricedApiTokens).toBe(0);
    expect(excludedReport?.summary.excludedTokens).toBe(110_000);
  });
});

describe('navigate action', () => {
  it('navigates to budget mode and resets tokenSource', () => {
    const initial = createInitialCalculatorState(manualModels);
    // Start from csv_import so tokenSource is cursor_import
    const fromImport = calculatorReducer(initial, { type: 'navigate', target: 'csv_import' });
    expect(fromImport.tokenSource).toBe('cursor_import');
    const state = calculatorReducer(fromImport, { type: 'navigate', target: 'budget' });
    expect(state.mode).toBe('budget');
    expect(state.tokenSource).toBe('manual');
  });

  it('navigates to manual usage mode', () => {
    const initial = createInitialCalculatorState(manualModels);
    const state = calculatorReducer(initial, { type: 'navigate', target: 'manual_usage' });
    expect(state.mode).toBe('tokens');
    expect(state.tokenSource).toBe('manual');
  });

  it('navigates to csv import mode', () => {
    const initial = createInitialCalculatorState(manualModels);
    const state = calculatorReducer(initial, { type: 'navigate', target: 'csv_import' });
    expect(state.mode).toBe('tokens');
    expect(state.tokenSource).toBe('cursor_import');
  });
});

describe('calculatorSelectors', () => {
  it('derives the current UI mode flags and file name', () => {
    const initial = createInitialCalculatorState(manualModels);
    const importModeState = calculatorReducer(
      calculatorReducer(initial, { type: 'set_mode', mode: 'tokens' }),
      { type: 'set_token_source', tokenSource: 'cursor_import' },
    );
    const loaded = calculatorReducer(importModeState, {
      type: 'import_loaded',
      files: [{ name: 'cursor-usage.csv', text: 'csv-body' }],
    });

    expect(selectIsImportMode(loaded)).toBe(true);
    expect(selectShowManualControls(loaded)).toBe(false);
    expect(selectSelectedFileName(loaded)).toBe('cursor-usage.csv');
    expect(selectSelectedModelIds(loaded)).toEqual(['claude-sonnet-4-6']);
  });

  it('derives an import replay report from loaded CSV text', () => {
    const initial = createInitialCalculatorState(manualModels);
    const state = calculatorReducer(
      calculatorReducer(initial, { type: 'set_mode', mode: 'tokens' }),
      {
        type: 'import_loaded',
        files: [{
          name: 'cursor-usage.csv',
          text: `Date,User,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Requests
"2026-02-10T13:06:04.478Z","developer@jasonholtdigital.com","Included","gpt-5","No","0","100000","0","10000","110000","1"`,
        }],
      },
    );

    const report = selectCursorImportReport(state, importReplayModels);

    expect(report?.summary.totalRows).toBe(1);
    expect(report?.summary.pricedApiTokens).toBe(110_000);
    expect(report?.pricedEntries[0]?.modelId).toBe('gpt-5');
  });

  it('selects a recommendation for both manual and import flows', () => {
    const manualState = [
      { type: 'set_mode', mode: 'tokens' } as const,
      { type: 'set_cache_read_share', cacheReadShare: 80 } as const,
    ].reduce(calculatorReducer, createInitialCalculatorState(manualModels));
    const manualRecommendation = selectRecommendation(manualState, {
      manualModels,
      importReplayModels,
      plans,
      cursorImportReport: selectCursorImportReport(manualState, importReplayModels),
    });

    expect(manualRecommendation?.best.plan).toBeTruthy();
    expect(manualRecommendation?.best.perModel[0]?.exactTokens?.cacheRead).toBe(800_000);

    const importState = calculatorReducer(
      calculatorReducer(
        createInitialCalculatorState(manualModels),
        { type: 'set_mode', mode: 'tokens' },
      ),
      { type: 'set_token_source', tokenSource: 'cursor_import' },
    );
    const importLoadedState = calculatorReducer(
      importState,
      {
        type: 'import_loaded',
        files: [{
          name: 'cursor-usage.csv',
          text: `Date,User,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Requests
"2026-02-10T13:06:04.478Z","developer@jasonholtdigital.com","Included","gpt-5","No","0","100000","0","10000","110000","1"`,
        }],
      },
    );
    const importRecommendation = selectRecommendation(importLoadedState, {
      manualModels,
      importReplayModels,
      plans,
      cursorImportReport: selectCursorImportReport(importLoadedState, importReplayModels),
    });

    expect(importRecommendation?.best.plan).toBe('pro');
  });
});
