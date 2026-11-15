// Investigation engine (plan §5.4, ADR 0005, ADR 0010). Pure and deterministic: it owns safety.
// A reasoner (LLM or rule-based) proposes; this engine checks every proposal against guardrails.
import { measureDef, toResultValues, type MeasuredValue } from "./medical.ts";
import type {
  Catalog,
  CatalogCondition,
  DiagnosisRef,
  EventOutcome,
  LogData,
  LogLine,
  LogLineOf,
  LogStepType,
  SurveillanceTriggerData,
  TriggerKind,
  VerificationStatus,
} from "./types.ts";

export type FindingOrigin = "signal" | "answer" | "test" | "record";

export interface Finding {
  id: string;
  logId: string;
  t: number;
  origin: FindingOrigin;
}

export type NextStep =
  | { kind: "question"; id: string }
  | { kind: "test"; id: string }
  | { kind: "action"; conditionId: string; actionId: string }
  | { kind: "escalate"; reason: string };

export interface ProposedDiagnosis {
  ref: DiagnosisRef;
  confidence: number;
  evidenceFor: string[];
  evidenceAgainst: string[];
  confirmingTest?: string | undefined;
}

export interface Proposal {
  diagnoses: ProposedDiagnosis[];
  next: NextStep;
  /** Astronaut-facing wording of a question or action. */
  wording?: string | undefined;
  /** The reasoner says no catalog condition explains the evidence (allows uncatalogued mode). */
  noCatalogMatch?: boolean | undefined;
  /** The no-LLM fallback shows possible causes without confidences. */
  unranked?: boolean | undefined;
  /** Why the reasoner chose this step, for the crew medical officer. */
  rationale?: string | undefined;
}

export interface ShownDiagnosis extends ProposedDiagnosis {
  catalogued: boolean;
  name: string;
  /** False until the minimum-evidence rule passes (ADR 0005). */
  visible: boolean;
  /**
   * FHIR R4 Condition.verificationStatus: `provisional` for the top visible catalogued diagnosis
   * of a ranked list, `differential` for every other one. Only the crew medical officer confirms.
   */
  verificationStatus: VerificationStatus;
}

export type LlmInfo = NonNullable<LogLine["llm"]>;

export type Phase = "investigating" | "acting" | "followUp" | "closed";

export interface InvestigationOptions {
  eventId: string;
  astronautId: string;
  trigger: TriggerKind;
  t: number;
  ruleVersion: string;
  /** Trigger findings. `context` findings (for example resting HR in band) need not clear in follow-up. */
  findings: { id: string; origin: FindingOrigin; context?: boolean }[];
  /** Clock for log timestamps (injected so tests stay deterministic). */
  now: () => string;
  /** Extra data for the trigger line: the surveillance rule that fired. */
  triggerData?: { surveillance: SurveillanceTriggerData } | undefined;
}

/** Fallback score: share of a condition's supporting findings present, minus findings against. */
export function scoreCondition(condition: CatalogCondition, present: Set<string>): number {
  const support = condition.supports.filter((f) => present.has(f)).length;
  const against = condition.against.filter((f) => present.has(f)).length;
  return Math.max(0, (support - against) / condition.supports.length);
}

/** Net count of supporting findings present (support minus against). Ranks the fallback list. */
export function supportCount(condition: CatalogCondition, present: Set<string>): number {
  const support = condition.supports.filter((f) => present.has(f)).length;
  return support - condition.against.filter((f) => present.has(f)).length;
}

/** Below this best catalog score, the uncatalogued fallback may run (ADR 0010; illustrative). */
export const UNCATALOGUED_THRESHOLD = 0.15;

export class Investigation {
  readonly eventId: string;
  readonly catalog: Catalog;
  readonly log: LogLine[] = [];
  readonly findings: Finding[] = [];
  readonly asked: string[] = [];
  readonly tested: string[] = [];
  phase: Phase = "investigating";
  outcome: EventOutcome | undefined;
  pending: NextStep | undefined;
  pendingWording: string | undefined;
  diagnoses: ShownDiagnosis[] = [];
  unranked = false;
  followUpUntil: number | undefined;
  actionTaken: { conditionId: string; actionId: string } | undefined;
  /** Deviating findings that opened the event: all must clear for the event to close. */
  readonly triggerFindings: string[];
  private t: number;
  private seq = 0;
  private lastShown = "";
  private readonly opts: InvestigationOptions;

  constructor(catalog: Catalog, opts: InvestigationOptions) {
    this.catalog = catalog;
    this.opts = opts;
    this.eventId = opts.eventId;
    this.t = opts.t;
    this.triggerFindings = opts.findings.filter((f) => !f.context).map((f) => f.id);
    const line = this.write("trigger", {
      trigger: opts.trigger,
      findings: opts.findings.map((f) => f.id),
      ...opts.triggerData,
    });
    for (const f of opts.findings) this.addFinding(f.id, f.origin, line.id);
  }

  // ---------- State queries ----------

  present(): Set<string> {
    return new Set(this.findings.map((f) => f.id));
  }

  condition(id: string): CatalogCondition | undefined {
    return this.catalog.conditions.find((c) => c.id === id);
  }

  inPlay(): CatalogCondition[] {
    const present = this.present();
    // Rank by how many supporting findings are present, then by share. A share alone would rank
    // a short list (anemia: 3 of 4) above a long one with more evidence (deconditioning: 4 of 6).
    return this.catalog.conditions
      .map((c) => ({ c, n: supportCount(c, present), s: scoreCondition(c, present) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.n - a.n || b.s - a.s)
      .map((x) => x.c);
  }

  bestScore(): number {
    const present = this.present();
    return Math.max(0, ...this.catalog.conditions.map((c) => scoreCondition(c, present)));
  }

  /** Red-flag questions: asked first, before anything else. */
  safetyQuestions(): string[] {
    const flags = new Set(this.catalog.redFlags.map((r) => r.finding));
    return this.catalog.questions
      .filter((q) => (q.yes ?? []).some((f) => flags.has(f)))
      .map((q) => q.id);
  }

  /** ADR 0005: at least 3 supporting findings, from both passive data and an answer or test. */
  minimumEvidence(conditionId: string): boolean {
    const c = this.condition(conditionId);
    if (!c) return false;
    const supporting = this.findings.filter((f) => c.supports.includes(f.id));
    const passive = supporting.some((f) => f.origin === "signal" || f.origin === "record");
    const active = supporting.some((f) => f.origin === "answer" || f.origin === "test");
    return new Set(supporting.map((f) => f.id)).size >= 3 && passive && active;
  }

  /** Every step the engine allows now. A reasoner must choose one of these. */
  allowedSteps(): NextStep[] {
    if (this.phase !== "investigating") return [];
    const safety = this.safetyQuestions().filter((q) => !this.asked.includes(q));
    const escalate: NextStep = { kind: "escalate", reason: "crew medical officer review" };
    // Escalation is always allowed; while red-flag questions are open, nothing else is.
    if (safety.length > 0)
      return [...safety.map((id): NextStep => ({ kind: "question", id })), escalate];
    const steps: NextStep[] = [];
    const inPlay = this.inPlay();
    const questions = new Set(inPlay.flatMap((c) => c.questions));
    for (const id of questions) if (!this.asked.includes(id)) steps.push({ kind: "question", id });
    const tests = [...new Set(inPlay.flatMap((c) => c.tests))].filter(
      (id) => !this.tested.includes(id),
    );
    const cheap = tests.filter((id) => !this.catalog.tests.find((t) => t.id === id)?.consumable);
    // Cheapest first: a consumable test only when no non-consumable test is left.
    for (const id of cheap.length > 0 ? cheap : tests) steps.push({ kind: "test", id });
    for (const c of inPlay) {
      if (!this.minimumEvidence(c.id)) continue;
      for (const a of c.actions) steps.push({ kind: "action", conditionId: c.id, actionId: a.id });
    }
    steps.push(escalate);
    return steps;
  }

  // ---------- Guardrails ----------

  /** Returns the reasons a proposal breaks a guardrail; empty means it may reach the UI. */
  validate(proposal: Proposal): string[] {
    const reasons: string[] = [];
    const allowed = this.allowedSteps();
    const same = (a: NextStep, b: NextStep) =>
      a.kind === b.kind &&
      (a.kind === "escalate" ||
        (a.kind === "action" && b.kind === "action"
          ? a.conditionId === b.conditionId && a.actionId === b.actionId
          : "id" in a && "id" in b && a.id === b.id));
    if (!allowed.some((s) => same(s, proposal.next))) {
      reasons.push(`next step ${JSON.stringify(proposal.next)} is not allowed now`);
    }
    // Any line of this event log may be cited, including answers that produced no finding.
    const logIds = new Set(this.log.map((l) => l.id));
    const uncataloguedAllowed =
      proposal.noCatalogMatch === true || this.bestScore() < UNCATALOGUED_THRESHOLD;
    for (const d of proposal.diagnoses) {
      if ("conditionId" in d.ref) {
        if (!this.condition(d.ref.conditionId))
          reasons.push(`unknown condition ${d.ref.conditionId}`);
      } else if (!uncataloguedAllowed) {
        reasons.push(
          `uncatalogued diagnosis "${d.ref.uncatalogued.name}" while a catalog condition fits`,
        );
      }
      if (!(d.confidence >= 0 && d.confidence <= 1))
        reasons.push(`confidence out of range: ${d.confidence}`);
      for (const id of [...d.evidenceFor, ...d.evidenceAgainst]) {
        if (!logIds.has(id)) reasons.push(`cited evidence ${id} is not in the event log`);
      }
      if (d.confirmingTest && !this.catalog.tests.some((t) => t.id === d.confirmingTest)) {
        reasons.push(`confirming test ${d.confirmingTest} is not on the equipment list`);
      }
    }
    return reasons;
  }

  /** Applies a valid proposal. Call validate() first; invalid proposals are logged as rejected. */
  apply(proposal: Proposal, llm: LlmInfo): string[] {
    const reasons = this.validate(proposal);
    if (reasons.length > 0) {
      this.write("rejected", { reasons, proposal }, { llm });
      return reasons;
    }
    this.unranked = proposal.unranked === true;
    const shownDiagnoses = proposal.diagnoses.map((d) => {
      const catalogued = "conditionId" in d.ref;
      const name =
        "conditionId" in d.ref
          ? (this.condition(d.ref.conditionId)?.name ?? d.ref.conditionId)
          : d.ref.uncatalogued.name;
      const visible =
        "conditionId" in d.ref
          ? this.minimumEvidence(d.ref.conditionId)
          : d.evidenceFor.length >= 2;
      return { ...d, catalogued, name, visible };
    });
    // Rule 8 (docs/technical/10): only the leading catalogued diagnosis of a ranked list is
    // provisional; the app never writes confirmed or refuted.
    const lead = this.unranked ? undefined : shownDiagnoses.find((d) => d.visible && d.catalogued);
    this.diagnoses = shownDiagnoses.map((d) => ({
      ...d,
      verificationStatus: d === lead ? "provisional" : "differential",
    }));
    const shown = JSON.stringify(
      this.diagnoses
        .filter((d) => d.visible)
        .map((d) => [d.name, d.confidence, d.evidenceFor.length]),
    );
    // Log the assessment only when it changes, so the event log stays readable.
    if (this.diagnoses.some((d) => d.visible) && shown !== this.lastShown) {
      this.lastShown = shown;
      this.write(
        "diagnosis",
        {
          unranked: this.unranked,
          diagnoses: this.diagnoses
            .filter((d) => d.visible)
            .map((d) => ({
              name: d.name,
              ...("conditionId" in d.ref ? { conditionId: d.ref.conditionId } : {}),
              catalogued: d.catalogued,
              confidence: d.confidence,
              verificationStatus: d.verificationStatus,
            })),
        },
        { llm, conditionId: this.topCondition() ?? "uncatalogued" },
      );
    }
    this.pending = proposal.next;
    this.pendingWording = proposal.wording;
    const next = proposal.next;
    const why = proposal.rationale ? { rationale: proposal.rationale } : {};
    if (next.kind === "question")
      this.write(
        "question",
        { id: next.id, wording: proposal.wording, ...why },
        { llm, stepId: next.id },
      );
    if (next.kind === "test") this.write("test", { id: next.id, ...why }, { llm, stepId: next.id });
    if (next.kind === "action") {
      const action = this.condition(next.conditionId)?.actions.find((a) => a.id === next.actionId);
      this.write(
        "action",
        { id: next.actionId, text: action?.text, ...why },
        { llm, stepId: next.actionId, conditionId: next.conditionId },
      );
    }
    if (next.kind === "escalate") this.escalate(next.reason, llm);
    // An uncatalogued diagnosis always escalates and never leads to a treatment (ADR 0010).
    if (
      this.phase === "investigating" &&
      this.diagnoses.some((d) => d.visible && !d.catalogued) &&
      next.kind !== "question" &&
      next.kind !== "test"
    ) {
      this.escalate("uncatalogued diagnosis", llm);
    }
    return [];
  }

  /** Logs a reasoner failure (for example a timeout) without changing the investigation. */
  reject(reasons: string[], llm: LlmInfo): void {
    this.write("rejected", { reasons }, { llm });
  }

  topCondition(): string | undefined {
    const top = this.diagnoses.find((d) => d.visible && d.catalogued);
    return top && "conditionId" in top.ref ? top.ref.conditionId : undefined;
  }

  // ---------- Inputs from the astronaut and the devices ----------

  setTime(t: number): void {
    this.t = t;
  }

  answer(questionId: string, text: string): void {
    const q = this.catalog.questions.find((x) => x.id === questionId);
    if (!q) throw new Error(`unknown question ${questionId}`);
    const lower = text.trim().toLowerCase();
    const found = new Set<string>();
    if (lower.startsWith("yes")) for (const f of q.yes ?? []) found.add(f);
    if (lower.startsWith("no")) for (const f of q.no ?? []) found.add(f);
    for (const [keyword, fs] of Object.entries(q.keywords ?? {}))
      if (lower.includes(keyword)) fs.forEach((f) => found.add(f));
    this.asked.push(questionId);
    const line = this.write(
      "answer",
      { id: questionId, text, findings: [...found] },
      { stepId: questionId },
    );
    for (const f of found) this.addFinding(f, "answer", line.id);
    this.pending = undefined;
    this.checkRedFlags();
  }

  /**
   * Records a test result. `values` are keyed by measure ID; each must be a measure the test
   * returns, with the measure's value type. The log stores them with their UCUM units.
   */
  result(
    testId: string,
    values: Record<string, MeasuredValue>,
    label: LogLine["label"] = "SIMULATED",
  ): void {
    const spec = this.catalog.tests.find((t) => t.id === testId);
    if (!spec) throw new Error(`unknown test ${testId}`);
    const problems = resultProblems(this.catalog, spec.id, spec.returns, values);
    if (problems.length > 0) throw new Error(problems.join("; "));
    const found = spec.rules
      .filter((r) => {
        const v = values[r.field];
        if (v === undefined) return false;
        if (r.op === "eq") return v === r.value;
        return (
          typeof v === "number" &&
          typeof r.value === "number" &&
          (r.op === "lt" ? v < r.value : v > r.value)
        );
      })
      .map((r) => r.finding);
    this.tested.push(testId);
    const line = this.write(
      "result",
      { id: testId, values: toResultValues(this.catalog, values), findings: found },
      { stepId: testId, label },
    );
    for (const f of found) this.addFinding(f, "test", line.id);
    this.pending = undefined;
    this.checkRedFlags();
  }

  /**
   * The crew medical officer approves the recommended action. Follow-up starts, or, for an
   * escalating action, the event goes to the crew medical officer and the ground.
   */
  act(): { conditionId: string; actionId: string } | undefined {
    const next = this.pending;
    if (!next || next.kind !== "action") return undefined;
    const c = this.condition(next.conditionId);
    this.actionTaken = { conditionId: next.conditionId, actionId: next.actionId };
    const action = c?.actions.find((a) => a.id === next.actionId);
    if (action?.escalates) {
      this.pending = undefined;
      this.write(
        "escalate",
        {
          reason: `suspected: ${c?.name ?? next.conditionId}`,
          action: action.id,
          text: action.text,
        },
        { conditionId: next.conditionId, stepId: action.id },
      );
      this.phase = "closed";
      this.outcome = "escalated";
      return this.actionTaken;
    }
    this.phase = "followUp";
    this.followUpUntil = this.t + (c?.followUpDays ?? 7);
    this.write(
      "followUp",
      { action: next.actionId, until: this.followUpUntil },
      { conditionId: next.conditionId },
    );
    this.pending = undefined;
    return this.actionTaken;
  }

  /** Follow-up data: close when the trigger findings cleared, escalate when the window ran out. */
  followUp(clearedFindings: string[]): void {
    if (this.phase !== "followUp" || this.followUpUntil === undefined) return;
    const triggers = this.triggerFindings;
    const allCleared = triggers.length > 0 && triggers.every((f) => clearedFindings.includes(f));
    if (allCleared) {
      this.phase = "closed";
      this.outcome = "resolved";
      this.write("close", { outcome: "resolved", cleared: clearedFindings });
    } else if (this.t >= this.followUpUntil) {
      this.escalate("follow-up data did not return to baseline", { provider: "none" });
    }
  }

  escalate(reason: string, llm?: LlmInfo): void {
    if (this.phase === "closed") return;
    this.phase = "closed";
    this.outcome = "escalated";
    this.pending = undefined;
    this.write("escalate", { reason }, llm ? { llm } : {});
  }

  // ---------- Internals ----------

  private checkRedFlags(): void {
    const flags = this.catalog.redFlags.filter((r) => this.present().has(r.finding));
    if (flags.length > 0) this.escalate(`red flag: ${flags.map((f) => f.text).join(", ")}`);
  }

  private addFinding(id: string, origin: FindingOrigin, logId: string): void {
    this.findings.push({ id, origin, logId, t: this.t });
  }

  private write<K extends LogStepType>(
    stepType: K,
    data: LogData[K],
    extra: Partial<Pick<LogLine, "llm" | "stepId" | "conditionId" | "label">> = {},
  ): LogLineOf<K> {
    const line = {
      id: `${this.eventId}-${String(++this.seq).padStart(3, "0")}`,
      timestamp: this.opts.now(),
      missionDay: Math.round(this.t * 1000) / 1000,
      eventId: this.eventId,
      stepType,
      label: extra.label ?? "SIMULATED",
      ruleVersion: this.opts.ruleVersion,
      data,
      ...(extra.llm ? { llm: extra.llm } : {}),
      ...(extra.stepId ? { stepId: extra.stepId } : {}),
      ...(extra.conditionId ? { conditionId: extra.conditionId } : {}),
    } as LogLineOf<K>;
    this.log.push(line);
    return line;
  }
}

/** Problems with test values: unknown measures, or a value of the wrong type. */
export function resultProblems(
  catalog: Catalog,
  testId: string,
  returns: string[],
  values: Record<string, MeasuredValue>,
): string[] {
  const problems: string[] = [];
  for (const [measure, value] of Object.entries(values)) {
    if (!returns.includes(measure)) {
      problems.push(`${testId} does not return ${measure} (returns: ${returns.join(", ")})`);
      continue;
    }
    const def = measureDef(catalog, measure);
    if (def?.valueType === "panel") {
      problems.push(`${testId}: ${measure} is a panel; give its components instead`);
      continue;
    }
    const expected =
      def?.valueType === "quantity"
        ? "number"
        : def?.valueType === "boolean"
          ? "boolean"
          : "string";
    if (typeof value !== expected)
      problems.push(`${testId}: ${measure} must be a ${expected}, got ${JSON.stringify(value)}`);
  }
  return problems;
}
