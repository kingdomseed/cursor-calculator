# Clean Architecture and SSOT Refactor Design

## Goal

Refactor the calculator so each core concern has one durable source of truth and one clear runtime path:

- current Cursor pricing catalog
- historical import replay catalog and label mappings
- recommendation/cost math
- CSV replay parsing and aggregation
- app session state and derived UI state

The result should be a codebase that is simpler to reason about, easier to test, and free of architectural cleanup backlog.

## Zero-Debt Policy

This refactor follows a strict zero-tech-debt policy.

That means:

- no mergeable temporary shims
- no duplicate truth sources surviving a slice
- no “cleanup later” milestones for replaced code paths
- no compatibility layers unless they are part of the intended final architecture

A slice is only complete when the new path is the only live path for that concern and the replaced path is removed or intentionally retained as the final public API.

## Current Problems

### Split truth

Current pricing and replay truth is spread across:

- `src/data/cursor-pricing.json`
- `src/data/providerImportModels.ts`
- hardcoded alias and approximation tables inside `src/lib/cursorUsage.ts`

### Mixed responsibilities

Large modules currently blend multiple concerns:

- `src/App.tsx` mixes composition, orchestration, defaulting, and side effects
- `src/lib/calculations.ts` mixes math, recommendation assembly, and formatting
- `src/lib/cursorUsage.ts` mixes parsing, filtering, normalization, pricing, aggregation, and summary generation
- `src/lib/types.ts` mixes catalog, UI, replay, and result types

### Drift risk

`src/lib/__tests__/cursorUsage.test.ts` still relies heavily on a handcrafted model fixture, so production catalog drift can remain invisible.

## Design Goals

1. One source of truth per concern.
2. Pure domain logic where possible.
3. Explicit app-layer orchestration.
4. Small, complete, mergeable refactor slices.
5. Production-catalog-backed tests for truth boundaries.
6. Preserve current working behavior:
   - stacked Fast + Max semantics
   - cache-hit clamping
   - current single-file CSV replacement flow

## Final Module Boundaries

```text
src/
  app/
    calculatorReducer.ts
    calculatorSelectors.ts
    calculatorState.ts
    useCalculatorController.ts
  data/
    cursor-pricing.json
    importReplayHistoricalModels.ts
    importReplayLabelMappings.ts
  domain/
    catalog/
      currentCatalog.ts
      selectors.ts
      types.ts
    modelConfig/
      capabilities.ts
      defaults.ts
      weights.ts
    recommendation/
      conversions.ts
      formatters.ts
      rates.ts
      recommendation.ts
      types.ts
    importReplay/
      aggregate.ts
      catalog.ts
      csvParser.ts
      filters.ts
      normalization.ts
      pricing.ts
      summary.ts
      types.ts
  components/
    ...
```

`presentation/` is intentionally not required. If small view helpers fit naturally in app selectors or colocated helper modules, keep them there.

## SSOT Ownership

| Concern | Final home |
|--------|------------|
| Current Cursor plans and current manual-model rates | `src/data/cursor-pricing.json` |
| Typed current catalog access | `src/domain/catalog/currentCatalog.ts` |
| Historical import-only provider rates | `src/data/importReplayHistoricalModels.ts` |
| Historical label mappings and approximation policy tables | `src/data/importReplayLabelMappings.ts` |
| Import replay catalog assembly | `src/domain/importReplay/catalog.ts` |
| Model defaults, weights, and capability rules | `src/domain/modelConfig/*` |
| Pricing and recommendation math | `src/domain/recommendation/*` |
| CSV replay pipeline | `src/domain/importReplay/*` |
| App session state and transitions | `src/app/*` |

## Runtime Dataflow

### Manual budget/token flow

```text
UI inputs
  -> app controller/reducer state
  -> app selectors
  -> current catalog accessors
  -> model config helpers
  -> recommendation domain
  -> derived plan results
  -> components
```

### CSV replay flow

```text
file input
  -> app controller side effect
  -> import replay CSV parser
  -> row filters/exclusion policy
  -> label normalization against replay catalog
  -> exact imported row pricing
  -> aggregate usage entries + monthly summary
  -> recommendation domain
  -> derived plan results
  -> components
```

## Slice Definition

A valid refactor slice must:

1. Introduce the new final module(s) for one concern.
2. Move all callers for that concern.
3. Delete the replaced implementation or truth path.
4. Update tests to target the final architecture.
5. Pass `npm test`, `npm run lint`, and `npm run build`.

## Non-Goals

- New pricing research
- Server-side processing
- Teams/Enterprise pricing support
- Visual redesign
- Broad framework churn unrelated to truth boundaries or dataflow

## Success Criteria

The refactor is complete when:

- there is one live truth source for current pricing
- there is one live truth source for replay mappings
- `App.tsx` is a thin composition/controller entry point
- recommendation math has one domain home
- replay parsing/pricing/summary responsibilities are split cleanly
- no temporary migration layers remain
- docs reflect the final architecture
