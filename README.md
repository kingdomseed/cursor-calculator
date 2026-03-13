# Cursor Cost Calculator

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/kingdomseed/cursor-calculator)

**[Try it live →](https://cursor-cost-calculator.com/)**

Empirical tool for measuring Cursor token usage and cost. Manual calculator rates come from [Cursor's official docs](https://cursor.com/docs/models-and-pricing). If the docs do not disclose a current Cursor rate, the manual calculator does not model it. CSV replay can also use clearly labeled import-only estimates for retired historical labels that no longer exist in the current Cursor catalog.

## What it does

- **Budget mode** — "I have $60/month, what do I get?" Finds the plan that maximizes tokens for your model mix.
- **Token mode** — "I use 10M tokens/month, what does that cost?" Finds the cheapest plan for manual token entry.
- **Cursor CSV replay** — Import one exported monthly Cursor CSV, reuse the exact input/cache/output token columns, and replay that usage through the same plan recommendation math used by the token calculator.
- **Weighted model mix** — Split usage across models (60% Sonnet, 40% Opus). Per-model weights, normalized to 100%.
- **Variant toggles** — Max Mode (+20%), Fast, Thinking, Caching. Dedicated Max/1M model variants have long-context rates built in.
- **Caching** — Anthropic models use `cache_write` + `cache_read` with re-read amortization. Everyone else uses `cache_read` only. Different systems, different math.
- **Import replay controls** — `User API Key` rows are included by default for a “Cursor only” estimate, with strict vs best-effort label mapping and approximate rows called out explicitly.
- **Imported Composer handling** — `composer-1` rows are API-priced during replay, while `composer-1.5` stays in the included Auto + Composer pool.
- **Monthly usage summary** — Imported usage shows priced API tokens, approximate tokens, unsupported tokens, days used versus comparison days for the imported month or date span, and API tokens per used day.
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

## Tech

React 19, TypeScript, Vite, Tailwind CSS 4, Vitest.

## Architecture

- App orchestration boundary: `src/app/`
  - `calculatorState.ts` defines reducer-owned source state and defaults
  - `calculatorReducer.ts` owns state transitions
  - `calculatorSelectors.ts` derives replay reports and recommendations
  - `cursorImportPresentation.ts` and `cursorImportActions.ts` own replay-summary presentation helpers and import-action wiring
  - `useCalculatorController.ts` coordinates UI wiring and import side-effect orchestration
- Current Cursor pricing catalog: `src/data/cursor-pricing.json`
- Current catalog accessors: `src/domain/catalog/`
- Model config defaults, reconciliation, and capability rules: `src/domain/modelConfig/`
- Recommendation math and plan comparison: `src/domain/recommendation/`
- Import replay catalog and CSV pipeline: `src/domain/importReplay/`
- Import-only historical replay models: `src/data/importReplayHistoricalModels.ts`
- Import replay label mappings and approximation rules: `src/data/importReplayLabelMappings.ts`
- Presentational UI components: `src/components/`
- Automated coverage: `src/domain/*/__tests__/` and `src/app/__tests__/`

## Not included

- **Auto + Composer pool** — Cursor doesn't disclose dollar amounts.
- **Live usage tracking** — There is no Cursor API integration here. Imported replay uses exported CSVs, not live account telemetry.
- **First-party verified pricing for every retired import label** — Best-effort import mappings are estimates and are labeled as approximate.
- **Thinking token pricing** — Not documented separately by Cursor.
- **Teams/Enterprise** — Different pricing structures.

## License

MIT
