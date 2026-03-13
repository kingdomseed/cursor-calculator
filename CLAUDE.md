# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

This is an **empirical budgeting tool** for Cursor IDE pricing. "Empirical" means every number shown must trace back to Cursor's official docs (https://cursor.com/docs/models-and-pricing and individual model pages). Do not invent or assume pricing rules — if you can't source it from the docs, flag it as unverified. When Cursor updates pricing, the JSON and calculations must be updated to match.

The tool answers three related questions:
1. **"I have a budget"** → Which plan is best, and how many tokens do I get per model?
2. **"I know my token usage"** → What will it cost me, and which plan covers it?
3. **"I have a Cursor usage export"** → Reprice the exact imported token columns and show which plan would have covered that month.

Manual mode and CSV replay do **not** use the same source catalog:
- `src/data/cursor-pricing.json` is the source of truth for current Cursor-supported manual calculations.
- `src/data/providerImportModels.ts` exists only for CSV replay of retired historical labels that no longer have a current Cursor catalog entry. Those rows must stay visibly approximate and must not leak into the manual selector as if they were current Cursor-native models.

## Commands

- **Dev server:** `npm run dev` (Vite, hot reload)
- **Build:** `npm run build` (runs `tsc -b && vite build`, output in `dist/`)
- **Lint:** `npm run lint` (ESLint with TypeScript + React hooks/refresh rules)
- **Preview prod build:** `npm run preview`
- **Tests:** `npm test` (Vitest run), `npm run test:watch` (watch mode)

## Architecture

Single-page React + TypeScript app deployed to Vercel.

**Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 (via PostCSS plugin `@tailwindcss/postcss`).

### Key structure

- `src/App.tsx` — Top-level state and composition. Wires budget mode, manual token mode, and Cursor CSV replay mode together.
- `src/components/*` — Presentational calculator UI, including `CursorImportPanel.tsx` for the import flow.
- `src/data/cursor-pricing.json` — Current Cursor pricing data (plans, model rates, settings). This is the empirical source of truth for manual mode.
- `src/data/providerImportModels.ts` — Import-only provider-backed rates used to replay retired labels from historical CSV exports. These are estimates, not current Cursor-native catalog entries.
- `src/lib/calculations.ts` — Shared pricing math for budget mode, manual token mode, and exact imported-usage plan recommendations.
- `src/lib/cursorUsage.ts` — CSV parsing, row filtering, model-label normalization, exact token pricing, imported-month summaries, and approximation reporting.
- `src/lib/types.ts` — Shared domain types.
- `src/lib/__tests__/calculations.test.ts` and `src/lib/__tests__/cursorUsage.test.ts` — Vitest coverage for pricing math and import replay logic.
- `data/private/raw/cursor/` — Optional local-only fixture location for copied Cursor monthly exports. `data/private/` is gitignored.

There is no routing or external state management library. `App.tsx` is now orchestration, not the single source of business logic.

### Core calculation logic

- `computeRecommendation()` — Shared recommendation entry point for budget mode and manual token mode.
- `computeExactUsageRecommendation()` — Reuses the same plan-pool comparison logic for imported exact-usage rows.
- `computeBillableRates()` / `computeEffectiveRates()` — Apply Cursor Max upcharge, fast variants, and caching math.
- `parseCursorUsageFiles()` — Parses exported Cursor CSVs, filters billable rows, normalizes labels, computes exact replay costs, and produces monthly summary data.
- Caching still assumes a hardcoded 3x re-read pattern (`DEFAULT_RE_READS = 3`) for iterative coding workflows.

### Testing reality

- Vitest is configured and active.
- Current automated coverage is library-level and runs in the Node environment configured in `vite.config.ts`.
- There is not yet a committed jsdom/browser integration suite for the import UI path, so browser verification still matters for file-upload behavior.

### Styling

Tailwind utility classes inline (no component library). Design palette uses `#14120b` (near-black), `#f7f7f4` (off-white background), and `#e0e0d8` (borders). Provider colors are mapped in `PROVIDER_COLORS`.

## Cursor Pricing Domain Model (source of truth)

All facts below sourced from https://cursor.com/docs/models-and-pricing and individual model pages. Last verified 2026-03-12.

### Empirical boundary

- Manual calculator mode should only expose models and rates that exist in `src/data/cursor-pricing.json`.
- CSV replay may use import-only provider-backed estimates for retired labels that appear in historical exports, but those rows must remain clearly marked as approximate.
- Do not move provider-backed replay estimates into the main pricing JSON unless Cursor publishes a current first-party pricing entry for them.

### Two separate usage pools

- **Auto + Composer pool**: Used by Auto and Composer 1.5 on individual plans. "Generous included usage" on all plans — no disclosed dollar amount. On Teams/Enterprise, Composer 1.5 charges at API rates instead.
- **API pool**: Charged at each model's API rate. Plan amounts:
  - Includes API-priced models such as Composer 1
  - Pro $20/mo → $20 API pool
  - Pro Plus $60/mo → $70 API pool
  - Ultra $200/mo → $400 API pool
- Overage beyond the pool is at the same API rates, billed monthly.

### Max Mode (extended context)

Max Mode extends context to a model's maximum (e.g. 200k → 1M for Claude). Two cost layers stack:
1. **Cursor upcharge**: +20% on individual plans
2. **Provider long context rates** (when input exceeds default context window):
   - Claude models: 2x standard rate when input >200k
   - GPT-5.4: input 2x, output 1.5x when input >272k

These are cumulative — Max Mode with long context can mean 2.4x input cost, not just +20%.

### Fast mode

Fast mode is a **separate model variant**, not a toggle on the base model:
- Claude 4.6 Opus Fast: 6x standard Opus pricing ($30/$37.5/$3/$150)
- GPT-5.4 Fast: 2x standard, runs 15% faster
- Historical imported fast labels that Cursor no longer documents may still be replayed in CSV import mode as best-effort estimates. That approximation logic belongs in the import layer, not the empirical base catalog.

### Thinking mode

Available as a variant for Claude models and GPT-5.4. Docs do not specify separate token rates for thinking tokens.

### Model context windows

Each model has a default context window and a Max context:
- Claude 4.6 Opus/Sonnet: 200k default, 1M max
- GPT-5.4: 272k default, 1M max
- Composer 1.5: 200k default, no Max Mode
