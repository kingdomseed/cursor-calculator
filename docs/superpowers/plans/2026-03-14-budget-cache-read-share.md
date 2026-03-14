# Budget Mode Cache-Read Share Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix budget mode's broken caching math by routing it through exact-token pricing with cache-read share, matching the proven-accurate model used by manual token mode.

**Architecture:** Add a `dollarsToExactTokens` conversion that inverts `exactTokensToDollars` — given a dollar budget, cache-read share, and input:output ratio, produce an `ExactTokenBreakdown`. Replace `computeBudgetPlanResult`'s use of `computeEffectiveRates` + `dollarsToTokens` (broken `applyCaching` formula) with `computeBillableRates` + `dollarsToExactTokens`. The per-model `cacheHitRate` field on `ModelConfig` is reinterpreted as a cache-read share (0-100%) — same semantic as the global `cacheReadShare` but per-model. A global slider in budget mode sets all models' cache share; per-model overrides remain available.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 4, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/domain/recommendation/budgetUsage.ts` | `dollarsToExactTokens()` — inverts exact-token pricing for budget allocation. |
| Create | `src/domain/recommendation/__tests__/budgetUsage.test.ts` | Unit tests for the new conversion. |
| Modify | `src/domain/recommendation/recommendation.ts` | `computeBudgetPlanResult` uses `dollarsToExactTokens` + `exactTokensToDollars` instead of `computeEffectiveRates` + `dollarsToTokens`. |
| Modify | `src/domain/recommendation/__tests__/recommendation.test.ts` | Update budget mode test expectations. |
| Modify | `src/app/calculatorSelectors.ts` | Pass `cacheReadShare` into `computeRecommendation` for budget mode. |
| Modify | `src/components/ModelConfigRow.tsx` | Rename "Caching" checkbox + slider to "Cache-read share" with 0-100% range. |
| Modify | `src/App.tsx` | Add global cache-read share slider to budget mode content area. |
| Modify | `src/domain/recommendation/rates.ts` | Keep all exports — `computeEffectiveRates` is still used by token mode path and `ModelConfigRow.tsx` display. Remove only `applyCaching` if confirmed unused. |

---

## Chunk 1: Core Pricing Math

### Task 1: Create `dollarsToExactTokens` conversion

**Files:**
- Create: `src/domain/recommendation/budgetUsage.ts`
- Create: `src/domain/recommendation/__tests__/budgetUsage.test.ts`

The function inverts the exact-token pricing formula. Given dollars, billable rates, cache-read share, and input:output ratio, it produces an `ExactTokenBreakdown`.

The math:
- Cache-read share determines what fraction of total tokens are cache reads
- Remaining tokens are split by input:output ratio
- `inputWithCacheWrite` is always 0 (we don't model cache-write volume in estimates)
- Total tokens = dollars / blended_exact_rate_per_token

The blended rate per token:
```
cacheShare = cacheReadShare / 100
remaining = 1 - cacheShare
inputFraction = remaining * (ratio / (ratio + 1))
outputFraction = remaining * (1 / (ratio + 1))

cacheReadRate = rates.cache_read ?? rates.input
blendedRate = (cacheShare * cacheReadRate + inputFraction * rates.input + outputFraction * rates.output) / 1_000_000
totalTokens = dollars / blendedRate
```

- [ ] **Step 1: Write failing tests**

Create `src/domain/recommendation/__tests__/budgetUsage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dollarsToExactTokens } from '../budgetUsage';
import { exactTokensToDollars } from '../conversions';
import type { ModelRates } from '../../catalog/types';

const opusRates: ModelRates = { input: 5, cache_write: 6.25, cache_read: 0.50, output: 25 };
const gptRates: ModelRates = { input: 2.50, cache_write: null, cache_read: 0.25, output: 15 };

describe('dollarsToExactTokens', () => {
  it('produces tokens that round-trip back to the same dollar amount', () => {
    const tokens = dollarsToExactTokens(100, opusRates, 90, 3);
    const cost = exactTokensToDollars(tokens, opusRates);
    expect(cost).toBeCloseTo(100, 1);
  });

  it('allocates 90% of tokens as cache reads with 3:1 ratio on remainder', () => {
    const tokens = dollarsToExactTokens(100, opusRates, 90, 3);
    const cacheShare = tokens.cacheRead / tokens.total;
    expect(cacheShare).toBeCloseTo(0.9, 2);
    const remainingInput = tokens.inputWithoutCacheWrite;
    const remainingOutput = tokens.output;
    expect(remainingInput / remainingOutput).toBeCloseTo(3, 0);
  });

  it('produces more tokens with higher cache share (cheaper tokens)', () => {
    const noCacheTokens = dollarsToExactTokens(100, opusRates, 0, 3);
    const highCacheTokens = dollarsToExactTokens(100, opusRates, 90, 3);
    expect(highCacheTokens.total).toBeGreaterThan(noCacheTokens.total);
  });

  it('handles models without cache_write rates', () => {
    const tokens = dollarsToExactTokens(100, gptRates, 80, 3);
    const cost = exactTokensToDollars(tokens, gptRates);
    expect(cost).toBeCloseTo(100, 1);
    expect(tokens.inputWithCacheWrite).toBe(0);
  });

  it('handles zero cache share (no caching)', () => {
    const tokens = dollarsToExactTokens(100, opusRates, 0, 3);
    expect(tokens.cacheRead).toBe(0);
    expect(tokens.total).toBe(tokens.inputWithoutCacheWrite + tokens.output);
  });

  it('returns zero tokens for zero dollars', () => {
    const tokens = dollarsToExactTokens(0, opusRates, 90, 3);
    expect(tokens.total).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/recommendation/__tests__/budgetUsage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `dollarsToExactTokens`**

Create `src/domain/recommendation/budgetUsage.ts`:

```ts
import type { ModelRates } from '../catalog/types';
import type { ExactTokenBreakdown } from './types';

export function dollarsToExactTokens(
  dollars: number,
  rates: ModelRates,
  cacheReadShare: number,
  inputOutputRatio: number,
): ExactTokenBreakdown {
  if (dollars <= 0) {
    return { inputWithCacheWrite: 0, inputWithoutCacheWrite: 0, cacheRead: 0, output: 0, total: 0 };
  }

  const clampedShare = Math.min(100, Math.max(0, cacheReadShare)) / 100;
  const safeRatio = Number.isFinite(inputOutputRatio) && inputOutputRatio > 0 ? inputOutputRatio : 1;

  const remaining = 1 - clampedShare;
  const inputFraction = remaining * (safeRatio / (safeRatio + 1));
  const outputFraction = remaining * (1 / (safeRatio + 1));

  const cacheReadRate = rates.cache_read ?? rates.input;
  const blendedRatePerToken = (
    clampedShare * cacheReadRate +
    inputFraction * rates.input +
    outputFraction * rates.output
  ) / 1_000_000;

  if (blendedRatePerToken <= 0) {
    return { inputWithCacheWrite: 0, inputWithoutCacheWrite: 0, cacheRead: 0, output: 0, total: 0 };
  }

  const totalTokens = Math.round(dollars / blendedRatePerToken);
  const cacheRead = Math.round(totalTokens * clampedShare);
  const remainingTokens = totalTokens - cacheRead;
  const inputWithoutCacheWrite = Math.round(remainingTokens * (safeRatio / (safeRatio + 1)));
  const output = remainingTokens - inputWithoutCacheWrite;

  return {
    inputWithCacheWrite: 0,
    inputWithoutCacheWrite,
    cacheRead,
    output,
    total: totalTokens,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/recommendation/__tests__/budgetUsage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/recommendation/budgetUsage.ts src/domain/recommendation/__tests__/budgetUsage.test.ts
git commit -m "feat: add dollarsToExactTokens for budget mode exact-token pricing"
```

---

### Task 2: Reroute `computeBudgetPlanResult` through exact-token math

**Files:**
- Modify: `src/domain/recommendation/recommendation.ts`
- Modify: `src/domain/recommendation/__tests__/recommendation.test.ts`

The current flow: `computeEffectiveRates` (broken `applyCaching`) → `dollarsToTokens` (2-rate blended) → `buildPlanLineItem`

The new flow: `computeBillableRates` (correct, no caching baked in) → `dollarsToExactTokens` (4-bucket allocation) → `exactTokensToDollars` (for the cost) → `buildPlanLineItem` with `exactTokens`

- [ ] **Step 1: Update `computeBudgetPlanResult` signature**

Add `cacheReadShare: number` parameter to `computeBudgetPlanResult` and to `computeRecommendation`.

In `computeRecommendation`, pass `cacheReadShare` through (add it as a parameter after `inputOutputRatio`):

```ts
export function computeRecommendation(
  mode: Mode,
  budget: number,
  totalTokens: number,
  models: Model[],
  configs: ModelConfig[],
  plans: PricingData['plans'],
  inputOutputRatio: number,
  cacheReadShare: number = 0,
): Recommendation {
```

In the `mode === 'budget'` branch, pass `cacheReadShare` to `computeBudgetPlanResult`.

- [ ] **Step 2: Rewrite `computeBudgetPlanResult` internals**

Replace:
```ts
const effectiveRates = computeEffectiveRates(model, config);
const modelDollars = apiBudget * (config.weight / 100);
const tokens = dollarsToTokens(modelDollars, effectiveRates, ratio);
```

With:
```ts
const billableRates = computeBillableRates(model, config);
const modelDollars = apiBudget * (config.weight / 100);
const modelCacheShare = config.caching ? config.cacheHitRate : cacheReadShare;
const exactTokens = dollarsToExactTokens(modelDollars, billableRates, modelCacheShare, ratio);
const apiCost = exactTokensToDollars(exactTokens, billableRates);
const tokens: TokenBreakdown = {
  total: exactTokens.total,
  input: exactTokens.inputWithCacheWrite + exactTokens.inputWithoutCacheWrite + exactTokens.cacheRead,
  output: exactTokens.output,
};
```

And update the `buildPlanLineItem` call to pass `exactTokens` and use `effectiveRatesFromExactTokens` for display rates:

```ts
const effectiveRates = effectiveRatesFromExactTokens(exactTokens, billableRates);
return buildPlanLineItem(
  {
    key: config.modelId,
    modelId: config.modelId,
    label: model.name,
    provider: model.provider,
    pool: model.pool,
    tokens,
    exactTokens,
    maxMode: config.maxMode,
    fast: config.fast,
    thinking: config.thinking,
    caching: modelCacheShare > 0,
    cacheHitRate: modelCacheShare,
    approximated: false,
  },
  effectiveRates,
  apiCost,
);
```

Key detail: `modelCacheShare` uses the per-model `config.cacheHitRate` when the model's caching checkbox is enabled, otherwise falls back to the global `cacheReadShare`. This gives per-model overrides.

- [ ] **Step 3: Update imports**

In `recommendation.ts`, add imports:
```ts
import { dollarsToExactTokens } from './budgetUsage';
import { exactTokensToDollars } from './conversions';
import { effectiveRatesFromExactTokens } from './rates';
```

Remove the import of `computeEffectiveRates` if no longer used elsewhere in this file. Keep `computeBillableRates`.

- [ ] **Step 4: Update existing budget mode tests**

In `src/domain/recommendation/__tests__/recommendation.test.ts`, add `cacheReadShare` parameter (default 0) to `computeRecommendation` calls that test budget mode. Existing tests should pass with `cacheReadShare: 0` producing the same results as before for the no-caching case.

If any budget tests relied on the old `applyCaching` behavior with caching enabled, update their expectations to match the new exact-token math.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/domain/recommendation/recommendation.ts src/domain/recommendation/__tests__/recommendation.test.ts
git commit -m "feat: route budget mode through exact-token pricing with cache-read share"
```

---

### Task 3: Wire `cacheReadShare` into budget mode selector

**Files:**
- Modify: `src/app/calculatorSelectors.ts`

- [ ] **Step 1: Pass cacheReadShare to computeRecommendation**

In `selectRecommendation`, the budget mode call at line 98-106 currently passes `state.inputRatio` as the last arg. Add `state.cacheReadShare`:

```ts
return computeRecommendation(
  state.mode,
  state.budget,
  state.tokens,
  selectSelectedModels(state, inputs.manualModels),
  state.modelConfigs,
  inputs.plans,
  state.inputRatio,
  state.cacheReadShare,
);
```

- [ ] **Step 2: Add a test verifying cacheReadShare is forwarded in budget mode**

In `src/app/__tests__/calculatorSelectors.test.ts`, add a test that calls `selectRecommendation` with a budget-mode state where `cacheReadShare > 0` and verifies the recommendation result reflects cache-discounted pricing (e.g., higher token yield than with `cacheReadShare: 0`).

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/calculatorSelectors.ts src/app/__tests__/calculatorSelectors.test.ts
git commit -m "feat: pass cacheReadShare to budget mode recommendation"
```

---

## Chunk 2: UI Changes

### Task 4: Add global cache-read share slider to budget mode

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add cache-read share slider below budget input**

In `src/App.tsx`, in the budget mode content area, add the cache-read share slider inside the same `<div>` that wraps `<BudgetInput>`, immediately after the `<BudgetInput>` closing tag (before the wrapping div closes). Read the current `App.tsx` first to find the exact insertion point:

```tsx
{mode === 'budget' && (
  <div className="mt-6 p-4 bg-white rounded-xl border border-[#e0e0d8]">
    <div className="flex items-center justify-between mb-2">
      <label className="text-sm font-medium">Cache-read share</label>
      <span className="text-sm font-semibold bg-[#f7f7f4] px-2 py-0.5 rounded">
        {state.cacheReadShare}%
      </span>
    </div>
    <input
      type="range"
      min="0"
      max="100"
      step="5"
      value={state.cacheReadShare}
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
)}
```

Note: `state.cacheReadShare` and `setCacheReadShare` are already available from the controller — they were added for manual token mode and live on the shared state.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Builds successfully.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add cache-read share slider to budget mode"
```

---

### Task 5: Rename per-model caching UI to "Cache-read share"

**Files:**
- Modify: `src/components/ModelConfigRow.tsx`

- [ ] **Step 1: Update the caching section UI**

In `ModelConfigRow.tsx`, update the caching section:
- Rename "Caching" checkbox label to "Custom cache-read share"
- When enabled, the slider label becomes "Cache-read share" (0-100% range, step 5)
- Add helper text: "Overrides the global cache-read share for this model"
- Change the slider max from 95 to 100 (cache-read share can be 100%)

- [ ] **Step 2: Run lint and build**

Run: `npm run lint && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ModelConfigRow.tsx
git commit -m "feat: rename per-model caching to cache-read share with override semantics"
```

---

### Task 6: Clean up unused code

**Files:**
- Modify: `src/domain/recommendation/rates.ts`

- [ ] **Step 1: Check if `computeEffectiveRates` and `applyCaching` are still used**

Search for references to `computeEffectiveRates` across the codebase. If it's only used by the old budget path (now removed), delete it and `applyCaching`. Keep `computeBillableRates`, `effectiveRatesFromExactTokens`, and `effectiveRatesFromExactCost` — they're used by other paths.

Note: `computeEffectiveRates` may still be used by `ModelConfigRow.tsx` for displaying effective rates. If so, keep it but update the display to use `effectiveRatesFromExactTokens` instead (which gives accurate rates from the exact token breakdown). Or keep `computeEffectiveRates` for display purposes only — it's not wrong for showing "what rate would this model's tokens cost at", it's only wrong for computing token yields from dollars.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/domain/recommendation/rates.ts
git commit -m "refactor: remove unused applyCaching if no longer referenced"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Manual browser verification**

Start dev server (`npm run dev`) and verify:
1. Budget mode shows cache-read share slider below the budget input.
2. Moving the cache slider increases estimated token yield.
3. Per-model "Custom cache-read share" checkbox overrides the global slider.
4. $130 budget with GPT-5.4 and 90% cache share produces tokens consistent with manual token mode's pricing.
5. Manual token mode still works correctly (unchanged).
6. CSV import mode still works correctly (unchanged).

- [ ] **Step 5: Numerical verification**

With GPT-5.4, $130 budget, 90% cache, 3:1 ratio:
- Expected: the token yield should be close to what $130 buys in manual token mode with the same settings.
- The exact-token round-trip test (Task 1) guarantees dollars → tokens → dollars consistency.
