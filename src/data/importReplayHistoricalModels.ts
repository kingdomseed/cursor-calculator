import type { Model } from '../domain/catalog/types';

// Retired Cursor catalog entries and provider-backed rates used only for CSV
// replay when export labels no longer exist in the current manual catalog.
export const IMPORT_REPLAY_HISTORICAL_MODELS: Model[] = [
  {
    id: 'composer-1.5',
    name: 'Composer 1.5',
    provider: 'cursor',
    pool: 'api',
    context: { default: 200000, max: null },
    rates: { input: 3.5, cache_write: null, cache_read: 0.35, output: 17.5 },
    variants: {
      thinking: true,
    },
  },
  {
    id: 'composer-2',
    name: 'Composer 2',
    provider: 'cursor',
    pool: 'api',
    context: { default: 200000, max: null },
    rates: { input: 0.5, cache_write: null, cache_read: 0.2, output: 2.5 },
    variants: {
      fast: {
        model_id: 'composer-2-fast',
        rates: { input: 1.5, cache_write: null, cache_read: 0.35, output: 7.5 },
      },
      thinking: true,
    },
    auto_checks: {
      fast: true,
    },
  },
  {
    id: 'grok-build-0-1',
    name: 'Grok Build 0.1',
    provider: 'xai',
    pool: 'api',
    context: { default: 256000, max: null },
    rates: { input: 1, cache_write: null, cache_read: 0.2, output: 2 },
    variants: {
      thinking: true,
    },
  },
  {
    id: 'grok-4-3',
    name: 'Grok 4.3',
    provider: 'xai',
    pool: 'api',
    context: { default: 200000, max: 1000000 },
    rates: { input: 1.25, cache_write: null, cache_read: 0.2, output: 2.5 },
    variants: {
      max_mode: {
        cursor_upcharge: 0,
      },
      thinking: true,
    },
  },
  {
    id: 'grok-4-20',
    name: 'Grok 4.20',
    provider: 'xai',
    pool: 'api',
    context: { default: 200000, max: 2000000 },
    rates: { input: 2, cache_write: null, cache_read: 0.2, output: 6 },
    variants: {
      max_mode: {
        cursor_upcharge: 0,
        rates: { input: 4, cache_write: null, cache_read: 0.4, output: 12 },
      },
      thinking: true,
    },
  },
  {
    id: 'kimi-k2.5',
    name: 'Kimi K2.5',
    provider: 'moonshot',
    pool: 'api',
    context: { default: 128000, max: null },
    rates: { input: 0.6, cache_write: null, cache_read: 0.1, output: 3 },
  },
  {
    id: 'claude-opus-4-6-fast',
    name: 'Claude 4.6 Opus Fast',
    provider: 'anthropic',
    pool: 'api',
    context: { default: 200000, max: 1000000 },
    rates: { input: 30, cache_write: 37.5, cache_read: 3, output: 150 },
    variants: {
      max_mode: {
        cursor_upcharge: 0,
      },
      thinking: true,
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
    // Historical 2x long-context rates for Opus-class models. Used as a companion
    // for claude-4-5-opus CSV replay — Claude 4.5 Opus still has the 2x surcharge
    // even though Claude 4.6 Opus no longer does.
    id: 'historical-opus-max-2x',
    name: 'Opus Max (2x historical)',
    provider: 'anthropic',
    pool: 'api',
    context: { default: 1000000, max: null },
    rates: { input: 10, cache_write: 12.50, cache_read: 1.00, output: 50 },
    variants: {
      thinking: true,
    },
  },
];
