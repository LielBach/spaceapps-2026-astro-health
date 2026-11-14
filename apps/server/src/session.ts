// One replay run (plan §5.2, §5.6): clock, stream, detection, investigation and the JSONL event log.
// The clock is driven from outside (advance), so tests run without timers.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_DETECTION,
  Detector,
  Investigation,
  ruleBasedProposal,
  type Catalog,
  type DetectionOutput,
  type LlmInfo,
  type Proposal,
  type ChartPoint,
  type Marker,
  type SessionView,
} from "@astrohealth/core";
import {
  createStream,
  loadAnchors,
  loadCatalog,
  loadScenario,
  type Intervention,
  type Scenario,
  type Stream,
} from "@astrohealth/data";

export const RULE_VERSION = "m1c-0.1";

/** Proposes the next step. Returns undefined to use the no-LLM fallback. */
export type Reasoner = (
  inv: Investigation,
  ctx: { retryReasons?: string[] },
) => Promise<{ proposal: Proposal; llm: LlmInfo } | undefined>;

export interface ReasonerSetup {
  reasoner: Reasoner;
  info: LlmInfo;
}

export interface SessionPaths {
  scenario: string;
  anchors: string;
  catalog: string;
  sources: string;
  runs: string;
}

export class ReplaySession {
  readonly runId: string;
  readonly scenario: Scenario;
  readonly catalog: Catalog;
  day: number;
  playing = false;
  /** Mission days per real minute (Q20: 1–30). */
  speed = 10;
  blackout = false;
  autopilot = false;
  readonly overrides: Record<string, string> = {};
  private readonly stream: Stream;
  private readonly detector: Detector;
  private readonly runFile: string;
  private readonly sources: SessionView["sources"];
  private readonly points: ChartPoint[] = [];
  private readonly hr: SessionView["hr"] = [];
  private readonly markers: Marker[] = [];
  private readonly events: Investigation[] = [];
  private readonly interventions: Intervention[] = [];
  private readonly cleared = new Set<string>();
  private written = new Map<string, number>();
  private busy = false;
  private readonly listeners = new Set<() => void>();

  constructor(
    paths: SessionPaths,
    private readonly llm: ReasonerSetup | undefined = undefined,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.scenario = loadScenario(paths.scenario);
    this.catalog = loadCatalog(paths.catalog);
    this.sources = (
      JSON.parse(readFileSync(paths.sources, "utf8")) as { sources: SessionView["sources"] }
    ).sources;
    this.stream = createStream(
      this.scenario,
      loadAnchors(paths.anchors, this.scenario.astronaut.anchorSources),
    );
    const start = this.scenario.mission.replayFromDay;
    // The frozen baseline uses the 30 days before the replay starts (Q19).
    this.detector = new Detector({ ...DEFAULT_DETECTION, baselineDays: [start - 30, start] });
    const window = this.stream.samplesBetween(start - 30, start);
    for (const s of window)
      if (s.signal === "hr") this.hr.push({ t: s.t, value: s.value, context: s.context ?? "" });
    for (const out of this.detector.ingest(window)) {
      if (out.kind === "baselineWindow") {
        this.points.push({
          t: out.t,
          metric: out.metric,
          value: out.value,
          baseline: null,
          limit: null,
          deviating: false,
        });
      }
    }
    this.day = start;
    this.runId = `${this.scenario.id}-${this.now().toISOString().replace(/[:.]/g, "-")}`;
    mkdirSync(paths.runs, { recursive: true });
    this.runFile = join(paths.runs, `${this.runId}.jsonl`);
  }

  get provider(): LlmInfo["provider"] {
    return this.blackout || !this.llm ? "none" : this.llm.info.provider;
  }

  /** The replay waits for the astronaut or the crew medical officer. */
  get waiting(): boolean {
    return (
      this.busy || this.events.some((e) => e.phase === "investigating" && e.pending !== undefined)
    );
  }

  get active(): Investigation | undefined {
    return this.events.find((e) => e.phase !== "closed");
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Advances mission time by `days`, unless the replay waits for an answer. */
  async advance(days: number): Promise<void> {
    if (this.waiting || days <= 0) return;
    const end = Math.min(this.day + days, this.scenario.mission.lengthDays);
    let from = this.day;
    // Step in hours so an event can stop the clock at the hour it opens.
    while (from < end - 1e-9 && !this.waiting) {
      const to = Math.min(end, Math.floor(from * 24 + 1e-6) / 24 + 1 / 24);
      const samples = this.stream.samplesBetween(from, to, this.interventions);
      for (const s of samples)
        if (s.signal === "hr") this.hr.push({ t: s.t, value: s.value, context: s.context ?? "" });
      for (const out of this.detector.ingest(samples)) await this.handle(out);
      const newDay = Math.floor(to + 1e-9) > Math.floor(from + 1e-9);
      from = to;
      this.day = to;
      if (newDay) this.followUp();
    }
    if (this.day >= this.scenario.mission.lengthDays) this.playing = false;
    this.emit();
  }

  async answer(eventId: string, questionId: string, text?: string): Promise<void> {
    const inv = this.event(eventId);
    if (inv.pending?.kind !== "question" || inv.pending.id !== questionId)
      throw new Error(`no pending question ${questionId}`);
    inv.setTime(this.day);
    inv.answer(questionId, text ?? this.scriptedAnswer(questionId));
    await this.next(inv);
  }

  async runTest(eventId: string, testId: string): Promise<void> {
    const inv = this.event(eventId);
    if (inv.pending?.kind !== "test" || inv.pending.id !== testId)
      throw new Error(`no pending test ${testId}`);
    inv.setTime(this.day);
    inv.result(testId, this.scenario.testResults[testId] ?? {});
    await this.next(inv);
  }

  /** The crew medical officer approves the recommended action. */
  approve(eventId: string): void {
    const inv = this.event(eventId);
    inv.setTime(this.day);
    const taken = inv.act();
    if (!taken) throw new Error("no pending action");
    this.interventions.push({ action: taken.actionId, day: this.day });
    this.cleared.clear();
    this.markers.push({ t: this.day, kind: "action", text: taken.actionId });
    // Follow-up runs over weeks: return to the normal replay speed.
    this.speed = Math.max(this.speed, 10);
    this.flush();
    this.emit();
  }

  /** Performs the pending step with the scripted answer, result or approval (autopilot and tests). */
  async autoStep(): Promise<boolean> {
    const inv = this.events.find((e) => e.phase === "investigating" && e.pending);
    const next = inv?.pending;
    if (!inv || !next) return false;
    if (next.kind === "question") await this.answer(inv.eventId, next.id);
    else if (next.kind === "test") await this.runTest(inv.eventId, next.id);
    else if (next.kind === "action") this.approve(inv.eventId);
    return true;
  }

  scriptedAnswer(questionId: string): string {
    return (
      this.overrides[questionId] ??
      this.scenario.answers.byQuestion[questionId] ??
      this.scenario.answers.default
    );
  }

  set(options: {
    playing?: boolean;
    speed?: number;
    blackout?: boolean;
    autopilot?: boolean;
  }): void {
    if (options.playing !== undefined) this.playing = options.playing;
    if (options.speed !== undefined) this.speed = Math.min(30, Math.max(1, options.speed));
    if (options.blackout !== undefined) this.blackout = options.blackout;
    if (options.autopilot !== undefined) this.autopilot = options.autopilot;
    this.emit();
  }

  override(questionId: string, text: string | undefined): void {
    if (text === undefined || text === "") delete this.overrides[questionId];
    else this.overrides[questionId] = text;
    this.emit();
  }

  view(): SessionView {
    return {
      runId: this.runId,
      scenario: {
        id: this.scenario.id,
        title: this.scenario.title,
        mission: this.scenario.mission,
      },
      astronaut: this.scenario.astronaut,
      day: this.day,
      playing: this.playing,
      speed: this.speed,
      blackout: this.blackout,
      autopilot: this.autopilot,
      waiting: this.waiting,
      reasoning: this.busy,
      model: this.blackout ? undefined : this.llm?.info.model,
      provider: this.provider,
      points: this.points,
      hr: this.hr,
      markers: this.markers,
      events: this.events.map((e) => ({
        id: e.eventId,
        trigger: e.log[0]?.data.trigger as string,
        phase: e.phase,
        outcome: e.outcome,
        openedAt: e.log[0]?.missionDay ?? 0,
        pending: e.pending,
        pendingWording: e.pendingWording,
        diagnoses: e.diagnoses,
        unranked: e.unranked,
        followUpUntil: e.followUpUntil,
        log: e.log,
      })),
      overrides: this.overrides,
      scripted: { answers: this.scenario.answers, testResults: this.scenario.testResults },
      catalog: this.catalog,
      sources: this.sources,
    };
  }

  // ---------- Internals ----------

  private async handle(out: DetectionOutput): Promise<void> {
    switch (out.kind) {
      case "deviation":
      case "inBand":
        this.points.push({
          t: out.t,
          metric: out.metric,
          value: out.value,
          baseline: out.baseline,
          limit: out.limit,
          deviating: out.kind === "deviation",
        });
        return;
      case "ignored":
        this.markers.push({
          t: out.t,
          kind: "ignored",
          text: `HR ${out.value} bpm ignored: ${out.reason}`,
        });
        return;
      case "watch":
        this.markers.push({
          t: out.t,
          kind: "watch",
          text: `silent watch: ${out.finding}`,
          metric: out.metric,
        });
        return;
      case "cleared":
        this.cleared.add(out.finding);
        this.markers.push({
          t: out.t,
          kind: "cleared",
          text: `back in band: ${out.finding}`,
          metric: out.metric,
        });
        this.followUp();
        return;
      case "baselineUpdated":
        this.markers.push({
          t: out.t,
          kind: "baselineUpdated",
          text: `baseline ${out.metric} ${out.from} → ${out.to}`,
          metric: out.metric,
        });
        return;
      case "urgent": {
        this.markers.push({ t: out.t, kind: "urgent", text: `urgent: ${out.finding}` });
        const inv = this.open("urgent", out.t, [{ id: out.finding, origin: "signal" }]);
        inv.escalate(`urgent interrupt: ${out.finding}`);
        this.flush();
        return;
      }
      case "open": {
        this.markers.push({
          t: out.t,
          kind: "open",
          text: `event opened: ${out.findings.join(", ")}`,
        });
        const inv = this.open("passive", out.t, [
          ...out.findings.map((id) => ({ id, origin: "signal" as const })),
          ...out.context.map((id) => ({ id, origin: "signal" as const, context: true })),
        ]);
        // Q20: slow down when an event opens.
        this.speed = Math.min(this.speed, 2);
        await this.next(inv);
        return;
      }
      default:
        return;
    }
  }

  private open(
    trigger: "passive" | "urgent" | "surveillance",
    t: number,
    findings: { id: string; origin: "signal" | "record"; context?: boolean }[],
  ): Investigation {
    const inv = new Investigation(this.catalog, {
      eventId: `evt-${String(this.events.length + 1).padStart(3, "0")}`,
      astronautId: this.scenario.astronaut.id,
      trigger,
      t,
      ruleVersion: RULE_VERSION,
      findings,
      now: () => this.now().toISOString(),
    });
    this.events.push(inv);
    this.detector.setEventOpen(true);
    return inv;
  }

  /** Asks the reasoner for the next step: one retry after a guardrail rejection, then the fallback. */
  private async next(inv: Investigation): Promise<void> {
    this.busy = true;
    this.emit();
    try {
      if (inv.phase === "investigating") {
        let reasons: string[] = [];
        // Plan §5.4: one retry after a guardrail rejection, then the no-LLM fallback.
        for (let attempt = 0; attempt < 2 && !this.blackout && this.llm; attempt++) {
          const { reasoner, info } = this.llm;
          const result = await reasoner(inv, attempt > 0 ? { retryReasons: reasons } : {}).catch(
            (error: unknown) => {
              const message = error instanceof Error ? error.message : String(error);
              inv.reject([`reasoner error: ${message}`], info);
              return undefined;
            },
          );
          if (!result) break;
          reasons = inv.apply(result.proposal, result.llm);
          if (reasons.length === 0) break;
        }
        if (inv.pending === undefined && inv.phase === "investigating") {
          inv.apply(ruleBasedProposal(inv), { provider: "none" });
        }
      }
      if (inv.phase === "closed")
        this.detector.setEventOpen(this.events.some((e) => e.phase !== "closed"));
    } finally {
      this.busy = false;
      this.flush();
      this.emit();
    }
  }

  private followUp(): void {
    for (const inv of this.events) {
      if (inv.phase !== "followUp") continue;
      inv.setTime(this.day);
      inv.followUp([...this.cleared]);
      if (inv.outcome !== undefined) {
        this.detector.setEventOpen(this.events.some((e) => e.phase !== "closed"));
        this.speed = Math.max(this.speed, 10);
      }
    }
    this.flush();
  }

  private event(id: string): Investigation {
    const inv = this.events.find((e) => e.eventId === id);
    if (!inv) throw new Error(`unknown event ${id}`);
    return inv;
  }

  /** Appends new log lines to runs/<runId>.jsonl (Q18). */
  private flush(): void {
    for (const inv of this.events) {
      const done = this.written.get(inv.eventId) ?? 0;
      const lines = inv.log.slice(done);
      if (lines.length === 0) continue;
      appendFileSync(this.runFile, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
      this.written.set(inv.eventId, inv.log.length);
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
