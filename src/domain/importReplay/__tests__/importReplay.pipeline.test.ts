import { describe, expect, it } from 'vitest';

import { getImportReplayModelById, getImportReplayModels } from '../catalog';
import { normalizeImportedModel } from '../normalization';
import { parseCursorCsvText } from '../csvParser';
import { priceImportedRow } from '../pricing';
import { parseCursorUsageFiles } from '../summary';
import type { CursorImportOptions, ExactTokenBreakdown, SupportedNormalization } from '../types';

const IMPORT_REPLAY_MODELS = getImportReplayModels();
const IMPORT_REPLAY_MODEL_BY_ID = new Map(
  IMPORT_REPLAY_MODELS.map((model) => [model.id, model]),
);

const baseOptions: CursorImportOptions = {
  includeUserApiKey: true,
  approximationMode: 'best_effort',
};

describe('parseCursorCsvText', () => {
  it('parses rows and reconstructs total tokens from the detailed columns', () => {
    const rows = parseCursorCsvText(`Date,User,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Requests
"2026-02-19T13:06:04.478Z","developer@jasonholtdigital.com","Included","gpt-5-fast","No","0","1000000","250000","500000","0","1"`);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dayKey: '2026-02-19',
      kind: 'Included',
      model: 'gpt-5-fast',
      maxMode: false,
    });
    expect(rows[0].tokens).toEqual({
      inputWithCacheWrite: 0,
      inputWithoutCacheWrite: 1_000_000,
      cacheRead: 250_000,
      output: 500_000,
      total: 1_750_000,
    });
  });
});

describe('normalizeImportedModel', () => {
  it('approximates unsupported GPT-5.x fast labels in best-effort mode and rejects them in strict mode', () => {
    expect(
      normalizeImportedModel(
        'gpt-5.2-xhigh-fast',
        false,
        IMPORT_REPLAY_MODEL_BY_ID,
        'best_effort',
      ),
    ).toMatchObject({
      kind: 'supported',
      modelId: 'gpt-5.2',
      fast: true,
      maxMode: false,
      thinking: false,
      approximated: true,
      rateMultiplier: 2,
    });

    expect(
      normalizeImportedModel(
        'gpt-5.2-xhigh-fast',
        false,
        IMPORT_REPLAY_MODEL_BY_ID,
        'strict',
      ),
    ).toMatchObject({
      kind: 'unsupported',
    });
  });
});

describe('priceImportedRow', () => {
  it('applies long-context companion pricing when max-mode input exceeds the default context', () => {
    const model = getImportReplayModelById('claude-opus-4-6');
    const normalized: SupportedNormalization = {
      kind: 'supported',
      modelId: 'claude-opus-4-6',
      fast: false,
      maxMode: true,
      thinking: false,
      approximated: false,
    };
    const tokens: ExactTokenBreakdown = {
      inputWithCacheWrite: 0,
      inputWithoutCacheWrite: 250_000,
      cacheRead: 0,
      output: 50_000,
      total: 300_000,
    };

    const priced = priceImportedRow(
      model!,
      normalized,
      tokens,
      IMPORT_REPLAY_MODEL_BY_ID,
    );

    expect(priced.approximated).toBe(false);
    // Opus 4.6 no longer has a long-context surcharge — same per-token rates at 1M context.
    // Cost = 250k input × $6/M (base $5 + 20% Cursor upcharge) + 50k output × $30/M = $3.00
    expect(priced.exactCost.total).toBeCloseTo(3, 4);
  });
});

describe('parseCursorUsageFiles', () => {
  const csv = `Date,User,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Requests
"2026-02-19T13:06:04.478Z","developer@jasonholtdigital.com","Included","gpt-5-fast","No","0","1000000","250000","500000","1750000","1"
"2026-02-19T13:03:31.131Z","developer@jasonholtdigital.com","On-Demand","claude-4.5-opus-high-thinking","No","100000","50000","250000","50000","450000","1"
"2026-02-19T13:00:40.253Z","developer@jasonholtdigital.com","User API Key","us.anthropic.claude-opus-4-6-v1","No","1000","1000","5000","1000","8000","1"
"2026-02-19T13:00:40.253Z","developer@jasonholtdigital.com","User API Key","gpt-5-fast","Yes","0","1000000","250000","500000","1750000","1"
"2026-02-19T12:59:21.186Z","developer@jasonholtdigital.com","Errored, No Charge","gpt-5","No","0","1000","0","1000","2000","1"
"2026-02-19T12:44:17.035Z","developer@jasonholtdigital.com","Included","agent_review","No","0","100000","0","0","100000","1"
"2025-11-11T15:27:29.116Z","developer@jasonholtdigital.com","Included","grok-4-0709","No","0","100208","5928","1576","107712","1"
"2026-02-19T12:44:02.199Z","developer@jasonholtdigital.com","Included","auto","No","0","50000","0","10000","60000","1"`;

  it('aggregates supported API usage, flags approximations, and includes API-key rows in Cursor-only estimates by default', () => {
    const report = parseCursorUsageFiles(
      [{ name: 'cursor-usage-sample.csv', text: csv }],
      IMPORT_REPLAY_MODELS,
      baseOptions,
    );

    expect(report.pricedEntries).toHaveLength(6);
    expect(report.summary.pricedApiTokens).toBe(4_165_712);
    expect(report.summary.approximatedApiTokens).toBe(665_712);
    expect(report.summary.excludedTokens).toBe(2_000);
    expect(report.summary.unsupportedTokens).toBe(0);
    expect(report.summary.includedNonApiTokens).toBe(60_000);
    expect(report.summary.activeDays).toBe(2);
    expect(report.summary.pricedApiDays).toBe(2);
    expect(report.summary.firstActiveDate).toBe('2025-11-11');
    expect(report.summary.lastActiveDate).toBe('2026-02-19');
    expect(report.summary.activeSpanDays).toBe(101);
    expect(report.summary.comparisonDays).toBe(101);
    expect(report.summary.comparisonMode).toBe('span');
    expect(report.unsupported).toHaveLength(0);

    const approxEntry = report.pricedEntries.find((entry) => entry.modelId === 'claude-4-5-opus');
    expect(approxEntry?.approximated).toBe(true);
    expect(approxEntry?.sourceLabel).toBeUndefined();

    const apiKeyEntry = report.pricedEntries.find(
      (entry) => entry.sourceLabel === 'API Key' && entry.modelId === 'gpt-5',
    );
    expect(apiKeyEntry?.tokens.total).toBe(1_750_000);
    expect(apiKeyEntry?.exactCost?.total).toBeCloseTo(15.075, 4);

    const agentReviewEntry = report.pricedEntries.find((entry) => entry.sourceLabel === 'Review Est.');
    expect(agentReviewEntry?.modelId).toBe('gpt-5');
    expect(agentReviewEntry?.approximated).toBe(true);

    const grokEntry = report.pricedEntries.find((entry) => entry.sourceLabel === 'Grok 4 Est.');
    expect(grokEntry?.modelId).toBe('grok-code-fast-1');
    expect(grokEntry?.approximated).toBe(true);
  });

  it('drops approximate labels in strict mode', () => {
    const report = parseCursorUsageFiles(
      [{ name: 'cursor-usage-sample.csv', text: csv }],
      IMPORT_REPLAY_MODELS,
      { ...baseOptions, approximationMode: 'strict' },
    );

    expect(report.pricedEntries).toHaveLength(2);
    expect(report.summary.pricedApiTokens).toBe(3_500_000);
    expect(report.summary.unsupportedTokens).toBe(665_712);
    expect(report.summary.activeDays).toBe(2);
  });

  it('can still exclude User API Key rows explicitly', () => {
    const report = parseCursorUsageFiles(
      [{ name: 'cursor-usage-sample.csv', text: csv }],
      IMPORT_REPLAY_MODELS,
      { ...baseOptions, includeUserApiKey: false },
    );

    expect(report.summary.pricedApiTokens).toBe(2_407_712);
    expect(report.summary.excludedTokens).toBe(1_760_000);
    expect(report.summary.activeDays).toBe(2);
  });

  it('applies only the flat max upcharge when the model has no documented long-context multiplier', () => {
    const report = parseCursorUsageFiles(
      [{ name: 'cursor-usage-sample.csv', text: csv }],
      IMPORT_REPLAY_MODELS,
      baseOptions,
    );

    const importedFastMax = report.pricedEntries.find(
      (entry) => entry.sourceLabel === 'API Key' && entry.modelId === 'gpt-5',
    );

    expect(importedFastMax?.maxMode).toBe(true);
    expect(importedFastMax?.fast).toBe(true);
    expect(importedFastMax?.exactCost?.total).toBeCloseTo(15.075, 4);
  });

  it('applies long-context max pricing before aggregating imported rows', () => {
    const maxCsv = `Date,User,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Requests
"2026-02-19T13:00:40.253Z","developer@jasonholtdigital.com","On-Demand","us.anthropic.claude-opus-4-6-v1","Yes","0","250000","0","50000","300000","1"`;

    const report = parseCursorUsageFiles(
      [{ name: 'cursor-usage-max.csv', text: maxCsv }],
      IMPORT_REPLAY_MODELS,
      baseOptions,
    );

    const importedMax = report.pricedEntries[0];

    expect(importedMax.modelId).toBe('claude-opus-4-6');
    expect(importedMax.maxMode).toBe(true);
    // Opus 4.6 no longer has a long-context surcharge — companion rates now match base.
    expect(importedMax.exactCost?.total).toBeCloseTo(3, 4);
    expect(report.summary.activeDays).toBe(1);
    expect(report.summary.pricedApiDays).toBe(1);
    expect(report.summary.firstActiveDate).toBe('2026-02-19');
    expect(report.summary.lastActiveDate).toBe('2026-02-19');
    expect(report.summary.activeSpanDays).toBe(1);
    expect(report.summary.comparisonDays).toBe(28);
    expect(report.summary.comparisonMode).toBe('month');
  });

  it('approximates unsupported GPT-5.x fast labels with a 2x fast multiplier and preserves max mode', () => {
    const fastApproxCsv = `Date,User,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Requests
"2026-01-19T13:06:04.478Z","developer@jasonholtdigital.com","Included","gpt-5.2-xhigh-fast","No","0","1000000","250000","500000","1750000","1"
"2026-01-19T13:03:31.131Z","developer@jasonholtdigital.com","Included","gpt-5.2-codex-high-fast","No","0","500000","50000","100000","650000","1"
"2026-01-19T13:00:40.253Z","developer@jasonholtdigital.com","Included","gpt-5.1-codex-max-xhigh-fast","No","0","1000000","250000","500000","1750000","1"`;

    const report = parseCursorUsageFiles(
      [{ name: 'cursor-usage-fast-approx.csv', text: fastApproxCsv }],
      IMPORT_REPLAY_MODELS,
      baseOptions,
    );

    expect(report.summary.unsupportedTokens).toBe(0);
    expect(report.pricedEntries).toHaveLength(3);

    const gpt52Fast = report.pricedEntries.find((entry) => entry.modelId === 'gpt-5.2');
    expect(gpt52Fast?.fast).toBe(true);
    expect(gpt52Fast?.maxMode).toBe(false);
    expect(gpt52Fast?.approximated).toBe(true);
    expect(gpt52Fast?.exactCost?.total).toBeCloseTo(17.5875, 4);

    const gpt52CodexFast = report.pricedEntries.find((entry) => entry.modelId === 'gpt-5.2-codex');
    expect(gpt52CodexFast?.fast).toBe(true);
    expect(gpt52CodexFast?.maxMode).toBe(false);
    expect(gpt52CodexFast?.approximated).toBe(true);
    expect(gpt52CodexFast?.exactCost?.total).toBeCloseTo(4.5675, 4);

    const gpt51CodexFastMax = report.pricedEntries.find((entry) => entry.modelId === 'gpt-5.1-codex');
    expect(gpt51CodexFastMax?.fast).toBe(true);
    expect(gpt51CodexFastMax?.maxMode).toBe(true);
    expect(gpt51CodexFastMax?.approximated).toBe(true);
    expect(gpt51CodexFastMax?.exactCost?.total).toBeCloseTo(15.075, 4);
  });

  it('prices provider-backed o3 and retired Anthropic Opus thinking labels instead of leaving them unsupported', () => {
    const providerBackedCsv = `Date,User,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Requests
"2026-02-10T13:06:04.478Z","developer@jasonholtdigital.com","Included","o3","No","0","1000000","250000","500000","1750000","1"
"2026-02-10T13:03:31.131Z","developer@jasonholtdigital.com","Included","claude-4-opus-thinking","No","100000","50000","250000","50000","450000","1"
"2026-02-10T13:00:40.253Z","developer@jasonholtdigital.com","Included","claude-4.1-opus-thinking","No","100000","50000","250000","50000","450000","1"`;

    const report = parseCursorUsageFiles(
      [{ name: 'cursor-usage-provider-backed.csv', text: providerBackedCsv }],
      IMPORT_REPLAY_MODELS,
      baseOptions,
    );

    expect(report.summary.unsupportedTokens).toBe(0);
    expect(report.pricedEntries).toHaveLength(3);

    const o3Entry = report.pricedEntries.find((entry) => entry.modelId === 'provider-openai-o3');
    expect(o3Entry?.approximated).toBe(true);
    expect(o3Entry?.exactCost?.total).toBeCloseTo(6.125, 4);

    const opus4Entry = report.pricedEntries.find((entry) => entry.modelId === 'provider-anthropic-claude-opus-4');
    expect(opus4Entry?.thinking).toBe(true);
    expect(opus4Entry?.approximated).toBe(true);
    expect(opus4Entry?.exactCost?.total).toBeCloseTo(6.75, 4);

    const opus41Entry = report.pricedEntries.find((entry) => entry.modelId === 'provider-anthropic-claude-opus-4-1');
    expect(opus41Entry?.thinking).toBe(true);
    expect(opus41Entry?.approximated).toBe(true);
    expect(opus41Entry?.exactCost?.total).toBeCloseTo(6.75, 4);
  });

  it('maps non-fast GPT reasoning labels and Gemini 3.1 preview labels instead of leaving them unsupported', () => {
    const replayCsv = `Date,User,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Requests
"2026-03-05T09:35:07.343Z","developer@jasonholtdigital.com","Included","gpt-5.2-xhigh","No","0","14428","1081472","6612","1102512","1"
"2026-03-10T16:36:52.557Z","developer@jasonholtdigital.com","On-Demand","gpt-5.4-high","Yes","0","1000000","250000","500000","1750000","1"
"2026-03-04T19:25:55.496Z","developer@jasonholtdigital.com","Included","gemini-3.1-pro-preview","No","0","8062","10555","444","19061","1"`;

    const report = parseCursorUsageFiles(
      [{ name: 'cursor-usage-missing-mappings.csv', text: replayCsv }],
      IMPORT_REPLAY_MODELS,
      baseOptions,
    );

    expect(report.summary.unsupportedTokens).toBe(0);

    const gpt52Entry = report.pricedEntries.find((entry) => entry.modelId === 'gpt-5.2');
    expect(gpt52Entry?.fast).toBe(false);
    expect(gpt52Entry?.maxMode).toBe(false);
    expect(gpt52Entry?.approximated).toBe(true);

    const gpt54Entry = report.pricedEntries.find((entry) => entry.modelId === 'gpt-5.4');
    expect(gpt54Entry?.fast).toBe(false);
    expect(gpt54Entry?.maxMode).toBe(true);
    expect(gpt54Entry?.approximated).toBe(true);

    const geminiEntry = report.pricedEntries.find((entry) => entry.modelId === 'gemini-3.1-pro');
    expect(geminiEntry?.fast).toBe(false);
    expect(geminiEntry?.maxMode).toBe(false);
    expect(geminiEntry?.approximated).toBe(true);
  });

  it('treats composer-1 as a known API-priced model in the production catalog', () => {
    const composerCsv = `Date,User,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Requests
"2026-02-10T13:06:04.478Z","developer@jasonholtdigital.com","Included","composer-1","No","0","1000000","250000","500000","1750000","1"`;

    const report = parseCursorUsageFiles(
      [{ name: 'cursor-usage-composer.csv', text: composerCsv }],
      IMPORT_REPLAY_MODELS,
      baseOptions,
    );

    expect(report.summary.pricedApiTokens).toBe(1_750_000);
    expect(report.summary.includedNonApiTokens).toBe(0);
    expect(report.summary.unsupportedTokens).toBe(0);

    const composerEntry = report.pricedEntries.find((entry) => entry.modelId === 'composer-1');
    expect(composerEntry?.label).toBe('Composer 1');
    expect(composerEntry?.exactCost?.total).toBeCloseTo(6.28125, 5);
  });

  it('keeps composer-1.5 in the included Auto + Composer pool', () => {
    const composerCsv = `Date,User,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Requests
"2026-02-10T13:06:04.478Z","developer@jasonholtdigital.com","Included","composer-1.5","No","0","1000000","250000","500000","1750000","1"`;

    const report = parseCursorUsageFiles(
      [{ name: 'cursor-usage-composer-1-5.csv', text: composerCsv }],
      IMPORT_REPLAY_MODELS,
      baseOptions,
    );

    expect(report.summary.pricedApiTokens).toBe(0);
    expect(report.summary.includedNonApiTokens).toBe(1_750_000);
    expect(report.summary.unsupportedTokens).toBe(0);
    expect(report.nonApiIncluded[0]?.label).toBe('composer-1.5');
  });
});
