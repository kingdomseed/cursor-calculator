import { describe, expect, it } from 'vitest';

import { getModelById } from '../../catalog/currentCatalog';
import { computeCloudAutomationsCost } from '../pricing';
import type { CloudAutomationsInput } from '../types';

function input(overrides: Partial<CloudAutomationsInput> = {}): CloudAutomationsInput {
  return {
    audience: 'personal',
    product: 'cloud_agent',
    runtime: 'cursor_managed',
    automationScope: 'private',
    modelId: 'claude-sonnet-5',
    tokens: 1_000_000,
    cacheReadShare: 0,
    inputRatio: 3,
    fast: false,
    ...overrides,
  };
}

describe('cloud and automations cost family', () => {
  it('prices Cloud Agents at the selected model API rates', () => {
    const model = getModelById('claude-sonnet-5');
    expect(model).toBeDefined();
    const result = computeCloudAutomationsCost(input(), [model!]);

    expect(result.billedAtApiRates).toBe(true);
    expect(result.usageCost).toBeGreaterThan(0);
    expect(result.notes.some((note) => note.includes('bypass'))).toBe(true);
    expect(result.notes.some((note) => note.includes('unverified'))).toBe(true);
  });

  it('does not invent Projects or PR Routing prices', () => {
    const model = getModelById('claude-sonnet-5');
    const projects = computeCloudAutomationsCost(input({ product: 'projects' }), [model!]);
    const routing = computeCloudAutomationsCost(input({ product: 'pr_routing_and_approval' }), [model!]);

    expect(projects.usageCost).toBeNull();
    expect(projects.lines[0]?.formattedAmount).toBe('Unpublished');
    expect(routing.lines[0]?.status).toBe('unverified');
  });

  it('keeps Bugbot average-run copy as guidance, not a SKU', () => {
    const model = getModelById('claude-sonnet-5');
    const result = computeCloudAutomationsCost(input({
      product: 'bugbot',
      audience: 'teams_enterprise',
    }), [model!]);

    expect(result.lines.some((line) => line.formattedAmount === '$1.00–$1.50')).toBe(true);
    expect(result.lines.some((line) => line.note?.includes('not a published'))).toBe(true);
    expect(result.notes.some((note) => note.includes('on-demand only'))).toBe(true);
  });
});
