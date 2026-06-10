/**
 * Aggregate GitHub Copilot CLI session data from events.jsonl files.
 *
 * Reads all .jsonl files in this directory, extracts session.start and
 * session.shutdown events, and produces a usage summary by date and model
 * with cross-platform cost comparison against Cursor pricing.
 *
 * Run: npx tsx data/copilot-sessions/aggregate.ts
 */

import { readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";

// ── Types ────────────────────────────────────────────────────────────

interface SessionStart {
  type: "session.start";
  data: {
    sessionId: string;
    version: number;
    producer: string;
    copilotVersion: string;
    startTime: string;
    context?: {
      cwd?: string;
      gitRoot?: string;
      branch?: string;
      repository?: string;
    };
  };
  timestamp: string;
}

interface ModelMetrics {
  requests: { count: number; cost: number };
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
}

interface SessionShutdown {
  type: "session.shutdown";
  data: {
    shutdownType: string;
    totalPremiumRequests: number;
    totalApiDurationMs: number;
    sessionStartTime: number;
    codeChanges: {
      linesAdded: number;
      linesRemoved: number;
      filesModified: string[];
    };
    modelMetrics: Record<string, ModelMetrics>;
    currentModel: string;
  };
  timestamp: string;
}

interface ParsedSession {
  sessionId: string;
  file: string;
  start?: SessionStart;
  shutdown?: SessionShutdown;
}

// ── Copilot pricing (per-request model) ──────────────────────────────

interface CopilotPlan {
  name: string;
  monthlyCost: number;
  premiumRequests: number;
  overageRate: number; // $ per premium request beyond allowance
}

const COPILOT_PLANS: CopilotPlan[] = [
  { name: "Free", monthlyCost: 0, premiumRequests: 50, overageRate: Infinity },
  { name: "Pro", monthlyCost: 10, premiumRequests: 300, overageRate: 0.04 },
  { name: "Pro+", monthlyCost: 39, premiumRequests: 1500, overageRate: 0.04 },
];

// Premium request multiplier per model (from GitHub docs, March 2026)
const COPILOT_MULTIPLIERS: Record<string, number> = {
  // Included on paid plans (0x)
  "gpt-4.1": 0,
  "gpt-4o": 0,
  "gpt-5-mini": 0,
  "raptor-mini": 0,
  // Low-cost
  "claude-haiku-4.5": 0.33,
  "gemini-3-flash": 0.33,
  "grok-code-fast-1": 0.25,
  "gpt-5.1-codex-mini": 0.25,
  // Standard (1x)
  "gpt-5.1": 1,
  "gpt-5.1-codex": 1,
  "gpt-5.2": 1,
  "gpt-5.3": 1,
  "gpt-5.4": 1,
  "claude-sonnet-4": 1,
  "claude-sonnet-4.5": 1,
  "claude-sonnet-4.6": 1,
  "gemini-2.5-pro": 1,
  "gemini-3-pro": 1,
  "gemini-3.1-pro": 1,
  // Premium
  "claude-opus-4.5": 3,
  "claude-opus-4.6": 3,
  // Ultra-premium
  "claude-opus-4.6-fast": 30,
};

// ── Cursor pricing (per-token model) ─────────────────────────────────

interface CursorPlan {
  name: string;
  monthlyCost: number;
  apiPool: number; // $ of API usage included
}

const CURSOR_PLANS: CursorPlan[] = [
  { name: "Pro", monthlyCost: 20, apiPool: 20 },
  { name: "Pro Plus", monthlyCost: 60, apiPool: 70 },
  { name: "Ultra", monthlyCost: 200, apiPool: 400 },
];

// Cursor per-token rates ($/M tokens) for models also on Copilot
// Sourced from cursor-pricing.json
const CURSOR_RATES: Record<
  string,
  { input: number; cacheRead: number; output: number }
> = {
  "gpt-5.4": { input: 2.5, cacheRead: 0.25, output: 15.0 },
  "gpt-5.2": { input: 1.75, cacheRead: 0.175, output: 14.0 },
  "gpt-5.1-codex": { input: 1.25, cacheRead: 0.125, output: 10.0 },
  "gpt-5-mini": { input: 0.25, cacheRead: 0.025, output: 2.0 },
  "claude-sonnet-4.6": { input: 3.0, cacheRead: 0.3, output: 15.0 },
  "claude-sonnet-4.5": { input: 3.0, cacheRead: 0.3, output: 15.0 },
  "claude-sonnet-4": { input: 3.0, cacheRead: 0.3, output: 15.0 },
  "claude-opus-4.6": { input: 5.0, cacheRead: 0.5, output: 25.0 },
  "claude-opus-4.5": { input: 5.0, cacheRead: 0.5, output: 25.0 },
  "claude-haiku-4.5": { input: 1.0, cacheRead: 0.1, output: 5.0 },
  "gemini-3-flash": { input: 0.5, cacheRead: 0.05, output: 3.0 },
  "gemini-3-pro": { input: 2.0, cacheRead: 0.2, output: 12.0 },
  "gemini-3.1-pro": { input: 2.0, cacheRead: 0.2, output: 12.0 },
  "grok-code-fast-1": { input: 0.2, cacheRead: 0.02, output: 1.5 },
};

function cursorTokenCost(
  model: string,
  usage: ModelMetrics["usage"]
): number | null {
  const rates = CURSOR_RATES[model];
  if (!rates) return null;
  return (
    (usage.inputTokens * rates.input) / 1_000_000 +
    (usage.cacheReadTokens * rates.cacheRead) / 1_000_000 +
    (usage.outputTokens * rates.output) / 1_000_000
  );
}

// ── Parse ────────────────────────────────────────────────────────────

const dir = dirname(new URL(import.meta.url).pathname);
const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));

const sessions: ParsedSession[] = [];

for (const file of files) {
  const lines = readFileSync(join(dir, file), "utf-8")
    .split("\n")
    .filter(Boolean);

  let start: SessionStart | undefined;
  let shutdown: SessionShutdown | undefined;

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.type === "session.start") start = event;
      if (event.type === "session.shutdown") shutdown = event;
    } catch {
      // skip malformed lines
    }
  }

  const sessionId = start?.data.sessionId ?? file.replace(".jsonl", "");
  sessions.push({ sessionId, file, start, shutdown });
}

// ── Report ───────────────────────────────────────────────────────────

const $ = (n: number) => `$${n.toFixed(2)}`;
const tok = (n: number) => n.toLocaleString();

console.log("═══════════════════════════════════════════════════════════════════");
console.log("  GitHub Copilot CLI — Session Usage & Cross-Platform Comparison");
console.log("═══════════════════════════════════════════════════════════════════\n");

console.log(`Total session files: ${sessions.length}`);
console.log(
  `Sessions with shutdown data: ${sessions.filter((s) => s.shutdown).length}`
);
console.log(
  `Sessions without shutdown (interrupted): ${sessions.filter((s) => !s.shutdown).length}\n`
);

// ── Per-session detail with cost comparison ──────────────────────────

console.log("───────────────────────────────────────────────────────────────────");
console.log("  Per-Session Breakdown (with Cursor cost comparison)");
console.log("───────────────────────────────────────────────────────────────────\n");

const sessionsWithData = sessions
  .filter((s) => s.shutdown)
  .sort((a, b) => a.shutdown!.timestamp.localeCompare(b.shutdown!.timestamp));

const sessionsWithTokens = sessionsWithData.filter(
  (s) => Object.keys(s.shutdown!.data.modelMetrics).length > 0
);

for (const s of sessionsWithData) {
  const sd = s.shutdown!.data;
  const date = s.shutdown!.timestamp.slice(0, 10);
  const repo = s.start?.data.context?.repository ?? "unknown";
  const duration = sd.totalApiDurationMs
    ? `${(sd.totalApiDurationMs / 1000 / 60).toFixed(1)} min`
    : "n/a";

  console.log(`Session: ${s.sessionId.slice(0, 8)}…`);
  console.log(`  Date:       ${date}`);
  console.log(`  Repository: ${repo}`);
  console.log(`  Duration:   ${duration} (API time)`);
  console.log(`  Premium Requests: ${sd.totalPremiumRequests}`);
  console.log(
    `  Code Changes: +${sd.codeChanges.linesAdded} / -${sd.codeChanges.linesRemoved} (${sd.codeChanges.filesModified.length} files)`
  );

  if (Object.keys(sd.modelMetrics).length === 0) {
    console.log("  (no model usage — session opened and closed)\n");
    continue;
  }

  let sessionCursorCost = 0;
  let hasCursorRates = true;

  for (const [model, metrics] of Object.entries(sd.modelMetrics)) {
    const u = metrics.usage;
    const totalTokens = u.inputTokens + u.outputTokens + u.cacheReadTokens;
    const cacheRate =
      u.inputTokens + u.cacheReadTokens > 0
        ? ((u.cacheReadTokens / (u.inputTokens + u.cacheReadTokens)) * 100).toFixed(1)
        : "0";

    console.log(`  Model: ${model}`);
    console.log(`    Requests:      ${metrics.requests.count} API calls → ${metrics.requests.cost} premium req`);
    console.log(`    Input:         ${tok(u.inputTokens)} tokens`);
    console.log(`    Output:        ${tok(u.outputTokens)} tokens`);
    console.log(`    Cache Read:    ${tok(u.cacheReadTokens)} tokens (${cacheRate}% hit rate)`);
    console.log(`    Total:         ${tok(totalTokens)} tokens`);

    const cursorCost = cursorTokenCost(model, u);
    if (cursorCost !== null) {
      sessionCursorCost += cursorCost;
      console.log(`    ↳ Cursor cost: ${$(cursorCost)} (at per-token API rates)`);
    } else {
      hasCursorRates = false;
      console.log(`    ↳ Cursor cost: n/a (no matching model)`);
    }

    const multiplier = COPILOT_MULTIPLIERS[model];
    if (multiplier !== undefined) {
      console.log(`    ↳ Copilot:     ${multiplier}x multiplier → ${$(multiplier * 0.04)}/req overage`);
    }
  }

  if (hasCursorRates && sd.totalPremiumRequests > 0) {
    console.log(`  ──────────────────────────────────────────────────`);
    console.log(`  Copilot amortized session cost:`);
    for (const p of COPILOT_PLANS) {
      if (p.premiumRequests === 0) continue;
      const amortized =
        (sd.totalPremiumRequests / p.premiumRequests) * p.monthlyCost;
      console.log(
        `    ${p.name.padEnd(5)} (${sd.totalPremiumRequests}/${p.premiumRequests}) × ${$(p.monthlyCost)} = ${$(amortized)}`
      );
    }
    const overageCost = sd.totalPremiumRequests * 0.04;
    console.log(
      `    Overage: ${sd.totalPremiumRequests} × $0.04 = ${$(overageCost)}`
    );
    console.log(`  Cursor API cost: ${$(sessionCursorCost)}`);
    // Use Pro amortized as the primary comparison
    const proAmortized =
      (sd.totalPremiumRequests / 300) * 10;
    const ratio = sessionCursorCost / proAmortized;
    console.log(
      `  Cursor/Copilot ratio: ${ratio.toFixed(0)}x (vs Copilot Pro amortized)`
    );
  }
  console.log();
}

// ── Aggregate totals ─────────────────────────────────────────────────

console.log("───────────────────────────────────────────────────────────────────");
console.log("  Aggregate Totals");
console.log("───────────────────────────────────────────────────────────────────\n");

interface Aggregate {
  requests: number;
  premiumCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  sessions: number;
}

const byModel: Record<string, Aggregate> = {};

for (const s of sessionsWithData) {
  const sd = s.shutdown!.data;

  for (const [model, metrics] of Object.entries(sd.modelMetrics)) {
    if (!byModel[model]) {
      byModel[model] = {
        requests: 0,
        premiumCost: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        sessions: 0,
      };
    }
    const agg = byModel[model];
    agg.requests += metrics.requests.count;
    agg.premiumCost += metrics.requests.cost;
    agg.inputTokens += metrics.usage.inputTokens;
    agg.outputTokens += metrics.usage.outputTokens;
    agg.cacheReadTokens += metrics.usage.cacheReadTokens;
    agg.cacheWriteTokens += metrics.usage.cacheWriteTokens;
    agg.sessions++;
  }
}

let totalCursorCost = 0;

for (const [model, agg] of Object.entries(byModel)) {
  const totalTokens = agg.inputTokens + agg.outputTokens + agg.cacheReadTokens;
  const cacheHitRate =
    agg.inputTokens + agg.cacheReadTokens > 0
      ? ((agg.cacheReadTokens / (agg.inputTokens + agg.cacheReadTokens)) * 100).toFixed(1)
      : "0";

  const cursorCost = cursorTokenCost(model, {
    inputTokens: agg.inputTokens,
    outputTokens: agg.outputTokens,
    cacheReadTokens: agg.cacheReadTokens,
    cacheWriteTokens: agg.cacheWriteTokens,
  });

  if (cursorCost !== null) totalCursorCost += cursorCost;

  console.log(`Model: ${model}`);
  console.log(`  Sessions:       ${agg.sessions}`);
  console.log(`  API Requests:   ${agg.requests}`);
  console.log(`  Premium Reqs:   ${agg.premiumCost}`);
  console.log(`  Input:          ${tok(agg.inputTokens)} tokens`);
  console.log(`  Output:         ${tok(agg.outputTokens)} tokens`);
  console.log(`  Cache Read:     ${tok(agg.cacheReadTokens)} tokens`);
  console.log(`  Total:          ${tok(totalTokens)} tokens`);
  console.log(`  Cache Hit Rate: ${cacheHitRate}%`);
  if (cursorCost !== null) {
    console.log(`  Cursor Cost:    ${$(cursorCost)}`);
  }
  console.log();
}

// ── Monthly projection ───────────────────────────────────────────────

console.log("───────────────────────────────────────────────────────────────────");
console.log("  Monthly Cost Projection (extrapolated from observed data)");
console.log("───────────────────────────────────────────────────────────────────\n");

if (sessionsWithTokens.length === 0) {
  console.log("  Not enough session data with token metrics to project.\n");
} else {
  // Calculate observed averages (only from sessions with actual usage)
  const activePremium = sessionsWithTokens.reduce(
    (sum, s) => sum + s.shutdown!.data.totalPremiumRequests,
    0
  );
  const avgPremiumPerSession = activePremium / sessionsWithTokens.length;
  const avgCursorCostPerSession =
    totalCursorCost / sessionsWithTokens.length;

  // Extrapolate for different usage levels
  const scenarioSessions = [10, 30, 60, 100, 200];

  // Amortized per-session unit cost
  const copilotProUnitCost = avgPremiumPerSession * (10 / 300);
  const copilotPlusUnitCost = avgPremiumPerSession * (39 / 1500);
  const copilotOverageUnitCost = avgPremiumPerSession * 0.04;

  console.log("  Assumptions:");
  console.log(`    Avg premium requests/session: ${avgPremiumPerSession.toFixed(2)}`);
  console.log(`    Avg Cursor API cost/session:  ${$(avgCursorCostPerSession)}`);
  console.log(`    Based on ${sessionsWithTokens.length} session(s) with token data\n`);

  console.log("  Amortized per-session unit cost:");
  console.log(`    Copilot Pro:   ${$(copilotProUnitCost)}  (prem_reqs/300 × $10)`);
  console.log(`    Copilot Pro+:  ${$(copilotPlusUnitCost)}  (prem_reqs/1500 × $39)`);
  console.log(`    Copilot Over:  ${$(copilotOverageUnitCost)}  (prem_reqs × $0.04)`);
  console.log(`    Cursor (token): ${$(avgCursorCostPerSession)}`);
  if (avgCursorCostPerSession > 0 && copilotProUnitCost > 0) {
    console.log(`    → Cursor is ${(avgCursorCostPerSession / copilotProUnitCost).toFixed(0)}x more expensive per session (vs Copilot Pro)\n`);
  }

  console.log("  ⚠  Very limited data — treat as rough order-of-magnitude only.\n");

  // Table header — Total Monthly Cost (subscription + overage)
  const pad = (s: string, w: number) => s.padEnd(w);
  const rpad = (s: string, w: number) => s.padStart(w);

  console.log("  Total monthly cost (subscription + overage):\n");
  console.log(
    `  ${pad("Sessions", 10)} │ ${pad("Copilot Free", 14)} │ ${pad("Copilot Pro", 14)} │ ${pad("Copilot Pro+", 14)} │ ${pad("Cursor Pro", 14)} │ ${pad("Cursor Pro+", 14)} │ ${pad("Cursor Ultra", 14)}`
  );
  console.log("  " + "─".repeat(10) + "─┼─" + "─".repeat(14) + "─┼─" + "─".repeat(14) + "─┼─" + "─".repeat(14) + "─┼─" + "─".repeat(14) + "─┼─" + "─".repeat(14) + "─┼─" + "─".repeat(14));

  for (const nSessions of scenarioSessions) {
    const premiumReqs = nSessions * avgPremiumPerSession;
    const cursorApiCost = nSessions * avgCursorCostPerSession;

    // Copilot costs (subscription + overage beyond allowance)
    const copilotCosts = COPILOT_PLANS.map((p) => {
      const overage = Math.max(0, premiumReqs - p.premiumRequests);
      const overageCost = overage * p.overageRate;
      if (!isFinite(overageCost)) return "n/a";
      return $(p.monthlyCost + overageCost);
    });

    // Cursor costs (subscription + overage beyond pool)
    const cursorCosts = CURSOR_PLANS.map((p) => {
      const overage = Math.max(0, cursorApiCost - p.apiPool);
      return $(p.monthlyCost + overage);
    });

    console.log(
      `  ${rpad(String(nSessions), 10)} │ ${rpad(copilotCosts[0], 14)} │ ${rpad(copilotCosts[1], 14)} │ ${rpad(copilotCosts[2], 14)} │ ${rpad(cursorCosts[0], 14)} │ ${rpad(cursorCosts[1], 14)} │ ${rpad(cursorCosts[2], 14)}`
    );
  }

  console.log();

  // Breakeven analysis
  console.log("───────────────────────────────────────────────────────────────────");
  console.log("  Breakeven Analysis");
  console.log("───────────────────────────────────────────────────────────────────\n");

  console.log("  At what point does Copilot become cheaper than Cursor?");
  console.log("  (comparing cheapest Copilot plan vs. cheapest Cursor plan)\n");

  console.log("  Key insight: Copilot charges per REQUEST (flat), Cursor charges");
  console.log("  per TOKEN (proportional to usage). Heavy-token sessions favor");
  console.log("  Copilot; many light sessions favor Cursor.\n");

  if (avgCursorCostPerSession > 0) {
    // Copilot Pro ($10 + $0.04/overage) vs Cursor Pro ($20 + overage at token rates)
    // Copilot Pro total = $10 + max(0, N*avgPrem - 300) * $0.04
    // Cursor Pro total  = $20 + max(0, N*avgCursorCost - $20)
    // They cross when Copilot total = Cursor total

    console.log(`  Your observed session profile:`);
    console.log(`    ~${tok(Math.round(avgCursorCostPerSession / 0.0025 * 1000))} tokens/session (weighted)`);
    console.log(`    ${$(avgCursorCostPerSession)} Cursor cost/session`);
    console.log(`    ${avgPremiumPerSession.toFixed(2)} premium requests/session\n`);

    // At these rates, how many sessions until Cursor Pro pool is exhausted?
    const cursorProSessions = Math.floor(20 / avgCursorCostPerSession);
    const copilotProSessions = Math.floor(300 / avgPremiumPerSession);
    console.log(`  Copilot Pro: ${copilotProSessions} sessions before overage ($10/mo, 300 prem reqs)`);
    console.log(`  Cursor Pro:  ${cursorProSessions} sessions before overage ($20/mo, $20 API pool)`);
    console.log(`  → Copilot gives ${(copilotProSessions / Math.max(cursorProSessions, 1)).toFixed(0)}x more sessions before overage at half the price\n`);

    const copilotPlusSessions = Math.floor(1500 / avgPremiumPerSession);
    const cursorPlusSessions = Math.floor(70 / avgCursorCostPerSession);
    console.log(`  Copilot Pro+: ${copilotPlusSessions} sessions before overage ($39/mo, 1500 prem reqs)`);
    console.log(`  Cursor Pro+:  ${cursorPlusSessions} sessions before overage ($60/mo, $70 API pool)`);
    console.log(`  → Copilot gives ${(copilotPlusSessions / Math.max(cursorPlusSessions, 1)).toFixed(0)}x more sessions at 65% of the price\n`);
  }
}

// ── Fundamental model comparison ─────────────────────────────────────

console.log("───────────────────────────────────────────────────────────────────");
console.log("  Pricing Model Comparison: Request-Based vs Token-Based");
console.log("───────────────────────────────────────────────────────────────────\n");

console.log("  Copilot (request-based):  Fixed cost per interaction.");
console.log("  Cursor  (token-based):    Cost scales with context size.\n");

console.log("  Copilot wins when:");
console.log("    • Sessions consume many tokens (large context, research, agents)");
console.log("    • You use models with low multipliers (0-1x)");
console.log("    • Sessions involve heavy tool use (many API calls = 1 premium req)\n");

console.log("  Cursor wins when:");
console.log("    • Sessions are short/light (small prompts, quick completions)");
console.log("    • You value per-model cost transparency");
console.log("    • You use models Copilot charges high multipliers for (Opus 3x)\n");

console.log("  Copilot blindspots (usage not captured here):");
console.log("    • GitHub cloud agents (Copilot Workspace)");
console.log("    • Code review premium requests");
console.log("    • Copilot Spark (4 reqs/prompt)");
console.log("    • IDE chat/completions (if also using VS Code/Cursor)\n");

// ── Incomplete sessions ──────────────────────────────────────────────

const incomplete = sessions.filter((s) => !s.shutdown);
if (incomplete.length > 0) {
  console.log("───────────────────────────────────────────────────────────────────");
  console.log("  Sessions Without Shutdown Data (interrupted — no token data)");
  console.log("───────────────────────────────────────────────────────────────────\n");

  for (const s of incomplete) {
    const date = s.start?.timestamp.slice(0, 10) ?? "unknown";
    const repo = s.start?.data.context?.repository ?? "unknown";
    const version = s.start?.data.copilotVersion ?? "unknown";
    console.log(
      `  ${s.sessionId.slice(0, 8)}…  ${date}  ${repo}  (v${version})`
    );
  }
  console.log();
}

console.log("═══════════════════════════════════════════════════════════════════");
