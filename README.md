# Cursor Cost Calculator

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/kingdomseed/cursor-calculator)

**[Try it live →](https://cursor-calculator.vercel.app/)**

Empirical tool for measuring Cursor token usage and cost. Manual calculator rates come from [Cursor's official docs](https://cursor.com/docs/models-and-pricing). If the docs do not disclose a current Cursor rate, the manual calculator does not model it. CSV replay can also use clearly labeled import-only estimates for retired historical labels that no longer exist in the current Cursor catalog.

## What it does

- **Budget mode** — "I have $60/month, what do I get?" Finds the plan that maximizes tokens for your model mix.
- **Token mode** — "I use 10M tokens/month, what does that cost?" Finds the cheapest plan for manual token entry.
- **Cursor CSV replay** — Import one exported monthly Cursor CSV, reuse the exact input/cache/output token columns, and replay that usage through the same plan recommendation math used by the token calculator.
- **Weighted model mix** — Split usage across models (60% Sonnet, 40% Opus). Per-model weights, normalized to 100%.
- **Variant toggles** — Max Mode (+20%), Fast, Thinking, Caching. Dedicated Max/1M model variants have long-context rates built in.
- **Caching** — Anthropic models use `cache_write` + `cache_read` with re-read amortization. Everyone else uses `cache_read` only. Different systems, different math.
- **Import replay controls** — Toggle `User API Key` rows, choose strict vs best-effort label mapping, and see approximate rows called out explicitly.
- **Monthly usage summary** — Imported usage shows priced API tokens, approximate tokens, unsupported tokens, days used in the imported month, and API tokens per used day.
- **29 models, 6 providers** — Anthropic, OpenAI, Google, xAI, Cursor, Moonshot.

## Running it

```bash
npm install
npm run dev
```

Tests:

```bash
npm test
```

Build:

```bash
npm run build
```

## Local import data

- Private Cursor export fixtures can live in `data/private/raw/cursor/`.
- `data/private/` is gitignored so personal exports stay local.
- The import flow currently expects raw monthly Cursor exports with columns such as `Date`, `Kind`, `Model`, `Max Mode`, `Input (w/ Cache Write)`, `Input (w/o Cache Write)`, `Cache Read`, `Output Tokens`, `Total Tokens`, and `Requests`.
- The UI imports one monthly CSV at a time. Choosing a new file replaces the current one.
- Imported `composer-1` rows are API-priced. Imported `composer-1.5` rows stay in the included Auto + Composer pool.

## Tech

React 19, TypeScript, Vite, Tailwind CSS 4, Vitest.

- Current Cursor pricing catalog: `src/data/cursor-pricing.json`
- Shared plan and pricing math: `src/lib/calculations.ts`
- Cursor CSV parsing, normalization, and replay logic: `src/lib/cursorUsage.ts`
- Import UI: `src/components/CursorImportPanel.tsx`
- Import-only provider-backed replay rates for retired labels: `src/data/providerImportModels.ts`
- Library tests: `src/lib/__tests__/`

## Not included

- **Auto + Composer pool** — Cursor doesn't disclose dollar amounts.
- **Live usage tracking** — There is no Cursor API integration here. Imported replay uses exported CSVs, not live account telemetry.
- **First-party verified pricing for every retired import label** — Best-effort import mappings are estimates and are labeled as approximate.
- **Thinking token pricing** — Not documented separately by Cursor.
- **Teams/Enterprise** — Different pricing structures.

## License

MIT
