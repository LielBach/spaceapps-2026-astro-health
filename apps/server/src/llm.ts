// Clinical reasoner through the AI SDK (plan §5.5, ADR 0006, ADR 0010).
// The LLM proposes; the Investigation engine validates every proposal against the guardrails.
import { createAnthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import {
  generateText,
  Output,
  type LanguageModel,
  type ModelMessage,
  type SystemModelMessage,
} from "ai";
import { z } from "zod";
import type { Catalog, Investigation, LlmInfo, NextStep, Proposal } from "@astrohealth/core";
import type { Reasoner, ReasonerSetup } from "./session.ts";

export interface LlmConfig {
  provider: LlmInfo["provider"];
  model: string;
  effort: NonNullable<AnthropicLanguageModelOptions["effort"]>;
}

/** LLM_PROVIDER=anthropic|ollama|none. Without a provider setting, use Claude only when a key exists. */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  const provider = (env.LLM_PROVIDER ??
    (env.ANTHROPIC_API_KEY ? "anthropic" : "none")) as LlmInfo["provider"];
  if (!["anthropic", "ollama", "none"].includes(provider))
    throw new Error(`unknown LLM_PROVIDER ${provider}`);
  return {
    provider,
    model: env.LLM_MODEL ?? "claude-opus-5-5",
    effort: (env.LLM_EFFORT as LlmConfig["effort"] | undefined) ?? "medium",
  };
}

/** Builds the reasoner for a config. `none` returns undefined: the session uses the no-LLM fallback. */
export function reasonerFromConfig(config: LlmConfig): ReasonerSetup | undefined {
  // Milestone 2 adds the Ollama provider (ADR 0004). Until then, `ollama` means no LLM.
  if (config.provider !== "anthropic") return undefined;
  const info: LlmInfo = { provider: "anthropic", model: config.model };
  const anthropic = createAnthropic();
  const reasoner = createLlmReasoner(anthropic(config.model), info, {
    // Refusal fallbacks: the API reroutes a classifier-blocked turn to a recommended model.
    anthropic: {
      effort: config.effort,
      fallbacks: "default",
    } satisfies AnthropicLanguageModelOptions,
  });
  return { reasoner, info };
}

// ---------- Structured output ----------

/** Flat, nullable fields: simple for structured output on every provider. */
export const ProposalSchema = z.object({
  rationale: z
    .string()
    .describe("Two or three sentences for the crew medical officer: why this step now."),
  diagnoses: z
    .array(
      z.object({
        conditionId: z
          .string()
          .nullable()
          .describe("Catalog condition ID, or null for an uncatalogued diagnosis."),
        uncataloguedName: z
          .string()
          .nullable()
          .describe("Name of an uncatalogued diagnosis; null otherwise."),
        confidence: z.number().describe("0 to 1."),
        evidenceFor: z.array(z.string()).describe("Event log line IDs that support it."),
        evidenceAgainst: z.array(z.string()).describe("Event log line IDs that argue against it."),
        confirmingTest: z.string().nullable().describe("Test ID from the equipment list, or null."),
      }),
    )
    .describe("Suspected diagnoses, most likely first."),
  next: z.object({
    kind: z.enum(["question", "test", "action", "escalate"]),
    id: z.string().nullable().describe("Question or test ID for kind question or test."),
    conditionId: z.string().nullable().describe("Condition ID for kind action."),
    actionId: z.string().nullable().describe("Action ID for kind action."),
    reason: z.string().nullable().describe("Reason for kind escalate."),
  }),
  wording: z
    .string()
    .nullable()
    .describe("For a question: the words the astronaut sees on the tablet, short and plain."),
  noCatalogMatch: z
    .boolean()
    .describe("True only if no catalog condition can explain the evidence."),
});
export type ProposalOutput = z.infer<typeof ProposalSchema>;

export function toProposal(out: ProposalOutput): Proposal {
  const next: NextStep =
    out.next.kind === "question" || out.next.kind === "test"
      ? { kind: out.next.kind, id: out.next.id ?? "" }
      : out.next.kind === "action"
        ? {
            kind: "action",
            conditionId: out.next.conditionId ?? "",
            actionId: out.next.actionId ?? "",
          }
        : { kind: "escalate", reason: out.next.reason ?? "crew medical officer review" };
  return {
    diagnoses: out.diagnoses.map((d) => ({
      ref: d.conditionId
        ? { conditionId: d.conditionId }
        : { uncatalogued: { name: d.uncataloguedName ?? "Unnamed" } },
      confidence: d.confidence,
      evidenceFor: d.evidenceFor,
      evidenceAgainst: d.evidenceAgainst,
      confirmingTest: d.confirmingTest ?? undefined,
    })),
    next,
    wording: out.wording ?? undefined,
    noCatalogMatch: out.noCatalogMatch,
    rationale: out.rationale,
  };
}

// ---------- Prompt ----------

const RULES = `You are the clinical reasoner of AstroHealth, a decision-support system for astronauts on a long mission with no fast link to Earth.
A passive monitoring event is open. You choose the next step of the investigation and rank suspected diagnoses for the crew medical officer.

Rules:
- You give decision support only. Diagnoses are suspected, for crew medical officer confirmation. Never prescribe a medication or a dose.
- The next step must be one of the ALLOWED STEPS given with the event. Copy its IDs exactly.
- Prefer the step that best separates the leading suspected diagnoses. Prefer questions and non-consumable tests before consumable ones.
- Recommend an action only when the evidence supports one condition clearly; the action must be listed in ALLOWED STEPS.
- Diagnoses must be catalog conditions (conditionId). Use an uncatalogued diagnosis (conditionId null, uncataloguedName set, noCatalogMatch true) only when no catalog condition can explain the evidence. An uncatalogued diagnosis can only lead to questions, tests or escalation.
- Cite evidence only with event log line IDs that appear in the EVENT LOG.
- Confidence is your probability estimate from 0 to 1. Be calibrated: passive wearable data alone is weak evidence.
- Write question wording for the astronaut: one short, plain sentence.`;

function catalogText(catalog: Catalog): string {
  return JSON.stringify({
    conditions: catalog.conditions.map((c) => ({
      id: c.id,
      name: c.name,
      hazard: c.hazard,
      supports: c.supports,
      against: c.against,
      questions: c.questions,
      tests: c.tests,
      actions: c.actions,
    })),
    questions: catalog.questions.map((q) => ({ id: q.id, text: q.text, yes: q.yes, no: q.no })),
    tests: catalog.tests.map((t) => ({
      id: t.id,
      name: t.name,
      consumable: t.consumable,
      findings: t.rules.map((r) => r.finding),
    })),
    redFlags: catalog.redFlags,
  });
}

export function buildPrompt(
  inv: Investigation,
  retryReasons: string[] = [],
): { instructions: SystemModelMessage; messages: ModelMessage[] } {
  const log = inv.log.map((l) => ({
    id: l.id,
    day: l.missionDay,
    step: l.stepType,
    stepId: l.stepId,
    data: l.data,
  }));
  const findings = inv.findings.map((f) => ({ finding: f.id, origin: f.origin, logLine: f.logId }));
  const user = [
    `EVENT LOG:\n${JSON.stringify(log)}`,
    `FINDINGS (with the log line that recorded each):\n${JSON.stringify(findings)}`,
    `ALREADY ASKED: ${JSON.stringify(inv.asked)}\nALREADY TESTED: ${JSON.stringify(inv.tested)}`,
    `ALLOWED STEPS:\n${JSON.stringify(inv.allowedSteps())}`,
    retryReasons.length > 0
      ? `Your previous proposal was rejected by the guardrails:\n- ${retryReasons.join("\n- ")}\nFix these problems.`
      : "",
    "Propose the next step and the suspected diagnoses.",
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    // Rules and catalog are stable for the whole run: cache them (prefix match).
    instructions: {
      role: "system",
      content: `${RULES}\n\nCONDITION CATALOG:\n${catalogText(inv.catalog)}`,
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    messages: [{ role: "user", content: user }],
  };
}

export function createLlmReasoner(
  model: LanguageModel,
  info: LlmInfo,
  providerOptions: Record<string, Record<string, unknown>> = {},
): Reasoner {
  return async (inv, ctx) => {
    const started = Date.now();
    const { output, usage } = await generateText({
      model,
      ...buildPrompt(inv, ctx.retryReasons),
      output: Output.object({ schema: ProposalSchema }),
      providerOptions: providerOptions as never,
      maxOutputTokens: 16000,
    });
    // One line per call, for latency and cost checks in the server log.
    console.log(
      `[reasoner] ${inv.eventId} ${Date.now() - started} ms · in ${usage.inputTokens ?? "?"}` +
        ` (cache read ${usage.inputTokenDetails.cacheReadTokens ?? 0},` +
        ` write ${usage.inputTokenDetails.cacheWriteTokens ?? 0}) · out ${usage.outputTokens ?? "?"}` +
        ` (reasoning ${usage.outputTokenDetails.reasoningTokens ?? 0}) · next ${output.next.kind}` +
        ` ${output.next.id ?? output.next.actionId ?? output.next.reason ?? ""}`,
    );
    return { proposal: toProposal(output), llm: info };
  };
}
