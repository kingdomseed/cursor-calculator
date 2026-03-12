# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

This is an **empirical budgeting tool** for Cursor IDE pricing. "Empirical" means every number shown must trace back to Cursor's official docs (https://cursor.com/docs/models-and-pricing and individual model pages). Do not invent or assume pricing rules — if you can't source it from the docs, flag it as unverified. When Cursor updates pricing, the JSON and calculations must be updated to match.

The tool answers two questions from opposite directions:
1. **"I have a budget"** → Which plan is best, and how many tokens do I get per model?
2. **"I know my token usage"** → What will it cost me, and which plan covers it?

## Commands

- **Dev server:** `npm run dev` (Vite, hot reload)
- **Build:** `npm run build` (runs `tsc -b && vite build`, output in `dist/`)
- **Lint:** `npm run lint` (ESLint with TypeScript + React hooks/refresh rules)
- **Preview prod build:** `npm run preview`

No test framework is configured.

## Architecture

Single-page React + TypeScript app deployed to Vercel.

**Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 (via PostCSS plugin `@tailwindcss/postcss`).

### Key structure

- `src/App.tsx` — The entire application: types, calculation logic, and all UI components live in this single file. There is no routing or state management library.
- `src/data/cursor-pricing.json` — Pricing data (plans, model rates, settings). Models are split into two pools: `api` (billable) and `auto_composer` (included). The calculator only operates on `api` pool models.

### Core calculation logic (in App.tsx)

- `calculateTokensFromBudget()` — Given a dollar budget, computes how many tokens you can consume for a model, factoring in input/output ratio, Max Mode, and optional prompt caching.
- `calculateCostFromTokens()` — Inverse: given token count, computes dollar cost.
- `getBestPlan()` — Compares Pro/Pro Plus/Ultra plans by total cost (subscription + overage) and returns the cheapest option.
- Caching model assumes a 3x re-read pattern (`RE_READS = 3`) for iterative coding workflows.

### Styling

Tailwind utility classes inline (no component library). Design palette uses `#14120b` (near-black), `#f7f7f4` (off-white background), and `#e0e0d8` (borders). Provider colors are mapped in `PROVIDER_COLORS`.

## Cursor Pricing Domain Model (source of truth)

All facts below sourced from https://cursor.com/docs/models-and-pricing and individual model pages. Last verified 2026-03-12.

### Two separate usage pools

- **Auto + Composer pool**: Used by Auto and Composer 1.5. "Generous included usage" on all plans — no disclosed dollar amount. On Teams/Enterprise, Composer 1.5 charges at API rates instead.
- **API pool**: Charged at each model's API rate. Plan amounts:
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

### Thinking mode

Available as a variant for Claude models and GPT-5.4. Docs do not specify separate token rates for thinking tokens.

### Model context windows

Each model has a default context window and a Max context:
- Claude 4.6 Opus/Sonnet: 200k default, 1M max
- GPT-5.4: 272k default, 1M max
- Composer 1.5: 200k default, no Max Mode
