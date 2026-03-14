import type { Model } from '../domain/catalog/types';

// Provider-backed rates used only for CSV replay when Cursor export labels no
// longer exist in the current Cursor pricing catalog.
export const IMPORT_REPLAY_HISTORICAL_MODELS: Model[] = [
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
