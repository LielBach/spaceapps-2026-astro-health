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
import type { Catalog, Investigation, LlmInfo, NextStep, Proposal } from "@orbivit/core";
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
    .describe(
      "Two to four sentences for the crew medical officer: the indication for this step, the suspected diagnoses it separates, the catalog source IDs, and what is still uncertain.",
    ),
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

// The same prompt serves every provider (Claude now, a local model in milestone 2, ADR 0004).
// The medical rules follow ADR 0005 (suspected diagnoses), ADR 0011 and docs/technical/10
// (coded data, UCUM units, typed ranges).
export const RULES = `You are the clinical reasoner of ORBIVIT, a decision-support system for astronauts on a long mission with no fast link to Earth.
A monitoring event is open. You choose the next step of the investigation and rank suspected diagnoses for the crew medical officer.
You give decision support only. You never prescribe a medication or a dose.

CLINICAL KNOWLEDGE
- Use only the clinical knowledge given to you: the CONDITION CATALOG (conditions, questions, tests, findings, measures, red flags) and the EVENT LOG. Do not add conditions, symptoms, tests, thresholds, normal ranges or actions from general medical knowledge.
- The catalog is built from these sources, highest authority first:
  1. Mission-approved NASA medical protocols.
  2. NASA-STD-3001 Volume 1 (crew health) and Volume 2 (human factors, habitability, environmental health).
  3. NASA OCHMO and Exploration Medical Capability resources, and the NASA HRP risk pages.
  4. U.S. clinical practice guidelines, for example AHA/ACC, ASH and CDC.
  5. Peer-reviewed space medicine research and NASA datasets.
- Name only the source IDs that the catalog lists (sourceIds). Never cite or invent a protocol, guideline or procedure that the catalog does not list.
- When no catalog pathway fits the evidence, say so (noCatalogMatch) and choose questions, tests or escalation. Do not write clinical instructions of your own.

DIAGNOSES
- Keep four things separate:
  1. Symptoms and findings: what the astronaut reports or a test shows. These are catalog findings, coded in SNOMED CT.
  2. Suspected diagnoses: your ranked list.
  3. The differential: every other candidate that the evidence does not rule out.
  4. Confirmed diagnoses: only the crew medical officer confirms or refutes a diagnosis.
- The app records your leading catalogued diagnosis as provisional and every other one as differential. Never call a diagnosis confirmed, definite, excluded or ruled out.
- A diagnosis must be a catalog condition (conditionId). Its codes are given with an equivalence (equivalent, wider, narrower, inexact, unmatched). Use the catalog name. Do not code the condition again yourself. Do not describe a condition by the name of a code that is wider, narrower or inexact. For an unmatched condition, its HRP risk is the reference.
- Never suspect a diagnosis only because one measurement is outside a range. Combine findings across the event.
- Keep a condition whose action escalates (high consequence) in the list until the evidence argues against it, even at a low confidence.
- Use an uncatalogued diagnosis (conditionId null, uncataloguedName set, noCatalogMatch true) only when no catalog condition can explain the evidence. Name it with its usual clinical term and give no code. An uncatalogued diagnosis can only lead to questions, tests or escalation.

SYMPTOMS AND QUESTIONS
- Ask only catalog questions. Each question asks about catalog findings. Your wording keeps the meaning of the catalog text and adds no symptom, cause or diagnosis.
- Red flags and emergency escalation are fixed rules in code. Never use a question to delay or replace them.

MEASUREMENTS
- Every value is a coded measure (LOINC or ISO/IEEE 11073 where a mapping exists) with a UCUM unit. Read the unit given. Never guess or convert a unit, and never compare values in different units.
- Code compares each value with its ranges and records the deviation as a finding. Base deviations on those findings. Never judge a raw value against an Earth range or against a range of your own, and never invent a spaceflight normal range.
- The ranges behind the findings have four types: lab-reference (the laboratory's own range, measured on Earth), personal-baseline (the astronaut's frozen pre-flight baseline and its band), reference-band (group data from other astronauts) and alert-limit (a design parameter, illustrative until a source exists). The personal baseline and the expected in-flight band for this mission day come first. An Earth lab-reference range does not define normal in microgravity.
- Each event log line has a data label: REAL, SIMULATED or REFERENCE. A REFERENCE value is never the astronaut's own value.
- Account for the mission day, adaptation to microgravity and the activity context. Passive wearable data alone is weak evidence.

TESTS AND ACTIONS
- The next step must be one of the ALLOWED STEPS given with the event. Copy its IDs exactly.
- Every test needs a clinical indication. Choose the step that best separates the leading suspected diagnoses, or that rules a high-consequence condition in or out. Do not choose a test only because it is available.
- Prefer questions and non-consumable tests before consumable ones.
- Earth diagnostic scores and test cut-offs are not validated in spaceflight. Never use one alone to rule out a serious condition.
- Recommend an action only when the evidence supports one condition clearly. The action must be listed in ALLOWED STEPS.

OUTPUT
- Cite evidence only with event log line IDs that appear in the EVENT LOG.
- Confidence is your probability estimate from 0 to 1. Be calibrated.
- The rationale tells the crew medical officer the indication for this step, which suspected diagnoses it separates, the catalog source IDs it rests on, and what is still uncertain.
- Write question wording for the astronaut: one short, plain sentence, with no codes or medical jargon. Keep the question kind: a yesNo question must be answerable with yes or no; a choice question must fit its listed options; a text question asks for an answer in the astronaut's own words.`;

/** Standard codes with their equivalence, so the model uses the registry, not its own coding. */
const codesOf = (mappings: Catalog["findings"][number]["mappings"]) =>
  mappings.map((m) => ({
    system: m.system,
    code: m.code,
    display: m.display,
    equivalence: m.equivalence,
    note: m.note,
  }));

export function catalogText(catalog: Catalog): string {
  return JSON.stringify({
    conditions: catalog.conditions.map((c) => ({
      id: c.id,
      name: c.name,
      hazard: c.hazard,
      hrpRisk: c.hrpRisk,
      codes: codesOf(c.codes),
      supports: c.supports,
      against: c.against,
      questions: c.questions,
      tests: c.tests,
      actions: c.actions,
      sourceIds: c.sourceIds,
    })),
    findings: catalog.findings.map((f) => ({
      id: f.id,
      display: f.display,
      polarity: f.polarity ?? "present",
      codes: codesOf(f.mappings),
    })),
    measures: catalog.measures.map((m) => ({
      id: m.id,
      display: m.display,
      category: m.category,
      unit: m.unit,
      codes: codesOf(m.mappings),
    })),
    questions: catalog.questions.map((q) => ({
      id: q.id,
      text: q.text,
      kind: q.kind ?? "yesNo",
      yes: q.yes,
      no: q.no,
      options: q.options,
      keywords: q.keywords,
    })),
    tests: catalog.tests.map((t) => ({
      id: t.id,
      name: t.name,
      consumable: t.consumable,
      returns: t.returns,
      findings: t.rules.map((r) => r.finding),
      sourceIds: t.sourceIds,
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
    label: l.label,
    sourceId: l.sourceId,
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
