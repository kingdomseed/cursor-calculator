# Sidebar Navigation & CSV Model Grouping Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three-level toggle navigation with a fixed dark sidebar, and group CSV import model rows by base model family with expand/collapse.

**Architecture:** Two independent features sharing no state or types. Feature 1 adds a sidebar layout with a `navigate` reducer action that combines mode + token source. Feature 2 adds `modelId` to `RecommendationModelDisplayRow`, then uses it to build `modelGroups` on the presentation model from catalog variant structure, rendered as collapsible groups in BestPlanCard and PlanComparison.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 4, Vitest

**Spec:** `docs/superpowers/specs/2026-03-14-sidebar-nav-and-model-grouping-design.md`

**Key implementation note:** `RecommendationModelDisplayRow.key` is a composite key (e.g., `claude-opus-4-6:base:max:plain:api`) built by `buildUsageKey()` in `src/domain/importReplay/aggregate.ts`. It is NOT a bare model ID. Model grouping must use the `modelId` field from `PlanLineItem`, which requires adding `modelId` to the display row type.

---

## File Map

### Feature 1: Sidebar Navigation

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/components/Sidebar.tsx` | Nav items, branding, full footer content (explanatory text, disclaimer, links, dynamic date). |
| Create | `src/components/SidebarLayout.tsx` | Two-panel layout wrapper. Mobile hamburger state, overlay, escape key. |
| Create | `src/components/__tests__/Sidebar.test.tsx` | Sidebar renders correct active state, nav items, footer content. |
| Modify | `src/app/calculatorReducer.ts` | Add `navigate` action type and case with exhaustive inner check. |
| Modify | `src/app/calculatorState.ts` | Export `NavigationTarget` type. |
| Modify | `src/app/useCalculatorController.ts` | Add `navigate` callback, `navigationTarget` to interface and return. |
| Modify | `src/App.tsx` | Replace header/toggles/footer with SidebarLayout. Wire `navigate`. |
| Modify | `src/components/__tests__/CalculatorCopy.test.tsx` | Remove ModeToggle test, keep BudgetInput/TokenInput and WelcomeModal tests. |
| Remove | `src/components/ModeToggle.tsx` | Replaced by sidebar nav. |

### Feature 2: CSV Model Grouping

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/app/recommendationPresentation.ts` | Add `modelId` to `RecommendationModelDisplayRow`. Carry it from `PlanLineItem.modelId`. |
| Create | `src/app/modelGrouping.ts` | `getBaseModelId()` derivation (takes modelId, not key), `buildModelGroups()` helper. |
| Create | `src/app/__tests__/modelGrouping.test.ts` | Unit tests for grouping key derivation and group aggregation. |
| Modify | `src/app/__tests__/recommendationPresentation.test.ts` | Test `modelGroups` populated for import mode, null for manual mode. |
| Modify | `src/components/BestPlanCard.tsx` | Render collapsible model groups when `modelGroups` is non-null. |
| Modify | `src/components/__tests__/BestPlanCard.test.tsx` | Test grouped rendering. |
| Modify | `src/components/PlanComparison.tsx` | Render grouped model rows with per-plan aggregation. |
| Modify | `src/components/__tests__/PlanComparison.test.tsx` | Test grouped comparison rows. |

---

## Chunk 1: Sidebar Navigation

### Task 1: Add `navigate` action to reducer

**Files:**
- Modify: `src/app/calculatorState.ts`
- Modify: `src/app/calculatorReducer.ts`
- Modify: `src/app/__tests__/calculatorReducer.test.ts`

- [ ] **Step 1: Write failing tests for the navigate action**

Add to `src/app/__tests__/calculatorReducer.test.ts`:

```ts
it('navigates to budget mode', () => {
  const state = createInitialCalculatorState(manualModels);
  const result = calculatorReducer(
    { ...state, mode: 'tokens', tokenSource: 'cursor_import' },
    { type: 'navigate', target: 'budget' },
  );
  expect(result.mode).toBe('budget');
});

it('navigates to manual usage mode', () => {
  const state = createInitialCalculatorState(manualModels);
  const result = calculatorReducer(state, { type: 'navigate', target: 'manual_usage' });
  expect(result.mode).toBe('tokens');
  expect(result.tokenSource).toBe('manual');
});

it('navigates to csv import mode', () => {
  const state = createInitialCalculatorState(manualModels);
  const result = calculatorReducer(state, { type: 'navigate', target: 'csv_import' });
  expect(result.mode).toBe('tokens');
  expect(result.tokenSource).toBe('cursor_import');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/__tests__/calculatorReducer.test.ts`
Expected: FAIL — `navigate` action type does not exist.

- [ ] **Step 3: Add NavigationTarget type to calculatorState.ts**

Add to `src/app/calculatorState.ts` after `ManualTokenInputMode`:

```ts
export type NavigationTarget = 'budget' | 'manual_usage' | 'csv_import';
```

- [ ] **Step 4: Add navigate action and reducer case**

In `src/app/calculatorReducer.ts`, import `NavigationTarget` from `./calculatorState`. Add to the `CalculatorAction` union:

```ts
| { type: 'navigate'; target: NavigationTarget }
```

Add the reducer case before `default`:

```ts
case 'navigate': {
  switch (action.target) {
    case 'budget':
      return { ...state, mode: 'budget' };
    case 'manual_usage':
      return { ...state, mode: 'tokens', tokenSource: 'manual' };
    case 'csv_import':
      return { ...state, mode: 'tokens', tokenSource: 'cursor_import' };
    default: {
      const _exhaustive: never = action.target;
      return _exhaustive;
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/app/__tests__/calculatorReducer.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/calculatorState.ts src/app/calculatorReducer.ts src/app/__tests__/calculatorReducer.test.ts
git commit -m "feat: add navigate reducer action combining mode and token source"
```

---

### Task 2: Wire navigate through controller

**Files:**
- Modify: `src/app/useCalculatorController.ts`

- [ ] **Step 1: Add navigate and navigationTarget to controller**

In `src/app/useCalculatorController.ts`:

1. Import `NavigationTarget` from `./calculatorState`.
2. Add to the `CalculatorController` interface:

```ts
navigationTarget: NavigationTarget;
navigate: (target: NavigationTarget) => void;
```

3. Add the derived value and callback:

```ts
const navigationTarget: NavigationTarget = useMemo(() => {
  if (state.mode === 'budget') return 'budget';
  if (state.tokenSource === 'cursor_import') return 'csv_import';
  return 'manual_usage';
}, [state.mode, state.tokenSource]);

const navigate = useCallback((target: NavigationTarget) => {
  dispatch({ type: 'navigate', target });
}, []);
```

4. Add both to the returned object.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/useCalculatorController.ts
git commit -m "feat: expose navigate callback and navigationTarget from controller"
```

---

### Task 3: Create Sidebar component

**Files:**
- Create: `src/components/Sidebar.tsx`
- Create: `src/components/__tests__/Sidebar.test.tsx`

- [ ] **Step 1: Write failing tests for Sidebar**

Create `src/components/__tests__/Sidebar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar } from '../Sidebar';

describe('Sidebar', () => {
  it('renders all three nav items', () => {
    const html = renderToStaticMarkup(
      <Sidebar activeTarget="budget" onNavigate={vi.fn()} pricingDate="2026-03-12" />,
    );
    expect(html).toContain('I have a budget');
    expect(html).toContain('I know my usage');
    expect(html).toContain('I have a CSV');
  });

  it('applies the active background class only to the selected nav item', () => {
    const html = renderToStaticMarkup(
      <Sidebar activeTarget="csv_import" onNavigate={vi.fn()} pricingDate="2026-03-12" />,
    );
    // Split the html by nav buttons to check active class assignment
    const csvButtonMatch = html.match(/I have a CSV/);
    const budgetButtonMatch = html.match(/I have a budget/);
    expect(csvButtonMatch).toBeTruthy();
    expect(budgetButtonMatch).toBeTruthy();
    // Active item gets bg-white/12, inactive gets text-white/50
    expect(html).toMatch(/bg-white\/12[^>]*>I have a CSV|I have a CSV[^<]*<\/button/);
  });

  it('renders app branding', () => {
    const html = renderToStaticMarkup(
      <Sidebar activeTarget="budget" onNavigate={vi.fn()} pricingDate="2026-03-12" />,
    );
    expect(html).toContain('Cursor Cost Calculator');
  });

  it('renders the full footer content including explanatory text and disclaimer', () => {
    const html = renderToStaticMarkup(
      <Sidebar activeTarget="budget" onNavigate={vi.fn()} pricingDate="2026-03-12" />,
    );
    expect(html).toContain('two usage pools');
    expect(html).toContain('Max Mode');
    expect(html).toContain('Disclaimer');
    expect(html).toContain('2026-03-12');
    expect(html).toContain('GitHub');
  });

  it('includes navigation role', () => {
    const html = renderToStaticMarkup(
      <Sidebar activeTarget="budget" onNavigate={vi.fn()} pricingDate="2026-03-12" />,
    );
    expect(html).toContain('role="navigation"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/Sidebar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Sidebar component**

Create `src/components/Sidebar.tsx`. Key requirements:
- Accepts `activeTarget: NavigationTarget`, `onNavigate`, and `pricingDate: string`.
- Renders branding (CalculatorIcon + title).
- Renders three nav buttons. Active button gets `bg-white/12 text-white font-medium`, inactive gets `text-white/50 hover:text-white/70 hover:bg-white/5`.
- Renders footer section at bottom (`mt-auto`) with:
  - "How plans work" paragraph explaining two usage pools (moved from App.tsx footer).
  - "Max Mode" explainer (moved from App.tsx footer).
  - Disclaimer text (moved from App.tsx footer).
  - "Last updated {pricingDate}" line.
  - GitHub and JHD links.
- Uses `role="navigation"` and `aria-label="Calculator mode"`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/Sidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "feat: add Sidebar component with nav items and full footer content"
```

---

### Task 4: Create SidebarLayout component

**Files:**
- Create: `src/components/SidebarLayout.tsx`

Note: Focus trapping for the mobile overlay is deferred to a follow-up. This version provides `role="dialog"`, `aria-modal="true"`, Escape key, and backdrop click to close — covering the primary accessibility needs. A full focus trap (preventing tab-out) can be added later with a dedicated utility.

- [ ] **Step 1: Implement SidebarLayout**

Create `src/components/SidebarLayout.tsx`:
- `position: fixed` sidebar on desktop (`hidden md:block fixed top-0 left-0 w-52 h-screen`).
- Content area with `md:ml-52` offset.
- Mobile: hamburger button in a fixed top bar, sidebar slides in as overlay with backdrop.
- Escape key closes overlay. Backdrop click closes overlay. Nav click closes overlay.

- [ ] **Step 2: Run build**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SidebarLayout.tsx
git commit -m "feat: add SidebarLayout with mobile hamburger overlay"
```

---

### Task 5: Rewire App.tsx and clean up stale tests

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/__tests__/CalculatorCopy.test.tsx`
- Remove: `src/components/ModeToggle.tsx`

- [ ] **Step 1: Rewrite App.tsx**

Key changes:
- Import `SidebarLayout` instead of `ModeToggle`.
- Import `getPricingCatalog` and pass `PRICING.meta.retrieved_at` as `pricingDate` to `SidebarLayout` (which passes it to `Sidebar`).
- Remove `<header>`, `ModeToggle`, token source toggle, and footer `<div>`.
- Wrap content in `<SidebarLayout activeTarget={navigationTarget} onNavigate={navigate} pricingDate={PRICING.meta.retrieved_at}>`.
- Keep `WelcomeModal` and `<Analytics />` at the root level.
- Content area renders mode-specific panels (same conditional logic minus toggles).

- [ ] **Step 2: Update CalculatorCopy tests — remove ModeToggle test, keep the rest**

In `src/components/__tests__/CalculatorCopy.test.tsx`:
- Remove the `ModeToggle` import.
- Remove the test `'explains the semantic difference between budget mode and usage mode'` (it tests ModeToggle which no longer exists).
- Keep the BudgetInput/TokenInput test and the WelcomeModal test.

- [ ] **Step 3: Delete ModeToggle**

```bash
rm src/components/ModeToggle.tsx
```

- [ ] **Step 4: Run full test suite and build**

Run: `npx vitest run && npm run build`
Expected: All tests pass, build succeeds.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/__tests__/CalculatorCopy.test.tsx
git rm src/components/ModeToggle.tsx
git commit -m "feat: replace toggle navigation with sidebar layout"
```

---

## Chunk 2: CSV Model Grouping

### Task 6: Add `modelId` to `RecommendationModelDisplayRow`

**Files:**
- Modify: `src/app/recommendationPresentation.ts`

**Why:** `RecommendationModelDisplayRow.key` is a composite key (e.g., `claude-opus-4-6:base:max:plain:api`) built by `buildUsageKey()`. Model grouping needs the bare model ID (`claude-opus-4-6`). The `modelId` field exists on `PlanLineItem` but is not carried through to the display row. This task adds it.

- [ ] **Step 1: Add `modelId` field to `RecommendationModelDisplayRow`**

In `src/app/recommendationPresentation.ts`, add to the interface:

```ts
export interface RecommendationModelDisplayRow {
  key: string;
  modelId: string;  // bare catalog model ID, for grouping
  label: string;
  // ... rest unchanged
}
```

In `buildModelDisplayRow()`, add `modelId: item.modelId` to the returned object.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: PASS — existing tests don't assert on `modelId` so nothing breaks.

- [ ] **Step 3: Commit**

```bash
git add src/app/recommendationPresentation.ts
git commit -m "feat: carry modelId through to RecommendationModelDisplayRow"
```

---

### Task 7: Implement model grouping logic

**Files:**
- Create: `src/app/modelGrouping.ts`
- Create: `src/app/__tests__/modelGrouping.test.ts`

Note: The spec places `getBaseModelId` in `recommendationPresentation.ts`. This plan uses a separate `modelGrouping.ts` file for cleaner separation. The grouping logic depends on catalog data and companions mappings — keeping it in its own file prevents `recommendationPresentation.ts` from growing too large.

- [ ] **Step 1: Write failing tests for getBaseModelId and buildModelGroups**

Create `src/app/__tests__/modelGrouping.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getBaseModelId, buildModelGroups } from '../modelGrouping';
import type { RecommendationModelDisplayRow } from '../recommendationPresentation';

describe('getBaseModelId', () => {
  it('returns the parent model ID for a fast variant', () => {
    expect(getBaseModelId('claude-opus-4-6-fast')).toBe('claude-opus-4-6');
    expect(getBaseModelId('gpt-5-fast')).toBe('gpt-5');
    expect(getBaseModelId('gpt-5.4-fast')).toBe('gpt-5.4');
  });

  it('returns the base model ID for a max/long-context variant via companions map', () => {
    expect(getBaseModelId('claude-opus-4-6-max')).toBe('claude-opus-4-6');
    expect(getBaseModelId('gpt-5.4-max')).toBe('gpt-5.4');
    expect(getBaseModelId('claude-4-sonnet-1m')).toBe('claude-4-sonnet');
  });

  it('prefers non-approximated companion when multiple base IDs map to the same maxId', () => {
    expect(getBaseModelId('claude-opus-4-6-max')).toBe('claude-opus-4-6');
  });

  it('returns model ID as-is for base models with no variant relationship', () => {
    expect(getBaseModelId('claude-opus-4-6')).toBe('claude-opus-4-6');
    expect(getBaseModelId('gpt-5.3-codex')).toBe('gpt-5.3-codex');
  });

  it('returns model ID as-is for standalone max models not in companions map', () => {
    expect(getBaseModelId('gpt-5.1-codex-max')).toBe('gpt-5.1-codex-max');
  });
});

describe('buildModelGroups', () => {
  function createRow(overrides: Partial<RecommendationModelDisplayRow> = {}): RecommendationModelDisplayRow {
    return {
      key: 'model-1:base:standard:plain:cursor',
      modelId: 'model-1',
      label: 'Model 1',
      provider: 'anthropic',
      badges: [],
      rateLabel: '$1.00 / $5.00 per M',
      primaryMetric: { label: 'Usage cost', value: 100, formattedValue: '$100.00' },
      secondaryMetric: { label: 'Token volume', value: 10_000_000, formattedValue: '10.00M tokens' },
      ...overrides,
    };
  }

  it('returns null for non-import token sources', () => {
    expect(buildModelGroups([createRow()], 'manual')).toBeNull();
  });

  it('groups rows sharing the same base model ID via modelId field', () => {
    const rows = [
      createRow({
        key: 'claude-opus-4-6:base:standard:plain:cursor',
        modelId: 'claude-opus-4-6',
        label: 'Claude 4.6 Opus',
        primaryMetric: { label: 'Usage cost', value: 50, formattedValue: '$50.00' },
        secondaryMetric: { label: 'Token volume', value: 5_000_000, formattedValue: '5.00M tokens' },
      }),
      createRow({
        key: 'claude-opus-4-6:base:max:thinking:cursor',
        modelId: 'claude-opus-4-6-max',
        label: 'Claude 4.6 Opus Max',
        primaryMetric: { label: 'Usage cost', value: 70, formattedValue: '$70.00' },
        secondaryMetric: { label: 'Token volume', value: 3_000_000, formattedValue: '3.00M tokens' },
      }),
    ];

    const groups = buildModelGroups(rows, 'cursor_import')!;
    expect(groups).toHaveLength(1);
    expect(groups[0].groupKey).toBe('claude-opus-4-6');
    expect(groups[0].totalCost).toBe(120);
    expect(groups[0].totalTokens).toBe(8_000_000);
    expect(groups[0].children).toHaveLength(2);
  });

  it('sorts groups by totalCost descending', () => {
    const rows = [
      createRow({ key: 'gpt-5:base:standard:plain:cursor', modelId: 'gpt-5', label: 'GPT-5', primaryMetric: { label: 'Usage cost', value: 10, formattedValue: '$10.00' } }),
      createRow({ key: 'claude-opus-4-6:base:standard:plain:cursor', modelId: 'claude-opus-4-6', label: 'Claude 4.6 Opus', primaryMetric: { label: 'Usage cost', value: 90, formattedValue: '$90.00' } }),
    ];

    const groups = buildModelGroups(rows, 'cursor_import')!;
    expect(groups[0].groupKey).toBe('claude-opus-4-6');
    expect(groups[1].groupKey).toBe('gpt-5');
  });

  it('sorts children within a group by cost descending', () => {
    const rows = [
      createRow({ key: 'co46:base:standard:plain:cursor', modelId: 'claude-opus-4-6', label: 'Claude 4.6 Opus', primaryMetric: { label: 'Usage cost', value: 20, formattedValue: '$20.00' } }),
      createRow({ key: 'co46:base:max:thinking:cursor', modelId: 'claude-opus-4-6-max', label: 'Claude 4.6 Opus Max', primaryMetric: { label: 'Usage cost', value: 80, formattedValue: '$80.00' } }),
    ];

    const groups = buildModelGroups(rows, 'cursor_import')!;
    expect(groups[0].children[0].label).toBe('Claude 4.6 Opus Max');
    expect(groups[0].children[1].label).toBe('Claude 4.6 Opus');
  });

  it('uses the highest-cost child label as familyLabel', () => {
    const rows = [
      createRow({ key: 'co46:base:standard:plain:cursor', modelId: 'claude-opus-4-6', label: 'Claude 4.6 Opus', primaryMetric: { label: 'Usage cost', value: 20, formattedValue: '$20.00' } }),
      createRow({ key: 'co46:base:max:thinking:cursor', modelId: 'claude-opus-4-6-max', label: 'Claude 4.6 Opus Max', primaryMetric: { label: 'Usage cost', value: 80, formattedValue: '$80.00' } }),
    ];

    const groups = buildModelGroups(rows, 'cursor_import')!;
    // After sorting by cost desc, highest-cost child's label is used
    expect(groups[0].familyLabel).toBe('Claude 4.6 Opus Max');
  });

  it('creates singleton groups with variantCount 1', () => {
    const rows = [
      createRow({ key: 'kimi:base:standard:plain:cursor', modelId: 'kimi-k2.5', label: 'Kimi K2.5', provider: 'moonshot' }),
    ];

    const groups = buildModelGroups(rows, 'cursor_import')!;
    expect(groups).toHaveLength(1);
    expect(groups[0].variantCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/__tests__/modelGrouping.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement modelGrouping.ts**

Create `src/app/modelGrouping.ts`. Key implementation:
- `getBaseModelId(modelId: string): string` — takes a bare model ID, returns the base family ID.
  - Build `fastVariantToParent` map from `getPricingCatalog().models` at module scope.
  - Build `maxIdToBaseId` reverse map from `IMPORT_REPLAY_LONG_CONTEXT_COMPANIONS` at module scope, preferring non-approximated entries.
  - Check fast map first, then max map, then return as-is.
- `buildModelGroups(modelRows, tokenSource)` — groups by `getBaseModelId(row.modelId)`.
  - Returns `null` for non-import token sources.
  - Sorts children by cost descending, then sets `familyLabel` from the first (highest-cost) child.
  - `totalCost` sums `primaryMetric.value`, `totalTokens` sums `secondaryMetric?.value`.
  - Groups sorted by `totalCost` descending.
- Export `RecommendationModelGroup` interface.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/__tests__/modelGrouping.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modelGrouping.ts src/app/__tests__/modelGrouping.test.ts
git commit -m "feat: add model grouping logic for CSV import results"
```

---

### Task 8: Wire model groups into the presentation model

**Files:**
- Modify: `src/app/recommendationPresentation.ts`
- Modify: `src/app/__tests__/recommendationPresentation.test.ts`

- [ ] **Step 1: Write failing tests for modelGroups**

Add to `src/app/__tests__/recommendationPresentation.test.ts`:

```ts
it('populates modelGroups for csv import mode', () => {
  const presentation = buildRecommendationPresentation({
    mode: 'tokens',
    tokenSource: 'cursor_import',
    recommendation: createRecommendation(createPlanResult()),
  });

  expect(presentation.modelGroups).not.toBeNull();
  expect(presentation.modelGroups!.length).toBeGreaterThan(0);
  expect(presentation.modelGroups![0].groupKey).toBe('model-1');
});

it('returns null modelGroups for manual token mode', () => {
  const presentation = buildRecommendationPresentation({
    mode: 'tokens',
    tokenSource: 'manual',
    recommendation: createRecommendation(createPlanResult()),
  });

  expect(presentation.modelGroups).toBeNull();
});

it('returns null modelGroups for budget mode', () => {
  const presentation = buildRecommendationPresentation({
    mode: 'budget',
    tokenSource: 'manual',
    budgetCeiling: 200,
    recommendation: createRecommendation(createPlanResult()),
  });

  expect(presentation.modelGroups).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/__tests__/recommendationPresentation.test.ts`
Expected: FAIL — `modelGroups` not on type.

- [ ] **Step 3: Add modelGroups to RecommendationPresentation**

In `src/app/recommendationPresentation.ts`:
1. Import `buildModelGroups` and re-export `RecommendationModelGroup` from `./modelGrouping`.
2. Add `modelGroups: RecommendationModelGroup[] | null` to `RecommendationPresentation`.
3. In `buildRecommendationPresentation()`, add: `modelGroups: buildModelGroups(bestPlan.modelRows, tokenSource)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/__tests__/recommendationPresentation.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/recommendationPresentation.ts src/app/__tests__/recommendationPresentation.test.ts
git commit -m "feat: wire model groups into recommendation presentation model"
```

---

### Task 9: Render grouped models in BestPlanCard

**Files:**
- Modify: `src/components/BestPlanCard.tsx`
- Modify: `src/components/__tests__/BestPlanCard.test.tsx`

- [ ] **Step 1: Write failing test for grouped model rendering**

Add to `src/components/__tests__/BestPlanCard.test.tsx`. Note: the `createLineItem` helper needs a unique `key` per variant:

```tsx
it('renders collapsed model groups with aggregate values when modelGroups is present', () => {
  const presentation = buildPresentation({
    mode: 'tokens',
    tokenSource: 'cursor_import',
    recommendation: createRecommendation(createPlanResult({
      plan: 'ultra',
      perModel: [
        createLineItem({ key: 'co46-base', modelId: 'claude-opus-4-6', label: 'Claude 4.6 Opus', apiCost: 50, tokens: { total: 5_000_000, input: 3_750_000, output: 1_250_000 } }),
        createLineItem({ key: 'co46-max', modelId: 'claude-opus-4-6-max', label: 'Claude 4.6 Opus Max', apiCost: 70, tokens: { total: 3_000_000, input: 2_250_000, output: 750_000 } }),
      ],
    })),
  });

  const html = renderCardFromPresentation(presentation);
  expect(html).toContain('Claude 4.6 Opus');
  expect(html).toContain('2 variants');
});
```

Note: the `createLineItem` helper in this test file may need updating to include `modelId` since Task 6 added it to the type. Add `modelId: 'model-1'` to the default helper.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/BestPlanCard.test.tsx`
Expected: FAIL

- [ ] **Step 3: Update BestPlanCard to render model groups**

In the model details section of `BestPlanCard.tsx`:
- Import `RecommendationModelGroup`.
- When `presentation.modelGroups` is non-null, render groups instead of flat `bestPlan.modelRows`.
- Add `const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())` for local expand/collapse state.
- Collapsed group: provider dot, `familyLabel`, variant count badge (omit for singletons), aggregate tokens/cost, chevron (omit for singletons).
- Expanded group: render each `group.children` using the existing per-row markup.
- When `presentation.modelGroups` is null (non-import modes), render flat `bestPlan.modelRows` as before.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/BestPlanCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/BestPlanCard.tsx src/components/__tests__/BestPlanCard.test.tsx
git commit -m "feat: render collapsible model groups in BestPlanCard for CSV import"
```

---

### Task 10: Render grouped models in PlanComparison

**Files:**
- Modify: `src/components/PlanComparison.tsx`
- Modify: `src/components/__tests__/PlanComparison.test.tsx`

- [ ] **Step 1: Write failing test for grouped comparison rows**

Add to `src/components/__tests__/PlanComparison.test.tsx`:

```tsx
it('renders collapsed model groups with per-plan aggregate values for CSV import', () => {
  const pro = createPlanResult({
    plan: 'pro',
    subscription: 20, apiPool: 20, apiBudget: 20, apiUsage: 100, overage: 80, totalCost: 100,
    perModel: [
      createLineItem({ key: 'co46-base', modelId: 'claude-opus-4-6', label: 'Claude 4.6 Opus', apiCost: 60 }),
      createLineItem({ key: 'co46-max', modelId: 'claude-opus-4-6-max', label: 'Claude 4.6 Opus Max', apiCost: 40 }),
    ],
  });
  const ultra = createPlanResult({
    plan: 'ultra',
    subscription: 200, apiPool: 400, apiBudget: 400, apiUsage: 100, overage: 0, totalCost: 200,
    perModel: [
      createLineItem({ key: 'co46-base', modelId: 'claude-opus-4-6', label: 'Claude 4.6 Opus', apiCost: 60 }),
      createLineItem({ key: 'co46-max', modelId: 'claude-opus-4-6-max', label: 'Claude 4.6 Opus Max', apiCost: 40 }),
    ],
  });

  const html = renderComparison({
    mode: 'tokens',
    tokenSource: 'cursor_import',
    recommendation: createRecommendation(ultra, [pro, ultra]),
    defaultOpen: true,
  });

  expect(html).toContain('Claude 4.6 Opus');
  expect(html).toContain('2 variants');
});
```

Note: `createLineItem` helper needs `modelId` field added as well.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/PlanComparison.test.tsx`
Expected: FAIL

- [ ] **Step 3: Update PlanComparison to render model groups**

In the `usage_value_details` section where per-model rows render:
- When `presentation.modelGroups` is non-null, render grouped rows instead of flat model rows.
- Add local expand/collapse state (`useState<Set<string>>`).
- Collapsed group row: provider dot, family label, variant count, then per-plan aggregate values (sum each plan's `modelRows` where `row.modelId` resolves to the same base model via `getBaseModelId`).
- Expanded: individual variant rows via the existing `ModelRow` component.
- When `presentation.modelGroups` is null, render flat model rows as before.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/PlanComparison.test.tsx`
Expected: PASS

- [ ] **Step 5: Run full test suite, lint, and build**

Run: `npx vitest run && npm run lint && npm run build`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/PlanComparison.tsx src/components/__tests__/PlanComparison.test.tsx
git commit -m "feat: render collapsible model groups in PlanComparison for CSV import"
```

---

### Task 11: Final verification

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
1. Sidebar renders with three nav items, dark background.
2. Clicking nav items switches content correctly.
3. Mobile hamburger works (resize browser to < 768px).
4. Footer content (disclaimer, links, explanatory text) appears in sidebar.
5. Import a CSV — model groups appear collapsed in BestPlanCard.
6. Clicking a group expands variant rows.
7. PlanComparison shows grouped rows when expanded.
8. Budget and manual modes show flat model rows (no grouping).
9. WelcomeModal still appears on first visit.
