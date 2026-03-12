# Cursor Cost Calculator

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/kingdomseed/cursor-calculator)

**[Try it live →](https://cursor-calculator.vercel.app/)**

I pay for Cursor. You probably do too. And neither of us can answer a basic question: **what does my usage actually cost?**

Cursor's pricing page gives you three plans and a table of per-model rates. What it doesn't give you is a way to connect those numbers to how you actually work — which models you reach for, how often you use Max Mode, whether caching is saving you money or just making you feel better about it. The gap between "here are the rates" and "here's what your month looks like" is where money disappears.

This calculator closes that gap. Every rate, every multiplier, every model in here traces back to [Cursor's official docs](https://cursor.com/docs/models-and-pricing). Nothing is estimated. Nothing is rounded for convenience. If the docs don't disclose it, the calculator doesn't pretend to know it.

## What it does

- **Budget mode**: "I have $60/month — what do I get?" The calculator shows which plan maximizes your tokens across your model mix, including the API pool math that makes Pro Plus ($60, but with a $70 API pool) often better than Pro + overage.
- **Token mode**: "I use about 10M tokens/month — what does that cost?" Fixed usage, find the cheapest plan.
- **Weighted model mix**: Most people don't use one model. You might split 60% Sonnet for daily work and 40% Opus for deep research. The calculator handles that — per-model weights, normalized to 100%.
- **Per-model variant toggles**: Max Mode, Fast, Thinking, Caching — each with its actual pricing impact. Max Mode adds a 20% Cursor upcharge. For extended context (1M), dedicated Max/1M model variants have long-context pricing built into their rates — select them directly from the model list.
- **Caching that reflects reality**: Anthropic models have `cache_write` + `cache_read` with a re-read amortization model. Everyone else has `cache_read` only — simple blend. Different math, because they are different systems.
- **29 models across 6 providers**: All scraped from Cursor's docs. Anthropic, OpenAI, Google, xAI, Cursor, Moonshot.

## Why this exists

I build apps for a living (a small one — [Jason Holt Digital](https://github.com/mythicgme2e)). AI coding tools are a significant line item now, and "significant" is doing a lot of work in that sentence because I genuinely don't know the number. I know what I pay Cursor monthly. I don't know if I'm getting $60 of value from Pro Plus or if I should be on Ultra. I don't know if my habit of leaving Max Mode on is costing me 20% more than I think it is, or whether the dedicated 1M context variants are doubling my input costs.

That's the problem. Not the pricing — the pricing is public. The problem is that we don't have tools to connect pricing to personal usage patterns. We're budgeting by gut feel for something that has precise, documentable costs.

This calculator is a step toward fixing that. It won't track your actual usage (Cursor doesn't expose that data via API yet). But it lets you model your patterns — the models you use, the variants you enable, the ratio of input to output — and see what the math says.

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

React 19, TypeScript, Vite, Tailwind CSS 4, Vitest. All calculation logic lives in `src/lib/calculations.ts` as pure functions with no React dependency — testable independently, portable if this ever grows beyond Cursor.

## What's not here (and why)

- **Auto + Composer pool**: Cursor doesn't disclose dollar amounts for this pool. Can't model what isn't documented.
- **Actual usage tracking**: No API from Cursor to pull real token counts. This is a modeling tool, not a monitoring tool.
- **Thinking token pricing**: Cursor doesn't document separate pricing for thinking mode. The checkbox exists in the UI for completeness — it has no effect on calculations.
- **Teams/Enterprise**: Different pricing structures. Out of scope for now.

## License

MIT
