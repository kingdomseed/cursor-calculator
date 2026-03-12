# Cursor Cost Calculator

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/kingdomseed/cursor-calculator)

**[Try it live →](https://cursor-calculator.vercel.app/)**

Empirical tool for measuring Cursor token usage and cost. Every rate comes from [Cursor's official docs](https://cursor.com/docs/models-and-pricing). If the docs don't disclose it, the calculator doesn't model it.

## What it does

- **Budget mode** — "I have $60/month, what do I get?" Finds the plan that maximizes tokens for your model mix.
- **Token mode** — "I use 10M tokens/month, what does that cost?" Finds the cheapest plan.
- **Weighted model mix** — Split usage across models (60% Sonnet, 40% Opus). Per-model weights, normalized to 100%.
- **Variant toggles** — Max Mode (+20%), Fast, Thinking, Caching. Dedicated Max/1M model variants have long-context rates built in.
- **Caching** — Anthropic models use `cache_write` + `cache_read` with re-read amortization. Everyone else uses `cache_read` only. Different systems, different math.
- **29 models, 6 providers** — Anthropic, OpenAI, Google, xAI, Cursor, Moonshot.

## Running it

```bash
npm install
npm run dev
```

Tests:

```bash
npx vitest run
```

Build:

```bash
npm run build
```

## Tech

React 19, TypeScript, Vite, Tailwind CSS 4, Vitest. Calculation logic lives in `src/lib/calculations.ts` — pure functions, no React dependency.

## Not included

- **Auto + Composer pool** — Cursor doesn't disclose dollar amounts.
- **Actual usage tracking** — No API from Cursor for real token counts. This models patterns, it doesn't monitor them.
- **Thinking token pricing** — Not documented separately by Cursor.
- **Teams/Enterprise** — Different pricing structures.

## License

MIT
