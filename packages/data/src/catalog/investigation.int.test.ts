import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Investigation, ruleBasedProposal, type Proposal } from "@orbivit/core";
import { loadCatalog, loadScenario } from "../index.ts";

const repo = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const catalog = loadCatalog(repo("catalog"));
const scenario = loadScenario(repo("scenarios/demo2-deconditioning.yaml"));
const NONE = { provider: "none" } as const;

function demo2(): Investigation {
  return new Investigation(catalog, {
    eventId: "evt-1",
    astronautId: scenario.astronaut.id,
    trigger: "passive",
    t: 110,
    ruleVersion: "test",
    now: () => "2026-01-01T00:00:00.000Z",
    findings: [
      { id: "f-exercise-hr-up", origin: "signal" },
      { id: "f-max-workload-down", origin: "signal" },
      { id: "f-resting-hr-in-band", origin: "signal", context: true },
    ],
  });
}

/** Runs the no-LLM reasoner with the scripted answers until it recommends an action or stops. */
function runToAction(inv: Investigation, answers: Record<string, string> = {}): void {
  for (let i = 0; i < 40 && inv.phase === "investigating"; i++) {
    expect(inv.apply(ruleBasedProposal(inv), NONE)).toEqual([]);
    const next = inv.pending;
    if (!next || next.kind === "action" || next.kind === "escalate") return;
    if (next.kind === "question") {
      inv.answer(
        next.id,
        answers[next.id] ?? scenario.answers.byQuestion[next.id] ?? scenario.answers.default,
      );
    } else {
      inv.result(next.id, scenario.testResults[next.id] ?? {});
    }
  }
}

describe("Demo 2 investigation with the no-LLM reasoner", () => {
  const inv = demo2();
  runToAction(inv);
  const asked = inv.log.filter((l) => l.stepType === "question").map((l) => l.stepId);

  it("asks every red-flag question first", () => {
    expect(asked.slice(0, 4).sort()).toEqual([
      "q-chest-pain",
      "q-dyspnea",
      "q-headache-vision",
      "q-syncope",
    ]);
  });

  it("recommends the countermeasure review from the deconditioning pathway", () => {
    expect(inv.pending).toEqual({
      kind: "action",
      conditionId: "cv-deconditioning",
      actionId: "a-countermeasure-review",
    });
    expect(inv.topCondition()).toBe("cv-deconditioning");
    expect(inv.unranked).toBe(true);
  });

  it("uses no consumable test", () => {
    expect(inv.tested).not.toContain("t-istat-chem8");
  });

  it("cites only log lines that exist", () => {
    const ids = new Set(inv.log.map((l) => l.id));
    for (const d of inv.diagnoses) for (const id of d.evidenceFor) expect(ids.has(id)).toBe(true);
  });

  it("closes as resolved when the trigger findings clear in follow-up", () => {
    expect(inv.act()).toEqual({
      conditionId: "cv-deconditioning",
      actionId: "a-countermeasure-review",
    });
    expect(inv.followUpUntil).toBe(110 + 21);
    inv.setTime(125);
    inv.followUp(["f-exercise-hr-up", "f-max-workload-down"]);
    expect(inv.outcome).toBe("resolved");
    expect(inv.log.at(-1)?.stepType).toBe("close");
  });
});

describe("guardrails", () => {
  const base = (over: Partial<Proposal>): Proposal => ({
    diagnoses: [],
    next: { kind: "question", id: "q-chest-pain" },
    ...over,
  });

  it("rejects a step outside the allowed list (safety questions come first)", () => {
    const inv = demo2();
    const reasons = inv.apply(base({ next: { kind: "question", id: "q-fatigue" } }), NONE);
    expect(reasons[0]).toContain("not allowed");
    expect(inv.log.at(-1)?.stepType).toBe("rejected");
  });

  it("rejects an action before the minimum-evidence rule passes", () => {
    const inv = demo2();
    for (const q of inv.safetyQuestions()) inv.answer(q, "no");
    const next = {
      kind: "action",
      conditionId: "cv-deconditioning",
      actionId: "a-countermeasure-review",
    } as const;
    expect(inv.validate(base({ next }))).not.toEqual([]);
    inv.answer("q-fatigue", "Workouts feel harder, more tired after the session");
    expect(inv.validate(base({ next }))).toEqual([]);
  });

  it("maps choice and open answers to findings", () => {
    const inv = demo2();
    const findings = () => inv.findings.map((f) => f.id);
    inv.answer("q-fluid-intake", "About the same");
    expect(findings()).not.toContain("f-low-fluid-intake");
    inv.answer("q-fluid-intake", "Less than usual");
    expect(findings()).toContain("f-low-fluid-intake");
    inv.answer("q-fatigue", "Not tired, no fatigue at all");
    expect(findings()).not.toContain("f-fatigue");
    inv.answer("q-fatigue", "I get tired faster");
    expect(findings()).toContain("f-fatigue");
  });

  it("rejects an invented condition, a missing log citation and an unknown test", () => {
    const inv = demo2();
    const reasons = inv.validate(
      base({
        diagnoses: [
          {
            ref: { conditionId: "made-up" },
            confidence: 0.5,
            evidenceFor: ["evt-1-999"],
            evidenceAgainst: [],
            confirmingTest: "t-mri",
          },
        ],
      }),
    );
    expect(reasons.join("\n")).toMatch(/unknown condition made-up/);
    expect(reasons.join("\n")).toMatch(/evt-1-999 is not in the event log/);
    expect(reasons.join("\n")).toMatch(/t-mri is not on the equipment list/);
  });

  it("marks only the leading ranked diagnosis provisional, never confirmed", () => {
    const inv = demo2();
    for (const q of inv.safetyQuestions()) inv.answer(q, "no");
    inv.answer("q-fatigue", "More tired after workouts");
    const cite = inv.log.map((l) => l.id);
    const dx = (conditionId: string, confidence: number) => ({
      ref: { conditionId },
      confidence,
      evidenceFor: cite.slice(0, 2),
      evidenceAgainst: [],
    });
    const next = { kind: "question", id: "q-adherence" } as const;
    expect(inv.apply(base({ diagnoses: [dx("cv-deconditioning", 0.6)], next }), NONE)).toEqual([]);
    expect(inv.diagnoses.map((d) => d.verificationStatus)).toEqual(["provisional"]);
    // The no-LLM fallback list is unranked: every entry stays differential.
    expect(inv.apply(ruleBasedProposal(inv), NONE)).toEqual([]);
    expect(inv.diagnoses.every((d) => d.verificationStatus === "differential")).toBe(true);
  });

  it("accepts a citation of an answer that produced no finding", () => {
    const inv = demo2();
    inv.answer("q-chest-pain", "no");
    const noAnswer = inv.log.at(-1)!.id;
    const d = {
      ref: { conditionId: "cv-deconditioning" },
      confidence: 0.5,
      evidenceFor: [],
      evidenceAgainst: [noAnswer],
    };
    expect(
      inv.validate(base({ diagnoses: [d], next: { kind: "question", id: "q-syncope" } })),
    ).toEqual([]);
  });

  it("rejects an uncatalogued diagnosis while a catalog condition fits", () => {
    const inv = demo2();
    const d = {
      ref: { uncatalogued: { name: "Something new" } },
      confidence: 0.4,
      evidenceFor: [],
      evidenceAgainst: [],
    };
    expect(inv.validate(base({ diagnoses: [d] })).join()).toMatch(/uncatalogued/);
    expect(inv.validate(base({ diagnoses: [d], noCatalogMatch: true }))).toEqual([]);
  });

  it("escalates an uncatalogued diagnosis instead of acting on it", () => {
    const inv = demo2();
    for (const q of inv.safetyQuestions()) inv.answer(q, "no");
    const trigger = inv.log[0]!.id;
    const d = {
      ref: { uncatalogued: { name: "Something new" } },
      confidence: 0.4,
      evidenceFor: [trigger, trigger],
      evidenceAgainst: [],
    };
    inv.apply(
      { diagnoses: [d], next: { kind: "escalate", reason: "uncatalogued" }, noCatalogMatch: true },
      NONE,
    );
    expect(inv.outcome).toBe("escalated");
  });

  it("escalates at once on a red-flag answer", () => {
    const inv = demo2();
    inv.answer("q-chest-pain", "yes, pressure");
    expect(inv.outcome).toBe("escalated");
    expect(inv.allowedSteps()).toEqual([]);
  });

  it("escalates when follow-up data do not return to baseline", () => {
    const inv = demo2();
    runToAction(inv);
    inv.act();
    inv.setTime(140);
    inv.followUp(["f-max-workload-down"]);
    expect(inv.outcome).toBe("escalated");
  });

  it("escalates in the fallback when no catalog condition matches", () => {
    const inv = new Investigation(catalog, {
      eventId: "evt-2",
      astronautId: "x",
      trigger: "passive",
      t: 1,
      ruleVersion: "test",
      now: () => "t",
      findings: [{ id: "f-unknown", origin: "signal" }],
    });
    runToAction(inv);
    expect(inv.outcome).toBe("escalated");
  });
});
