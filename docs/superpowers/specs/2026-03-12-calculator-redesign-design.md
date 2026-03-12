# Cursor Cost Calculator Redesign

## Problem Statement

The calculator has several bugs and missing features that make it unreliable as an empirical budgeting tool:

1. **Plan recommendation always picks Pro**: `getBestPlan()` treats the user's budget as raw API cost, ignoring that Pro Plus ($60) includes $70 in API pool — strictly better than Pro ($20) + $40 overage at the same total cost.
2. **Only first model shown in results**: The BestPlanCard only displays tokens for `primaryModel` (first selected), ignoring all other selections.
3. **Max Mode is a flat 20% multiplier**: In reality, Cursor's 20% upcharge and provider long-context multipliers (2x for Claude, 2x input/1.5x output for GPT-5.4) stack — actual cost can be 2.4x, not 1.2x.
4. **Fast mode treated as a toggle**: Fast variants are separate models with entirely different rate tables (Opus Fast is 6x standard Opus).
5. **No usage-weighted model mix**: Users typically split time across models (Opus for research, Sonnet for daily work), but the calculator treats each model independently.
6. **Incomplete model data**: Only 14 models in JSON vs ~25+ on Cursor's docs.
7. **Caching math assumes all models have cache_write**: Only Anthropic models do. All others have cache_read only.

## Design

### Data Model

#### Plans (unchanged structure, verified data)

```json
{
  "pro":      { "name": "Pro",      "monthly_cost": 20,  "api_pool": 20,  "description": "..." },
  "pro_plus": { "name": "Pro Plus", "monthly_cost": 60,  "api_pool": 70,  "description": "..." },
  "ultra":    { "name": "Ultra",    "monthly_cost": 200, "api_pool": 400, "description": "..." }
}
```

#### Models (new schema)

Each model gains `context`, structured `variants`, and loses the flat `max_mode_available` boolean:

```json
{
  "id": "claude-4-6-opus",
  "name": "Claude 4.6 Opus",
  "provider": "anthropic",
  "pool": "api",
  "context": {
    "default": 200000,
    "max": 1000000
  },
  "rates": {
    "input": 5.00,
    "cache_write": 6.25,
    "cache_read": 0.50,
    "output": 25.00
  },
  "variants": {
    "max_mode": {
      "cursor_upcharge": 0.20,
      "long_context_input_multiplier": 2.0,
      "long_context_output_multiplier": 2.0
    },
    "fast": {
      "model_id": "claude-4-6-opus-fast",
      "rates": {
        "input": 30.00,
        "cache_write": 37.50,
        "cache_read": 3.00,
        "output": 150.00
      }
    },
    "thinking": true
  },
  "auto_checks": {
    "max_mode": false
  }
}
```

Key properties:
- `pool`: `"api"` or `"auto_composer"`. **Calculator only shows and operates on `api` pool models.** This field must be present on every model.
- `context.default` / `context.max`: the model's default and extended context window sizes. Used to label Max Mode in the UI (e.g., "200k → 1M"). See "Long context multiplier" below for how this interacts with pricing.
- `variants.max_mode`: per-model multipliers. Absent if model has no Max Mode (e.g., Composer 1.5). See "Variant interaction rules" below for how Max Mode and Fast interact.
- `variants.fast`: full separate rate table. Absent if no fast variant exists. **Fast and Max Mode are mutually exclusive** — enabling Fast disables Max Mode and vice versa (see interaction rules below).
- `variants.thinking`: boolean. No separate pricing documented in Cursor docs currently. The checkbox is shown in the UI but has **no effect on calculations** — it is informational only, indicating the model supports thinking mode. If Cursor later documents thinking token pricing, this becomes a pricing toggle.
- `auto_checks`: which variant checkboxes are pre-checked when the model is selected. Possible keys: `max_mode`, `fast`, `thinking`. Missing keys default to `false`. When a model is first added to the selection, `App.tsx` reads `auto_checks` to seed the initial checkbox state. E.g., GPT-5.4 has `{ "max_mode": true }`.
- `cache_write`: null for non-Anthropic models. `cache_read` present for nearly all models. Both drive per-model caching calculations (see "Caching" under Calculation Logic).

#### Data Sourcing

Every field must trace to https://cursor.com/docs/models-and-pricing or the individual model page (e.g., `/docs/models/claude-opus-4-6`). The implementation must scrape all model pages via Playwright and cross-reference against the main pricing table. Discrepancies are flagged, not silently resolved.

### Input UI

#### Mode Toggle

Stays as-is: "I have a budget" / "I know my usage". Two modes with different primary inputs.

#### Primary Input

- Budget mode: dollar input + slider ($20–$500). $20 minimum since that's the cheapest plan.
- Token mode: token count input + slider (100k–1B).

#### Model Selector

Keeps the current multi-select dropdown. No changes to the selector itself — it stays clean. Only `api` pool models are shown.

#### Per-Model Configuration Rows

After selecting models, each renders as a configurable row:

```
┌─────────────────────────────────────────────────────────┐
│ [color] Model Name                               [60%] │
│   ☑ Max Mode   ☐ Fast   ☐ Thinking                     │
│   ☑ Caching [hit rate slider: 50%]                      │
│   effective: $12.00 in / $60.00 out per M               │
└─────────────────────────────────────────────────────────┘
```

Behaviors:
- **% allocation**: text input per model. When models are added/removed, percentages auto-redistribute evenly. User can then manually adjust. If manually edited weights don't sum to 100%, the calculation **silently normalizes** them (divide each by the sum) so results are always valid, but a warning badge appears next to the total: "Weights sum to 120% — normalizing." This avoids blocking the user while making the normalization visible.
- **Variant checkboxes**: only shown when the model supports that variant. E.g., no Fast checkbox on Sonnet (no fast variant exists). **Fast and Max Mode are mutually exclusive**: enabling one unchecks the other. This is because Fast variants are entirely separate models that don't have Max Mode available (confirmed by Cursor docs — e.g., `claude-4-6-opus-fast` has no Max Mode).
- **Auto-check**: models with `auto_checks.max_mode: true` (like GPT-5.4) start with Max Mode checked. User can uncheck.
- **Caching**: per-model toggle + hit rate slider (0–95%). Only shown for models with `cache_read` pricing. Calculation differs based on whether `cache_write` exists (Anthropic) or not (others) — see Caching section under Calculation Logic.
- **Live effective rate**: updates instantly as toggles change. Shows both the effective input AND output rate per M tokens after all layers (Fast/Max Mode/long context/caching) are applied.

#### Advanced Options

Input:output ratio slider stays, moved to a global "Advanced" section. Default 3:1.

### Results

#### Best Plan Card

The dark recommendation card leads the results. Shows the winning plan with a full per-model breakdown:

- Plan name, description, total monthly cost
- Base subscription cost
- API pool included
- Estimated API usage (from the weighted model mix)
- Overage amount (or $0 if pool covers it)
- Unused pool (if any)
- Per-model token allocation with effective rates and active variants labeled

In budget mode, different plans yield different token counts because the API budget differs. In token mode, tokens are fixed and only cost changes.

#### Expandable Plan Comparison

Below the card, a collapsed "Compare all plans" section expands to a 3-column table:

| | Pro | Pro Plus | Ultra |
|---|---|---|---|
| Subscription | $20 | $60 | $200 |
| API pool | $20 | $70 | $400 |
| Your API usage | $52 | $52 | $52 |
| Overage | $32 | $0 | $0 |
| **Total cost** | **$52** | **$60** | **$200** |
| Unused pool | — | $18 | $348 |
| Opus tokens | ... | ... | ... |
| GPT-5.4 tokens | ... | ... | ... |

In budget mode, plans the user can't afford (subscription > budget) are greyed out. In token mode, all three plans are always shown since cost is the output, not the constraint.

### Calculation Logic

#### Effective Rate Computation (per model)

Rates are computed in layers, applied in order:

1. **Fast mode**: if enabled, replaces base rates entirely with `variants.fast.rates`. **Skips steps 2–3** since Fast variants are separate models without Max Mode.
2. **Cursor Max Mode upcharge**: if Max Mode enabled (and Fast is NOT enabled), multiply all rates by `1 + cursor_upcharge` (typically 1.20)
3. **Long context multiplier**: if Max Mode enabled, **always apply** `long_context_input_multiplier` and `long_context_output_multiplier`. Rationale: Max Mode's purpose is to extend context beyond the default window, so the calculator assumes you're using the extended context when Max Mode is checked. The `context.default` and `context.max` fields are used for UI labeling (e.g., "200k → 1M") but not as a runtime threshold in the calculation — we can't know the user's actual context usage per-request.
4. **Caching blend**: if caching enabled, blend cached rates into the effective input rate based on hit rate %. See "Caching" below for the full formula.

Steps 2 and 3 are cumulative. A model with 20% upcharge + 2x long context input multiplier has an effective 2.4x input rate.

#### Caching

Two formulas depending on whether the model has `cache_write`:

**Anthropic models (have `cache_write`):**
Uses a re-read assumption: in iterative coding, cached context is read multiple times. `RE_READS = 3` (configurable as an advanced option).

```
cached_ratio = cache_hit_rate / 100
uncached_ratio = 1 - cached_ratio
effective_input = (
  cached_ratio * cache_write +           // pay once to write
  cached_ratio * cache_read * RE_READS + // cheap re-reads
  uncached_ratio * input * RE_READS      // uncached reads
) / RE_READS
```

**Other models (cache_read only, no cache_write):**
No write cost to amortize. The cached portion simply uses the `cache_read` rate instead of the `input` rate:

```
cached_ratio = cache_hit_rate / 100
effective_input = cached_ratio * cache_read + (1 - cached_ratio) * input
```

The `RE_READS` assumption does not apply to cache_read-only models because there is no write cost to spread across multiple reads.

Output rates are never affected by caching.

#### Budget Mode

```
for each plan where plan.monthly_cost <= budget:
  api_budget = plan.api_pool + (budget - plan.monthly_cost)
  total_tokens = 0
  for each model at weight%:
    model_dollars = api_budget * (weight / 100)
    effective_rate = compute_effective_rate(model, variants, caching)
    tokens = dollars_to_tokens(model_dollars, effective_rate, input_output_ratio)
    total_tokens += tokens
  score plan by total_tokens
recommend plan with most total tokens
```

#### Token Mode

```
for each plan:
  total_api_cost = 0
  for each model at weight%:
    model_tokens = total_tokens * (weight / 100)
    effective_rate = compute_effective_rate(model, variants, caching)
    cost = tokens_to_dollars(model_tokens, effective_rate, input_output_ratio)
    total_api_cost += cost
  overage = max(0, total_api_cost - plan.api_pool)
  total_cost = plan.monthly_cost + overage
recommend plan with lowest total_cost
```

#### Tiebreaking

When two plans produce the same score (budget mode: same total tokens; token mode: same total cost), prefer the plan with more API pool headroom. With the current plan data (Pro: $0 net bonus, Pro Plus: $10 bonus, Ultra: $200 bonus), exact ties are unlikely but the rule ensures deterministic behavior and prevents the cheapest plan from winning by default when value is equal.

#### Budget Input Validation

The text input accepts any positive integer. The slider is capped at $20–$500. If the user types a value below $20 (the cheapest plan), no plan qualifies — show a message: "Minimum budget is $20 (Pro plan subscription)." Values above $500 are allowed via text input (the slider just stays at max).

### Code Organization

```
src/
  data/
    cursor-pricing.json           # updated schema
  lib/
    types.ts                      # Model, Plan, Variant, UserConfig, etc.
    calculations.ts               # pure functions, no React
  components/
    ModeToggle.tsx                # budget/tokens toggle
    ModelSelector.tsx             # multi-select dropdown
    ModelConfigRow.tsx            # single model: %, variants, caching, effective rate
    ModelConfigList.tsx           # list of rows, % normalization to 100
    BestPlanCard.tsx              # recommendation card
    PlanComparison.tsx            # expandable 3-plan table
    BudgetInput.tsx               # dollar input + slider
    TokenInput.tsx                # token input + slider
  App.tsx                         # layout, state, orchestration
```

`lib/calculations.ts` contains only pure functions with no React dependency. This makes the math independently testable and keeps the door open for adding other tools (non-Cursor) to compare against in the future.

State stays in `App.tsx` with `useState`. No state management library needed at this scale. Component tree is shallow enough for prop drilling.

### Display Formatting

- **Currency**: use `$X.XX` (two decimal places) for API costs, overage, and effective rates where precision matters. Use `$X` (whole dollar) for subscription costs and plan prices which are always round numbers.
- **Tokens**: use `formatNumber()` with M/k suffixes. Show input/output breakdown where relevant.

### Styling

Keeps the existing Tailwind palette: `#14120b` (near-black), `#f7f7f4` (off-white background), `#e0e0d8` (borders). Provider colors per `PROVIDER_COLORS` map. No component library — utility classes inline.

### Out of Scope

- Auto + Composer pool calculations (no disclosed dollar amounts in docs)
- Teams/Enterprise plan calculations
- Multi-tool comparison (future: compare Cursor vs other AI coding tools)
- Thinking token pricing (not documented separately by Cursor)
- Yearly pricing toggle (could add later)
