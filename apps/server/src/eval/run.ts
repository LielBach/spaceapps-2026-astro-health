// M2 evaluation harness (doc 12, ADR 0004): runs the evaluation cases headless, scores each run
// from its FHIR Bundle, and prints the gate.
//   pnpm eval:offline --model medgemma:27b [--runs 10] [--case main-base] [--reasoning low]
//   pnpm eval:offline --provider anthropic --runs 3     (online reference)
//   pnpm eval:offline --provider none --runs 1          (no-LLM fallback floor)
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { scenarioPaths } from "../app.ts";
import { toFhirBundle } from "../fhir.ts";
import { configFromEnv, reasonerFromConfig, type CallStats } from "../llm.ts";
import { ReplaySession } from "../session.ts";
import { CASES } from "./cases.ts";
import {
  median,
  modelShare,
  pathwaySafety,
  percentile,
  readBundle,
  type Bundle,
  type Check,
} from "./score.ts";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const envFile = join(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const provider = (arg("provider") ?? "ollama") as "ollama" | "anthropic" | "none";
const reasoning = arg("reasoning");
const config = configFromEnv({
  ...process.env,
  LLM_PROVIDER: provider,
  ...(provider === "ollama"
    ? { OFFLINE_LLM_MODEL: arg("model") ?? process.env.OFFLINE_LLM_MODEL }
    : {}),
  ...(provider === "anthropic" ? { OFFLINE_LLM_MODEL: "", LLM_MODEL: arg("model") ?? "" } : {}),
  ...(reasoning ? { OFFLINE_LLM_REASONING: reasoning } : {}),
});
const calls: CallStats[] = [];
const reasoners = reasonerFromConfig(config, (s) => calls.push(s));
const agent = reasoners.primary
  ? `${reasoners.primary.info.provider} ${reasoners.primary.info.model}`
  : "rule-based fallback";

// Criterion 4: an offline run may reach only this machine. Any other host fails the run.
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const guardHits: string[] = [];
if (provider !== "anthropic") {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (!LOOPBACK.has(url.hostname)) {
      guardHits.push(url.host);
      return Promise.reject(new Error(`network guard: ${url.host} is not this machine`));
    }
    return realFetch(input, init);
  };
}

const only = arg("case");
const runsArg = arg("runs");
const runsDir = mkdtempSync(join(tmpdir(), "orbivit-eval-"));

interface RunResult {
  pass: boolean;
  checks: Check[];
  safety: Check;
  share: { model: number; total: number };
  rejected: number;
  callMs: number[];
  wallMs: number;
  error?: string;
}

async function runOnce(c: (typeof CASES)[number]): Promise<RunResult> {
  const session = new ReplaySession(scenarioPaths(c.scenario, runsDir), reasoners);
  for (const [q, text] of Object.entries(c.overrides)) session.override(q, text);
  const first = calls.length;
  const started = Date.now();
  try {
    for (let guard = 0; guard < 4000 && session.day < c.untilDay; guard++) {
      if (session.waiting) await session.autoStep();
      else await session.advance(Math.min(1, c.untilDay - session.day));
    }
  } catch (error) {
    return failed(c, String(error), Date.now() - started, first);
  }
  const run = readBundle(toFhirBundle(session.view()) as unknown as Bundle);
  const checks = c.expect(run);
  const safety = pathwaySafety(run, session.catalog);
  return {
    pass: checks.every((x) => x.pass) && safety.pass,
    checks,
    safety,
    share: modelShare(run, agent),
    rejected: run.rejected,
    callMs: calls.slice(first).map((s) => s.ms),
    wallMs: Date.now() - started,
  };
}

function failed(
  c: (typeof CASES)[number],
  error: string,
  wallMs: number,
  first: number,
): RunResult {
  const none: Check = { id: "run", pass: false, detail: error };
  return {
    pass: false,
    checks: [none],
    safety: none,
    share: { model: 0, total: 0 },
    rejected: 0,
    callMs: calls.slice(first).map((s) => s.ms),
    wallMs,
    error,
  };
}

const results: Record<string, { gating: boolean; passShare: number; runs: RunResult[] }> = {};
for (const c of CASES.filter((x) => !only || x.id === only)) {
  const n = Number(runsArg ?? (provider === "none" ? 1 : c.runs));
  results[c.id] = { gating: c.gating, passShare: c.passShare, runs: [] };
  for (let i = 0; i < n; i++) {
    const r = await runOnce(c);
    results[c.id]!.runs.push(r);
    const failedChecks = [...r.checks, r.safety]
      .filter((x) => !x.pass)
      .map((x) => `${x.id}: ${x.detail}`);
    console.log(
      `${c.id} run ${i + 1}/${n}: ${r.pass ? "PASS" : "FAIL"} · ${r.callMs.length} calls · ` +
        `median ${Math.round(median(r.callMs) / 100) / 10} s · model steps ${r.share.model}/${r.share.total}` +
        ` · rejected ${r.rejected}${failedChecks.length ? ` · ${failedChecks.join(" | ")}` : ""}`,
    );
  }
}

// ---------- Gate (ADR 0004, doc 12) ----------
const all = Object.values(results).flatMap((x) => x.runs);
const allMs = all.flatMap((r) => r.callMs);
const steps = all.reduce(
  (a, r) => ({ model: a.model + r.share.model, total: a.total + r.share.total }),
  {
    model: 0,
    total: 0,
  },
);
const rate = (id: string) => {
  const r = results[id];
  return r && r.runs.length > 0 ? r.runs.filter((x) => x.pass).length / r.runs.length : NaN;
};
const gate = {
  pathwaySafety: all.every((r) => r.safety.pass),
  agreement: Object.entries(results)
    .filter(([, r]) => r.gating)
    .every(([id, r]) => rate(id) >= r.passShare),
  latency: provider === "none" || median(allMs) <= 20_000,
  networkOff: provider === "anthropic" ? "n/a (online reference)" : guardHits.length === 0,
  modelShare: provider === "none" || steps.total === 0 ? "n/a" : steps.model / steps.total >= 0.9,
};
const summary = {
  date: new Date().toISOString(),
  agent,
  reasoning: reasoning ?? null,
  cases: Object.fromEntries(
    Object.entries(results).map(([id, r]) => [
      id,
      { gating: r.gating, passed: r.runs.filter((x) => x.pass).length, runs: r.runs.length },
    ]),
  ),
  latency: {
    calls: allMs.length,
    medianS: Math.round(median(allMs) / 100) / 10,
    p90S: Math.round(percentile(allMs, 90) / 100) / 10,
    meanEventMin:
      Math.round(all.reduce((a, r) => a + r.wallMs, 0) / Math.max(1, all.length) / 6000) / 10,
  },
  modelSteps: steps,
  rejected: all.reduce((a, r) => a + r.rejected, 0),
  guardHits,
  gate,
  pass: Object.values(gate).every(
    (v) => v === true || v === "n/a" || v === "n/a (online reference)",
  ),
};

const out = join(root, "eval", "results");
mkdirSync(out, { recursive: true });
const file = join(
  out,
  `${summary.date.replace(/[:.]/g, "-")}-${agent.replace(/[^a-z0-9.-]+/gi, "_")}${reasoning ? `-${reasoning}` : ""}.json`,
);
writeFileSync(file, JSON.stringify({ summary, results }, null, 2));

const cell = (id: string) => {
  const c = summary.cases[id];
  return c ? `${c.passed}/${c.runs}` : "–";
};
console.log(`\n${JSON.stringify(summary.gate)}\nresults: ${file}\n`);
console.log(
  "| Model | main-base | main-fever | main-chest-pain | secondary (report) | Median s/call | p90 s | Event min | Model steps | Rejected | Gate |",
);
console.log(
  `| ${agent}${reasoning ? ` (${reasoning})` : ""} | ${cell("main-base")} | ${cell("main-fever")} | ${cell("main-chest-pain")} | ${cell("secondary-base")} | ${summary.latency.medianS} | ${summary.latency.p90S} | ${summary.latency.meanEventMin} | ${steps.model}/${steps.total} | ${summary.rejected} | ${summary.pass ? "PASS" : "FAIL"} |`,
);
