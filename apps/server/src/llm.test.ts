import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { Investigation, ruleBasedProposal } from "@orbivit/core";
import { scenarioPaths } from "./app.ts";
import { configFromEnv, createLlmReasoner, type ProposalOutput } from "./llm.ts";
import { ReplaySession, type Reasoner, type ReasonerSetup } from "./session.ts";

const INFO = { provider: "anthropic", model: "mock" } as const;

/** A mock model that answers each call with the next output from `outputs` (the last one repeats). */
function mockModel(outputs: (ProposalOutput | Error | ((prompt: string) => ProposalOutput))[]) {
  const prompts: string[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      const prompt = JSON.stringify(options.prompt);
      prompts.push(prompt);
      const next = outputs[Math.min(prompts.length - 1, outputs.length - 1)]!;
      if (next instanceof Error) throw next;
      const out = typeof next === "function" ? next(prompt) : next;
      return {
        content: [{ type: "text", text: JSON.stringify(out) }],
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

function session(llm: ReasonerSetup | undefined) {
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

  it("sends the medical-standard rules and the coded catalog to every provider", async () => {
    const { model, prompts } = mockModel([ask("q-chest-pain")]);
    const s = session({ reasoner: createLlmReasoner(model, INFO), info: INFO });
    await untilEvent(s);
    const prompt = prompts[0]!;
    // Rules: source hierarchy, suspected-only diagnoses, coded measures with UCUM units.
    for (const rule of [
      "NASA-STD-3001 Volume 1",
      "only the crew medical officer confirms or refutes",
      "Never call a diagnosis confirmed",
      "UCUM unit",
      "An Earth lab-reference range does not define normal in microgravity",
      "Every test needs a clinical indication",
    ])
      expect(prompt).toContain(rule);
    // Catalog: condition codes with equivalence, SNOMED CT findings, LOINC measures with units.
    expect(prompt).toContain('\\"code\\":\\"I82.C1\\"');
    expect(prompt).toContain('\\"equivalence\\":\\"unmatched\\"');
    expect(prompt).toMatch(/\\"findings\\":\[\{\\"id\\":\\"f-/);
    expect(prompt).toContain('\\"system\\":\\"loinc\\"');
    expect(prompt).toContain('\\"unit\\":\\"/min\\"');
    // Event log lines keep their data label.
    expect(prompt).toMatch(/\\"label\\":\\"(REAL|SIMULATED|REFERENCE)\\"/);
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
});
