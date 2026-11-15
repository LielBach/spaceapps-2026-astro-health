// Clinical reasoner through the AI SDK (plan §5.5, ADR 0006, ADR 0010).
// The LLM proposes; the Investigation engine validates every proposal against the guardrails.
import { createAnthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  generateText,
  NoObjectGeneratedError,
  Output,
  type LanguageModel,
  type ModelMessage,
  type SystemModelMessage,
} from "ai";
import { z } from "zod";
import {
  SYSTEM_NAMES,
  type Catalog,
  type Investigation,
  type LlmInfo,
  type NextStep,
  type Proposal,
} from "@orbivit/core";
import { ReasonerOutputError, type Reasoner, type Reasoners } from "./session.ts";

export interface LlmConfig {
  /** The reasoner when the link to Earth is up. */
  provider: LlmInfo["provider"];
  model: string;
  effort: NonNullable<AnthropicLanguageModelOptions["effort"]>;
  /** The offline model (ADR 0004): used during a comm blackout, or always with LLM_PROVIDER=ollama. */
  offlineModel: string | undefined;
  /** gpt-oss reasoning effort (low|medium|high); other models ignore it. */
  offlineReasoning: string | undefined;
  ollamaBaseUrl: string;
  /** The context length Ollama runs with (OLLAMA_CONTEXT_LENGTH); the reasoner warns near it. */
  contextTokens: number;
  timeoutMs: number;
}

/**
 * LLM_PROVIDER=anthropic|ollama|none. Without a provider setting, use Claude only when a key exists.
 * OFFLINE_LLM_MODEL adds the offline model for blackouts; LLM_PROVIDER=ollama makes it the only one.
 */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  const provider = (env.LLM_PROVIDER ||
    (env.ANTHROPIC_API_KEY ? "anthropic" : "none")) as LlmInfo["provider"];
  if (!["anthropic", "ollama", "none"].includes(provider))
    throw new Error(`unknown LLM_PROVIDER ${provider}`);
  const offlineModel = env.OFFLINE_LLM_MODEL || (provider === "ollama" ? env.LLM_MODEL : undefined);
  if (provider === "ollama" && !offlineModel)
    throw new Error("LLM_PROVIDER=ollama needs OFFLINE_LLM_MODEL (for example medgemma:27b)");
  return {
    provider,
    model: provider === "ollama" ? (offlineModel ?? "") : env.LLM_MODEL || "claude-opus-5-5",
    effort: (env.LLM_EFFORT as LlmConfig["effort"] | undefined) || "medium",
    offlineModel,
    offlineReasoning: env.OFFLINE_LLM_REASONING || undefined,
    ollamaBaseUrl: env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1",
    contextTokens: Number(env.OLLAMA_CONTEXT_LENGTH || 32768),
    timeoutMs: Number(env.REASONER_TIMEOUT_MS || 90_000),
  };
}

/** The offline model through Ollama's OpenAI-compatible endpoint, with JSON-schema output. */
export function offlineReasoner(config: LlmConfig, onCall?: ReasonerOptions["onCall"]) {
  if (!config.offlineModel) return undefined;
  const info: LlmInfo = { provider: "ollama", model: config.offlineModel };
  const ollama = createOpenAICompatible({
    name: "ollama",
    baseURL: config.ollamaBaseUrl,
    supportsStructuredOutputs: true,
  });
  const reasoner = createLlmReasoner(ollama(config.offlineModel), info, {
    providerOptions: config.offlineReasoning
      ? { ollama: { reasoningEffort: config.offlineReasoning } }
      : {},
    timeoutMs: config.timeoutMs,
    contextTokens: config.contextTokens,
    constrained: true,
    onCall,
  });
  return { reasoner, info };
}

/** Startup check: is Ollama running, and does it have the offline model? Returns a log line. */
export async function checkOllama(config: LlmConfig): Promise<string> {
  const root = config.ollamaBaseUrl.replace(/\/v1\/?$/, "");
  try {
    const response = await fetch(`${root}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const { models } = (await response.json()) as { models: { name: string }[] };
    const names = models.map((m) => m.name);
    const want = config.offlineModel ?? "";
    const found = names.includes(want) || names.includes(`${want}:latest`);
    return found
      ? `Offline model ready: ${want}`
      : `WARNING: Ollama has no model ${want}. Run: ollama pull ${want}. Installed: ${names.join(", ") || "none"}`;
  } catch {
    return `WARNING: Ollama is not reachable at ${root}. Start it with: OLLAMA_CONTEXT_LENGTH=${config.contextTokens} ollama serve`;
  }
}

/** Builds the reasoners for a config. With none, the session uses the no-LLM fallback. */
export function reasonerFromConfig(
  config: LlmConfig,
  onCall?: ReasonerOptions["onCall"],
): Reasoners {
  const offline = offlineReasoner(config, onCall);
  if (config.provider === "ollama") return { primary: offline, offline };
  if (config.provider !== "anthropic") return { offline };
  const info: LlmInfo = { provider: "anthropic", model: config.model };
  const anthropic = createAnthropic();
  const reasoner = createLlmReasoner(anthropic(config.model), info, {
    providerOptions: {
      // Refusal fallbacks: the API reroutes a classifier-blocked turn to a recommended model.
      anthropic: {
        effort: config.effort,
        fallbacks: "default",
      } satisfies AnthropicLanguageModelOptions,
    },
    timeoutMs: config.timeoutMs,
    onCall,
  });
  return { primary: { reasoner, info }, offline };
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

/**
 * The same proposal with size limits, for small offline models: without them, a 4B model lists every
 * catalog condition and runs out of output tokens. Ollama enforces the limits in its JSON grammar.
 */
export const CompactProposalSchema = ProposalSchema.extend({
  rationale: z.string().max(400).describe("One or two short sentences: why this step now."),
  diagnoses: z
    .array(
      ProposalSchema.shape.diagnoses.element.extend({
        evidenceFor: z.array(z.string()).max(4).describe("Event log line IDs that support it."),
        evidenceAgainst: z
          .array(z.string())
          .max(4)
          .describe("Event log line IDs that argue against it."),
      }),
    )
    .max(3)
    .describe("At most three suspected diagnoses, most likely first."),
});

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

const RULES = `You are the clinical reasoner of ORBIVIT, a decision-support system for astronauts on a long mission with no fast link to Earth.
A passive monitoring event is open. You choose the next step of the investigation and rank suspected diagnoses for the crew medical officer.

Rules:
- You give decision support only. Diagnoses are suspected, for crew medical officer confirmation. Never prescribe a medication or a dose.
- The next step must be one of the ALLOWED STEPS given with the event. Copy its IDs exactly.
- Prefer the step that best separates the leading suspected diagnoses. Prefer questions and non-consumable tests before consumable ones.
- Recommend an action only when the evidence supports one condition clearly; the action must be listed in ALLOWED STEPS.
- Diagnoses must be catalog conditions (conditionId). Use an uncatalogued diagnosis (conditionId null, uncataloguedName set, noCatalogMatch true) only when no catalog condition can explain the evidence. An uncatalogued diagnosis can only lead to questions, tests or escalation.
- Cite evidence only with event log line IDs that appear in the EVENT LOG.
- Confidence is your probability estimate from 0 to 1. Be calibrated: passive wearable data alone is weak evidence.
- Write question wording for the astronaut: one short, plain sentence. Keep the question kind: a yesNo question must be answerable with yes or no; a choice question must fit its listed options; a text question asks for an answer in the astronaut's own words.`;

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
      findings: t.rules.map((r) => r.finding),
    })),
    redFlags: catalog.redFlags,
  });
}

/**
 * The standard meaning of every finding and measure the model reads (ADR 0011, doc 10). The model
 * answers with catalog IDs only; fhir.ts maps them to standard codes, so it never writes a code.
 */
export function terminologyText(catalog: Catalog): string {
  const used = new Set([
    ...catalog.conditions.flatMap((c) => [...c.supports, ...c.against]),
    ...catalog.questions.flatMap((q) => [...(q.yes ?? []), ...(q.no ?? [])]),
    ...catalog.tests.flatMap((t) => t.rules.map((r) => r.finding)),
    ...catalog.redFlags.map((r) => r.finding),
  ]);
  const standard = (mappings: Catalog["findings"][number]["mappings"]) => {
    const m = mappings.find((x) => x.code);
    return m ? `${SYSTEM_NAMES[m.system]} ${m.code}, ${m.equivalence}` : "no standard code";
  };
  const findings = catalog.findings
    .filter((f) => used.has(f.id))
    .map(
      (f) =>
        `${f.id}: ${f.display}${f.polarity === "absent" ? " (absent)" : ""} [${standard(f.mappings)}]`,
    );
  const returned = new Set(catalog.tests.flatMap((t) => t.returns));
  const unit = (code: string | undefined) =>
    catalog.units.find((u) => u.code === code)?.display ?? code;
  const measures = catalog.measures
    .filter((m) => returned.has(m.id))
    .map(
      (m) =>
        `${m.id}: ${m.display}${m.unit ? ` in ${unit(m.unit)} (UCUM ${m.unit})` : ""} [${standard(m.mappings)}]`,
    );
  return `FINDINGS:\n${findings.join("\n")}\n\nMEASURES (test results use these units):\n${measures.join("\n")}`;
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
      content: `${RULES}\n\nCONDITION CATALOG:\n${catalogText(inv.catalog)}\n\nTERMINOLOGY (standard meaning of each ID):\n${terminologyText(inv.catalog)}`,
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    messages: [{ role: "user", content: user }],
  };
}

/** One reasoner call, for the latency checks of the M2 evaluation (ADR 0004 criterion 3). */
export interface CallStats {
  eventId: string;
  ms: number;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  ok: boolean;
}

export interface ReasonerOptions {
  providerOptions?: Record<string, Record<string, unknown>> | undefined;
  /** Abort a call after this long, so a stuck local model cannot stop the replay. */
  timeoutMs?: number | undefined;
  /** The model's context length: warn when a prompt comes near it (Ollama truncates silently). */
  contextTokens?: number | undefined;
  onCall?: ((stats: CallStats) => void) | undefined;
  /** Small offline models: a compact schema whose ID fields allow only the IDs valid now. */
  constrained?: boolean | undefined;
}

const oneOf = (ids: string[]) =>
  ids.length > 0 ? z.enum([...new Set(ids)] as [string, ...string[]]) : z.string();

/**
 * The compact schema with every ID field limited to the IDs that are valid now: the allowed next
 * steps, the catalog conditions, the equipment list and the event log lines. Ollama turns the enums
 * into its output grammar, so a small model can only write valid IDs. The guardrails still run.
 */
export function constrainedSchema(inv: Investigation) {
  const allowed = inv.allowedSteps();
  const stepIds = allowed.flatMap((s) =>
    s.kind === "question" || s.kind === "test" ? [s.id] : [],
  );
  const actions = allowed.flatMap((s) => (s.kind === "action" ? [s] : []));
  const kinds = [...new Set(allowed.map((s) => s.kind))] as [
    NextStep["kind"],
    ...NextStep["kind"][],
  ];
  const evidence = oneOf(inv.log.map((l) => l.id));
  return CompactProposalSchema.extend({
    diagnoses: z
      .array(
        z.object({
          conditionId: oneOf(inv.catalog.conditions.map((c) => c.id))
            .nullable()
            .describe("Catalog condition ID, or null for an uncatalogued diagnosis."),
          uncataloguedName: z
            .string()
            .max(80)
            .nullable()
            .describe("Only when conditionId is null."),
          confidence: z.number().describe("0 to 1."),
          evidenceFor: z.array(evidence).max(4).describe("Event log line IDs that support it."),
          evidenceAgainst: z.array(evidence).max(4).describe("Event log line IDs against it."),
          confirmingTest: oneOf(inv.catalog.tests.map((t) => t.id)).nullable(),
        }),
      )
      .max(3)
      .describe("At most three suspected diagnoses, most likely first."),
    next: z.object({
      kind: z.enum(kinds),
      id: oneOf(stepIds).nullable().describe("Question or test ID for kind question or test."),
      conditionId: oneOf(actions.map((a) => a.conditionId)).nullable(),
      actionId: oneOf(actions.map((a) => a.actionId)).nullable(),
      reason: z.string().max(120).nullable().describe("Reason for kind escalate."),
    }),
  });
}

/**
 * A model may cite a finding ID where a log line ID is expected; map it to the log line that
 * recorded the finding. The guardrail still checks that every cited line exists.
 */
export function citeLogLines(proposal: Proposal, inv: Investigation): Proposal {
  const lineOf = new Map(inv.findings.map((f) => [f.id, f.logId]));
  const cite = (ids: string[]) => [...new Set(ids.map((id) => lineOf.get(id) ?? id))];
  return {
    ...proposal,
    diagnoses: proposal.diagnoses.map((d) => ({
      ...d,
      evidenceFor: cite(d.evidenceFor),
      evidenceAgainst: cite(d.evidenceAgainst),
    })),
  };
}

export function createLlmReasoner(
  model: LanguageModel,
  info: LlmInfo,
  options: ReasonerOptions = {},
): Reasoner {
  return async (inv, ctx) => {
    const started = Date.now();
    const call = (ok: boolean, inputTokens?: number, outputTokens?: number) =>
      options.onCall?.({
        eventId: inv.eventId,
        ms: Date.now() - started,
        inputTokens,
        outputTokens,
        ok,
      });
    try {
      const { output, usage } = await generateText({
        model,
        ...buildPrompt(inv, ctx.retryReasons),
        output: Output.object({
          schema: (options.constrained
            ? constrainedSchema(inv)
            : ProposalSchema) as typeof ProposalSchema,
        }),
        providerOptions: (options.providerOptions ?? {}) as never,
        maxOutputTokens: 16000,
        ...(options.timeoutMs ? { abortSignal: AbortSignal.timeout(options.timeoutMs) } : {}),
      });
      call(true, usage.inputTokens, usage.outputTokens);
      // One line per call, for latency and cost checks in the server log.
      console.log(
        `[reasoner] ${info.provider} ${info.model ?? ""} ${inv.eventId} ${Date.now() - started} ms` +
          ` · in ${usage.inputTokens ?? "?"} (cache read ${usage.inputTokenDetails.cacheReadTokens ?? 0},` +
          ` write ${usage.inputTokenDetails.cacheWriteTokens ?? 0}) · out ${usage.outputTokens ?? "?"}` +
          ` (reasoning ${usage.outputTokenDetails.reasoningTokens ?? 0}) · next ${output.next.kind}` +
          ` ${output.next.id ?? output.next.actionId ?? output.next.reason ?? ""}`,
      );
      if (options.contextTokens && (usage.inputTokens ?? 0) > 0.8 * options.contextTokens)
        console.warn(
          `[reasoner] prompt uses ${usage.inputTokens} of ${options.contextTokens} context tokens`,
        );
      return { proposal: citeLogLines(toProposal(output), inv), llm: info };
    } catch (error) {
      call(false);
      // Output that does not parse or fit the schema gets the guardrail retry (session.ts).
      if (NoObjectGeneratedError.isInstance(error))
        throw new ReasonerOutputError(`output did not match the schema: ${error.message}`);
      throw error;
    }
  };
}
