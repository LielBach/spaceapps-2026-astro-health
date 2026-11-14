// Reasoners propose; the Investigation engine decides what is allowed (ADR 0010).
import {
  type Investigation,
  type NextStep,
  type Proposal,
  scoreCondition,
  supportCount,
} from "./investigation.ts";

/**
 * The no-LLM fallback (comm blackout in milestone 1): possible causes without confidences,
 * steps in each condition's fixed order, escalation when nothing in the catalog matches.
 */
export function ruleBasedProposal(inv: Investigation): Proposal {
  const present = inv.present();
  const inPlay = inv.inPlay();
  const evidence = (ids: string[]) =>
    inv.findings.filter((f) => ids.includes(f.id)).map((f) => f.logId);
  const diagnoses = inPlay.map((c) => ({
    ref: { conditionId: c.id },
    confidence: Math.round(scoreCondition(c, present) * 100) / 100,
    evidenceFor: evidence(c.supports),
    evidenceAgainst: evidence(c.against),
    confirmingTest: c.tests[0],
  }));
  const allowed = inv.allowedSteps();
  const first = (kind: NextStep["kind"]) => allowed.find((s) => s.kind === kind);
  let next: NextStep;
  if (inPlay.length === 0) {
    next = { kind: "escalate", reason: "no catalog condition matches" };
  } else {
    const top = inPlay[0]!;
    const ownQuestion = top.questions.find((q) =>
      allowed.some((s) => s.kind === "question" && s.id === q),
    );
    const ownTest = top.tests.find((t) => allowed.some((s) => s.kind === "test" && s.id === t));
    const action = allowed.find((s) => s.kind === "action" && s.conditionId === top.id);
    // Before acting, run the cheap tests of the differential: other conditions with at least two
    // supporting findings. One shared symptom (fatigue) alone does not justify a test.
    const consumable = (id: string) =>
      inv.catalog.tests.find((t) => t.id === id)?.consumable ?? true;
    const differential = inPlay.slice(1).filter((c) => supportCount(c, present) >= 2);
    const otherTest = differential
      .flatMap((c) => c.tests)
      .find((id) => !consumable(id) && allowed.some((s) => s.kind === "test" && s.id === id));
    next =
      first("question")?.kind === "question" &&
      inv.safetyQuestions().some((q) => !inv.asked.includes(q))
        ? first("question")!
        : ownQuestion
          ? { kind: "question", id: ownQuestion }
          : ownTest
            ? { kind: "test", id: ownTest }
            : otherTest
              ? { kind: "test", id: otherTest }
              : (action ??
                first("question") ??
                first("test") ?? { kind: "escalate", reason: "no step left" });
  }
  return { diagnoses, next, unranked: true };
}
