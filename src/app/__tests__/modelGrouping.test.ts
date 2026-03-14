import { describe, expect, it } from 'vitest';

import type { RecommendationModelDisplayRow } from '../recommendationPresentation';
import { getBaseModelId, buildModelGroups } from '../modelGrouping';

function createRow(overrides: Partial<RecommendationModelDisplayRow> = {}): RecommendationModelDisplayRow {
  return {
    key: 'model-1:base:standard:plain:cursor',
    modelId: 'model-1',
    label: 'Model 1',
    provider: 'anthropic',
    badges: [],
    rateLabel: '$3.00 / $15.00 per M',
    primaryMetric: {
      label: 'Usage cost',
      value: 10,
      formattedValue: '$10.00',
    },
    secondaryMetric: {
      label: 'Token volume',
      value: 100_000,
      formattedValue: '100,000 tokens',
    },
    ...overrides,
  };
}

describe('getBaseModelId', () => {
  describe('fast variants', () => {
    it('maps claude-opus-4-6-fast to claude-opus-4-6', () => {
      expect(getBaseModelId('claude-opus-4-6-fast')).toBe('claude-opus-4-6');
    });

    it('maps gpt-5-fast to gpt-5', () => {
      expect(getBaseModelId('gpt-5-fast')).toBe('gpt-5');
    });

    it('maps gpt-5.4-fast to gpt-5.4', () => {
      expect(getBaseModelId('gpt-5.4-fast')).toBe('gpt-5.4');
    });
  });

  describe('max variants via companions', () => {
    it('maps claude-opus-4-6-max to claude-opus-4-6', () => {
      expect(getBaseModelId('claude-opus-4-6-max')).toBe('claude-opus-4-6');
    });

    it('maps gpt-5.4-max to gpt-5.4', () => {
      expect(getBaseModelId('gpt-5.4-max')).toBe('gpt-5.4');
    });

    it('maps claude-4-sonnet-1m to claude-4-sonnet', () => {
      expect(getBaseModelId('claude-4-sonnet-1m')).toBe('claude-4-sonnet');
    });
  });

  describe('prefers non-approximated base', () => {
    it('maps claude-opus-4-6-max to claude-opus-4-6 (not claude-4-5-opus)', () => {
      expect(getBaseModelId('claude-opus-4-6-max')).toBe('claude-opus-4-6');
    });
  });

  describe('base models unchanged', () => {
    it('returns claude-opus-4-6 as-is', () => {
      expect(getBaseModelId('claude-opus-4-6')).toBe('claude-opus-4-6');
    });

    it('returns gpt-5.3-codex as-is', () => {
      expect(getBaseModelId('gpt-5.3-codex')).toBe('gpt-5.3-codex');
    });
  });

  describe('standalone max not in companions', () => {
    it('returns gpt-5.1-codex-max as-is (not in companions map)', () => {
      expect(getBaseModelId('gpt-5.1-codex-max')).toBe('gpt-5.1-codex-max');
    });
  });
});

describe('buildModelGroups', () => {
  it('returns null for tokenSource manual', () => {
    const rows = [createRow()];
    expect(buildModelGroups(rows, 'manual')).toBeNull();
  });

  it('groups rows sharing the same base model ID', () => {
    const rows = [
      createRow({
        key: 'claude-opus-4-6:base:standard:plain:cursor',
        modelId: 'claude-opus-4-6',
        label: 'Claude 4.6 Opus',
        provider: 'anthropic',
        primaryMetric: { label: 'Usage cost', value: 50, formattedValue: '$50.00' },
        secondaryMetric: { label: 'Token volume', value: 500_000, formattedValue: '500,000 tokens' },
      }),
      createRow({
        key: 'claude-opus-4-6-fast:base:fast:plain:cursor',
        modelId: 'claude-opus-4-6-fast',
        label: 'Claude 4.6 Opus Fast',
        provider: 'anthropic',
        primaryMetric: { label: 'Usage cost', value: 30, formattedValue: '$30.00' },
        secondaryMetric: { label: 'Token volume', value: 200_000, formattedValue: '200,000 tokens' },
      }),
    ];

    const groups = buildModelGroups(rows, 'cursor_import');
    expect(groups).not.toBeNull();
    expect(groups!.length).toBe(1);
    expect(groups![0].groupKey).toBe('claude-opus-4-6');
    expect(groups![0].children.length).toBe(2);
    expect(groups![0].variantCount).toBe(2);
    expect(groups![0].totalCost).toBe(80);
    expect(groups![0].totalTokens).toBe(700_000);
  });

  it('sorts groups by totalCost descending', () => {
    const rows = [
      createRow({
        key: 'gpt-5:base:standard:plain:cursor',
        modelId: 'gpt-5',
        label: 'GPT-5',
        provider: 'openai',
        primaryMetric: { label: 'Usage cost', value: 20, formattedValue: '$20.00' },
      }),
      createRow({
        key: 'claude-opus-4-6:base:standard:plain:cursor',
        modelId: 'claude-opus-4-6',
        label: 'Claude 4.6 Opus',
        provider: 'anthropic',
        primaryMetric: { label: 'Usage cost', value: 100, formattedValue: '$100.00' },
      }),
    ];

    const groups = buildModelGroups(rows, 'cursor_import')!;
    expect(groups[0].groupKey).toBe('claude-opus-4-6');
    expect(groups[1].groupKey).toBe('gpt-5');
  });

  it('sorts children within a group by cost descending', () => {
    const rows = [
      createRow({
        key: 'claude-opus-4-6-fast:base:fast:plain:cursor',
        modelId: 'claude-opus-4-6-fast',
        label: 'Claude 4.6 Opus Fast',
        provider: 'anthropic',
        primaryMetric: { label: 'Usage cost', value: 10, formattedValue: '$10.00' },
      }),
      createRow({
        key: 'claude-opus-4-6:base:standard:plain:cursor',
        modelId: 'claude-opus-4-6',
        label: 'Claude 4.6 Opus',
        provider: 'anthropic',
        primaryMetric: { label: 'Usage cost', value: 50, formattedValue: '$50.00' },
      }),
    ];

    const groups = buildModelGroups(rows, 'cursor_import')!;
    expect(groups[0].children[0].modelId).toBe('claude-opus-4-6');
    expect(groups[0].children[1].modelId).toBe('claude-opus-4-6-fast');
  });

  it('uses the base model label as familyLabel when available', () => {
    const rows = [
      createRow({
        key: 'claude-opus-4-6-max:max:standard:plain:cursor',
        modelId: 'claude-opus-4-6-max',
        label: 'Claude 4.6 Opus Max',
        provider: 'anthropic',
        primaryMetric: { label: 'Usage cost', value: 80, formattedValue: '$80.00' },
      }),
      createRow({
        key: 'claude-opus-4-6:base:standard:plain:cursor',
        modelId: 'claude-opus-4-6',
        label: 'Claude 4.6 Opus',
        provider: 'anthropic',
        primaryMetric: { label: 'Usage cost', value: 50, formattedValue: '$50.00' },
      }),
    ];

    const groups = buildModelGroups(rows, 'cursor_import')!;
    expect(groups[0].familyLabel).toBe('Claude 4.6 Opus'); // base model label, not max variant
  });

  it('creates singleton groups with variantCount 1', () => {
    const rows = [
      createRow({
        key: 'gpt-5.3-codex:base:standard:plain:cursor',
        modelId: 'gpt-5.3-codex',
        label: 'GPT-5.3 Codex',
        provider: 'openai',
        primaryMetric: { label: 'Usage cost', value: 40, formattedValue: '$40.00' },
        secondaryMetric: { label: 'Token volume', value: 300_000, formattedValue: '300,000 tokens' },
      }),
    ];

    const groups = buildModelGroups(rows, 'cursor_import')!;
    expect(groups.length).toBe(1);
    expect(groups[0].variantCount).toBe(1);
    expect(groups[0].familyLabel).toBe('GPT-5.3 Codex');
    expect(groups[0].children.length).toBe(1);
  });
});
