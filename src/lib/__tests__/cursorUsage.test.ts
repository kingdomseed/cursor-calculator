import { describe, expect, it } from 'vitest';
import pricingData from '../../data/cursor-pricing.json';

import {
  computeExactUsageRecommendation,
  exactTokensToDollars,
} from '../calculations';
import {
  parseCursorUsageFiles,
  type CursorImportOptions,
} from '../cursorUsage';
import type {
  ExactTokenBreakdown,
  Model,
  PricingData,
  UsageLineItemInput,
} from '../types';

const productionPricing = pricingData as PricingData;

const plans: PricingData['plans'] = {
  pro: { name: 'Pro', monthly_cost: 20, api_pool: 20, description: '' },
  pro_plus: { name: 'Pro Plus', monthly_cost: 60, api_pool: 70, description: '' },
  ultra: { name: 'Ultra', monthly_cost: 200, api_pool: 400, description: '' },
};

const models: Model[] = [
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'openai',
    pool: 'api',
    context: { default: 272000, max: 1000000 },
    rates: { input: 1.25, cache_write: null, cache_read: 0.125, output: 10 },
    variants: {
      max_mode: { cursor_upcharge: 0.2 },
      fast: {
        model_id: 'gpt-5-fast',
        rates: { input: 2.5, cache_write: null, cache_read: 0.25, output: 20 },
      },
      thinking: true,
    },
  },
  {
    id: 'gpt-5.1-codex',
    name: 'GPT-5.1 Codex',
    provider: 'openai',
    pool: 'api',
    context: { default: 272000, max: 1000000 },
    rates: { input: 1.25, cache_write: null, cache_read: 0.125, output: 10 },
    variants: {
      max_mode: { cursor_upcharge: 0.2 },
      thinking: true,
    },
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    provider: 'openai',
    pool: 'api',
    context: { default: 272000, max: 1000000 },
    rates: { input: 1.75, cache_write: null, cache_read: 0.175, output: 14 },
    variants: {
      max_mode: { cursor_upcharge: 0.2 },
      thinking: true,
    },
  },
  {
    id: 'gpt-5.2-codex',
    name: 'GPT-5.2 Codex',
    provider: 'openai',
    pool: 'api',
    context: { default: 272000, max: 1000000 },
    rates: { input: 1.75, cache_write: null, cache_read: 0.175, output: 14 },
    variants: {
      max_mode: { cursor_upcharge: 0.2 },
      thinking: true,
    },
  },
  {
    id: 'claude-4-5-opus',
    name: 'Claude 4.5 Opus',
    provider: 'anthropic',
    pool: 'api',
    context: { default: 200000, max: 1000000 },
    rates: { input: 5, cache_write: 6.25, cache_read: 0.5, output: 25 },
    variants: {
      max_mode: { cursor_upcharge: 0.2 },
      thinking: true,
    },
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude 4.6 Opus',
    provider: 'anthropic',
    pool: 'api',
    context: { default: 200000, max: 1000000 },
    rates: { input: 5, cache_write: 6.25, cache_read: 0.5, output: 25 },
    variants: {
      max_mode: { cursor_upcharge: 0.2 },
      fast: {
        model_id: 'claude-opus-4-6-fast',
        rates: { input: 30, cache_write: 37.5, cache_read: 3, output: 150 },
      },
      thinking: true,
    },
  },
  {
    id: 'claude-opus-4-6-max',
    name: 'Claude 4.6 Opus Max',
    provider: 'anthropic',
    pool: 'api',
    context: { default: 1000000, max: null },
    rates: { input: 10, cache_write: 12.5, cache_read: 1, output: 50 },
    variants: {
      thinking: true,
    },
    auto_checks: {
      max_mode: true,
    },
  },
  {
    id: 'provider-openai-o3',
    name: 'o3',
    provider: 'openai',
    pool: 'api',
    context: { default: 200000, max: null },
    rates: { input: 2, cache_write: null, cache_read: 0.5, output: 8 },
    variants: {
      thinking: true,
    },
  },
  {
    id: 'provider-anthropic-claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    pool: 'api',
    context: { default: 200000, max: null },
    rates: { input: 15, cache_write: 18.75, cache_read: 1.5, output: 75 },
    variants: {
      thinking: true,
    },
  },
  {
    id: 'provider-anthropic-claude-opus-4-1',
    name: 'Claude Opus 4.1',
    provider: 'anthropic',
    pool: 'api',
    context: { default: 200000, max: null },
    rates: { input: 15, cache_write: 18.75, cache_read: 1.5, output: 75 },
    variants: {
      thinking: true,
    },
  },
  {
    id: 'auto',
    name: 'Auto',
    provider: 'cursor',
    pool: 'auto_composer',
    context: { default: 200000, max: null },
    rates: { input: 1.25, cache_write: null, cache_read: 0.25, output: 6 },
  },
  {
    id: 'grok-code-fast-1',
    name: 'Grok Code',
    provider: 'xai',
    pool: 'api',
    context: { default: 256000, max: null },
    rates: { input: 0.2, cache_write: null, cache_read: 0.02, output: 1.5 },
    variants: {
      thinking: true,
    },
  },
];

describe('exactTokensToDollars', () => {
  it('prices exact imported token categories without using a global ratio', () => {
    const exactTokens: ExactTokenBreakdown = {
      inputWithCacheWrite: 0,
      inputWithoutCacheWrite: 1_000_000,
      cacheRead: 250_000,
      output: 500_000,
      total: 1_750_000,
    };

    const cost = exactTokensToDollars(exactTokens, {
      input: 2.5,
      cache_write: null,
      cache_read: 0.25,
      output: 20,
    });

    expect(cost).toBeCloseTo(12.5625, 4);
  });
});

describe('computeExactUsageRecommendation', () => {
  it('reuses plan pool math for exact per-model usage entries', () => {
    const usage: UsageLineItemInput[] = [
      {
        key: 'gpt-5-fast',
        modelId: 'gpt-5',
        label: 'GPT-5 Fast',
        provider: 'openai',
        pool: 'api',
        tokens: {
          total: 1_750_000,
          input: 1_250_000,
          output: 500_000,
        },
        exactTokens: {
          inputWithCacheWrite: 0,
          inputWithoutCacheWrite: 1_000_000,
          cacheRead: 250_000,
          output: 500_000,
          total: 1_750_000,
        },
        maxMode: false,
        fast: true,
        thinking: false,
        caching: true,
        cacheHitRate: 0,
        approximated: false,
      },
    ];

    const result = computeExactUsageRecommendation(usage, models, plans);
    const pro = result.all.find((plan) => plan.plan === 'pro');

    expect(result.best.plan).toBe('pro');
    expect(pro?.apiUsage).toBeCloseTo(12.5625, 4);
    expect(pro?.overage).toBe(0);
    expect(pro?.perModel[0].label).toBe('GPT-5 Fast');
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

  const baseOptions: CursorImportOptions = {
    includeUserApiKey: true,
    approximationMode: 'best_effort',
  };

  it('aggregates supported API usage, flags approximations, and includes API-key rows in Cursor-only estimates by default', () => {
    const report = parseCursorUsageFiles(
      [{ name: 'cursor-usage-sample.csv', text: csv }],
      models,
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
      models,
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
      models,
      { ...baseOptions, includeUserApiKey: false },
    );

    expect(report.summary.pricedApiTokens).toBe(2_407_712);
    expect(report.summary.excludedTokens).toBe(1_760_000);
    expect(report.summary.activeDays).toBe(2);
  });

  it('applies only the flat Max upcharge when the model has no documented long-context multiplier', () => {
    const report = parseCursorUsageFiles(
      [{ name: 'cursor-usage-sample.csv', text: csv }],
      models,
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
      models,
      baseOptions,
    );

    const importedMax = report.pricedEntries[0];

    expect(importedMax.modelId).toBe('claude-opus-4-6');
    expect(importedMax.maxMode).toBe(true);
    expect(importedMax.exactCost?.total).toBeCloseTo(6, 4);
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
      models,
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
      models,
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

  it('treats composer-1 as a known API-priced model in the production pricing catalog', () => {
    const composerCsv = `Date,User,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Requests
"2026-02-10T13:06:04.478Z","developer@jasonholtdigital.com","Included","composer-1","No","0","1000000","250000","500000","1750000","1"`;

    const report = parseCursorUsageFiles(
      [{ name: 'cursor-usage-composer.csv', text: composerCsv }],
      productionPricing.models,
      baseOptions,
    );

    expect(report.summary.pricedApiTokens).toBe(1_750_000);
    expect(report.summary.includedNonApiTokens).toBe(0);
    expect(report.summary.unsupportedTokens).toBe(0);

    const composerEntry = report.pricedEntries.find((entry) => entry.modelId === 'composer-1');
    expect(composerEntry?.label).toBe('Composer 1');
    expect(composerEntry?.exactCost?.total).toBeCloseTo(6.28125, 5);
  });

  it('keeps composer-1.5 in the included Auto + Composer pool in the production pricing catalog', () => {
    const composerCsv = `Date,User,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Requests
"2026-02-10T13:06:04.478Z","developer@jasonholtdigital.com","Included","composer-1.5","No","0","1000000","250000","500000","1750000","1"`;

    const report = parseCursorUsageFiles(
      [{ name: 'cursor-usage-composer-1-5.csv', text: composerCsv }],
      productionPricing.models,
      baseOptions,
    );

    expect(report.summary.pricedApiTokens).toBe(0);
    expect(report.summary.includedNonApiTokens).toBe(1_750_000);
    expect(report.summary.unsupportedTokens).toBe(0);
    expect(report.nonApiIncluded[0]?.label).toBe('composer-1.5');
  });
});
