# Calculator Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Cursor cost calculator with usage-weighted model mix, per-model variant toggles, and correct plan recommendation logic.

**Architecture:** Pure calculation functions in `lib/calculations.ts` (testable, no React). UI split into focused components. State managed in `App.tsx` via `useState`. Pricing data in `cursor-pricing.json` with new schema supporting variants, context windows, and per-model caching.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, Vitest (new)

**Spec:** `docs/superpowers/specs/2026-03-12-calculator-redesign-design.md`

---

## Chunk 1: Foundation — Test Setup, Types, Pricing Data

### Task 1: Add Vitest

**Files:**
- Modify: `package.json`
- Create: `vite.config.ts` (add test config)

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add test config to vite.config.ts**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
})
```

- [ ] **Step 3: Add test script to package.json**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create directories and smoke test to verify Vitest works**

```bash
mkdir -p src/lib/__tests__ src/components
```

Create `src/lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run test to verify**

```bash
npm test
```
Expected: 1 test passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/lib/__tests__/smoke.test.ts
git commit -m "chore: add Vitest testing infrastructure"
```

---

### Task 2: Define Types

**Files:**
- Create: `src/lib/types.ts`

The types define the data model from the spec. They're used by both `calculations.ts` and all components.

- [ ] **Step 1: Create `src/lib/types.ts`**

```ts
// ─── Pricing Data Types (mirror cursor-pricing.json schema) ──────────

export type PlanKey = "pro" | "pro_plus" | "ultra";

export interface Plan {
  name: string;
  monthly_cost: number;
  api_pool: number;
  description: string;
}

export interface ModelRates {
  input: number;
  cache_write: number | null;
  cache_read: number | null;
  output: number;
}

export interface MaxModeVariant {
  cursor_upcharge: number;
  long_context_input_multiplier: number;
  long_context_output_multiplier: number;
}

export interface FastVariant {
  model_id: string;
  rates: ModelRates;
}

export interface ModelVariants {
  max_mode?: MaxModeVariant;
  fast?: FastVariant;
  thinking?: boolean;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  pool: "api" | "auto_composer";
  context: {
    default: number;
    max: number | null;
  };
  rates: ModelRates;
  variants?: ModelVariants;
  auto_checks?: {
    max_mode?: boolean;
    fast?: boolean;
    thinking?: boolean;
  };
}

export interface PricingData {
  meta: { version: string; source_url: string; retrieved_at: string };
  plans: Record<PlanKey, Plan>;
  models: Model[];
}

// ─── UI State Types ──────────────────────────────────────────────────

export type Mode = "budget" | "tokens";

export interface ModelConfig {
  modelId: string;
  weight: number;        // 0-100, user-facing percentage
  maxMode: boolean;
  fast: boolean;
  thinking: boolean;
  caching: boolean;
  cacheHitRate: number;  // 0-95
}

// ─── Calculation Result Types ────────────────────────────────────────

export interface EffectiveRates {
  input: number;
  output: number;
}

export interface TokenBreakdown {
  total: number;
  input: number;
  output: number;
}

export interface PlanResult {
  plan: PlanKey;
  subscription: number;
  apiPool: number;
  apiBudget: number;        // pool + overage budget
  apiUsage: number;          // actual API cost from model mix
  overage: number;
  unusedPool: number;
  totalCost: number;
  affordable: boolean;       // subscription <= budget (budget mode only)
  perModel: Array<{
    modelId: string;
    tokens: TokenBreakdown;
    effectiveRates: EffectiveRates;
    apiCost: number;
  }>;
}

export interface Recommendation {
  best: PlanResult;
  all: PlanResult[];
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```
Expected: No errors (may have existing errors from App.tsx — that's fine, we'll fix later).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add type definitions for new pricing model"
```

---

### Task 3: Scrape and Update Pricing JSON

**Files:**
- Modify: `src/data/cursor-pricing.json`

This task uses Playwright to scrape every model from Cursor's docs and rebuild the JSON with the new schema. The scraping must visit:
1. https://cursor.com/docs/models-and-pricing (main table + plans table)
2. Each individual model page listed in the sidebar (for context windows, variant info, long-context pricing notes)

- [ ] **Step 1: Scrape the main models-and-pricing page**

Navigate to `https://cursor.com/docs/models-and-pricing`. Click "Show more models" to expand. Capture:
- All model names, providers, and rates from the pricing table
- Plan details from the plans table (Pro: $20/$20, Pro Plus: $60/$70, Ultra: $200/$400)
- Auto pricing table (for Auto + Composer 1.5 pool models)

- [ ] **Step 2: Scrape each individual model page**

For each model in the sidebar navigation under "Models & Pricing", navigate to its page and capture:
- Model ID (from the "Model ID" field)
- Context window default and max
- Speed / Cost / Intelligence ratings
- Pricing notes (e.g., "Fast mode variant available at 2x", "long context pricing is 2x")
- Which pool it draws from (API vs Auto + Composer)

Models to scrape (from sidebar):
- Claude 4.6 Sonnet, Claude 4.6 Opus, Gemini 3.1 Pro, Gemini 3 Flash, GPT-5.4, GPT-5.3 Codex, Grok Code, Composer 1.5

Plus expanded table models (click "Show more models"):
- Claude 4 Sonnet, Claude 4 Sonnet 1M, Claude 4.5 Haiku, Claude 4.5 Opus, Claude 4.5 Sonnet
- Claude 4.6 Opus Fast
- Composer 1
- Gemini 2.5 Flash, Gemini 3 Pro, Gemini 3 Pro Image Preview
- GPT-5, GPT-5 Fast, GPT-5 Mini, GPT-5-Codex, GPT-5.1 Codex, GPT-5.1 Codex Max, GPT-5.1 Codex Mini
- GPT-5.2, GPT-5.2 Codex
- Kimi K2.5

- [ ] **Step 3: Build the new cursor-pricing.json**

Write the updated JSON following the schema from `src/lib/types.ts`. Key rules:
- Every model has `pool`, `context`, `rates`
- `cache_write` is `null` for non-Anthropic models
- `variants.max_mode` only present if the model supports Max Mode (has a "Max context" value)
- `variants.fast` only present if the model has a documented Fast variant
- `variants.thinking` is `true` if the model page mentions thinking/reasoning support
- `auto_checks.max_mode` is `true` for models that default to Max Mode in Cursor
- Fast variants (e.g., "Claude 4.6 Opus (Fast mode)") are NOT separate top-level models — they're nested under `variants.fast` on the base model
- Auto + Composer pool models (Auto, Composer 1, Composer 1.5) have `pool: "auto_composer"`

Cross-reference: every rate in the individual model page must match the main pricing table. Flag discrepancies in a comment.

- [ ] **Step 4: Verify JSON parses and types align**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/data/cursor-pricing.json
git commit -m "feat: update pricing JSON with full model data from Cursor docs"
```

---

## Chunk 2: Calculation Engine (TDD)

### Task 4: Effective Rate Computation

**Files:**
- Create: `src/lib/calculations.ts`
- Create: `src/lib/__tests__/calculations.test.ts`

- [ ] **Step 1: Write failing tests for `computeEffectiveRates`**

Create `src/lib/__tests__/calculations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeEffectiveRates } from '../calculations';
import type { Model, ModelConfig } from '../types';

// Test fixture: Claude 4.6 Opus
const opusModel: Model = {
  id: 'claude-4-6-opus',
  name: 'Claude 4.6 Opus',
  provider: 'anthropic',
  pool: 'api',
  context: { default: 200000, max: 1000000 },
  rates: { input: 5, cache_write: 6.25, cache_read: 0.5, output: 25 },
  variants: {
    max_mode: {
      cursor_upcharge: 0.20,
      long_context_input_multiplier: 2.0,
      long_context_output_multiplier: 1.0,
    },
    fast: {
      model_id: 'claude-4-6-opus-fast',
      rates: { input: 30, cache_write: 37.5, cache_read: 3, output: 150 },
    },
    thinking: true,
  },
};

const baseConfig: ModelConfig = {
  modelId: 'claude-4-6-opus',
  weight: 100,
  maxMode: false,
  fast: false,
  thinking: false,
  caching: false,
  cacheHitRate: 0,
};

describe('computeEffectiveRates', () => {
  it('returns base rates with no variants enabled', () => {
    const rates = computeEffectiveRates(opusModel, baseConfig);
    expect(rates.input).toBe(5);
    expect(rates.output).toBe(25);
  });

  it('applies Max Mode: cursor upcharge + long context multipliers', () => {
    const rates = computeEffectiveRates(opusModel, { ...baseConfig, maxMode: true });
    // input: 5 * 1.20 * 2.0 = 12
    expect(rates.input).toBe(12);
    // output: 25 * 1.20 * 1.0 = 30
    expect(rates.output).toBe(30);
  });

  it('applies Fast mode: replaces rates entirely', () => {
    const rates = computeEffectiveRates(opusModel, { ...baseConfig, fast: true });
    expect(rates.input).toBe(30);
    expect(rates.output).toBe(150);
  });

  it('Fast mode ignores Max Mode even if both are true', () => {
    const rates = computeEffectiveRates(opusModel, { ...baseConfig, fast: true, maxMode: true });
    // Fast takes precedence, skips Max Mode layers
    expect(rates.input).toBe(30);
    expect(rates.output).toBe(150);
  });

  it('applies caching blend for Anthropic models (has cache_write)', () => {
    const config = { ...baseConfig, caching: true, cacheHitRate: 50 };
    const rates = computeEffectiveRates(opusModel, config);
    // No Max Mode, so cache rates stay raw. RE_READS=3, cachedRatio=0.5, uncachedRatio=0.5
    // effective = (0.5*6.25 + 0.5*0.5*3 + 0.5*5*3) / 3
    // = (3.125 + 0.75 + 7.5) / 3 = 11.375 / 3 = 3.7917
    expect(rates.input).toBeCloseTo(3.7917, 3);
    expect(rates.output).toBe(25); // caching doesn't affect output
  });

  it('scales cache rates with Max Mode when both are active', () => {
    const config = { ...baseConfig, maxMode: true, caching: true, cacheHitRate: 50 };
    const rates = computeEffectiveRates(opusModel, config);
    // Max Mode: upcharge=1.2, long_context_input=2.0
    // Scaled input: 5 * 1.2 * 2.0 = 12
    // Scaled cache_write: 6.25 * 1.2 * 2.0 = 15
    // Scaled cache_read: 0.5 * 1.2 * 2.0 = 1.2
    // RE_READS=3, cachedRatio=0.5
    // effective = (0.5*15 + 0.5*1.2*3 + 0.5*12*3) / 3
    // = (7.5 + 1.8 + 18) / 3 = 27.3 / 3 = 9.1
    expect(rates.input).toBeCloseTo(9.1, 3);
    // output: 25 * 1.2 * 1.0 = 30
    expect(rates.output).toBe(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```
Expected: FAIL — `computeEffectiveRates` not found.

- [ ] **Step 3: Implement `computeEffectiveRates`**

Create `src/lib/calculations.ts`:

```ts
import type { Model, ModelConfig, EffectiveRates } from './types';

// TODO: Spec says RE_READS should be configurable as an advanced option. For now hardcoded.
const DEFAULT_RE_READS = 3;

export function computeEffectiveRates(model: Model, config: ModelConfig, reReads = DEFAULT_RE_READS): EffectiveRates {
  // Layer 1: Fast mode replaces base rates entirely, skips Max Mode
  if (config.fast && model.variants?.fast) {
    const fastRates = model.variants.fast.rates;
    return {
      input: applyCaching(fastRates.input, fastRates.cache_write, fastRates.cache_read, config),
      output: fastRates.output,
    };
  }

  let inputRate = model.rates.input;
  let outputRate = model.rates.output;

  // Layer 2: Cursor Max Mode upcharge
  if (config.maxMode && model.variants?.max_mode) {
    const upcharge = 1 + model.variants.max_mode.cursor_upcharge;
    inputRate *= upcharge;
    outputRate *= upcharge;

    // Layer 3: Long context multipliers (always applied with Max Mode)
    inputRate *= model.variants.max_mode.long_context_input_multiplier;
    outputRate *= model.variants.max_mode.long_context_output_multiplier;
  }

  // Layer 4: Caching blend (affects input only)
  // When Max Mode is active, cache rates must also be scaled by upcharge + long context,
  // because Cursor's upcharge applies to all API usage and provider long-context pricing
  // applies to all token operations including cache reads/writes.
  let cacheWrite = model.rates.cache_write;
  let cacheRead = model.rates.cache_read;
  if (config.maxMode && model.variants?.max_mode) {
    const upcharge = 1 + model.variants.max_mode.cursor_upcharge;
    const lcInput = model.variants.max_mode.long_context_input_multiplier;
    if (cacheWrite !== null) cacheWrite = cacheWrite * upcharge * lcInput;
    if (cacheRead !== null) cacheRead = cacheRead * upcharge * lcInput;
  }
  inputRate = applyCaching(inputRate, cacheWrite, cacheRead, config, reReads);

  return { input: inputRate, output: outputRate };
}

function applyCaching(
  inputRate: number,
  cacheWrite: number | null,
  cacheRead: number | null,
  config: ModelConfig,
  reReads: number = DEFAULT_RE_READS,
): number {
  if (!config.caching || config.cacheHitRate <= 0 || !cacheRead) {
    return inputRate;
  }

  const cachedRatio = config.cacheHitRate / 100;
  const uncachedRatio = 1 - cachedRatio;

  if (cacheWrite) {
    // Anthropic: cache_write + cache_read with RE_READS amortization
    return (
      cachedRatio * cacheWrite +
      cachedRatio * cacheRead * reReads +
      uncachedRatio * inputRate * reReads
    ) / reReads;
  }

  // Non-Anthropic: simple blend of cache_read and input rate
  return cachedRatio * cacheRead + uncachedRatio * inputRate;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations.ts src/lib/__tests__/calculations.test.ts
git commit -m "feat: implement computeEffectiveRates with TDD"
```

---

### Task 5: Non-Anthropic Caching and Edge Cases

**Files:**
- Modify: `src/lib/__tests__/calculations.test.ts`

- [ ] **Step 1: Add tests for cache_read-only models**

```ts
// Test fixture: GPT-5.4 (no cache_write)
const gpt54Model: Model = {
  id: 'gpt-5-4',
  name: 'GPT-5.4',
  provider: 'openai',
  pool: 'api',
  context: { default: 272000, max: 1000000 },
  rates: { input: 2.5, cache_write: null, cache_read: 0.25, output: 15 },
  variants: {
    max_mode: {
      cursor_upcharge: 0.20,
      long_context_input_multiplier: 2.0,
      long_context_output_multiplier: 1.5,
    },
    thinking: true,
  },
  auto_checks: { max_mode: true },
};

describe('computeEffectiveRates - non-Anthropic caching', () => {
  it('uses simple blend for cache_read-only models', () => {
    const config: ModelConfig = {
      modelId: 'gpt-5-4', weight: 100,
      maxMode: false, fast: false, thinking: false,
      caching: true, cacheHitRate: 50,
    };
    const rates = computeEffectiveRates(gpt54Model, config);
    // 0.5 * 0.25 + 0.5 * 2.5 = 0.125 + 1.25 = 1.375
    expect(rates.input).toBeCloseTo(1.375, 3);
    expect(rates.output).toBe(15);
  });

  it('GPT-5.4 Max Mode has different output multiplier', () => {
    const config: ModelConfig = {
      modelId: 'gpt-5-4', weight: 100,
      maxMode: true, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    };
    const rates = computeEffectiveRates(gpt54Model, config);
    // input: 2.5 * 1.2 * 2.0 = 6.0
    expect(rates.input).toBe(6);
    // output: 15 * 1.2 * 1.5 = 27.0
    expect(rates.output).toBe(27);
  });

  it('model with no variants returns base rates regardless of config', () => {
    const bareModel: Model = {
      id: 'kimi-k2-5', name: 'Kimi K2.5', provider: 'moonshot', pool: 'api',
      context: { default: 131072, max: null },
      rates: { input: 0.6, cache_write: null, cache_read: 0.1, output: 3 },
    };
    const config: ModelConfig = {
      modelId: 'kimi-k2-5', weight: 100,
      maxMode: true, fast: true, thinking: true,
      caching: false, cacheHitRate: 0,
    };
    const rates = computeEffectiveRates(bareModel, config);
    expect(rates.input).toBe(0.6);
    expect(rates.output).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test
```
Expected: All pass (implementation from Task 4 should handle these).

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/calculations.test.ts
git commit -m "test: add edge case tests for caching and model variants"
```

---

### Task 6: Budget Mode and Token Mode Calculations

**Files:**
- Modify: `src/lib/calculations.ts`
- Modify: `src/lib/__tests__/calculations.test.ts`

- [ ] **Step 1: Write failing tests for `computeRecommendation`**

Add to `src/lib/__tests__/calculations.test.ts`:

```ts
import { computeEffectiveRates, computeRecommendation, dollarsToTokens, tokensToDollars } from '../calculations';
import type { Model, ModelConfig, PricingData, PlanKey } from '../types';

// Minimal pricing data for tests
const testPlans: PricingData['plans'] = {
  pro: { name: 'Pro', monthly_cost: 20, api_pool: 20, description: '' },
  pro_plus: { name: 'Pro Plus', monthly_cost: 60, api_pool: 70, description: '' },
  ultra: { name: 'Ultra', monthly_cost: 200, api_pool: 400, description: '' },
};

describe('computeRecommendation - budget mode', () => {
  it('recommends Pro Plus over Pro at $60 budget (Pro Plus gives more tokens)', () => {
    const models = [opusModel];
    const configs: ModelConfig[] = [{
      modelId: 'claude-4-6-opus', weight: 100,
      maxMode: false, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    }];
    const result = computeRecommendation('budget', 60, 0, models, configs, testPlans, 3);
    // Pro: api_budget = 20 + (60-20) = 60
    // Pro Plus: api_budget = 70 + (60-60) = 70
    // Pro Plus gives more tokens → wins
    expect(result.best.plan).toBe('pro_plus');
  });

  it('filters out plans user cannot afford', () => {
    const models = [opusModel];
    const configs: ModelConfig[] = [{
      modelId: 'claude-4-6-opus', weight: 100,
      maxMode: false, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    }];
    const result = computeRecommendation('budget', 50, 0, models, configs, testPlans, 3);
    // Can afford Pro ($20) but not Pro Plus ($60) or Ultra ($200)
    expect(result.best.plan).toBe('pro');
    expect(result.all.find(p => p.plan === 'pro_plus')!.affordable).toBe(false);
    expect(result.all.find(p => p.plan === 'ultra')!.affordable).toBe(false);
  });

  it('distributes budget across weighted model mix', () => {
    const models = [opusModel, gpt54Model];
    const configs: ModelConfig[] = [
      { modelId: 'claude-4-6-opus', weight: 60, maxMode: false, fast: false, thinking: false, caching: false, cacheHitRate: 0 },
      { modelId: 'gpt-5-4', weight: 40, maxMode: false, fast: false, thinking: false, caching: false, cacheHitRate: 0 },
    ];
    const result = computeRecommendation('budget', 60, 0, models, configs, testPlans, 3);
    const best = result.best;
    // Should have per-model breakdowns
    expect(best.perModel).toHaveLength(2);
    expect(best.perModel[0].modelId).toBe('claude-4-6-opus');
    expect(best.perModel[1].modelId).toBe('gpt-5-4');
    // GPT-5.4 is cheaper, so should get more tokens for its 40%
    expect(best.perModel[1].tokens.total).toBeGreaterThan(best.perModel[0].tokens.total);
  });

  it('normalizes weights that do not sum to 100%', () => {
    const models = [opusModel, gpt54Model];
    const configs: ModelConfig[] = [
      { modelId: 'claude-4-6-opus', weight: 60, maxMode: false, fast: false, thinking: false, caching: false, cacheHitRate: 0 },
      { modelId: 'gpt-5-4', weight: 60, maxMode: false, fast: false, thinking: false, caching: false, cacheHitRate: 0 },
    ];
    // Weights sum to 120%, should normalize to 50/50
    const result = computeRecommendation('budget', 60, 0, models, configs, testPlans, 3);
    const best = result.best;
    // Both models should get ~50% of budget (within rounding)
    expect(best.perModel[0].apiCost).toBeCloseTo(best.perModel[1].apiCost, 1);
  });
});

describe('computeRecommendation - tiebreaking', () => {
  it('prefers plan with more API pool headroom on tie', () => {
    // Create plans that tie: both produce same total tokens
    // Use a tiny budget where Pro api_budget = Pro Plus api_budget
    // Pro at $20: api_budget = 20 + (20-20) = 20
    // Custom plans to force a tie:
    const tiePlans: PricingData['plans'] = {
      pro:      { name: 'Pro',      monthly_cost: 20, api_pool: 30, description: '' },
      pro_plus: { name: 'Pro Plus', monthly_cost: 30, api_pool: 20, description: '' },
      ultra:    { name: 'Ultra',    monthly_cost: 200, api_pool: 400, description: '' },
    };
    // Budget $30: Pro api_budget = 30+(30-20) = 40, Pro Plus api_budget = 20+(30-30) = 20
    // These don't tie. Instead, make pools yield same api_budget:
    const tiePlans2: PricingData['plans'] = {
      pro:      { name: 'Pro',      monthly_cost: 10, api_pool: 15, description: '' },
      pro_plus: { name: 'Pro Plus', monthly_cost: 20, api_pool: 25, description: '' },
      ultra:    { name: 'Ultra',    monthly_cost: 200, api_pool: 400, description: '' },
    };
    // Budget $30: Pro api_budget = 15+(30-10)=35, Pro Plus api_budget = 25+(30-20)=35
    // Same api_budget → same tokens → tiebreak on pool headroom
    // Pro Plus has api_pool=25 > Pro's api_pool=15 → Pro Plus wins
    const models = [opusModel];
    const configs: ModelConfig[] = [{
      modelId: 'claude-4-6-opus', weight: 100,
      maxMode: false, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    }];
    const result = computeRecommendation('budget', 30, 0, models, configs, tiePlans2, 3);
    expect(result.best.plan).toBe('pro_plus');
  });
});

describe('computeRecommendation - token mode', () => {
  it('recommends cheapest plan that covers the usage', () => {
    const models = [opusModel];
    const configs: ModelConfig[] = [{
      modelId: 'claude-4-6-opus', weight: 100,
      maxMode: false, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    }];
    // Small token amount that fits within Pro's $20 pool
    const result = computeRecommendation('tokens', 0, 500_000, models, configs, testPlans, 3);
    expect(result.best.plan).toBe('pro');
  });

  it('calculates overage correctly', () => {
    const models = [opusModel];
    const configs: ModelConfig[] = [{
      modelId: 'claude-4-6-opus', weight: 100,
      maxMode: false, fast: false, thinking: false,
      caching: false, cacheHitRate: 0,
    }];
    const result = computeRecommendation('tokens', 0, 10_000_000, models, configs, testPlans, 3);
    const proResult = result.all.find(p => p.plan === 'pro')!;
    expect(proResult.overage).toBeGreaterThan(0);
    expect(proResult.totalCost).toBe(proResult.subscription + proResult.overage);
  });
});

describe('dollarsToTokens / tokensToDollars', () => {
  it('dollarsToTokens converts correctly at 3:1 ratio', () => {
    // Opus base rates: $5 in / $25 out per M
    // Cost per cycle (3 in + 1 out) = (3*5 + 25) / 1_000_000 = 40/1M
    // $20 budget: cycles = 20 / (40/1M) = 500_000
    // input = 500k * 3 = 1.5M, output = 500k, total = 2M
    const result = dollarsToTokens(20, { input: 5, output: 25 }, 3);
    expect(result.input).toBe(1_500_000);
    expect(result.output).toBe(500_000);
    expect(result.total).toBe(2_000_000);
  });

  it('dollarsToTokens returns zero for zero dollars', () => {
    const result = dollarsToTokens(0, { input: 5, output: 25 }, 3);
    expect(result.total).toBe(0);
  });

  it('tokensToDollars is inverse of dollarsToTokens', () => {
    const rates = { input: 5, output: 25 };
    const tokens = dollarsToTokens(20, rates, 3);
    const cost = tokensToDollars(tokens.total, rates, 3);
    expect(cost).toBeCloseTo(20, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```
Expected: FAIL — `computeRecommendation` not found.

- [ ] **Step 3: Implement `computeRecommendation`**

Add to `src/lib/calculations.ts`:

```ts
import type {
  Model, ModelConfig, EffectiveRates, TokenBreakdown,
  PlanKey, Plan, PlanResult, Recommendation, PricingData, Mode,
} from './types';

export function computeRecommendation(
  mode: Mode,
  budget: number,
  totalTokens: number,
  models: Model[],
  configs: ModelConfig[],
  plans: PricingData['plans'],
  inputOutputRatio: number,
): Recommendation {
  const planKeys: PlanKey[] = ['pro', 'pro_plus', 'ultra'];

  // Normalize weights
  const weightSum = configs.reduce((sum, c) => sum + c.weight, 0);
  const normalizedConfigs = weightSum > 0
    ? configs.map(c => ({ ...c, weight: c.weight / weightSum * 100 }))
    : configs;

  const allResults: PlanResult[] = planKeys.map(key => {
    const plan = plans[key];
    const affordable = mode === 'budget' ? plan.monthly_cost <= budget : true;

    if (mode === 'budget') {
      return computeBudgetPlanResult(key, plan, budget, models, normalizedConfigs, inputOutputRatio, affordable);
    } else {
      return computeTokenPlanResult(key, plan, totalTokens, models, normalizedConfigs, inputOutputRatio);
    }
  });

  // Pick best: budget mode = most tokens (among affordable), token mode = lowest cost
  const affordableResults = allResults.filter(r => r.affordable);
  let best: PlanResult;

  if (affordableResults.length === 0) {
    // No plan affordable — return cheapest as best with affordable=false
    best = allResults[0];
  } else if (mode === 'budget') {
    best = affordableResults.reduce((a, b) => {
      const aTokens = a.perModel.reduce((s, m) => s + m.tokens.total, 0);
      const bTokens = b.perModel.reduce((s, m) => s + m.tokens.total, 0);
      if (aTokens === bTokens) return a.apiPool > b.apiPool ? a : b; // tiebreak
      return aTokens > bTokens ? a : b;
    });
  } else {
    best = affordableResults.reduce((a, b) => {
      if (a.totalCost === b.totalCost) return a.apiPool > b.apiPool ? a : b;
      return a.totalCost < b.totalCost ? a : b;
    });
  }

  return { best, all: allResults };
}

function computeBudgetPlanResult(
  key: PlanKey,
  plan: Plan,
  budget: number,
  models: Model[],
  configs: ModelConfig[],
  ratio: number,
  affordable: boolean,
): PlanResult {
  const apiBudget = affordable ? plan.api_pool + (budget - plan.monthly_cost) : 0;

  const perModel = configs.map(config => {
    const model = models.find(m => m.id === config.modelId)!;
    const effectiveRates = computeEffectiveRates(model, config);
    const modelDollars = apiBudget * (config.weight / 100);
    const tokens = dollarsToTokens(modelDollars, effectiveRates, ratio);
    return {
      modelId: config.modelId,
      tokens,
      effectiveRates,
      apiCost: modelDollars,
    };
  });

  const totalApiUsage = perModel.reduce((s, m) => s + m.apiCost, 0);
  const overage = Math.max(0, totalApiUsage - plan.api_pool);
  const unusedPool = Math.max(0, plan.api_pool - totalApiUsage);

  return {
    plan: key,
    subscription: plan.monthly_cost,
    apiPool: plan.api_pool,
    apiBudget,
    apiUsage: totalApiUsage,
    overage,
    unusedPool,
    totalCost: plan.monthly_cost + overage,
    affordable,
    perModel,
  };
}

function computeTokenPlanResult(
  key: PlanKey,
  plan: Plan,
  totalTokens: number,
  models: Model[],
  configs: ModelConfig[],
  ratio: number,
): PlanResult {
  const perModel = configs.map(config => {
    const model = models.find(m => m.id === config.modelId)!;
    const effectiveRates = computeEffectiveRates(model, config);
    const modelTokens = Math.floor(totalTokens * (config.weight / 100));
    const apiCost = tokensToDollars(modelTokens, effectiveRates, ratio);
    const weightInput = ratio / (ratio + 1);
    const inputTokens = Math.floor(modelTokens * weightInput);
    const outputTokens = modelTokens - inputTokens;
    return {
      modelId: config.modelId,
      tokens: { total: modelTokens, input: inputTokens, output: outputTokens },
      effectiveRates,
      apiCost,
    };
  });

  const totalApiCost = perModel.reduce((s, m) => s + m.apiCost, 0);
  const overage = Math.max(0, totalApiCost - plan.api_pool);
  const unusedPool = Math.max(0, plan.api_pool - totalApiCost);

  return {
    plan: key,
    subscription: plan.monthly_cost,
    apiPool: plan.api_pool,
    apiBudget: plan.api_pool,
    apiUsage: totalApiCost,
    overage,
    unusedPool,
    totalCost: plan.monthly_cost + overage,
    affordable: true,
    perModel,
  };
}

export function dollarsToTokens(
  dollars: number,
  rates: EffectiveRates,
  ratio: number,
): TokenBreakdown {
  // cost per "cycle" of (ratio input tokens + 1 output token):
  // (ratio * inputRate + outputRate) / 1_000_000
  const costPerCycle = (ratio * rates.input + rates.output) / 1_000_000;
  if (costPerCycle <= 0) return { total: 0, input: 0, output: 0 };
  const cycles = dollars / costPerCycle;
  const input = Math.floor(cycles * ratio);
  const output = Math.floor(cycles);
  return { total: input + output, input, output };
}

export function tokensToDollars(
  tokens: number,
  rates: EffectiveRates,
  ratio: number,
): number {
  const weightInput = ratio / (ratio + 1);
  const inputTokens = tokens * weightInput;
  const outputTokens = tokens - inputTokens;
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations.ts src/lib/__tests__/calculations.test.ts
git commit -m "feat: implement computeRecommendation for budget and token modes"
```

---

### Task 7: Formatting Helpers

**Files:**
- Modify: `src/lib/calculations.ts`
- Modify: `src/lib/__tests__/calculations.test.ts`

- [ ] **Step 1: Write tests for formatters**

```ts
import { formatNumber, formatCurrency, formatRate } from '../calculations';

describe('formatters', () => {
  it('formatNumber handles M/k/raw', () => {
    expect(formatNumber(1_500_000)).toBe('1.50M');
    expect(formatNumber(45_000)).toBe('45.0k');
    expect(formatNumber(999)).toBe('999');
  });

  it('formatCurrency uses two decimals for precise amounts', () => {
    expect(formatCurrency(52.34)).toBe('$52.34');
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formatRate shows per-M pricing', () => {
    expect(formatRate(5)).toBe('$5.00');
    expect(formatRate(0.5)).toBe('$0.50');
  });
});
```

- [ ] **Step 2: Implement formatters**

Add to `src/lib/calculations.ts`:

```ts
export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(Math.round(num));
}

export function formatCurrency(num: number): string {
  return `$${num.toFixed(2)}`;
}

export function formatRate(rate: number): string {
  return `$${rate.toFixed(2)}`;
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npm test && git add src/lib/calculations.ts src/lib/__tests__/calculations.test.ts && git commit -m "feat: add formatting helpers with tests"
```

---

## Chunk 3: UI Components

### Task 8: Extract ModeToggle and Input Components

**Files:**
- Create: `src/components/ModeToggle.tsx`
- Create: `src/components/BudgetInput.tsx`
- Create: `src/components/TokenInput.tsx`

- [ ] **Step 1: Create `src/components/ModeToggle.tsx`**

Extract the existing `ModeToggle` from `App.tsx` lines 163-190. Import `Mode` from `lib/types`.

```tsx
import type { Mode } from '../lib/types';

export function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex bg-white rounded-full p-1 shadow-sm border border-[#e0e0d8]">
        <button
          onClick={() => onChange("budget")}
          className={`px-6 py-2.5 rounded-full font-medium text-sm transition-all ${
            mode === "budget"
              ? "bg-[#14120b] text-white shadow-sm"
              : "text-[#14120b]/60 hover:text-[#14120b]"
          }`}
        >
          I have a budget
        </button>
        <button
          onClick={() => onChange("tokens")}
          className={`px-6 py-2.5 rounded-full font-medium text-sm transition-all ${
            mode === "tokens"
              ? "bg-[#14120b] text-white shadow-sm"
              : "text-[#14120b]/60 hover:text-[#14120b]"
          }`}
        >
          I know my usage
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/BudgetInput.tsx`**

Extract the budget input (App.tsx lines 479-493, 523-531). Add `$20` minimum validation message.

```tsx
export function BudgetInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="text-center">
      <p className="text-[#14120b]/60 mb-4">What's your monthly budget?</p>
      <div className="inline-flex items-baseline gap-1">
        <span className="text-2xl font-medium text-[#14120b]/40">$</span>
        <input
          type="text"
          value={value.toLocaleString()}
          onChange={(e) => {
            const val = parseInt(e.target.value.replace(/,/g, ""), 10);
            onChange(isNaN(val) ? 0 : val);
          }}
          className="w-48 sm:w-56 text-6xl sm:text-7xl md:text-8xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-center p-0"
        />
      </div>
      {value >= 0 && value < 20 && (
        <p className="text-sm text-red-500 mt-2">Minimum budget is $20 (Pro plan subscription)</p>
      )}
      <div className="mt-6 px-4">
        <input
          type="range" min="20" max="500" step="10" value={Math.max(20, Math.min(500, value))}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]"
        />
        <div className="flex justify-between text-xs text-[#14120b]/40 mt-2">
          <span>$20</span><span>$200</span><span>$500</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/TokenInput.tsx`**

Extract the token input (App.tsx lines 494-519, 533-542). Same pattern as BudgetInput.

```tsx
export function TokenInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="text-center">
      <p className="text-[#14120b]/60 mb-4">How many tokens per month?</p>
      <div className="inline-flex items-baseline gap-2">
        <input
          type="text"
          value={value.toLocaleString()}
          onChange={(e) => {
            const val = parseInt(e.target.value.replace(/,/g, ""), 10);
            onChange(isNaN(val) ? 0 : val);
          }}
          className="w-72 sm:w-96 md:w-[28rem] text-4xl sm:text-5xl md:text-6xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-center p-0 overflow-visible"
        />
        <span className="text-lg sm:text-xl text-[#14120b]/40">tokens</span>
      </div>
      {value >= 1_000 && (
        <p className="text-lg text-[#14120b]/50 mt-2 font-medium">
          {value >= 1_000_000_000
            ? `${(value / 1_000_000_000).toFixed(value % 1_000_000_000 === 0 ? 0 : 2)} billion`
            : value >= 1_000_000
            ? `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 2)} million`
            : `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`}
        </p>
      )}
      <div className="mt-6 px-4">
        <input
          type="range" min="100000" max="1000000000" step="100000"
          value={Math.min(value, 1_000_000_000)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]"
        />
        <div className="flex justify-between text-xs text-[#14120b]/40 mt-2">
          <span>100k</span><span>500M</span><span>1B</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ModeToggle.tsx src/components/BudgetInput.tsx src/components/TokenInput.tsx
git commit -m "feat: extract ModeToggle, BudgetInput, TokenInput components"
```

---

### Task 9: ModelSelector Component

**Files:**
- Create: `src/components/ModelSelector.tsx`

- [ ] **Step 1: Extract the MultiSelectDropdown from App.tsx lines 192-273**

Rename to `ModelSelector`. Import `Model` from types. Move `PROVIDER_COLORS` to a shared constant in `src/lib/constants.ts`.

Create `src/lib/constants.ts`:
```ts
export const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "bg-orange-500",
  openai: "bg-green-500",
  google: "bg-blue-500",
  xai: "bg-gray-500",
  moonshot: "bg-purple-500",
  cursor: "bg-[#14120b]",
};
```

Create `src/components/ModelSelector.tsx`:

```tsx
import { useState } from 'react';
import type { Model } from '../lib/types';
import { PROVIDER_COLORS } from '../lib/constants';

interface Props {
  options: Model[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
}

export function ModelSelector({ options, selected, onChange, placeholder }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedModels = options.filter((m) => selected.includes(m.id));
  const unselectedModels = options.filter((m) => !selected.includes(m.id));

  return (
    <div className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-[#e0e0d8] rounded-xl px-4 py-3 flex items-center justify-between hover:border-[#14120b]/30 transition-colors cursor-pointer"
      >
        <div className="flex flex-wrap gap-2">
          {selectedModels.length === 0 ? (
            <span className="text-[#14120b]/40">{placeholder}</span>
          ) : (
            selectedModels.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1.5 bg-[#f7f7f4] rounded-full px-3 py-1 text-sm">
                <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[m.provider] || "bg-gray-400"}`} />
                <span className="font-medium">{m.name}</span>
              </span>
            ))
          )}
        </div>
        <svg className={`w-5 h-5 text-[#14120b]/40 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-[#e0e0d8] rounded-xl shadow-lg max-h-72 overflow-auto">
            {unselectedModels.length > 0 && (
              <div className="p-2">
                {unselectedModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => onChange([...selected, model.id])}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#f7f7f4] rounded-lg text-left"
                  >
                    <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[model.provider] || "bg-gray-400"}`} />
                    <div className="flex-1">
                      <span className="font-medium">{model.name}</span>
                      <span className="text-xs text-[#14120b]/40 ml-2">${model.rates.input}/${model.rates.output} per M</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedModels.length > 0 && unselectedModels.length > 0 && <div className="border-t border-[#e0e0d8]" />}
            {selectedModels.length > 0 && (
              <div className="p-2">
                <p className="text-xs font-medium text-[#14120b]/40 px-3 py-1 uppercase tracking-wide">Selected</p>
                {selectedModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => onChange(selected.filter((id) => id !== model.id))}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 rounded-lg text-left"
                  >
                    <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[model.provider] || "bg-gray-400"}`} />
                    <span className="font-medium">{model.name}</span>
                    <span className="ml-auto text-red-500 text-sm">Remove</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts src/components/ModelSelector.tsx
git commit -m "feat: extract ModelSelector component and shared constants"
```

---

### Task 10: ModelConfigRow and ModelConfigList

**Files:**
- Create: `src/components/ModelConfigRow.tsx`
- Create: `src/components/ModelConfigList.tsx`

These are the new per-model configuration rows — the biggest new UI piece.

- [ ] **Step 1: Create `src/components/ModelConfigRow.tsx`**

One row: provider color dot, model name, weight % input, variant checkboxes, caching toggle + slider, live effective rate display.

Key behaviors to implement:
- Only show checkboxes for variants the model supports (`model.variants?.max_mode`, `.fast`, `.thinking`)
- Fast and Max Mode are mutually exclusive: toggling one unchecks the other
- Caching toggle only shown if `model.rates.cache_read` exists
- Effective rate computed live via `computeEffectiveRates` and displayed as `$X.XX in / $X.XX out per M`

```tsx
import { useMemo } from 'react';
import type { Model, ModelConfig } from '../lib/types';
import { computeEffectiveRates, formatRate } from '../lib/calculations';
import { PROVIDER_COLORS } from '../lib/constants';

interface Props {
  model: Model;
  config: ModelConfig;
  onChange: (config: ModelConfig) => void;
}

export function ModelConfigRow({ model, config, onChange }: Props) {
  const effectiveRates = useMemo(
    () => computeEffectiveRates(model, config),
    [model, config]
  );

  const hasMaxMode = !!model.variants?.max_mode;
  const hasFast = !!model.variants?.fast;
  const hasThinking = !!model.variants?.thinking;
  const hasCaching = model.rates.cache_read !== null;

  function toggleMaxMode(checked: boolean) {
    onChange({ ...config, maxMode: checked, fast: checked ? false : config.fast });
  }

  function toggleFast(checked: boolean) {
    onChange({ ...config, fast: checked, maxMode: checked ? false : config.maxMode });
  }

  return (
    <div className="bg-white rounded-xl border border-[#e0e0d8] p-4 space-y-3">
      {/* Header: name + weight */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${PROVIDER_COLORS[model.provider] || 'bg-gray-400'}`} />
          <span className="font-semibold">{model.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number" min="0" max="100" step="5"
            value={config.weight}
            onChange={(e) => onChange({ ...config, weight: Number(e.target.value) })}
            className="w-16 text-right text-sm font-semibold bg-[#f7f7f4] border border-[#e0e0d8] rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#14120b]/30"
          />
          <span className="text-sm text-[#14120b]/50">%</span>
        </div>
      </div>

      {/* Variant checkboxes */}
      {(hasMaxMode || hasFast || hasThinking) && (
        <div className="flex flex-wrap gap-4 text-sm">
          {hasMaxMode && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={config.maxMode} onChange={(e) => toggleMaxMode(e.target.checked)}
                className="w-4 h-4 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]" />
              <span>Max Mode</span>
              {model.context.max && (
                <span className="text-xs text-[#14120b]/40">
                  ({Math.round(model.context.default / 1000)}k → {Math.round(model.context.max / 1000)}k)
                </span>
              )}
            </label>
          )}
          {hasFast && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={config.fast} onChange={(e) => toggleFast(e.target.checked)}
                className="w-4 h-4 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]" />
              <span>Fast</span>
            </label>
          )}
          {hasThinking && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={config.thinking} onChange={(e) => onChange({ ...config, thinking: e.target.checked })}
                className="w-4 h-4 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]" />
              <span>Thinking</span>
              <span className="text-xs text-[#14120b]/30">(info only)</span>
            </label>
          )}
        </div>
      )}

      {/* Caching */}
      {hasCaching && (
        <div>
          <label className="flex items-center gap-1.5 cursor-pointer text-sm">
            <input type="checkbox" checked={config.caching} onChange={(e) => onChange({ ...config, caching: e.target.checked })}
              className="w-4 h-4 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]" />
            <span>Caching</span>
          </label>
          {config.caching && (
            <div className="mt-2 pl-6">
              <div className="flex items-center gap-2">
                <input type="range" min="0" max="95" step="5" value={config.cacheHitRate}
                  onChange={(e) => onChange({ ...config, cacheHitRate: Number(e.target.value) })}
                  className="flex-1 h-1.5 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]" />
                <span className="text-xs font-semibold bg-[#f7f7f4] px-1.5 py-0.5 rounded w-10 text-center">{config.cacheHitRate}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Effective rate */}
      <div className="text-xs text-[#14120b]/50 pt-1 border-t border-[#e0e0d8]/50">
        effective: {formatRate(effectiveRates.input)} in / {formatRate(effectiveRates.output)} out per M
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/ModelConfigList.tsx`**

Manages the list of model config rows, handles % normalization warning.

```tsx
import type { Model, ModelConfig } from '../lib/types';
import { ModelConfigRow } from './ModelConfigRow';

interface Props {
  models: Model[];
  configs: ModelConfig[];
  onChange: (configs: ModelConfig[]) => void;
}

export function ModelConfigList({ models, configs, onChange }: Props) {
  const weightSum = configs.reduce((s, c) => s + c.weight, 0);
  const needsNormalization = configs.length > 0 && weightSum !== 100;

  function handleConfigChange(index: number, updated: ModelConfig) {
    const next = [...configs];
    next[index] = updated;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {configs.map((config, i) => {
        const model = models.find(m => m.id === config.modelId);
        if (!model) return null;
        return (
          <ModelConfigRow
            key={config.modelId}
            model={model}
            config={config}
            onChange={(updated) => handleConfigChange(i, updated)}
          />
        );
      })}
      {needsNormalization && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <span className="inline-block w-4 h-4 bg-amber-100 rounded-full text-center leading-4 font-bold">!</span>
          Weights sum to {weightSum}% — results will be normalized to 100%.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ModelConfigRow.tsx src/components/ModelConfigList.tsx
git commit -m "feat: add ModelConfigRow and ModelConfigList components"
```

---

### Task 11: BestPlanCard Component

**Files:**
- Create: `src/components/BestPlanCard.tsx`

- [ ] **Step 1: Create the new BestPlanCard**

Completely rewritten from the old one. Takes a `PlanResult` and the full model list. Shows per-model token breakdown.

```tsx
import type { Model, ModelConfig, PlanResult, Mode } from '../lib/types';
import { formatNumber, formatCurrency, formatRate } from '../lib/calculations';
import { PROVIDER_COLORS } from '../lib/constants';

interface Props {
  result: PlanResult;
  mode: Mode;
  models: Model[];
  configs: ModelConfig[];
}

export function BestPlanCard({ result, mode, models, configs }: Props) {
  return (
    <div className="bg-[#14120b] text-white rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium text-white/70 uppercase tracking-wide">Your Best Option</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-6">
        <h2 className="text-3xl sm:text-4xl font-bold">{result.plan === 'pro_plus' ? 'Pro Plus' : result.plan === 'ultra' ? 'Ultra' : 'Pro'}</h2>
        <div className="text-right">
          <p className="text-4xl sm:text-5xl font-bold">{formatCurrency(result.totalCost)}</p>
          <p className="text-white/60 text-sm">/month</p>
        </div>
      </div>

      <div className="space-y-2 border-t border-white/20 pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-white/60">Base subscription</span>
          <span>${result.subscription}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">API pool included</span>
          <span className={result.unusedPool > 0 ? "text-green-400" : ""}>
            ${result.apiPool}{result.unusedPool > 0 && " ✓"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Your estimated API usage</span>
          <span>{formatCurrency(result.apiUsage)}</span>
        </div>
        {result.overage > 0 && (
          <div className="flex justify-between">
            <span className="text-white/60">Overage</span>
            <span className="text-amber-400">+{formatCurrency(result.overage)}</span>
          </div>
        )}
        {result.unusedPool > 0 && (
          <div className="flex justify-between">
            <span className="text-white/60">Unused pool</span>
            <span className="text-green-400">{formatCurrency(result.unusedPool)}</span>
          </div>
        )}
      </div>

      {/* Per-model breakdown */}
      <div className="mt-6 pt-4 border-t border-white/20">
        <p className="text-sm text-white/60 mb-3">
          {mode === 'budget' ? 'What you get' : 'Your usage breakdown'}
        </p>
        <div className="space-y-3">
          {result.perModel.map((pm) => {
            const model = models.find(m => m.id === pm.modelId);
            const config = configs.find(c => c.modelId === pm.modelId);
            if (!model) return null;
            const variantBadges: string[] = [];
            if (config?.maxMode) variantBadges.push('Max');
            if (config?.fast) variantBadges.push('Fast');
            if (config?.thinking) variantBadges.push('Thinking');
            if (config?.caching) variantBadges.push(`Cache ${config.cacheHitRate}%`);
            return (
              <div key={pm.modelId} className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[model.provider] || 'bg-gray-400'}`} />
                    <span className="font-medium text-sm">{model.name}</span>
                    {variantBadges.map(badge => (
                      <span key={badge} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">{badge}</span>
                    ))}
                  </div>
                  <p className="text-xs text-white/40 ml-4">
                    {formatRate(pm.effectiveRates.input)} / {formatRate(pm.effectiveRates.output)} per M
                  </p>
                </div>
                <div className="text-right">
                  {mode === 'budget' ? (
                    <span className="font-semibold">{formatNumber(pm.tokens.total)} tokens</span>
                  ) : (
                    <span className="font-semibold">{formatCurrency(pm.apiCost)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BestPlanCard.tsx
git commit -m "feat: add BestPlanCard with per-model breakdown"
```

---

### Task 12: PlanComparison Component

**Files:**
- Create: `src/components/PlanComparison.tsx`

- [ ] **Step 1: Create the expandable plan comparison table**

```tsx
import { useState } from 'react';
import type { Model, Mode, PlanResult } from '../lib/types';
import { formatNumber, formatCurrency } from '../lib/calculations';
import { PROVIDER_COLORS } from '../lib/constants';

interface Props {
  results: PlanResult[];
  mode: Mode;
  budget: number;
  models: Model[];
}

export function PlanComparison({ results, mode, budget, models }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  // Get unique model IDs from the first result's perModel
  const modelIds = results[0]?.perModel.map(pm => pm.modelId) ?? [];

  return (
    <div className="mt-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-[#14120b]/60 hover:text-[#14120b]"
      >
        <svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        Compare all plans
      </button>

      {isOpen && (
        <div className="mt-4 bg-white border border-[#e0e0d8] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f7f4]">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-[#14120b]/60"></th>
                {results.map(r => (
                  <th key={r.plan} className={`text-right px-4 py-3 font-medium ${
                    mode === 'budget' && !r.affordable ? 'text-[#14120b]/30' : 'text-[#14120b]/60'
                  }`}>
                    {r.plan === 'pro_plus' ? 'Pro Plus' : r.plan === 'ultra' ? 'Ultra' : 'Pro'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0d8]">
              <Row label="Subscription" values={results.map(r => `$${r.subscription}`)} results={results} mode={mode} budget={budget} />
              <Row label="API pool" values={results.map(r => `$${r.apiPool}`)} results={results} mode={mode} budget={budget} />
              <Row label="Your API usage" values={results.map(r => formatCurrency(r.apiUsage))} results={results} mode={mode} budget={budget} />
              <Row label="Overage" values={results.map(r => r.overage > 0 ? formatCurrency(r.overage) : '—')} results={results} mode={mode} budget={budget} />
              <Row label="Total cost" values={results.map(r => formatCurrency(r.totalCost))} results={results} mode={mode} budget={budget} bold />
              <Row label="Unused pool" values={results.map(r => r.unusedPool > 0 ? formatCurrency(r.unusedPool) : '—')} results={results} mode={mode} budget={budget} />
              {modelIds.map(modelId => {
                const model = models.find(m => m.id === modelId);
                if (!model) return null;
                return (
                  <tr key={modelId}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[model.provider] || 'bg-gray-400'}`} />
                        <span className="text-xs">{model.name}</span>
                      </div>
                    </td>
                    {results.map(r => {
                      const pm = r.perModel.find(p => p.modelId === modelId);
                      const dimmed = mode === 'budget' && !r.affordable;
                      return (
                        <td key={r.plan} className={`px-4 py-2 text-right text-xs font-semibold ${dimmed ? 'text-[#14120b]/30' : ''}`}>
                          {pm ? (mode === 'budget' ? `${formatNumber(pm.tokens.total)} tokens` : formatCurrency(pm.apiCost)) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ label, values, results, mode, budget, bold }: {
  label: string; values: string[]; results: PlanResult[]; mode: Mode; budget: number; bold?: boolean;
}) {
  return (
    <tr>
      <td className={`px-4 py-2 ${bold ? 'font-bold' : ''}`}>{label}</td>
      {values.map((v, i) => {
        const dimmed = mode === 'budget' && !results[i].affordable;
        return (
          <td key={i} className={`px-4 py-2 text-right ${bold ? 'font-bold' : ''} ${dimmed ? 'text-[#14120b]/30' : ''}`}>
            {v}
          </td>
        );
      })}
    </tr>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PlanComparison.tsx
git commit -m "feat: add expandable PlanComparison component"
```

---

## Chunk 4: App Orchestration

### Task 13: Rewrite App.tsx

**Files:**
- Modify: `src/App.tsx`

This is the big rewrite: replace the entire App.tsx with the new orchestration that imports all components and uses the new calculation engine.

- [ ] **Step 1: Rewrite `src/App.tsx`**

Replace the entire file. Key state changes:
- `selectedModels: string[]` → drives which models are selected
- `modelConfigs: ModelConfig[]` → per-model config (weight, variants, caching)
- Remove global `useMaxMode`, `useCaching`, `cacheHitRate` — now per-model
- Add config initialization from `auto_checks` when models are added

```tsx
import { useMemo, useState, useCallback } from 'react';
import pricingData from './data/cursor-pricing.json';
import type { Mode, Model, ModelConfig, PricingData } from './lib/types';
import { computeRecommendation } from './lib/calculations';
import { ModeToggle } from './components/ModeToggle';
import { BudgetInput } from './components/BudgetInput';
import { TokenInput } from './components/TokenInput';
import { ModelSelector } from './components/ModelSelector';
import { ModelConfigList } from './components/ModelConfigList';
import { BestPlanCard } from './components/BestPlanCard';
import { PlanComparison } from './components/PlanComparison';

const PRICING = pricingData as PricingData;
const API_MODELS = PRICING.models.filter((m) => m.pool === 'api');

function createDefaultConfig(model: Model): ModelConfig {
  return {
    modelId: model.id,
    weight: 0, // will be redistributed
    maxMode: model.auto_checks?.max_mode ?? false,
    fast: model.auto_checks?.fast ?? false,
    thinking: model.auto_checks?.thinking ?? false,
    caching: false,
    cacheHitRate: 50,
  };
}

function redistributeWeights(configs: ModelConfig[]): ModelConfig[] {
  if (configs.length === 0) return configs;
  const evenWeight = Math.round(100 / configs.length);
  return configs.map((c, i) => ({
    ...c,
    weight: i === configs.length - 1
      ? 100 - evenWeight * (configs.length - 1)  // last one gets remainder
      : evenWeight,
  }));
}

function App() {
  const [mode, setMode] = useState<Mode>('budget');
  const [budget, setBudget] = useState(60);
  const [tokens, setTokens] = useState(1_000_000);
  const [inputRatio, setInputRatio] = useState(3);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>(() => {
    const defaultModel = API_MODELS.find(m => m.id === 'claude-4-6-sonnet') ?? API_MODELS[0];
    return defaultModel ? redistributeWeights([createDefaultConfig(defaultModel)]) : [];
  });

  const selectedModelIds = useMemo(() => modelConfigs.map(c => c.modelId), [modelConfigs]);
  const selectedModels = useMemo(
    () => API_MODELS.filter(m => selectedModelIds.includes(m.id)),
    [selectedModelIds]
  );

  const handleModelSelectionChange = useCallback((ids: string[]) => {
    setModelConfigs(prev => {
      // Keep existing configs for models that are still selected
      const kept = prev.filter(c => ids.includes(c.modelId));
      // Add new configs for newly selected models
      const newIds = ids.filter(id => !prev.some(c => c.modelId === id));
      const added = newIds.map(id => {
        const model = API_MODELS.find(m => m.id === id)!;
        return createDefaultConfig(model);
      });
      return redistributeWeights([...kept, ...added]);
    });
  }, []);

  const recommendation = useMemo(() => {
    if (modelConfigs.length === 0) return null;
    return computeRecommendation(
      mode, budget, tokens,
      selectedModels, modelConfigs,
      PRICING.plans, inputRatio
    );
  }, [mode, budget, tokens, selectedModels, modelConfigs, inputRatio]);

  return (
    <div className="min-h-screen bg-[#f7f7f4] text-[#14120b]">
      <header className="bg-white border-b border-[#e0e0d8]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#14120b] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold">Cursor Cost Calculator</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <ModeToggle mode={mode} onChange={setMode} />

        <div className="mt-8">
          {mode === 'budget'
            ? <BudgetInput value={budget} onChange={setBudget} />
            : <TokenInput value={tokens} onChange={setTokens} />
          }
        </div>

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

        {/* Advanced Options */}
        <div className="mt-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-[#14120b]/60 hover:text-[#14120b]"
          >
            <svg className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <input type="range" min="1" max="10" step="0.5" value={inputRatio}
                onChange={(e) => setInputRatio(Number(e.target.value))}
                className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]" />
              <div className="flex justify-between text-xs text-[#14120b]/40 mt-1">
                <span>1:1</span><span>3:1 typical</span><span>10:1</span>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {recommendation && (
          <>
            <div className="mt-8">
              <BestPlanCard result={recommendation.best} mode={mode} models={selectedModels} configs={modelConfigs} />
            </div>
            <PlanComparison results={recommendation.all} mode={mode} budget={budget} models={selectedModels} />
          </>
        )}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-[#e0e0d8] text-sm text-[#14120b]/60 space-y-4">
          <p>
            <strong>How plans work:</strong> All plans include unlimited Auto and Composer 1.5 through a separate pool.
            The API pool is used for all other models. Once exhausted, you pay overage at the same rates.
          </p>
          <p>
            <strong>Max Mode:</strong> Extends context to maximum supported. Adds 20% Cursor upcharge plus provider long-context rates.
          </p>
          <p className="text-xs text-[#14120b]/40 text-center">
            Source: cursor.com/docs/models-and-pricing · Last updated {PRICING.meta.retrieved_at}
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Delete the old `src/App.css`**

The old App.css contains unused Vite template styles. All styling is via Tailwind.

```bash
rm src/App.css
```

- [ ] **Step 3: Remove the App.css import from anywhere if still referenced**

Check `main.tsx` — it imports `./index.css` (Tailwind), not `App.css`. The old `App.tsx` doesn't import App.css either. Should be clean.

- [ ] **Step 4: Verify build compiles**

```bash
npx tsc --noEmit
```

Fix any type errors. Common issues:
- `ModelSelector` props may not match — ensure it accepts the same `options`/`selected`/`onChange`/`placeholder` props as the old `MultiSelectDropdown`
- The `PricingData` type in `types.ts` must match the new JSON structure

- [ ] **Step 5: Run dev server and verify the app loads**

```bash
npm run dev
```

Open in browser. Verify:
- Mode toggle works
- Model selector opens and shows API pool models only
- Selecting models creates config rows with variant checkboxes
- % weights auto-distribute
- Best plan card shows per-model breakdown
- Plan comparison expands and shows all three plans

- [ ] **Step 6: Run all tests**

```bash
npm test
```

- [ ] **Step 7: Run lint**

```bash
npm run lint
```

Fix any lint issues.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git rm -f src/App.css 2>/dev/null || true
git status  # verify no unintended files staged
git commit -m "feat: rewrite App.tsx with new calculation engine and component architecture"
```

---

## Chunk 5: Verification and Cleanup

### Task 14: Build Verification

**Files:** None new — verification only.

- [ ] **Step 1: Run production build**

```bash
npm run build
```
Expected: Clean build, no errors.

- [ ] **Step 2: Preview the production build**

```bash
npm run preview
```

Open in browser and verify the same behaviors as dev mode.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```
Expected: All tests pass.

- [ ] **Step 4: Verify the original bug is fixed**

In the browser, set budget to $60 with any model selected:
- Should recommend **Pro Plus** (not Pro)
- Should show $70 API pool with $0 overage
- Should NOT show Pro with $40 overage

Select multiple models — the BestPlanCard should show token allocations for ALL selected models, not just the first.

- [ ] **Step 5: Delete the smoke test**

```bash
rm src/lib/__tests__/smoke.test.ts
```

- [ ] **Step 6: Final commit**

```bash
git rm -f src/lib/__tests__/smoke.test.ts
git status  # verify only intended files
git commit -m "chore: cleanup and verify build"
```
