# Changelog

## v0.1.0 — 2026-03-14

First tagged release of the Cursor Cost Calculator.

### Features

- **Three calculator modes** — Budget ("I have a budget"), Manual usage ("I know my usage"), and CSV Import ("I have a CSV") with a dark sidebar navigation
- **CSV import replay** — Import monthly exports from [Cursor's usage dashboard](https://cursor.com/dashboard/usage) with exact 4-bucket token pricing (cache-write, input, cache-read, output)
- **Budget mode with cache-read share** — Exact-token pricing using `dollarsToExactTokens()`, replacing the old blended-rate formula that undercounted tokens by up to 85% at high cache rates
- **Manual token mode** — Quick estimate with cache-read share slider, or exact token bucket entry
- **Model grouping for CSV imports** — Multiple variants of the same model (e.g., Claude 4.6 Opus base, Max, Thinking) collapse into expandable groups showing aggregate tokens and cost
- **Included-pool model visibility** — Auto and Composer 1.5 explicitly shown in recommendation results as included-pool items
- **Per-model configuration** — Weight allocation, Max Mode (+20% upcharge), Fast mode, Thinking, and custom cache-read share override per model
- **Plan comparison** — Side-by-side Pro / Pro Plus / Ultra comparison with grouped semantic sections (primary answer, plan coverage, out-of-pocket breakdown, usage/value details)
- **Collapsible sidebar** — Dark sidebar with Font Awesome icons, collapsible to icon-only rail, mobile hamburger overlay
- **Smooth animations** — CSS Grid `grid-template-rows: 0fr/1fr` transitions on all collapsible sections
- **CSV template download** — Downloadable template for formatting data from non-Cursor providers
- **Themed scrollbars** — Light for content, dark for sidebar

### Pricing Data (verified 2026-03-14)

- 28 models from OpenAI, Anthropic, Google, xAI, Moonshot, and Cursor
- Claude 4.6 Opus: no long-context surcharge at 1M context (confirmed)
- GPT-5.4: 2x input / 1.5x output for long context (>272k)
- Fast mode variants: Claude 4.6 Opus Fast (6x), GPT-5.4 Fast (2x), GPT-5 Fast (2x)
- Historical model support for CSV replay (Claude Opus 4, 4.1, o3)

### Architecture

- Clean domain/app/component layering with presentation adapter pattern
- Recommendation semantics centralized in `recommendationPresentation.ts`
- Model grouping via catalog-driven base-model-ID derivation (not string manipulation)
- 143 tests across 20 files (Vitest)
- Deployed to Vercel with preview deployments on PRs
