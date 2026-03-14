# Sidebar Navigation & CSV Model Grouping

## Problem

The calculator has three stacked toggle levels (mode → token source → input style) that create decision fatigue before users reach any input. Separately, CSV import results show every imported row as an individual model line item — a 443-row export produces dozens of repetitive entries like five variants of "Claude 4.6 Opus" listed separately.

## Goals

1. Replace the three toggle levels with a fixed sidebar navigation that presents all three modes as a single choice.
2. Group CSV import model rows by base model family, collapsed by default, expandable to show variant details.
3. Preserve all existing pricing semantics and presentation model contracts.

---

## Feature 1: Sidebar Navigation

### Layout

The app moves from a centered single-column layout (`max-w-2xl`) to a two-panel layout:

- **Sidebar (left):** `position: fixed`, `height: 100vh`, `overflow-y: auto`, dark background (`#14120b`), ~200px wide.
- **Content area (right):** Left margin offsets the sidebar width, white background, scrollable via the document body.

### Sidebar contents

1. **App branding** — Calculator icon + "Cursor Cost Calculator" title.
2. **Navigation items** — Three items, one active at a time:
   - "I have a budget" → sets `mode: 'budget'`
   - "I know my usage" → sets `mode: 'tokens'`, `tokenSource: 'manual'`
   - "I have a CSV" → sets `mode: 'tokens'`, `tokenSource: 'cursor_import'`
3. **Footer links** — "How plans work" explainer, source URL, GitHub link, JHD link. These move from the current page footer into the sidebar bottom.

Active nav item: highlighted background (`rgba(255,255,255,0.12)`). Inactive items: subdued text (`rgba(255,255,255,0.5)`).

### Navigation action

A new reducer action `navigate` combines mode and token source into a single dispatch:

```ts
type NavigationTarget = 'budget' | 'manual_usage' | 'csv_import';

// Action:
{ type: 'navigate', target: NavigationTarget }

// Reducer maps target → state:
// 'budget'       → { mode: 'budget' }
// 'manual_usage' → { mode: 'tokens', tokenSource: 'manual' }
// 'csv_import'   → { mode: 'tokens', tokenSource: 'cursor_import' }
```

The existing `set_mode` and `set_token_source` actions remain for backward compatibility and internal use. The sidebar dispatches only `navigate`.

### What this replaces

- The `ModeToggle` component (`src/components/ModeToggle.tsx`) — removed.
- The token source pill toggle JSX in `src/App.tsx` — removed.
- The `<header>` bar in `src/App.tsx` — branding moves to sidebar.
- The footer `<div>` at the bottom of `src/App.tsx` — content moves to sidebar bottom.

The `WelcomeModal` remains as a disclaimer overlay, independent of navigation. The `<Analytics />` component from `@vercel/analytics/react` remains in the app root, unaffected by layout changes.

### Content area

Shows mode-specific content:
- **Budget mode:** Budget input slider, model selector, model configs, advanced options, recommendation results.
- **Manual usage mode:** Token input with inline "Quick estimate / Exact token buckets" toggle, cache-read share, model selector, model configs, advanced options, recommendation results.
- **CSV import mode:** CursorImportPanel (file picker, options, summary), recommendation results.

The "Quick estimate / Exact token buckets" toggle stays as a contextual inline control within the manual usage content, not a navigation-level choice.

### Mobile behavior (< 768px)

- Sidebar collapses off-screen (`transform: translateX(-100%)`).
- A hamburger icon appears in the top-left of the content area.
- Tapping the hamburger slides the sidebar in as an overlay with a backdrop.
- The overlay has `role="dialog"`, `aria-modal="true"`, and focus is trapped within it while open.
- Pressing Escape or tapping outside the overlay closes it.
- Tapping a nav item closes the overlay and navigates.
- Content area goes full-width (left margin removed).

### Components added

- `Sidebar` (`src/components/Sidebar.tsx`) — renders nav items, branding, footer links. Accepts current `NavigationTarget` and exposes `onNavigate(target: NavigationTarget)` callback. Includes `role="navigation"` and `aria-label`.
- `SidebarLayout` (`src/components/SidebarLayout.tsx`) — wraps sidebar + content area. Manages mobile hamburger open/close state. Handles responsive breakpoint, overlay backdrop, and focus trapping.

---

## Feature 2: CSV Model Grouping

### Scope

Applies only when `tokenSource === 'cursor_import'`. Budget mode and manual token mode are unaffected — they render flat `modelRows` as today.

### Grouping key derivation

Base model ID is derived from the catalog's variant structure rather than string manipulation. The pricing catalog (`src/data/cursor-pricing.json`) defines fast variants via `variants.fast.model_id`. Max-mode and thinking are config flags on the same base model, not separate model IDs.

The derivation function (`getBaseModelId` in `src/app/recommendationPresentation.ts`) uses catalog structure, not string manipulation:

1. **Fast variants:** Check if the row's model ID appears as a `variants.fast.model_id` in any catalog model. If so, return the parent model's ID. Example: `gpt-5.4-fast` is the fast variant of `gpt-5.4`.
2. **Max/long-context variants:** The catalog has standalone max models (`claude-opus-4-6-max`, `gpt-5.4-max`, `claude-4-sonnet-1m`) that are separate entries. The `IMPORT_REPLAY_LONG_CONTEXT_COMPANIONS` mapping in `src/data/importReplayLabelMappings.ts` defines the base→max relationship (e.g., `claude-opus-4-6` → `claude-opus-4-6-max`). The derivation inverts this: if a row's model ID appears as a `maxId` value in the companions map, return the corresponding base model ID. When multiple base IDs map to the same `maxId` (e.g., both `claude-opus-4-6` and `claude-4-5-opus` map to `claude-opus-4-6-max`), prefer the non-approximated entry. Note: `gpt-5.1-codex-max` is a standalone catalog entry but does not appear in the companions map, so it falls to the singleton fallback (rule 4).
3. **Config-only variants:** Rows that differ only by config flags (`maxMode`, `thinking`, `caching`) on the same base model ID already share the model ID. No special handling needed.
4. **Singletons:** Models with no variant relationship form a group of one. Singleton groups render identically to a non-grouped row (no "1 variant" badge, no chevron).

Edge cases:
- Import-only historical models (from `src/data/importReplayHistoricalModels.ts`) that don't appear in the current catalog: use the model ID as-is for the group key. They'll group with other rows sharing the same historical model ID.
- Approximate mappings: group by the mapped model ID, not the original CSV label. For example, `agent_review` is mapped to `gpt-5` in the import replay layer as a best-effort estimate, but its actual underlying model is unknown — it should display as "Agent Review" in the UI rather than claiming a specific model identity.
- Standalone max models that don't appear in the companions map: remain as their own group (safe fallback).

### Types

```ts
interface RecommendationModelGroup {
  groupKey: string;                          // base model ID
  familyLabel: string;                       // display name, e.g. "Claude 4.6 Opus"
  provider: string;                          // for provider color dot
  variantCount: number;                      // children.length
  totalTokens: number;                       // sum of child token volumes (secondaryMetric.value in token mode)
  totalCost: number;                         // sum of child usage costs (primaryMetric.value in token mode)
  children: RecommendationModelDisplayRow[]; // individual variant rows
}
```

Note on metric mapping: in token mode (which CSV import always uses), `primaryMetric` is "Usage cost" and `secondaryMetric` is "Token volume" per `buildModelDisplayRow()`. So `totalCost` sums `primaryMetric.value` and `totalTokens` sums `secondaryMetric.value`.

### Where it lives in the presentation model

`modelGroups` is added to the **top-level `RecommendationPresentation`**, not per-plan, because the group structure (which models form a family) is the same across all plans — only the per-plan values differ.

```ts
interface RecommendationPresentation {
  // ... existing fields ...
  modelGroups: RecommendationModelGroup[] | null;  // null for non-import modes
}
```

The grouping is built inside `buildRecommendationPresentation()` in `src/app/recommendationPresentation.ts`, after the per-plan model rows are already constructed. A new helper `buildModelGroups(bestPlan.modelRows, tokenSource)` groups the best plan's model rows into families when `tokenSource === 'cursor_import'`, and returns `null` otherwise. The group structure (which rows belong to which family) is defined once from the best plan — all plans share the same model set for CSV import. Per-plan aggregate values for `PlanComparison` are computed in the component by summing each plan's `modelRows` filtered by the group's child keys.

### Collapsed state (default)

Each group renders as a single row showing:
- Provider color dot (from group's `provider`)
- Model family name (from group's `familyLabel`)
- Variant count badge (e.g., "4 variants") — omitted for singleton groups
- Aggregate total tokens
- Aggregate total cost
- Expand/collapse chevron — omitted for singleton groups

### Expanded state

Clicking a collapsed group reveals individual variant rows exactly as they appear today:
- Full label with variant badges (Max, Thinking, Cache, Fast, Approx, and any `sourceLabel` value)
- Per-variant effective rates
- Per-variant tokens and cost

### Ordering

- Groups sorted by `totalCost` descending (highest spend model family first).
- Within an expanded group, `children` sorted by cost descending.

### Aggregation integrity

`totalTokens` and `totalCost` are computed by summing the child `RecommendationModelDisplayRow` values. This guarantees the collapsed totals always equal the sum of expanded rows — no separate re-pricing path.

### BestPlanCard rendering

When `presentation.modelGroups` is non-null, `BestPlanCard` renders model groups instead of flat `bestPlan.modelRows`. Each group is a collapsible section. The component manages expand/collapse state locally (a `Set<string>` of expanded group keys).

### PlanComparison rendering

When `presentation.modelGroups` is non-null, `PlanComparison` renders grouped model rows in the per-model details sub-table. For each group:
- Collapsed row shows aggregate values **per plan column** (summing that plan's variant rows within the group).
- Expanded rows show individual variants across all plan columns, maintaining column alignment.

The per-plan aggregation for comparison columns is computed in the component from each plan's `modelRows`, filtered by the group's child keys. This avoids duplicating grouping logic — the group structure comes from the presentation model, the per-plan values come from each plan's existing `modelRows`.

### Not touched

- `computeExactUsageRecommendation()` in `src/domain/recommendation/recommendation.ts` — still prices every CSV row individually.
- `PlanResult.perModel` — still contains per-row `PlanLineItem[]`.
- `CursorImportPanel` (`src/components/CursorImportPanel.tsx`) — import summary stays as-is.
- `src/app/cursorImportPresentation.ts` — cache-read share, tokens-per-day helpers unchanged.
- Existing `RecommendationPresentation` types — additive only, nothing removed or renamed.

---

## Interaction between the two features

The sidebar and model grouping are independent changes that compose cleanly:
- Sidebar controls which content panel is shown.
- Model grouping is a presentation transform within the CSV import recommendation results.
- They share no state, no types, and no components.

The only shared concern is that the sidebar's "I have a CSV" nav item sets `tokenSource: 'cursor_import'`, which is the same flag the presentation adapter checks to decide whether to build model groups.

---

## Out of scope

- Changing the recommendation engine's per-row pricing.
- Changing the CursorImportPanel summary/stats display.
- Adding Bedrock/BYOK rate comparison (noted for future consideration).
- Changing the import replay label mapping logic.
- Adding new models to the catalog.
