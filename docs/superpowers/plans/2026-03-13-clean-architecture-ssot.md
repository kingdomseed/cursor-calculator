# Clean Architecture and SSOT Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans. Each slice must end in a zero-debt resting state before it is committed.

**Goal:** Refactor the calculator so pricing truth, replay truth, recommendation math, replay processing, and app orchestration each have a single durable home with no architectural cleanup left behind.

**Architecture:** Use explicit data modules for raw pricing and replay mappings, pure domain modules for business logic, and a dedicated app-layer orchestration boundary for UI state and side effects. Do not merge partial migrations.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-13-clean-architecture-ssot-design.md`

---

## Execution Rules

- A slice is only done when the old path is removed.
- No temporary facades unless they are part of the final intended API.
- No duplicate truth sources survive a slice.
- No “cleanup later” markers for replaced code.
- Every slice must pass:
  - `npm test`
  - `npm run lint`
  - `npm run build`

## Slice 1: Current Catalog SSOT

**Goal:** Make current manual pricing and model access flow through one typed catalog layer.

**Files:**
- Create: `src/domain/catalog/types.ts`
- Create: `src/domain/catalog/currentCatalog.ts`
- Create: `src/domain/catalog/selectors.ts`
- Create: `src/domain/catalog/__tests__/catalog.contract.test.ts`
- Modify: `src/App.tsx`
- Modify: current callers of raw pricing JSON
- Modify: `src/lib/types.ts` only if it remains part of the intended final architecture

**Tasks:**
- [ ] Create typed catalog accessors for plans and current models.
- [ ] Add contract tests proving manual selector models come only from the current API pool.
- [ ] Move all current catalog reads to the new access layer.
- [ ] Remove direct raw catalog assembly from `App.tsx`.

**Acceptance criteria:**
- The current catalog has one typed access path.
- Manual mode no longer reads raw pricing data directly in feature code.
- No import-only replay models can appear in manual selection.

**Verification:**
```bash
npm test -- src/domain/catalog/__tests__/catalog.contract.test.ts src/lib/__tests__/calculations.test.ts src/lib/__tests__/cursorUsage.test.ts
npm run lint
npm run build
```

**Commit:**
```bash
git add src/domain/catalog src/App.tsx src/lib/types.ts
git commit -m "refactor: centralize current catalog access"
```

## Slice 2: Import Replay SSOT

**Goal:** Give historical replay models and replay label mappings one durable home.

**Files:**
- Create: `src/data/importReplayHistoricalModels.ts`
- Create: `src/data/importReplayLabelMappings.ts`
- Create: `src/domain/importReplay/catalog.ts`
- Create: `src/domain/importReplay/__tests__/importReplay.contract.test.ts`
- Modify: `src/lib/__tests__/cursorUsage.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/lib/cursorUsage.ts`
- Remove or replace: `src/data/providerImportModels.ts`

**Tasks:**
- [ ] Move historical replay-only models out of `providerImportModels.ts` into the final data home.
- [ ] Move exact aliases, approximate aliases, long-context companions, and approximation policy tables out of `cursorUsage.ts`.
- [ ] Add replay-catalog contract tests proving every mapping resolves to a valid replay target.
- [ ] Move `App.tsx` and replay logic to the replay catalog assembler.
- [ ] Remove displaced mapping truth from `cursorUsage.ts`.

**Acceptance criteria:**
- Replay model truth and replay mapping truth each live in one named final module.
- `App.tsx` no longer concatenates replay model lists inline.
- `cursorUsage.ts` no longer owns hidden catalog tables.

**Verification:**
```bash
npm test -- src/domain/importReplay/__tests__/importReplay.contract.test.ts src/lib/__tests__/cursorUsage.test.ts
npm run lint
npm run build
```

**Commit:**
```bash
git add src/data/importReplayHistoricalModels.ts src/data/importReplayLabelMappings.ts src/domain/importReplay/catalog.ts src/lib/cursorUsage.ts src/lib/__tests__/cursorUsage.test.ts src/App.tsx
git commit -m "refactor: centralize import replay catalog truth"
```

## Slice 3: Recommendation Domain

**Goal:** Put all pricing and recommendation math in one domain home.

**Files:**
- Create: `src/domain/recommendation/types.ts`
- Create: `src/domain/recommendation/rates.ts`
- Create: `src/domain/recommendation/conversions.ts`
- Create: `src/domain/recommendation/recommendation.ts`
- Create: `src/domain/recommendation/formatters.ts`
- Create: `src/domain/recommendation/__tests__/recommendation.test.ts`
- Modify: `src/components/BestPlanCard.tsx`
- Modify: `src/components/PlanComparison.tsx`
- Modify: `src/components/ModelConfigRow.tsx`
- Remove or intentionally retain: `src/lib/calculations.ts`

**Tasks:**
- [ ] Move rate-layer logic, including stacked Fast + Max semantics, to the final domain module.
- [ ] Move conversion helpers and exact-token pricing into the same domain.
- [ ] Move recommendation assembly and plan comparison logic there as well.
- [ ] Keep cache-hit clamping behavior intact.
- [ ] Update callers to the final domain entrypoints.
- [ ] Remove duplicate math implementation from the old location.

**Acceptance criteria:**
- Recommendation math has one implementation home.
- There is no temporary duplicate `calculations` path.
- UI components consume the final math entrypoints.

**Verification:**
```bash
npm test -- src/domain/recommendation/__tests__/recommendation.test.ts src/lib/__tests__/calculations.test.ts src/lib/__tests__/cursorUsage.test.ts
npm run lint
npm run build
```

**Commit:**
```bash
git add src/domain/recommendation src/components/BestPlanCard.tsx src/components/PlanComparison.tsx src/components/ModelConfigRow.tsx src/lib/calculations.ts
git commit -m "refactor: move pricing and recommendation math into domain modules"
```

## Slice 4: Replay Pipeline

**Goal:** Split CSV replay into coherent pipeline stages with no giant mixed module left behind.

**Files:**
- Create: `src/domain/importReplay/types.ts`
- Create: `src/domain/importReplay/csvParser.ts`
- Create: `src/domain/importReplay/filters.ts`
- Create: `src/domain/importReplay/normalization.ts`
- Create: `src/domain/importReplay/pricing.ts`
- Create: `src/domain/importReplay/aggregate.ts`
- Create: `src/domain/importReplay/summary.ts`
- Create: `src/domain/importReplay/__tests__/importReplay.pipeline.test.ts`
- Remove or intentionally retain: `src/lib/cursorUsage.ts`

**Tasks:**
- [ ] Move CSV parsing out first.
- [ ] Move exclusion/filter policy.
- [ ] Move normalization and label-resolution logic.
- [ ] Move exact-row pricing and long-context companion behavior.
- [ ] Move aggregation and summary generation.
- [ ] Update callers and tests to the final pipeline entrypoints.
- [ ] Remove the old mixed implementation.

**Acceptance criteria:**
- Parsing, normalization, pricing, aggregation, and summary each have a clear final home.
- There is no mixed replay implementation left behind.
- Replay tests use production catalog access plus minimal inline CSV fixtures.

**Verification:**
```bash
npm test -- src/domain/importReplay/__tests__/importReplay.pipeline.test.ts src/lib/__tests__/cursorUsage.test.ts
npm run lint
npm run build
```

**Commit:**
```bash
git add src/domain/importReplay src/lib/cursorUsage.ts src/lib/__tests__/cursorUsage.test.ts
git commit -m "refactor: split import replay into final pipeline modules"
```

## Slice 5: Model Config Rules

**Goal:** Move default model selection, weight behavior, and capability rules out of `App.tsx`.

**Files:**
- Create: `src/domain/modelConfig/defaults.ts`
- Create: `src/domain/modelConfig/weights.ts`
- Create: `src/domain/modelConfig/capabilities.ts`
- Create: `src/domain/modelConfig/__tests__/modelConfig.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/ModelConfigRow.tsx`
- Modify: `src/components/ModelConfigList.tsx`

**Tasks:**
- [ ] Move default config generation.
- [ ] Move weight redistribution and normalization helpers.
- [ ] Move capability checks and badge derivation.
- [ ] Keep current independent Fast and Max toggles intact.
- [ ] Remove the old inline rules from `App.tsx`.

**Acceptance criteria:**
- Model config rules have one domain home.
- `App.tsx` no longer owns model defaulting or weight math.
- UI components render and dispatch, but do not infer policy.

**Verification:**
```bash
npm test -- src/domain/modelConfig/__tests__/modelConfig.test.ts src/lib/__tests__/calculations.test.ts
npm run lint
npm run build
```

**Commit:**
```bash
git add src/domain/modelConfig src/App.tsx src/components/ModelConfigRow.tsx src/components/ModelConfigList.tsx
git commit -m "refactor: centralize model config rules"
```

## Slice 6: App Orchestration Boundary

**Goal:** Reduce `App.tsx` to a thin composition/controller entry point.

**Files:**
- Create: `src/app/calculatorState.ts`
- Create: `src/app/calculatorReducer.ts`
- Create: `src/app/calculatorSelectors.ts`
- Create: `src/app/useCalculatorController.ts`
- Create: `src/app/__tests__/calculatorReducer.test.ts`
- Modify: `src/App.tsx`

**Tasks:**
- [ ] Define reducer-backed session state.
- [ ] Move transitions into reducer actions.
- [ ] Keep file-reading side effects in the controller hook.
- [ ] Move derived UI state into app selectors.
- [ ] Remove orchestration helpers and side-effect logic from `App.tsx`.

**Acceptance criteria:**
- `App.tsx` is mostly composition.
- State transitions and derived decisions are explicit and testable.
- Manual flow and CSV replay flow both pass through one app-layer boundary.

**Verification:**
```bash
npm test -- src/app/__tests__/calculatorReducer.test.ts src/lib/__tests__/calculations.test.ts src/lib/__tests__/cursorUsage.test.ts
npm run lint
npm run build
```

**Commit:**
```bash
git add src/app src/App.tsx
git commit -m "refactor: add explicit app orchestration layer"
```

## Slice 7: Final UI Boundary Cleanup and Docs

**Goal:** Clean up any remaining view-only helpers, confirm no debt remains, and document the final architecture.

**Files:**
- Modify: `src/components/CursorImportPanel.tsx`
- Modify: `src/components/ModelConfigRow.tsx`
- Modify: `src/components/ModelSelector.tsx`
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Optional create if still justified: `src/components/__tests__/CursorImportPanel.integration.test.tsx`

**Tasks:**
- [ ] Move remaining non-trivial presentation-only helpers if that improves clarity.
- [ ] Leave trivial JSX-local formatting alone if extraction would add noise.
- [ ] Decide whether one UI import integration test is still warranted after the domain/app split.
- [ ] Update docs to reflect final architecture and SSOT boundaries.
- [ ] Explicitly confirm no temporary migration artifacts remain.

**Acceptance criteria:**
- Docs match the final architecture.
- No deferred cleanup list remains.
- UI components depend on view-ready data and callbacks, not hidden domain assembly.

**Verification:**
```bash
npm test
npm run lint
npm run build
```

**Commit:**
```bash
git add src/components README.md CLAUDE.md
git commit -m "docs: finalize clean architecture and ssot layout"
```

## Readiness to Start Implementation

Implementation should begin only when:

- this plan is committed
- the branch is clean
- current `main` has been merged into the worktree branch
- the first slice is small enough to finish without carrying debt into the next slice

## Definition of Done

The refactor is complete when:

- there is one live truth path for current catalog access
- there is one live truth path for replay catalog access
- recommendation math has one domain home
- replay processing has one pipeline home
- `App.tsx` is a thin composition/controller file
- no temporary shims or duplicate implementations remain
- tests, lint, build, and docs all reflect the final structure
