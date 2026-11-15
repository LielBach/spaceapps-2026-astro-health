import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { Investigation, ruleBasedProposal } from "@orbivit/core";
import { scenarioPaths } from "./app.ts";
import {
  configFromEnv,
  createLlmReasoner,
  reasonerFromConfig,
  type ProposalOutput,
} from "./llm.ts";
import { ReplaySession, type Reasoner, type Reasoners, type ReasonerSetup } from "./session.ts";

const INFO = { provider: "anthropic", model: "mock" } as const;

/** A mock model that answers each call with the next output from `outputs` (the last one repeats). */
function mockModel(
  outputs: (ProposalOutput | Error | string | ((prompt: string) => ProposalOutput))[],
) {
  const prompts: string[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      const prompt = JSON.stringify(options.prompt);
      prompts.push(prompt);
      const next = outputs[Math.min(prompts.length - 1, outputs.length - 1)]!;
      if (next instanceof Error) throw next;
      const out = typeof next === "function" ? next(prompt) : next;
      return {
        content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out) }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 10, text: 10, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

const ask = (id: string, wording = `Wording for ${id}`): ProposalOutput => ({
  rationale: "Rule out red flags first.",
  diagnoses: [],
  next: { kind: "question", id, conditionId: null, actionId: null, reason: null },
  wording,
  noCatalogMatch: false,
});

/** A mock LLM that follows the fallback's order but ranks with confidences and writes wording. */
function followFallback(inv: () => Investigation) {
  return (): ProposalOutput => {
    const p = ruleBasedProposal(inv());
    const n = p.next;
    return {
      rationale: "Mock clinical reasoning.",
      diagnoses: p.diagnoses.map((d, i) => ({
        conditionId: "conditionId" in d.ref ? d.ref.conditionId : null,
        uncataloguedName: null,
        confidence: Math.max(0.05, 0.7 - i * 0.2),
        evidenceFor: d.evidenceFor,
        evidenceAgainst: d.evidenceAgainst,
        confirmingTest: d.confirmingTest ?? null,
      })),
      next: {
        kind: n.kind,
        id: n.kind === "question" || n.kind === "test" ? n.id : null,
        conditionId: n.kind === "action" ? n.conditionId : null,
        actionId: n.kind === "action" ? n.actionId : null,
        reason: n.kind === "escalate" ? n.reason : null,
      },
      wording: n.kind === "question" ? "Plain wording from the LLM." : null,
      noCatalogMatch: false,
    };
  };
}

function session(llm: Reasoners | ReasonerSetup | undefined) {
  return new ReplaySession(
    scenarioPaths("demo2-deconditioning", mkdtempSync(join(tmpdir(), "orbivit-llm-"))),
    llm,
  );
}

async function untilEvent(s: ReplaySession): Promise<void> {
  for (let i = 0; i < 100 && s.view().events.length === 0; i++) await s.advance(1);
}

async function play(s: ReplaySession, untilDay: number): Promise<void> {
  for (let guard = 0; guard < 2000 && s.day < untilDay; guard++) {
    if (s.waiting) await s.autoStep();
    else await s.advance(Math.min(1, untilDay - s.day));
  }
}

describe("LLM reasoner", () => {
  it("applies a valid proposal with the LLM's wording and provider", async () => {
    const { model } = mockModel([ask("q-chest-pain", "Any chest pain or pressure right now?")]);
    const s = session({ reasoner: createLlmReasoner(model, INFO), info: INFO });
    await untilEvent(s);
    const event = s.view().events[0]!;
    expect(event.pending).toEqual({ kind: "question", id: "q-chest-pain" });
    expect(event.pendingWording).toBe("Any chest pain or pressure right now?");
    const question = event.log.find((l) => l.stepType === "question");
    expect(question?.llm).toEqual(INFO);
    expect(question?.data.rationale).toBe("Rule out red flags first.");
  });

  it("retries once with the guardrail reasons after a rejected proposal", async () => {
    const { model, prompts } = mockModel([ask("q-fatigue"), ask("q-syncope")]);
    const s = session({ reasoner: createLlmReasoner(model, INFO), info: INFO });
    await untilEvent(s);
    const event = s.view().events[0]!;
    expect(event.log.filter((l) => l.stepType === "rejected")).toHaveLength(1);
    expect(prompts[1]).toContain("rejected by the guardrails");
    expect(event.pending).toEqual({ kind: "question", id: "q-syncope" });
  });

  it("uses the no-LLM fallback after two rejected proposals", async () => {
    const { model } = mockModel([ask("q-fatigue")]);
    const s = session({ reasoner: createLlmReasoner(model, INFO), info: INFO });
    await untilEvent(s);
    const event = s.view().events[0]!;
    expect(event.log.filter((l) => l.stepType === "rejected")).toHaveLength(2);
    expect(event.log.at(-1)?.llm).toEqual({ provider: "none" });
    expect(event.pending?.kind).toBe("question");
  });

  it("logs a reasoner error and falls back", async () => {
    const { model } = mockModel([new Error("network down")]);
    const s = session({ reasoner: createLlmReasoner(model, INFO), info: INFO });
    await untilEvent(s);
    const event = s.view().events[0]!;
    expect(
      event.log.some(
        (l) => l.stepType === "rejected" && JSON.stringify(l.data).includes("network down"),
      ),
    ).toBe(true);
    expect(event.pending?.kind).toBe("question");
  });

  it("does not call the LLM during a comm blackout", async () => {
    const { model, prompts } = mockModel([ask("q-chest-pain")]);
    const s = session({ reasoner: createLlmReasoner(model, INFO), info: INFO });
    s.set({ blackout: true });
    await untilEvent(s);
    expect(prompts).toHaveLength(0);
    expect(s.view().provider).toBe("none");
  });

  it("retries once when the output does not match the schema", async () => {
    const { model, prompts } = mockModel(["not json at all", ask("q-chest-pain")]);
    const s = session({ reasoner: createLlmReasoner(model, INFO), info: INFO });
    await untilEvent(s);
    const event = s.view().events[0]!;
    const rejected = event.log.filter((l) => l.stepType === "rejected");
    expect(rejected).toHaveLength(1);
    expect(JSON.stringify(rejected[0]?.data)).toContain("did not match the schema");
    expect(prompts[1]).toContain("rejected by the guardrails");
    expect(event.pending).toEqual({ kind: "question", id: "q-chest-pain" });
  });

  it("switches to the offline model during a comm blackout", async () => {
    const online = mockModel([ask("q-chest-pain")]);
    const offline = mockModel([ask("q-chest-pain", "Chest pain now?")]);
    const OFFLINE = { provider: "ollama", model: "medgemma:27b" } as const;
    const s = session({
      primary: { reasoner: createLlmReasoner(online.model, INFO), info: INFO },
      offline: { reasoner: createLlmReasoner(offline.model, OFFLINE), info: OFFLINE },
    });
    s.set({ blackout: true });
    expect(s.view()).toMatchObject({ provider: "ollama", model: "medgemma:27b" });
    await untilEvent(s);
    expect(online.prompts).toHaveLength(0);
    expect(offline.prompts).toHaveLength(1);
    const question = s.view().events[0]!.log.find((l) => l.stepType === "question");
    expect(question?.llm).toEqual(OFFLINE);
    s.set({ blackout: false });
    expect(s.view().provider).toBe("anthropic");
  });

  it("gives the model the standard meaning of findings and measures (ADR 0011)", async () => {
    const { model, prompts } = mockModel([ask("q-chest-pain")]);
    const s = session({ reasoner: createLlmReasoner(model, INFO), info: INFO });
    await untilEvent(s);
    expect(prompts[0]).toContain("TERMINOLOGY");
    expect(prompts[0]).toContain("f-fever: Fever [SNOMED CT 386661006, equivalent]");
    expect(prompts[0]).toMatch(/systolic-bp: [^\n]*UCUM mm\[Hg\]/);
  });

  it("maps a cited finding ID to the log line that recorded it", async () => {
    const out = ask("q-chest-pain");
    out.diagnoses = [
      {
        conditionId: "cv-deconditioning",
        uncataloguedName: null,
        confidence: 0.6,
        evidenceFor: ["f-exercise-hr-up"],
        evidenceAgainst: [],
        confirmingTest: null,
      },
    ];
    const { model } = mockModel([out]);
    const s = session({ reasoner: createLlmReasoner(model, INFO), info: INFO });
    await untilEvent(s);
    const event = s.view().events[0]!;
    expect(event.log.filter((l) => l.stepType === "rejected")).toHaveLength(0);
    expect(event.diagnoses[0]?.evidenceFor).toEqual([event.log[0]!.id]);
  });

  it("runs Demo 2 to a resolved event with ranked diagnoses", async () => {
    // The mock sees the investigation through the reasoner call, like the real prompt does.
    const reasoner: Reasoner = (inv, ctx) =>
      createLlmReasoner(mockModel([followFallback(() => inv)]).model, INFO)(inv, ctx);
    const s = session({ reasoner, info: INFO });
    await play(s, 150);
    const event = s.view().events[0]!;
    expect(event.outcome).toBe("resolved");
    expect(event.unranked).toBe(false);
    expect(event.diagnoses[0]?.name).toBe("Cardiovascular deconditioning");
    expect(event.log.filter((l) => l.stepType === "rejected")).toHaveLength(0);
  });

  it("allows an uncatalogued diagnosis only with escalation", async () => {
    const catalog = (session(undefined) as unknown as { catalog: Investigation["catalog"] })
      .catalog;
    const inv = new Investigation(catalog, {
      eventId: "evt-x",
      astronautId: "x",
      trigger: "passive",
      t: 1,
      ruleVersion: "test",
      now: () => "t",
      findings: [{ id: "f-unknown-signal", origin: "signal" }],
    });
    const trigger = inv.log[0]!.id;
    const { model } = mockModel([
      {
        rationale: "Nothing in the catalog explains this signal.",
        diagnoses: [
          {
            conditionId: null,
            uncataloguedName: "Unexplained signal change",
            confidence: 0.3,
            evidenceFor: [trigger, trigger],
            evidenceAgainst: [],
            confirmingTest: null,
          },
        ],
        next: {
          kind: "escalate",
          id: null,
          conditionId: null,
          actionId: null,
          reason: "uncatalogued",
        },
        wording: null,
        noCatalogMatch: true,
      },
    ]);
    const result = await createLlmReasoner(model, INFO)(inv, {});
    expect(inv.apply(result!.proposal, result!.llm)).toEqual([]);
    expect(inv.outcome).toBe("escalated");
    expect(inv.diagnoses[0]?.catalogued).toBe(false);
  });
});

describe("configFromEnv", () => {
  it("uses Claude only when a key is set, unless LLM_PROVIDER says otherwise", () => {
    expect(configFromEnv({}).provider).toBe("none");
    expect(configFromEnv({ ANTHROPIC_API_KEY: "x" }).provider).toBe("anthropic");
    expect(configFromEnv({ ANTHROPIC_API_KEY: "x", LLM_PROVIDER: "none" }).provider).toBe("none");
    expect(configFromEnv({}).model).toBe("claude-opus-5-5");
    expect(() => configFromEnv({ LLM_PROVIDER: "gpt" })).toThrow();
  });

  it("adds the offline model, or makes it the only reasoner with LLM_PROVIDER=ollama", () => {
    const both = reasonerFromConfig(
      configFromEnv({ ANTHROPIC_API_KEY: "x", OFFLINE_LLM_MODEL: "medgemma:27b" }),
    );
    expect(both.primary?.info).toEqual({ provider: "anthropic", model: "claude-opus-5-5" });
    expect(both.offline?.info).toEqual({ provider: "ollama", model: "medgemma:27b" });
    const local = reasonerFromConfig(
      configFromEnv({ LLM_PROVIDER: "ollama", OFFLINE_LLM_MODEL: "gpt-oss:20b" }),
    );
    expect(local.primary?.info).toEqual({ provider: "ollama", model: "gpt-oss:20b" });
    expect(reasonerFromConfig(configFromEnv({})).primary).toBeUndefined();
    expect(() => configFromEnv({ LLM_PROVIDER: "ollama" })).toThrow(/OFFLINE_LLM_MODEL/);
  });
});
