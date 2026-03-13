# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Project Goal

This project is an **empirical budgeting tool** for Cursor IDE pricing. Every number shown in the app must trace back to Cursor's official docs at `https://cursor.com/docs/models-and-pricing` and the relevant individual model pages. Do not invent or assume pricing rules. If a pricing rule or model rate cannot be sourced from Cursor docs, mark it as unverified instead of presenting it as fact.

The app answers three questions:
1. **Budget mode** — “I have a budget.” Which plan is best, and how many tokens do I get per model?
2. **Token mode** — “I know my token usage.” What will it cost, and which plan covers it?
3. **CSV replay mode** — “I have a Cursor usage export.” Reprice the exact imported token columns and show which plan would have covered that month.

## Source-of-Truth Boundaries

Manual mode and CSV replay do **not** share the same source catalog:

- `src/data/cursor-pricing.json` is the source of truth for current Cursor-supported manual calculations.
- `src/data/importReplayHistoricalModels.ts` and `src/data/importReplayLabelMappings.ts` exist only for CSV replay of retired historical labels and mapping policy for labels that no longer have a current Cursor catalog entry.
- Import-only historical or provider-backed estimates must stay visibly approximate and must not leak into the manual model selector as though they were current Cursor-native entries.

When Cursor updates pricing, update the underlying data and the calculations together so the UI remains consistent with the docs.

## Commands

- `npm install` — install dependencies
- `npm run dev` — run the Vite dev server
- `npm run build` — type-check and build production assets into `dist/`
- `npm run lint` — run ESLint
- `npm run preview` — preview the production build
- `npm test` — run Vitest once
- `npm run test:watch` — run Vitest in watch mode

## Architecture

This is a single-page React + TypeScript app deployed to Vercel.

**Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 via `@tailwindcss/postcss`.

### Key structure

- `src/App.tsx` — composition root and page layout
- `src/app/calculatorState.ts` — reducer-owned source state and defaults
- `src/app/calculatorReducer.ts` — calculator state transitions
- `src/app/calculatorSelectors.ts` — derived app view data, replay reports, and recommendations
- `src/app/cursorImportActions.ts` — import action sequencing
- `src/app/cursorImportPresentation.ts` — UI-facing replay summary formatting
- `src/app/useCalculatorController.ts` — reducer wiring, file reading, and UI callbacks
- `src/components/` — presentational UI components, including import flow UI
- `src/data/cursor-pricing.json` — current Cursor pricing catalog for manual mode
- `src/data/importReplayHistoricalModels.ts` — import-only historical replay models
- `src/data/importReplayLabelMappings.ts` — import-only replay label mappings and approximations
- `src/domain/catalog/` — current Cursor catalog accessors and types
- `src/domain/recommendation/` — pricing math, effective rates, conversions, and recommendations
- `src/domain/importReplay/` — CSV parsing, normalization, pricing, aggregation, and summary logic
- `src/domain/modelConfig/` — model config defaults, selection reconciliation, and capability helpers
- `src/lib/types.ts` — shared type barrel for component imports
- `src/domain/*/__tests__/` and `src/app/__tests__/` — current automated coverage
- `data/private/raw/cursor/` — optional local-only copied Cursor export fixtures; `data/private/` is gitignored

There is no routing layer or external state-management library. Keep `src/App.tsx` composition-focused, app orchestration in `src/app/`, and domain logic in `src/domain/`.

### Core calculation logic

- `getPricingCatalog()`, `getManualApiModels()`, `getPlans()` — current manual catalog accessors
- `getImportReplayModels()` — replay catalog assembly from current and historical import-only models
- `computeRecommendation()` — shared recommendation entry point for budget mode and manual token mode
- `computeExactUsageRecommendation()` — plan comparison logic for imported exact-usage rows
- `computeBillableRates()` and `computeEffectiveRates()` — Max upcharge, fast variants, and caching math
- `parseCursorUsageFiles()` — CSV parsing, billable row filtering, normalization, replay pricing, and summaries
- `useCalculatorController()` — app orchestration for reducer state, selectors, and CSV-loading side effects

Caching currently assumes a hardcoded 3x re-read pattern via `DEFAULT_RE_READS = 3`.

## Pricing Domain Rules

All pricing facts should be verified against Cursor docs before changing the catalog or recommendation logic.

### Empirical boundary

- Manual calculator mode may only expose models and rates present in `src/data/cursor-pricing.json`.
- CSV replay may use import-only estimates for retired labels from historical exports, but those rows must remain clearly labeled as approximate.
- Do not move provider-backed replay estimates into the main pricing JSON unless Cursor publishes a current first-party pricing entry for them.

### Usage pools

- **Auto + Composer pool** — used by Auto and Composer 1.5 on individual plans. Cursor describes this as generous included usage, but does not disclose a dollar value.
- **API pool** — charged at each model's API rate:
  - Pro: `$20/mo` → `$20` API pool
  - Pro Plus: `$60/mo` → `$70` API pool
  - Ultra: `$200/mo` → `$400` API pool
- Overage beyond the API pool is billed at the same API rates.

### Max Mode

Max Mode extends context to the model maximum and stacks two cost layers:

1. Cursor upcharge: `+20%` on individual plans
2. Provider long-context multipliers when input exceeds the default context window

Current documented examples:

- Claude models: `2x` standard rate when input exceeds `200k`
- GPT-5.4: input `2x` and output `1.5x` when input exceeds `272k`

These effects are cumulative.

### Fast mode

Fast mode is a distinct model variant, not a toggle on the base model.

- Claude 4.6 Opus Fast: `6x` standard Opus pricing
- GPT-5.4 Fast: `2x` standard pricing

Historical imported fast labels may still be replayed as best-effort estimates, but that approximation logic belongs only in the import layer.

### Thinking mode

Thinking mode exists for Claude models and GPT-5.4, but Cursor docs do not currently publish separate token pricing for thinking tokens.

### Context windows

- Claude 4.6 Opus and Sonnet: `200k` default, `1M` max
- GPT-5.4: `272k` default, `1M` max
- Composer 1.5: `200k` default, no Max Mode

## Testing and Verification

- Prefer targeted tests for the area you changed before broader validation.
- Run `npm test` for logic changes and `npm run lint` for code quality when relevant.
- Use `npm run build` before finalizing significant app or type changes.
- Browser verification still matters for file-upload behavior because there is not yet a committed jsdom/browser integration suite for the import UI path.

## Styling and UI

- Use Tailwind utility classes inline; there is no component library.
- Keep the existing palette aligned with `#14120b`, `#f7f7f4`, and `#e0e0d8`.
- Reuse the established provider color mapping in `PROVIDER_COLORS`.

## Working Rules for Agents

- Keep changes minimal and aligned with the existing architecture.
- Fix root causes instead of layering on ad hoc patches.
- Do not add unsupported pricing assumptions or undocumented Cursor behavior.
- Treat imported historical replay behavior as approximate unless backed by current first-party Cursor docs.
- Preserve the distinction between current manual pricing data and historical replay-only data.
