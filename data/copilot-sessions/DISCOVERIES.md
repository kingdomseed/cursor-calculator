# Copilot CLI Token Data & Cursor Pricing Comparison

**Date:** 2026-03-15
**Status:** Early research — 1 usable session out of 10

## Data Source: Where Copilot CLI Stores Session Data

All data lives in `~/.copilot/`:

| Path | Purpose |
|------|---------|
| `session-state/{uuid}/events.jsonl` | Per-session event stream (newer format) |
| `session-state/{uuid}.jsonl` | Per-session event stream (older format) |
| `session-store.db` | SQLite index — sessions, turns, checkpoints, files. **No token data.** |
| `config.json` | CLI settings (model, log level, etc.) |
| `logs/process-{ts}-{pid}.log` | Debug/error process logs |

### The key event: `session.shutdown`

The `session.shutdown` event at the end of `events.jsonl` contains per-model token breakdowns:

```json
{
  "type": "session.shutdown",
  "data": {
    "totalPremiumRequests": 1,
    "totalApiDurationMs": 434710,
    "modelMetrics": {
      "gpt-5.4": {
        "requests": { "count": 23, "cost": 1 },
        "usage": {
          "inputTokens": 2869135,
          "outputTokens": 21258,
          "cacheReadTokens": 1906560,
          "cacheWriteTokens": 0
        }
      }
    }
  }
}
```

### Data completeness problem

- Only sessions with **clean shutdowns** write the `session.shutdown` event
- Ctrl+C'd or crashed sessions have no token summary
- Per-request `assistant.usage` events are ephemeral and **not persisted** — only aggregated totals survive
- In our data: 3/10 sessions had shutdown events, but only 1/10 had actual token metrics
- The SQLite `session-store.db` has session metadata and conversation text but **no token/cost data**

### Other data sources

- **GitHub REST API** — `GET /users/{username}/settings/billing/premium_request/usage` gives premium request billing with model/SKU/pricing per unit, but is less granular than local files
- **Org/Enterprise metrics API** — Has `totals_by_cli` with session counts, request counts, and token sums (admin access only)
- **`/usage` slash command** — Shows mid-session stats in the terminal, but not persisted
- **`--output-format=json`** — Outputs JSONL to terminal; could be captured by piping

## Pricing Model Comparison

### Fundamental difference

| | GitHub Copilot | Cursor |
|---|---|---|
| **Billing unit** | Premium requests (per interaction) | Tokens (per volume) |
| **Cost scaling** | Flat per session, regardless of token count | Linear with context size |
| **Favors** | Heavy-token agentic sessions | Light, short interactions |
| **Transparency** | Opaque (what counts as 1 request?) | Direct (token × rate) |

### Plan comparison

| Plan | Monthly | Included | Overage |
|------|---------|----------|---------|
| **Copilot Free** | $0 | 50 premium reqs | Cannot purchase |
| **Copilot Pro** | $10 | 300 premium reqs | $0.04/req |
| **Copilot Pro+** | $39 | 1,500 premium reqs | $0.04/req |
| **Cursor Pro** | $20 | $20 API pool | Per-token rates |
| **Cursor Pro Plus** | $60 | $70 API pool | Per-token rates |
| **Cursor Ultra** | $200 | $400 API pool | Per-token rates |

### Copilot premium request multipliers (key models)

| Model | Multiplier | Copilot plan cost/req | Cursor $/M input |
|-------|-----------|----------------------|-----------------|
| GPT-4.1, GPT-4o, GPT-5 mini | 0x (included) | $0.00 | $0.25 |
| Claude Haiku 4.5 | 0.33x | $0.013 | $1.00 |
| Gemini 3 Flash | 0.33x | $0.013 | $0.50 |
| GPT-5.1 Codex | 1x | $0.04 | $1.25 |
| GPT-5.4 | 1x | $0.04 | $2.50 |
| Claude Sonnet 4/4.5/4.6 | 1x | $0.04 | $3.00 |
| Gemini 3/3.1 Pro | 1x | $0.04 | $2.00 |
| Claude Opus 4.5/4.6 | 3x | $0.12 | $5.00 |
| Claude Opus 4.6 Fast | 30x | $1.20 | $30.00 |

### What counts as "1 request" on Copilot

- **Chat, CLI, code review, Copilot Spaces**: 1 request per user prompt (multiplied by model rate)
- **Coding agent**: 1 request per session + 1 per steering comment
- **Spark**: 4 requests per prompt (fixed)
- Within a single request, the model may make many API calls (tool use, iterations) — all covered by that 1 request

## Observed Data (single session)

| Metric | Value |
|--------|-------|
| Model | gpt-5.4 |
| API calls | 23 |
| Premium requests consumed | 1 |
| Input tokens | 2,869,135 |
| Output tokens | 21,258 |
| Cache read tokens | 1,906,560 |
| Cache write tokens | 0 |
| Total tokens | 4,796,953 |
| Cache hit rate | 39.9% |
| Session type | Research (no code changes) |

## Cost Comparison (from observed session)

### Amortized session cost formula

**Copilot:**
```
session_cost = (premium_reqs_consumed / plan_allowance) × plan_monthly_cost
```

**Cursor:**
```
session_cost = (input × input_rate + cache_read × cache_rate + output × output_rate) / 1M
```

### Applied to observed session

| | Copilot Pro | Copilot Pro+ | Copilot Overage | Cursor (token) |
|---|---|---|---|---|
| Session cost | (1/300) × $10 = **$0.033** | (1/1500) × $39 = **$0.026** | 1 × $0.04 = **$0.040** | **$7.97** |
| Cursor/Copilot ratio | 239x | 307x | 199x | — |

### Monthly projection (at observed session intensity)

| Sessions/mo | Copilot Pro | Copilot Pro+ | Cursor Pro | Cursor Pro+ | Cursor Ultra |
|-------------|-------------|-------------|------------|-------------|-------------|
| 10 | $10 | $39 | $80 | $70 | $200 |
| 30 | $10 | $39 | $239 | $229 | $200 |
| 60 | $10 | $39 | $478 | $468 | $278 |
| 100 | $10 | $39 | $797 | $787 | $597 |
| 300 | $10 | $39 | $2,391 | $2,381 | $2,191 |

## Key Insights

### Why the gap is so large (and why it will narrow)

1. **This session was a worst-case for Cursor** — a research deep-dive consuming 4.8M tokens with only 21K output. That's almost all input cost. Copilot's flat-rate model is maximally advantageous here.

2. **Typical coding sessions will be lighter** — a focused coding session might use 100K-500K tokens, costing $0.25-$2.00 on Cursor vs. still $0.033 on Copilot. The ratio drops from 239x to maybe 8-60x, but Copilot still wins.

3. **Copilot's cache hit rate was lower** — 39.9% vs. what Cursor typically achieves. If Copilot had higher cache rates, the Cursor cost would be even lower, narrowing the gap slightly.

4. **Model choice matters differently** — On Copilot, switching from Sonnet (1x) to Opus (3x) triples the cost. On Cursor, Opus is 1.67x more for input tokens. For Opus-heavy usage, the gap narrows.

### When Cursor might win

- If Copilot charges 3x+ multipliers for your preferred models (Opus)
- If your sessions are very light (quick completions, small contexts)
- If you value the IDE integration advantages Cursor offers
- If you need models Copilot doesn't offer

### Copilot blindspots

Usage not captured by CLI session data:
- GitHub cloud agents / Copilot Workspace
- Code review requests
- Copilot Spark (4 reqs/prompt)
- IDE chat/completions (VS Code, JetBrains)
- These all consume from the same premium request pool

## Next Steps

1. **Capture more sessions** — Use the CLI more and let sessions complete cleanly (no Ctrl+C) so shutdown events get written
2. **Vary models** — Try Claude Sonnet (1x), Opus (3x), cheaper models (Haiku 0.33x) to see how multipliers affect the comparison
3. **Capture coding sessions** — Research tasks skew heavily toward input tokens; coding sessions will have different ratios
4. **Consider the full Copilot budget** — IDE completions, code review, Spark all eat from the same premium request pool. The CLI is just one surface.
5. **GitHub billing API** — `GET /users/{username}/settings/billing/premium_request/usage` could supplement local data for total monthly premium request consumption

## How to Run

```bash
# Copy latest session data
for f in $(find ~/.copilot/session-state/ -name "events.jsonl"); do
  uuid=$(basename $(dirname "$f"))
  cp "$f" "data/copilot-sessions/${uuid}.jsonl"
done
for f in ~/.copilot/session-state/*.jsonl; do
  cp "$f" "data/copilot-sessions/"
done

# Run aggregation
npx tsx data/copilot-sessions/aggregate.ts
```

## Sources

- [GitHub Copilot Plans & Pricing](https://github.com/features/copilot/plans)
- [Requests in GitHub Copilot](https://docs.github.com/en/copilot/concepts/billing/copilot-requests)
- [Supported AI models in GitHub Copilot](https://docs.github.com/en/copilot/reference/ai-models/supported-models)
- [GitHub Copilot premium requests](https://docs.github.com/en/billing/concepts/product-billing/github-copilot-premium-requests)
- [About individual GitHub Copilot plans](https://docs.github.com/en/copilot/concepts/billing/individual-plans)
- [Configure GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/configure-copilot-cli)
- [More Verbose Token Information — Issue #1152](https://github.com/github/copilot-cli/issues/1152)
- Cursor pricing: `src/data/cursor-pricing.json` in this repo
